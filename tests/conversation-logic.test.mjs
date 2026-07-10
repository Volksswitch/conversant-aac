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

test('shouldPlayPlaceholder: yes for any non-repair turn (regardless of turn_status)', () => {
    assert.equal(cl.shouldPlayPlaceholder(snap({ lastClassification: { partner_action: 'GREETING', turn_status: 'COMPLETE', is_repair_initiator: false } })), true);
    assert.equal(cl.shouldPlayPlaceholder(snap()), true);
    // turn_status is now informational — an "incomplete"-looking turn still gets a
    // placeholder (it's aborted by handlePartnerResumed if the partner resumes).
    assert.equal(cl.shouldPlayPlaceholder(snap({ lastClassification: { partner_action: 'STATEMENT', turn_status: 'INCOMPLETE', is_repair_initiator: false } })), true);
});

test('shouldPlayPlaceholder: no for a repair-initiator or a missing classification', () => {
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

// --- generationOutcome: always respond; the one empty-palette tripwire ---------

test('respond, no anomaly: a normal turn with a palette', () => {
    const o = cl.generationOutcome(snap());
    assert.equal(o.respond, true);
    assert.equal(o.anomaly, null);
});

test('respond, no anomaly: an "incomplete"-looking turn still shows a palette (no suppression)', () => {
    const o = cl.generationOutcome(snap({ lastClassification: { partner_action: 'STATEMENT', turn_status: 'INCOMPLETE', is_repair_initiator: false } }));
    assert.equal(o.respond, true);
    assert.equal(o.anomaly, null);
});

test('TRIPWIRE: an EMPTY palette (model returned no responses) logs an anomaly', () => {
    const o = cl.generationOutcome(snap({ palette: [] }));
    assert.equal(o.respond, true);
    assert.ok(o.anomaly, 'empty palette must log');
    assert.match(o.anomaly.message, /no response options generated/);
    assert.equal(o.anomaly.context, 'generateOptions');
});

test('REPAIR_OF_SELF with an initially-sparse palette is exempt from the empty-palette tripwire', () => {
    const o = cl.generationOutcome(
        snap({ mode: 'REPAIR_OF_SELF', palette: [], lastClassification: { partner_action: 'OTHER', turn_status: 'COMPLETE', is_repair_initiator: false } }));
    assert.equal(o.respond, true);
    assert.equal(o.anomaly, null, 'repair cards are filled by a follow-up prefetch');
});
