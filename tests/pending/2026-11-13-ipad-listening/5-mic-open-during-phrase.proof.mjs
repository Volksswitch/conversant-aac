// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 5: when a second phrase starts before the reopen after the first has
// finished (Hold on / Say again / Ask them to repeat tapped during a holding phrase:
// the user's words wait for the phrase, then half a second), the second phrase is NOT
// paused for - the microphone opens part-way through it, with the x5 boost on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { url, makeAudioContextClass, freshStt, tick, FakeWS, audioCtl, mic } from './harness.mjs';
const audioSession = await import(url('app/js/audio-session.js'));

test('5 a reopen slower than the half-second gap leaves the microphone open during the next phrase', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        stt.noteSpokenStart('Still thinking.');      // the holding phrase
        mic.plan.push({ kind: 'ok', delayMs: 700 });  // the iPad takes 0.7 s to hand over the mic
        stt.noteSpokenEnd();                          // ...it ends; reopen begins
        await tick(500);                              // speakUserStatement's half-second gap
        stt.noteSpokenStart('Could you hold on a moment?');   // the user's own phrase
        await tick(300);                              // the reopen finishes mid-phrase
        const ws = FakeWS.last;
        console.log('5 during the second phrase: microphones open', mic.open, ' socket', ws.readyState, ' boost', audioSession.output({ state: 'running', currentTime: 0, destination: {}, createGain: () => ({ gain: { value: 1, setTargetAtTime(x) { this.value = x; } }, context: { state: 'running', currentTime: 0 }, connect: (n) => n }), createDynamicsCompressor: () => ({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: (n) => n }) }, true).gain.value);
        assert.equal(mic.open, 1, 'BUG: the microphone is open while the app is speaking');
        stt.noteSpokenEnd();
    } finally { stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});
