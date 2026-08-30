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

test('declineClosing is a list of defaults and survives an edit round-trip', async () => {
    await cp.load();
    assert.deepEqual(cp.getPhrases().declineClosing, cp.DEFAULTS.declineClosing);
    assert.match(cp.getPhrases().declineClosing[0], /before you go/i);
    cp.setPhrases({ ...cp.getPhrases(), declineClosing: ['Hang on, one more thing.'] });
    assert.deepEqual(cp.getPhrases().declineClosing, ['Hang on, one more thing.']);
});

test('a stored file predating declineClosing falls back to the defaults', async () => {
    // Files written before this phrase existed must not yield an empty card — an
    // empty phrase renders no decline option at all.
    seedCache({ holdOn: 'x', openers: ['Hi'], windDowns: ['Bye soon'], closings: ['Bye'] });
    const p = await cp.load();
    assert.deepEqual(p.declineClosing, cp.DEFAULTS.declineClosing);
    assert.equal(p.holdOn, 'x', 'the rest of the stored file is untouched');
});

// Both of these were a single string until August 29 2026. A file written before
// then must keep the user's own wording — losing a phrase somebody reworded to
// sound like themselves is the one outcome the additive-merge rule exists to
// prevent — and it must come FIRST, where it is reached soonest.
test('a single stored phrase becomes the first entry of the list', async () => {
    seedCache({ pardon: 'Say that again, love.', declineClosing: 'Hold up a sec.',
        openers: ['Hi'], windDowns: ['Bye soon'], closings: ['Bye'] });
    const p = await cp.load();
    assert.equal(p.pardon[0], 'Say that again, love.');
    assert.equal(p.declineClosing[0], 'Hold up a sec.');
    for (const d of cp.DEFAULTS.pardon) assert.ok(p.pardon.includes(d), `default appended: ${d}`);
    for (const d of cp.DEFAULTS.declineClosing) assert.ok(p.declineClosing.includes(d), `default appended: ${d}`);
});

test('pickPhrase never returns the same phrase twice running', async () => {
    await cp.load();
    let last = null;
    for (let i = 0; i < 40; i++) {
        const got = cp.pickPhrase('pardon');
        assert.ok(cp.DEFAULTS.pardon.includes(got), 'a real phrase');
        assert.notEqual(got, last, 'not the same one twice in a row');
        last = got;
    }
});

test('pickPhrase skips blank rows and copes with an emptied list', async () => {
    await cp.load();
    // The editor keeps a blank row so there is something to type into; speaking one
    // would be a moment of silence exactly where a phrase was expected.
    cp.setPhrases({ ...cp.getPhrases(), pardon: ['', 'Say again?', ''] });
    assert.equal(cp.pickPhrase('pardon'), 'Say again?');
    cp.setPhrases({ ...cp.getPhrases(), pardon: [''] });
    assert.equal(cp.pickPhrase('pardon'), '', 'nothing to say rather than a blank utterance');
});

test('nextPhrase walks the list in order and wraps', async () => {
    await cp.load();
    cp.setPhrases({ ...cp.getPhrases(), declineClosing: ['one', 'two', 'three'] });
    const seen = [cp.nextPhrase('declineClosing'), cp.nextPhrase('declineClosing'),
        cp.nextPhrase('declineClosing'), cp.nextPhrase('declineClosing')];
    assert.deepEqual(seen.slice(0, 3).sort(), ['one', 'three', 'two'], 'every entry is reachable');
    assert.equal(seen[3], seen[0], 'and it wraps back round');
});
