/* Tier 2 — the REST voice path, driven end to end (app/js/tts-rest.js).
 *
 * These drive the real public entry point, tts.speak, with a stubbed network and audio
 * context. Nothing below hands a fabricated request to the layer under test: the
 * provider is wired the way app.js wires it, and what is asserted is what came out the
 * far end.
 *
 * ⚠ WHY THIS FILE EXISTS. On September 30 2026 Ken's OpenAI voice was refused on every
 * utterance while his key was demonstrably fine, and the app reported it as "usually
 * that means the key is wrong". The service had said exactly what was wrong and the app
 * read the explanation only to throw it away. These tests cover the path that carries
 * it, and the two things that made the failure hard to place.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tts from '../app/js/tts.js';

function fakeAudio() {
    return {
        state: 'running',
        currentTime: 0,
        resume: async () => {},
        decodeAudioData: async () => ({ duration: 1 }),
        createBufferSource: () => ({
            buffer: null,
            connect() {},
            start() { setTimeout(() => this.onended && this.onended(), 0); },
            stop() {},
            onended: null,
        }),
        destination: {},
    };
}

/** Speak one phrase through a provider whose service answers with `reply`. */
async function speakAgainst(reply, { voice = 'alloy', model = 'gpt-4o-mini-tts' } = {}) {
    const realFetch = globalThis.fetch;
    const realAudio = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fakeAudio(); };
    globalThis.fetch = async () => reply;
    let reported = null;
    try {
        tts.onFallbackToBrowser((msg) => { reported = msg; });
        tts.setProvider('openai', { getKey: () => 'a-key', getModel: () => model });
        tts.setPaidVoice('openai', voice);
        await tts.speak('hello there');
        return reported;
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        tts.onFallbackToBrowser(null);
        tts.setProvider('builtin');
    }
}

/*
 * ⚠ THE FAILURE THAT PROMPTED ALL OF THIS.
 *
 * The service says precisely what it did not like. Replacing that with a guess about
 * the key sends somebody to rebuild a credential that was never the problem, which is
 * the hour this test exists to save.
 */
test('a refused utterance reports what the service actually said', async () => {
    const reported = await speakAgainst({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
            error: { message: "Invalid value: 'nova'. Supported values are: 'alloy', 'echo'." },
        }),
    });
    assert.ok(reported, 'the downgrade was reported');
    assert.match(reported, /Invalid value: 'nova'/, 'the real reason reaches the user');
    assert.match(reported, /OpenAI said:/, 'and is attributed to the service');
});

/*
 * ⚠ THE SETTINGS TEST AND A LIVE UTTERANCE REACH THE SERVICE BY DIFFERENT ROUTES.
 *
 * The Test button uses a voice and model worked out on screen; an utterance uses the
 * stored pair. When the two disagree, Test passes and every real sentence is refused,
 * which is exactly the shape of Ken's report. Naming the pair in the message is what
 * makes the two distinguishable at a glance.
 */
test('a refused utterance names the voice and model it was refused for', async () => {
    const reported = await speakAgainst(
        { ok: false, status: 400, text: async () => '{}' },
        { voice: 'shimmer', model: 'gpt-4o-mini-tts' },
    );
    assert.match(reported, /voice shimmer/);
    assert.match(reported, /model gpt-4o-mini-tts/);
});

/*
 * The user pressing a button and hearing nothing is the one outcome that is never
 * acceptable, so a refusal still speaks - in the device's voice, and it is recorded.
 */
test('a refusal still speaks, and the turn records the downgrade', async () => {
    await speakAgainst({ ok: false, status: 400, text: async () => '{}' });
    const used = tts.lastVoiceUsed();
    assert.equal(used.provider, 'browser');
    assert.equal(used.fellBack, true);
});

/*
 * ⚠ READING THE EXPLANATION MUST NEVER BECOME THE FAILURE. A body can be absent,
 * already consumed, or a stream that errors. Throwing while trying to say why
 * something failed would replace a clear reason with an unrelated one.
 */
test('a body that cannot be read leaves the reason intact', async () => {
    const reported = await speakAgainst({
        ok: false,
        status: 401,
        text: async () => { throw new Error('stream already consumed'); },
    });
    assert.match(reported, /did not accept the key/);
    assert.ok(!reported.includes('stream already consumed'),
        'the reading failure must not become the reported reason');
});

/*
 * ⚠ A KEY MUST NEVER RIDE OUT IN AN ERROR MESSAGE. This one travels to the error log,
 * the saved conversation, the problem report and the weekly report.
 */
test('a key quoted back by the service never reaches the message', async () => {
    const reported = await speakAgainst({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({
            error: { message: 'Incorrect API key provided: sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' },
        }),
    });
    assert.ok(!reported.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 'the key leaked');
    assert.match(reported, /<key removed>/);
});

/* The ordinary path still works, and the voice and key reach the request. */
test('an accepted utterance sends the chosen voice and key', async () => {
    const calls = [];
    const realFetch = globalThis.fetch;
    const realAudio = globalThis.window.AudioContext;
    globalThis.window.AudioContext = function () { return fakeAudio(); };
    globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200, blob: async () => ({ arrayBuffer: async () => new ArrayBuffer(64) }) };
    };
    try {
        tts.setProvider('openai', { getKey: () => 'the-key', getModel: () => 'gpt-4o-mini-tts' });
        tts.setPaidVoice('openai', 'echo');
        await tts.speak('hello there');
        assert.equal(calls.length, 1, 'exactly one request went out');
        assert.match(calls[0].url, /^https:\/\/api\.openai\.com/);
        assert.equal(calls[0].init.headers.Authorization, 'Bearer the-key');
        const body = JSON.parse(calls[0].init.body);
        assert.equal(body.voice, 'echo');
        assert.equal(body.model, 'gpt-4o-mini-tts');
        assert.deepEqual(tts.lastVoiceUsed(), { provider: 'openai', voice: 'echo' });
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        tts.setProvider('builtin');
    }
});
