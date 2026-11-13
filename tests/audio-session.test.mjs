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

test('an iPad is told "playback" when listening stops and "auto" before it starts', () => {
    const s = { type: 'auto', state: 'active' };
    withSession(s, () => {
        audioSession.forSpeaking();
        assert.equal(s.type, 'playback');
        assert.match(audioSession.describe(), /^playback \(active\)$/);
        audioSession.forListening();
        assert.equal(s.type, 'auto');
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

// Call processing off on an iPad, unchanged everywhere else (Ken, November 13 2026).
// The platform is read once when platform.js loads, so the two cases are passed in;
// the last check is that, left to itself, a desktop (this test run) asks as before.
test('an iPad asks for no call processing; other devices ask for it as before', () => {
    assert.deepEqual(audioSession.micProcessing(true),
        { echoCancellation: false, noiseSuppression: false, autoGainControl: false });
    assert.deepEqual(audioSession.micProcessing(false),
        { echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    assert.deepEqual(audioSession.micProcessing(), audioSession.micProcessing(false));
});

test('every paid service opens the microphone through the one shared request', () => {
    for (const f of ['stt-deepgram.js', 'stt-azure.js', 'stt-rest.js']) {
        const src = readFileSync(new URL(`../app/js/${f}`, import.meta.url), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        assert.match(src, /getUserMedia\(\{\s*audio: audioSession\.micProcessing\(\),?\s*\}\)/, f);
        assert.doesNotMatch(src, /echoCancellation/, `${f} must not set its own`);
    }
});
