/* Tier 1 — control-phrases reconciliation (app/js/control-phrases.js).
 *
 * Covers the seeded-watermark additive-merge policy (Ken, July 8 2026): new
 * default openers/closers append for existing users, a user's deletions stick, and
 * a user's edits are never clobbered. Driven through the localStorage cache path
 * (no data folder), which runs the same normalize + mergeNewDefaults logic.
 */
import { resetLocalStorage } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as cp from '../app/js/control-phrases.js';

const CACHE_KEY = 'aac_control_phrases';
const seedCache = (obj) => localStorage.setItem(CACHE_KEY, JSON.stringify(obj));

beforeEach(() => resetLocalStorage());

test('fresh load (no cache) yields all defaults, fully watermarked', async () => {
    const p = await cp.load();
    assert.deepEqual(p.openers, cp.DEFAULTS.openers);
    assert.deepEqual(p.windDowns, cp.DEFAULTS.windDowns);
    assert.deepEqual(p.closings, cp.DEFAULTS.closings);
    assert.deepEqual(p.seeded.openers, cp.DEFAULTS.openers, 'all defaults are watermarked on a fresh load');
    assert.deepEqual(p.seeded.closings, cp.DEFAULTS.closings, 'closings watermarked too');
});

test('a NEW default (not in the watermark) is appended once, at the end', async () => {
    // Simulate a stored set from an older release: it has all current defaults
    // EXCEPT the last opener, and its watermark reflects that older set.
    const older = cp.DEFAULTS.openers.slice(0, -1);
    const newDefault = cp.DEFAULTS.openers.at(-1);
    seedCache({ openers: older, windDowns: cp.DEFAULTS.windDowns, closings: cp.DEFAULTS.closings,
        seeded: { openers: older, windDowns: cp.DEFAULTS.windDowns, closings: cp.DEFAULTS.closings } });
    const p = await cp.load();
    assert.equal(p.openers.at(-1), newDefault, 'the new default is appended at the end');
    assert.equal(p.openers.filter((o) => o === newDefault).length, 1, 'appended exactly once');
    assert.ok(p.seeded.openers.includes(newDefault), 'and recorded in the watermark');
});

test('a default the user DELETED (in the watermark, absent from the list) is NOT resurrected', async () => {
    const deleted = cp.DEFAULTS.openers[0];
    const kept = cp.DEFAULTS.openers.slice(1);
    // Watermark includes ALL defaults (so nothing is "new"), but the list is missing the first.
    seedCache({ openers: kept, windDowns: cp.DEFAULTS.windDowns, closings: cp.DEFAULTS.closings,
        seeded: { openers: cp.DEFAULTS.openers, windDowns: cp.DEFAULTS.windDowns, closings: cp.DEFAULTS.closings } });
    const p = await cp.load();
    assert.ok(!p.openers.includes(deleted), 'the deleted default stays gone');
});

test('a user edit (custom opener) survives load and is not touched by the merge', async () => {
    const custom = 'Yo, you free?';
    seedCache({ openers: [custom], windDowns: cp.DEFAULTS.windDowns, closings: cp.DEFAULTS.closings,
        seeded: { openers: cp.DEFAULTS.openers, windDowns: cp.DEFAULTS.windDowns, closings: cp.DEFAULTS.closings } });
    const p = await cp.load();
    assert.ok(p.openers.includes(custom), 'the custom opener is kept');
});

test('setPhrases carries the watermark forward so a deletion sticks across the next load', async () => {
    await cp.load();                       // seeds full watermark
    const trimmed = cp.DEFAULTS.openers.slice(1);   // user deletes the first opener
    cp.setPhrases({ openers: trimmed, windDowns: cp.DEFAULTS.windDowns, closings: cp.DEFAULTS.closings, holdOn: cp.DEFAULTS.holdOn, pardon: cp.DEFAULTS.pardon });
    const p = await cp.load();             // reload
    assert.ok(!p.openers.includes(cp.DEFAULTS.openers[0]), 'deletion persisted (watermark carried forward)');
});

test('resetPhrases restores every default and re-watermarks them all', async () => {
    seedCache({ openers: ['only this'], windDowns: ['later'], closings: ['bye'],
        seeded: { openers: ['only this'], windDowns: ['later'], closings: ['bye'] } });
    await cp.load();
    const p = cp.resetPhrases();
    assert.deepEqual(p.openers, cp.DEFAULTS.openers);
    assert.deepEqual(p.windDowns, cp.DEFAULTS.windDowns);
    assert.deepEqual(p.closings, cp.DEFAULTS.closings);
});

test('a legacy file (single `closers` list, no windDowns/closings) reseeds both from defaults', async () => {
    // The old shape had one mixed `closers` list and no new keys. It can't be
    // auto-classified, so both new lists reseed from defaults and the legacy list
    // is ignored (Ken — single-user pre-beta; re-edit via the Controls editor).
    seedCache({ openers: cp.DEFAULTS.openers, closers: ['I should get going.', 'Bye!'],
        seeded: { openers: cp.DEFAULTS.openers, closers: ['I should get going.', 'Bye!'] } });
    const p = await cp.load();
    assert.deepEqual(p.windDowns, cp.DEFAULTS.windDowns, 'wind-downs reseeded from defaults');
    assert.deepEqual(p.closings, cp.DEFAULTS.closings, 'closings reseeded from defaults');
    assert.equal(p.closers, undefined, 'the legacy key is dropped');
});
