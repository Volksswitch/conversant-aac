/* How long listening takes to start, through the whole path (Ken's iPad problem report,
 * November 23 2026: "Listening has a several second delay which misses the beginning of
 * the statement of the communication partner").
 *
 * Two changes, checked together because they cross layers: the Deepgram connection is
 * made while the listening tone plays and the microphone opens (stt.js, stt-deepgram.js),
 * and every start is timed step by step and judged in the problem report's listening
 * check (mic-check.js, listening-diagnosis.js). These drive the REAL listening code with
 * a fake microphone and connection (listening-fakes.mjs); nothing here fabricates the
 * facts handed to the next layer.
 *
 * WHAT THESE CANNOT SHOW: how long a real iPad takes for each step. That is what the
 * report's new "starts" lines are for.
 */
import { FakeWS, makeAudioContextClass, mic, appButton, freshStt, onIpad, offIpad, tick, frame }
    from './listening-fakes.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as micCheck from '../app/js/mic-check.js';
import { diagnoseListening } from '../app/js/listening-diagnosis.js';

let current = null;
afterEach(async () => {
    mic.plan.length = 0;
    if (current) {
        try { current.stopListening(); } catch { /* already stopped */ }
        await offIpad(current);
        current = null;
    }
});

async function deepgramOnIpad() {
    micCheck._reset();
    globalThis.window.AudioContext = makeAudioContextClass();
    const stt = await freshStt();
    current = stt;
    const btn = appButton();
    stt.init({ onResult() {}, onSilence() {}, onStatus: btn.onStatus, onPartnerSpeech() {},
        source: 'deepgram', getDeepgramKey: () => 'k' });
    await onIpad(stt);
    return { stt, btn };
}

const words = (t) => ({ data: JSON.stringify({ is_final: false, channel: { alternatives: [{ transcript: t }] } }) });

function check(stt) {
    return diagnoseListening({
        chosen: 'deepgram', test: { result: 'ok', message: 'ok' }, permission: 'granted',
        stt: stt.listeningFacts(), mic: micCheck.facts(),
    });
}

test('with the listening tone: connected during the tone, listening when the microphone is in, every step timed', async () => {
    const { stt, btn } = await deepgramOnIpad();
    const before = FakeWS.last;
    const asked = mic.calls.length;
    stt.startListening({ delayMs: 60 });               // the tone plays first
    assert.notEqual(FakeWS.last, before, 'the connection is being made during the tone');
    assert.equal(mic.calls.length, asked, 'while the microphone waits for the tone to finish');
    const ws = FakeWS.last;
    ws.open();                                          // connected before the tone ends
    assert.equal(btn.lit, false, 'not listening yet: there is no microphone');

    await tick(120);                                    // the tone is over, the microphone is in
    assert.equal(mic.calls.length, asked + 1);
    assert.equal(FakeWS.last, ws, 'the same connection, not a second one');
    assert.equal(btn.lit, true, 'listening the moment the microphone is in');

    for (let i = 0; i < 3; i++) frame(0.1);
    assert.ok(ws.audioFrames() >= 3, 'the sound goes straight out');
    ws.onmessage(words('Hello there'));

    const s = micCheck.facts().startTimes.at(-1);
    assert.equal(s.kind, 'start');
    assert.equal(s.tone, 60);
    for (const k of ['connected', 'mic', 'sound', 'listening', 'words']) assert.equal(typeof s[k], 'number', k);
    assert.ok(s.connected <= s.mic, 'connected before the microphone was in');
    assert.ok(s.mic <= s.sound && s.sound <= s.words);
    assert.match(micCheck.summary(), /\d\d:\d\d:\d\d\.\d{3} start {8}tone 60, mic \d+, sound \d+, connected \d+, listening \d+, words \d+/);
    const step = check(stt).steps.find((x) => x.name === 'The microphone started quickly');
    assert.equal(step.status, 'OK');
    assert.match(step.says, /Each included a 0\.06 s wait for the listening tone\.$/);
});

test('a reopen after the app speaks is timed as its own start', async () => {
    const { stt } = await deepgramOnIpad();
    stt.startListening();
    await tick();
    FakeWS.last.open();
    frame(0.1);
    stt.noteSpokenStart('Still thinking.');
    stt.noteSpokenEnd();
    await tick();
    FakeWS.last.open();
    frame(0.1);
    const kinds = micCheck.facts().startTimes.map((e) => e.kind);
    assert.deepEqual(kinds, ['start', 'after speech']);
    assert.equal(typeof micCheck.facts().startTimes[1].sound, 'number');
});

test('a microphone that takes over a second to open is named in the listening check', async () => {
    const { stt } = await deepgramOnIpad();
    mic.plan.push({ kind: 'ok', delayMs: 1100 });       // a slow iPad microphone
    stt.startListening();
    await tick(1200);
    FakeWS.last.open();
    frame(0.1);
    FakeWS.last.onmessage(words('one two three'));
    const d = check(stt);
    const step = d.steps.find((x) => x.name === 'The microphone started quickly');
    assert.equal(step.status, 'PROBLEM');
    // The first frame here is fed after the wait, so the time is a little over 1.1 s.
    const took = Number((step.says.match(/^Sound began arriving (\d+\.\d) s after listening was asked for/) || [])[1]);
    assert.ok(took >= 1.1 && took < 1.5, `took ${took} s`);
    assert.match(d.verdict, /^HEARING WORKED, BUT: The microphone started quickly/);
});
