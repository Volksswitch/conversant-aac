// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 9 (smaller): problem-report lines that read wrongly after the November 13 changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { url, makeAudioContextClass, freshStt, tick, frame, FakeWS, audioCtl, mic } from './harness.mjs';
const micCheck = await import(url('app/js/mic-check.js'));

test('9a right after a reopen the report says the room was never measured and shows the old fixed bar', async () => {
    micCheck._reset();
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    const real = Date.now;
    let now = 7_000_000;
    Date.now = () => now;
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        for (let i = 0; i < 20; i++) { frame(0.0004); now += 85; }
        const before = micCheck.summary().split('\n')[0];
        stt.noteSpokenStart('Still thinking.');
        stt.noteSpokenEnd();
        await tick();
        FakeWS.last.open();
        frame(0.0004); now += 85;              // one frame after the reopen
        const after = micCheck.summary().split('\n')[0];
        console.log('9a before the phrase:', before.replace(/.*loudest/, 'loudest'));
        console.log('9a just after it:    ', after.replace(/.*loudest/, 'loudest'));
        assert.match(before, /quietRoom=0\.0004/);
        assert.match(after, /quietRoom=not measured/, 'the measured room is forgotten at every reopen');
        assert.match(after, /speech starts at 0\.020/);
        assert.match(after, /starts=2/, 'each holding phrase counts as another "start"');
    } finally { Date.now = real; stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});

test('9b a start cancelled by the user is reported as "stuck" if its audio was slow to wake', async () => {
    micCheck._reset();
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        stt.noteSpokenStart('Still thinking.');
        const as = await import(url('app/js/audio-session.js'));
        as.captureContext().state = 'suspended';
        audioCtl.hangResume = true;
        stt.noteSpokenEnd();
        stt.stopListening();                     // End conversation, same moment
        await tick(1700);
        console.log('H2', micCheck.summary().split('\n').filter((l) => /stuck/.test(l)).join(' | '));
        assert.match(micCheck.summary(), /stuck: audio would not start x1/, 'counted although nobody was waiting for it');
    } finally { audioCtl.hangResume = false; stt._setIpadCheckForTest(() => false); }
});
