// CONTROLS: paths Ken asked about that are handled correctly. These assert the RIGHT
// behavior and must still pass after the fixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAudioContextClass, freshStt, tick, FakeWS, audioCtl, mic, appButton } from './harness.mjs';

async function setup(source = 'deepgram') {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {}, source,
        getDeepgramKey: () => 'k', getAzureKey: () => 'k', getAzureRegion: () => 'eastus' });
    stt._setIpadCheckForTest(() => true);
    stt.startListening();
    await tick();
    if (source === 'deepgram') FakeWS.last.open();
    return { stt, btn };
}

test('control 1: changing the hearing service mid-phrase: button goes dark, nothing reopens', async () => {
    const { stt, btn } = await setup();
    stt.noteSpokenStart('Still thinking.');
    const calls = mic.calls.length;
    assert.equal(stt.setSource('azure'), true);
    stt.noteSpokenEnd();
    await tick(50);
    assert.equal(btn.lit, false);
    assert.equal(mic.calls.length, calls, 'no microphone request from either service');
    stt._setIpadCheckForTest(() => false);
});

test('control 2: a microphone error while reopening clears the flags; the next Listen lights the button', async () => {
    const { stt, btn } = await setup();
    stt.noteSpokenStart('Still thinking.');
    mic.plan.push('not-allowed');
    stt.noteSpokenEnd();
    await tick(50);
    assert.equal(btn.lit, false);
    assert.ok(btn.seen.includes('error'));
    stt.resumeListening();
    await tick();
    FakeWS.last.open();
    assert.equal(btn.lit, true, 'the next tap works');
    stt._setIpadCheckForTest(() => false); stt.stopListening();
});

test('control 3: a second phrase that starts before the first ends: one close, one reopen, button lit throughout', async () => {
    const { stt, btn } = await setup();
    const calls = mic.calls.length;
    stt.noteSpokenStart('Still thinking.');
    stt.noteSpokenStart('Nearly there.');      // the voice starts another before the first ended
    stt.noteSpokenEnd();
    await tick();
    FakeWS.last.open();
    assert.equal(mic.calls.length - calls, 1, 'reopened once');
    assert.deepEqual(btn.seen, ['listening'], 'no flicker');
    stt._setIpadCheckForTest(() => false); stt.stopListening();
});
