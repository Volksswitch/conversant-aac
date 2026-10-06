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

/*
 * Source with its comments removed.
 *
 * ⚠ WITHOUT THIS A SOURCE-LEVEL CHECK PASSES ON THE COMMENT THAT EXPLAINS THE FIX
 * rather than on the code that is the fix. It happened while writing the status check
 * below: the comment naming 'idle' satisfied the assertion, so the test went green
 * against a handler deliberately broken to prove it would not.
 */
function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n');
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

/*
 * ⚠ A CLICK IS NOT A WORD, AND THESE SERVICES INVENT ONE FROM IT.
 *
 * Ken's report of September 30 2026 carries a partner turn reading "Katarzyna." in a
 * conversation where the partner had said nothing at all. Transcription models of this
 * family produce confident text from near-silence rather than returning nothing, and a
 * name from nowhere recorded as something a real person said is a serious failure in a
 * product whose premise is that the transcript can be trusted enough to answer.
 *
 * ⚠ THE MEASURE IS HOW LONG THE GATE WAS OPEN, NOT HOW MUCH AUDIO THERE IS. Every span
 * carries 1200ms of pre-roll and 450ms of hang time, so even a door closing produces
 * over a second of audio and a length test would let everything through.
 */
test('a brief noise is not sent to be transcribed', async () => {
    const world = fakeAudioWorld();
    const realFetch = globalThis.fetch;
    const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const realAudio = globalThis.window.AudioContext;
    world.install();
    const sent = [];
    globalThis.fetch = async () => { sent.push(1); return accept('a name from nowhere'); };
    const heard = [];
    try {
        const src = createSource({
            provider: STT_PROVIDERS.openai,
            getKey: () => 'the-key',
            getModel: () => 'gpt-4o-transcribe',
            onText: (t) => heard.push(t),
            onStatus: () => {},
        });
        await src.start();
        // One frame of sound - about 85ms at this rate - then silence. That is a tap or
        // a door, not a word.
        world.frame(0.3);
        for (let i = 0; i < 12; i++) world.frame(0);
        await new Promise((r) => setTimeout(r, 20));
        assert.equal(sent.length, 0, 'nothing was submitted for a click');
        assert.deepEqual(heard, [], 'and no words were invented from it');

        // And a real utterance still goes through, so the floor is not simply deafness.
        await sayOnePhrase(world);
        assert.equal(sent.length, 1, 'genuine speech is still submitted');
        src.stop();
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        world.restore();
        if (realNav) Object.defineProperty(globalThis, 'navigator', realNav);
    }
});

/*
 * ⚠ AN ORDINARY STOP WAS LOGGED AS AN ERROR. The phrase-at-a-time sources report
 * 'idle' when they stop, and app.js only knew 'stopped' - so every normal stop on
 * those services wrote `unknown status "idle"` to the error log, which trips the
 * transcript's red wash. The app was telling the user something had gone wrong at the
 * moment nothing had. Asserted at the source, because app.js cannot be loaded here.
 */
test('the status this source reports on stopping is one the app knows', async () => {
    const { readFile } = await import('node:fs/promises');
    const app = await readFile(new URL('../app/js/app.js', import.meta.url), 'utf8');
    const at = app.indexOf('function handleSttStatus(');
    assert.ok(at > 0, 'handleSttStatus must still exist');
    // ⚠ COMMENTS STRIPPED FIRST. Without this the check passes on the comment that
    // EXPLAINS the fix rather than on the code that is the fix - which is exactly what
    // happened when this test was written, and it went green against a deliberately
    // broken handler.
    const body = stripComments(app.slice(at, app.indexOf('\n}\n', at)));

    // Every status this module can emit has to be one the handler accounts for, or it
    // is logged as an error. Read them out of this file rather than listing them here,
    // so a new one cannot be added without this noticing.
    const src = await readFile(new URL('../app/js/stt-rest.js', import.meta.url), 'utf8');
    const emitted = new Set([...src.matchAll(/onStatus\(\s*'([a-z]+)'/g)].map((m) => m[1]));
    assert.ok(emitted.size >= 4, `expected several statuses, found ${[...emitted]}`);
    for (const status of emitted) {
        assert.ok(body.includes(`'${status}'`),
            `handleSttStatus does not account for "${status}", so it is logged as an error`);
    }
});

/*
 * CR-002. At startup the app decides whether a paid hearing service is usable by
 * looking up its key - and that lookup knew only Deepgram and Azure, so OpenAI,
 * Google Cloud and ElevenLabs hearing quietly fell back to the browser on every
 * launch while Settings still showed the paid choice. app.js cannot be loaded here,
 * so the real helper is lifted out of the source and run against the real storage.
 */
test('the startup hearing check finds a key for every paid hearing service', async () => {
    const { readFile } = await import('node:fs/promises');
    const storage = await import('../app/js/storage.js');
    const app = await readFile(new URL('../app/js/app.js', import.meta.url), 'utf8');
    const at = app.indexOf('function sttKeyFor(');
    assert.ok(at > 0, 'sttKeyFor must exist');
    const end = app.slice(at).search(/\r?\n\}\r?\n/);   // the file may be CRLF
    const src = app.slice(at, at + end) + '\n}';
    const sttKeyFor = new Function('storage', 'STT_PROVIDERS', `${src}; return sttKeyFor;`)(storage, STT_PROVIDERS);

    storage.saveDeepgramKey('dg-key');
    storage.saveAzureKey('az-key');
    for (const id of Object.keys(STT_PROVIDERS)) storage.saveServiceKey(id, `${id}-key`);
    assert.equal(sttKeyFor('deepgram'), 'dg-key');
    assert.equal(sttKeyFor('azure'), 'az-key');
    for (const id of Object.keys(STT_PROVIDERS)) {
        assert.equal(sttKeyFor(id), `${id}-key`, `${id} hearing must be found at startup`);
    }
    assert.equal(sttKeyFor('builtin'), '', 'the free recognizer needs no key');

    // And the startup decision really uses it, rather than a list of its own.
    const init = stripComments(app.slice(app.indexOf('const sttProvider = storage.loadSttProvider();'),
        app.indexOf('const speechSupport = platform.speechRecognitionSupport();')));
    assert.match(init, /usingPaidStt\s*=.*sttKeyFor\(sttProvider\)/);
});

/*
 * CR-007. A fatal error from a paid source used to leave it running: the microphone
 * stayed open, phrases kept being submitted, and the next Listen tap found it
 * "already running" and lit the button on a source that could not hear. Driven
 * through stt.js, which is where the teardown now happens.
 */
test('a fatal error shuts the paid source down, so nothing more is sent', async () => {
    const world = fakeAudioWorld();
    const realFetch = globalThis.fetch;
    const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const realAudio = globalThis.window.AudioContext;
    world.install();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return refuse(); };
    const statuses = [];
    try {
        const stt = await import('../app/js/stt.js?cr007=' + Date.now());
        stt.init({
            onResult() {}, onSilence() {}, onPartnerSpeech() {},
            onStatus: (s) => statuses.push(s),
            source: 'openai',
            getRestKey: () => 'the-key',
            getRestModel: () => 'gpt-4o-transcribe',
        });
        stt.startListening();
        await new Promise((r) => setTimeout(r, 10));
        for (let i = 0; i < 3; i++) await sayOnePhrase(world);
        assert.equal(statuses.at(-1), 'error', 'the last thing the app hears is the error');
        assert.ok(statuses.includes('idle'), 'the source was stopped on the way');
        const before = calls;
        await sayOnePhrase(world);
        assert.equal(calls, before, 'a stopped source submits nothing more');
    } finally {
        globalThis.fetch = realFetch;
        globalThis.window.AudioContext = realAudio;
        world.restore();
        if (realNav) Object.defineProperty(globalThis, 'navigator', realNav);
    }
});

// CR-037. Switching to the device's recognizer where the browser has none must be
// refused, leaving the paid source that works in place.
test('switching to a recognizer the browser does not have is refused, not thrown', async () => {
    const savedSR = globalThis.window.SpeechRecognition;
    const savedWSR = globalThis.window.webkitSpeechRecognition;
    try {
        const stt = await import('../app/js/stt.js?cr037=' + Date.now());
        stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {}, source: 'openai',
            getRestKey: () => 'k', getRestModel: () => 'm' });
        delete globalThis.window.SpeechRecognition;
        delete globalThis.window.webkitSpeechRecognition;
        assert.equal(stt.setSource('builtin'), false);
        assert.equal(stt.currentSource(), 'openai');
    } finally {
        globalThis.window.SpeechRecognition = savedSR;
        if (savedWSR) globalThis.window.webkitSpeechRecognition = savedWSR;
    }
});
