/*
 * tts-deepgram.js — speaking through Deepgram Aura, for the platforms whose own
 * voices are unusable.
 *
 * WHY THIS EXISTS. Measured on an iPad (iPadOS 26.6, July 31 2026): the browser
 * offers 68 voices, and the roster is a frozen curated list — 19 of them are 1980s
 * novelty voices (Bahh, Boing, Zarvox), 45 are one-per-language at the SMALLEST
 * quality tier, and exactly one is an ordinary en-US voice (Samantha). Installing
 * Ava, Ava (Enhanced) and Ava (Premium) on the device changed nothing: no Ava of
 * any kind reaches getVoices(), and no `enhanced` or `premium` voice exists in the
 * list at all. So on an iPad the built-in choice is Samantha or a joke voice, with
 * no upgrade path reachable from a web app at any price. This buys one back.
 *
 * WHY WEBSOCKETS AND NOT THE REST ENDPOINT — the load-bearing constraint. Deepgram's
 * own documentation states that REST calls to their API are NOT supported from a
 * browser because of CORS, and recommends a proxy. A proxy is a server, and "no
 * server infrastructure the project must pay for" is the reason this project can
 * outlive its funding. Their WebSocket interface is not subject to CORS and
 * authenticates through the Sec-WebSocket-Protocol subprotocol pair — which is
 * exactly why the transcription backend could be built browser-direct, and the same
 * reasoning applies here. If this ever stops working, the answer is a different
 * vendor, not a backend.
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
 * WHY THE CACHE IS NOT AN OPTIMIZATION. Aura is billed per character. A conversation
 * repeats the same short strings constantly — placeholders ("Good question."),
 * control phrases, openers and closings, every Express Panel button — so without a
 * cache the user pays again for "Bye!" every time they say it, AND waits for a
 * network round trip to say a word the app said a minute ago. The cache is what
 * makes the repeated-phrase paths behave like local speech.
 *
 * WHAT IS DELIBERATELY NOT HERE: any fallback logic. If synthesis fails, this
 * module throws and tts.js falls back to the browser's own voice, because the one
 * outcome that is never acceptable is the user pressing a button and nothing being
 * said. Keeping that decision in one place is what guarantees it.
 */

const ENDPOINT = 'wss://api.deepgram.com/v1/speak';
const ENCODING = 'linear16';
const SAMPLE_RATE = 24000;

// How long to wait for synthesis before giving up and letting the caller fall back
// to the browser's voice. Generous enough for a cold socket on tablet wifi, short
// enough that a dead network does not leave the user standing in silence.
const SYNTH_TIMEOUT_MS = 6000;

// Cached utterances, newest last (Map preserves insertion order, so the oldest key
// is the first). Capped by count rather than bytes: entries are short phrases, and
// a count is something a reader can reason about.
const MAX_CACHE_ENTRIES = 300;

/*
 * The voices offered in Settings. Deepgram documents the model id format as
 * [model]-[voice]-[language], so these are mechanically derived from the published
 * voice names; `aura-2-thalia-en` is the one given verbatim in their docs and is
 * the default here. A wrong id fails loudly on the Test button rather than
 * silently, which is why Test speaks rather than just checking the key.
 *
 * This is a curated subset, not the full 40+: a picker is something a user with
 * limited motor control has to scroll, so it holds the featured voices plus the
 * distinct accents, which is where the real choice lies.
 */
export const VOICES = [
    { id: 'aura-2-thalia-en',     name: 'Thalia',     detail: 'Female · American' },
    { id: 'aura-2-andromeda-en',  name: 'Andromeda',  detail: 'Female · American' },
    { id: 'aura-2-helena-en',     name: 'Helena',     detail: 'Female · American' },
    { id: 'aura-2-aurora-en',     name: 'Aurora',     detail: 'Female · American' },
    { id: 'aura-2-luna-en',       name: 'Luna',       detail: 'Female · American' },
    { id: 'aura-2-cordelia-en',   name: 'Cordelia',   detail: 'Female · American' },
    { id: 'aura-2-apollo-en',     name: 'Apollo',     detail: 'Male · American' },
    { id: 'aura-2-arcas-en',      name: 'Arcas',      detail: 'Male · American' },
    { id: 'aura-2-aries-en',      name: 'Aries',      detail: 'Male · American' },
    { id: 'aura-2-orion-en',      name: 'Orion',      detail: 'Male · American' },
    { id: 'aura-2-atlas-en',      name: 'Atlas',      detail: 'Male · American' },
    { id: 'aura-2-zeus-en',       name: 'Zeus',       detail: 'Male · American' },
    { id: 'aura-2-pandora-en',    name: 'Pandora',    detail: 'Female · British' },
    { id: 'aura-2-draco-en',      name: 'Draco',      detail: 'Male · British' },
    { id: 'aura-2-theia-en',      name: 'Theia',      detail: 'Female · Australian' },
    { id: 'aura-2-hyperion-en',   name: 'Hyperion',   detail: 'Male · Australian' },
];

export const DEFAULT_VOICE = VOICES[0].id;

export function voiceLabel(id) {
    const v = VOICES.find((x) => x.id === id);
    return v ? `${v.name} — ${v.detail}` : id;
}

/* --- pure helpers (unit-tested) ------------------------------------------- */

// Deepgram sends signed 16-bit little-endian PCM. Web Audio wants float samples in
// [-1, 1]. Dividing by 32768 rather than 32767 keeps the mapping symmetric so the
// most negative sample cannot overshoot and clip.
export function pcm16ToFloat32(chunks) {
    let total = 0;
    for (const c of chunks) total += c.byteLength;
    const out = new Float32Array(Math.floor(total / 2));
    let i = 0;
    for (const c of chunks) {
        // A chunk boundary can land mid-sample, so read whole samples only and
        // ignore a trailing odd byte rather than shifting every sample after it.
        const view = new DataView(c);
        const samples = Math.floor(c.byteLength / 2);
        for (let s = 0; s < samples; s++) out[i++] = view.getInt16(s * 2, true) / 32768;
    }
    return out.subarray(0, i);
}

export function cacheKey(model, text) {
    // The separator is a NUL, written as an ESCAPE rather than as a raw byte: a
    // literal NUL makes git and grep treat this whole file as binary, so its diffs
    // stop being reviewable. Same character, same keys, readable history.
    return `${model}\0${text}`;
}

// The billable unit is characters of text submitted, so this is what gets counted —
// and a cache hit submits nothing, which is why the counter lives at the send site
// rather than at speak().
export function billableCharacters(text) {
    return typeof text === 'string' ? text.length : 0;
}

/* --- the voice ------------------------------------------------------------ */

/*
 *   getKey()          — read at speak time, not at creation, so a key pasted into
 *                       Settings works without a reload.
 *   onBilled(chars)   — characters actually sent to Deepgram (cache hits send none),
 *                       so the app can show what speaking cost.
 */
export function createVoice({ getKey, onBilled } = {}) {
    let ctx = null;
    let socket = null;
    let socketModel = null;
    let pending = null;        // the synthesis in flight: { chunks, resolve, reject, timer }
    let source = null;         // the AudioBufferSourceNode currently playing
    let playToken = 0;         // bumped by cancel(), so a cancel during the
                               // resume wait below is not overtaken by playback
    let chain = Promise.resolve();
    const cache = new Map();
    // Set only while the Settings Test button is exercising a key the user has
    // typed but not yet saved, so Test reports on what is on screen.
    let keyOverride = null;

    function currentKey() {
        return keyOverride || (getKey && getKey()) || '';
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
     * gesture. Placeholders fire on TIMERS, so if the context is not unlocked
     * during some earlier tap the app goes silent exactly when it is trying to hold
     * the floor. Call this from any real tap; it is cheap and idempotent.
     */
    function unlock() {
        try {
            const c = audioContext();
            if (c.state === 'suspended') c.resume();
        } catch { /* no audio at all — speak() will report it */ }
    }

    function closeSocket() {
        stopKeepAlive();          // before the early return: the timer outlives a null socket
        if (!socket) return;
        try { socket.close(); } catch { /* already gone */ }
        socket = null;
        socketModel = null;
    }

    function failPending(message) {
        if (!pending) return;
        clearTimeout(pending.timer);
        const { reject } = pending;
        pending = null;
        reject(new Error(message));
    }

    // Open (or reuse) the socket. The model is a QUERY PARAMETER, so a voice change
    // needs a new connection — reusing one would keep speaking in the old voice,
    // which is the kind of bug that looks like the setting is broken.
    function connect(model) {
        if (socket && socket.readyState === WebSocket.OPEN && socketModel === model) {
            return Promise.resolve(socket);
        }
        closeSocket();
        const key = currentKey();
        if (!key) return Promise.reject(new Error('No Deepgram key is set.'));

        return new Promise((resolve, reject) => {
            const url = `${ENDPOINT}?model=${encodeURIComponent(model)}` +
                        `&encoding=${ENCODING}&sample_rate=${SAMPLE_RATE}`;
            let ws;
            try {
                // The subprotocol pair is how a browser authenticates to Deepgram:
                // the WebSocket API cannot set an Authorization header, and this is
                // the mechanism they document for client-side connections.
                ws = new WebSocket(url, ['token', key]);
            } catch {
                return reject(new Error('Could not open a connection to the voice service.'));
            }
            ws.binaryType = 'arraybuffer';

            const openTimer = setTimeout(() => {
                try { ws.close(); } catch { /* ignore */ }
                reject(new Error('The voice service did not respond.'));
            }, SYNTH_TIMEOUT_MS);

            ws.onopen = () => {
                clearTimeout(openTimer);
                socket = ws;
                socketModel = model;
                startKeepAlive();   // an idle connection is the one that gets closed
                resolve(ws);
            };
            ws.onmessage = (e) => {
                if (!pending) return;             // audio for a cancelled utterance
                if (typeof e.data === 'string') {
                    let msg;
                    try { msg = JSON.parse(e.data); } catch { return; }
                    // Flushed marks the end of the audio for what we asked for.
                    if (msg.type === 'Flushed') {
                        clearTimeout(pending.timer);
                        const { chunks, resolve: done } = pending;
                        pending = null;
                        done(chunks);
                    } else if (msg.type === 'Warning') {
                        failPending(msg.description || 'The voice service reported a problem.');
                    }
                    return;
                }
                pending.chunks.push(e.data);
            };
            ws.onerror = () => {
                clearTimeout(openTimer);
                // A rejected key fails the handshake, which a browser surfaces as an
                // error with no status to quote — so name the likely cause.
                failPending('The voice service refused the connection — check your Deepgram key.');
                reject(new Error('The voice service refused the connection — check your Deepgram key.'));
            };
            ws.onclose = () => {
                clearTimeout(openTimer);
                if (socket === ws) { socket = null; socketModel = null; stopKeepAlive(); }
                failPending('The connection to the voice service closed.');
                reject(new Error('The connection to the voice service closed.'));
            };
        });
    }

    // Ask for one utterance and collect its audio.
    function synthesize(model, text) {
        return connect(model).then((ws) => new Promise((resolve, reject) => {
            pending = {
                chunks: [],
                resolve,
                reject,
                timer: setTimeout(() => failPending('The voice service took too long.'), SYNTH_TIMEOUT_MS),
            };
            try {
                ws.send(JSON.stringify({ type: 'Speak', text }));
                ws.send(JSON.stringify({ type: 'Flush' }));
            } catch {
                failPending('Could not send the text to the voice service.');
                return;
            }
            if (onBilled) onBilled(billableCharacters(text));
        }));
    }

    /*
     * ⚠ THE RESUME MUST BE AWAITED BEFORE THE AUDIO STARTS, and that is the whole fix
     * for a dropped opening word (Ken, September 2 2026: "Are you wearing a tie
     * tonight?" came out as "You wearing a tie tonight?").
     *
     * A browser SUSPENDS an AudioContext that has been idle, and resume() is
     * asynchronous. Starting a buffer against a context that is still waking up
     * schedules it at a currentTime that has not begun advancing yet, so the browser
     * discards whatever of the buffer it considers already past - heard as the first
     * word going missing. It is intermittent by nature: it happens only when the
     * context had gone to sleep.
     *
     * WHY IT SHOWED UP FROM THE COMPOSE PANE. That is where the app is quiet longest -
     * the user types for a minute with nothing playing, the context suspends, and the
     * statement they just wrote is the first thing spoken afterwards. A short
     * unstressed opening word is exactly what fits inside the wake-up gap.
     *
     * Only the paid voice can show this. The browser voice goes through
     * speechSynthesis, which owns its own audio and has no context here to suspend.
     */
    async function play(samples) {
        const c = audioContext();          // throws if this browser cannot play audio
        if (c.state === 'suspended') {
            const mine = ++playToken;
            // A refused resume is not fatal - start() may still work, and throwing
            // here would cost the user the browser-voice fallback as well.
            try { await c.resume(); } catch { /* fall through and try anyway */ }
            // cancel() cannot stop a node that does not exist yet, so checking here is
            // the only way a cancel during the wait can be honored.
            if (mine !== playToken) return;
        }
        if (!samples.length) return;

        return new Promise((resolve) => {
            const buffer = c.createBuffer(1, samples.length, SAMPLE_RATE);
            buffer.getChannelData(0).set(samples);
            const node = c.createBufferSource();
            node.buffer = buffer;
            node.connect(c.destination);
            source = node;
            node.onended = () => {
                if (source === node) source = null;
                resolve();
            };
            node.start();
        });
    }

    function remember(key, samples) {
        cache.set(key, samples);
        while (cache.size > MAX_CACHE_ENTRIES) {
            cache.delete(cache.keys().next().value);
        }
    }

    /*
     * Speak, and resolve when the audio has finished playing. Throws on any failure
     * so tts.js can fall back to the browser voice — never swallow an error here,
     * because a silent failure means the user pressed a button and nothing happened.
     *
     * Serialized through `chain` so two overlapping calls cannot interleave on one
     * socket; cancel() breaks the chain by stopping playback.
     */
    function speak(text, { model = DEFAULT_VOICE } = {}) {
        const run = async () => {
            const trimmed = (text || '').trim();
            if (!trimmed) return;
            const key = cacheKey(model, trimmed);
            let samples = cache.get(key);
            if (!samples) {
                const chunks = await synthesizeWithRetry(model, trimmed);
                samples = pcm16ToFloat32(chunks);
                if (!samples.length) throw new Error('The voice service returned no audio.');
                remember(key, samples);
            }
            await play(samples);
        };
        chain = chain.then(run, run);   // one failure must not wedge the queue
        return chain;
    }

    /*
     * One retry before giving up (Ken, August 8 2026).
     *
     * The connection is REUSED between utterances and nothing is sent over it in
     * between, so a quiet stretch in a conversation is long enough for Deepgram, a
     * proxy or the network to close it — and the app only discovers that on the next
     * tap. That utterance then came out in the device voice while Settings still said
     * Deepgram, which is a change of the user's VOICE with no visible cause. The
     * keepalive below makes it rarer; this makes it recoverable when it happens
     * anyway, because the second attempt opens a fresh connection and succeeds.
     *
     * Exactly one retry, and only for a CONNECTION failure. A retry costs the user
     * real time in the middle of a conversation, and the failures worth retrying are
     * the ones where a fresh connection is a different attempt. Anything else — a
     * rejected key, a refusal, no audio returned — will fail identically the second
     * time, so retrying it would only add delay before the same fallback.
     */
    const RETRYABLE = /closed|did not respond|took too long|refused the connection/i;

    async function synthesizeWithRetry(model, text) {
        try {
            return await synthesize(model, text);
        } catch (err) {
            if (!RETRYABLE.test(err && err.message ? err.message : '')) throw err;
            // Drop the dead connection so the retry cannot reuse it — without this the
            // second attempt would hand back the same broken one and fail the same way.
            closeSocket();
            return synthesize(model, text);
        }
    }

    /*
     * Keep the idle connection alive (Ken, August 8 2026).
     *
     * Deepgram's speak socket accepts a KeepAlive message; without one, an idle
     * connection is exactly the thing that gets closed underneath us during a pause in
     * the conversation. Sent only while a connection is actually open, so it costs
     * nothing when the paid voice is not in use, and it carries no text so it bills
     * nothing (Aura is charged per character).
     *
     * ⚠ UNVERIFIED AGAINST A LONG IDLE PERIOD. That the message is accepted was
     * checked; that it prevents the close needs a real conversation with a long gap in
     * it, which is why the retry above exists rather than this being the only fix.
     *
     * The timer is tied to the SOCKET's life, not the module's: createVoice() runs
     * again whenever the provider or key changes, so a timer started at module level
     * would leak one per call and go on pinging a connection nobody owns.
     */
    const KEEPALIVE_MS = 8000;
    let keepAliveTimer = null;

    function startKeepAlive() {
        stopKeepAlive();
        keepAliveTimer = setInterval(() => {
            if (!socket || socket.readyState !== WebSocket.OPEN) return stopKeepAlive();
            // Never interrupt an utterance in flight: a KeepAlive between Speak and
            // Flush is a needless risk for something that can just as well wait.
            if (pending) return;
            try { socket.send(JSON.stringify({ type: 'KeepAlive' })); }
            catch { stopKeepAlive(); /* the next speak reconnects */ }
        }, KEEPALIVE_MS);
    }

    function stopKeepAlive() {
        if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
    }

    function cancel() {
        playToken++;               // a play() waiting on resume() must not start now
        if (source) {
            try { source.stop(); } catch { /* already stopped */ }
            source = null;
        }
        // Drop anything the server has queued for us, so a cancelled sentence does
        // not arrive on top of the next one.
        if (socket && socket.readyState === WebSocket.OPEN) {
            try { socket.send(JSON.stringify({ type: 'Clear' })); } catch { /* ignore */ }
        }
        failPending('Canceled.');
    }

    function isSpeaking() {
        return source !== null;
    }

    /*
     * Speak a sample phrase with a given key and voice. This is the Settings Test
     * button, and it deliberately SPEAKS rather than merely checking the key: a
     * mistyped voice id, a blocked audio context and a rejected key all fail
     * differently, and hearing it is the only check that covers all three.
     */
    async function test(key, model, phrase) {
        try {
            keyOverride = key || null;
            closeSocket();                    // the key or voice may have changed
            await speak(phrase, { model });
            return { ok: true, message: '✓ That voice is working' };
        } catch (err) {
            return { ok: false, message: `✗ ${err.message || 'The voice could not be used.'}` };
        } finally {
            keyOverride = null;
            closeSocket();
        }
    }

    function reset() {
        cancel();
        closeSocket();
        cache.clear();
    }

    return { speak, cancel, isSpeaking, unlock, test, reset, cacheSize: () => cache.size };
}
