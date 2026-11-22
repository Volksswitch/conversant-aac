/* Switch access ON/OFF and the NUMBER of switches are separate settings (Ken, November
 * 22 2026). Before that there was only `switchCount`, where 0 meant off; a device
 * upgraded from then must keep exactly what it had.
 */
import './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../app/js/storage.js';
import { resetLocalStorage } from './env.mjs';
import { keyMap, keyName, normalizeNumber } from '../app/js/switch-settings.js';

const KEY = 'aac_settings';
const put = (o) => globalThis.localStorage.setItem(KEY, JSON.stringify(o));

beforeEach(() => resetLocalStorage());

test('a stored count of 1-3 from before the split means switch access is on with that number', () => {
    put({ switchCount: 2 });
    assert.equal(storage.loadSwitchesOn(), true);
    assert.equal(storage.loadSwitchNumber(), 2);
    assert.equal(storage.loadSwitchCount(), 2);
});

test('a stored count of 0 means off, and the number waits at one switch', () => {
    put({ switchCount: 0 });
    assert.equal(storage.loadSwitchesOn(), false);
    assert.equal(storage.loadSwitchNumber(), 1);
    assert.equal(storage.loadSwitchCount(), 0);
});

test('nothing stored means off: a new user is a direct select user', () => {
    assert.equal(storage.loadSwitchesOn(), false);
    assert.equal(storage.loadSwitchCount(), 0);
});

test('turning switch access off and on again keeps the number and the scan settings', () => {
    put({ switchCount: 2, switchScan: { speed: 3 } });
    storage.saveSwitchesOn(false);
    assert.equal(storage.loadSwitchCount(), 0);
    assert.equal(storage.loadSwitchNumber(), 2);
    storage.saveSwitchesOn(true);
    assert.equal(storage.loadSwitchCount(), 2);
    assert.equal(storage.loadSwitchScan().speed, 3);
});

test('choosing the number while off does not turn switch access on', () => {
    storage.saveSwitchNumber(3);
    assert.equal(storage.loadSwitchesOn(), false);
    assert.equal(storage.loadSwitchNumber(), 3);
});

test('changing the number of an upgraded device keeps it on', () => {
    put({ switchCount: 1 });
    storage.saveSwitchNumber(2);
    assert.equal(storage.loadSwitchCount(), 2);
});

test('saveSwitchCount(0) turns off and keeps the number; 1-3 turns on', () => {
    storage.saveSwitchCount(3);
    assert.equal(storage.loadSwitchCount(), 3);
    storage.saveSwitchCount(0);
    assert.equal(storage.loadSwitchesOn(), false);
    assert.equal(storage.loadSwitchNumber(), 3);
});

test('a backup carrying "Use switches" is accepted only as true or false', () => {
    assert.equal(storage.settingValueOk('switchOn', true), true);
    assert.equal(storage.settingValueOk('switchOn', 'yes'), false);
});

test('the number is always 1-3', () => {
    assert.equal(normalizeNumber(0), 1);
    assert.equal(normalizeNumber('2'), 2);
    assert.equal(normalizeNumber(9), 1);
});

test('mouse buttons start as switches 1, 2 and 3 and can be set like keys', () => {
    assert.equal(keyMap({}).Mouse0, 1);
    assert.equal(keyMap({}).Mouse2, 2);
    assert.equal(keyMap({}).Mouse1, 3);
    // Right button set as switch 1: it leaves switch 2, and the left button stays switch 1.
    const m = keyMap({ 1: 'Mouse2' });
    assert.equal(m.Mouse2, 1);
    assert.equal(m.Mouse0, 1);
    // A key set as switch 1 that was switch 2 swaps it: Enter is now switch 1.
    assert.equal(keyMap({ 1: 'Enter' }).Enter, 1);
    assert.equal(keyName('Mouse0'), 'left mouse button');
    assert.equal(keyName('Mouse4'), 'mouse button 5');
    assert.equal(keyName('Enter'), 'Enter');
});
