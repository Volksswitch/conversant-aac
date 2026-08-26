/* Tier 1 — floor-holding placeholders (app/js/placeholders.js).
 *
 * Covers the timing contract (arm() alone speaks — the ladder is gated by partner
 * silence, NOT by the AI round-trip), role-by-position sequencing (first =
 * acknowledgment, later = thinking), the per-turn cap, and the "0 = none" gate.
 * Observes output via the speechSynthesis shim (spokenTexts). Real timers with
 * tiny delays (savePlaceholderSettings sets them small).
 */
import { resetLocalStorage, resetSpoken, spokenTexts } from './env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as placeholders from '../app/js/placeholders.js';
import * as storage from '../app/js/storage.js';
import * as phrasePools from '../app/js/placeholder-phrases.js';

// The pools are user-owned now (placeholder-phrases.js), so the expected phrases come
// from the model's own defaults rather than being copied here — a copy would have to be
// kept in step by hand and would pass while the app said something else.
const ACK = phrasePools.DEFAULTS.acknowledgment;
const THINKING = phrasePools.DEFAULTS.thinking;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
    placeholders.stop();       // clear any timer from a prior test
    placeholders.setUserSpeakingGate(() => false);   // singleton — reset per test
    resetLocalStorage();
    resetSpoken();
});

// THE regression guard for the August 7 2026 timing fix (Ken). Placeholders are
// gated by partner silence and terminated by user speech; they have nothing to do
// with the AI round-trip. Before the fix arm() only recorded a timestamp and start()
// — reached only after the classification returned — was what scheduled the speech,
// so the first placeholder actually landed at max(initialDelay, round-trip) and the
// setting was inert whenever the AI was slower than it. Here start() is NEVER
// called, standing in for an AI that is slow, failed, or has no key at all.
test('arm() alone speaks the first placeholder — the AI is never consulted', async () => {
    storage.savePlaceholderSettings(0.02, 5, 2);
    placeholders.arm();
    await sleep(80);
    assert.equal(spokenTexts.length, 1, 'the first placeholder fires on the timer alone');
    assert.ok(ACK.includes(spokenTexts[0]), `it is an acknowledgment: ${spokenTexts[0]}`);
});

// Every acknowledgment must be partner-statement independent, which is what removed
// the need to know the turn type. Guards against reintroducing a turn-type-dependent
// pool (e.g. "Good question.") without re-deciding the timing model.
test('no acknowledgment assumes the partner asked a question', () => {
    const pools = phrasePools.DEFAULTS;
    assert.ok(Array.isArray(pools.acknowledgment), 'acknowledgment is a flat list, not split by turn type');
    for (const phrase of [...pools.acknowledgment, ...pools.thinking]) {
        assert.ok(!/question/i.test(phrase), `"${phrase}" presumes a question`);
    }
});

test('plays acknowledgment then thinking, capped at maxPlaceholders', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 2);
    placeholders.arm();
    await placeholders.start();
    await sleep(220);
    assert.equal(spokenTexts.length, 2, 'the cap of 2 is respected');
    assert.ok(ACK.includes(spokenTexts[0]), `first is an acknowledgment: ${spokenTexts[0]}`);
    assert.ok(THINKING.includes(spokenTexts[1]), `second is a thinking placeholder: ${spokenTexts[1]}`);
});

// start() arrives when the classification comes back, by which time arm() may
// already have spoken. It must confirm the running ladder, not restart it — a reset
// would replay the acknowledgment rung and say two in a row.
test('start() after the first placeholder has spoken does not replay it', async () => {
    storage.savePlaceholderSettings(0.02, 5, 3);
    placeholders.arm();
    await sleep(60);
    assert.equal(spokenTexts.length, 1);
    await placeholders.start();              // the AI finally answered
    await sleep(60);
    assert.equal(spokenTexts.length, 1, 'no second acknowledgment');
});

// The repair-initiator path ("What?"): app.js calls stop() instead of start() once
// the classification identifies it. On a fast round-trip that lands before the
// timer, so nothing is spoken.
test('stop() before the timer fires suppresses the ladder entirely', async () => {
    storage.savePlaceholderSettings(0.1, 0.1, 2);
    placeholders.arm();
    placeholders.stop();
    await sleep(160);
    assert.equal(spokenTexts.length, 0);
});

test('maxPlaceholders = 0 means NONE — nothing is spoken', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 0);
    placeholders.arm();
    await placeholders.start();
    await sleep(120);
    assert.equal(spokenTexts.length, 0);
});

test('consecutive thinking placeholders are never the same phrase back-to-back', async () => {
    storage.savePlaceholderSettings(0.02, 0.02, 3);
    placeholders.arm();
    await placeholders.start();
    await sleep(260);
    assert.equal(spokenTexts.length, 3);
    assert.notEqual(spokenTexts[1], spokenTexts[2], 'two thinking placeholders in a row must differ');
});

test('userSpeakingGate: a placeholder waits for the user statement to finish instead of barging in', async () => {
    // Ken July 2026: pressing a speaking button must not let a (stray, in-flight)
    // placeholder cut into the user\'s own speech. The gate defers it, then it speaks
    // once the user is done — it isn't lost.
    storage.savePlaceholderSettings(0.02, 0.03, 2);
    let userSpeaking = true;
    placeholders.setUserSpeakingGate(() => userSpeaking);
    placeholders.arm();
    await placeholders.start();
    await sleep(90);
    assert.equal(spokenTexts.length, 0, 'nothing is spoken while the user statement plays');
    userSpeaking = false;                 // the user statement finished
    await sleep(120);                     // the deferred attempt (subsequentDelay) fires
    assert.ok(spokenTexts.length >= 1, 'the placeholder speaks once the user is done — not dropped');
});

test('stop() cancels a scheduled placeholder before it speaks', async () => {
    storage.savePlaceholderSettings(0.1, 0.1, 2);
    placeholders.arm();
    await placeholders.start();
    placeholders.stop();       // quick selection cancels everything
    await sleep(160);
    assert.equal(spokenTexts.length, 0);
});

/* --- Composing follows the same rules as reading the cards (Ken, August 25 2026) ---
 *
 * ⚠ A SOURCE CHECK, NOT A BEHAVIOUR CHECK, and the reason is worth stating: this
 * decision lives in app.js, which is not loadable in a test (it touches the DOM, the
 * mic and the network at import). The behaviour was verified in the browser; these two
 * assertions are the tripwire that stops it being undone by a change that looks
 * unrelated, because both of the old mechanisms were silent — the app simply said
 * nothing, and nothing anywhere reported that it had chosen not to.
 *
 * THE RULE: opening "In my own words" is the user still CHOOSING, exactly as reading
 * the offered cards is. It is not an act of speaking and not a decision, so it must not
 * silence the floor-holding phrases. Typing is the slower of the two ways to answer, so
 * silencing it left the longest gaps in the app unfilled — the opposite of what a
 * floor-holder is for.
 */
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');

test('the placeholder gate covers speech only, never an open composer', () => {
    // To the end of the LINE, not to the first ')': the argument is an arrow function,
    // so a lazy paren match stops at its own empty parameter list and captures nothing.
    const call = /setUserSpeakingGate\((.*)$/m.exec(appSource);
    assert.ok(call, 'app.js no longer sets the user-speaking gate at all');
    assert.ok(!/composerOpen/.test(call[1]),
        'the gate must not carry composerOpen — it would silence the ladder for as long as '
        + 'the box is open, and because the gate DEFERS rather than counting, indefinitely');
    assert.ok(/speakingUserStatement/.test(call[1]),
        'the gate must still cover the user\'s own speech — nothing may speak over that');
});

test('opening the composer does not abort the running ladder', () => {
    const at = appSource.indexOf('function openComposer(');
    assert.ok(at > 0, 'openComposer not found');
    const body = appSource.slice(at, appSource.indexOf('\nfunction ', at + 10));
    // Comments explain why it is absent, so match a CALL rather than the bare word.
    assert.ok(!/^\s*abortPlaceholders\(\);/m.test(body),
        'openComposer must not abort placeholders — opening the box is the user still '
        + 'choosing, the same state as reading the cards');
});
