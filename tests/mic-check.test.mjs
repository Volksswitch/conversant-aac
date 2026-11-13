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
