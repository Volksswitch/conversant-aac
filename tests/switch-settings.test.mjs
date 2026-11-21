// Switch access settings (app/js/switch-settings.js): the starting values for each
// number of switches, what a stored value may be, and the switch keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTING_VALUES, normalizeScan, normalizeCount, changedFromStart, methodsFor,
         keyMap, keyName, raceWait, describeOtherKey } from '../app/js/switch-settings.js';

test('each number of switches has the Design section 4 starting values', () => {
    assert.equal(STARTING_VALUES[1].method, 'auto');
    assert.equal(STARTING_VALUES[1].speed, 1.5);
    assert.equal(STARTING_VALUES[1].forgiveMs, 300);
    assert.equal(STARTING_VALUES[2].method, 'step');
    assert.equal(STARTING_VALUES[2].forgiveMs, 0);
    assert.equal(STARTING_VALUES[3].method, 'step');
    for (const n of [1, 2, 3]) {
        assert.equal(STARTING_VALUES[n].repeatMs, 300);
        assert.equal(STARTING_VALUES[n].reading, 4);
        assert.equal(STARTING_VALUES[n].pattern, 'regions');
        assert.equal(STARTING_VALUES[n].newOpts, 'hold');
    }
});

test('one switch offers automatic, inverse and hold to move; two or three, step only', () => {
    assert.deepEqual(methodsFor(1), ['auto', 'inverse', 'hold']);
    assert.deepEqual(methodsFor(2), ['step']);
    assert.deepEqual(methodsFor(3), ['step']);
});

test('a stored value the app cannot use is replaced by the starting value', () => {
    const s = normalizeScan({ method: 'step', speed: -4, pattern: 'zigzag', stayKey: 'yes', reading: 6 }, 1);
    assert.equal(s.method, 'auto');           // step is not a one-switch method
    assert.equal(s.speed, 1.5);
    assert.equal(s.pattern, 'regions');
    assert.equal(s.stayKey, true);
    assert.equal(s.reading, 6);               // a good value is kept
    assert.equal(normalizeCount('7'), 0);
    assert.equal(normalizeCount(2), 2);
});

test('changes from the starting values are noticed, so the red card can ask first', () => {
    assert.equal(changedFromStart({}, 2), false);
    assert.equal(changedFromStart({ speed: 2 }, 1), true);
    assert.equal(changedFromStart({ speed: 2 }, 0), false);
});

test('a set key is added for its switch and taken from any other switch', () => {
    const m = keyMap({ 1: 'KeyF', 2: 'Digit1' });
    assert.equal(m.KeyF, 1);
    assert.equal(m.Space, 1);                 // the starting keys stay
    assert.equal(m.Digit1, 2);                // moved from switch 1 to switch 2
    assert.equal(m.Enter, 2);
    assert.equal(keyName('KeyF'), 'F');
    assert.equal(keyName('Numpad2'), 'Keypad 2');
});

/*
 * The record of switch presses in a problem report names a key that is not a switch,
 * because which key arrived is what tells a wrongly set interface from a silent one -
 * but a key that TYPES something only by its kind, so a report can never be read back
 * as what somebody typed (Ken, November 21 2026).
 */
test('a key that is not a switch is named, unless it would type something', () => {
    for (const c of ['KeyA', 'KeyZ']) assert.equal(describeOtherKey(c), 'a letter key');
    for (const c of ['Digit0', 'Digit9', 'Numpad5']) assert.equal(describeOtherKey(c), 'a number key');
    for (const c of ['Comma', 'Period', 'Slash', 'Quote', 'Semicolon', 'NumpadDecimal']) assert.equal(describeOtherKey(c), 'a symbol key');
    assert.equal(describeOtherKey('Tab'), 'key Tab');
    assert.equal(describeOtherKey('ArrowDown'), 'key ArrowDown');
    assert.equal(describeOtherKey('Escape'), 'key Escape');
    assert.equal(describeOtherKey(''), 'a key with no name');
});

test('while a switch is held the highlight speeds up evenly to the top speed', () => {
    const scan = { speed: 1.5, heldSpeed: 0.5, rampStops: 4 };
    assert.equal(raceWait(1, scan), 1.25);
    assert.equal(raceWait(4, scan), 0.5);
    assert.equal(raceWait(9, scan), 0.5);
    assert.equal(raceWait(1, { ...scan, rampStops: 0 }), 0.5);
});

/*
 * THE FIRST-LAUNCH QUESTION COMES BACK WHEN SWITCH ACCESS IS CLAIMED (Ken, November 21
 * 2026). It was hidden while switch access is unfinished, and a hidden thing is easy to
 * forget. The claim is made by taking "(in progress)" off the Switch Access tab in
 * Settings, so that is the moment this test watches: once the tab no longer says it,
 * ASK_ACCESS_ON_FIRST_LAUNCH in app.js must be true, or the build fails.
 */
test('the first-launch access question returns when the Switch Access tab stops saying "in progress"', async () => {
    const { readFile } = await import('node:fs/promises');
    const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../app/js/app.js', import.meta.url), 'utf8');
    const tab = html.match(/data-tab="switch"[^>]*>([^<]*)</);
    assert.ok(tab, 'the Switch Access tab was not found in index.html');
    const flag = app.match(/const ASK_ACCESS_ON_FIRST_LAUNCH\s*=\s*(true|false)\s*;/);
    assert.ok(flag, 'ASK_ACCESS_ON_FIRST_LAUNCH was not found in app.js');
    const claimed = !/in progress/i.test(tab[1]);
    if (claimed) {
        assert.equal(flag[1], 'true',
            'Switch access is now claimed (the tab no longer says "in progress"), so set '
            + 'ASK_ACCESS_ON_FIRST_LAUNCH to true in app.js to bring back the first-launch question.');
    }
});

/*
 * TOUCH BLOCKING COMES BACK THE SAME WAY (Ken, November 21 2026: "That 'rule' has to wait
 * for switch support to be comprehensive and not error prone"). Touch works alongside the
 * switches until switch access is claimed; then the rule of November 12 returns.
 */
test('touch blocking returns when the Switch Access tab stops saying "in progress"', async () => {
    const { readFile } = await import('node:fs/promises');
    const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
    const sa = await readFile(new URL('../app/js/switch-access.js', import.meta.url), 'utf8');
    const tab = html.match(/data-tab="switch"[^>]*>([^<]*)</);
    assert.ok(tab, 'the Switch Access tab was not found in index.html');
    const flag = sa.match(/const BLOCK_TOUCH_WITH_SWITCHES\s*=\s*(true|false)\s*;/);
    assert.ok(flag, 'BLOCK_TOUCH_WITH_SWITCHES was not found in switch-access.js');
    if (!/in progress/i.test(tab[1])) {
        assert.equal(flag[1], 'true',
            'Switch access is now claimed (the tab no longer says "in progress"), so touch '
            + 'blocking returns: set BLOCK_TOUCH_WITH_SWITCHES to true in switch-access.js.');
    }
});
