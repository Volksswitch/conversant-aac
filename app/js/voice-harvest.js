/* Voice harvest — reading the user's own voice out of conversations they have
 * already had (Sounds Like Me, Phase 2). Ken, August 7 2026.
 *
 * The largest asset in the plan was already on disk and read by nothing: every
 * committed turn has been recorded since v0.3.0, and for palette selections the FULL
 * SET of options offered is recorded alongside the index chosen. This module is the
 * pure half — conversation logs in, a voice summary out. No DOM, no storage, no
 * network, so the weighting rules below can actually be tested.
 *
 * ── THE SPLIT THAT IS THE WHOLE DESIGN: EXEMPLAR vs PREFERENCE ──
 *
 * A selected card is the MODEL's wording. The user chose among four sentences the
 * model wrote, so feeding the winner back as "this is how you write" teaches the
 * model to imitate ITSELF, converging on its own house style while producing every
 * appearance of personalization. It is invisible when it happens and would be easy
 * to call a success.
 *
 * So selections are used as PREFERENCE — which of several wordings this person
 * reaches for — and never as EXEMPLARS. The only true exemplars are sentences the
 * user actually composed.
 *
 * ── WHY `source` HAD TO BE ADDED FIRST ──
 *
 * Until August 7 2026 every non-card turn was logged identically (selectedIndex:-1,
 * no options), so a composed sentence, an Express button label and one of OUR OWN
 * control phrases were indistinguishable on disk. Harvesting all of them as "the
 * user's prose" would have taught the model that this person says "Let me think
 * about that." and "Sorry, I didn't catch that." — our words, fed back as their
 * voice. Logs written before that date have no `source`, so they are classified by
 * elimination against the known phrase lists, and anything still ambiguous is
 * DROPPED rather than guessed at.
 */

// A turn is only a usable exemplar if it is long enough to carry any style at all.
// "Yes." tells us nothing and would drag the length signal down.
const MIN_EXEMPLAR_WORDS = 4;
const MAX_EXEMPLARS = 12;          // matches what buildBlock will show
const MIN_SELECTIONS_FOR_LEAN = 6; // below this, a lean is noise

function words(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean);
}

function normalized(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * What kind of turn is this? Uses the recorded `source` when present, and falls back
 * to elimination for pre-August-2026 logs.
 *
 * The fallback is deliberately conservative: a legacy turn that matches one of our
 * control phrases or one of the user's Express labels is attributed there, and
 * ANYTHING ELSE with no options is 'unknown' rather than 'composed'. Guessing wrong
 * in the direction of "composed" is the expensive error — it puts words in the
 * user's mouth in the prompt — while guessing 'unknown' merely loses some history.
 */
export function classifyTurn(turn, { controlPhrases = [], expressPhrases = [] } = {}) {
    if (!turn || turn.role !== 'user') return null;
    if (turn.source) return turn.source;
    if (typeof turn.selectedIndex === 'number' && turn.selectedIndex >= 0) return 'card';

    const t = normalized(turn.selectedText);
    if (!t) return 'unknown';
    if (controlPhrases.some((p) => normalized(p) === t)) return 'control';
    if (expressPhrases.some((p) => normalized(p) === t)) return 'express';
    return 'unknown';
}

/**
 * The user's own sentences — the only true exemplars in the log.
 * Newest first, deduplicated, and long enough to carry a style.
 */
export function collectExemplars(turns, opts = {}) {
    const seen = new Set();
    const out = [];
    for (let i = turns.length - 1; i >= 0; i--) {
        const turn = turns[i];
        if (classifyTurn(turn, opts) !== 'composed') continue;
        const text = String(turn.selectedText || '').trim();
        if (words(text).length < MIN_EXEMPLAR_WORDS) continue;
        const key = normalized(text);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= MAX_EXEMPLARS) break;
    }
    return out;
}

/**
 * Length preference, measured from real selections.
 *
 * For every turn where the user picked one card out of several, compare the chosen
 * card's length against the median length of what was on offer. This is the one
 * dimension from the Sound Check that can be computed locally with no model call and
 * no judgment: word count is word count. Formality, affect and floor-handling cannot
 * be measured this way and are deliberately not guessed at.
 *
 * Returns null below MIN_SELECTIONS_FOR_LEAN, because a lean drawn from three taps
 * is noise presented as a finding.
 */
export function measureLengthLean(turns, opts = {}) {
    let shorter = 0, longer = 0, level = 0;
    for (const turn of turns) {
        if (classifyTurn(turn, opts) !== 'card') continue;
        const offered = Array.isArray(turn.allOptions) ? turn.allOptions.filter(Boolean) : [];
        if (offered.length < 2) continue;
        const chosen = String(turn.selectedText || '');
        if (!chosen.trim()) continue;

        const lengths = offered.map((o) => words(typeof o === 'string' ? o : (o && o.text)).length)
            .filter((n) => n > 0)
            .sort((a, b) => a - b);
        if (lengths.length < 2) continue;
        const mid = lengths.length % 2
            ? lengths[(lengths.length - 1) / 2]
            : (lengths[lengths.length / 2 - 1] + lengths[lengths.length / 2]) / 2;

        const n = words(chosen).length;
        if (n < mid) shorter++;
        else if (n > mid) longer++;
        else level++;
    }
    const total = shorter + longer + level;
    if (total < MIN_SELECTIONS_FOR_LEAN) return null;

    const decided = shorter + longer;
    // A lean needs to be visible above the noise; 60% of DECIDED picks is the bar.
    let lean = 'neither';
    if (decided && shorter / decided >= 0.6) lean = 'shorter';
    else if (decided && longer / decided >= 0.6) lean = 'longer';
    return { lean, shorter, longer, level, total };
}

/**
 * Everything the harvest concluded, from a flat list of user turns.
 * `conversations` is an array of parsed conversation-log objects.
 */
export function harvest(conversations, opts = {}) {
    const turns = [];
    for (const convo of conversations || []) {
        // storage.listConversationLogs() returns { id, data }; a bare log object is
        // accepted too so this stays testable against plain fixtures.
        const log = convo && convo.data ? convo.data : convo;
        const ex = log && Array.isArray(log.exchanges) ? log.exchanges : [];
        for (const t of ex) if (t && t.role === 'user') turns.push(t);
    }
    return {
        exemplars: collectExemplars(turns, opts),
        lengthLean: measureLengthLean(turns, opts),
        counts: {
            userTurns: turns.length,
            composed: turns.filter((t) => classifyTurn(t, opts) === 'composed').length,
            cards: turns.filter((t) => classifyTurn(t, opts) === 'card').length,
        },
    };
}
