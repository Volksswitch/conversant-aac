// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 6: leaving the app while the microphone is reopening after a phrase.
// A start that the background guard has already cancelled still reports its failure
// as fatal, so listening does not come back when the user returns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, makeAudioContextClass, freshStt, tick, FakeWS, audioCtl, mic, appButton } from './harness.mjs';

async function setup() {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    stt.startListening();
    await tick();
    FakeWS.last.open();
    return { stt, btn };
}

test('6 the app goes to the background while the mic reopens; the refused request switches listening off for good', async () => {
    const { stt, btn } = await setup();
    try {
        stt.noteSpokenStart('Still thinking.');
        // Assumption to check on an iPad: a page being hidden has its microphone
        // request refused.
        mic.plan.push({ kind: 'not-allowed', delayMs: 50 });
        stt.noteSpokenEnd();              // reopen begins
        env.setHidden(true);              // Home button, mid-request
        await tick(100);                  // the request is refused
        env.setHidden(false);             // back to the app
        await tick(50);
        const reopened = FakeWS.last.readyState !== FakeWS.CLOSED;
        console.log('6 statuses seen by the app:', btn.seen.join(', '), ' listening after return:', reopened);
        assert.ok(btn.seen.includes('error'), 'BUG: a cancelled start is reported as a microphone error (red wash, error log)');
        assert.equal(reopened, false, 'BUG: and listening is not restored on return - the user must tap Listen');
    } finally { stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});

test('6-control (control) leaving during the phrase itself is handled: listening comes back on return', async () => {
    const { stt, btn } = await setup();
    try {
        stt.noteSpokenStart('Still thinking.');
        env.setHidden(true);
        stt.noteSpokenEnd();
        await tick(20);
        const callsBefore = mic.calls.length;
        env.setHidden(false);
        await tick(20);
        FakeWS.last.open();
        console.log('6-control statuses:', btn.seen.join(', '), ' mic requests on return:', mic.calls.length - callsBefore);
        assert.equal(mic.calls.length - callsBefore, 1, 'reopened on return');
        assert.equal(btn.lit, true);
    } finally { stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});
