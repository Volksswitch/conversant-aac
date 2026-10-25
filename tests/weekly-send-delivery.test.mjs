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

// CR-285. With browser storage full the weekly report cannot be queued, and then
// nothing is marked as sent: not the week, not the errors, not the system info.
test('a weekly report that cannot be queued leaves everything to be tried again', async () => {
    store.clear();
    offline();
    const now = Date.now();
    storage.saveWeeklySendLastAt(now - 10 * 86400000);
    storage.logError('test', 'something went wrong');
    const lastAt = storage.loadWeeklySendLastAt();
    const mark = storage.loadWeeklyErrorMark();
    const realSet = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = (k, v) => {
        if (k === 'aac_weekly_queue') throw new Error('QuotaExceededError');
        return realSet(k, v);
    };
    try {
        await weekly.maybeSend({ appVersion: '0.0.0', build: 'test', now });
    } finally {
        globalThis.localStorage.setItem = realSet;
    }
    assert.equal(storage.loadWeeklySendLastAt(), lastAt, 'the week is not marked done');
    assert.equal(storage.loadWeeklyErrorMark(), mark, 'the errors are not marked sent');
    assert.ok(storage.loadWeeklySendLog().some((e) => /could not be queued/.test(e.outcome)));
});

// CR-300. Two deliveries at once post each report once, and the queue ends empty.
test('overlapping deliveries post a report only once', async () => {
    store.clear();
    let posts = 0;
    globalThis.fetch = async () => {
        posts++;
        await new Promise((r) => setTimeout(r, 30));
        return { ok: true, status: 200, text: async () => 'ok' };
    };
    await Promise.all([send('once'), weekly.flush()]);
    assert.equal(posts, 1, 'the same report was not posted twice');
    assert.equal(storage.loadWeeklyQueue().length, 0);
});

// A problem report and the weekly report share one record of which errors have been
// sent, so each error reaches us once (Ken, October 11 2026).
test('sending a problem report marks its errors as sent, so the weekly report does not repeat them', async () => {
    store.clear();
    answer('ok');
    storage.saveWeeklyErrorMark('2026-10-01T00:00:00.000Z');
    await weekly.sendProblemReport({ note: 'x', report: 'body', appVersion: '0', build: 't', errorMark: '2026-10-11T19:22:00.000Z' });
    assert.equal(storage.loadWeeklyErrorMark(), '2026-10-11T19:22:00.000Z');
    const later = weekly.errorsSince([{ ts: '2026-10-11T19:22:00.000Z' }, { ts: '2026-10-12T08:00:00.000Z' }], storage.loadWeeklyErrorMark());
    assert.deepEqual(later.map((e) => e.ts), ['2026-10-12T08:00:00.000Z'], 'only the newer error is left for the weekly report');
    // An older mark never moves it backwards.
    await weekly.sendProblemReport({ note: 'y', report: 'body', appVersion: '0', build: 't', errorMark: '2026-09-01T00:00:00.000Z' });
    assert.equal(storage.loadWeeklyErrorMark(), '2026-10-11T19:22:00.000Z');
});

test('a mark that is not a date is ignored, so a device stuck on "?" reports again', () => {
    storage.saveWeeklyErrorMark('?');
    assert.equal(storage.loadWeeklyErrorMark(), '');
    const s = JSON.parse(localStorage.getItem('aac_settings') || '{}');
    s.weeklyErrorMark = '?';
    localStorage.setItem('aac_settings', JSON.stringify(s));
    assert.equal(storage.loadWeeklyErrorMark(), '', 'an old "?" already saved no longer hides errors');
});

// Security review, October 25 2026. The weekly report carried every setting with only
// the key values masked, and one setting is the user's "Words the voice gets wrong"
// list - names, medicines and brand names. Driven through the REAL maybeSend, so the
// check covers the whole path from the stored setting to the bytes posted, not just the
// redaction function on its own.
test('the weekly report never carries the words the user typed into a setting', async () => {
    store.clear();
    globalThis.location = { href: 'https://conversant.volksswitch.org/', hostname: 'conversant.volksswitch.org', protocol: 'https:' };
    storage.saveSpokenWords([{ word: 'Siobhan', say: 'Shiv-awn' }, { word: 'Humira', say: 'hyoo-MEER-uh' }]);
    storage.saveActiveSettingsProfile('Grandma Rosa house');
    storage.saveWeeklySendLastAt(1);       // long ago, so a report is due
    const bodies = [];
    globalThis.fetch = async (url, opts) => {
        // The system information also asks for the price list, which is not a report.
        if (opts && opts.method === 'POST') bodies.push(opts.body);
        return { ok: true, status: 200, text: async () => 'ok', json: async () => ({}) };
    };
    try {
        await weekly.maybeSend({ appVersion: '0.0.0', build: 'test' });
    } finally {
        delete globalThis.location;
    }
    assert.equal(bodies.length, 1, "a report was sent");
    const sent = JSON.parse(bodies[0]);
    assert.ok(sent.systemInfo && sent.systemInfo.settings, 'the settings block is in the report, so the check is not vacuous');
    for (const word of ['Siobhan', 'Shiv-awn', 'Humira', 'hyoo-MEER-uh', 'Grandma Rosa']) {
        assert.ok(!bodies[0].includes(word), `"${word}" must not leave the device`);
    }
    assert.equal(sent.systemInfo.settings.spokenWords, '(2 items - not included)');
});
