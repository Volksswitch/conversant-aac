// Switch access settings (app/js/switch-settings.js): the starting values for each
// number of switches, what a stored value may be, and the switch keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTING_VALUES, normalizeScan, normalizeCount, changedFromStart, methodsFor,
         keyMap, keyName, raceWait } from '../app/js/switch-settings.js';

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

test('while a switch is held the highlight speeds up evenly to the top speed', () => {
    const scan = { speed: 1.5, heldSpeed: 0.5, rampStops: 4 };
    assert.equal(raceWait(1, scan), 1.25);
    assert.equal(raceWait(4, scan), 0.5);
    assert.equal(raceWait(9, scan), 0.5);
    assert.equal(raceWait(1, { ...scan, rampStops: 0 }), 0.5);
});
