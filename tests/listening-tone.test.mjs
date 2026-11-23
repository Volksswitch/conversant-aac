/* When the listening tone plays on an iPhone or iPad (Ken, November 23 2026: "By
 * sounding the chime only when the system is ready to record, that may address the sense
 * that the system is too slow and forces the communication partner to repeat
 * themselves").
 *
 * With a paid hearing service the microphone now opens at once and the tone plays on the
 * listening audio when the Listen button lights. With the device's own listening the
 * tone still plays first and the microphone waits for it.
 *
 * Driven through the REAL listening code (stt.js, stt-deepgram.js, audio-session.js) and
 * the real tone (chime.js). app.js cannot be loaded here, so its two decisions are made
 * the same way below, and the last test checks app.js really makes them like this, so the
 * copy cannot drift from the app unnoticed.
 *
 * WHAT THESE CANNOT SHOW: whether an iPad plays a tone on the listening audio promptly,
 * or holds it back as the November 8 iPhone held back the tone's own audio. That needs
 * the device.
 */
import { FakeWS, audioCtl, makeAudioContextClass, mic, appButton, freshStt, onIpad, offIpad, tick }
    from './listening-fakes.mjs';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as chime from '../app/js/chime.js';
import * as audioSession from '../app/js/audio-session.js';

// The app's two decisions, as app.js makes them (see the last test).
function toneBeforeMic(stt, ios) {
    const tonesFirst = chime.playsBeforeMicrophone({ ios, paidHearing: stt.currentSource() !== 'browser' });
    return tonesFirst ? chime.playBeforeListening() : 0;
}
function wireTone(stt, ios) {
    chime.setContextProvider(() => (ios && stt.currentSource() !== 'browser')
        ? audioSession.captureContext()
        : null);
}

let current = null;
beforeEach(() => {
    globalThis.window.AudioContext = makeAudioContextClass();
    chime.setEnabled(true);
    chime.setOncePerConversation(true);
    chime.resetConversation();
});
afterEach(async () => {
    chime.setContextProvider(null);
    chime.resetConversation();
    mic.plan.length = 0;
    if (current) {
        try { current.stopListening(); } catch { /* already stopped */ }
        await offIpad(current);
        current = null;
    }
});

// What the app does with a status, plus the tone on the Listen button's off-to-on edge,
// as ui.setListenButtonState does.
function appWithTone() {
    const btn = appButton();
    const onStatus = (s) => {
        const was = btn.lit;
        btn.onStatus(s);
        if (btn.lit && !was) chime.onCaptureStarted();
    };
    return { btn, onStatus };
}
// Which audio a tone was played on since `before`. Compared rather than counted from
// zero, because the tone keeps its own audio from one test to the next (chime.js makes
// it once), exactly as it does in the app.
const snapshot = () => new Map(audioCtl.instances.map((c) => [c, c.oscillators]));
const playedSince = (before) => audioCtl.instances.filter((c) => c.oscillators > (before.get(c) || 0));

test('paid hearing on an iPad: the microphone opens at once, and the tone plays on the listening audio when listening is on', async () => {
    const { btn, onStatus } = appWithTone();
    const stt = await freshStt();
    current = stt;
    stt.init({ onResult() {}, onSilence() {}, onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    await onIpad(stt);
    wireTone(stt, true);

    const before = snapshot();
    const asked = mic.calls.length;
    const delay = toneBeforeMic(stt, true);
    assert.equal(delay, 0, 'the microphone does not wait for a tone');
    stt.startListening({ delayMs: delay });
    assert.equal(playedSince(before).length, 0, 'no tone before anything is listening');
    await tick();
    assert.equal(mic.calls.length, asked + 1, 'the microphone was asked for at once');
    assert.equal(playedSince(before).length, 0, 'and still no tone: the connection is not up yet');

    FakeWS.last.open();
    assert.equal(btn.lit, true);
    const listeningAudio = audioSession.captureContext();
    assert.equal(listeningAudio.oscillators, 2, 'the tone played on the listening audio');
    assert.deepEqual(playedSince(before), [listeningAudio], 'and on no other audio');

    // Listening restarts after a reply in the same conversation: no second tone.
    stt.stopListening();
    stt.startListening({ delayMs: toneBeforeMic(stt, true) });
    await tick();
    FakeWS.last.open();
    assert.equal(listeningAudio.oscillators, 2, 'once per conversation, as before');
});

test("the device's own listening on an iPad keeps the tone first, on the tone's own audio", async () => {
    const { onStatus } = appWithTone();
    const stt = await freshStt();
    current = stt;
    stt.init({ onResult() {}, onSilence() {}, onStatus, onPartnerSpeech() {} });
    wireTone(stt, true);
    const before = snapshot();
    const delay = toneBeforeMic(stt, true);
    assert.equal(delay, chime.CHIME_MS, 'the microphone still waits for the tone');
    const played = playedSince(before);
    assert.equal(played.length, 1, 'the tone played before listening');
    assert.notEqual(played[0], audioSession.captureContext(), "on the tone's own audio");
});

test('off an iPhone or iPad nothing changes: no wait, and the tone on its own audio when listening is on', async () => {
    const { btn, onStatus } = appWithTone();
    const stt = await freshStt();
    current = stt;
    stt.init({ onResult() {}, onSilence() {}, onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    wireTone(stt, false);
    const before = snapshot();
    const delay = toneBeforeMic(stt, false);
    assert.equal(delay, 0);
    stt.startListening({ delayMs: delay });
    await tick();
    FakeWS.last.open();
    assert.equal(btn.lit, true);
    const played = playedSince(before);
    assert.equal(played.length, 1);
    assert.notEqual(played[0], audioSession.captureContext(), "on the tone's own audio, as before");
});

test('app.js makes the two decisions the way these tests copy them', () => {
    const src = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
    const start = src.indexOf('function toneBeforeMic');
    assert.ok(start >= 0, 'toneBeforeMic exists');
    const body = src.slice(start, src.indexOf('\n}', start));
    assert.match(body, /chime\.playsBeforeMicrophone\(\{\s*ios: platform\.isIOS\(\),\s*paidHearing: stt\.currentSource\(\) !== 'browser',?\s*\}\)/);
    assert.match(body, /return tonesFirst \? chime\.playBeforeListening\(\) : 0;/);
    assert.match(src, /chime\.setContextProvider\(\(\) => \(platform\.isIOS\(\) && stt\.currentSource\(\) !== 'browser'\)\s*\?\s*audioSession\.captureContext\(\)\s*:\s*null\);/);
});
