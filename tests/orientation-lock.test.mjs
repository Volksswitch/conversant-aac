/* Tier 1 - holding the screen upright or sideways (app/js/orientation-lock.js),
 * Ken, October 8 2026. The browser call is faked: what matters here is that a refusal
 * never throws, and that the status line points the user at the right fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, describeResult, lockTypeFor, lockAvailable } from '../app/js/orientation-lock.js';

const fakeScreen = (behavior) => {
    const calls = [];
    return { calls, orientation: {
        lock: async (t) => { calls.push(['lock', t]); if (behavior === 'refuse') throw Object.assign(new Error('no'), { name: 'NotSupportedError' }); },
        unlock: () => { calls.push(['unlock']); },
    } };
};

test('turn with the device lets go of any lock', async () => {
    const s = fakeScreen('ok');
    assert.equal(await apply('any', s), 'unlocked');
    assert.deepEqual(s.calls, [['unlock']]);
    assert.equal(lockTypeFor('any'), null);
});

test('upright and sideways ask the browser for that orientation', async () => {
    const s = fakeScreen('ok');
    assert.equal(await apply('portrait', s), 'locked');
    assert.equal(await apply('landscape', s), 'locked');
    assert.deepEqual(s.calls, [['lock', 'portrait'], ['lock', 'landscape']]);
});

test('a refusal is reported, never thrown', async () => {
    assert.equal(await apply('portrait', fakeScreen('refuse')), 'refused');
    assert.equal(await apply('portrait', { orientation: {} }), 'refused');   // no lock at all
    assert.equal(await apply('portrait', null), 'refused');
    assert.equal(lockAvailable({ orientation: {} }), false);
});

test('the status line points at the right fix', () => {
    assert.equal(describeResult('any', 'unlocked', false), '');
    assert.match(describeResult('portrait', 'locked', true), /upright/);
    assert.match(describeResult('landscape', 'locked', true), /sideways/);
    // Refused outside full screen and not installed: those two are the first things to try.
    assert.match(describeResult('portrait', 'refused', false), /Use the whole screen/);
    // Refused even in full screen: the device cannot do it.
    assert.match(describeResult('portrait', 'refused', true), /own rotation lock/);
});
