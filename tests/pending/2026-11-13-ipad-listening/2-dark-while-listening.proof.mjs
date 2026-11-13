// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 2: the Listen button can stay DARK while the app is listening.
// stt.js swallows the first "listening" after a reopen-for-speech (resumingForSpeech).
// If that reopen never reports "listening", the flag stays set and swallows the
// NEXT genuine one instead - the one the user's own Listen tap produces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeWS, audioCtl, makeAudioContextClass, appButton, freshStt, tick, frame, mic, url } from './harness.mjs';

test('2a Deepgram: a reopen that cannot wake leaves the next Listen tap lighting nothing', async () => {
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
        assert.equal(btn.lit, true, 'listening normally');

        // A holding phrase: the microphone closes, invisibly.
        stt.noteSpokenStart('I am thinking about that.');
        // Something on the iPad (an interruption, another app's sound) leaves the
        // shared listening audio asleep, so the reopen after the phrase cannot wake it.
        const { captureContext } = await import(url('app/js/audio-session.js'));
        const ctx = captureContext();
        ctx.state = 'suspended';
        audioCtl.hangResume = true;
        stt.noteSpokenEnd();
        await tick(1700);                       // wake() gives up after 1.5 s
        assert.equal(btn.lit, false, 'the reopen failed and the button went dark (by design)');

        // The user taps Listen. app.js wakes the audio inside the tap (unlockCapture),
        // which works this time, and asks stt to listen again.
        audioCtl.hangResume = false;
        ctx.state = 'running';
        stt.resumeListening();
        await tick();
        const ws = FakeWS.last;
        ws.open();
        const before = ws.audioFrames();
        for (let i = 0; i < 5; i++) frame(0.1);   // the partner talks
        console.log('2a statuses seen by the app:', btn.seen.join(', '));
        console.log('2a socket open:', ws.readyState === FakeWS.OPEN, ' audio frames sent:', ws.audioFrames() - before);
        assert.equal(ws.readyState, FakeWS.OPEN, 'the service connection is open');
        assert.ok(ws.audioFrames() - before >= 5, 'the partner is being sent to the service (and billed)');
        assert.equal(btn.lit, false, 'BUG: ...but the app was never told, so the Listen button is dark');

        // A second tap recovers it.
        stt.resumeListening();
        await tick();
        assert.equal(btn.lit, true, 'a further tap re-reports listening');
    } finally { stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});

test('2b Deepgram: a phrase in the second before the connection opens hides listening entirely', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    try {
        stt.startListening();          // the Listen tap
        await tick();                  // microphone open, connection still being made
        const first = FakeWS.last;
        assert.equal(first.readyState, FakeWS.CONNECTING);
        // e.g. "Ask them to repeat" tapped straight after Listen, or any phrase
        stt.noteSpokenStart('Sorry, could you say that again?');
        stt.noteSpokenEnd();
        await tick();
        const second = FakeWS.last;
        assert.notEqual(second, first, 'reopened after the phrase');
        second.open();
        for (let i = 0; i < 5; i++) frame(0.1);
        console.log('2b statuses seen by the app:', JSON.stringify(btn.seen));
        assert.equal(second.readyState, FakeWS.OPEN);
        assert.ok(second.audioFrames() >= 5, 'audio is going to the service');
        assert.equal(btn.lit, false, 'BUG: the app never heard "listening", so the button stays dark');
    } finally { stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});

test('2c Azure (the recommended service): same as 2a', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'azure', getAzureKey: () => 'k', getAzureRegion: () => 'eastus' });
    stt._setIpadCheckForTest(() => true);
    try {
        stt.startListening();
        await tick();
        assert.equal(btn.lit, true, 'listening normally');
        stt.noteSpokenStart('I am thinking about that.');
        const as = await import(url('app/js/audio-session.js'));
        const ctx = as.captureContext();
        ctx.state = 'suspended';
        audioCtl.hangResume = true;
        stt.noteSpokenEnd();
        await tick(1700);
        assert.equal(btn.lit, false, 'reopen failed, button dark');
        audioCtl.hangResume = false;
        ctx.state = 'running';
        const openBefore = mic.open;
        stt.resumeListening();          // the user's Listen tap
        await tick();
        console.log('2c statuses seen by the app:', btn.seen.join(', '), ' microphones open:', mic.open - openBefore);
        assert.equal(mic.open - openBefore, 1, 'the microphone is open and capturing');
        assert.equal(btn.lit, false, 'BUG: the button is dark');
    } finally { stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});
