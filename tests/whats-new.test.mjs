/* Tier 1 — "What's new" semver + note collection (app/js/whats-new.js).
 * renderPanel is DOM and stays out of scope; the logic (compareVersions,
 * collectWhatsNew, pending + the silent-baseline gate) is covered here.
 */
import { resetLocalStorage, setSetting } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as whatsNew from '../app/js/whats-new.js';
import * as storage from '../app/js/storage.js';

beforeEach(() => resetLocalStorage());

test('compareVersions orders major.minor.patch, tolerating a leading v and missing parts', () => {
    assert.equal(whatsNew.compareVersions('0.5.80', '0.5.81'), -1);
    assert.equal(whatsNew.compareVersions('0.6.0', '0.5.99'), 1);
    assert.equal(whatsNew.compareVersions('v0.5.80', '0.5.80'), 0);
    assert.equal(whatsNew.compareVersions('1.0', '1.0.0'), 0);
    assert.equal(whatsNew.compareVersions('0.10.0', '0.9.0'), 1);   // numeric, not lexical
});

test('collectWhatsNew returns notes strictly between since and current, newest-version-first', () => {
    // Uses the real bundled RELEASE_NOTES. Pick a wide-but-bounded window.
    const notes = whatsNew.collectWhatsNew('0.5.70', '0.5.80');
    assert.ok(Array.isArray(notes));
    assert.ok(notes.length > 0, 'there are user-facing notes in that window');
    assert.ok(notes.every((n) => typeof n === 'string' && n.length));
    // Nothing newer than current leaks in.
    const empty = whatsNew.collectWhatsNew('0.5.80', '0.5.80');
    assert.deepEqual(empty, []);
});

test('pending: a brand-new install records the baseline silently and announces nothing', () => {
    assert.equal(storage.loadLastSeenVersion(), null);
    const notes = whatsNew.pending('0.5.81');
    assert.deepEqual(notes, [], 'the version introducing the notice cannot announce itself');
    assert.equal(storage.loadLastSeenVersion(), '0.5.81', 'baseline recorded');
});

test('pending: an updated install gets the in-between notes', () => {
    setSetting('lastSeenVersion', '0.5.78');
    const notes = whatsNew.pending('0.5.80');
    assert.ok(notes.length > 0, 'notes for 0.5.79..0.5.80');
});

test('pending: an up-to-date install gets nothing', () => {
    setSetting('lastSeenVersion', '0.5.81');
    assert.deepEqual(whatsNew.pending('0.5.81'), []);
    assert.deepEqual(whatsNew.pending('0.5.80'), []);   // seen is newer — still nothing
});
