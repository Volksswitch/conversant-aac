// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 7: the speech gate's "quiet room" level is measured afresh every time the
// microphone opens, and if the partner is already talking, their (quiet) voice is
// measured as the room. The bar then rises above their voice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { url, makeAudioContextClass, freshStt, tick, frame, FakeWS, audioCtl } from './harness.mjs';
const { createGate } = await import(url('app/js/vad.js'));

const FRAME_MS = 85;
const ROOM = 0.0004;   // Kenny's room, from his 0.15.2 report
// A quiet talker whose loudest frames reach 0.008 (Kenny's wife beside him).
const SYLLABLES = [0.005, 0.007, 0.008, 0.006, 0.004, 0.002, 0.006, 0.008, 0.007, 0.004, 0.003, 0.0015];

function speech(seconds, pauseEvery = 0, pauseFrames = 0) {
    const out = [];
    const n = Math.round((seconds * 1000) / FRAME_MS);
    for (let i = 0; i < n; i++) {
        if (pauseEvery && i % pauseEvery >= pauseEvery - pauseFrames) out.push(ROOM);
        else out.push(SYLLABLES[i % SYLLABLES.length]);
    }
    return out;
}

function firstOpenMs(levels) {
    const g = createGate();
    let t = 0;
    for (let i = 0; i < levels.length; i++) {
        if (g.push(levels[i], t) === 'open') return { ms: t, bar: g.levels().open };
        t += FRAME_MS;
    }
    return { ms: null, bar: g.levels().open, floor: g.levels().floor };
}

test('7a the order decides it: room first opens at once, talking first does not', () => {
    const roomFirst = firstOpenMs([...Array(14).fill(ROOM), ...speech(10)]);
    const talkFirst = firstOpenMs(speech(10));
    // Natural pauses: half a second off every three seconds.
    const talkWithPauses = firstOpenMs(speech(15, 35, 6));
    console.log('7a room first, then talking: opens at', roomFirst.ms, 'ms (bar', roomFirst.bar, ')');
    console.log('7a talking from the first moment: opens at', talkFirst.ms, '(bar now', talkFirst.bar?.toFixed(4), ' room measured as', talkFirst.floor, ')');
    console.log('7a talking with half-second pauses every 3 s: opens at', talkWithPauses.ms, 'ms');
    assert.ok(roomFirst.ms !== null && roomFirst.ms < 1300, 'quiet room first: heard at once');
    assert.equal(talkFirst.ms, null, 'BUG: 10 s of continuous quiet speech from the start is never treated as speech');
});

test('7b through the real Deepgram source: after a holding phrase, a quiet partner who carries on is not sent', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    stt._setIpadCheckForTest(() => true);
    const real = Date.now;
    let now = 9_000_000;
    Date.now = () => now;
    const play = (levels) => { for (const l of levels) { frame(l); now += FRAME_MS; } };
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        play(Array(14).fill(ROOM));               // a quiet room
        play(speech(3));                          // quiet partner: heard
        const before = FakeWS.last.audioFrames();
        assert.ok(before > 0, 'quiet speech after a quiet room IS sent (the November 13 fix works)');
        play(Array(14).fill(ROOM));
        // Holding phrase: microphone closed, then reopened when it ends.
        stt.noteSpokenStart('Still thinking.');
        stt.noteSpokenEnd();
        await tick();
        const ws = FakeWS.last;
        ws.open();
        play(speech(6));                          // the partner carries on talking at once
        console.log('7b frames sent before the phrase:', before, ' after the reopen:', ws.audioFrames());
        assert.equal(ws.audioFrames(), 0, 'BUG: six seconds of the same voice after the reopen are never sent');
    } finally { Date.now = real; stt._setIpadCheckForTest(() => false); stt.stopListening(); }
});
