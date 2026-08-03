/*
 * stt-deepgram.js — partner capture through Deepgram's streaming API, for the
 * platforms where the browser's own recognizer does not work.
 *
 * WHY A PAID SERVICE AT ALL. Measured on July 30 2026: on iPadOS, built-in speech
 * recognition delivers nothing in a Home Screen app and nothing in Chrome or Edge.
 * The app is fully usable without capture — the Express Panel and "In my own words"
 * still speak, which is the AI-optional property — but the conversation loop that
 * this project exists for needs to hear the partner. A user's own transcription key
 * buys that back without the project running a server.
 *
 * WHY DEEPGRAM SPECIFICALLY. It is not the cheapest streaming service (AssemblyAI
 * is roughly three times cheaper), but it is the only cheap one that can be
 * connected DIRECTLY FROM A BROWSER: the key travels in the Sec-WebSocket-Protocol
 * handshake, which Deepgram documents for exactly this case. AssemblyAI's streaming
 * token must be minted server-to-server, so using it would mean running a backend —
 * the one thing this architecture refuses, and the reason the project can outlive
 * its funding. Paying 3x for no server is the right trade here.
 *
 * WHY RAW PCM RATHER THAN MediaRecorder. MediaRecorder produces a webm/opus STREAM:
 * only the first chunk carries the header, so a chunk taken from the middle is
 * undecodable on its own. That is fatal here, because the whole point of the gate
 * below is to send only the parts containing speech and drop the silence. Raw
 * linear16 frames are stateless — any frame stands alone — so they can be gated,
 * buffered and replayed freely. It also makes the pre-roll possible.
 *
 * THE COST MODEL, which shapes everything: billing is per second of audio
 * SUBMITTED, not per second connected. So the socket stays open for the whole
 * listening session (reconnecting costs seconds of latency at the worst moment, and
 * KeepAlive is free), while audio is uploaded only while someone is actually
 * speaking. See vad.js for why that distinction is worth the complexity.
 */

import * as vad from './vad.js';

const ENDPOINT = 'wss://api.deepgram.com/v1/listen';
const MODEL = 'nova-3';

// Deepgram closes an idle socket after ~10s; a KeepAlive resets that timer and
// carries no audio, so it costs nothing. Sent well inside the window.
const KEEPALIVE_MS = 5000;

// ScriptProcessorNode is deprecated in favour of AudioWorklet, and is used anyway:
// a worklet must be loaded from a separate module URL (or a blob:, which the
// planned Content-Security-Policy would have to allow), while this needs no extra
// file and works identically in Safari today. The cost is that the callback runs on
// the main thread — at this buffer size roughly every 85ms, which is not enough
// work to matter. Worth revisiting if the CSP lands or audio glitches appear.
const FRAME_SAMPLES = 4096;

// The query the LIVE capture socket uses. Shared with testKey below, and that
// sharing is the point: a test that connects with different parameters can report
// "your key is working" while the connection the app actually makes is refused —
// which is exactly what happened on Ken's iPad (August 3 2026), where Test passed
// and Listen closed immediately. A diagnostic that does not exercise the failing
// path is worse than none, because it sends you looking in the wrong place.
function listenParams(sampleRate) {
    return new URLSearchParams({
        model: MODEL,
        encoding: 'linear16',
        // Send at the capture device's own rate rather than resampling. Billing is
        // by DURATION, not bytes, so downsampling would buy nothing but a resampler
        // to get wrong.
        sample_rate: String(Math.round(sampleRate)),
        channels: '1',
        interim_results: 'true',
        punctuate: 'true',
        smart_format: 'true',
    });
}

// The rate the live path will report, read the same way it reads it. This is the
// ONLY parameter that varies by device, so it is the one a desktop test cannot
// stand in for — hence measuring it here rather than assuming 48000.
function captureSampleRate() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const rate = ctx.sampleRate;
        try { ctx.close(); } catch { /* older engines */ }
        return rate;
    } catch {
        return 48000;   // no AudioContext: fall back so the key can still be checked
    }
}

/*
 * Verify a key without transcribing anything (so it bills nothing): open the
 * socket and see whether the handshake is accepted. WebSockets are not subject to
 * CORS, so this works from a browser where a REST probe might not.
 *
 * Opens it with the FULL live parameter set, so a pass means "the connection this
 * app will make works here", not merely "the key is valid".
 */
export function testKey(key, timeoutMs = 8000) {
    return new Promise((resolve) => {
        let ws;
        let settled = false;
        const done = (ok, message) => {
            if (settled) return;
            settled = true;
            try { ws && ws.close(); } catch { /* already gone */ }
            resolve({ ok, message });
        };
        const rate = Math.round(captureSampleRate());
        const timer = setTimeout(() => done(false, "Couldn't reach the transcription service — check your internet connection."), timeoutMs);
        try {
            ws = new WebSocket(`${ENDPOINT}?${listenParams(rate)}`, ['token', key]);
        } catch {
            clearTimeout(timer);
            return done(false, 'That key could not be used to open a connection.');
        }
        ws.onopen = () => { clearTimeout(timer); done(true, `✓ Your transcription key is working (${rate} Hz)`); };
        // A rejected key fails the handshake, which surfaces as a close/error rather
        // than an HTTP status the browser will show us — so the message has to name
        // the likely cause rather than quote one. The sample rate is quoted because
        // it is the one parameter that varies by device, so it is the first suspect
        // when the key itself is known good.
        ws.onerror = () => { clearTimeout(timer); done(false, `✗ The connection was refused (${rate} Hz) — the key may be wrong, or this device's audio settings may not be accepted.`); };
        ws.onclose = (e) => {
            clearTimeout(timer);
            if (!settled) done(false, `✗ The connection was refused${e && e.code ? ` (code ${e.code}${e.reason ? `: ${e.reason}` : ''})` : ''} at ${rate} Hz.`);
        };
    });
}

/*
 * Create the capture source.
 *
 *   getKey()               — read the key at start time, not at creation, so a key
 *                            pasted into Settings takes effect without a reload.
 *   onText(text, isFinal)  — a transcript fragment. The shared core in stt.js does
 *                            the accumulating, echo filtering and silence
 *                            checkpointing, exactly as it does for the built-in
 *                            recognizer; this module only supplies text.
 *   onStatus(status, detail)
 *   onBilled(seconds)      — audio actually uploaded, so the app can show what a
 *                            conversation cost rather than leaving the user to
 *                            discover it on a statement.
 */
export function createSource({ getKey, onText, onStatus, onBilled }) {
    let ws = null;
    let audioCtx = null;
    let stream = null;
    let processor = null;
    let sourceNode = null;
    let keepAliveTimer = null;
    let gate = null;
    let running = false;

    // Rolling buffer of recent frames, so the syllable before the gate opened is not
    // lost. Sized from the gate's pre-roll and the actual sample rate at start().
    let preRoll = [];
    let preRollFrames = 0;

    let openedAt = 0;
    let billedMs = 0;

    function send(buf) {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(buf);
    }

    // Float samples (-1..1) → 16-bit little-endian PCM, which is what
    // encoding=linear16 means.
    function toLinear16(floats) {
        const out = new Int16Array(floats.length);
        for (let i = 0; i < floats.length; i++) {
            const s = Math.max(-1, Math.min(1, floats[i]));
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return out;
    }

    function handleFrame(floats, now) {
        const frame = toLinear16(floats);
        const level = vad.rms(floats);
        const edge = gate.push(level, now);

        if (edge === 'open') {
            openedAt = now;
            // Flush what was already in hand — the start of the word that opened
            // the gate is in there.
            for (const f of preRoll) send(f);
            preRoll = [];
            if (onStatus) onStatus('capturing');
        } else if (edge === 'close') {
            billedMs += now - openedAt;
            if (onBilled) onBilled(billedMs / 1000);
        }

        if (gate.isOpen()) {
            send(frame.buffer);
        } else {
            // Not sending: keep the tail in the pre-roll ring instead.
            preRoll.push(frame.buffer);
            while (preRoll.length > preRollFrames) preRoll.shift();
        }
    }

    function handleMessage(ev) {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'Metadata' || msg.type === 'SpeechStarted') return;
        const alt = msg.channel && msg.channel.alternatives && msg.channel.alternatives[0];
        const text = alt && alt.transcript;
        if (!text) return;
        // Deepgram's is_final marks a settled span; speech_final marks the end of an
        // utterance. The app's own silence period decides when a turn is over (that
        // is a user-facing setting and must behave the same on every backend), so
        // both are reported as final text and neither is allowed to drive turn-taking.
        if (onText) onText(text, !!msg.is_final);
    }

    return {
        async start() {
            if (running) {
                // Already capturing. RE-REPORT rather than returning silently: if the
                // app's view of the state has drifted out of step with ours, a silent
                // return leaves it drifted forever, because this is the only path that
                // could put it right. Ken hit exactly that — the button stayed dark
                // through every further tap while capture ran underneath.
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
                        // the browser's own cancellation is worth having on top of
                        // the transcript-level echo filter in stt.js.
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
            const rate = audioCtx.sampleRate;

            // Shared with testKey, so the Test button cannot pass while this fails.
            const params = listenParams(rate);

            gate = vad.createGate();
            preRollFrames = Math.max(1, Math.ceil((gate.preRollMs() / 1000) * rate / FRAME_SAMPLES));
            preRoll = [];
            billedMs = 0;

            try {
                ws = new WebSocket(`${ENDPOINT}?${params}`, ['token', key]);
            } catch {
                if (onStatus) onStatus('error', 'connect-failed');
                return false;
            }
            ws.binaryType = 'arraybuffer';
            ws.onmessage = handleMessage;
            ws.onerror = () => { if (onStatus) onStatus('error', 'network'); };
            ws.onclose = (e) => {
                // CARRY THE CLOSE CODE. A rejected key, a refused subprotocol and a
                // dropped connection all arrive here as the same event, and the bare
                // word "closed" cannot tell them apart — which on a tablet, with no
                // console to fall back on, is the difference between a diagnosis and
                // a guess. testKey() above has always reported the code; this path
                // threw it away. 1000 is a clean close; anything else is the
                // interesting case.
                if (running && onStatus) {
                    const code = e && e.code ? e.code : '?';
                    const why = e && e.reason ? `: ${e.reason}` : '';
                    onStatus('error', `closed (code ${code}${why})`);
                }
            };
            ws.onopen = () => {
                // Report LISTENING here, not at the end of start(). stt.js documents
                // this contract for the paid backend — "reports 'listening' once it is
                // actually up, so the button does not claim to be listening before
                // anything can be heard" — and reporting it before the handshake
                // completed broke it: the button went red on the tap and black again
                // when the socket failed, which reads as the button not working rather
                // than as the connection being refused (Ken, iPad, August 3 2026).
                if (onStatus) onStatus('listening');
                keepAliveTimer = setInterval(() => {
                    // Only while silent — during speech the audio itself keeps the
                    // socket alive.
                    if (ws && ws.readyState === WebSocket.OPEN && !gate.isOpen()) {
                        ws.send(JSON.stringify({ type: 'KeepAlive' }));
                    }
                }, KEEPALIVE_MS);
            };

            sourceNode = audioCtx.createMediaStreamSource(stream);
            processor = audioCtx.createScriptProcessor(FRAME_SAMPLES, 1, 1);
            processor.onaudioprocess = (e) => {
                if (!running) return;
                handleFrame(e.inputBuffer.getChannelData(0), Date.now());
            };
            sourceNode.connect(processor);
            // A ScriptProcessorNode only runs when connected to a destination. Route
            // it through a silent gain so nothing is played back — connecting the
            // microphone straight to the speakers would howl.
            const mute = audioCtx.createGain();
            mute.gain.value = 0;
            processor.connect(mute).connect(audioCtx.destination);

            // `running` still goes true here, so the audio graph captures and the
            // pre-roll buffer fills while the handshake completes — only the STATUS
            // moved to ws.onopen above.
            running = true;
            return true;
        },

        stop() {
            if (!running) return;
            running = false;
            // Close the gate first so a span in progress is still counted.
            if (gate && gate.isOpen()) {
                billedMs += Date.now() - openedAt;
                if (onBilled) onBilled(billedMs / 1000);
            }
            if (gate) gate.reset();
            if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
            if (ws) {
                // CloseStream asks Deepgram to flush any pending transcript before
                // hanging up, so the partner's last words are not lost.
                try {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'CloseStream' }));
                } catch { /* already closing */ }
                try { ws.close(); } catch { /* already closed */ }
                ws = null;
            }
            if (processor) { try { processor.disconnect(); } catch { /* gone */ } processor = null; }
            if (sourceNode) { try { sourceNode.disconnect(); } catch { /* gone */ } sourceNode = null; }
            if (stream) { stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* gone */ } }); stream = null; }
            if (audioCtx) { try { audioCtx.close(); } catch { /* gone */ } audioCtx = null; }
            preRoll = [];
            if (onStatus) onStatus('stopped');
        },

        isRunning() { return running; },
        billedSeconds() { return billedMs / 1000; },
    };
}
