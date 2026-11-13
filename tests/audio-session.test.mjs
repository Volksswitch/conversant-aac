/* Tier 1 - telling an iPad what kind of sound the app is making (audio-session.js),
 * and that the shared listening code does it at the right moments.
 *
 * Ken's iPad, November 13 2026: the paid voice dropped to very quiet the moment paid
 * listening stopped, and stayed quiet until Listen was pressed again. The fix says
 * "playback" when listening stops and hands the choice back before it starts.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as audioSession from '../app/js/audio-session.js';

function withSession(session, fn) {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { ...(globalThis.navigator || {}), audioSession: session },
        configurable: true, writable: true,
    });
    try { fn(); } finally {
        if (real) Object.defineProperty(globalThis, 'navigator', real);
    }
}

test('an iPad is told "playback" when listening stops and "play-and-record" before it starts', () => {
    const s = { type: 'auto', state: 'active' };
    withSession(s, () => {
        audioSession.forSpeaking();
        assert.equal(s.type, 'playback');
        assert.match(audioSession.describe(), /^playback \(active\)$/);
        audioSession.forListening();
        assert.equal(s.type, 'play-and-record');
    });
});

test('a browser without the setting is left alone and nothing throws', () => {
    withSession(undefined, () => {
        audioSession.forSpeaking();
        audioSession.forListening();
        assert.equal(audioSession.describe(), 'not available here');
    });
    // One that refuses the value must not break listening either.
    const angry = { get type() { return 'auto'; }, set type(v) { throw new Error('no'); } };
    withSession(angry, () => {
        audioSession.forSpeaking();
        audioSession.forListening();
    });
});

// stt.js cannot be driven here with a real microphone, so its wiring is checked in
// the source: every place a paid source is stopped must also say "playback", and the
// place it is opened must say "auto" first. A stop with no switch is the bug coming
// back, silently, on one path.
test('the shared listening code switches the audio type at every paid stop and start', () => {
    const src = readFileSync(new URL('../app/js/stt.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const stops = src.match(/externalSource\.stop\(\)/g).length;
    const switches = src.match(/audioSession\.forSpeaking\(\)/g).length;
    // setSource() also stops a source while swapping providers; it is not a stop
    // between listening and speaking, so it is the one allowed exception.
    assert.equal(switches, stops - 1, `${stops} stops, ${switches} switches to playback`);
    assert.match(src, /audioSession\.forListening\(\);\s*externalSource\.start\(\)/);
});

// Call processing ON for every device, the iPad included (Ken, November 13 2026). It was
// off on an iPad from 0.15.3 to 0.15.8, and that made the microphone about 50 times
// quieter: Kenny's 0.15.8 report showed his wife, a couple of feet away, never above
// 0.0005 against a speech bar of 0.004, so nothing was heard. The platform is read once
// when platform.js loads and this run is not an iPad, so the source check is what stops
// a device-specific "off" coming back unnoticed (comments stripped: the explanation in
// audio-session.js names the old setting).
test('every device, the iPad included, asks for call processing', () => {
    assert.deepEqual(audioSession.micProcessing(),
        { echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    const src = readFileSync(new URL('../app/js/audio-session.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const name of ['echoCancellation', 'noiseSuppression', 'autoGainControl']) {
        assert.doesNotMatch(src, new RegExp(`${name}\\s*:\\s*false`), `${name} must not be turned off again`);
    }
});

test('every paid service opens the microphone through the one shared request', () => {
    for (const f of ['stt-deepgram.js', 'stt-azure.js', 'stt-rest.js']) {
        const src = readFileSync(new URL(`../app/js/${f}`, import.meta.url), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        assert.match(src, /stream = await audioSession\.openMic\(\)/, f);
        assert.doesNotMatch(src, /getUserMedia/, `${f} must not open the microphone itself`);
        assert.doesNotMatch(src, /echoCancellation/, `${f} must not set its own`);
    }
});

// THE x5 "LOUDER WHILE LISTENING" BOOST IS GONE (Ken, November 13 2026). It was sized
// for call processing off; with processing on again, a phrase played with the
// microphone open is at normal volume, so the boost only made those phrases too loud,
// and it could be left on with no microphone open (the November 13 findings, problem 4).
// Every paid voice plays straight to the speakers, at the volume the user set, on every
// device.
test('every paid voice plays straight to the speakers, with no boost', () => {
    for (const f of ['tts-deepgram.js', 'tts-azure.js', 'tts-rest.js']) {
        const src = readFileSync(new URL(`../app/js/${f}`, import.meta.url), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        assert.match(src, /node\.connect\(c\.destination\)/, f);
        assert.doesNotMatch(src, /createDynamicsCompressor|audioSession\.output/, `${f} must not boost the voice`);
    }
    assert.equal(audioSession.output, undefined, 'audio-session.js offers no boosted output');
    assert.equal(audioSession.LISTENING_BOOST, undefined);
});

// A failure to open the microphone is named, not lumped in with "permission refused"
// (Ken's iPad, 0.15.5: the first Listen failed as "not-allowed", the second worked).
test('a microphone failure says which kind it was', () => {
    assert.equal(audioSession.micFailure({ name: 'NotAllowedError', message: 'denied' }), 'not-allowed');
    assert.equal(audioSession.micFailure({ name: 'NotReadableError', message: 'Could not start audio source' }),
        'microphone failed (NotReadableError: Could not start audio source)');
    assert.equal(audioSession.micFailure(null), 'microphone failed (Error)');
});

// Ken's iPad, 0.15.6: the first Listen after launch failed with "AudioSession
// category is not compatible with audio capture", and a second one seconds later
// worked. openMic sets the recording mode again and tries once more.
test('a microphone refused for the audio mode is tried once more', async () => {
    const calls = [];
    const stream = { ok: true };
    const gum = async (c) => {
        calls.push(c);
        if (calls.length === 1) { const e = new Error('AudioSession category is not compatible'); e.name = 'InvalidStateError'; throw e; }
        return stream;
    };
    assert.equal(await audioSession.openMic(gum, async () => {}), stream);
    assert.equal(calls.length, 2);
});

test('a refused permission is not retried', async () => {
    let calls = 0;
    const gum = async () => { calls++; const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; };
    await assert.rejects(audioSession.openMic(gum, async () => {}), { name: 'NotAllowedError' });
    assert.equal(calls, 1, 'asking again would only show the permission prompt again');
});

// Ken's iPad, 0.15.7: the microphone icon showed, the Listen button stayed dark and
// nothing was heard - the listening audio was made after the tap was over and never
// woke. One listening context, woken inside the tap and kept.
test('a wake that never finishes gives up instead of hanging', async () => {
    const stuck = { state: 'suspended', resume: () => new Promise(() => {}) };
    const started = Date.now();
    assert.equal(await audioSession.wake(stuck, 50), false);
    assert.ok(Date.now() - started < 1000);
    const fine = { state: 'suspended', resume() { this.state = 'running'; return Promise.resolve(); } };
    assert.equal(await audioSession.wake(fine, 50), true);
});

test('the listening context is made once, woken by the tap, and reused', () => {
    const real = globalThis.window.AudioContext;
    let made = 0, resumed = 0;
    globalThis.window.AudioContext = class {
        constructor() { made++; this.state = 'suspended'; }
        resume() { resumed++; this.state = 'running'; return Promise.resolve(); }
    };
    try {
        audioSession.unlockCapture();                   // the Listen tap
        const a = audioSession.captureContext();
        assert.equal(a.state, 'running', 'woken inside the tap');
        assert.equal(audioSession.captureContext(), a, 'the same context every start');
        audioSession.unlockCapture();
        assert.equal(made, 1);
        assert.equal(resumed, 1, 'an awake context is not woken again');
    } finally { globalThis.window.AudioContext = real; }
});

test('no paid service makes its own listening context or closes the shared one', () => {
    for (const f of ['stt-deepgram.js', 'stt-azure.js', 'stt-rest.js']) {
        const src = readFileSync(new URL(`../app/js/${f}`, import.meta.url), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        assert.match(src, /audioCtx = audioSession\.captureContext\(\)/, f);
        assert.doesNotMatch(src, /audioCtx\.close\(\)/, `${f} must not close the shared context`);
    }
    const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
    assert.match(app, /function toggleListening\(\) \{[^}]*audioSession\.unlockCapture\(\)/, 'the Listen tap wakes it');
});
