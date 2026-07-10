/* Tier 1 — conversation-loop decision logic (app/js/conversation-logic.js).
 *
 * These pure predicates are what app.js's generateOptions uses; this is the layer
 * where the July 2026 user-started silent stall actually surfaced, and where the
 * silent-dead-end instrumentation lives. Testing them here means the tripwires are
 * no longer untested app.js code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cl from '../app/js/conversation-logic.js';

const snap = (over = {}) => ({
    mode: 'RESPONDING',
    palette: [{ slot: 'PREFERRED', text: 'Hi.' }],
    lastClassification: { partner_action: 'QUESTION', turn_status: 'COMPLETE', is_repair_initiator: false },
    ...over,
});

// --- shouldPlayPlaceholder ---------------------------------------------------

test('shouldPlayPlaceholder: yes for any complete, non-repair turn', () => {
    assert.equal(cl.shouldPlayPlaceholder(snap({ lastClassification: { partner_action: 'GREETING', turn_status: 'COMPLETE', is_repair_initiator: false } })), true);
    assert.equal(cl.shouldPlayPlaceholder(snap()), true);
});

test('shouldPlayPlaceholder: no for incomplete, repair-initiator, or missing classification', () => {
    assert.equal(cl.shouldPlayPlaceholder(snap({ lastClassification: { turn_status: 'INCOMPLETE' } })), false);
    assert.equal(cl.shouldPlayPlaceholder(snap({ lastClassification: { turn_status: 'COMPLETE', is_repair_initiator: true } })), false);
    assert.equal(cl.shouldPlayPlaceholder(snap({ lastClassification: null })), false);
});

test('isQuestionFlavored: true only for QUESTION/INVITATION/REQUEST', () => {
    for (const a of ['QUESTION', 'INVITATION', 'REQUEST']) {
        assert.equal(cl.isQuestionFlavored(snap({ lastClassification: { partner_action: a } })), true, a);
    }
    for (const a of ['GREETING', 'STATEMENT', 'ASSESSMENT', 'CLOSING', 'OTHER']) {
        assert.equal(cl.isQuestionFlavored(snap({ lastClassification: { partner_action: a } })), false, a);
    }
});

// --- generationOutcome: the branch + tripwire logic --------------------------

test('respond, no anomaly: a normal complete turn with a palette', () => {
    const o = cl.generationOutcome(snap(), { user_holds_floor_to_lead: false });
    assert.equal(o.respond, true);
    assert.equal(o.anomaly, null);
});

test('hold, no anomaly: an ordinary partner mid-sentence pause (NOT logged — that would be noise)', () => {
    const o = cl.generationOutcome(
        snap({ palette: [], lastClassification: { partner_action: 'STATEMENT', turn_status: 'INCOMPLETE', is_repair_initiator: false } }),
        { user_holds_floor_to_lead: false });
    assert.equal(o.respond, false);
    assert.equal(o.anomaly, null);
});

test('TRIPWIRE (a): non-COMPLETE while the user is leading logs an anomaly (the user-started-stall signature)', () => {
    const o = cl.generationOutcome(
        snap({ palette: [], lastClassification: { partner_action: 'STATEMENT', turn_status: 'CONTINUING', is_repair_initiator: false } }),
        { user_holds_floor_to_lead: true });
    assert.equal(o.respond, false);
    assert.ok(o.anomaly, 'must log');
    assert.match(o.anomaly.message, /user leading/);
    assert.equal(o.anomaly.context, 'generateOptions');
});

test('TRIPWIRE (b): a complete turn with an EMPTY palette logs an anomaly', () => {
    const o = cl.generationOutcome(snap({ palette: [] }), { user_holds_floor_to_lead: false });
    assert.equal(o.respond, true);
    assert.ok(o.anomaly, 'empty palette on a complete turn must log');
    assert.match(o.anomaly.message, /no options for a complete turn/);
});

test('REPAIR_OF_SELF with an initially-sparse palette is exempt from the empty-palette tripwire', () => {
    const o = cl.generationOutcome(
        snap({ mode: 'REPAIR_OF_SELF', palette: [], lastClassification: { partner_action: 'OTHER', turn_status: 'COMPLETE', is_repair_initiator: false } }),
        {});
    assert.equal(o.respond, true);
    assert.equal(o.anomaly, null, 'repair cards are filled by a follow-up prefetch');
});
