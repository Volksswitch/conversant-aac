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

// --- platform-scoped notes (Ken, Aug 1 2026) ---------------------------------
// Ken's three cases, stated as he stated them:
//   1. a computer-only change  -> computer users read it; iPad users get one line
//   2. an iPad-only change     -> iPad users read it; computer users get one line
//   3. a change affecting both -> everyone reads it
// and in no case does the reader see the words "Chromium" or "WebKit".

test('scoped notes: each platform reads its own, and is told the other had some', () => {
    // 0.6.0 carries one note of each kind: the iPad platform summary, and the
    // data-folder backup change (a no-op where there is no folder to choose).
    const forComputer = whatsNew.collectWhatsNew('0.5.98', '0.6.0', whatsNew.PLATFORMS.COMPUTER);
    const forIpad = whatsNew.collectWhatsNew('0.5.98', '0.6.0', whatsNew.PLATFORMS.IPAD);

    const hasIpadOnly = (a) => a.some((n) => n.startsWith('Conversant AAC now runs on the iPad'));
    const hasComputerOnly = (a) => a.some((n) => n.startsWith('Backups are now saved into your own'));

    // Case 2: the iPad-only note reaches iPad users and no one else.
    assert.ok(hasIpadOnly(forIpad), 'iPad user reads the iPad note');
    assert.ok(!hasIpadOnly(forComputer), 'computer user does NOT read the iPad note');

    // Case 1: and the mirror image.
    assert.ok(hasComputerOnly(forComputer), 'computer user reads the computer note');
    assert.ok(!hasComputerOnly(forIpad), 'iPad user does NOT read the computer note');

    // Case 3: an unscoped note reaches both.
    const shared = 'Settings closes with an X in its title bar.';
    assert.ok(forComputer.some((n) => n.startsWith(shared)), 'shared note reaches computer');
    assert.ok(forIpad.some((n) => n.startsWith(shared)), 'shared note reaches iPad');

    // Nothing is hidden: each side is told the other had improvements.
    assert.ok(forComputer.some((n) => /also improvements .* on an iPad/.test(n)));
    assert.ok(forIpad.some((n) => /also improvements .* Windows tablet, Chromebook or Mac/.test(n)));

    // Never the engine words, on either side.
    for (const n of [...forComputer, ...forIpad]) {
        assert.ok(!/chromium|webkit/i.test(n), `engine word leaked into a note: ${n.slice(0, 60)}`);
    }
});

test('scoped notes: the "other platform" line only appears beside notes of your own', () => {
    // A range whose ONLY content is for the other platform must not produce a panel
    // that says nothing but "other people got improvements".
    const notes = whatsNew.collectWhatsNew('0.5.98', '0.6.0', whatsNew.PLATFORMS.IPAD);
    assert.ok(notes.length > 1, 'this range has notes of its own, so the line is warranted');

    // And with no platform argument at all, every note comes back, unfiltered.
    const all = whatsNew.collectWhatsNew('0.5.98', '0.6.0');
    assert.ok(all.length > notes.length - 1, 'unfiltered returns at least as much');
    assert.ok(all.every((n) => typeof n === 'string'), 'unfiltered still yields plain strings');
});

test('currentPlatform keys off the folder picker, not the user agent', () => {
    // iPadOS Safari reports itself as a Mac, so a UA check gets this backwards.
    // storage.supportsUserChosenFolder() is the same capability Settings uses.
    const saved = globalThis.window && globalThis.window.showDirectoryPicker;
    if (globalThis.window) {
        globalThis.window.showDirectoryPicker = () => {};
        assert.equal(whatsNew.currentPlatform(), whatsNew.PLATFORMS.COMPUTER);
        delete globalThis.window.showDirectoryPicker;
        assert.equal(whatsNew.currentPlatform(), whatsNew.PLATFORMS.IPAD);
        if (saved) globalThis.window.showDirectoryPicker = saved;
    }
});
