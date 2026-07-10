/* Tier 1 — Conversation Engine (app/js/engine.js).
 *
 * Pure CA logic, no DOM, no API, no timers — deterministic and fast. Covers the
 * sequence stack, mode/floor transitions, the four-slot palette, repair-of-self,
 * openers/closers + {name} substitution, and — the reason this suite exists — the
 * user-started (user-leading) path that produced the July 2026 silent stall.
 */
import './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../app/js/engine.js';

const COMPLETE = (action, responses = []) => ({
    classification: { partner_action: action, turn_status: 'COMPLETE', is_repair_initiator: false },
    responses,
});
const fourSlots = [
    { slot: 'PREFERRED', text: 'Good, thanks.' },
    { slot: 'DISPREFERRED', text: "I'd rather not, honestly." },
    { slot: 'INITIATIVE', text: 'How about you?' },
    { slot: 'REPAIR', text: 'Sorry?' },
];

test('reset → LISTENING, floor OPEN, empty stack, no palette', () => {
    engine.reset();
    const s = engine.getSnapshot();
    assert.equal(s.mode, engine.MODE.LISTENING);
    assert.equal(s.floor, engine.FLOOR.OPEN);
    assert.deepEqual(s.sequenceStack, []);
    assert.deepEqual(s.palette, []);
});

test('partner-started COMPLETE question → RESPONDING, floor SELF, 4-slot palette, FPP pushed', () => {
    engine.reset();
    engine.partnerSpeaking('How was your weekend?');
    const s = engine.ingestClassification(COMPLETE('QUESTION', fourSlots), 'How was your weekend?');
    assert.equal(s.mode, engine.MODE.RESPONDING);
    assert.equal(s.floor, engine.FLOOR.SELF);
    assert.equal(s.palette.length, 4);
    assert.equal(s.palette[0].slot, 'PREFERRED');           // preferred always first
    assert.equal(s.palette[3].slot, 'REPAIR');              // repair always last
    assert.deepEqual(s.sequenceStack.map(x => [x.action, x.openedBy]), [['QUESTION', 'PARTNER']]);
});

test('partner-started INCOMPLETE → LISTENING, floor PARTNER, empty palette (false-TRP guard preserved)', () => {
    engine.reset();
    engine.partnerSpeaking('So the other day I was walking and');
    const s = engine.ingestClassification(
        { classification: { partner_action: 'STATEMENT', turn_status: 'INCOMPLETE', is_repair_initiator: false }, responses: [] },
        'So the other day I was walking and');
    assert.equal(s.mode, engine.MODE.LISTENING);
    assert.equal(s.floor, engine.FLOOR.PARTNER);
    assert.equal(s.palette.length, 0);
});

test('repair-initiator ("What?") → REPAIR_OF_SELF with respeak = last user utterance', () => {
    engine.reset();
    engine.selectResponse({ slot: 'PREFERRED', text: 'I went to the market.' }); // sets lastUserUtterance
    engine.partnerSpeaking('What?');
    const s = engine.ingestClassification(
        { classification: { partner_action: 'OTHER', turn_status: 'COMPLETE', is_repair_initiator: true }, responses: [] },
        'What?');
    assert.equal(s.mode, engine.MODE.REPAIR_OF_SELF);
    assert.equal(s.floor, engine.FLOOR.SELF);
    assert.equal(s.palette.length, 3);
    const respeak = s.palette.find(p => p.op === 'respeak');
    assert.equal(respeak.text, 'I went to the market.');
});

test('setRepairOptions fills the rephrase/expand cards and makes them instant', () => {
    engine.reset();
    engine.selectResponse({ slot: 'PREFERRED', text: 'I went to the market.' });
    engine.partnerSpeaking('Huh?');
    engine.ingestClassification(
        { classification: { partner_action: 'OTHER', turn_status: 'COMPLETE', is_repair_initiator: true }, responses: [] }, 'Huh?');
    const s = engine.setRepairOptions({ rephrase: 'I was at the market.', expand: 'I went to the market to buy some fruit.' });
    const rephrase = s.palette.find(p => p.op === 'rephrase');
    const expand = s.palette.find(p => p.op === 'expand');
    assert.equal(rephrase.text, 'I was at the market.');
    assert.equal(rephrase.latency, 'instant');
    assert.equal(expand.text, 'I went to the market to buy some fruit.');
});

// --- User-starts-the-conversation path (the bug) ----------------------------

test('selecting an OPENER pushes a USER-opened sequence, floor → PARTNER, palette cleared', () => {
    engine.reset();
    const s = engine.selectResponse({ slot: 'OPENER', text: 'Hi Tyler, got a minute?' });
    assert.equal(s.floor, engine.FLOOR.PARTNER);
    assert.deepEqual(s.sequenceStack.map(x => [x.action, x.openedBy]), [['OPENER', 'USER']]);
    assert.equal(s.palette.length, 0);
    assert.equal(engine.buildRequestContext().user_holds_floor_to_lead, true);
});

test('REGRESSION: user-led + partner go-ahead → the lead palette shows, for COMPLETE AND misclassified INCOMPLETE/CONTINUING', () => {
    for (const status of ['COMPLETE', 'INCOMPLETE', 'CONTINUING']) {
        engine.reset();
        engine.selectResponse({ slot: 'OPENER', text: 'Hi Tyler, got a minute?' });
        engine.partnerSpeaking('Yeah sure, any time you want, just let me know.');
        const s = engine.ingestClassification(
            { classification: { partner_action: 'STATEMENT', turn_status: status, is_repair_initiator: false }, responses: fourSlots },
            'Yeah sure, any time you want, just let me know.');
        assert.equal(s.mode, engine.MODE.RESPONDING, `mode for ${status}`);
        assert.equal(s.floor, engine.FLOOR.SELF, `floor for ${status}`);
        assert.equal(s.palette.length, 4, `palette for ${status} must NOT be empty`);
        assert.equal(s.lastClassification.turn_status, 'COMPLETE', `status normalized for ${status}`);
        assert.deepEqual(s.sequenceStack, [], `opener popped for ${status}`);
    }
});

test('user-led normalization does NOT leak to a normal partner-started turn (guard still holds)', () => {
    // Regression guard for the fix: an ordinary partner-started INCOMPLETE (no
    // user-opened sequence on the stack) must still suppress the palette.
    engine.reset();
    engine.partnerSpeaking('I was thinking maybe we could');
    const s = engine.ingestClassification(
        { classification: { partner_action: 'STATEMENT', turn_status: 'INCOMPLETE', is_repair_initiator: false }, responses: [] },
        'I was thinking maybe we could');
    assert.equal(s.mode, engine.MODE.LISTENING);
    assert.equal(s.palette.length, 0);
});

// --- SPP / pardon / closing / initiate --------------------------------------

test('selecting an SPP pops the innermost partner FPP and opens the floor', () => {
    engine.reset();
    engine.partnerSpeaking('Coffee?');
    engine.ingestClassification(COMPLETE('INVITATION', fourSlots), 'Coffee?');
    const s = engine.selectResponse({ slot: 'PREFERRED', text: 'Sure, love one.' });
    assert.deepEqual(s.sequenceStack, []);
    assert.equal(s.floor, engine.FLOOR.OPEN);
    assert.equal(engine.getLastUserUtterance(), 'Sure, love one.');
});

test('Pardon? dedups — two taps leave a single open user REPAIR', () => {
    engine.reset();
    engine.partnerSpeaking('mumble mumble');
    engine.ingestClassification(COMPLETE('QUESTION', fourSlots), 'mumble mumble');
    engine.pardon();
    const s = engine.pardon();
    const repairs = s.sequenceStack.filter(x => x.action === 'REPAIR' && x.openedBy === 'USER');
    assert.equal(repairs.length, 1);
    assert.equal(s.floor, engine.FLOOR.PARTNER);
});

test("Pardon? then the partner's re-speak resolves the repair and clarifies the FPP in place (no duplicate)", () => {
    engine.reset();
    engine.partnerSpeaking('mumble');
    engine.ingestClassification(COMPLETE('QUESTION', fourSlots), 'mumble');
    engine.pardon();
    const s = engine.ingestClassification(COMPLETE('QUESTION', fourSlots), 'What did you do today?');
    // The stack should again hold a single PARTNER question (repair popped, FPP updated in place).
    assert.deepEqual(s.sequenceStack.map(x => [x.action, x.openedBy]), [['QUESTION', 'PARTNER']]);
    assert.equal(s.sequenceStack[0].utterance, 'What did you do today?');
    assert.equal(s.mode, engine.MODE.RESPONDING);
});

test('partner CLOSING → PRE_CLOSING_CLOSING with a closing palette', () => {
    engine.reset();
    engine.partnerSpeaking('Anyway, I should run.');
    const s = engine.ingestClassification(COMPLETE('CLOSING'), 'Anyway, I should run.');
    assert.equal(s.mode, engine.MODE.PRE_CLOSING_CLOSING);
    assert.equal(s.phase, 'PRE_CLOSING');
    assert.ok(s.palette.length > 0);
    assert.ok(s.palette.every(p => p.slot === 'CLOSING'));
});

test('windDown → PRE_CLOSING_CLOSING with closers, floor SELF', () => {
    engine.reset();
    const s = engine.windDown();
    assert.equal(s.mode, engine.MODE.PRE_CLOSING_CLOSING);
    assert.equal(s.floor, engine.FLOOR.SELF);
    assert.ok(s.palette.every(p => p.slot === 'CLOSING'));
});

test('initiate substitutes {name} when a partner is active and drops it cleanly when not', () => {
    engine.reset();
    const named = engine.initiate({ partnerName: 'Tim' });
    assert.ok(named.palette.some(p => p.text === 'Hi Tim, got a minute?'),
        'named opener should read "Hi Tim, got a minute?"');
    engine.reset();
    const anon = engine.initiate({});
    assert.ok(anon.palette.some(p => p.text === 'Hi, got a minute?'),
        'anonymous opener should drop {name} and its comma → "Hi, got a minute?"');
    assert.ok(anon.palette.every(p => !/\{name\}/.test(p.text)), 'no {name} token should survive');
});

test('refreshPalette swaps responses without touching the stack/mode/floor', () => {
    engine.reset();
    engine.partnerSpeaking('Question?');
    const before = engine.ingestClassification(COMPLETE('QUESTION', fourSlots), 'Question?');
    const stackBefore = JSON.stringify(before.sequenceStack);
    const s = engine.refreshPalette([{ slot: 'PREFERRED', text: 'A different answer.' }]);
    assert.equal(s.palette.length, 1);
    assert.equal(s.palette[0].text, 'A different answer.');
    assert.equal(JSON.stringify(s.sequenceStack), stackBefore); // unchanged — no duplicate FPP
    assert.equal(s.mode, engine.MODE.RESPONDING);
});

test('setConversationPhrases injects edited openers/closers; ignores empty lists', () => {
    engine.setConversationPhrases({ openers: ['Yo {name}!'], closers: ['Later.'] });
    engine.reset();
    const s = engine.initiate({ partnerName: 'Sam' });
    assert.ok(s.palette.some(p => p.text === 'Yo Sam!'));
    // Empty list must not wipe the openers.
    engine.setConversationPhrases({ openers: [] });
    engine.reset();
    const s2 = engine.initiate({ partnerName: 'Sam' });
    assert.ok(s2.palette.some(p => p.text === 'Yo Sam!'), 'empty list should be ignored, keeping prior openers');
    // Restore defaults for any later test file (this process is isolated, but tidy).
    engine.setConversationPhrases({ openers: ['Hi {name}, got a minute?'], closers: ['Bye!'] });
});
