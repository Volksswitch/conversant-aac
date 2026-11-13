/* Listening on an iPad with a paid hearing service: closing the microphone while the app
 * speaks, and opening it again afterwards.
 *
 * Found on November 13 2026, when Ken asked for a hunt for hidden bugs in releases
 * 0.15.2 to 0.15.8, and fixed the same day. Each problem was first PROVED with a test
 * that passed only while it was present (tests/pending/2026-11-13-ipad-listening, now
 * removed); these are those tests turned round to assert the right behavior. The
 * numbers are the problem numbers in that hunt's findings.
 *
 * Everything here drives the REAL listening code - stt.js, the paid sources,
 * audio-session.js, vad.js and mic-check.js - with a fake microphone, fake audio and a
 * fake service connection (listening-fakes.mjs).
 *
 * WHAT THESE CANNOT SHOW, because only a real iPad can: how long it takes to hand the
 * microphone back after a phrase, what it does with a microphone request when the app
 * goes to the background, and what stops its listening audio by itself. The timings
 * here are chosen to land in the window each problem needs.
 */
import { env, FakeWS, audioCtl, audioSessionFake, makeAudioContextClass, mic, appButton,
    freshStt, onIpad, offIpad, tick, frame } from './listening-fakes.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as audioSession from '../app/js/audio-session.js';
import * as micCheck from '../app/js/mic-check.js';

let current = null;   // the stt under test, so a failed assertion still cleans up
afterEach(async () => {
    audioCtl.hangResume = false;
    mic.plan.length = 0;
    if (current) {
        try { current.stopListening(); } catch { /* already stopped */ }
        await offIpad(current);
        current = null;
    }
    env.setHidden(false);
});

/** A fresh stt, on an iPad, listening through Deepgram with its connection open. */
async function listeningDeepgram({ events } = {}) {
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k',
        onMicEvent: events ? (k) => events.push(k) : undefined });
    await onIpad(stt);
    stt.startListening();
    await tick();
    FakeWS.last.open();
    assert.equal(btn.lit, true, 'listening normally');
    return { stt, btn };
}

async function listeningAzure() {
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'azure', getAzureKey: () => 'k', getAzureRegion: () => 'eastus' });
    await onIpad(stt);
    stt.startListening();
    await tick();
    assert.equal(btn.lit, true, 'listening normally');
    return { stt, btn };
}

// ---- 1. The Listen button stuck lit with nothing listening -----------------------

test('1a leaving the app and coming back while the microphone reopens: listening comes back, and Listen turns it off', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    mic.plan.push({ kind: 'ok', delayMs: 200 });     // the microphone takes 0.2 s to arrive
    stt.noteSpokenEnd();                             // the reopen begins
    await tick(5);
    const requests = mic.calls.length;
    env.setHidden(true);                             // the user leaves...
    await tick(50);
    env.setHidden(false);                            // ...and comes back before it arrives
    await tick(300);
    FakeWS.last.open();
    assert.equal(mic.open, 1, 'listening, on one microphone');
    assert.equal(mic.calls.length, requests, 'the request already out was used, not a second one');
    assert.equal(btn.lit, true);
    for (let i = 0; i < 3; i++) frame(0.1);
    assert.ok(FakeWS.last.audioFrames() >= 3, 'and the partner is heard');

    stt.stopListening();                             // a Listen tap turns it off
    assert.equal(btn.lit, false);
    assert.equal(mic.open, 0);
});

test('1b Listen off and straight back on while the microphone reopens: one tap is enough', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    mic.plan.push({ kind: 'ok', delayMs: 150 });
    stt.noteSpokenEnd();
    await tick(5);                                   // the reopen is waiting for the microphone
    const requests = mic.calls.length;
    stt.stopListening();
    assert.equal(btn.lit, false, 'off at once');
    stt.resumeListening();
    await tick(250);
    FakeWS.last.open();
    assert.equal(btn.lit, true, 'on again, with no second tap');
    assert.equal(mic.open, 1);
    assert.equal(mic.calls.length, requests, 'the request already out was used');
});

// The second half of the fix: whatever state the source is in, a stop leaves the app
// showing listening off. Here the source is waiting for the microphone after a trip
// away, with nothing closed for speech, which is the state the button used to stick in.
test('1c Listen off while the microphone is still reopening after a trip away: the button goes off', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    env.setHidden(true);                             // away during the phrase
    stt.noteSpokenEnd();
    mic.plan.push({ kind: 'ok', delayMs: 100 });
    env.setHidden(false);                            // back: the reopen waits for the microphone
    await tick(5);
    assert.equal(btn.lit, true);
    stt.stopListening();                             // Listen off
    assert.equal(btn.lit, false, 'off at once');
    await tick(150);
    assert.equal(mic.open, 0, 'and the microphone that arrives late is given back');
    assert.equal(btn.lit, false);
});

test('1d (still right) a stop while closed for the phrase turns the button off', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    stt.stopListening();
    assert.equal(btn.seen.at(-1), 'stopped');
    assert.equal(btn.lit, false);
    stt.noteSpokenEnd();
    await tick(20);
    assert.equal(mic.open, 0, 'and it does not reopen afterwards');
});

// ---- 2. The Listen button dark while the app is listening ------------------------

test('2a Deepgram: after a reopen whose audio would not start, the next Listen tap lights the button', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('I am thinking about that.');
    // Something on the iPad (a phone call, Siri) has left the listening audio asleep,
    // so the reopen after the phrase cannot wake it.
    const ctx = audioSession.captureContext();
    ctx.state = 'suspended';
    audioCtl.hangResume = true;
    stt.noteSpokenEnd();
    await tick(1700);                                // wake() gives up after 1.5 s
    assert.equal(btn.lit, false, 'the reopen failed, and the button says so');

    audioCtl.hangResume = false;                     // the Listen tap wakes it (app.js)
    ctx.state = 'running';
    stt.resumeListening();
    await tick();
    FakeWS.last.open();
    assert.equal(btn.lit, true, 'one tap lights it');
    for (let i = 0; i < 5; i++) frame(0.1);
    assert.ok(FakeWS.last.audioFrames() >= 5, 'and it is listening');
});

test('2b Deepgram: a phrase in the second before the connection opens, and the button still lights after it', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    await onIpad(stt);
    stt.startListening();                            // the Listen tap
    await tick();
    const first = FakeWS.last;
    assert.equal(first.readyState, FakeWS.CONNECTING);
    stt.noteSpokenStart('Sorry, could you say that again?');   // Ask them to repeat, at once
    stt.noteSpokenEnd();
    await tick();
    const second = FakeWS.last;
    assert.notEqual(second, first, 'reopened after the phrase');
    second.open();
    assert.equal(btn.lit, true, 'the app is told it is listening');
    assert.deepEqual(btn.seen, ['listening'], 'and told nothing else');
});

test('2c Azure: after a reopen whose audio would not start, the next Listen tap lights the button', async () => {
    const { stt, btn } = await listeningAzure();
    stt.noteSpokenStart('I am thinking about that.');
    const ctx = audioSession.captureContext();
    ctx.state = 'suspended';
    audioCtl.hangResume = true;
    stt.noteSpokenEnd();
    await tick(1700);
    assert.equal(btn.lit, false);
    audioCtl.hangResume = false;
    ctx.state = 'running';
    const openBefore = mic.open;
    stt.resumeListening();
    await tick();
    assert.equal(mic.open - openBefore, 1, 'the microphone is open');
    assert.equal(btn.lit, true, 'and the button says so');
});

// ---- 3. Azure, Google Cloud and ElevenLabs keep words said before a holding phrase --

const SENTENCE = 'She said the new medication should help with your sleep.';

// A fetch that answers only when told to, like a transcription on its way back.
function holdFetch() {
    const pending = [];
    globalThis.fetch = () => new Promise((resolve) => {
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
    return { step(level, k) { for (let i = 0; i < k; i++) { frame(level); now += 85; } }, restore() { Date.now = real; } };
}

async function azureRun({ ipad, phraseWhile, userStops = false }) {
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'azure', getAzureKey: () => 'k', getAzureRegion: () => 'eastus' });
    if (ipad) await onIpad(stt);
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
            stt.noteSpokenStart('I am thinking about that.');   // a holding phrase
            if (userStops) stt.stopListening();                  // ...and Listen off
            pending[0]();                   // the words come back
        } else {
            stt.noteSpokenStart('I am thinking about that.');    // while they are still talking
            c.step(0.0015, 8);
            for (const p of pending) p();
        }
        await tick(20);
        stt.noteSpokenEnd();
        await tick(20);
    } finally { c.restore(); }
    const result = { text: stt.getCurrentTranscript(), sent: pending.length };
    // Stopped here rather than left to afterEach: one test makes two of these.
    stt.stopListening();
    await offIpad(stt);
    return result;
}

test('3a a sentence said BEFORE the holding phrase, still being transcribed, is kept on an iPad', async () => {
    const ipad = await azureRun({ ipad: true, phraseWhile: 'in-flight' });
    assert.equal(ipad.text, SENTENCE);
    const other = await azureRun({ ipad: false, phraseWhile: 'in-flight' });
    assert.equal(other.text, SENTENCE, 'as it always was off an iPad');
});

test('3b the part of a sentence already said when the holding phrase starts is sent and kept', async () => {
    const ipad = await azureRun({ ipad: true, phraseWhile: 'speaking' });
    assert.equal(ipad.sent, 1, 'the 1.7 s already said is sent');
    assert.equal(ipad.text, SENTENCE);
});

test('3c a user stop still throws away what is on its way back', async () => {
    const r = await azureRun({ ipad: true, phraseWhile: 'in-flight', userStops: true });
    assert.equal(r.text, '', 'Listen off means the late words are not added');
});

test('3d a click is still not sent when the microphone closes for speech', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'azure', getAzureKey: () => 'k', getAzureRegion: () => 'eastus' });
    await onIpad(stt);
    const pending = holdFetch();
    stt.startListening();
    await tick();
    const c = clock();
    try {
        c.step(0.0015, 15);
        c.step(0.1, 1);                     // a click: one loud frame
        stt.noteSpokenStart('Still thinking.');
    } finally { c.restore(); }
    assert.equal(pending.length, 0, 'nothing sent, nothing billed');
});

// ---- 4. Recording mode left on with no microphone --------------------------------

test('4a a reopen whose audio would not start puts the iPad back to playback', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('I am thinking about that.');
    audioSession.captureContext().state = 'suspended';
    audioCtl.hangResume = true;
    stt.noteSpokenEnd();
    await tick(1700);
    assert.equal(btn.lit, false);
    assert.equal(mic.open, 0);
    assert.equal(audioSessionFake.type, 'playback', 'not left saying it is recording');
});

test('4b End conversation during a holding phrase does not ask for the microphone again', async () => {
    const { stt } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');          // microphone closed for the phrase
    const requests = mic.calls.length;
    // terminateConversation(): the speech is cancelled first, which reports that it
    // ended, then listening is stopped, in the same moment.
    stt.noteSpokenEnd();
    stt.stopListening();
    await tick(50);
    assert.equal(mic.calls.length, requests, 'no request after the conversation ended');
    assert.equal(audioSessionFake.type, 'playback');
});

test('4c a cancelled reopen refused for the audio mode is not retried and leaves playback on', async () => {
    const { stt } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    mic.plan.push({ kind: 'invalid-state', delayMs: 20 }, 'ok');
    stt.noteSpokenEnd();
    await tick(5);                                   // the reopen's request is out
    const requests = mic.calls.length;
    stt.stopListening();                             // End conversation / Listen off
    await tick(450);
    assert.equal(mic.calls.length, requests, 'not retried');
    assert.equal(mic.open, 0);
    assert.equal(audioSessionFake.type, 'playback', 'not switched back to recording');
});

test('4d Listen off during a holding phrase on an iPad stops at once: the microphone is already closed', async () => {
    const { stt } = await listeningDeepgram();
    assert.equal(stt.isClosedForSpeech(), false);
    stt.noteSpokenStart('Still thinking.');
    assert.equal(stt.isClosedForSpeech(), true, 'what app.js asks before waiting for the phrase to end');
    stt.noteSpokenEnd();
    await tick();
    assert.equal(stt.isClosedForSpeech(), false);
});

// app.js cannot be loaded here, so its half is checked in the source: with the
// microphone already closed for the phrase, toggleListening stops at once instead of
// waiting for the phrase to end (when the phrase's end would reopen it first).
test('4e (app.js) Listen off waits for a holding phrase only while the microphone is open during it', async () => {
    const { readFileSync } = await import('node:fs');
    const app = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.match(app, /if \(placeholders\.isPlaying\(\) && !stt\.isClosedForSpeech\(\)\) \{/);
});

// ---- 5. The user's phrase must not play with the microphone open ----------------

test('5 a phrase that starts while the microphone is still reopening keeps it closed until it ends', async () => {
    const { stt } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');          // the holding phrase
    mic.plan.push({ kind: 'ok', delayMs: 700 });     // the iPad takes 0.7 s to hand it over
    stt.noteSpokenEnd();                             // ...it ends; the reopen begins
    await tick(500);                                 // speakUserStatement's half-second gap
    stt.noteSpokenStart('Could you hold on a moment?');   // the user's own phrase
    await tick(300);                                 // the microphone arrives mid-phrase
    assert.equal(mic.open, 0, 'given back: the microphone stays closed while the app speaks');
    stt.noteSpokenEnd();
    await tick();
    FakeWS.last.open();
    assert.equal(mic.open, 1, 'and it opens once the phrase is over');
});

// Problem 5 again, in its quickest form: the app's next phrase starts in the same moment
// the last one ends. The microphone used to be asked for in between and open part-way
// through the second phrase.
test('5b two phrases back to back reopen once, after the second', async () => {
    const { stt, btn } = await listeningDeepgram();
    const requests = mic.calls.length;
    stt.noteSpokenStart('Still thinking.');
    stt.noteSpokenEnd();
    stt.noteSpokenStart('Nearly there.');            // the next one starts in the same moment
    await tick();
    assert.equal(mic.calls.length, requests, 'not reopened between them');
    stt.noteSpokenEnd();
    await tick();
    FakeWS.last.open();
    assert.equal(mic.calls.length - requests, 1);
    assert.deepEqual(btn.seen, ['listening']);
});

// ---- 6. Leaving the app while the microphone reopens ------------------------------

test('6a the request refused while the app is in the background is not an error, and listening comes back', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    // Assumed, and to check on an iPad: a hidden page has its request refused.
    mic.plan.push({ kind: 'not-allowed', delayMs: 50 });
    stt.noteSpokenEnd();
    await tick(5);                                   // the reopen's request is out
    env.setHidden(true);
    await tick(100);                                 // refused while away
    env.setHidden(false);
    await tick(20);
    FakeWS.last.open();
    assert.ok(!btn.seen.includes('error'), 'no false error (no red wash, nothing in the error log)');
    assert.equal(mic.open, 1, 'listening again');
    assert.equal(btn.lit, true);
});

test('6b back before the refusal arrives: asked once more, not reported, listening comes back', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    mic.plan.push({ kind: 'not-allowed', delayMs: 50 });
    stt.noteSpokenEnd();
    await tick(5);
    env.setHidden(true);
    await tick(10);
    env.setHidden(false);                            // back before the refusal
    await tick(100);
    FakeWS.last.open();
    assert.ok(!btn.seen.includes('error'));
    assert.equal(mic.open, 1);
    assert.equal(btn.lit, true);
});

test('6c a genuine refusal is still an error', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    mic.plan.push('not-allowed');
    stt.noteSpokenEnd();
    await tick(50);
    assert.ok(btn.seen.includes('error'));
    assert.equal(btn.lit, false);
});

test('6d (control) leaving during the phrase itself: listening comes back on return', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    env.setHidden(true);
    stt.noteSpokenEnd();
    await tick(20);
    const requests = mic.calls.length;
    env.setHidden(false);
    await tick(20);
    FakeWS.last.open();
    assert.equal(mic.calls.length - requests, 1, 'reopened on return');
    assert.equal(btn.lit, true);
});

// ---- 7. A quiet partner already talking when the microphone reopens --------------

test('7 after a holding phrase, a quiet partner who carries on talking is sent from the start', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    await onIpad(stt);
    const ROOM = 0.0004;   // Kenny's room, from his 0.15.2 report
    // A quiet talker whose loudest moments reach 0.008 (Kenny's wife beside him).
    const SYLLABLES = [0.005, 0.007, 0.008, 0.006, 0.004, 0.002, 0.006, 0.008, 0.007, 0.004, 0.003, 0.0015];
    const speech = (s) => Array.from({ length: Math.round((s * 1000) / 85) }, (_, i) => SYLLABLES[i % SYLLABLES.length]);
    const real = Date.now;
    let now = 9_000_000;
    Date.now = () => now;
    const play = (levels) => { for (const l of levels) { frame(l); now += 85; } };
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        play(Array(14).fill(ROOM));
        play(speech(3));
        assert.ok(FakeWS.last.audioFrames() > 0, 'heard before the phrase');
        play(Array(14).fill(ROOM));
        stt.noteSpokenStart('Still thinking.');
        stt.noteSpokenEnd();
        await tick();
        const ws = FakeWS.last;
        ws.open();
        play(speech(2));                             // they carry on at once
        assert.ok(ws.audioFrames() >= 20, `sent from the start (${ws.audioFrames()} frames)`);
    } finally { Date.now = real; }
});

// ---- 9. Smaller things -------------------------------------------------------------

test('9a after a reopen the report still shows the room it measured, and counts the reopen apart', async () => {
    micCheck._reset();
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    stt.init({ onResult() {}, onSilence() {}, onStatus() {}, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    await onIpad(stt);
    const real = Date.now;
    let now = 7_000_000;
    Date.now = () => now;
    try {
        stt.startListening();
        await tick();
        FakeWS.last.open();
        for (let i = 0; i < 20; i++) { frame(0.0004); now += 85; }
        stt.noteSpokenStart('Still thinking.');
        stt.noteSpokenEnd();
        await tick();
        FakeWS.last.open();
        frame(0.0004); now += 85;              // one frame after the reopen
        const line = micCheck.summary().split('\n')[0];
        assert.match(line, /quietRoom=0\.0004/);
        assert.match(line, /speech starts at 0\.004/);
        assert.match(line, /starts=2 reopensAfterSpeech=1/);
    } finally { Date.now = real; }
});

test('9b a start nobody is waiting for any more is not reported as "stuck"', async () => {
    micCheck._reset();
    const { stt } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    audioSession.captureContext().state = 'suspended';
    audioCtl.hangResume = true;
    stt.noteSpokenEnd();
    await tick(5);                              // the reopen is waiting for the audio
    stt.stopListening();                        // End conversation
    await tick(1700);
    assert.doesNotMatch(micCheck.summary(), /stuck/);
});

test('9c the saved conversation records the microphone closing and reopening for speech', async () => {
    const events = [];
    const { stt } = await listeningDeepgram({ events });
    stt.noteSpokenStart('Still thinking.');
    stt.noteSpokenEnd();
    await tick();
    FakeWS.last.open();
    assert.deepEqual(events, ['mic closed for speech', 'mic reopened after speech']);
});

test('9d each start leaves no silent audio piece behind when it stops', async () => {
    audioCtl.gains.length = 0;
    const { stt } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    stt.noteSpokenEnd();
    await tick();
    FakeWS.last.open();
    stt.stopListening();
    assert.ok(audioCtl.gains.length >= 2);
    assert.equal(audioCtl.gains.filter((g) => g.connected).length, 0, 'every one disconnected');
});

test('9e a Deepgram connection that cannot even be made gives the microphone back', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    const { createSource } = await import('../app/js/stt-deepgram.js');
    const statuses = [];
    const real = globalThis.WebSocket;
    globalThis.WebSocket = class { constructor() { throw new SyntaxError('bad protocol'); } };
    try {
        const src = createSource({ getKey: () => 'k ey', onText() {}, onStatus: (s, d) => statuses.push(`${s}:${d}`), onBilled() {} });
        const openBefore = mic.open;
        await src.start();
        assert.equal(mic.open, openBefore, 'the microphone is not left on');
        assert.ok(statuses.includes('error:connect-failed'));
    } finally { globalThis.WebSocket = real; }
});

// Item 9, Safari on a Mac: off an iPhone or iPad nothing here changes, even where the
// browser offers the audio-mode setting (this fake offers it).
test('9f off an iPad the microphone stays open while the app speaks, and the audio mode is never set', async () => {
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    audioSessionFake.type = 'auto';
    stt.startListening();
    await tick();
    FakeWS.last.open();
    const ws = FakeWS.last;
    stt.noteSpokenStart('Still thinking.');
    stt.noteSpokenEnd();
    await tick();
    assert.equal(ws.readyState, FakeWS.OPEN, 'the same connection, never closed');
    assert.equal(stt.isClosedForSpeech(), false);
    stt.stopListening();
    assert.equal(audioSessionFake.type, 'auto', 'a Mac offering the setting is left alone too');
});

// ---- Controls: paths that were already right, and must stay right ----------------

test('control 1: changing the hearing service mid-phrase: the button goes off, nothing reopens', async () => {
    const { stt, btn } = await listeningDeepgram();
    stt.noteSpokenStart('Still thinking.');
    const requests = mic.calls.length;
    assert.equal(stt.setSource('azure'), true);
    stt.noteSpokenEnd();
    await tick(50);
    assert.equal(btn.lit, false);
    assert.equal(mic.calls.length, requests, 'no microphone request from either service');
});

test('control 2: a microphone error while reopening: off with the error, and the next Listen works', async () => {
    const { stt, btn } = await listeningDeepgram();
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
});

test('control 3: a second phrase that starts before the first ends: one close, one reopen, no flicker', async () => {
    const { stt, btn } = await listeningDeepgram();
    const requests = mic.calls.length;
    stt.noteSpokenStart('Still thinking.');
    stt.noteSpokenStart('Nearly there.');
    stt.noteSpokenEnd();
    await tick();
    FakeWS.last.open();
    assert.equal(mic.calls.length - requests, 1, 'reopened once');
    assert.deepEqual(btn.seen, ['listening'], 'no flicker');
});

