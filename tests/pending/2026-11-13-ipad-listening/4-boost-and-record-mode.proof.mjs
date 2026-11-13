// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 4: the iPad's "play-and-record" setting can be left on with no microphone
// open; and stopping during a holding phrase reopens the microphone after the user (or
// End conversation) has asked to stop. (The x5 voice boost that was also left on is
// gone: Ken removed it on November 13 2026.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { url, makeAudioContextClass, freshStt, tick, FakeWS, audioCtl, audioSessionFake, mic, appButton } from './harness.mjs';
const audioSession = await import(url('app/js/audio-session.js'));


async function deepgramStt() {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    return { stt, btn };
}

test('4a a reopen that cannot wake leaves the iPad in record mode, with no microphone', async () => {
    const { stt, btn } = await deepgramStt();
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        stt.noteSpokenStart('I am thinking about that.');
        audioSession.captureContext().state = 'suspended';
        audioCtl.hangResume = true;
        stt.noteSpokenEnd();
        await tick(1700);
        audioCtl.hangResume = false;
        console.log('4a button lit:', btn.lit, ' microphones open:', mic.open, ' iPad audio type:', audioSessionFake.type);
        assert.equal(mic.open, 0, 'no microphone is open');
        assert.equal(audioSessionFake.type, 'play-and-record', 'BUG: still told the iPad it is recording');
    } finally { stt._setIpadCheckForTest(() => false); stt.stopListening(); }
    assert.equal(audioSessionFake.type, 'playback', 'the next ordinary stop puts it right');
});

test('4b End conversation during a holding phrase reopens the microphone after the end', async () => {
    const { stt } = await deepgramStt();
    stt.startListening();
    await tick();
    FakeWS.last.open();
    stt.noteSpokenStart('Still thinking.');         // mic closed for the phrase
    const callsBefore = mic.calls.length;
    // terminateConversation(): tts.cancel() first (which reports the speech ended) ...
    stt.noteSpokenEnd();
    // ... then stt.stopListening(), in the same moment.
    stt.stopListening();
    await tick(50);
    console.log('4b microphone requests after End:', mic.calls.length - callsBefore);
    assert.equal(mic.calls.length - callsBefore, 1, 'BUG: the microphone is asked for after the conversation ended');
    assert.equal(mic.open, 0, '(it is released again once it arrives)');
    stt._setIpadCheckForTest(() => false);
});

test('4c ...and if the iPad answers that request with its "wrong audio mode" refusal, the retry leaves record mode on', async () => {
    const { stt } = await deepgramStt();
    stt.startListening();
    await tick();
    FakeWS.last.open();
    stt.noteSpokenStart('Still thinking.');
    // The request made by the reopen is refused for the audio mode (we have just
    // switched it to "playback"), and the retry 300 ms later succeeds.
    mic.plan.push({ kind: 'invalid-state', delayMs: 20 }, 'ok');
    stt.noteSpokenEnd();
    stt.stopListening();                            // End conversation / Listen off
    assert.equal(audioSessionFake.type, 'playback', 'stopping set playback');
    await tick(450);
    console.log('4c after End: iPad audio type', audioSessionFake.type, ' mic open', mic.open);
    assert.equal(mic.open, 0);
    assert.equal(audioSessionFake.type, 'play-and-record', 'BUG: left in record mode after the conversation ended');
    stt._setIpadCheckForTest(() => false);
});
