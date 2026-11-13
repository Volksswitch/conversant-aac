// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 3: on Azure (and the other phrase-at-a-time services), closing the
// microphone for a holding phrase throws away partner words said BEFORE the phrase:
// a sentence still being transcribed, and a sentence in progress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAudioContextClass, freshStt, tick, frame, audioCtl } from './harness.mjs';

const SENTENCE = 'She said the new medication should help with your sleep.';

// A fetch that answers only when told to, like a transcription on its way back.
function holdFetch() {
    const pending = [];
    globalThis.fetch = (u, init) => new Promise((resolve) => {
        pending.push(() => resolve({ ok: true, status: 200,
            json: async () => ({ RecognitionStatus: 'Success', DisplayText: SENTENCE }) }));
    });
    return pending;
}

// Drive the microphone on a fake clock: frames are 85 ms apart.
function clock() {
    const real = Date.now;
    let now = 5_000_000;
    Date.now = () => now;
    return { step(level, n) { for (let i = 0; i < n; i++) { frame(level); now += 85; } }, restore() { Date.now = real; } };
}

async function run({ ipad, phraseWhile }) {
    globalThis.window.AudioContext = makeAudioContextClass();
    audioCtl.hangResume = false;
    const stt = await freshStt();
    const heard = [];
    stt.init({ onResult: (t) => heard.push(t), onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'azure', getAzureKey: () => 'k', getAzureRegion: () => 'eastus' });
    stt._setIpadCheckForTest(() => ipad);
    const pending = holdFetch();
    stt.startListening();
    await tick();
    const c = clock();
    try {
        c.step(0.0015, 15);                 // about a second of quiet room
        c.step(0.1, 20);                    // the partner speaks (1.7 s)
        if (phraseWhile === 'in-flight') {
            c.step(0.0015, 8);              // they pause; the sentence closes and is sent
            assert.equal(pending.length, 1, 'the sentence was sent for transcription');
            // A holding phrase starts while the transcription is on its way back.
            stt.noteSpokenStart('I am thinking about that.');
            pending[0]();                   // the words come back
        } else {
            // The holding phrase starts while they are still talking.
            stt.noteSpokenStart('I am thinking about that.');
            c.step(0.0015, 8);
            for (const p of pending) p();
        }
        await tick(20);
        stt.noteSpokenEnd();
        await tick(20);
    } finally { c.restore(); }
    const text = stt.getCurrentTranscript();
    stt._setIpadCheckForTest(() => false);
    stt.stopListening();
    return { text, sent: pending.length };
}

test('3a a sentence said BEFORE the holding phrase, still being transcribed: lost on an iPad', async () => {
    const ipad = await run({ ipad: true, phraseWhile: 'in-flight' });
    const other = await run({ ipad: false, phraseWhile: 'in-flight' });
    console.log('3a iPad transcript:     ', JSON.stringify(ipad.text));
    console.log('3a computer transcript: ', JSON.stringify(other.text));
    assert.equal(other.text, SENTENCE, 'off an iPad the sentence arrives');
    assert.equal(ipad.text, '', 'BUG: on an iPad the finished sentence is thrown away');
});

test('3b a sentence in progress when the holding phrase starts: its spoken part is lost on an iPad', async () => {
    const ipad = await run({ ipad: true, phraseWhile: 'speaking' });
    const other = await run({ ipad: false, phraseWhile: 'speaking' });
    console.log('3b iPad: sent for transcription', ipad.sent, 'times; transcript', JSON.stringify(ipad.text));
    console.log('3b computer: sent', other.sent, 'times; transcript', JSON.stringify(other.text));
    assert.equal(other.text, SENTENCE);
    assert.equal(ipad.sent, 0, 'BUG: the 1.7 s already spoken is never sent at all');
    assert.equal(ipad.text, '');
});
