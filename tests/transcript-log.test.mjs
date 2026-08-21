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
    // The turn carries its own revision history as well as its current text, so a
    // reader can see when the partner paused and what had been heard by then.
    assert.deepEqual(ex[0], { timestamp: 't1', role: 'partner', rawTranscript: 'how was your', cleanedTranscript: '', partner: { label: 'Mom' }, stt: null, revisions: [{ at: 't1', text: 'how was your' }] });
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
    assert.deepEqual(ex[0], { timestamp: ex[0].timestamp, role: 'partner', rawTranscript: 'wait I', cleanedTranscript: 'wait I', partner: null, stt: null });
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

// --- what heard it (Ken, August 8 2026) --------------------------------------
// Which recogniser produced a partner line is the single biggest influence on how
// accurate it is, so a later review can tell a mishearing from a misunderstanding.

test('a partner turn records which recogniser heard it, on both paths', () => {
    const ex = [];
    const pending = upsertPartnerInterim(ex, null, { rawTranscript: 'hello', stt: 'deepgram' });
    assert.equal(ex[0].stt, 'deepgram');
    finalizePartner(ex, pending, { rawTranscript: 'hello', cleanedTranscript: 'Hello.', stt: 'deepgram' });
    assert.equal(ex[0].stt, 'deepgram', 'survives finalizing in place');

    // The append path (an interruption captured before any pause was written).
    finalizePartner(ex, null, { rawTranscript: 'and another', cleanedTranscript: 'And another.', stt: 'browser' });
    assert.equal(ex[1].stt, 'browser');
});

test('an unknown recogniser is recorded as null rather than invented', () => {
    const ex = [];
    upsertPartnerInterim(ex, null, { rawTranscript: 'hello' });
    assert.equal(ex[0].stt, null);
});

/* ── A partner turn keeps its own history (Ken, August 21 2026) ──────────────
 *
 * Ken: "Do we record partial partner speech explicitly in the preserved
 * conversation transcript so that we can recognize when a partner paused and when
 * they continued speaking and when reprompts fired?" We did not. The raw line was
 * overwritten at each pause and the first pause's timestamp kept, so a turn that
 * grew across four pauses was one line with one time.
 *
 * ⚠ The event trace has that structure but carries NO WORDS by design, and the
 * transcript had the words but no structure — so between them they still could not
 * show a partner pausing, continuing, and a reprompt firing. That is exactly the
 * shape of the open question about the app's holding phrases appearing as partner
 * speech, which is why this is worth its file size.
 */
test('revisions: the first pause is revision one', () => {
    const ex = [];
    const t = upsertPartnerInterim(ex, null, { rawTranscript: 'how are you', timestamp: '2026-08-21T10:00:00Z' });
    assert.equal(t.revisions.length, 1);
    assert.deepEqual(t.revisions[0], { at: '2026-08-21T10:00:00Z', text: 'how are you' });
});

test('revisions: every later pause is appended, not overwritten', () => {
    const ex = [];
    let t = upsertPartnerInterim(ex, null, { rawTranscript: 'how are you', timestamp: '2026-08-21T10:00:00Z' });
    t = upsertPartnerInterim(ex, t, { rawTranscript: 'how are you feeling', timestamp: '2026-08-21T10:00:03Z' });
    t = upsertPartnerInterim(ex, t, { rawTranscript: 'how are you feeling today', timestamp: '2026-08-21T10:00:07Z' });
    assert.equal(ex.length, 1, 'still one partner turn');
    assert.equal(t.rawTranscript, 'how are you feeling today', 'the current text is unchanged in meaning');
    assert.deepEqual(t.revisions.map(r => r.at),
        ['2026-08-21T10:00:00Z', '2026-08-21T10:00:03Z', '2026-08-21T10:00:07Z']);
    assert.deepEqual(t.revisions.map(r => r.text),
        ['how are you', 'how are you feeling', 'how are you feeling today']);
});

test('revisions: a pause that heard nothing new is not recorded', () => {
    const ex = [];
    let t = upsertPartnerInterim(ex, null, { rawTranscript: 'hello', timestamp: '2026-08-21T10:00:00Z' });
    t = upsertPartnerInterim(ex, t, { rawTranscript: 'hello', timestamp: '2026-08-21T10:00:02Z' });
    assert.equal(t.revisions.length, 1);
});

test('revisions: finalizing records the last state when it differs', () => {
    // The finalize path can carry text no pause ever saw — an interruption, or End
    // conversation flushing what was heard since the last pause.
    const ex = [];
    const t = upsertPartnerInterim(ex, null, { rawTranscript: 'i was going to', timestamp: '2026-08-21T10:00:00Z' });
    finalizePartner(ex, t, {
        rawTranscript: 'i was going to say something else',
        cleanedTranscript: 'I was going to say something else.',
        timestamp: '2026-08-21T10:00:09Z',
    });
    assert.equal(t.revisions.length, 2);
    assert.equal(t.revisions[1].text, 'i was going to say something else');
    assert.equal(t.cleanedTranscript, 'I was going to say something else.');
});

test('revisions: the FIRST is kept when a pathological turn is trimmed', () => {
    // ⚠ The first revision is what the app acted on when it first asked the AI, so
    // it is the last one that should be lost.
    const ex = [];
    let t = upsertPartnerInterim(ex, null, { rawTranscript: 'w0', timestamp: '2026-08-21T10:00:00Z' });
    for (let i = 1; i < 40; i++) {
        t = upsertPartnerInterim(ex, t, { rawTranscript: 'w' + i, timestamp: '2026-08-21T10:00:' + String(i).padStart(2, '0') + 'Z' });
    }
    assert.equal(t.revisions.length, 20);
    assert.equal(t.revisions[0].text, 'w0', 'the first survives');
    assert.equal(t.revisions[t.revisions.length - 1].text, 'w39', 'and so does the newest');
});

test('revisions: existing readers are unaffected', () => {
    // rawTranscript / cleanedTranscript keep their meaning, so nothing that reads a
    // transcript today has to know about revisions at all.
    const ex = [];
    let t = upsertPartnerInterim(ex, null, { rawTranscript: 'a', timestamp: '2026-08-21T10:00:00Z' });
    t = upsertPartnerInterim(ex, t, { rawTranscript: 'a b', timestamp: '2026-08-21T10:00:01Z' });
    finalizePartner(ex, t, { rawTranscript: 'a b', cleanedTranscript: 'A b.', timestamp: '2026-08-21T10:00:02Z' });
    assert.equal(ex.length, 1);
    assert.equal(ex[0].role, 'partner');
    assert.equal(ex[0].rawTranscript, 'a b');
    assert.equal(ex[0].cleanedTranscript, 'A b.');
});
