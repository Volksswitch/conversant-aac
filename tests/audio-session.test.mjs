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

// The setting is used on an iPhone or iPad only. This run is not one, so the tests
// that are about an iPad say so.
function withSession(session, fn, { ios = true } = {}) {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { ...(globalThis.navigator || {}), audioSession: session },
        configurable: true, writable: true,
    });
    audioSession._setIosCheckForTest(() => ios);
    try { fn(); } finally {
        audioSession._setIosCheckForTest(() => false);
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

// November 13 2026 findings, item 9: Safari on a Mac may offer the same setting, and
// nothing was ever measured there, so it is left alone like every other computer.
test('a Mac (any device that is not an iPhone or iPad) is left alone even when Safari offers the setting', () => {
    const s = { type: 'auto', state: 'active' };
    withSession(s, () => {
        audioSession.forListening();
        audioSession.forSpeaking();
        assert.equal(s.type, 'auto');
        assert.equal(audioSession.describe(), 'not available here');
    }, { ios: false });
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

// The body of one function in a source file, found by its name, braces matched.
function functionBody(src, name) {
    const at = src.search(new RegExp(`function ${name}\\s*\\(`));
    assert.ok(at >= 0, `${name} is defined`);
    let i = src.indexOf('{', at);
    const from = i;
    let depth = 0;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) break;
    }
    return src.slice(from, i + 1);
}

// stt.js cannot be driven here with a real microphone, so its wiring is checked in
// the source: every place a paid source is closed must also say "playback", and every
// place it is opened must say "play-and-record" first. A close with no switch is the
// bug coming back, silently, on one path.
test('the shared listening code switches the audio type at every paid stop and start', () => {
    const src = readFileSync(new URL('../app/js/stt.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // Every function that closes a paid source, except setSource(), which swaps one
    // service for another and stops through stopListening() first.
    const closers = ['pauseForSpeech', 'suspendSource', 'handleSourceError', 'stopListening'];
    for (const name of closers) {
        const body = functionBody(src, name);
        assert.match(body, /externalSource\.(stop|pause)/, `${name} closes the source`);
        assert.match(body, /audioSession\.forSpeaking\(\)/, `${name} says "playback"`);
    }
    // Nothing else closes one (setSource aside).
    const allCloses = src.match(/externalSource\.(stop|pause)\b/g).length;
    const setSourceCloses = functionBody(src, 'setSource').match(/externalSource\.(stop|pause)\b/g).length;
    assert.equal(allCloses - setSourceCloses, closers.length + 1, 'pauseForSpeech names both stop and pause');
    // A source that stops by itself (its audio would not start) switches too (problem
    // 4a of the November 13 2026 findings).
    assert.match(src, /status === 'stopped' \|\| status === 'idle'\) \{[^}]*audioSession\.forSpeaking\(\)/);
    // Both ways in say "play-and-record" first.
    for (const name of ['reallyOpen', 'reopenAfterSpeech']) {
        assert.match(functionBody(src, name), /audioSession\.forListening\(\);\s*(try \{ )?externalSource\.start\(\)/, name);
    }
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
        assert.match(src, /stream = await audioSession\.openMic\(\{ stillWanted: \(\) => wanted \}\)/, f);
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
    assert.equal(await audioSession.openMic({ getUserMedia: gum, wait: async () => {} }), stream);
    assert.equal(calls.length, 2);
});

test('a refused permission is not retried', async () => {
    let calls = 0;
    const gum = async () => { calls++; const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; };
    await assert.rejects(audioSession.openMic({ getUserMedia: gum, wait: async () => {} }), { name: 'NotAllowedError' });
    assert.equal(calls, 1, 'asking again would only show the permission prompt again');
});

// Problem 4c of the November 13 2026 findings: End conversation or Listen off while
// the request was out, and the iPad refused it for its audio mode. The retry switched
// the iPad back to recording mode after the app had set playback, with nothing left
// to switch it off.
test('a start cancelled while its request was out neither retries nor switches the iPad back to recording', async () => {
    const s = { type: 'playback', state: 'active' };
    const invalid = () => { const e = new Error('AudioSession category is not compatible'); e.name = 'InvalidStateError'; return e; };
    let calls = 0;
    const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
        value: { ...(globalThis.navigator || {}), audioSession: s }, configurable: true, writable: true,
    });
    audioSession._setIosCheckForTest(() => true);
    try {
        // Cancelled before the refusal arrived.
        await assert.rejects(audioSession.openMic({
            getUserMedia: async () => { calls++; throw invalid(); },
            wait: async () => {}, stillWanted: () => false,
        }), { name: 'InvalidStateError' });
        assert.equal(calls, 1, 'not retried');
        assert.equal(s.type, 'playback', 'left in playback');

        // Cancelled during the pause before the retry.
        let wanted = true;
        calls = 0;
        await assert.rejects(audioSession.openMic({
            getUserMedia: async () => { calls++; throw invalid(); },
            wait: async () => { wanted = false; }, stillWanted: () => wanted,
        }), { name: 'InvalidStateError' });
        assert.equal(calls, 1, 'not retried');
    } finally {
        audioSession._setIosCheckForTest(() => false);
        if (real) Object.defineProperty(globalThis, 'navigator', real);
    }
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
    assert.match(app, /function toggleListening\(\) \{[^}]*wakeListeningAudio\(\)/, 'the Listen tap wakes it');
});

// November 13 2026 findings, item 9. The listening audio is the paid services' alone:
// made on every device, it ran all session where nothing ever used it. And a reply's
// tap wakes it too, so automatic listening after the reply can start if a phone call
// or Siri stopped the audio - before, only a Listen tap could.
test('the listening audio is woken only for a paid service, by Start, Listen and the taps that reply', () => {
    const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.match(app, /function wakeListeningAudio\(\) \{\s*if \(stt\.currentSource\(\) !== 'browser'\) audioSession\.unlockCapture\(\);\s*\}/);
    assert.equal(app.match(/audioSession\.unlockCapture\(\)/g).length, 1, 'nothing else wakes it unconditionally');
    for (const fn of ['handleResponseSelected', 'speakAsUserTurn']) {
        // The first thing the handler does, before anything waits and the tap is over.
        assert.match(app, new RegExp(`async function ${fn}\\([^)]*\\) \\{\\s*wakeListeningAudio\\(\\);`), fn);
    }
    assert.match(functionBody(app, 'handleStart'), /wakeListeningAudio\(\)/, 'Start wakes it');
});
