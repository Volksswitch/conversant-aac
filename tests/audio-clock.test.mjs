// audio-clock.js: telling audio that is running from audio that only says it is
// (Ken's iPad, left open overnight, November 25 2026).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as clock from '../app/js/audio-clock.js';

// A fake context. `moving` decides whether its clock advances while the check waits.
function fakeCtx({ state = 'running', moving = true } = {}) {
    return {
        state, moving, currentTime: 10, closed: false,
        close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); },
    };
}
// The check's wait: advances every moving clock by the time waited.
function waitFor(...ctxs) {
    return async (ms) => { for (const c of ctxs) if (c.moving) c.currentTime += ms / 1000; };
}

beforeEach(() => clock._reset());

test('a running clock reads as running, a still one as stopped', async () => {
    const ok = fakeCtx();
    const dead = fakeCtx({ moving: false });
    assert.equal(await clock.check(ok, 400, waitFor(ok)), 'running');
    assert.equal(await clock.check(dead, 400, waitFor(dead)), 'stopped');
});

test('a context that is not running reports its own state, without waiting', async () => {
    let waited = false;
    const s = fakeCtx({ state: 'suspended', moving: false });
    assert.equal(await clock.check(s, 400, async () => { waited = true; }), 'suspended');
    assert.equal(waited, false);
    assert.equal(await clock.check(null), 'none');
});

test('describe names every context the app has made, and only those', async () => {
    const listening = fakeCtx();
    const voice = fakeCtx({ moving: false });
    clock.register('listening', () => listening);
    clock.register('Deepgram voice', () => voice);
    clock.register('tone', () => null);              // not made yet
    const line = await clock.describe({ wait: waitFor(listening, voice) });
    assert.match(line, /listening running/);
    assert.match(line, /Deepgram voice STOPPED/);
    assert.doesNotMatch(line, /tone/);
});

test('describe says so when nothing has been made', async () => {
    assert.equal(await clock.describe(), 'no audio made yet');
});

test('replaceStopped closes only a stopped context, and says when it happens twice', async () => {
    let listening = fakeCtx({ moving: false });
    const voice = fakeCtx();
    clock.register('listening', () => listening);
    clock.register('Deepgram voice', () => voice);
    const first = await clock.replaceStopped({ wait: waitFor(listening, voice) });
    assert.deepEqual(first.replaced, ['listening']);
    assert.equal(first.again, false);
    assert.equal(listening.closed, true);
    assert.equal(voice.closed, false);

    listening = fakeCtx({ moving: false });          // the new one stops too
    const second = await clock.replaceStopped({ wait: waitFor(listening, voice) });
    assert.deepEqual(second.replaced, ['listening']);
    assert.equal(second.again, true, 'a new connection did not help: time to reload');
    assert.match(await clock.describe({ wait: waitFor(listening, voice) }), /replaced this session: 2/);
});

test('a context that starts moving between the two checks is kept', async () => {
    const slow = fakeCtx({ moving: false });
    clock.register('listening', () => slow);
    let calls = 0;
    const wait = async (ms) => { calls++; if (calls >= 2) slow.moving = true; if (slow.moving) slow.currentTime += ms / 1000; };
    const r = await clock.replaceStopped({ wait });
    assert.deepEqual(r.replaced, []);
    assert.equal(slow.closed, false);
});

test('guardPlayback: a clock that does not move fails the sound quickly', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const c = fakeCtx({ moving: false });
    let stopped = 0, overdue = 0;
    clock.guardPlayback(c, 12, { onStopped: () => stopped++, onOverdue: () => overdue++ });
    t.mock.timers.tick(800);
    assert.equal(stopped, 1);
    t.mock.timers.tick(10_000);
    assert.equal(stopped, 1, 'fires once');
    assert.equal(overdue, 0);
});

test('guardPlayback: a sound past its end with no end report is let go', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const c = fakeCtx();
    let stopped = 0, overdue = 0;
    clock.guardPlayback(c, 12, { onStopped: () => stopped++, onOverdue: () => overdue++ });
    c.currentTime = 10.5; t.mock.timers.tick(800);   // moving: no early failure
    c.currentTime = 15; t.mock.timers.tick(5000);    // past the end + 3 s
    assert.equal(stopped, 0);
    assert.equal(overdue, 1);
});

test('guardPlayback: clearing it stops both checks', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const c = fakeCtx({ moving: false });
    let fired = 0;
    const clear = clock.guardPlayback(c, 12, { onStopped: () => fired++, onOverdue: () => fired++ });
    clear();
    t.mock.timers.tick(20_000);
    assert.equal(fired, 0);
});
