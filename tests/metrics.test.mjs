/* Tier 1 — the event capture (app/js/metrics.js).
 *
 * Only the pure half is exercised: the redaction, the per-day tally, the trim and the
 * roll-up. The effectful half writes to browser storage and to the data folder and is
 * verified in the browser.
 *
 * THE ONE THAT MATTERS IS THE REDACTION, and it is not routine coverage. Every other
 * privacy guard in this app is a rule somebody has to follow at a call site; this one
 * is meant to be structural, so that a mistaken `metrics.event('x', { partner: text })`
 * records nothing rather than quietly shipping a sentence in the weekly report. If
 * that test is ever loosened, the module stops being a guarantee and becomes a hope.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactFields, tally, trimDays, rollUp, dayKey, EV } from '../app/js/metrics.js';

test('redaction: counts, durations and small categories pass', () => {
    const out = redactFields({ n: 3, ms: 1200, auto: true, slot: 'PREFERRED' });
    assert.deepEqual(out, { n: 3, ms: 1200, auto: true, slot: 'PREFERRED' });
});

test('redaction: SPEECH IS DROPPED, whatever it is called', () => {
    const said = 'I had a really good weekend, thanks for asking';
    // `partner` is the exact name logError uses for captured speech, so it is the
    // mistake most likely to be made here by someone copying that pattern across.
    const out = redactFields({ partner: said, text: said, transcript: said, note: said, ms: 40 });
    assert.deepEqual(out, { ms: 40 }, 'no string reached the record');
    assert.equal(JSON.stringify(out).includes('weekend'), false);
});

test('redaction: a whitelisted name still cannot carry a sentence', () => {
    // The whitelist exists for category labels. Even there the value is cut short, so
    // a caller who put speech in `reason` would leak a fragment rather than a turn.
    const out = redactFields({ reason: 'x'.repeat(200) });
    assert.equal(out.reason.length, 24);
});

test('redaction: junk values are dropped rather than thrown on', () => {
    // This runs inside the conversation loop, so a bad value must cost nothing.
    const out = redactFields({ a: NaN, b: Infinity, c: null, d: undefined, e: {}, f: [], g: 1 });
    assert.deepEqual(out, { g: 1 });
});

test('tally: counts by day, and keeps duration samples so a median is possible', () => {
    const day = Date.parse('2026-08-16T10:00:00Z');
    const store = { days: {} };
    tally(store, EV.GENERATION, { ms: 1000 }, day);
    tally(store, EV.GENERATION, { ms: 3000 }, day);
    tally(store, EV.REGENERATE, {}, day);
    const k = dayKey(day);
    assert.equal(store.days[k].c[EV.GENERATION], 2);
    assert.equal(store.days[k].c[EV.REGENERATE], 1);
    assert.deepEqual(store.days[k].t[`${EV.GENERATION}.ms`], [1000, 3000]);
});

test('tally: separate days stay separate — that is what the curve is made of', () => {
    const store = { days: {} };
    tally(store, EV.APP_OPENED, {}, Date.parse('2026-08-16T10:00:00Z'));
    tally(store, EV.APP_OPENED, {}, Date.parse('2026-08-17T10:00:00Z'));
    assert.equal(Object.keys(store.days).length, 2);
});

test('trim forgets old days so the stored tally cannot grow without limit', () => {
    const now = Date.parse('2026-08-16T10:00:00Z');
    const store = { days: {
        '2026-01-01': { c: { a: 1 }, t: {} },
        [dayKey(now)]: { c: { a: 1 }, t: {} },
    } };
    trimDays(store, 60, now);
    assert.equal(store.days['2026-01-01'], undefined);
    assert.ok(store.days[dayKey(now)]);
});

test('rollUp gives both the totals and the per-day series', () => {
    const d1 = Date.parse('2026-08-16T10:00:00Z');
    const d2 = Date.parse('2026-08-17T10:00:00Z');
    const store = { days: {} };
    tally(store, EV.CARD_SELECTED, { decideMs: 2000 }, d1);
    tally(store, EV.CARD_SELECTED, { decideMs: 6000 }, d2);
    tally(store, EV.PALETTE_ABANDONED, {}, d2);
    const r = rollUp(store);
    assert.equal(r.totals[EV.CARD_SELECTED], 2);
    assert.equal(r.totals[EV.PALETTE_ABANDONED], 1);
    assert.equal(r.timings[`${EV.CARD_SELECTED}.decideMs`].median, 4000);
    // The per-day series is the half that makes "it stopped in week three" visible;
    // the totals alone would report the same figure either way.
    assert.equal(r.byDay[dayKey(d1)][EV.CARD_SELECTED], 1);
    assert.equal(r.byDay[dayKey(d2)][EV.PALETTE_ABANDONED], 1);
});

test('rollUp survives an empty store rather than throwing', () => {
    const r = rollUp({ days: {} });
    assert.deepEqual(r.totals, {});
    assert.equal(r.days, 0);
});
