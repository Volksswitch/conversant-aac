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
/*
 * How many phrases in a row may fail before the app stops calling it weather.
 *
 * Three, because a phrase is submitted at each pause in the partner's speech: three in
 * a row means the partner has said three things and nothing has appeared on screen.
 * Lower would turn a single flaky moment into a stopped microphone; higher leaves the
 * user talking to a device that cannot hear for longer than anyone would tolerate.
 */
const FAILURES_BEFORE_FATAL = 3;

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

/*
 * The shortest the voice gate may stay open before what it heard counts as speech.
 *
 * 250ms, because the shortest word anybody actually says out loud runs longer than
 * that - "yes" and "no" are around 300 to 400 - while a cough, a door, a keyboard tap
 * or a chair scrape is tens of milliseconds. Lower lets a click through to a service
 * that will confidently invent a sentence from it; much higher starts dropping real
 * one-word answers, which on this app are among the most common things a partner says.
 */
const MIN_SPEECH_MS = 250;


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
            // Reading the body is safe here: nothing else consumes it on this path, and
            // a failure to read it must never replace the real reason with its own.
            let said = '';
            try { said = await res.text(); } catch { /* keep the generic reason */ }
            const err = new Error(describeFailure(res.status, provider.label, said));
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
    // CR-083: start() awaits the microphone with `running` still false. `starting`
    // stops a second tap opening a second microphone in that window, and `wanted` lets a
    // stop() during it be honored once the microphone arrives.
    let starting = false;
    let wanted = false;
    function releaseHalfOpen() {
        try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* gone */ }
        stream = null;
        try { if (audioCtx) audioCtx.close(); } catch { /* gone */ }
        audioCtx = null;
    }
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
    /*
     * Consecutive failed phrases. Reset by any success and by every start(), so the
     * verdict below is always about THIS run of attempts rather than a tally that
     * survives a fix.
     */
    let failures = 0;

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
            // A phrase came back, so whatever went wrong before was passing.
            failures = 0;
            // Every phrase is final by construction: nothing is sent until the speaker
            // has paused, so there is nothing provisional to revise.
            if (text && onText) onText(text, true);
        } catch (err) {
            if (mine !== generation) return;
            failures += 1;
            /*
             * ⚠ A FAILED PHRASE IS REPORTED BUT MUST NOT BE FATAL. handleSourceError in
             * stt.js switches listening off for the session, which is right for a
             * rejected key and wrong for one request that timed out on a flaky
             * connection — the next phrase would very likely have worked. So a transport
             * failure is a status and capture keeps running.
             *
             * A 401 or 403 is the exception: that will fail identically every time, and
             * reporting it as an error is what lets the app tell the user their key is
             * wrong instead of transcribing nothing forever in silence.
             *
             * ⚠ AND SO IS A RUN OF THEM, which is the half that was missing until
             * September 30 2026. Tolerating every non-auth failure is right for ONE bad
             * moment and wrong for a service that refuses everything: the app went on
             * listening forever, transcribed nothing, and logged nothing, so the
             * microphone stayed lit while the user's partner talked into it. That is the
             * worst failure this app has, because it looks exactly like working.
             *
             * The count is what separates the two cases, and only a run of them decides:
             * a phrase is submitted at each pause in the partner's speech, so three in a
             * row means the partner has said three things and nothing has appeared. One
             * is weather. Three is a broken setup. A single success resets it, so a flaky
             * connection never accumulates its way to a false verdict.
             */
            const fatal = (err && (err.status === 401 || err.status === 403))
                || failures >= FAILURES_BEFORE_FATAL;
            if (onStatus) {
                if (fatal) {
                    onStatus('error', (err && err.message) || 'phrases could not be transcribed');
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
        const openMs = Math.max(0, now - openedAt);
        span = [];
        spanSamples = 0;
        /*
         * ⚠ A CLICK IS NOT A WORD, AND THESE SERVICES WILL INVENT ONE FROM IT.
         *
         * Transcription models of this family are known to produce confident text from
         * near-silence rather than returning nothing. Ken's report of September 30 2026
         * has a partner turn reading "Katarzyna." in a conversation where the partner
         * had said nothing at all — a name from nowhere, recorded as something a real
         * person said, in a product whose whole premise is that the user can trust the
         * transcript enough to answer it.
         *
         * ⚠ THE MEASURE IS THE SPEECH, WHICH IS NEITHER THE AUDIO NOR THE OPEN TIME.
         * Every span carries 1200ms of pre-roll, so a length test would let everything
         * through. And the gate stays open for the 450ms hang after the last sound, so
         * the open time never falls below that either — a threshold compared against it
         * would simply never fire. Speech is the open time less the hang, and that is
         * the part that says whether anybody was actually talking.
         *
         * A span closed by the length ceiling rather than by the gate has no hang to
         * subtract, but that means 25 seconds of continuous speech and clears any
         * threshold regardless.
         */
        if (openMs - HANG_MS < MIN_SPEECH_MS) { reset(); return; }
        // Billed for the audio SENT, pre-roll included, and only when it is sent - a
        // discarded click costs nothing (CR-158).
        billedMs += (frames.reduce((n, f) => n + f.length, 0) / rate) * 1000;
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
            if (starting) return;
            starting = true;
            wanted = true;
            try {
                // The same cleanup as the other paid recognizers (CR-276): the app speaks
                // through the device it listens with.
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                });
            } catch {
                starting = false;
                if (onStatus) onStatus('error', 'The microphone could not be opened.');
                return;
            }
            if (!wanted) { starting = false; releaseHalfOpen(); return false; }
            const Ctor = window.AudioContext || window.webkitAudioContext;
            audioCtx = new Ctor();
            // Created after an await, so outside the tap: on an iPad it starts suspended
            // and would hear nothing while reporting that it was listening (CR-276).
            if (audioCtx.state !== 'running') {
                try { await audioCtx.resume(); } catch { /* needs a gesture */ }
                if (!wanted) { starting = false; releaseHalfOpen(); return false; }
            }
            rate = audioCtx.sampleRate || 48000;
            sourceNode = audioCtx.createMediaStreamSource(stream);
            processor = audioCtx.createScriptProcessor(4096, 1, 1);
            gate = vad.createGate({ hangMs: HANG_MS });
            preRollFrames = Math.max(1, Math.ceil((gate.preRollMs() / 1000) * rate / 4096));
            reset();
            billedMs = 0;
            // Tell the app the running total restarted, or its next report reads as a
            // decrease and that whole first burst is never counted (CR-019).
            if (onBilled) onBilled(0);
            failures = 0;
            generation++;
            starting = false;
            running = true;
            processor.onaudioprocess = (e) => {
                if (!running) return;
                handleFrame(e.inputBuffer.getChannelData(0), Date.now());
            };
            sourceNode.connect(processor);
            // Through a silent gain, never straight to the speakers: the microphone wired
            // toward them would howl wherever the engine plays the output (CR-276).
            const mute = audioCtx.createGain();
            mute.gain.value = 0;
            processor.connect(mute).connect(audioCtx.destination);
            if (onStatus) onStatus('listening');
        },

        stop() {
            wanted = false;
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
