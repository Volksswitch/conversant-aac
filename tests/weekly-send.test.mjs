/* Tier 1 — the automatic weekly report (app/js/weekly-send.js).
 *
 * Only the pure half is exercised here: the schedule decision, the queue, the
 * redaction, and the disclosure. The effectful half (gathering, posting) needs
 * storage and a network and is verified in the browser.
 *
 * The two that matter most are the privacy guard and the drift guard, and neither
 * is routine coverage:
 *   - redactErrors must strip `extra`, because logError's extra.partner carries
 *     partner SPEECH and is only redacted today when a conversation was marked
 *     private. An automatic send must never carry it under any setting.
 *   - assemblePayload's keys must match PAYLOAD_FIELDS exactly. With no raw payload
 *     view in the UI, that field list IS the disclosure shown to the tester, so a
 *     new field added without a description would silently make the app's own
 *     privacy claim untrue — and nobody re-reads a disclosure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    shouldSend, enqueue, redactErrors, assemblePayload, describeReport,
    hashOf, formatSendLog, PAYLOAD_FIELDS, errorsSince, newestErrorTs,
} from '../app/js/weekly-send.js';

const DAY = 86400000;

test('schedule: first launch sends immediately, then weekly', () => {
    const now = Date.parse('2026-08-07T12:00:00Z');
    // lastAt 0 = never sent. Sending at setup proves the pipe while the tester is
    // still there, instead of it being found broken three weeks later.
    assert.equal(shouldSend({ enabled: true, lastAt: 0, now }), true);
    assert.equal(shouldSend({ enabled: true, lastAt: now - 6 * DAY, now }), false);
    assert.equal(shouldSend({ enabled: true, lastAt: now - 7 * DAY, now }), true);
    assert.equal(shouldSend({ enabled: true, lastAt: now - 40 * DAY, now }), true);
});

test('schedule: the off switch always wins, including at first launch', () => {
    const now = Date.now();
    assert.equal(shouldSend({ enabled: false, lastAt: 0, now }), false);
    assert.equal(shouldSend({ enabled: false, lastAt: now - 400 * DAY, now }), false);
});

/* The scenario this clause was built for, kept as a named test because it is the one
 * that actually happened: 0.7.0 shipped with no address, ran the routine on every
 * launch, and marked each week done anyway. A tester updating to an armed build is
 * therefore mid-week with a "done" marker, and without the endpoint check would wait
 * up to seven more days for a first report — the window in which nobody can tell
 * setup from breakage. */
test('schedule: arming the endpoint sends on the next launch, mid-week', () => {
    const now = Date.now();
    const URL = 'https://script.google.com/macros/s/AAA/exec';

    // An unarmed 0.7.0 launch three days ago recorded the date and no address.
    assert.equal(shouldSend({ enabled: true, lastAt: now - 3 * DAY, now, endpoint: URL, lastEndpoint: null }), true);
    // Same, for a build that recorded the empty address explicitly.
    assert.equal(shouldSend({ enabled: true, lastAt: now - 3 * DAY, now, endpoint: URL, lastEndpoint: '' }), true);
    // Once recorded, the address stops forcing it and the weekly rhythm resumes.
    assert.equal(shouldSend({ enabled: true, lastAt: now - 3 * DAY, now, endpoint: URL, lastEndpoint: URL }), false);
    assert.equal(shouldSend({ enabled: true, lastAt: now - 8 * DAY, now, endpoint: URL, lastEndpoint: URL }), true);
    // Moving to a different address is the same event and sends again.
    assert.equal(shouldSend({ enabled: true, lastAt: now - 1 * DAY, now, endpoint: 'https://elsewhere/exec', lastEndpoint: URL }), true);
});

test('schedule: an unarmed build never forces a send, and the off switch still wins', () => {
    const now = Date.now();
    // No address to send to: forcing one would rebuild a payload on every launch.
    assert.equal(shouldSend({ enabled: true, lastAt: now - 3 * DAY, now, endpoint: '', lastEndpoint: null }), false);
    // Disarming after being armed likewise does not force anything.
    assert.equal(shouldSend({ enabled: true, lastAt: now - 3 * DAY, now, endpoint: '', lastEndpoint: 'https://x/exec' }), false);
    // A changed address must never override the tester's decision to switch it off.
    assert.equal(shouldSend({ enabled: false, lastAt: now - 3 * DAY, now, endpoint: 'https://x/exec', lastEndpoint: null }), false);
    // The weekly rhythm is unaffected when the caller passes no endpoint at all.
    assert.equal(shouldSend({ enabled: true, lastAt: now - 8 * DAY, now }), true);
});

test('queue: bounded, dropping the OLDEST week', () => {
    let q = [];
    for (let i = 1; i <= 11; i++) q = enqueue(q, { week: i }, 8);
    assert.equal(q.length, 8);
    assert.equal(q[0].week, 4, 'weeks 1-3 were dropped');
    assert.equal(q[7].week, 11, 'the current week is kept');
});

// THE PRIVACY GUARD. extra.partner is partner speech.
test('redactErrors strips `extra` entirely — it can carry partner speech', () => {
    const out = redactErrors([{
        ts: '2026-08-07T10:00:00Z',
        version: '0.6.6',
        conversation: '20260807-100000',
        context: 'generate options',
        message: 'API error 429: rate limited',
        extra: { partner: 'I went to the doctor about my test results yesterday' },
    }]);
    assert.equal(out.length, 1);
    assert.equal('extra' in out[0], false, 'the whole field must be gone, not filtered');
    assert.equal(JSON.stringify(out).includes('doctor'), false, 'no partner speech may survive');
    assert.deepEqual(Object.keys(out[0]).sort(), ['context', 'conversation', 'message', 'ts']);
});

test('redactErrors caps message length and survives junk entries', () => {
    const out = redactErrors([
        { message: 'x'.repeat(5000), context: 'c' },
        null,
        { context: 'c2' },
    ], { maxMessage: 200 });
    assert.equal(out[0].message.length, 200);
    assert.equal(out[1].message, null);
    assert.equal(out[2].context, 'c2');
    assert.deepEqual(redactErrors('not an array'), []);
});

test('redactErrors keeps only the most recent entries', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ context: `c${i}`, message: 'm' }));
    const out = redactErrors(many, { max: 200 });
    assert.equal(out.length, 200);
    assert.equal(out[199].context, 'c299', 'the newest is kept');
});

// THE DRIFT GUARD. See the header — this is what makes the disclosure true.
test('every payload field has a description, and every description a field', () => {
    const payload = assemblePayload({
        testerName: 'Marc D', installId: 'abc', appVersion: '0.6.6', build: 'dev',
        now: Date.now(), coversDays: 7, usage: {}, errors: [], systemInfo: null,
    });
    const payloadKeys = Object.keys(payload).sort();
    const describedKeys = Object.keys(PAYLOAD_FIELDS).sort();
    assert.deepEqual(payloadKeys, describedKeys,
        'a field with no description would make the disclosure shown to the tester untrue');
});

test('the disclosure names what is never sent', () => {
    const text = describeReport();
    assert.match(text, /No transcripts, ever/);
    assert.match(text, /API keys/);
    assert.match(text, /turn them off/);
    for (const description of Object.values(PAYLOAD_FIELDS)) {
        assert.ok(text.includes(description), `missing from the disclosure: ${description}`);
    }
});

test('assemblePayload never carries a transcript field, whatever it is handed', () => {
    const payload = assemblePayload({
        testerName: 'Marc D', installId: 'abc', appVersion: '0.6.6', build: 'dev',
        now: Date.now(), coversDays: 7,
        usage: { conversations: 3 },
        errors: redactErrors([{ context: 'x', message: 'y', extra: { partner: 'SECRET SPEECH' } }]),
        systemInfo: null,
    });
    const json = JSON.stringify(payload);
    assert.equal(json.includes('SECRET SPEECH'), false);
    assert.equal(json.includes('rawTranscript'), false);
    assert.equal(json.includes('cleanedTranscript'), false);
    assert.equal(json.includes('selectedText'), false);
});

test('system info is compared by hash so an unchanged block is not resent', () => {
    const a = { screen: '1280x800', voices: 68 };
    const b = { screen: '1280x800', voices: 68 };
    const c = { screen: '1180x763', voices: 68 };
    assert.equal(hashOf(a), hashOf(b));
    assert.notEqual(hashOf(a), hashOf(c));
});

test('the sent log reads newest-first and never shows content', () => {
    const text = formatSendLog([
        { at: '2026-08-01T10:00:00Z', bytes: 2048, outcome: 'sent' },
        { at: '2026-08-08T10:00:00Z', bytes: 4096, outcome: 'waiting for a connection' },
    ]);
    const lines = text.split('\n');
    assert.match(lines[0], /waiting for a connection/, 'newest first');
    assert.match(lines[1], /sent/);
    assert.match(text, /2\.0 KB/);
    assert.equal(formatSendLog([]), 'Nothing sent yet.');
});

/* ── A weekly report carries only what is NEW (Ken, August 21 2026) ──────────
 *
 * Until this, the report re-sent the whole ring buffer every week, because
 * nothing cleared it. Measured before the fix: a week with ONE new error
 * reported THREE. The Sheet's error count then climbs on its own, and an alert
 * threshold fires once and every week after.
 */
test('errorsSince: with no mark, everything is new', () => {
    const es = [{ ts: '2026-08-01T00:00:00Z' }, { ts: '2026-08-02T00:00:00Z' }];
    assert.equal(errorsSince(es, '').length, 2);
});

test('errorsSince: only entries after the mark', () => {
    const es = [
        { ts: '2026-08-01T00:00:00Z', context: 'a' },
        { ts: '2026-08-02T00:00:00Z', context: 'b' },
        { ts: '2026-08-03T00:00:00Z', context: 'c' },
    ];
    assert.deepEqual(errorsSince(es, '2026-08-02T00:00:00Z').map(e => e.context), ['c']);
});

test('errorsSince: a quiet week sends nothing', () => {
    const es = [{ ts: '2026-08-01T00:00:00Z' }];
    assert.deepEqual(errorsSince(es, '2026-08-01T00:00:00Z'), []);
});

test('errorsSince: an entry with no timestamp is treated as new', () => {
    // It should never happen, but the failure directions are not equal: a duplicate
    // is noise, a dropped error loses the only record that it happened.
    const es = [{ context: 'no-stamp' }, { ts: '2026-08-01T00:00:00Z' }];
    assert.deepEqual(errorsSince(es, '2026-08-05T00:00:00Z').map(e => e.context), ['no-stamp']);
});

test('newestErrorTs: takes the latest, and never moves the mark backwards', () => {
    const es = [{ ts: '2026-08-01T00:00:00Z' }, { ts: '2026-08-03T00:00:00Z' }];
    assert.equal(newestErrorTs(es, ''), '2026-08-03T00:00:00Z');
    // An empty week must leave the mark where it was, or the next report re-sends.
    assert.equal(newestErrorTs([], '2026-08-03T00:00:00Z'), '2026-08-03T00:00:00Z');
    assert.equal(newestErrorTs([{ ts: '2026-07-01T00:00:00Z' }], '2026-08-03T00:00:00Z'),
        '2026-08-03T00:00:00Z');
});

test('the disclosure still says what is actually sent', () => {
    // The words are the only disclosure there is, so they must not drift from the
    // behaviour: the report carries errors SINCE THE LAST ONE, not all of them.
    assert.match(PAYLOAD_FIELDS.errors, /since the last report/i);
    assert.match(describeReport(), /No transcripts, ever/i);
});
