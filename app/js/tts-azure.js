/*
 * tts-azure.js — speaking through Azure Speech, the second paid voice.
 *
 * WHY A SECOND ONE. Deepgram was chosen (July 2026) on the belief that it was the
 * only cheap service a browser could reach directly, and that belief was recorded
 * from documentation rather than from a test. Measured September 2 2026 from a real
 * browser origin, Azure answers a browser-direct call perfectly well; the barrier
 * for most vendors turns out to be a POLICY RECOMMENDATION — "do not ship YOUR key
 * in a browser" — which does not apply here, because the key is the USER'S OWN, on
 * their own device, and never reaches us.
 *
 * WHY AZURE IN PARTICULAR, and it is mostly about the bill. Azure speaks at roughly
 * half Deepgram's price, and its free tier is 500,000 characters a month that RENEW
 * — where Deepgram's $200 is one-time. For a light user that is free permanently
 * rather than free until the credit runs out. Users bring their own key and pay
 * their own way, so this is the difference between a running cost and none.
 *
 * WHY REST AND NOT A SOCKET, which is the opposite of the Deepgram module. Deepgram
 * had to use a WebSocket because their REST API is not reachable from a browser;
 * Azure's is (measured). And Azure hands back a FINISHED FILE in about a quarter of
 * a second, so there is no partial audio to stream and nothing to gain from the
 * chunk scheduling that tts-deepgram.js needs — first sound and last sound are the
 * same moment here by construction. That makes this module a great deal simpler,
 * and simpler is the right answer when nothing is being given up.
 *
 * WHY MP3 AND NOT RAW PCM. The whole file has to arrive before any of it can play,
 * so the only thing that matters is how long the bytes take to get here — and mp3
 * is about a sixth the size. The decode is the browser's own and costs milliseconds.
 *
 * THE CONTRACT IS THE SAME as tts-deepgram.js on purpose: createVoice() returns
 * { speak, cancel, isSpeaking, unlock, test, reset }, so tts.js routes to either one
 * without knowing which is which. Everything that matters to the rest of the app —
 * the speaking-state broadcast the STT echo filter depends on, the superseded-
 * utterance token, and the fall back to the browser's own voice — stays in tts.js.
 * A backend only produces sound.
 */

// Azure's regional hostnames are built from the region name, so the region is as
// load-bearing as the key: a valid key with the wrong region is refused exactly like
// a bad key. That is why Settings asks for it as its own field rather than burying
// it in a default, and why the Test button quotes it back.
export const DEFAULT_REGION = 'eastus';

// mp3 at 24 kHz: the smallest format that still sounds like the neural voices do.
// Larger formats buy nothing here because nothing plays until the whole file lands.
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

// Generous enough for a cold connection on tablet wifi, short enough that a dead
// network does not leave the user standing in silence with a partner waiting.
const SYNTH_TIMEOUT_MS = 6000;

// Cached utterances, newest last. Capped by count rather than bytes for the same
// reason as the Deepgram cache: entries are short phrases, and a count is something
// a reader can reason about. Placeholders, control phrases and Express buttons
// repeat constantly, so this is most of what the app says.
const MAX_CACHE_ENTRIES = 300;

/*
 * The FALLBACK voices — a curated handful, used only until the real catalog has been
 * fetched, and after that only if fetching fails.
 *
 * ⚠ THIS LIST USED TO BE THE WHOLE OFFERING, AND THAT WAS WRONG (Ken, September 6
 * 2026: the bench lists about 190 English voices and the picker showed 16). The
 * reasoning for curating was that a long picker is a scroll, and scrolling is a real
 * cost for limited motor control — but choosing a voice happens in SETTINGS, rarely,
 * usually with a supporter helping, which is exactly where a longer list is
 * affordable. A conversation-surface argument had been applied to a setup screen.
 *
 * ⚠ AND THE LOSS WAS SPECIFIC RATHER THAN GENERAL: every voice below is an adult, and
 * Azure's catalog is the main reason to prefer Azure at all — the Speech Provider
 * Guide calls it "the widest by a distance" and notes that documented child voices
 * exist in it, against younger voices being "the nearest and most concrete need" in
 * AAC. Hiding the catalog therefore hid the whole point of adding the service.
 *
 * Kept, rather than deleted, for the three moments there is no catalog to show: before
 * a key is entered, offline, and when the fetch fails.
 */
export const VOICES = [
    { id: 'en-US-AvaMultilingualNeural',    name: 'Ava',      detail: 'Female · American' },
    { id: 'en-US-JennyNeural',              name: 'Jenny',    detail: 'Female · American' },
    { id: 'en-US-AriaNeural',               name: 'Aria',     detail: 'Female · American' },
    { id: 'en-US-EmmaMultilingualNeural',   name: 'Emma',     detail: 'Female · American' },
    { id: 'en-US-MichelleNeural',           name: 'Michelle', detail: 'Female · American' },
    { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew',   detail: 'Male · American' },
    { id: 'en-US-GuyNeural',                name: 'Guy',      detail: 'Male · American' },
    { id: 'en-US-BrianMultilingualNeural',  name: 'Brian',    detail: 'Male · American' },
    { id: 'en-US-DavisNeural',              name: 'Davis',    detail: 'Male · American' },
    { id: 'en-US-TonyNeural',               name: 'Tony',     detail: 'Male · American' },
    { id: 'en-GB-SoniaNeural',              name: 'Sonia',    detail: 'Female · British' },
    { id: 'en-GB-RyanNeural',               name: 'Ryan',     detail: 'Male · British' },
    { id: 'en-AU-NatashaNeural',            name: 'Natasha',  detail: 'Female · Australian' },
    { id: 'en-AU-WilliamNeural',            name: 'William',  detail: 'Male · Australian' },
    { id: 'en-CA-ClaraNeural',              name: 'Clara',    detail: 'Female · Canadian' },
    { id: 'en-IE-EmilyNeural',              name: 'Emily',    detail: 'Female · Irish' },
];

export const DEFAULT_VOICE = VOICES[0].id;

export function voiceLabel(id) {
    const v = VOICES.find((x) => x.id === id);
    return v ? `${v.name} — ${v.detail}` : id;
}

/* --- the real catalog ------------------------------------------------------
 *
 * Azure publishes what it can say, and it is browser-reachable: probed from a real
 * origin September 6 2026 with a deliberately invalid key, it answered 401 with a
 * response type of "cors", meaning the browser was allowed to read the reply and a
 * real key will work. (Deepgram's equivalent is NOT reachable — measured in the same
 * probe, against a known-blocked control, so the sweep can be trusted. That is why
 * only this service gets a live list.)
 */

// ⚠ THE FILTER IS HIDDEN ON PURPOSE (Ken, September 6 2026: "You can hide the filter
// for now and we can expose it later if there's a need"). It is a constant rather
// than a control, so exposing it later means rendering these two values, not
// rebuilding the picker.
//
// English, with American English FIRST rather than American English ONLY. Ken asked
// for English and said American would be best if possible; ordering rather than
// excluding gets that — the top of the list is American — without removing the
// British, Australian, Canadian and Irish voices that already shipped in the fallback
// list above, which would have taken a voice away from anyone already using one.
// Tightening this to en-US only is a one-line change to PREFER_LOCALES/INCLUDE.
export const VOICE_FILTER = {
    include: /^en-/i,       // which locales appear at all
    preferFirst: 'en-US',   // which locale sorts to the top
};

/*
 * One entry from Azure's catalog, in the shape the picker uses.
 *
 * ⚠ NEURAL ONLY. Azure still lists retired "Standard" voices; offering one is offering
 * something that may stop working, and the user would experience that as the app
 * losing its voice rather than as a catalog change.
 */
export function normalizeVoice(v) {
    if (!v || v.VoiceType !== 'Neural' || !v.ShortName) return null;
    const name = v.DisplayName || v.LocalName || v.ShortName;
    const gender = v.Gender ? `${v.Gender}` : '';
    const where = v.LocaleName || v.Locale || '';
    return {
        id: v.ShortName,
        name,
        detail: [gender, where].filter(Boolean).join(' · '),
        locale: v.Locale || '',
        // Azure marks some voices Preview; they can disappear, so the picker says so
        // rather than letting one vanish between sessions with no explanation.
        preview: v.Status === 'Preview',
    };
}

/*
 * Apply the hidden filter and put the catalog in a useful order: American English
 * first, then the other English locales, alphabetically by name within each. A
 * catalog in the order the service happened to return it is a list nobody can scan.
 */
export function filterVoices(list, filter = VOICE_FILTER) {
    const out = (list || [])
        .map(normalizeVoice)
        .filter((v) => v && filter.include.test(v.locale));
    out.sort((a, b) => {
        const ap = a.locale.toLowerCase() === filter.preferFirst.toLowerCase() ? 0 : 1;
        const bp = b.locale.toLowerCase() === filter.preferFirst.toLowerCase() ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.locale !== b.locale) return a.locale.localeCompare(b.locale);
        return a.name.localeCompare(b.name);
    });
    return out;
}

export function catalogUrl(region) {
    return `https://${encodeURIComponent(region || DEFAULT_REGION)}.tts.speech.microsoft.com` +
           `/cognitiveservices/voices/list`;
}

/*
 * Fetch what this account can actually say. Returns the filtered, ordered list.
 *
 * Throws on failure rather than returning the fallback, so the caller can tell "we
 * have the real catalog" from "we are showing the handful we ship with" — those look
 * identical in a picker and mean very different things when a voice the user expected
 * is not in it.
 */
export async function fetchVoices(key, region, timeoutMs = 10000) {
    if (!key) throw new Error('No Azure Speech key is set.');
    const where = (region || DEFAULT_REGION).trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(catalogUrl(where), {
            headers: { 'Ocp-Apim-Subscription-Key': key },
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(describeFailure(res.status, where));
        const body = await res.json();
        if (!Array.isArray(body)) throw new Error('The voice service sent an unreadable list of voices.');
        const voices = filterVoices(body);
        if (!voices.length) throw new Error('The voice service listed no English voices.');
        return voices;
    } catch (err) {
        if (err && err.name === 'AbortError') throw new Error('The voice service took too long to answer.');
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/* --- pure helpers (unit-tested) ------------------------------------------- */

/*
 * ⚠ THE ESCAPING IS THE ONE PLACE A BUG HERE IS BOTH LIKELY AND INVISIBLE, and it
 * is why this is a separate, tested function rather than a line inside the request.
 *
 * The body is XML, and the text inside it is whatever the user or the AI wrote. An
 * ampersand or an angle bracket in an ordinary sentence — "Jim & I", "5 < 6" —
 * makes the document malformed, and Azure answers a malformed document with a 400.
 * The user's experience of that is pressing a button and NOTHING BEING SAID, on a
 * sentence that looks completely normal, which is the one outcome this whole layer
 * exists to prevent.
 *
 * CONTROL CHARACTERS TOO, and they are the half that is easy to forget. XML 1.0
 * forbids almost every C0 control outright — there is no escape that makes them
 * legal — so they must be REMOVED rather than encoded. They arrive more often than
 * one would think: a stray character pasted from a document, or a model returning
 * one. Tab, newline and carriage return are the three that are legal, and they are
 * kept because they are ordinary in a typed statement.
 */
export function escapeSsmlText(text) {
    return String(text == null ? '' : text)
        // Strip first, so a removed character cannot be reintroduced by an escape.
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/&/g, '&amp;')     // must be first, or it would double-escape the rest
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// "en-GB-SoniaNeural" -> "en-GB". An id that does not look like one falls back to
// en-US rather than producing an invalid document.
export function languageOf(voice) {
    const m = /^([a-z]{2,3}-[A-Za-z]{2,4})-/.exec(String(voice || ''));
    return m ? m[1] : 'en-US';
}

/*
 * The SSML document Azure is asked to speak.
 *
 * The voice id carries its own language ("en-GB-SoniaNeural"), and xml:lang has to
 * agree with it or the voice is refused — so the language is derived from the id
 * rather than hardcoded to en-US, which is what would otherwise break every non-
 * American voice in the list above.
 *
 * ⚠ NO PROSODY MARKUP, deliberately. Azure does support it, and the app does not use
 * it: what reaches this function has already been through the pronunciation layer in
 * tts.js, which does its work by RESPELLING the text. Adding a second, markup-based
 * mechanism would give two ways to say the same thing and no rule about which wins.
 * See CLAUDE.md, "The 'How to say it' boxes work with EVERY provider, by
 * construction" — the ceiling is higher here, and reaching for it is separate work.
 */
export function ssmlFor(voice, text) {
    const lang = languageOf(voice);
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
           `<voice name="${escapeSsmlText(voice)}">${escapeSsmlText(text)}</voice></speak>`;
}

// Azure bills per character of text submitted, so this is what gets counted — and a
// cache hit submits nothing, which is why the counter lives at the request site
// rather than at speak().
export function billableCharacters(text) {
    return typeof text === 'string' ? text.length : 0;
}

export function cacheKey(voice, text) {
    // The separator is a NUL written as an ESCAPE rather than as a raw byte: a
    // literal NUL makes git and grep treat the whole file as binary, so its diffs
    // stop being reviewable. Same character, same keys, readable history.
    return `${voice}\0${text}`;
}

export function synthesisUrl(region) {
    return `https://${encodeURIComponent(region || DEFAULT_REGION)}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

/*
 * Turn an HTTP failure into something a person can act on. Azure's error bodies are
 * usually empty on the speech endpoints, so the status is nearly all there is —
 * which makes naming the LIKELY CAUSE per status the difference between a message
 * that helps and one that only proves something went wrong.
 */
export function describeFailure(status, region) {
    if (status === 401 || status === 403) {
        return `The voice service refused the key — check the key, and that the region is "${region}".`;
    }
    if (status === 400) return 'The voice service rejected the request — the chosen voice may not exist in this region.';
    if (status === 429) return 'The voice service is rate limiting — wait a moment and try again.';
    if (status >= 500) return 'The voice service had a problem at its end.';
    return `The voice service returned an error (${status}).`;
}

/* --- the voice ------------------------------------------------------------ */

/*
 *   getKey()          — read at speak time, not at creation, so a key pasted into
 *                       Settings works without a reload.
 *   getRegion()       — likewise; changing the region must not need a reload either.
 *   onBilled(chars)   — characters actually sent (cache hits send none), so the app
 *                       can show what speaking cost.
 */
export function createVoice({ getKey, getRegion, onBilled } = {}) {
    let ctx = null;
    const sources = new Set();   // playback nodes started but not yet finished
    let playToken = 0;           // bumped by cancel(), so a cancel during the
                                 // resume wait is not overtaken by playback
    let inFlight = null;         // AbortController for the request being made
    let chain = Promise.resolve();
    const cache = new Map();     // voice+text -> decoded AudioBuffer
    // Set only while the Settings Test button is exercising a key and region the
    // user has typed but not yet saved, so Test reports on what is on screen.
    let override = null;

    function currentKey() {
        return (override ? override.key : (getKey && getKey())) || '';
    }
    function currentRegion() {
        return ((override ? override.region : (getRegion && getRegion())) || DEFAULT_REGION).trim();
    }

    function audioContext() {
        if (!ctx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) throw new Error('This browser cannot play audio.');
            ctx = new Ctor();
        }
        return ctx;
    }

    /*
     * iOS starts an AudioContext suspended and will only resume it inside a user
     * gesture. Placeholders fire on TIMERS, so if the context is not unlocked during
     * some earlier tap the app goes silent exactly when it is trying to hold the
     * floor. Call from any real tap; cheap and idempotent.
     */
    function unlock() {
        try {
            const c = audioContext();
            if (c.state === 'suspended') c.resume();
        } catch { /* no audio at all — speak() will report it */ }
    }

    async function fetchAudio(voice, text) {
        const key = currentKey();
        if (!key) throw new Error('No Azure Speech key is set.');
        const region = currentRegion();

        const controller = new AbortController();
        inFlight = controller;
        const timer = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(synthesisUrl(region), {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': key,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
                },
                body: ssmlFor(voice, text),
                signal: controller.signal,
            });
        } catch (err) {
            // An abort here is either our own timeout or a cancel(); a genuine
            // network failure looks the same to fetch. Name both plausibly rather
            // than claiming to know which.
            throw new Error(err && err.name === 'AbortError'
                ? 'The voice service took too long, or the connection dropped.'
                : 'Could not reach the voice service — check your internet connection.');
        } finally {
            clearTimeout(timer);
            if (inFlight === controller) inFlight = null;
        }
        if (!res.ok) throw new Error(describeFailure(res.status, region));

        // Count what was actually submitted, and only once the request was accepted:
        // billing a refused request would make the cost display wrong in the one
        // direction that matters, by overstating what the user owes.
        if (onBilled) onBilled(billableCharacters(text));

        const bytes = await res.arrayBuffer();
        if (!bytes || !bytes.byteLength) throw new Error('The voice service returned no audio.');
        return bytes;
    }

    // decodeAudioData is callback-based on older WebKit and promise-based everywhere
    // else. Wrapping both is three lines and avoids a silent no-op on exactly the
    // platform this whole paid-voice path exists for.
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

    function remember(key, buffer) {
        cache.set(key, buffer);
        while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    }

    /*
     * Speak, and resolve when the audio has finished playing. Throws on any failure
     * so tts.js can fall back to the browser's own voice — never swallow an error
     * here, because a silent failure means the user pressed a button and nothing
     * happened.
     *
     * Serialized through `chain` so two overlapping calls cannot interleave; cancel()
     * breaks the chain by stopping playback and aborting the request.
     *
     * ⚠ THE RESUME IS AWAITED BEFORE ANY AUDIO STARTS, and that is not cosmetic — see
     * tts-deepgram.js for the September 2 2026 finding it comes from. A browser
     * suspends an idle AudioContext, resume() is asynchronous, and a buffer started
     * against a context that is still waking up loses whatever the browser considers
     * already past. Heard as the FIRST WORD GOING MISSING, intermittently, and most
     * often on the statement typed in the compose pane — which is where the app is
     * quiet longest.
     */
    function speak(text, { model = DEFAULT_VOICE } = {}) {
        const run = async () => {
            const trimmed = (text || '').trim();
            if (!trimmed) return;

            const c = audioContext();       // throws if this browser cannot play audio
            const mine = ++playToken;
            if (c.state === 'suspended') {
                // A refused resume is not fatal — the audio may still play, and
                // throwing here would cost the user the browser-voice fallback too.
                try { await c.resume(); } catch { /* fall through and try anyway */ }
                if (mine !== playToken) return;
            }

            const key = cacheKey(model, trimmed);
            let buffer = cache.get(key);
            if (!buffer) {
                const bytes = await fetchAudio(model, trimmed);
                if (mine !== playToken) return;
                buffer = await decode(c, bytes);
                if (mine !== playToken) return;
                remember(key, buffer);      // so the next time this phrase is said, it is instant
            }
            await play(c, buffer);
        };
        chain = chain.then(run, run);       // one failure must not wedge the queue
        return chain;
    }

    function cancel() {
        playToken++;                        // a speak() waiting on resume() must not start now
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
     * Speak a sample phrase with a given key, region and voice. This is the Settings
     * Test button, and it deliberately SPEAKS rather than merely checking the key: a
     * wrong region, a voice that does not exist there, a blocked audio context and a
     * rejected key all fail differently, and hearing it is the only check that covers
     * all four.
     */
    async function test(key, region, model, phrase) {
        try {
            override = { key, region };
            await speak(phrase, { model });
            return { ok: true, message: '✓ That voice is working' };
        } catch (err) {
            return { ok: false, message: `✗ ${(err && err.message) || 'The voice could not be used.'}` };
        } finally {
            override = null;
        }
    }

    function reset() {
        cancel();
        cache.clear();
    }

    return { speak, cancel, isSpeaking, unlock, test, reset, cacheSize: () => cache.size };
}
