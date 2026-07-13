/* Tier 1 — transcript-shaping logic (app/js/transcript-log.js).
 *
 * These pure helpers implement Ken's rule that the transcript (the <id>.json file)
 * MIRRORS the conversation pane: the partner's in-progress turn is written at the
 * first pause, OVERWRITTEN (raw) with the cleaned line CLEARED on each later pause,
 * and FINALIZED (cleaned line filled) when the user responds — in partner-then-user
 * order. A regression here silently corrupts the recorded transcript, so the rules
 * are locked with unit tests even though the FSA/DOM plumbing around them isn't.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertPartnerInterim, finalizePartner } from '../app/js/transcript-log.js';

// --- upsertPartnerInterim: first pause appends; later pauses overwrite ----------

test('first pause appends a pending partner turn (raw set, cleaned empty)', () => {
    const ex = [];
    const pending = upsertPartnerInterim(ex, null, { rawTranscript: 'how was your', partner: { label: 'Mom' }, timestamp: 't1' });
    assert.equal(ex.length, 1);
    assert.deepEqual(ex[0], { timestamp: 't1', role: 'partner', rawTranscript: 'how was your', cleanedTranscript: '', partner: { label: 'Mom' } });
    assert.equal(pending, ex[0], 'returns the pending turn for reuse');
});

test('a later pause OVERWRITES the raw line and CLEARS the cleaned line, no new entry', () => {
    const ex = [];
    let pending = upsertPartnerInterim(ex, null, { rawTranscript: 'how was', timestamp: 't1' });
    pending.cleanedTranscript = 'stale'; // pretend it had been cleaned
    pending = upsertPartnerInterim(ex, pending, { rawTranscript: 'how was your weekend', timestamp: 't2' });
    assert.equal(ex.length, 1, 'still one partner turn — overwritten, not appended');
    assert.equal(ex[0].rawTranscript, 'how was your weekend');
    assert.equal(ex[0].cleanedTranscript, '', 'cleaned line cleared on continuation');
    assert.equal(ex[0].timestamp, 't1', 'keeps the original timestamp (same turn)');
});

// --- finalizePartner: update in place (before the user turn) vs. append ----------

test('finalize updates the pending turn IN PLACE, preserving order before the user turn', () => {
    const ex = [];
    const pending = upsertPartnerInterim(ex, null, { rawTranscript: 'how was your weekend', timestamp: 't1' });
    // user turn is appended after the partner turn (as app.js does)
    ex.push({ timestamp: 't2', role: 'user', selectedText: 'Great, thanks!' });
    finalizePartner(ex, pending, { rawTranscript: 'how was your weekend', cleanedTranscript: 'How was your weekend?', partner: { label: 'Mom' } });
    assert.equal(ex.length, 2, 'no duplicate partner entry');
    assert.equal(ex[0].role, 'partner');
    assert.equal(ex[0].cleanedTranscript, 'How was your weekend?');
    assert.equal(ex[1].role, 'user', 'partner stays before user');
});

test('finalize with a null handle APPENDS a finished partner turn (interruption before any pause)', () => {
    const ex = [];
    finalizePartner(ex, null, { rawTranscript: 'wait I', cleanedTranscript: 'wait I' });
    assert.equal(ex.length, 1);
    assert.deepEqual(ex[0], { timestamp: ex[0].timestamp, role: 'partner', rawTranscript: 'wait I', cleanedTranscript: 'wait I', partner: null });
});

test('a resumed partner turn after finalize appends a SECOND turn (detached handle not overwritten)', () => {
    const ex = [];
    const first = upsertPartnerInterim(ex, null, { rawTranscript: 'turn one', timestamp: 't1' });
    // detach: caller sets pending=null and finalizes the first turn in the background
    ex.push({ timestamp: 't2', role: 'user', selectedText: 'ok' });
    // a new partner turn starts (pending is null now)
    const second = upsertPartnerInterim(ex, null, { rawTranscript: 'turn two', timestamp: 't3' });
    // the delayed finalize of the first turn lands — must update `first`, not `second`
    finalizePartner(ex, first, { rawTranscript: 'turn one', cleanedTranscript: 'Turn one.' });
    assert.equal(ex.length, 3);
    assert.equal(ex[0].cleanedTranscript, 'Turn one.');
    assert.equal(ex[2], second);
    assert.equal(ex[2].rawTranscript, 'turn two');
    assert.equal(ex[2].cleanedTranscript, '', 'the in-progress second turn is untouched');
});
