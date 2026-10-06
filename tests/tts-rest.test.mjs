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

/* ── the voice crossover (Ken's report, September 30 2026) ──────────────── */

/*
 * ⚠ THE BUG. A caller handed the OpenAI voice slot a DEEPGRAM voice id, and OpenAI
 * refused every utterance: "Invalid value: 'aura-2-thalia-en'". It ran for weeks
 * because the Settings Test button computes the voice itself, so it tested a
 * combination the app never actually sent.
 *
 * The guard refuses only what it can PROVE belongs elsewhere, so a voice nobody claims
 * still gets through - Azure's are fetched rather than listed, and these services can
 * return voices the starter list does not carry.
 */
test('a voice belonging to another service is refused, not sent', () => {
    tts.setPaidVoice('openai', 'alloy');
    tts.setPaidVoice('openai', 'aura-2-thalia-en');      // Deepgram's
    assert.equal(tts.getPaidVoice('openai'), 'alloy', "OpenAI kept its own voice");

    tts.setPaidVoice('deepgram', 'aura-2-thalia-en');    // its own - allowed
    assert.equal(tts.getPaidVoice('deepgram'), 'aura-2-thalia-en');
});

test('an Azure voice is refused for another service (CR-194)', () => {
    tts.setPaidVoice('google', 'en-US-Neural2-F');
    const before = tts.getPaidVoice('google');
    tts.setPaidVoice('google', 'en-US-JennyNeural');     // Azure's
    assert.equal(tts.getPaidVoice('google'), before, 'Google kept its own voice');
    tts.setPaidVoice('azure', 'en-US-JennyNeural');      // its own - allowed
    assert.equal(tts.getPaidVoice('azure'), 'en-US-JennyNeural');
});

test('the same guard covers the provider switch, which is how it got in', () => {
    // setProvider used to write opts.model straight into the table, bypassing every
    // check. This is the exact call app.js was making.
    tts.setPaidVoice('openai', 'echo');
    tts.setProvider('openai', { model: 'aura-2-thalia-en', getKey: () => 'k' });
    assert.equal(tts.getPaidVoice('openai'), 'echo', 'the crossover was refused here too');
    tts.setProvider('builtin');
});

test('a voice no service claims is still allowed through', () => {
    // Azure's voices are fetched, and a service can offer more than the starter list.
    // A guard that refused anything unrecognized would be the larger, quieter failure.
    tts.setPaidVoice('azure', 'en-GB-SoniaNeural');
    assert.equal(tts.getPaidVoice('azure'), 'en-GB-SoniaNeural');
    tts.setPaidVoice('openai', 'some-voice-added-after-this-was-written');
    assert.equal(tts.getPaidVoice('openai'), 'some-voice-added-after-this-was-written');
});

/*
 * ⚠ THE DECISION LIVES IN app.js, WHICH NO TEST CAN LOAD, so the decision is asserted
 * instead - the same precedent as the placeholder guards.
 *
 * The fault was an `if (x === 'azure') … else <deepgram>` written when there were two
 * paid services. Three more arrived and every one of them took the else branch, so
 * OpenAI, Google Cloud and ElevenLabs were each handed Deepgram's voice and Deepgram's
 * key. A lookup here must decide by naming the service, never by exclusion.
 */
test('the voice and key lookups name every service rather than guessing', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(new URL('../app/js/app.js', import.meta.url), 'utf8');

    const fn = (name) => {
        const at = src.indexOf(`function ${name}(`);
        assert.ok(at > 0, `${name} must still exist`);
        return src.slice(at, at + 900);
    };

    for (const name of ['paidVoiceFor', 'serviceKeyFor']) {
        const body = fn(name);
        assert.ok(/TTS_PROVIDERS\[/.test(body),
            `${name} must consult the catalog, so a new service is not silently routed to another`);
        assert.ok(/'deepgram'/.test(body),
            `${name} must name deepgram rather than leaving it as the fallback`);
    }

    // And the one that actually broke: a bare Aura fallback as the last word of the
    // voice lookup is what sent a Deepgram voice id to OpenAI.
    assert.ok(!/return storage\.loadAuraVoice\(\) \|\| ttsDeepgram\.DEFAULT_VOICE;\s*\}/.test(fn('paidVoiceFor')),
        'the voice lookup must not end in an unconditional Deepgram fallback');
});
