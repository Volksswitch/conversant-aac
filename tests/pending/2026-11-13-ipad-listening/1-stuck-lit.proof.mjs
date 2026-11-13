// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 1: the Listen button stuck LIT with nothing listening, and Listen taps that
// cannot turn it off. Trigger: leave the app and come back while the microphone is
// reopening after a holding phrase, and the request for the microphone finishes after
// the return. The return's own start is ignored ("a start is already in progress"),
// and the earlier start then gives up because it had been cancelled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, makeAudioContextClass, freshStt, tick, FakeWS, audioCtl, mic, appButton } from './harness.mjs';

test('1a leave and return during the reopen: lit, deaf, and Listen taps do nothing', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        const socketsBefore = FakeWS.all.length;
        stt.noteSpokenStart('Still thinking.');
        mic.plan.push({ kind: 'ok', delayMs: 200 });   // the microphone request takes 0.2 s
        stt.noteSpokenEnd();                            // reopen begins
        env.setHidden(true);                            // the user leaves...
        await tick(50);
        env.setHidden(false);                           // ...and comes straight back
        await tick(300);                                // the request finishes
        console.log('1a after return: button lit', btn.lit, ' microphones open', mic.open,
            ' new connections', FakeWS.all.length - socketsBefore, ' statuses', btn.seen.join(', '));
        assert.equal(btn.lit, true, 'the button still says listening');
        assert.equal(mic.open, 0, 'BUG: but no microphone is open');
        assert.equal(FakeWS.all.length - socketsBefore, 0, 'and no connection was made');

        // The user taps Listen to turn it off (and again).
        const seen = btn.seen.length;
        stt.stopListening();
        stt.stopListening();
        console.log('1a statuses after two Listen taps:', btn.seen.slice(seen));
        assert.equal(btn.seen.length, seen, 'BUG: stopping reports nothing, so the button cannot be turned off');
        assert.equal(btn.lit, true);
    } finally { stt._setIpadCheckForTest(() => false); }
});

test('1b (older gap, now easier to reach) stop then start while a start is in progress: nothing starts', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        const socketsBefore = FakeWS.all.length;
        stt.noteSpokenStart('Still thinking.');
        mic.plan.push({ kind: 'ok', delayMs: 150 });
        stt.noteSpokenEnd();            // reopen in progress (button still lit)
        stt.stopListening();            // the user taps Listen off...
        stt.resumeListening();          // ...and straight back on
        await tick(250);
        console.log('1b statuses:', btn.seen.join(', '), ' button lit', btn.lit, ' mic open', mic.open, ' new connections', FakeWS.all.length - socketsBefore);
        assert.equal(mic.open, 0, 'nothing is listening');
        assert.equal(btn.lit, false, 'button dark; one more tap is needed');
    } finally { stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});
