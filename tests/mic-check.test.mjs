import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as mic from '../app/js/mic-check.js';

const ctx = (state) => ({ state });
const stream = (label, muted = false) => ({ getAudioTracks: () => [{ label, muted }] });

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
