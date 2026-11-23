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
 *
 * (!) SUPERSEDED IN PART - MEASURED September 2 2026. The line above says Deepgram is
 * "the only cheap one that can be connected DIRECTLY FROM A BROWSER". That is NO
 * LONGER TRUE, and it was recorded from documentation rather than from a test.
 *
 * Probed from a real browser origin with a deliberately invalid key, which is the
 * whole question: a readable HTTP status means the browser was allowed to see the
 * response, so a user's own key could be used. OpenAI, ElevenLabs, Cartesia, Google
 * Cloud TTS and Azure Speech ALL answered with a plain 401/400 of response type
 * "cors" - they permit browser-direct calls today. AssemblyAI's realtime token
 * endpoint was the CONTROL and genuinely failed to fetch, which is what proves the
 * probe can detect a block and that the original AssemblyAI reasoning still stands.
 *
 * So the barrier for most vendors is a POLICY RECOMMENDATION - "do not ship YOUR key
 * in a browser" - and not a technical wall. That recommendation does not apply here:
 * the key is the USER'S OWN, on the USER'S OWN device, and never reaches us.
 *
 * (!) WHAT WAS NOT MEASURED, so this is not read as more than it is: only
 * REACHABILITY with an invalid key. No synthesis with a real key, and no full
 * streaming session. Reachability was the believed blocker; it is necessary, not
 * sufficient. See CLAUDE.md, "Deepgram is not the only browser-direct option".
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
import * as micCheck from './mic-check.js';
import * as audioSession from './audio-session.js';

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
// (!) mip_opt_out KEEPS THE PARTNER'S WORDS OUT OF DEEPGRAM'S TRAINING DATA, and it
// goes on every request rather than being relied upon to be unnecessary. Their
// documentation says training data comes only from contractual participation in their
// Model Improvement Partnership Program - and also documents this per-request opt-out.
// The two statements sit oddly together, and the cheap, certain reading is to send the
// parameter. It costs nothing.
//
// It matters more here than the usual privacy boilerplate because the audio is the
// COMMUNICATION PARTNER'S speech: they never chose this device, cannot sensibly be
// asked mid-conversation, and what they say is disproportionately medical or private.
// See the Speech Provider Guide, "What They Do With Your Words".
function listenParams(sampleRate) {
    return new URLSearchParams({
        mip_opt_out: 'true',
        model: MODEL,
        // English is Deepgram's default; stated anyway, so that no service is left to
        // guess the language (see the ElevenLabs entry in speech-catalog.js).
        language: 'en',
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
    // CR-083: start() awaits the microphone with `running` still false. `starting`
    // stops a second tap opening a second microphone in that window, and `wanted` lets a
    // stop() during it be honored once the microphone arrives.
    let starting = false;
    let wanted = false;
    // A stop() arrived while this start was still waiting for the microphone. If a
    // later start() then wanted it again and the request fails, the failure belongs to
    // the cancelled attempt (the app was going to the background, say), so it is tried
    // once more rather than reported (problem 6 of the November 13 2026 findings).
    let interrupted = false;
    let muteNode = null;
    // The settings the open connection was made with: one opened ahead of the
    // microphone (prepare) is only used if it was made for the same audio.
    let wsParams = null;
    // 'listening' has been reported for this run (see maybeReady).
    let ready = false;

    /*
     * ⚠ THE CONNECTION IS OPENED AT THE SAME TIME AS THE MICROPHONE, NOT AFTER IT (Ken's
     * iPad problem report, November 23 2026: "Listening has a several second delay which
     * misses the beginning of the statement of the communication partner").
     *
     * It used to be made only once the microphone was open and its audio awake, so on an
     * iPad the steps ran one after another - the listening tone's wait, the switch to
     * recording, the microphone, and only then the connection - and the Listen button
     * lit, and the first words came back, only after all of them. The connection does
     * not touch the iPad's sound, so it now starts first (or during the tone: prepare)
     * and the two overlap. Nothing is billed for it: Deepgram charges for audio sent,
     * and KeepAlive holds the connection open until audio flows.
     *
     * What this does NOT change: words said before the microphone is open are still
     * lost, because there is no sound yet to keep. mic-check.js times each step of a
     * start so a problem report can say how long that takes on the tester's device.
     */
    function connect(key, params) {
        let s;
        try {
            s = new WebSocket(`${ENDPOINT}?${params}`, ['token', key]);
        } catch {
            return false;
        }
        ws = s;
        wsParams = String(params);
        s.binaryType = 'arraybuffer';
        s.onmessage = handleMessage;
        // A failure fires 'error' AND 'close'; only the close reports (CR-049). A socket
        // closed on purpose has these detached first (closeSocket), so anything that
        // arrives here is a real failure, and `s !== ws` ignores one already replaced.
        s.onerror = () => { if (s === ws) pending = []; };
        s.onclose = (e) => {
            if (s !== ws) return;
            pending = [];
            // CARRY THE CLOSE CODE. A rejected key, a refused subprotocol and a dropped
            // connection all arrive here as the same event, and the bare word "closed"
            // cannot tell them apart - which on a tablet, with no console to fall back
            // on, is the difference between a diagnosis and a guess. testKey() above has
            // always reported the code. 1000 is a clean close; anything else is the
            // interesting case.
            const code = e && e.code ? e.code : '?';
            const why = e && e.reason ? `: ${e.reason}` : '';
            const detail = `closed (code ${code}${why})`;
            if (running) {
                // stt.js stops the source when it hears this, which closes the rest.
                if (onStatus) onStatus('error', detail);
                return;
            }
            closeSocket();
            if (starting) {
                // The microphone is still on its way and this start cannot finish
                // without the connection: give up, and say why, as a failure while
                // listening would. The microphone is given back when it arrives.
                wanted = false;
                if (onStatus) onStatus('error', detail);
            }
            // Opened ahead (prepare) with nothing started yet: start() connects again,
            // and says so if that fails too.
        };
        s.onopen = () => {
            if (s !== ws) return;
            micCheck.noteConnected();
            // What arrived during the handshake goes first, in order (CR-006).
            for (const b of pending) s.send(b);
            pending = [];
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            keepAliveTimer = setInterval(() => {
                // Only while silent - during speech the audio itself keeps the socket
                // alive - and before the microphone is in, when nothing else would.
                if (ws === s && s.readyState === WebSocket.OPEN && !(gate && gate.isOpen())) {
                    s.send(JSON.stringify({ type: 'KeepAlive' }));
                }
            }, KEEPALIVE_MS);
            maybeReady();
        };
        return true;
    }

    // Close the connection on purpose. Handlers detached first: a stopped source must
    // report nothing more, and a late open must not start a KeepAlive for it (CR-049).
    function closeSocket() {
        if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
        pending = [];
        if (!ws) return;
        const s = ws;
        ws = null;
        wsParams = null;
        s.onmessage = null; s.onerror = null; s.onclose = null; s.onopen = null;
        // CloseStream is a courtesy to the service. It does NOT recover the last words:
        // the socket closes at once, and a browser discards anything that arrives once it
        // is closing (CR-060). What was on screen is kept by stt.js committing the
        // unsettled words before it stops the source.
        try { if (s.readyState === WebSocket.OPEN) s.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* closing */ }
        try { s.close(1000); } catch { /* already closed */ }
    }

    /*
     * Report LISTENING once the microphone is capturing AND the connection is open,
     * whichever comes second. stt.js documents this contract for a paid backend -
     * "reports 'listening' once it is actually up, so the button does not claim to be
     * listening before anything can be heard" - and reporting it before the handshake
     * completed broke it: the button went red on the tap and black again when the socket
     * failed, which reads as the button not working rather than as the connection being
     * refused (Ken, iPad, August 3 2026).
     */
    function maybeReady() {
        if (ready || !running || !ws || ws.readyState !== WebSocket.OPEN) return;
        ready = true;
        if (onStatus) onStatus('listening');
    }

    // Give back what a start that did not finish had taken: the microphone, and the
    // connection made for it.
    function releaseHalfOpen() {
        closeSocket();
        try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* gone */ }
        stream = null;
        audioCtx = null;   // the shared listening context is kept (audio-session.js)
    }

    // Rolling buffer of recent frames, so the syllable before the gate opened is not
    // lost. Sized from the gate's pre-roll and the actual sample rate at start().
    let preRoll = [];
    let preRollFrames = 0;

    let openedAt = 0;
    let billedMs = 0;
    let sentSamples = 0;   // audio actually handed to the socket this session (CR-158)
    let audioRate = 0;

    // Audio that arrived while the socket was still connecting. Listening restarts at
    // the start of nearly every partner turn, which is exactly when they start
    // talking, and the handshake takes hundreds of ms (a second or more on cellular).
    // Sending into a CONNECTING socket silently drops the audio, so the opening words
    // were lost - and the pre-roll, which exists to protect them, was thrown away too
    // (CR-006). Held here and flushed on open. Bounded, and dropped on error/close so
    // a dead socket can never replay old audio into a later one.
    let pending = [];
    let pendingMax = 0;

    function send(buf) {
        if (!ws) return;
        if (ws.readyState === WebSocket.OPEN) { ws.send(buf); return; }
        if (ws.readyState === WebSocket.CONNECTING) {
            pending.push(buf);
            while (pending.length > pendingMax) pending.shift();
        }
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
        micCheck.noteFrame(level, gate.levels());

        if (edge === 'open') {
            openedAt = now;
            micCheck.noteSpeech();
            // Flush what was already in hand — the start of the word that opened
            // the gate is in there. It is billed like any other audio sent (CR-158).
            for (const f of preRoll) { send(f); sentSamples += f.byteLength / 2; }
            preRoll = [];
            if (onStatus) onStatus('capturing');
        }

        if (gate.isOpen()) {
            send(frame.buffer);
            sentSamples += frame.length;
        } else {
            // Not sending: keep the tail in the pre-roll ring instead.
            preRoll.push(frame.buffer);
            while (preRoll.length > preRollFrames) preRoll.shift();
        }
        // Report what has been sent when a span ends (CR-158).
        if (edge === 'close') reportBilled();
    }

    function reportBilled() {
        billedMs = audioRate ? (sentSamples / audioRate) * 1000 : billedMs;
        if (onBilled) onBilled(billedMs / 1000);
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

    async function start() {
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
        // ⚠ A START WHILE ONE IS ALREADY WAITING WANTS IT AGAIN (problem 1 of the
        // November 13 2026 findings). Returning without this left `wanted` false
        // after a stop-then-start in that window, so the waiting start gave itself
        // up when the microphone arrived: nothing listening, and on an iPad the
        // Listen button stuck lit.
        if (starting) { wanted = true; return true; }
        starting = true;
        wanted = true;
        interrupted = false;
        ready = false;

        // Starts knowing the room the last run measured (problem 7): see vad.js.
        gate = vad.createGate({ initialFloor: gate ? gate.levels().floor : null });
        preRoll = [];
        pending = [];
        billedMs = 0;
        sentSamples = 0;
        // Tell the app the running total restarted, or its next report reads as a
        // decrease and that whole first burst is never counted (CR-019).
        if (onBilled) onBilled(0);

        // CONNECT FIRST, so the handshake runs while the microphone opens (see
        // connect). The shared listening context already knows the rate the audio
        // will arrive at, so the settings are known before the microphone is in. A
        // connection opened ahead (prepare) is used if it was made for this audio.
        // Shared with testKey, so the Test button cannot pass while this fails.
        const earlyParams = String(listenParams(audioSession.captureContext().sampleRate));
        if (ws && wsParams !== earlyParams) closeSocket();
        if (!ws && !connect(key, earlyParams)) {
            // Before the microphone was asked for, so there is nothing to give back
            // (a key with a space inside it does this).
            starting = false;
            if (onStatus) onStatus('error', 'connect-failed');
            return false;
        }

        try {
            // Call processing on, and one retry if an iPad's audio mode was not
            // ready to record - unless this start was cancelled meanwhile; see
            // audio-session.js.
            stream = await audioSession.openMic({ stillWanted: () => wanted });
        } catch (err) {
            starting = false;
            stream = null;
            // Cancelled while waiting: not a microphone failure, and reporting it
            // as one switched listening off with a false error (problem 6).
            if (!wanted) { closeSocket(); return false; }
            if (interrupted) return start();
            closeSocket();
            if (onStatus) onStatus('error', audioSession.micFailure(err));
            return false;
        }
        if (!wanted) { starting = false; releaseHalfOpen(); return false; }

        // The shared listening context, woken by a tap; see audio-session.js.
        audioCtx = audioSession.captureContext();
        if (!(await audioSession.wake(audioCtx))) {
            starting = false;
            releaseHalfOpen();
            // Nobody is waiting for a start that was cancelled, so it is neither
            // "stuck" nor news to the app.
            if (!wanted) return false;
            micCheck.noteStuck('audio would not start');
            if (onStatus) onStatus('stopped');   // button dark: the next Listen tap wakes it
            return false;
        }
        const rate = audioCtx.sampleRate;
        if (!wanted) { starting = false; releaseHalfOpen(); return false; }
        micCheck.noteStart({ stream, audioCtx });

        // The connection is made again if a stop and a new start while the microphone
        // was opening closed it, and replaced if it was made for a different rate (the
        // listening context was remade meanwhile).
        const params = String(listenParams(rate));
        if (ws && wsParams !== params) closeSocket();
        if (!ws && !connect(key, params)) {
            starting = false;
            // ⚠ GIVE THE MICROPHONE BACK. It is already open, and stop() does nothing
            // to it while nothing is running, so leaving it here kept the microphone on
            // for the rest of the session.
            releaseHalfOpen();
            if (onStatus) onStatus('error', 'connect-failed');
            return false;
        }
        preRollFrames = Math.max(1, Math.ceil((gate.preRollMs() / 1000) * rate / FRAME_SAMPLES));
        pendingMax = Math.ceil((10 * rate) / FRAME_SAMPLES);   // about ten seconds
        audioRate = rate;

        sourceNode = audioCtx.createMediaStreamSource(stream);
        processor = audioCtx.createScriptProcessor(FRAME_SAMPLES, 1, 1);
        processor.onaudioprocess = (e) => {
            if (!running) return;
            handleFrame(e.inputBuffer.getChannelData(0), Date.now());
        };
        sourceNode.connect(processor);
        // A ScriptProcessorNode only runs when connected to a destination. Route
        // it through a silent gain so nothing is played back — connecting the
        // microphone straight to the speakers would howl. Kept, so stop() can
        // disconnect it: the shared context lives for the whole page, and a silent
        // gain left on its output at every start built up for as long as it ran.
        muteNode = audioCtx.createGain();
        muteNode.gain.value = 0;
        processor.connect(muteNode).connect(audioCtx.destination);

        // `running` goes true here, so the audio graph captures and the pre-roll
        // buffer fills even if the handshake is still going; frames sent before it
        // finishes are held (pending) and sent when it opens.
        starting = false;
        running = true;
        // If the connection is already open, the app is told now; otherwise when it
        // opens (see maybeReady).
        maybeReady();
        return true;
    }

    /*
     * Open the connection ahead of the microphone. stt.js calls this while the
     * listening tone plays, when the microphone has to wait for the tone but the
     * connection need not. The start that follows uses it; a stop, or anything that
     * cancels the start, closes it.
     */
    function prepare() {
        if (running || starting || ws) return;
        const key = (getKey() || '').trim();
        if (!key) return;   // start() says so
        try {
            connect(key, String(listenParams(audioSession.captureContext().sampleRate)));
        } catch { /* start() connects instead */ }
    }

    function stop() {
        if (starting) interrupted = true;
        wanted = false;
        ready = false;
        if (!running) {
            // A start still waiting for the microphone, or a connection opened ahead of
            // one (prepare), already has its connection: close it, or it stays open,
            // kept alive, with nothing to send.
            closeSocket();
            return;
        }
        running = false;
        micCheck.noteStop();
        // A span in progress is still counted.
        if (gate && gate.isOpen()) reportBilled();
        if (gate) gate.reset();
        closeSocket();
        if (processor) { try { processor.disconnect(); } catch { /* gone */ } processor = null; }
        if (muteNode) { try { muteNode.disconnect(); } catch { /* gone */ } muteNode = null; }
        if (sourceNode) { try { sourceNode.disconnect(); } catch { /* gone */ } sourceNode = null; }
        if (stream) { stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* gone */ } }); stream = null; }
        audioCtx = null;   // the shared listening context is kept (audio-session.js)
        preRoll = [];
        pending = [];
        if (onStatus) onStatus('stopped');
    }

    return {
        start,
        stop,
        prepare,
        // Closing for the app's own speech on an iPad (stt.js). For this service it is
        // the same as a stop: what was on screen is kept by stt.js before it calls this,
        // and the words still on their way when the socket closes are the fraction of a
        // second the November 13 2026 findings accept as optional to recover.
        pause: stop,
        isRunning() { return running; },
        isStarting() { return starting; },
        billedSeconds() { return billedMs / 1000; },
        // How long the microphone has been quiet (vad.js), so stt.js counts a pause
        // only once the room is actually quiet, not merely once words stop arriving.
        quietForMs() { return gate ? gate.quietForMs(Date.now()) : Infinity; },
    };
}
