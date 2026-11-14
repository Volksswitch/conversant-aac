/* Tier 1 - with a paid hearing service, a pause is counted only once the microphone
 * has actually gone quiet (stt.js quietWaitMs, vad.js quietForMs).
 *
 * Ken's 0.15.10 report from his iPad (Deepgram): "I was surprised that the response
 * options came after I was only partway through the count", with no 1.5-second pause in
 * it. The countdown restarted with every result Deepgram sent back, so it measured the
 * gaps between deliveries, and Deepgram sends words in bursts. Ken, November 13 2026:
 * "Yes, make the change."
 *
 * Drives the REAL listening code (stt.js, the Deepgram source, vad.js) with a fake
 * microphone and a fake Deepgram connection (listening-fakes.mjs). Not an iPad test:
 * this applies on every device with a paid service.
 */
import { FakeWS, makeAudioContextClass, freshStt, offIpad, tick, frame } from './listening-fakes.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

let current = null;   // the stt under test, so a failed assertion still cleans up
afterEach(async () => {
    if (current) {
        try { current.stopListening(); } catch { /* already stopped */ }
        await offIpad(current);
        current = null;
    }
});

/** A fresh stt listening through Deepgram, with the given silence period in seconds. */
async function listeningDeepgram(seconds) {
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    const pauses = [];
    stt.init({ onResult() {}, onSilence: (text) => pauses.push({ text, at: Date.now() }),
        onStatus() {}, onPartnerSpeech() {}, source: 'deepgram', getDeepgramKey: () => 'k' });
    await offIpad(stt);
    stt.setSilenceThreshold(seconds);
    stt.startListening();
    await tick();
    FakeWS.last.open();
    return { stt, pauses };
}

// Words coming back from Deepgram.
function words(text, isFinal = false) {
    FakeWS.last.onmessage({ data: JSON.stringify({ is_final: isFinal, channel: { alternatives: [{ transcript: text }] } }) });
}

// The microphone hearing the other person, or the quiet room, one frame every 50 ms.
async function talking(ms) { for (let t = 0; t < ms; t += 50) { frame(0.05); await tick(50); } }
async function quietRoom(ms) { for (let t = 0; t < ms; t += 50) { frame(0.0005); await tick(50); } }

test('a pause is not counted while the microphone still hears the other person', async () => {
    const { pauses } = await listeningDeepgram(0.3);
    frame(0.05);
    words('one two');                // the service sends the first words back...
    await talking(800);              // ...then nothing for 0.8 s while they keep talking
    assert.equal(pauses.length, 0, 'no pause while the microphone hears speech');
    await quietRoom(700);            // they stop
    assert.equal(pauses.length, 1, 'counted once the microphone has been quiet for the silence period');
    assert.equal(pauses[0].text, 'one two');
});

test('a room that is never quiet delays the pause by no more than the cap', async () => {
    const { stt, pauses } = await listeningDeepgram(0.2);
    stt._setQuietHoldMaxForTest(400);
    frame(0.05);
    words('hello there');
    const started = Date.now();
    await talking(1500);             // people talking nearby: the microphone never goes quiet
    assert.equal(pauses.length, 1, 'counted anyway once the cap ran out');
    const late = pauses[0].at - started;
    assert.ok(late >= 550 && late < 1200, `about 0.2 s of silence period plus 0.4 s of cap: ${late} ms`);
});

test('a quiet room counts the pause on time, as before', async () => {
    const { pauses } = await listeningDeepgram(0.3);
    frame(0.05);
    words('that is all');
    const started = Date.now();
    await quietRoom(600);
    assert.equal(pauses.length, 1);
    const late = pauses[0].at - started;
    assert.ok(late < 500, `no extra wait when the microphone is already quiet: ${late} ms`);
});

test('the 0-second setting still follows the service\'s own end of speech', async () => {
    const { pauses } = await listeningDeepgram(0);
    frame(0.05);
    words('yes', true);              // a final result: the service says they stopped
    await talking(150);
    assert.equal(pauses.length, 1, 'not held for the microphone');
});
