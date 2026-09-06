/*
 * stt-azure.js — hearing the other person through Azure Speech.
 *
 * WHY A SECOND PAID OPTION. Deepgram was built (July 2026) because the platforms
 * where the browser's own recognizer silently delivers nothing — an iPad Home Screen
 * app, and Chrome or Edge on an iPad — needed something, and Deepgram was believed to
 * be the only cheap service a browser could reach directly. That belief came from
 * documentation, not from a test, and it did not survive one: measured September 2
 * 2026 from a real browser origin, Azure answers browser-direct calls. A single
 * supplier for a load-bearing function is now a choice rather than a constraint, and
 * this is the second supplier.
 *
 * WHAT IT COSTS AND SAVES. Azure hears at roughly twice Deepgram's price per hour,
 * and speaks at roughly half — and gives 5 audio hours a month free, renewing, where
 * Deepgram's credit is one-time. Nobody wins both halves, so having both is the
 * point: a user who is paying for the Azure voice can hear through the same key and
 * the same free allowance rather than opening a second account.
 *
 *
 * ⚠ HOW THIS DIFFERS FROM DEEPGRAM, AND IT IS THE ONE THING TO UNDERSTAND ABOUT IT.
 * Deepgram streams: it returns words as they are spoken, including provisional ones
 * that change as it hears more. This sends a WHOLE PHRASE AT A TIME. Each stretch of
 * speech is buffered until the speaker pauses, then submitted and transcribed as one
 * piece — so the transcript fills in phrase by phrase rather than word by word, and
 * each phrase lands a little under a second after it was said rather than as it is
 * being said.
 *
 * WHY THAT CHOICE, stated plainly so nobody re-derives it. Azure DOES have a
 * streaming interface, and it is the better one — but it speaks a framed protocol
 * whose browser authentication could not be established without a live key. Probed
 * September 6 2026: every one of five auth mechanisms (no auth, key in the query
 * string, token in the query string, key in a header, key as a subprotocol) came back
 * as a bare 401, which cannot separate "key rejected" from "mechanism not
 * understood". Building a framed protocol on five stacked unverified assumptions is
 * exactly the mistake this project has paid for before. THIS path, by contrast, is
 * the request shape already measured working from a real browser with a real key in
 * the provider bench (prototypes/speech-providers.html) — same endpoint, same
 * headers, same 16 kHz WAV body.
 *
 * ⚠ THE UPGRADE IS ONE MEASUREMENT AWAY, and whoever picks it up should start there
 * rather than here: with a real Azure key, find out which auth the streaming socket
 * accepts. If it connects, streaming replaces the submit-on-pause behavior below and
 * everything else in this file — the gate, the downsample, the WAV — is reusable.
 *
 * WHY THE PAUSE-BASED SHAPE IS NOT AS BAD AS IT SOUNDS. Phrases are submitted
 * INDEPENDENTLY, and the shared core in stt.js joins them, so cutting a long
 * utterance at its internal pauses costs nothing — it simply means the transcript
 * updates at each pause instead of only at the end. The hang below is therefore set
 * shorter than the streaming backend's, because a short hang here produces more
 * frequent updates rather than a broken sentence.
 *
 * THE COST MODEL, which shapes everything: billing is per second of audio SUBMITTED.
 * The gate in vad.js means only actual speech is ever sent, so a visit that is mostly
 * quiet is billed for the talking and not for the sitting. Same reasoning as the
 * Deepgram source; the gate is shared, not duplicated.
 */

import * as vad from './vad.js';

export const DEFAULT_REGION = 'eastus';

// Azure's short-audio endpoint wants 16 kHz 16-bit mono PCM in a WAV wrapper. This
// is the rate the bench proved, and it is also the rate speech recognizers are
// trained at — sending the microphone's native 44.1 or 48 kHz buys no accuracy and
// nearly triples the bytes.
export const TARGET_RATE = 16000;

/*
 * How long to keep buffering after the speaker goes quiet before submitting.
 *
 * ⚠ DELIBERATELY SHORTER THAN THE SHARED DEFAULT (900 ms), and the reason is the
 * whole shape of this backend: this hang sits IN FRONT of the app's own silence
 * period, so every millisecond here is a millisecond the other person waits. It can
 * be short precisely because a phrase cut too early is not a broken sentence — it is
 * simply an earlier update, since stt.js joins the pieces.
 */
const HANG_MS = 450;

// The service refuses a single request longer than a minute. A conversational phrase
// never approaches that, but a stuck-open gate would — so a span is cut and submitted
// well before the limit rather than being refused whole and lost.
const MAX_SPAN_MS = 50000;

const REQUEST_TIMEOUT_MS = 10000;

export function recognitionUrl(region, language = 'en-US') {
    return `https://${encodeURIComponent(region || DEFAULT_REGION)}.stt.speech.microsoft.com` +
           `/speech/recognition/conversation/cognitiveservices/v1` +
           `?language=${encodeURIComponent(language)}&profanity=raw`;
}

/* --- pure helpers (unit-tested) ------------------------------------------- */

/*
 * Average the samples that fall inside each output sample rather than picking one of
 * them. Point-sampling is one line shorter and audibly worse: it aliases, which for
 * speech means high frequencies folding down into the range the recognizer is
 * listening to, as a hiss that gets transcribed as consonants that were never said.
 * Mirrors the averaging the provider bench used, so the audio submitted here is the
 * audio Azure was measured against.
 */
export function downsample(input, fromRate, toRate = TARGET_RATE) {
    if (!input || !input.length) return new Float32Array(0);
    if (toRate === fromRate) return Float32Array.from(input);
    const ratio = fromRate / toRate;
    const out = new Float32Array(Math.floor(input.length / ratio));
    for (let i = 0; i < out.length; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(input.length, Math.floor((i + 1) * ratio));
        let sum = 0;
        let n = 0;
        for (let j = start; j < end; j++) { sum += input[j]; n++; }
        out[i] = n ? sum / n : 0;
    }
    return out;
}

// Float samples (-1..1) to signed 16-bit. Asymmetric scaling on purpose: the positive
// range tops out one step lower than the negative, so a full-scale sample cannot wrap
// around to the opposite sign — which is heard as a click, not as clipping.
export function floatToPcm16(floats) {
    const out = new Int16Array(floats.length);
    for (let i = 0; i < floats.length; i++) {
        const s = Math.max(-1, Math.min(1, floats[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
}

/*
 * Wrap raw samples in a RIFF/WAVE header.
 *
 * ⚠ A WRONG FIELD HERE DOES NOT THROW — it produces a file the service accepts and
 * mis-hears, which surfaces as "the transcription is bad" rather than as an error.
 * The two that matter most are byte rate (bytes per second, so rate x 2 for 16-bit
 * mono) and block align (2), because getting them wrong changes the playback speed
 * and therefore the pitch of every word.
 */
export function encodeWav(pcm16, sampleRate = TARGET_RATE) {
    const bytes = pcm16.length * 2;
    const out = new Uint8Array(44 + bytes);
    const dv = new DataView(out.buffer);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF');
    dv.setUint32(4, 36 + bytes, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    dv.setUint32(16, 16, true);          // fmt chunk size
    dv.setUint16(20, 1, true);           // PCM
    dv.setUint16(22, 1, true);           // mono
    dv.setUint32(24, sampleRate, true);
    dv.setUint32(28, sampleRate * 2, true);  // byte rate
    dv.setUint16(32, 2, true);           // block align
    dv.setUint16(34, 16, true);          // bits per sample
    str(36, 'data');
    dv.setUint32(40, bytes, true);
    out.set(new Uint8Array(pcm16.buffer, pcm16.byteOffset, bytes), 44);
    return out;
}

/*
 * Turn a failure into something a person can act on. Azure's speech endpoints return
 * an empty body on most errors, so the status is nearly all there is — which makes
 * naming the likely cause per status the difference between a message that helps and
 * one that only proves something went wrong.
 */
export function describeFailure(status, region) {
    if (status === 401 || status === 403) {
        return `The transcription service refused the key — check the key, and that the region is "${region}".`;
    }
    if (status === 400) return 'The transcription service rejected the audio.';
    if (status === 429) return 'The transcription service is rate limiting — wait a moment and try again.';
    if (status >= 500) return 'The transcription service had a problem at its end.';
    return `The transcription service returned an error (${status}).`;
}

/*
 * What came back. Azure answers with a RecognitionStatus and, on success, DisplayText
 * — already carrying the capitalization, punctuation and number formatting the app
 * asks Deepgram for with smart_format, so the two backends produce the same shape of
 * text and a conversation reads the same whichever heard it.
 *
 * ⚠ "NoMatch" AND "InitialSilenceTimeout" ARE NOT FAILURES. They mean the audio held
 * no recognizable speech, which happens constantly and legitimately — a cough, a door,
 * the gate opening on a noise. Reporting them as errors would trip the app's fatal
 * error handling and switch listening OFF mid-conversation, which is far worse than
 * transcribing nothing. Empty text is the correct answer.
 */
export function readRecognition(body) {
    if (!body || typeof body !== 'object') return { text: '', error: 'The transcription service sent an unreadable answer.' };
    const status = body.RecognitionStatus;
    if (status === 'Success') return { text: body.DisplayText || '' };
    if (status === 'NoMatch' || status === 'InitialSilenceTimeout' || status === 'BabbleTimeout') {
        return { text: '' };
    }
    if (!status) return { text: body.DisplayText || '' };
    return { text: '', error: `The transcription service reported: ${status}` };
}

/*
 * Verify a key and region by exercising THE REQUEST THE APP ACTUALLY MAKES.
 *
 * ⚠ NOT A CHEAPER PROXY, and that is the point. The token endpoint would check the
 * key for free, and it would also pass while the request the app makes is refused —
 * which is exactly what happened on Ken's iPad with Deepgram (August 3 2026), where
 * Test passed and Listen closed immediately. A diagnostic that does not exercise the
 * failing path is worse than none, because it sends you looking in the wrong place.
 *
 * A brief silent clip is submitted, so the answer is "NoMatch" and nothing is
 * transcribed; the audio still has to be accepted, which is the whole question. It
 * bills a fraction of a second.
 */
export async function testKey(key, region, timeoutMs = REQUEST_TIMEOUT_MS) {
    const where = (region || DEFAULT_REGION).trim();
    if (!key) return { ok: false, message: 'Enter your Azure Speech key first.' };
    const silence = encodeWav(new Int16Array(TARGET_RATE / 2), TARGET_RATE);   // half a second
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(recognitionUrl(where), {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': key,
                'Content-Type': `audio/wav; codecs=audio/pcm; samplerate=${TARGET_RATE}`,
                Accept: 'application/json',
            },
            body: silence,
            signal: controller.signal,
        });
        if (!res.ok) return { ok: false, message: `✗ ${describeFailure(res.status, where)}` };
        // A 200 means the key, the region and the audio format were all accepted.
        // What it says about the silence is beside the point.
        await res.json().catch(() => ({}));
        return { ok: true, message: `✓ Your Azure Speech key is working (${where})` };
    } catch (err) {
        return {
            ok: false,
            message: err && err.name === 'AbortError'
                ? "✗ The transcription service did not answer in time."
                : "✗ Couldn't reach the transcription service — check your internet connection.",
        };
    } finally {
        clearTimeout(timer);
    }
}

/*
 * Create the capture source. The contract is the same as the Deepgram source, so
 * stt.js routes to either without knowing which:
 *
 *   getKey() / getRegion()  — read at start time, not at creation, so a key pasted
 *                             into Settings takes effect without a reload.
 *   onText(text, isFinal)   — a transcript fragment. The shared core in stt.js does
 *                             the accumulating, echo filtering and silence
 *                             checkpointing; this module only supplies text.
 *   onStatus(status, detail)
 *   onBilled(seconds)       — audio actually submitted, so the app can show what a
 *                             conversation cost rather than leaving the user to
 *                             discover it on a statement.
 */
export function createSource({ getKey, getRegion, onText, onStatus, onBilled }) {
    let audioCtx = null;
    let stream = null;
    let processor = null;
    let sourceNode = null;
    let gate = null;
    let running = false;
    let rate = 48000;

    // The current stretch of speech, at the microphone's own rate; downsampled once
    // on submission rather than per frame, because resampling a whole span at once is
    // both cheaper and slightly more accurate at the frame boundaries.
    let span = [];
    let spanSamples = 0;
    let openedAt = 0;
    let billedMs = 0;

    // Rolling buffer of recent frames, so the syllable BEFORE the gate opened is not
    // lost. Without it, every phrase would be submitted with its first sound missing —
    // and a recognizer given a clipped opening consonant guesses a different word.
    let preRoll = [];
    let preRollFrames = 0;

    // Bumped by stop(), so a submission still in flight when listening ends cannot
    // deliver text into the next conversation.
    let generation = 0;

    function reset() {
        span = [];
        spanSamples = 0;
        preRoll = [];
    }

    async function submit(frames, sampleRate, mine) {
        if (!frames.length) return;
        const key = (getKey() || '').trim();
        if (!key) return;
        const where = (getRegion() || DEFAULT_REGION).trim();

        // Join, resample once, then encode. Concatenating first is what lets the
        // resampler average across the original frame boundaries rather than
        // restarting at each one.
        let total = 0;
        for (const f of frames) total += f.length;
        const joined = new Float32Array(total);
        let at = 0;
        for (const f of frames) { joined.set(f, at); at += f.length; }
        const wav = encodeWav(floatToPcm16(downsample(joined, sampleRate)), TARGET_RATE);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(recognitionUrl(where), {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': key,
                    'Content-Type': `audio/wav; codecs=audio/pcm; samplerate=${TARGET_RATE}`,
                    Accept: 'application/json',
                },
                body: wav,
                signal: controller.signal,
            });
            if (mine !== generation) return;    // listening stopped while this was in flight
            if (!res.ok) {
                if (onStatus) onStatus('error', `http ${res.status}`);
                return;
            }
            const body = await res.json().catch(() => null);
            if (mine !== generation) return;
            const { text, error } = readRecognition(body);
            if (error) { if (onStatus) onStatus('error', error); return; }
            // Every phrase is final by construction: there is nothing provisional
            // here, because nothing is sent until the speaker has paused.
            if (text && onText) onText(text, true);
        } catch (err) {
            if (mine !== generation) return;
            // ⚠ A FAILED PHRASE IS REPORTED BUT MUST NOT BE FATAL. handleSourceError in
            // stt.js switches listening off for the session, which is right for a
            // rejected key and wrong for one request that timed out on a flaky
            // connection — the next phrase would very likely have worked. So a
            // transport failure is logged as a status and capture keeps running.
            if (onStatus) {
                onStatus('warning', err && err.name === 'AbortError'
                    ? 'a phrase took too long to transcribe'
                    : 'a phrase could not be sent');
            }
        } finally {
            clearTimeout(timer);
        }
    }

    function closeSpan(now, mine) {
        if (!span.length) return;
        const frames = span;
        span = [];
        spanSamples = 0;
        billedMs += Math.max(0, now - openedAt);
        if (onBilled) onBilled(billedMs / 1000);
        submit(frames, rate, mine);
    }

    function handleFrame(floats, now) {
        const level = vad.rms(floats);
        const edge = gate.push(level, now);
        // Copy: the buffer the browser hands over is REUSED for the next frame, so
        // keeping a reference would leave every buffered frame holding whatever the
        // most recent audio happened to be.
        const frame = Float32Array.from(floats);

        if (edge === 'open') {
            openedAt = now;
            span = preRoll.slice();          // the start of the word that opened the gate
            spanSamples = span.reduce((n, f) => n + f.length, 0);
            preRoll = [];
            if (onStatus) onStatus('capturing');
        }

        if (gate.isOpen()) {
            span.push(frame);
            spanSamples += frame.length;
            // A span that has run on far too long is submitted early rather than
            // being refused whole when it eventually closes.
            if (spanSamples / rate >= MAX_SPAN_MS / 1000) {
                const carry = generation;
                closeSpan(now, carry);
                openedAt = now;              // the gate is still open; a new span begins
            }
        } else {
            preRoll.push(frame);
            while (preRoll.length > preRollFrames) preRoll.shift();
        }

        if (edge === 'close') closeSpan(now, generation);
    }

    return {
        async start() {
            if (running) {
                // Already capturing. RE-REPORT rather than returning silently: if the
                // app's view of the state has drifted out of step with ours, a silent
                // return leaves it drifted forever, because this is the only path that
                // could put it right (the lesson from the Deepgram source).
                if (onStatus) onStatus('listening');
                return true;
            }
            const key = (getKey() || '').trim();
            if (!key) {
                if (onStatus) onStatus('error', 'no-key');
                return false;
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        // The app speaks through the same device it listens with, so
                        // the browser's own cancellation is worth having on top of the
                        // transcript-level echo filter in stt.js.
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });
            } catch {
                if (onStatus) onStatus('error', 'not-allowed');
                return false;
            }

            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioCtx();
            if (audioCtx.state !== 'running') {
                try { await audioCtx.resume(); } catch { /* a gesture is needed; capture still works */ }
            }
            rate = audioCtx.sampleRate;

            gate = vad.createGate({ hangMs: HANG_MS });
            const FRAME_SAMPLES = 4096;
            preRollFrames = Math.max(1, Math.ceil((gate.preRollMs() / 1000) * rate / FRAME_SAMPLES));
            reset();
            billedMs = 0;
            generation++;

            sourceNode = audioCtx.createMediaStreamSource(stream);
            // ScriptProcessorNode rather than an AudioWorklet, for the reason given in
            // the Deepgram source: a worklet needs a separate module URL (or a blob:,
            // which the planned Content-Security-Policy would have to allow), while
            // this needs no extra file and behaves identically in Safari today.
            processor = audioCtx.createScriptProcessor(FRAME_SAMPLES, 1, 1);
            processor.onaudioprocess = (e) => {
                if (!running) return;
                handleFrame(e.inputBuffer.getChannelData(0), Date.now());
            };
            sourceNode.connect(processor);
            // A ScriptProcessorNode only runs when connected to a destination. Route it
            // through a silent gain so nothing is played back — connecting the
            // microphone straight to the speakers would howl.
            const mute = audioCtx.createGain();
            mute.gain.value = 0;
            processor.connect(mute).connect(audioCtx.destination);

            running = true;
            // Reported once capture is genuinely up, so the button does not claim to be
            // listening before anything can be heard. There is no handshake to wait for
            // here — the microphone is the whole dependency.
            if (onStatus) onStatus('listening');
            return true;
        },

        stop() {
            if (!running) return;
            running = false;
            // Submit whatever is in hand before tearing down: the partner's last words
            // are the ones most likely to matter, and dropping them would look exactly
            // like a mishearing.
            if (gate && gate.isOpen()) closeSpan(Date.now(), generation);
            generation++;
            if (gate) gate.reset();
            reset();
            if (processor) { try { processor.disconnect(); } catch { /* gone */ } processor = null; }
            if (sourceNode) { try { sourceNode.disconnect(); } catch { /* gone */ } sourceNode = null; }
            if (stream) { stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* gone */ } }); stream = null; }
            if (audioCtx) { try { audioCtx.close(); } catch { /* gone */ } audioCtx = null; }
            if (onStatus) onStatus('stopped');
        },

        isRunning() { return running; },
        billedSeconds() { return billedMs / 1000; },
    };
}
