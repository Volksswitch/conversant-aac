// Passes only WHILE THE PROBLEM IS PRESENT: it asserts the wrong behavior. After the fix
// it fails; then rewrite it to assert the right behavior and move it into tests/.
// PROBLEM 8: in a quiet room the gate's "closing" level drops to 0.0024 and is frozen
// while the gate is open. A steady noise that starts during speech (a fan, a heater,
// a kettle) and sits above that level holds the gate open - everything is sent and
// billed until the noise stops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { url } from './harness.mjs';
const { createGate } = await import(url('app/js/vad.js'));

function minutesOpen({ adaptive }) {
    const g = createGate({ adaptive });
    let t = 0, openFrames = 0, closedAt = null;
    const push = (level, n) => { for (let i = 0; i < n; i++) { const e = g.push(level, t); if (e === 'close' && closedAt === null) closedAt = t; if (g.isOpen()) openFrames++; t += 85; } };
    push(0.0004, 24);        // two seconds of a quiet room
    push(0.05, 24);          // the partner speaks for two seconds
    push(0.004, 12 * 60 * 5); // a fan comes on as they finish, and runs five minutes
    return { closedAt, openSeconds: (openFrames * 85) / 1000 };
}

test('8 a fan that starts during speech holds the gate open (sent and billed) for as long as it runs', () => {
    const now = minutesOpen({ adaptive: true });
    const before = minutesOpen({ adaptive: false });
    console.log('8 room-following gate: open', now.openSeconds.toFixed(0), 's of', (2 + 300), 's; closed at', now.closedAt);
    console.log('8 the old fixed gate:  open', before.openSeconds.toFixed(0), 's; closed at', before.closedAt, 'ms');
    assert.ok(before.closedAt !== null, 'the old gate closed after the speech');
    assert.equal(now.closedAt, null, 'BUG: the new gate never closes while the fan runs');
});
