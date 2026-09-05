/* Tier 1 — the pure parts of the Deepgram Aura voice backend.
 *
 * The socket and the audio device cannot be exercised here, but the PCM decode can,
 * and it is the part where a mistake is least visible: a wrong sign, scale or byte
 * order does not throw, it just produces sound that is distorted, inverted or
 * silent. The rest of the module fails loudly by comparison.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as aura from '../app/js/tts-deepgram.js';

// Build an ArrayBuffer of signed 16-bit little-endian samples, as Deepgram sends.
function pcm(...samples) {
    const buf = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buf);
    samples.forEach((s, i) => view.setInt16(i * 2, s, true));
    return buf;
}

test('pcm16 decodes to float samples in [-1, 1]', () => {
    const out = aura.pcm16ToFloat32([pcm(0, 32767, -32768, 16384)]);
    assert.equal(out.length, 4);
    assert.equal(out[0], 0);
    assert.ok(Math.abs(out[1] - 1) < 0.0001, 'full positive scale reaches ~+1');
    assert.equal(out[2], -1, 'full negative scale is exactly -1, not past it');
    assert.equal(out[3], 0.5);
});

test('pcm16 is little-endian', () => {
    // 0x0100 little-endian is 1; read big-endian it would be 256.
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint8(0, 0x01);
    new DataView(buf).setUint8(1, 0x00);
    const out = aura.pcm16ToFloat32([buf]);
    assert.equal(out[0], 1 / 32768);
});

test('pcm16 joins chunks in order', () => {
    const out = aura.pcm16ToFloat32([pcm(1000, 2000), pcm(3000)]);
    assert.deepEqual([...out], [1000 / 32768, 2000 / 32768, 3000 / 32768]);
});

test('pcm16 ignores a trailing odd byte rather than shifting the rest', () => {
    // A chunk boundary can land mid-sample. Consuming the stray byte as half a
    // sample would shift every following sample by one byte and turn the audio into
    // noise, so the decoder must drop it.
    const good = pcm(1000, 2000);
    const odd = new Uint8Array(3);
    odd.set(new Uint8Array(pcm(3000)), 0);
    const out = aura.pcm16ToFloat32([good, odd.buffer]);
    assert.deepEqual([...out], [1000 / 32768, 2000 / 32768, 3000 / 32768]);
});

test('pcm16 handles empty input', () => {
    assert.equal(aura.pcm16ToFloat32([]).length, 0);
    assert.equal(aura.pcm16ToFloat32([new ArrayBuffer(0)]).length, 0);
});

test('the cache key separates voice from text', () => {
    assert.notEqual(
        aura.cacheKey('aura-2-thalia-en', 'Hello'),
        aura.cacheKey('aura-2-apollo-en', 'Hello'),
        'the same words in a different voice are different audio',
    );
    assert.equal(aura.cacheKey('m', 'Hello'), aura.cacheKey('m', 'Hello'));
});

test('billing counts characters of the text actually sent', () => {
    assert.equal(aura.billableCharacters('Bye!'), 4);
    assert.equal(aura.billableCharacters(''), 0);
    assert.equal(aura.billableCharacters(null), 0);
});

test('every offered voice has a well-formed model id and a label', () => {
    assert.ok(aura.VOICES.length > 0);
    for (const v of aura.VOICES) {
        // Deepgram documents the id format as [model]-[voice]-[language].
        assert.match(v.id, /^aura-2-[a-z]+-en$/, `${v.id} does not match the documented id format`);
        assert.ok(v.name && v.detail, `${v.id} is missing its display text`);
    }
    const ids = aura.VOICES.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length, 'voice ids must be unique');
    assert.ok(ids.includes(aura.DEFAULT_VOICE), 'the default must be one of the offered voices');
});

test('voiceLabel falls back to the raw id for an unknown voice', () => {
    assert.equal(aura.voiceLabel('aura-2-thalia-en'), 'Thalia — Female · American');
    assert.equal(aura.voiceLabel('something-else'), 'something-else');
});

/* --- the audio device, faked just enough to catch a dropped first word --------
 *
 * (!) THIS IS THE ONE CHECK THAT CROSSES THE LAYERS. The pure decode above and a
 * hand-built AudioContext each prove nothing on their own about the bug Ken hit
 * (September 2 2026): the audio was decoded perfectly and the context was real, and
 * the opening word still went missing - because the buffer was started while the
 * context was still waking from suspend. So the assertion has to be about the ORDER
 * of two things in different layers: the resume must have completed before start().
 */
function fakeSocket() {
    class FakeWebSocket {
        constructor() {
            this.readyState = 1;
            this.binaryType = '';
            this.onopen = null; this.onmessage = null;
            this.onerror = null; this.onclose = null;
            setTimeout(() => this.onopen && this.onopen(), 0);
        }
        send(raw) {
            const msg = JSON.parse(raw);
            if (msg.type !== 'Flush') return;
            // One chunk of audio, then the end marker - what Deepgram sends back.
            setTimeout(() => {
                this.onmessage && this.onmessage({ data: pcm(1000, 2000, 3000, 4000) });
                this.onmessage && this.onmessage({ data: JSON.stringify({ type: 'Flushed' }) });
            }, 0);
        }
        close() { this.readyState = 3; }
    }
    FakeWebSocket.OPEN = 1;
    return FakeWebSocket;
}

// An AudioContext that starts SUSPENDED and takes a turn of the event loop to wake,
// which is what a browser actually does to a context that has been idle.
function fakeAudio(log) {
    return class FakeAudioContext {
        constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
        resume() {
            return new Promise((res) => setTimeout(() => {
                this.state = 'running';
                log.push('resumed');
                res();
            }, 0));
        }
        createBuffer(ch, len) {
            const data = new Float32Array(len);
            return { getChannelData: () => data, length: len };
        }
        createBufferSource() {
            const ctx = this;
            return {
                buffer: null, onended: null,
                connect() {},
                start() {
                    // The heart of it: note the context's state AT THE MOMENT the
                    // audio is started. 'suspended' here is the dropped word.
                    log.push('start:' + ctx.state);
                    setTimeout(() => this.onended && this.onended(), 0);
                },
                stop() {},
            };
        }
    };
}

test('the audio is not started until a suspended context has resumed', async () => {
    const log = [];
    const savedWs = globalThis.WebSocket;
    const savedAc = globalThis.window.AudioContext;
    globalThis.WebSocket = fakeSocket();
    globalThis.window.AudioContext = fakeAudio(log);
    try {
        const voice = aura.createVoice({ getKey: () => 'test-key' });
        await voice.speak('Are you wearing a tie tonight?', { model: 'aura-2-apollo-en' });
        // The connection is kept alive by an interval, which would hold the test
        // runner's event loop open long past the assertion.
        voice.reset();
    } finally {
        globalThis.WebSocket = savedWs;
        globalThis.window.AudioContext = savedAc;
    }
    assert.deepEqual(log, ['resumed', 'start:running'],
        'the buffer must start only after resume() has settled - starting it against ' +
        'a suspended context is what dropped the opening word');
});

/* --- the training opt-out must ride on every Deepgram request ----------------
 *
 * (!) ITS ABSENCE IS COMPLETELY INVISIBLE. Drop the parameter and the app behaves
 * identically in every observable way - it speaks, it hears, no error, no warning -
 * and the only consequence is that the communication partner's words become eligible
 * for somebody's training set. There is nothing to notice, which is exactly why it
 * needs a test rather than care.
 *
 * Checked at the SOURCE because neither URL builder is reachable from here: the
 * listening one is a module-private function, and the speaking one builds its URL
 * inside a closure at connect time. A real connection would need a real key.
 */
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../app/js/' + f, import.meta.url), 'utf8');

test('the Deepgram listening connection opts out of training', () => {
    const s = src('stt-deepgram.js');
    assert.match(s, /mip_opt_out:\s*'true'/,
        'the partner audio would become eligible for training, silently');
    // One builder feeds both connect paths; if that stops being true, the parameter
    // has to be proven on whichever path grew its own URL.
    const builders = (s.match(/new URLSearchParams\(/g) || []).length;
    assert.equal(builders, 1,
        `expected one URL builder in stt-deepgram.js, found ${builders} - check the new one carries mip_opt_out`);
});

test('the Deepgram speaking connection opts out of training', () => {
    assert.match(src('tts-deepgram.js'), /mip_opt_out=true/,
        'the spoken text would become eligible for training, silently');
});

/* ---------------------------------------------------------------------------
 * Tier 2 - the streaming playback path, driven end to end.
 *
 * (!) THIS IS THE CHECK THE PROJECT'S CROSS-LAYER RULE ASKS FOR, and without it the
 * feature is untestable in the way that matters. Every layer here is easy to fool on
 * its own: the decoder can be handed bytes and the player can be handed samples, and
 * both pass while the socket's chunks never reach the audio device at all. So a fake
 * socket's chunks go into the REAL createVoice(), and what comes out is read off a
 * fake audio device - the same path a real utterance takes, minus the network and the
 * speaker.
 *
 * What still cannot be exercised here: whether the audio SOUNDS continuous on a real
 * device. Scheduling is asserted against the context's own clock, which is where a
 * gap would show up, but only a person listening can settle the last of it.
 *
 * (!) EVERY TEST MUST reset() THE VOICE, and it is not tidiness: an open connection
 * carries an 8-second keepalive timer, and one un-cleared timer holds the whole test
 * process open forever with no output and no failure. That cost a run to discover.
 * ------------------------------------------------------------------------- */

// A fake audio device that records what was scheduled and when.
function fakeContext() {
    const ctx = {
        state: 'running',
        currentTime: 0,
        scheduled: [],          // { at, seconds, samples, node }
        resumed: 0,
        async resume() { this.resumed++; this.state = 'running'; },
        createBuffer(channels, length, rate) {
            const data = new Float32Array(length);
            return { length, sampleRate: rate, duration: length / rate,
                     getChannelData: () => data };
        },
        createBufferSource() {
            const node = {
                buffer: null, onended: null, started: null, stopped: false, done: false,
                connect() {},
                start(at) {
                    node.started = at === undefined ? ctx.currentTime : at;
                    ctx.scheduled.push({ at: node.started,
                                         seconds: node.buffer.duration,
                                         samples: node.buffer.getChannelData(0).slice(),
                                         node });
                },
                stop() { node.stopped = true; },
            };
            return node;
        },
        destination: {},
    };
    // Every finished piece reports back, which is what resolves speak().
    ctx.finishAll = () => {
        for (const s of ctx.scheduled) {
            if (s.node.onended && !s.node.done) { s.node.done = true; s.node.onended(); }
        }
    };
    return ctx;
}

// A fake Deepgram socket. Chunks are pushed one at a time by the test, so the
// question "did playback start before the last chunk?" can actually be asked.
function fakeSocketFactory() {
    const made = [];
    class FakeWS {
        constructor(url, protocols) {
            this.url = url; this.protocols = protocols;
            this.readyState = 1; this.sent = [];
            made.push(this);
            setTimeout(() => this.onopen && this.onopen(), 0);
        }
        send(m) { this.sent.push(m); }
        close() { this.readyState = 3; }
        chunk(buf) { this.onmessage({ data: buf }); }
        flushed() { this.onmessage({ data: JSON.stringify({ type: 'Flushed' }) }); }
    }
    FakeWS.OPEN = 1;
    return { FakeWS, made };
}

// 40 ms of audio at 24 kHz, exactly as Deepgram sends it: 960 signed 16-bit samples.
function chunk40ms(value) {
    const buf = new ArrayBuffer(960 * 2);
    const view = new DataView(buf);
    for (let i = 0; i < 960; i++) view.setInt16(i * 2, value, true);
    return buf;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// One voice wired to one fake device and one fake network, cleaned up afterwards.
function setup(t, { suspended = false } = {}) {
    const ctx = fakeContext();
    if (suspended) ctx.state = 'suspended';
    const { FakeWS, made } = fakeSocketFactory();
    global.WebSocket = FakeWS;
    global.window = { AudioContext: function () { return ctx; } };
    const voice = aura.createVoice({ getKey: () => 'k' });
    t.after(() => voice.reset());     // see the keepalive note above
    return { ctx, made, voice };
}

test('audio plays while it is still arriving, not after the last chunk', async (t) => {
    const { ctx, made, voice } = setup(t);
    const speaking = voice.speak('hello');
    await tick(); await tick();
    const ws = made[0];

    // The lead-in is 300 ms and the chunks are 40 ms each, so the eighth starts it.
    for (let i = 0; i < 7; i++) ws.chunk(chunk40ms(1000));
    assert.equal(ctx.scheduled.length, 0, 'nothing is played inside the lead-in');
    ws.chunk(chunk40ms(1000));
    assert.ok(ctx.scheduled.length > 0,
        'playback must start once the lead-in is buffered - 92 chunks are still to come');

    for (let i = 0; i < 92; i++) ws.chunk(chunk40ms(1000));
    ws.flushed();
    await tick(); await tick();
    ctx.finishAll();
    await speaking;

    const played = ctx.scheduled.reduce((n, s) => n + s.samples.length, 0);
    assert.equal(played, 100 * 960, 'every sample handed over must reach the device');
    assert.ok(ctx.scheduled.length > 1, 'streamed audio arrives as several pieces');
});

test('the pieces are scheduled end to end, with no seam and no overlap', async (t) => {
    const { ctx, made, voice } = setup(t);
    const speaking = voice.speak('hello');
    await tick(); await tick();
    for (let i = 0; i < 40; i++) made[0].chunk(chunk40ms(500));
    made[0].flushed();
    await tick(); await tick();
    ctx.finishAll();
    await speaking;

    // (!) THE SEAM IS THE WHOLE POINT. Each piece must begin exactly where the last
    // ended; scheduling each one "now" instead would leave a silent gap the length of
    // however late that chunk was, heard as the voice stuttering.
    let expected = ctx.scheduled[0].at;
    for (const s of ctx.scheduled) {
        assert.ok(Math.abs(s.at - expected) < 1e-9,
            `piece starts at ${s.at}, expected ${expected} - a gap or an overlap`);
        expected += s.seconds;
    }
});

test('a repeated phrase plays as one piece and opens no connection', async (t) => {
    const { ctx, made, voice } = setup(t);
    const first = voice.speak('Bye!');
    await tick(); await tick();
    made[0].chunk(chunk40ms(700));
    made[0].flushed();
    await tick(); await tick();
    ctx.finishAll();
    await first;

    const socketsBefore = made.length;
    ctx.scheduled.length = 0;
    const again = voice.speak('Bye!');
    await tick(); await tick();
    ctx.finishAll();
    await again;

    assert.equal(made.length, socketsBefore, 'a repeat must not reach the network');
    assert.equal(ctx.scheduled.length, 1, 'a whole phrase plays as one piece');
});

test('cancel stops what is playing and everything scheduled behind it', async (t) => {
    const { ctx, made, voice } = setup(t);
    const speaking = voice.speak('a long sentence');
    speaking.catch(() => {});          // cancelling rejects; the assertion is below
    await tick(); await tick();
    const ws = made[0];
    for (let i = 0; i < 30; i++) ws.chunk(chunk40ms(1200));
    assert.ok(ctx.scheduled.length > 1, 'several pieces are scheduled ahead');

    voice.cancel();
    assert.ok(ctx.scheduled.every((s) => s.node.stopped),
        'a piece scheduled to start in a moment must be stopped too, or a cancelled '
        + 'sentence carries on talking');

    const after = ctx.scheduled.length;
    for (let i = 0; i < 10; i++) ws.chunk(chunk40ms(1200));
    assert.equal(ctx.scheduled.length, after, 'a late chunk must not schedule itself');
    assert.equal(voice.isSpeaking(), false);
});

test('a failure after audio has started is not retried, and our fragment is stopped',
     async (t) => {
    const { ctx, made, voice } = setup(t);
    const speaking = voice.speak('half a sentence');
    await tick(); await tick();
    const ws = made[0];
    for (let i = 0; i < 10; i++) ws.chunk(chunk40ms(1500));
    assert.ok(ctx.scheduled.length > 0, 'playback has started');

    const socketsBefore = made.length;
    ws.onclose({ code: 1006 });                 // the connection drops mid-sentence
    await assert.rejects(speaking, /closed/i,
        'it must throw, so tts.js speaks the whole sentence in the browser voice');

    assert.equal(made.length, socketsBefore,
        'a retry would start the sentence again and the partner would hear the front '
        + 'of it twice, in two different voices');
    assert.ok(ctx.scheduled.every((s) => s.node.stopped),
        'our own fragment must be stopped before the fallback speaks');
});

test('a failure BEFORE any audio is still retried on a fresh connection', async (t) => {
    const { ctx, made, voice } = setup(t);
    const speaking = voice.speak('hello');
    await tick(); await tick();
    made[0].onclose({ code: 1006 });            // the idle-socket case the retry exists for
    await tick(); await tick();
    assert.equal(made.length, 2, 'a second connection is opened');

    for (let i = 0; i < 10; i++) made[1].chunk(chunk40ms(900));
    made[1].flushed();
    await tick(); await tick();
    ctx.finishAll();
    await speaking;
    assert.ok(ctx.scheduled.length > 0, 'the retry speaks');
});

test('the audio device is woken before any audio can arrive', async (t) => {
    const { ctx, made, voice } = setup(t, { suspended: true });
    const speaking = voice.speak('hello');
    await tick(); await tick();
    // (!) The September 2 2026 dropped-opening-word fix, kept and strengthened. A piece
    // started against a context that is still waking is scheduled at a clock that has
    // not begun advancing, and the browser discards whatever it treats as already past.
    assert.equal(ctx.resumed, 1, 'resume must be awaited before the first piece');
    for (let i = 0; i < 10; i++) made[0].chunk(chunk40ms(800));
    made[0].flushed();
    await tick(); await tick();
    ctx.finishAll();
    await speaking;
    assert.ok(ctx.scheduled.length > 0);
});

test('a short phrase that ends inside the lead-in is still spoken', async (t) => {
    // (!) THE CASE THE LEAD-IN COULD SWALLOW. "Yes." is shorter than 300 ms of audio,
    // so waiting for a full lead-in that never arrives would say nothing at all.
    const { ctx, made, voice } = setup(t);
    const speaking = voice.speak('Yes.');
    await tick(); await tick();
    made[0].chunk(chunk40ms(600));              // 40 ms - far inside the lead-in
    assert.equal(ctx.scheduled.length, 0);
    made[0].flushed();
    await tick(); await tick();
    ctx.finishAll();
    await speaking;
    assert.equal(ctx.scheduled.length, 1, 'the whole short phrase goes out in one piece');
    assert.equal(ctx.scheduled[0].samples.length, 960);
});

test('a service that returns no audio throws, so the browser voice takes over',
     async (t) => {
    const { ctx, made, voice } = setup(t);
    const speaking = voice.speak('hello');
    await tick(); await tick();
    made[0].flushed();                          // Flushed with nothing before it
    await assert.rejects(speaking, /no audio/i);
    assert.equal(ctx.scheduled.length, 0);
});
