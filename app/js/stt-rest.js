/*
 * stt-rest.js — hearing the other person through any REST transcription service.
 *
 * WHY THIS EXISTS (Ken, September 8 2026): OpenAI, Google Cloud and ElevenLabs were
 * asked for, "and where possible transcription services as well". It is possible for all
 * three, but only in the shape stt-azure.js already uses.
 *
 * ⚠ A PHRASE AT A TIME, NEVER STREAMING, AND THAT IS NOT A SHORTCUT. None of these three
 * publishes a streaming interface a browser can authenticate against with the user's own
 * key: OpenAI's Realtime session needs a token minted server-to-server, and Google's
 * streaming recognizer speaks gRPC. Building on a server is the one architectural line
 * this project does not cross — it is the reason the app can outlast the funded AAC
 * projects that were shelved. So each stretch of speech is buffered until the speaker
 * pauses, submitted as one WAV, and transcribed whole. The transcript fills in phrase by
 * phrase rather than word by word, landing a little under a second after each phrase was
 * said. That is exactly what Azure does, and stt-azure.js explains at length why it is
 * less bad than it sounds.
 *
 * ⚠ THE PURE AUDIO HELPERS ARE IMPORTED FROM stt-azure.js RATHER THAN COPIED. downsample,
 * floatToPcm16 and encodeWav are the fiddly, well-tested part and have no Azure in them;
 * duplicating them would mean two copies of a resampler to keep in step. The import
 * direction is admittedly odd — a shared audio-wav.js would be tidier — but moving them
 * means editing the one paid path proven against a real key, to save a file. Not worth
 * it today; worth it the day somebody has an Azure key to re-test with.
 *
 * ⚠ NOTHING HERE HAS BEEN RUN AGAINST A REAL KEY. There is none on this machine for any
 * of the three. The request shapes for OpenAI and Google are copied from
 * prototypes/speech-providers.html, which Ken has run; ElevenLabs transcription is not on
 * that page and is from documentation alone — see the note on it in speech-catalog.js.
 */
import * as vad from './vad.js';
import { describeFailure, blobToBase64 } from './speech-catalog.js';
import { TARGET_RATE, downsample, floatToPcm16, encodeWav } from './stt-azure.js';

// Long enough for a cold connection, short enough that one stuck request does not leave
// a whole phrase unheard while the partner waits.
const REQUEST_TIMEOUT_MS = 10000;

// A span that has run on this long is submitted early rather than being refused whole
// when it finally closes. Matches stt-azure.js.
const MAX_SPAN_MS = 25000;

// ⚠ THE SAME 450ms AS stt-azure.js, NOT vad.js's DEFAULT. The gate's hang time is what
// decides when a phrase is judged finished, and this shape submits on that judgement —
// so a shorter hang chops a phrase mid-sentence into two requests, and a longer one adds
// straight to the delay before the partner's words appear. Azure's value was tuned for
// exactly this submit-on-pause behavior; matching it means one number to re-tune rather
// than two that can silently disagree.
const HANG_MS = 450;

// The pre-roll length comes from the gate itself (gate.preRollMs()), so the amount of
// audio kept from before the gate opened always matches what the gate was built with.

/**
 * Submit one WAV clip and return the transcript.
 *
 * Exported so it can be unit-tested against a fake fetch without any microphone: the
 * capture half needs real audio hardware, this half does not.
 */
export async function transcribeClip(provider, key, wavBlob, {
    model,
    sampleRate = TARGET_RATE,
    fetchImpl = fetch,
    timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const useModel = model || provider.defaultModel;
        // Two body shapes: multipart for the services that take a file, JSON with the
        // audio inline for the ones that do not.
        const body = provider.form
            ? provider.form(wavBlob, { model: useModel })
            : provider.body(await blobToBase64(wavBlob), { model: useModel, sampleRate });
        const res = await fetchImpl(provider.url({ key }), {
            method: 'POST',
            headers: provider.headers({ key }),
            body,
            signal: controller.signal,
        });
        if (!res.ok) {
            const err = new Error(describeFailure(res.status, provider.label));
            err.status = res.status;
            throw err;
        }
        return provider.read(await res.json()) || '';
    } finally {
        clearTimeout(timer);
    }
}

/**
 * A capture source for one provider. The contract matches stt-deepgram.js and
 * stt-azure.js — { start, stop, isRunning } — so stt.js routes to any of them.
 */
export function createSource({ provider, getKey, getModel, onText, onStatus, onBilled }) {
    let audioCtx = null;
    let stream = null;
    let processor = null;
    let sourceNode = null;
    let gate = null;
    let running = false;
    let rate = 48000;

    let span = [];
    let spanSamples = 0;
    let openedAt = 0;
    let billedMs = 0;
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
        const key = ((getKey && getKey()) || '').trim();
        if (!key) return;

        // Join, resample once, then encode. Concatenating first is what lets the
        // resampler average across the original frame boundaries rather than restarting
        // at each one.
        let total = 0;
        for (const f of frames) total += f.length;
        const joined = new Float32Array(total);
        let at = 0;
        for (const f of frames) { joined.set(f, at); at += f.length; }
        const pcm = floatToPcm16(downsample(joined, sampleRate));
        const wav = new Blob([encodeWav(pcm, TARGET_RATE)], { type: 'audio/wav' });

        try {
            const text = await transcribeClip(provider, key, wav, {
                model: getModel && getModel(),
                sampleRate: TARGET_RATE,
            });
            if (mine !== generation) return;   // listening stopped while this was in flight
            // Every phrase is final by construction: nothing is sent until the speaker
            // has paused, so there is nothing provisional to revise.
            if (text && onText) onText(text, true);
        } catch (err) {
            if (mine !== generation) return;
            // ⚠ A FAILED PHRASE IS REPORTED BUT MUST NOT BE FATAL. handleSourceError in
            // stt.js switches listening off for the session, which is right for a
            // rejected key and wrong for one request that timed out on a flaky
            // connection — the next phrase would very likely have worked. So a transport
            // failure is a status and capture keeps running.
            //
            // A 401 or 403 is the exception: that will fail identically every time, and
            // reporting it as an error is what lets the app tell the user their key is
            // wrong instead of transcribing nothing forever in silence.
            if (onStatus) {
                if (err && (err.status === 401 || err.status === 403)) {
                    onStatus('error', err.message);
                } else {
                    onStatus('warning', err && err.name === 'AbortError'
                        ? 'a phrase took too long to transcribe'
                        : 'a phrase could not be sent');
                }
            }
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
        // Copy: the buffer the browser hands over is REUSED for the next frame, so a
        // kept reference would leave every buffered frame holding the most recent audio.
        const frame = Float32Array.from(floats);

        if (edge === 'open') {
            openedAt = now;
            span = preRoll.slice();
            spanSamples = span.reduce((n, f) => n + f.length, 0);
            preRoll = [];
            if (onStatus) onStatus('capturing');
        }

        if (gate.isOpen()) {
            span.push(frame);
            spanSamples += frame.length;
            if (spanSamples / rate >= MAX_SPAN_MS / 1000) {
                closeSpan(now, generation);
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
                // could put it right.
                if (onStatus) onStatus('listening');
                return;
            }
            const key = ((getKey && getKey()) || '').trim();
            if (!key) {
                if (onStatus) onStatus('error', `No ${provider.label} key is set.`);
                return;
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch {
                if (onStatus) onStatus('error', 'The microphone could not be opened.');
                return;
            }
            const Ctor = window.AudioContext || window.webkitAudioContext;
            audioCtx = new Ctor();
            rate = audioCtx.sampleRate || 48000;
            sourceNode = audioCtx.createMediaStreamSource(stream);
            processor = audioCtx.createScriptProcessor(4096, 1, 1);
            gate = vad.createGate({ hangMs: HANG_MS });
            preRollFrames = Math.max(1, Math.ceil((gate.preRollMs() / 1000) * rate / 4096));
            reset();
            billedMs = 0;
            generation++;
            running = true;
            processor.onaudioprocess = (e) => {
                if (!running) return;
                handleFrame(e.inputBuffer.getChannelData(0), Date.now());
            };
            sourceNode.connect(processor);
            processor.connect(audioCtx.destination);
            if (onStatus) onStatus('listening');
        },

        stop() {
            if (!running) return;
            running = false;
            generation++;                    // abandon anything still in flight
            try { if (processor) processor.disconnect(); } catch { /* already gone */ }
            try { if (sourceNode) sourceNode.disconnect(); } catch { /* already gone */ }
            try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* already gone */ }
            try { if (audioCtx) audioCtx.close(); } catch { /* already gone */ }
            processor = sourceNode = stream = audioCtx = null;
            reset();
            if (onStatus) onStatus('idle');
        },

        isRunning() {
            return running;
        },
    };
}
