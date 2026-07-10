/* Tier 3 — LIVE scenario smoke tests against the real Claude API.
 *
 * This is the ONLY tier that exercises the model's real classification — the layer
 * that stubbed tests cannot reach and that hid the July 2026 user-started stall.
 * It costs a few cents per run and is non-deterministic, so it is a pre-release
 * smoke test, not a gate: structural assertions, strict only where a property must
 * always hold (the bug scenario).
 *
 * Requires an Anthropic API key via the ANTHROPIC_API_KEY env var or a gitignored
 * `.anthropic-key` file at the repo root (see tests/README.md). With no key, every
 * scenario SKIPS — so `npm test` still runs Tiers 1 and 2 unattended.
 *
 * The key is read from the environment/file only and is NEVER printed or written
 * anywhere by these tests.
 */
import { loadApiKey } from './env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as llm from '../app/js/llm.js';

const KEY = loadApiKey();
const skip = KEY ? false : 'no API key (set ANTHROPIC_API_KEY or add .anthropic-key) — Tier 3 skipped';
if (KEY) llm.setApiKey(KEY);
const OPTS = { timeout: 45000 };   // real network latency

// Assert the response has the basic parsed shape.
function assertStructure(r) {
    assert.ok(r.classification, 'a classification object');
    assert.ok(['COMPLETE', 'INCOMPLETE', 'CONTINUING'].includes(r.classification.turn_status), 'valid turn_status');
    assert.ok(Array.isArray(r.responses), 'responses is an array');
}
function assertLeadPalette(r) {
    // turn_status is now informational (we never gate on it) — assert the app-visible
    // contract instead: a non-empty palette of lead responses.
    assert.ok(r.responses.length >= 4, `expected >= 4 lead responses, got ${r.responses.length}`);
    assert.ok(r.responses.some(x => x.slot === 'PREFERRED'), 'a PREFERRED lead response');
    assert.ok(r.responses.every(x => x.text && x.text.trim()), 'no empty response text');
}

test('LIVE: user-started conversation — partner\'s short go-ahead yields a lead palette (the July 2026 bug)', OPTS, async (t) => {
    if (skip) return t.skip(skip);
    // The user opened with a starter; the partner replied with a short go-ahead.
    // user_holds_floor_to_lead=true is exactly the state that used to make the
    // model return a non-COMPLETE status and silently stall.
    const r = await llm.generateResponses(
        [
            { role: 'user', text: 'Hi Tyler, got a minute?' },
            { role: 'partner', text: 'Yeah sure, any time you want, just let me know.' },
        ],
        { user_holds_floor_to_lead: true, phase: 'OPENING', sequence_stack: [{ action: 'OPENER', opened_by: 'USER' }] },
    );
    assertStructure(r);
    assertLeadPalette(r);
});

test('LIVE: user-started with a one-word go-ahead ("Sure.") also leads', OPTS, async (t) => {
    if (skip) return t.skip(skip);
    const r = await llm.generateResponses(
        [
            { role: 'user', text: 'Can I ask you something?' },
            { role: 'partner', text: 'Sure.' },
        ],
        { user_holds_floor_to_lead: true, phase: 'OPENING', sequence_stack: [{ action: 'OPENER', opened_by: 'USER' }] },
    );
    assertStructure(r);
    assertLeadPalette(r);
});

test('LIVE: a later disfluent go-ahead mid-conversation still yields a palette (the v0.5.82 case)', OPTS, async (t) => {
    if (skip) return t.skip(skip);
    // The sequence that stalled in 0.5.81: opener → go-ahead → the user leads with a
    // pre-announcement → the partner gives ANOTHER, disfluent go-ahead. The stack is
    // empty (not user-leading). We no longer care what turn_status the model reports —
    // the app always shows options — so we assert the palette, not the label.
    const r = await llm.generateResponses([
        { role: 'user', text: 'Hi, got a minute?' },
        { role: 'partner', text: 'Sure, for you anything.' },
        { role: 'user', text: "There's something I've been wanting to ask you." },
        { role: 'partner', text: 'Go ahead. Uh, my, uh, my ears are wide open.' },
    ], {});
    assertStructure(r);
    assert.ok(r.responses.length >= 1, 'must produce responses regardless of turn_status');
});

test('LIVE: a genuinely trailing utterance STILL yields responses (never an empty palette)', OPTS, async (t) => {
    if (skip) return t.skip(skip);
    // Even mid-sentence, the model must return options now — the user decides whether
    // to use them; the app never withholds.
    const r = await llm.generateResponses([{ role: 'partner', text: 'So the other day I was walking and' }], {});
    assertStructure(r);
    assert.ok(r.responses.length >= 1, 'a mid-sentence turn still yields responses');
});

test('LIVE: partner-started question yields a non-empty palette', OPTS, async (t) => {
    if (skip) return t.skip(skip);
    const r = await llm.generateResponses([{ role: 'partner', text: 'How was your weekend?' }], {});
    assertStructure(r);
    assert.ok(r.responses.length >= 1, 'a question must yield responses');
});

test('LIVE: partner mid-sentence returns a valid structure (status is the model\'s call)', OPTS, async (t) => {
    if (skip) return t.skip(skip);
    // Non-deterministic which non-COMPLETE label the model picks — assert only that
    // the structure is valid, not the exact status.
    const r = await llm.generateResponses([{ role: 'partner', text: 'So the other day I was walking down the street and' }], {});
    assertStructure(r);
});
