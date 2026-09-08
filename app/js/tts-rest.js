/*
 * tts-rest.js — speaking through any REST voice service described in speech-catalog.js.
 *
 * WHY ONE MODULE AND NOT THREE (Ken, September 8 2026, asking for OpenAI, Google Cloud
 * and ElevenLabs). tts-azure.js is a complete, on-device-proven REST voice backend, and
 * the three new services differ from it in a URL, a header name and where the audio sits
 * in the reply. Copying it three times would have copied its bugs three times too, and
 * every future fix would need finding in four places. So the differences are DATA
 * (speech-catalog.js) and this is the one implementation.
 *
 * ⚠ EVERY HARD-WON DETAIL FROM tts-azure.js AND tts-deepgram.js IS REPRODUCED HERE ON
 * PURPOSE, and none of it is decoration:
 *   - the AudioContext RESUME IS AWAITED BEFORE ANY AUDIO STARTS. A browser suspends an
 *     idle context, resume() is asynchronous, and a buffer started against a context
 *     that is still waking loses whatever the browser considers already past. It is
 *     heard as THE FIRST WORD GOING MISSING, intermittently, most often on a statement
 *     typed in the compose pane — which is where the app is quiet longest.
 *   - decodeAudioData is wrapped for BOTH its callback and promise forms, because older
 *     WebKit only has the first and a silent no-op there would land on exactly the
 *     platform the paid voice exists for.
 *   - a playToken so a cancel() during the resume wait is not overtaken by playback.
 *   - billing counted only once a request has been ACCEPTED, so a refused call cannot
 *     overstate what the user owes.
 *   - the cache, because placeholders, control phrases and Express buttons repeat
 *     constantly and are most of what the app says.
 *
 * ⚠ AZURE AND DEEPGRAM ARE DELIBERATELY NOT MOVED ONTO THIS. Deepgram speaks a
 * WebSocket protocol and streams its audio, so it is a genuinely different thing. Azure
 * would fold in cleanly — but it is the one REST path proven against a real key, and
 * refactoring a working, unverifiable-here path to save a file is the trade this project
 * has learned not to make. Fold it in the day somebody has an Azure key and can re-run
 * its Test button.
 *
 * ⚠ NOTHING IN THIS FILE HAS BEEN RUN AGAINST A REAL KEY. There is none on this machine
 * for any of the three services. The Settings Test button is the confirmation.
 */
import { describeFailure } from './speech-catalog.js';

// Generous enough for a cold connection on tablet wifi, short enough that a dead network
// does not leave the user in silence with a partner waiting. Same value as Azure's.
const SYNTH_TIMEOUT_MS = 6000;

// Capped by count rather than bytes for the same reason as the other backends: entries
// are short phrases, and a count is something a reader can reason about.
const MAX_CACHE_ENTRIES = 300;

/** voice + text — the two things that change what comes back. */
export function cacheKey(voice, text) {
    // ⚠ THE SEPARATOR IS A NUL WRITTEN AS AN ESCAPE, never as a raw byte - the same
    // point tts-azure.js makes and for the same reason: a literal NUL makes git and
    // grep treat the whole file as binary, so its diffs stop being reviewable. This
    // file was written with the raw byte and it took a control-byte scan to notice.
    return `${voice}\0${text}`;
}

/** What the user is billed for. Every one of these services charges by character. */
export function billableCharacters(text) {
    return (text || '').length;
}

/**
 * Fetch the provider's real voice list, where it has one.
 *
 * Returns [] for a provider with no catalog endpoint (OpenAI publishes none), so a
 * caller can treat "no catalog" and "catalog fetch found nothing" the same way: keep
 * showing the built-in starter list.
 */
export async function fetchVoices(provider, key, timeoutMs = 10000) {
    if (!provider || !provider.catalog || !key) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(provider.catalog.url({ key }), {
            headers: provider.catalog.headers({ key }),
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(describeFailure(res.status, provider.label));
        return provider.catalog.read(await res.json()) || [];
    } finally {
        clearTimeout(timer);
    }
}

/**
 * A voice backend for one provider. The contract matches tts-deepgram.js and
 * tts-azure.js exactly — { speak, cancel, isSpeaking, unlock, test, reset } — so tts.js
 * routes to any of them without knowing which is which.
 */
export function createVoice({ provider, getKey, getModel, onBilled } = {}) {
    let ctx = null;
    const sources = new Set();   // playback nodes started but not yet finished
    let playToken = 0;
    let inFlight = null;
    let chain = Promise.resolve();
    const cache = new Map();
    // Set only while the Settings Test button exercises a key the user has typed but not
    // yet saved, so Test reports on what is on screen rather than on what is stored.
    let override = null;

    const currentKey = () => (override ? override.key : (getKey && getKey())) || '';
    const currentModel = () => (override && override.model)
        || (getModel && getModel())
        || provider.defaultModel;

    function audioContext() {
        if (!ctx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) throw new Error('This browser cannot play audio.');
            ctx = new Ctor();
        }
        return ctx;
    }

    /*
     * iOS starts an AudioContext suspended and resumes it only inside a user gesture.
     * Placeholders fire on TIMERS, so without an unlock during some earlier tap the app
     * goes silent exactly when it is trying to hold the floor. Cheap and idempotent.
     */
    function unlock() {
        try {
            const c = audioContext();
            if (c.state === 'suspended') c.resume();
        } catch { /* no audio at all — speak() will report it */ }
    }

    async function fetchAudio(voice, text) {
        const key = currentKey();
        if (!key) throw new Error(`No ${provider.label} key is set.`);
        const model = currentModel();

        const controller = new AbortController();
        inFlight = controller;
        const timer = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(provider.url({ key, voice }), {
                method: 'POST',
                headers: provider.headers({ key }),
                body: provider.body({ voice, text, model }),
                signal: controller.signal,
            });
        } catch (err) {
            // An abort is either our timeout or a cancel(); a genuine network failure
            // looks identical to fetch. Name both rather than claiming to know which.
            throw new Error(err && err.name === 'AbortError'
                ? 'The voice service took too long, or the connection dropped.'
                : 'Could not reach the voice service — check your internet connection.');
        } finally {
            clearTimeout(timer);
            if (inFlight === controller) inFlight = null;
        }
        if (!res.ok) throw new Error(describeFailure(res.status, provider.label));

        // Only once accepted: billing a refused request would overstate the bill, which
        // is the one direction that matters in a product whose premise is "pay for what
        // you use".
        if (onBilled) onBilled(billableCharacters(text));

        // Most services hand back raw audio; Google wraps base64 in JSON, and says so by
        // supplying its own reader.
        const blob = provider.audioFrom
            ? await provider.audioFrom(res, provider.mimeType)
            : await res.blob();
        const bytes = await blob.arrayBuffer();
        if (!bytes || !bytes.byteLength) throw new Error('The voice service returned no audio.');
        return bytes;
    }

    // Callback-based on older WebKit, promise-based everywhere else. Wrapping both is
    // three lines and avoids a silent no-op on the platform this path exists for.
    function decode(c, bytes) {
        return new Promise((resolve, reject) => {
            const fail = () => reject(new Error('The audio from the voice service could not be played.'));
            let out;
            try {
                out = c.decodeAudioData(bytes, resolve, fail);
            } catch {
                return fail();
            }
            if (out && typeof out.then === 'function') out.then(resolve, fail);
        });
    }

    function play(c, buffer) {
        return new Promise((resolve) => {
            const node = c.createBufferSource();
            node.buffer = buffer;
            node.connect(c.destination);
            sources.add(node);
            node.onended = () => { sources.delete(node); resolve(); };
            node.start();
        });
    }

    function remember(k, buffer) {
        cache.set(k, buffer);
        while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    }

    /*
     * Speak, resolving when the audio has finished. Throws on any failure so tts.js can
     * fall back to the browser's own voice — never swallow an error here, because a
     * silent failure means the user pressed a button and nothing happened.
     */
    function speak(text, { model = provider.defaultVoice } = {}) {
        const run = async () => {
            const trimmed = (text || '').trim();
            if (!trimmed) return;

            const c = audioContext();      // throws if this browser cannot play audio
            const mine = ++playToken;
            if (c.state === 'suspended') {
                // A refused resume is not fatal — the audio may still play, and throwing
                // would cost the user the browser-voice fallback as well.
                try { await c.resume(); } catch { /* fall through and try anyway */ }
                if (mine !== playToken) return;
            }

            const k = cacheKey(model, trimmed);
            let buffer = cache.get(k);
            if (!buffer) {
                const bytes = await fetchAudio(model, trimmed);
                if (mine !== playToken) return;
                buffer = await decode(c, bytes);
                if (mine !== playToken) return;
                remember(k, buffer);
            }
            await play(c, buffer);
        };
        chain = chain.then(run, run);      // one failure must not wedge the queue
        return chain;
    }

    function cancel() {
        playToken++;
        if (inFlight) { try { inFlight.abort(); } catch { /* already done */ } inFlight = null; }
        for (const node of sources) {
            try { node.stop(); } catch { /* already stopped */ }
        }
        sources.clear();
    }

    function isSpeaking() {
        return sources.size > 0;
    }

    /*
     * The Settings Test button. It deliberately SPEAKS rather than merely checking the
     * key: a rejected key, a voice that does not exist, a model name the service does
     * not know and a blocked audio context all fail differently, and hearing it is the
     * only check that covers all four.
     *
     * ⚠ FOR THESE THREE SERVICES THIS IS NOT A CONVENIENCE, IT IS THE ONLY PROOF THE
     * PATH WORKS AT ALL — nothing here has been run against a real key.
     */
    async function test(key, model, voice, phrase) {
        try {
            override = { key, model };
            await speak(phrase, { model: voice });
            return { ok: true, message: '✓ That voice is working' };
        } catch (err) {
            return { ok: false, message: `✗ ${(err && err.message) || 'The voice could not be used.'}` };
        } finally {
            override = null;
        }
    }

    /** Drop the cache and any context — used when the key or provider changes. */
    function reset() {
        cancel();
        cache.clear();
        chain = Promise.resolve();
    }

    return { speak, cancel, isSpeaking, unlock, test, reset };
}
