/* The Azure hearing backend (app/js/stt-azure.js).
 *
 * WHAT IS WORTH TESTING HERE, and it is not evenly spread. The audio maths fails
 * SILENTLY — a wrong byte order, a wrong header field or a wrong resampling ratio
 * does not throw, it produces a file the service accepts and mis-hears, which reaches
 * the user as "the transcription is bad" rather than as an error, and sends whoever
 * investigates it looking at the service instead of at us.
 *
 * And then one test drives the WHOLE MODULE: real audio frames in, through the voice
 * gate, the resampler, the WAV encoder and the request, and a real Azure-shaped
 * answer back out as transcript text. Per the standing rule in CLAUDE.md, three tests
 * that each cover one link do not add up to testing the path — somewhere one check has
 * to take the previous layer's output as its input.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as azure from '../app/js/stt-azure.js';

/* --- the WAV header: wrong here is mis-heard, not refused ----------------- */

function readHeader(wav) {
    const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    return {
        riff: tag(0),
        wave: tag(8),
        fmt: tag(12),
        format: dv.getUint16(20, true),
        channels: dv.getUint16(22, true),
        rate: dv.getUint32(24, true),
        byteRate: dv.getUint32(28, true),
        blockAlign: dv.getUint16(32, true),
        bits: dv.getUint16(34, true),
        data: tag(36),
        dataLength: dv.getUint32(40, true),
        riffLength: dv.getUint32(4, true),
    };
}

test('the WAV header describes 16 kHz 16-bit mono exactly', () => {
    // Byte rate and block align are the two that matter most: getting either wrong
    // changes the playback speed, and therefore the pitch, of every word — which a
    // recognizer hears as a different person saying different words.
    const h = readHeader(azure.encodeWav(new Int16Array(100), 16000));
    assert.equal(h.riff, 'RIFF');
    assert.equal(h.wave, 'WAVE');
    assert.equal(h.fmt, 'fmt ');
    assert.equal(h.format, 1, 'uncompressed PCM');
    assert.equal(h.channels, 1);
    assert.equal(h.rate, 16000);
    assert.equal(h.byteRate, 32000, '16000 samples a second at two bytes each');
    assert.equal(h.blockAlign, 2);
    assert.equal(h.bits, 16);
});

test('the declared lengths match the bytes actually present', () => {
    // A length that overstates the data is the classic way to get a file that decodes
    // to the right words followed by a burst of noise.
    const wav = azure.encodeWav(new Int16Array(500), 16000);
    const h = readHeader(wav);
    assert.equal(wav.length, 44 + 1000);
    assert.equal(h.dataLength, 1000);
    assert.equal(h.riffLength, 36 + 1000, 'RIFF size counts everything after the first 8 bytes');
});

test('samples are written little-endian, as the header promises', () => {
    const wav = azure.encodeWav(Int16Array.from([1, -1, 256]), 16000);
    const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    assert.equal(dv.getInt16(44, true), 1);
    assert.equal(dv.getInt16(46, true), -1);
    assert.equal(dv.getInt16(48, true), 256);
});

/* --- conversion --------------------------------------------------------- */

test('full scale converts without wrapping to the opposite sign', () => {
    // +1 mapped through 0x8000 would come out as -32768: a single sample at the wrong
    // extreme, heard as a click on every loud syllable.
    const out = azure.floatToPcm16(Float32Array.from([0, 1, -1, 0.5, 2, -2]));
    assert.equal(out[0], 0);
    assert.equal(out[1], 32767);
    assert.equal(out[2], -32768);
    assert.ok(Math.abs(out[3] - 16383) <= 1);
    assert.equal(out[4], 32767, 'values above the range are clamped, not wrapped');
    assert.equal(out[5], -32768);
});

test('downsampling averages rather than picking one sample', () => {
    // Point sampling aliases, and for speech that means high frequencies folding down
    // into the range the recognizer is listening to — heard as consonants nobody said.
    const input = Float32Array.from([0, 1, 0, 1, 0, 1, 0, 1]);
    const out = azure.downsample(input, 32000, 16000);
    assert.equal(out.length, 4);
    for (const s of out) assert.equal(s, 0.5, 'each output is the mean of its two inputs');
});

test('downsampling from the common capture rates gives the expected length', () => {
    assert.equal(azure.downsample(new Float32Array(48000), 48000, 16000).length, 16000);
    assert.equal(azure.downsample(new Float32Array(44100), 44100, 16000).length, 16000);
    // Already at the target rate: copied, not resampled.
    assert.equal(azure.downsample(new Float32Array(16000), 16000, 16000).length, 16000);
    assert.equal(azure.downsample(new Float32Array(0), 48000, 16000).length, 0);
});

/* --- reading the answer -------------------------------------------------- */

test('silence is EMPTY TEXT, never an error', () => {
    // This is the load-bearing one. An error is fatal for the whole listening session
    // — it clears the intent so nothing retries into the same failure — so reporting
    // "no speech found" as an error would switch the microphone off mid-conversation
    // every time the gate opened on a cough or a door.
    for (const status of ['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout']) {
        const r = azure.readRecognition({ RecognitionStatus: status });
        assert.equal(r.text, '');
        assert.equal(r.error, undefined, `${status} must not be an error`);
    }
});

test('a successful answer yields the formatted text', () => {
    const r = azure.readRecognition({ RecognitionStatus: 'Success', DisplayText: 'How are you today?' });
    assert.equal(r.text, 'How are you today?');
    assert.equal(r.error, undefined);
});

test('a genuine service-side failure IS reported', () => {
    const r = azure.readRecognition({ RecognitionStatus: 'Error' });
    assert.equal(r.text, '');
    assert.ok(r.error);
});

test('an unreadable answer is reported rather than treated as silence', () => {
    // Returning empty text here would make a broken response indistinguishable from
    // the partner saying nothing, which is the failure that cannot be diagnosed later.
    assert.ok(azure.readRecognition(null).error);
    assert.ok(azure.readRecognition('nonsense').error);
});

/* --- the address --------------------------------------------------------- */

test('the region builds the address and the language is carried', () => {
    const url = azure.recognitionUrl('westeurope', 'en-GB');
    assert.match(url, /^https:\/\/westeurope\.stt\.speech\.microsoft\.com/);
    assert.match(url, /language=en-GB/);
    assert.match(azure.recognitionUrl(''), /^https:\/\/eastus\./, 'a blank region falls back');
});

test('a refusal names the region, because that is the likely cause', () => {
    assert.match(azure.describeFailure(401, 'japaneast'), /japaneast/);
});

/* --- the whole module ---------------------------------------------------- */

/*
 * Stand-ins for the browser's audio plumbing. The processor is the interesting one:
 * the real thing calls back with a buffer it REUSES, which is why the module copies
 * each frame — so this fake reuses one buffer too. A fake that handed over a fresh
 * array each time would let a missing copy pass.
 */
function fakeAudioWorld(sampleRate = 48000) {
    const shared = new Float32Array(4096);
    let processor = null;
    // ⚠ A CONTROLLED CLOCK, because the gate closes on ELAPSED TIME and every frame
    // pushed in a loop otherwise lands in the same millisecond — so the gate never
    // closes, nothing is ever submitted, and the test fails in a way that looks like
    // the module not working. Each frame advances the clock by its own real duration,
    // which is also what makes the billed figure meaningful.
    const frameMs = (4096 / sampleRate) * 1000;
    let clock = 1_000_000;
    const realNow = Date.now;
    const ctx = {
        state: 'running',
        sampleRate,
        resume: async () => {},
        close: async () => {},
        createMediaStreamSource: () => ({ connect() {} }),
        createGain: () => ({ gain: { value: 1 }, connect: (n) => n }),
        createScriptProcessor: () => {
            processor = { onaudioprocess: null, connect: (n) => n, disconnect() {} };
            return processor;
        },
        destination: {},
    };
    return {
        install() {
            globalThis.window.AudioContext = function () { return ctx; };
            // ⚠ defineProperty, not assignment: `navigator` is a getter-only global in
            // Node 21+, so `globalThis.navigator = …` throws rather than shimming.
            Object.defineProperty(globalThis, 'navigator', {
                value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
                configurable: true,
            });
        },
        // Push one frame of audio at `level` (0 is silence, 0.3 is speech), advancing
        // the clock by one frame's worth of time.
        frame(level) {
            shared.fill(level);
            clock += frameMs;
            Date.now = () => clock;
            processor.onaudioprocess({ inputBuffer: { getChannelData: () => shared } });
        },
        restore() { Date.now = realNow; },
        hasProcessor: () => !!processor,
    };
}

test('END TO END: speech in, a real request out, transcript text back', async () => {
    const world = fakeAudioWorld(48000);
    const realFetch = globalThis.fetch;
    const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const realAudio = globalThis.window.AudioContext;
    world.install();

    const requests = [];
    globalThis.fetch = async (url, init) => {
        requests.push({ url, init });
        return { ok: true, status: 200, json: async () => ({ RecognitionStatus: 'Success', DisplayText: 'Hello there.' }) };
    };

    const heard = [];
    const statuses = [];
    let billed = 0;
    try {
        const src = azure.createSource({
            getKey: () => 'the-key',
            getRegion: () => 'uksouth',
            onText: (text, isFinal) => heard.push([text, isFinal]),
            onStatus: (s) => statuses.push(s),
            onBilled: (secs) => { billed = secs; },
        });
        assert.equal(await src.start(), true, 'capture started');
        assert.ok(world.hasProcessor(), 'the audio graph was built');

        // A stretch of speech, then enough silence for the gate to close. Real frames
        // through the real gate — nothing here fabricates a "span".
        // ~2.5s of speech, then enough silent frames to pass the hang time. Real
        // frames through the real gate — nothing here fabricates a "span".
        for (let i = 0; i < 30; i++) world.frame(0.3);
        for (let i = 0; i < 12; i++) world.frame(0);
        await new Promise((r) => setTimeout(r, 20));

        assert.ok(requests.length >= 1, 'a phrase was submitted');
        const { url, init } = requests[0];
        // The region reached the address, and the key the header.
        assert.match(url, /^https:\/\/uksouth\.stt\.speech\.microsoft\.com/);
        assert.equal(init.headers['Ocp-Apim-Subscription-Key'], 'the-key');
        // The body is a real WAV at the rate the header claims, resampled down from
        // the 48 kHz the fake microphone produced.
        assert.match(init.headers['Content-Type'], /samplerate=16000/);
        const h = readHeader(init.body);
        assert.equal(h.riff, 'RIFF');
        assert.equal(h.rate, 16000);
        assert.equal(h.dataLength, init.body.length - 44, 'the header agrees with the bytes');
        assert.ok(h.dataLength > 0, 'actual audio was sent, not an empty span');

        // And the service's answer came back out as transcript text.
        assert.deepEqual(heard, [['Hello there.', true]]);
        assert.ok(billed > 0, 'the audio submitted was counted');
        assert.ok(statuses.includes('listening') && statuses.includes('capturing'));
        src.stop();
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        world.restore();
        if (realNav) Object.defineProperty(globalThis, 'navigator', realNav);
    }
});

test('END TO END: silence alone submits nothing and bills nothing', async () => {
    // The whole cost argument for the gate. If quiet audio were submitted, a visit
    // that is mostly listening would be billed for the sitting as well as the talking.
    const world = fakeAudioWorld(48000);
    const realFetch = globalThis.fetch;
    const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const realAudio = globalThis.window.AudioContext;
    world.install();
    const requests = [];
    globalThis.fetch = async (url, init) => { requests.push({ url, init }); return { ok: true, json: async () => ({}) }; };
    try {
        const src = azure.createSource({
            getKey: () => 'k', getRegion: () => 'eastus',
            onText: () => {}, onStatus: () => {}, onBilled: () => {},
        });
        await src.start();
        for (let i = 0; i < 60; i++) world.frame(0);
        await new Promise((r) => setTimeout(r, 20));
        assert.equal(requests.length, 0, 'nothing was sent');
        assert.equal(src.billedSeconds(), 0, 'and nothing was billed');
        src.stop();
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        world.restore();
        if (realNav) Object.defineProperty(globalThis, 'navigator', realNav);
    }
});

test('a transport failure is a WARNING, so listening survives it', async () => {
    // An error would clear the listening intent and switch the microphone off for the
    // rest of the session. That is right for a rejected key and wrong for one request
    // that timed out on a flaky connection, where the next phrase would have worked —
    // turning a hiccup into the end of the conversation.
    const world = fakeAudioWorld(48000);
    const realFetch = globalThis.fetch;
    const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const realAudio = globalThis.window.AudioContext;
    world.install();
    globalThis.fetch = async () => { throw new Error('network down'); };
    const statuses = [];
    try {
        const src = azure.createSource({
            getKey: () => 'k', getRegion: () => 'eastus',
            onText: () => {}, onStatus: (s, d) => statuses.push([s, d]), onBilled: () => {},
        });
        await src.start();
        for (let i = 0; i < 30; i++) world.frame(0.3);
        for (let i = 0; i < 12; i++) world.frame(0);
        await new Promise((r) => setTimeout(r, 20));
        assert.ok(statuses.some(([s]) => s === 'warning'), 'reported as recoverable');
        assert.ok(!statuses.some(([s]) => s === 'error'), 'and NOT as fatal');
        assert.equal(src.isRunning(), true, 'capture is still running');
        src.stop();
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        world.restore();
        if (realNav) Object.defineProperty(globalThis, 'navigator', realNav);
    }
});

test('starting with no key reports it and does not open the microphone', async () => {
    const statuses = [];
    const src = azure.createSource({
        getKey: () => '', getRegion: () => 'eastus',
        onText: () => {}, onStatus: (s, d) => statuses.push([s, d]), onBilled: () => {},
    });
    assert.equal(await src.start(), false);
    assert.deepEqual(statuses, [['error', 'no-key']]);
});
