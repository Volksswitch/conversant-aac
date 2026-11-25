import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as mic from '../app/js/mic-check.js';

const ctx = (state) => ({ state });
const stream = (label, muted = false, settings = {}) =>
    ({ getAudioTracks: () => [{ label, muted, getSettings: () => settings }] });

beforeEach(() => mic._reset());

test('a start where no sound ever arrives is counted', () => {
    mic.noteStart({ stream: stream('iPad Microphone'), audioCtx: ctx('suspended') });
    mic.noteStop();
    const s = mic.summary();
    assert.match(s, /starts=1/);
    assert.match(s, /audioNotRunningAtStart=suspendedx1/);
    assert.match(s, /startsWithNoSound=1/);
    assert.match(s, /frames=0/);
    assert.match(s, /input=built-inx1/);
});

test('quiet sound is told apart from no sound', () => {
    mic.noteStart({ stream: stream('iPad Microphone'), audioCtx: ctx('running') });
    mic.noteFrame(0.004); mic.noteFrame(0.007);
    mic.noteStop();
    const s = mic.summary();
    assert.match(s, /startsWithNoSound=0/);
    assert.match(s, /frames=2/);
    assert.match(s, /loudest=0\.007 \(speech starts at 0\.020\)/);
    assert.match(s, /speechDetected=0/);
    assert.match(s, /audioNotRunningAtStart=none/);
});

test('a run still in progress with no sound counts as silent', () => {
    mic.noteStart({ stream: stream('x'), audioCtx: ctx('running') });
    assert.match(mic.summary(), /startsWithNoSound=1/);
});

test('the device name is reduced to a kind and never kept', () => {
    mic.noteStart({ stream: stream("Kenny's AirPods Pro"), audioCtx: ctx('running') });
    const s = mic.summary();
    assert.match(s, /Bluetooth or headset/);
    assert.doesNotMatch(s, /Kenny/);
});

test('nothing to report before any paid listening', () => {
    assert.equal(mic.summary(), 'no paid listening this session');
});

test('the report shows how loud the room was, by band, and the bar actually used', () => {
    mic.noteStart({ stream: stream('iPad Microphone'), audioCtx: ctx('running') });
    for (let i = 0; i < 10; i++) mic.noteFrame(0.0015, { floor: 0.0015, open: 0.006 });
    mic.noteFrame(0.008, { floor: 0.0015, open: 0.006 });
    const s = mic.summary();
    assert.match(s, /speech starts at 0\.006/);
    assert.match(s, /quietRoom=0\.0015/);
    assert.match(s, /levels: 0\.001-0\.002:10 0\.008-0\.016:1/);
});

test('the report says what the device did to the microphone', () => {
    mic.noteStart({
        stream: stream('iPad Microphone', false,
            { echoCancellation: true, noiseSuppression: false, sampleRate: 48000 }),
        audioCtx: { state: 'running', sampleRate: 44100 },
    });
    assert.match(mic.summary(),
        /settings: echoCancellation=on noiseSuppression=off autoGainControl=\? micRate=48000 audioRate=44100/);
});

// Ken's iPad report, November 23 2026: each start's steps are timed from the moment
// listening was asked for, because nothing said before sound arrives can be kept.
test('each start is timed step by step, from the moment listening was asked for', () => {
    const t = Date.parse('2026-11-23T19:51:43.544Z');
    mic.noteAsked({ kind: 'start', toneMs: 550, at: t });
    mic.noteStage('connected', t + 900);
    mic.noteStage('mic', t + 1800);
    mic.noteStage('sound', t + 1890);
    mic.noteStage('listening', t + 1890);
    mic.noteStage('words', t + 4100);
    mic.noteStage('words', t + 9000);                  // only the first counts
    const s = mic.summary();
    assert.match(s, /starts \(ms after listening was asked for, UTC\):/);
    assert.match(s, /19:51:43\.544 start {8}tone 550, mic 1800, sound 1890, connected 900, listening 1890, words 4100/);
    const [entry] = mic.facts().startTimes;
    assert.deepEqual(entry, { at: t, kind: 'start', tone: 550, connected: 900, mic: 1800, sound: 1890, listening: 1890, words: 4100 });
});

test('the steps come from the real microphone calls, and a start with no sound says so', () => {
    mic.noteAsked({ kind: 'after speech' });
    mic.noteStart({ stream: stream('iPad Microphone'), audioCtx: ctx('running') });
    mic.noteConnected();
    mic.noteFrame(0.01);
    mic.noteFrame(0.02);
    mic.noteStop();
    mic.noteAsked({ kind: 'resume' });                 // asked, but nothing arrived
    const [first, second] = mic.facts().startTimes;
    assert.equal(first.kind, 'after speech');
    for (const k of ['mic', 'connected', 'sound']) assert.equal(typeof first[k], 'number', k);
    assert.equal(second.sound, undefined);
    assert.match(mic.summary(), /resume {7}no sound/);
});

test('asking again while the microphone is already open is shown as such, not as a slow start', () => {
    mic.noteAsked({ kind: 'start' });
    mic.noteStart({ stream: stream('x'), audioCtx: ctx('running') });
    mic.noteFrame(0.01);
    mic.noteAsked({ kind: 'start' });
    mic.noteStage('listening');
    const entries = mic.facts().startTimes;
    assert.equal(entries[1].already, true);
    assert.equal(entries[1].listening, undefined);
    assert.match(mic.summary(), /\(already listening\)/);
});

test('only the last twelve starts are kept', () => {
    for (let i = 0; i < 15; i++) mic.noteAsked({ kind: 'start', at: 1000 * i });
    const entries = mic.facts().startTimes;
    assert.equal(entries.length, 12);
    assert.equal(entries[0].at, 3000);
});

// ---- no sound at all is logged (Ken, November 24 2026) ----
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('a run with no sound reports once, naming the audio state and input', async () => {
    const got = [];
    mic.setNoSoundReporter((m) => got.push(m));
    mic._setNoSoundMs(20);
    mic.noteStart({ stream: stream('iPhone Microphone'), audioCtx: ctx('running') });
    await wait(50);
    assert.equal(got.length, 1);
    assert.match(got[0], /no sound arrived/);
    assert.match(got[0], /running at start and running now/);
    assert.match(got[0], /input built-in/);
    assert.doesNotMatch(got[0], /iPhone Microphone/);   // the device name is never kept
});

test('a run that gets sound does not report', async () => {
    const got = [];
    mic.setNoSoundReporter((m) => got.push(m));
    mic._setNoSoundMs(20);
    mic.noteStart({ stream: stream('x'), audioCtx: ctx('running') });
    mic.noteFrame(0.0001);   // a silent room is still sound arriving
    await wait(50);
    assert.equal(got.length, 0);
});

test('a run stopped before the wait does not report', async () => {
    const got = [];
    mic.setNoSoundReporter((m) => got.push(m));
    mic._setNoSoundMs(20);
    mic.noteStart({ stream: stream('x'), audioCtx: ctx('running') });
    mic.noteStop();
    await wait(50);
    assert.equal(got.length, 0);
});

test('only the first silent run of a session reports', async () => {
    const got = [];
    mic.setNoSoundReporter((m) => got.push(m));
    mic._setNoSoundMs(20);
    for (let i = 0; i < 3; i++) {
        mic.noteStart({ stream: stream('x'), audioCtx: ctx('running') });
        await wait(40);
        mic.noteStop();
    }
    assert.equal(got.length, 1);
    assert.match(mic.summary(), /startsWithNoSound=3/);   // still counted
});

test('a reporter that throws cannot break listening', async () => {
    mic.setNoSoundReporter(() => { throw new Error('boom'); });
    mic._setNoSoundMs(20);
    mic.noteStart({ stream: stream('x'), audioCtx: ctx('running') });
    await wait(50);
    mic.noteFrame(0.01);
    assert.match(mic.summary(), /frames=1/);
});
