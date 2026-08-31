/* Tier 2 - does the app know whether a report was actually DELIVERED?
 *
 * WHY THIS EXISTS. The app used to post with mode 'no-cors', which makes the reply
 * unreadable, so every send was counted as a success - including the ones the far end
 * threw away. That is how reports were lost silently for six days in August 2026: the
 * endpoint was refusing every one and nothing anywhere could tell. It also mattered
 * more than it looks, because the plan for problem reports is now "press Send and
 * that is the whole procedure" - there is no file to fall back on, so a false success
 * is the difference between a report arriving and one vanishing without trace.
 *
 * These drive the REAL flush() and post() with a stubbed network, because the bug was
 * never in the decision of whether to send - it was in what the answer was taken to
 * mean afterwards.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
globalThis.window = { dispatchEvent() { return true; } };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
Object.defineProperty(globalThis, 'navigator', {
    value: { storage: { getDirectory: async () => { throw new Error('no storage'); } } },
    configurable: true, writable: true,
});
globalThis.indexedDB = undefined;

const weekly = await import('../app/js/weekly-send.js');
const storage = await import('../app/js/storage.js');

function answer(body, status = 200) {
    globalThis.fetch = async () => ({ ok: status >= 200 && status < 300, status, text: async () => body });
}
function offline() {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
}
const send = (note) => weekly.sendProblemReport({ note, report: 'body', appVersion: '0.0.0', build: 'test' });

test('a report the endpoint accepts counts as sent and leaves the queue', async () => {
    store.clear();
    answer('ok');
    const res = await send('accepted');
    assert.equal(res.sent, 1);
    assert.equal(storage.loadWeeklyQueue().length, 0);
});

test('a report the endpoint REFUSES is not counted as sent, and is KEPT', async () => {
    // The whole point. Before the reply was read this returned "sent" and the payload
    // was sliced off the queue - so the report was both miscounted AND destroyed, and
    // the tester was thanked for it.
    store.clear();
    answer('error: appendRow failed');
    const res = await send('refused');
    assert.equal(res.sent, 0, 'a refusal must never be counted as a send');
    assert.equal(res.queued, 1, 'and the report must survive to be tried again');
    assert.equal(storage.loadWeeklyQueue().length, 1);
    assert.match(storage.loadWeeklySendLog()[0].outcome, /refused/);
});

test('an unrecognised answer is treated as a refusal, not as success', async () => {
    // Anything other than the endpoint's own 'ok'. Calling an unknown answer a success
    // is precisely the failure being removed, so the default has to be distrust.
    store.clear();
    answer('<!DOCTYPE html><title>Sign in</title>');   // e.g. an auth page, not our script
    const res = await send('html');
    assert.equal(res.sent, 0);
    assert.equal(storage.loadWeeklyQueue().length, 1);
});

test('an HTTP error is a refusal even if the body happens to read ok', async () => {
    store.clear();
    answer('ok', 500);
    const res = await send('bad status');
    assert.equal(res.sent, 0);
    assert.equal(storage.loadWeeklyQueue().length, 1);
});

test('no connection keeps the report and says so, rather than losing it', async () => {
    store.clear();
    offline();
    const res = await send('offline');
    assert.equal(res.sent, 0);
    assert.equal(storage.loadWeeklyQueue().length, 1);
    assert.match(storage.loadWeeklySendLog()[0].outcome, /waiting for a connection/);
});

test('a report kept back is sent on a later run, once the endpoint accepts it', async () => {
    // What "it will go by itself next time you open the app" actually promises.
    store.clear();
    offline();
    await send('held');
    assert.equal(storage.loadWeeklyQueue().length, 1);
    answer('ok');
    const res = await weekly.flush();
    assert.equal(res.sent, 1);
    assert.equal(storage.loadWeeklyQueue().length, 0, 'and it leaves the queue only once accepted');
});
