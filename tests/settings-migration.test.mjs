/* Carrying removed settings forward.
 *
 * Two controls went in September 2026 - "Minimum spacing" and "Button size" - and each
 * held a value that still has to mean something, or somebody's screen quietly changes
 * shape on upgrade. A gap tightening is annoying; a keyboard springing back from
 * two-thirds of the screen to a third is the layout gone.
 *
 * ⚠ THE ROUTE MATTERS AS MUCH AS THE ARITHMETIC, and it is what these tests are really
 * for. A settings bundle becomes live four ways: an ordinary change, loading a named
 * profile, importing a backup, restoring one. The migration first ran once at start-up,
 * which caught the first and silently missed the other three - so loading a profile
 * saved last month would have reset the keyboard and tightened every gap, with nothing
 * on screen to say why. It now runs inside saveSettings, which all four pass through.
 */
import './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../app/js/storage.js';
import { resetLocalStorage } from './env.mjs';
import { solve } from '../app/js/conv-layout.js';

const KEY = 'aac_settings';
const put = (o) => globalThis.localStorage.setItem(KEY, JSON.stringify(o));
const get = () => JSON.parse(globalThis.localStorage.getItem(KEY));

beforeEach(() => resetLocalStorage());

test('a minimum bigger than the spacing becomes the spacing', () => {
    // They were getting the minimum as their real gap, because the app used whichever
    // was larger. Dropping the key without this tightens every gap on their device.
    put({ buttonGapPos: 10, minGapPos: 90 });
    storage.migrateStoredSettings();
    assert.equal(storage.loadButtonGapPos(), 90, 'the gap they actually had was not kept');
    assert.equal(get().minGapPos, undefined, 'the removed key should not linger');
});

test('a minimum smaller than the spacing changes nothing', () => {
    put({ buttonGapPos: 60, minGapPos: 20 });
    storage.migrateStoredSettings();
    assert.equal(storage.loadButtonGapPos(), 60);
});

test('a large button size becomes a dragged layout, for BOTH keyboard positions', () => {
    // One slider produced a different shape in each position, and the user may switch
    // between them - so both have to be written, not just the one in use.
    put({ buttonSizePos: 100, keyboardDock: 'bottom' });
    storage.migrateStoredSettings();

    const bottom = storage.loadConvLayout('bottom');
    const side = storage.loadConvLayout('side');
    assert.ok(bottom.dock > 0.5, `a full-size bottom keyboard should be over half the height, got ${bottom.dock}`);
    assert.ok(side.dock > 0.75, `a full-size side keyboard should be over three quarters of the width, got ${side.dock}`);
    assert.equal(get().buttonSizePos, undefined, 'the removed key should not linger');
});

test('the middle of the old slider writes NO layout, which is how it stays the default', () => {
    // 50 was the default and meant "no change". Writing an explicit layout for it would
    // pin the user to numbers they never chose - and worse, it would freeze today's
    // defaults into their settings, so a later change to what the app ships would never
    // reach them. Leaving it absent is what makes the defaults apply.
    put({ buttonSizePos: 50 });
    storage.migrateStoredSettings();
    assert.deepEqual(storage.loadConvLayout('bottom'), {},
        'the middle of the slider should leave the layout alone entirely');
    assert.deepEqual(storage.loadConvLayout('side'), {});
    assert.equal(get().buttonSizePos, undefined, 'the removed key should still be cleared');

    // ...and an absent layout means the shipped one, which is the point.
    const solved = solve({}, { dock: 'bottom', width: 1280, height: 800, rem: 16, cards: 4, gap: 0 });
    assert.ok(Math.abs(solved.dock - 0.30) < 0.001, `expected the shipped 30%, got ${solved.dock}`);
    assert.ok(Math.abs(solved.command - 0.10) < 0.001);
    assert.ok(Math.abs(solved.response - 0.30) < 0.001);
});

test('a SMALL button size becomes a wider gap, because that is all it ever did', () => {
    // Left of centre the slider moved no border - it only widened the gaps, which is
    // what Button spacing does. The two ranges are the same 1.4rem, so it converts
    // exactly: a full left-shrink is a full gap slider.
    put({ buttonSizePos: 0, buttonGapPos: 0 });
    storage.migrateStoredSettings();
    assert.equal(storage.loadButtonGapPos(), 100, 'a full shrink should be a full gap');
    // ...and it must not invent a layout, because it never moved a border.
    assert.equal(get().convLayout, undefined, 'a shrink wrote a layout it never caused');
});

test('a layout the user has already dragged is never overwritten', () => {
    // A deliberate drag outranks a reconstruction of a slider they no longer have.
    put({ buttonSizePos: 100, convLayout: { bottom: { command: 0.2, response: 0.2, dock: 0.4 } } });
    storage.migrateStoredSettings();
    const b = storage.loadConvLayout('bottom');
    assert.equal(b.dock, 0.4, 'the dragged layout was replaced by the migrated one');
    // The position they had NOT dragged is still filled in.
    assert.ok(storage.loadConvLayout('side').dock > 0.75);
});

test('it is idempotent - running it again changes nothing', () => {
    put({ buttonSizePos: 90, minGapPos: 70, buttonGapPos: 10 });
    storage.migrateStoredSettings();
    const once = JSON.stringify(get());
    storage.migrateStoredSettings();
    storage.migrateStoredSettings();
    assert.equal(JSON.stringify(get()), once);
});

test('THE ROUTE THAT WAS MISSED: an old profile arriving later is migrated too', () => {
    // This is the case the first version got wrong. The app has been running for a
    // while on a current bundle; the user then loads a profile saved months ago, which
    // still carries both removed keys. Loading a profile REPLACES the portable
    // settings, so without a migration on that path their keyboard resets and their
    // gaps tighten.
    put({ buttonGapPos: 30 });              // the current state, already migrated
    storage.applyPortableSettings({ buttonSizePos: 100, minGapPos: 80, buttonGapPos: 5 });

    assert.equal(get().buttonSizePos, undefined, 'the old key survived a profile load');
    assert.equal(get().minGapPos, undefined, 'the old key survived a profile load');
    assert.equal(storage.loadButtonGapPos(), 80, 'the gap from the profile was not carried forward');
    assert.ok(storage.loadConvLayout('bottom').dock > 0.5,
        'the keyboard size from the profile was lost');
});

test('a bundle with neither key passes through untouched', () => {
    const clean = { buttonGapPos: 40, keyboardDock: 'side', voiceURI: 'x' };
    put(clean);
    storage.migrateStoredSettings();
    assert.deepEqual(get(), clean, 'a current bundle should not be rewritten at all');
});

test('a dragged layout survives an ordinary settings change', () => {
    // saveSettings runs the migration on EVERY write, so it has to be a no-op for the
    // overwhelmingly common case of somebody changing an unrelated setting.
    storage.saveConvLayout('bottom', { command: 0.12, response: 0.33, dock: 0.35 });
    storage.saveButtonGapPos(55);
    storage.saveKeyboardDock('side');
    assert.deepEqual(storage.loadConvLayout('bottom'),
        { command: 0.12, response: 0.33, dock: 0.35 });
});
