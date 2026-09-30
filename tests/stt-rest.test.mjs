/* Tier 2 — the REST hearing path (app/js/stt-rest.js), driven through real audio.
 *
 * ⚠ WHY THIS FILE EXISTS. Ken's September 30 2026 report showed a hearing service that
 * was selected, never worked, and never said so: the app kept listening, transcribed
 * nothing and logged nothing, so the microphone stayed lit while his partner talked
 * into it. That is the worst failure this app has, because it looks exactly like
 * working. These tests cover the line between one bad moment and a broken setup.
 *
 * Frames go through the real voice gate at a controlled clock, the same arrangement
 * stt-azure.test.mjs uses — nothing here fabricates a span or a submission.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSource } from '../app/js/stt-rest.js';
import { STT_PROVIDERS } from '../app/js/speech-catalog.js';

function fakeAudioWorld(sampleRate = 48000) {
    const shared = new Float32Array(4096);
    let processor = null;
    // ⚠ A CONTROLLED CLOCK. The gate closes on ELAPSED time, so frames pushed in a
    // loop otherwise all land in the same millisecond, the gate never closes, nothing
    // is submitted, and the test fails in a way that looks like the module not working.
    const frameMs = (4096 / sampleRate) * 1000;
    let clock = 1_000_000;
    const realNow = Date.now;
    const ctx = {
        state: 'running',
        sampleRate,
        resume: async () => {},
        close: async () => {},
        createMediaStreamSource: () => ({ connect() {} }),
        createScriptProcessor: () => {
            processor = { onaudioprocess: null, connect: (n) => n, disconnect() {} };
            return processor;
        },
        destination: {},
    };
    return {
        install() {
            globalThis.window.AudioContext = function () { return ctx; };
            // ⚠ defineProperty, not assignment: navigator is getter-only in Node 21+.
            Object.defineProperty(globalThis, 'navigator', {
                value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } },
                configurable: true,
            });
        },
        frame(level) {
            shared.fill(level);
            clock += frameMs;
            Date.now = () => clock;
            processor.onaudioprocess({ inputBuffer: { getChannelData: () => shared } });
        },
        restore() { Date.now = realNow; },
    };
}

/** One phrase: speech, then enough silence for the gate to close and submit. */
async function sayOnePhrase(world) {
    for (let i = 0; i < 30; i++) world.frame(0.3);
    for (let i = 0; i < 12; i++) world.frame(0);
    await new Promise((r) => setTimeout(r, 20));
}

/**
 * Speak `count` phrases at a source whose service answers with `reply(n)`, and return
 * every status it reported.
 */
async function phrasesAgainst(count, reply) {
    const world = fakeAudioWorld();
    const realFetch = globalThis.fetch;
    const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const realAudio = globalThis.window.AudioContext;
    world.install();
    let n = 0;
    globalThis.fetch = async () => reply(n++);
    const statuses = [];
    const heard = [];
    try {
        const src = createSource({
            provider: STT_PROVIDERS.openai,
            getKey: () => 'the-key',
            getModel: () => 'gpt-4o-transcribe',
            onText: (t) => heard.push(t),
            onStatus: (s, detail) => statuses.push([s, detail]),
        });
        await src.start();
        for (let i = 0; i < count; i++) await sayOnePhrase(world);
        src.stop();
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        world.restore();
        if (realNav) Object.defineProperty(globalThis, 'navigator', realNav);
    }
    return { statuses, heard };
}

const refuse = () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: { message: 'that model is not available' } }),
});
const accept = (text) => ({ ok: true, status: 200, json: async () => ({ text }) });

/*
 * ⚠ THE FAILURE KEN HIT. Every request refused, and the app went on listening forever
 * with nothing anywhere reporting it. Only a RUN of failures decides: a phrase is sent
 * at each pause in the partner's speech, so three in a row means the partner has said
 * three things and nothing has appeared.
 */
test('a service that refuses everything is reported, not tolerated forever', async () => {
    const { statuses } = await phrasesAgainst(3, refuse);
    const kinds = statuses.map(([s]) => s);
    assert.equal(kinds.filter((s) => s === 'error').length, 1, 'exactly one error is raised');
    assert.ok(kinds.indexOf('warning') < kinds.indexOf('error'),
        'the first failures are tolerated, the run is not');
    const error = statuses.find(([s]) => s === 'error');
    assert.match(error[1], /that model is not available/,
        "and it carries the service's own reason");
});

test('one bad moment is still tolerated', async () => {
    const { statuses } = await phrasesAgainst(2, refuse);
    assert.ok(!statuses.some(([s]) => s === 'error'),
        'two failures must not stop listening - a flaky connection recovers');
    assert.ok(statuses.some(([s]) => s === 'warning'));
});

/*
 * A success resets the count, so a connection that drops a phrase now and then never
 * accumulates its way to a false verdict.
 */
test('a phrase that works clears the tally', async () => {
    const { statuses, heard } = await phrasesAgainst(5, (n) =>
        (n === 2 ? accept('it worked') : refuse()));
    assert.deepEqual(heard, ['it worked']);
    assert.ok(!statuses.some(([s]) => s === 'error'),
        'two failures, a success, then two more is not a broken setup');
});

/* A rejected key still fails at once: it will fail identically every time. */
test('a rejected key is fatal immediately, without waiting for a run', async () => {
    const { statuses } = await phrasesAgainst(1, () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Incorrect API key provided' } }),
    }));
    const error = statuses.find(([s]) => s === 'error');
    assert.ok(error, 'one refusal of the key is enough');
    assert.match(error[1], /did not accept the key/);
});

/* The ordinary path still works, and the words come back out. */
test('a working service transcribes, and says nothing alarming', async () => {
    const { statuses, heard } = await phrasesAgainst(3, () => accept('hello there'));
    assert.deepEqual(heard, ['hello there', 'hello there', 'hello there']);
    assert.ok(!statuses.some(([s]) => s === 'error' || s === 'warning'));
});
