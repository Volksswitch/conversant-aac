/* Tier 1 — the test harness's own rules.
 *
 * WHY THIS FILE EXISTS. `npm test` is what RELEASING.md treats as the pre-release
 * gate, so whether it is DETERMINISTIC is a property of the release process rather
 * than a detail of the tests. It was not: Tier 3 makes six real calls to the model and
 * asserts on what the model chose to return, and it ran on any machine that happened
 * to have a key file — which is every machine used to prepare a release.
 *
 * ⚠ THE FAILURE THAT PROMPTED IT IS THE ARGUMENT FOR GUARDING IT. On September 6 2026
 * one run reported 770 of 771 with no way to tell which test, and it never recurred in
 * seven further runs. An unreproducible failure in a gate is worse than no gate,
 * because it teaches you to ignore the gate — and the next real failure is then read as
 * "the flaky one again".
 *
 * Nothing else would catch a regression here: re-enabling the live tier by default
 * makes no test fail, produces no error, and looks exactly like a normal run until the
 * day one flakes.
 */
import { liveTestsEnabled } from './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Run `liveTestsEnabled()` against a specific environment rather than the real one, so
// the assertions hold however this file was invoked — including under
// `CONVERSANT_LIVE=1 npm test`, where the real environment says the opposite.
function withEnv(vars, fn) {
    const saved = {};
    for (const [k, v] of Object.entries(vars)) {
        saved[k] = process.env[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    try {
        return fn();
    } finally {
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }
}

test('a plain `npm test` does NOT run the live tier', () => {
    // The property the whole change exists for. `npm test` sets npm_lifecycle_event to
    // "test"; nothing else opts in, so the live tier stays out.
    assert.equal(
        withEnv({ CONVERSANT_LIVE: undefined, npm_lifecycle_event: 'test' }, liveTestsEnabled),
        false,
    );
});

test('a bare `node --test` does not run it either', () => {
    // Running the files directly, outside npm, must not be a way back in — that is how
    // a CI job or a watch script would invoke them.
    assert.equal(
        withEnv({ CONVERSANT_LIVE: undefined, npm_lifecycle_event: undefined }, liveTestsEnabled),
        false,
    );
});

test('`npm run test:live` opts in, with no environment-variable syntax needed', () => {
    // Keyed off the npm script name deliberately: setting a variable differs between
    // cmd, PowerShell and a POSIX shell, and this project is worked on in all three. A
    // route that needs the right syntax is a route that fails on somebody's machine.
    assert.equal(
        withEnv({ CONVERSANT_LIVE: undefined, npm_lifecycle_event: 'test:live' }, liveTestsEnabled),
        true,
    );
});

test('CONVERSANT_LIVE opts in, for a full run or CI', () => {
    assert.equal(
        withEnv({ CONVERSANT_LIVE: '1', npm_lifecycle_event: 'test' }, liveTestsEnabled),
        true,
    );
});

test('an empty or whitespace CONVERSANT_LIVE is not an opt-in', () => {
    // `CONVERSANT_LIVE=` is how a shell script clears a variable, and it must read as
    // "no" rather than as "yes" — the surprising direction would silently put the
    // non-determinism back.
    for (const v of ['', '   ']) {
        assert.equal(
            withEnv({ CONVERSANT_LIVE: v, npm_lifecycle_event: 'test' }, liveTestsEnabled),
            false,
            `CONVERSANT_LIVE=${JSON.stringify(v)} must not opt in`,
        );
    }
});
