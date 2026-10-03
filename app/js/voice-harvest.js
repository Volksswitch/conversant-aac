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

import { buildTurns, normalizeReview } from './review-model.js';

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
        // A response option the user REWORDED in review is their own words too: the
        // sentence is theirs even though the model wrote the first draft of it.
        if (classifyTurn(turn, opts) !== 'composed' && !turn.reworded) continue;
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
 * What the app learns from each kind of review answer. ONE ENTRY PER KIND, ON PURPOSE
 * (Ken, October 3 2026): "we should, as part of the design, modularize these
 * input/action pairs so that some can be abandoned without shredding the code."
 * Each one is a guess about what an answer means, and some of the guesses will turn
 * out to be wrong. Deleting an entry removes that lesson completely and touches
 * nothing else: an answer with no entry leaves the live turn exactly as it was.
 *
 * Each lesson has:
 *   withdraw  - the live choice for that turn stops counting
 *   turn(a,t) - a user turn to count in its place, or null for none
 *
 * The turn a lesson returns is read by the rest of this module like any other:
 * source 'composed' (or `reworded`) makes it a voice example, and source 'card' with
 * the offered set in `allOptions` makes it a choice in the length measure. Every turn
 * is stamped with its lesson id, so the harvest can report how much each lesson
 * contributed - the first step towards measuring which guesses are right.
 */
export const REVIEW_LESSONS = {
    // A sentence typed in review is the user's own words: a voice example, exactly like
    // a sentence typed during a live conversation.
    typed: {
        withdraw: true,
        turn: (a) => (a.text ? { source: 'composed', selectedText: a.text } : null),
    },
    // A response option marked closer is the user's CHOICE, in place of the live one.
    // The words are still the model's, so it is a choice only, never a voice example -
    // the same rule that keeps a live card out of the examples. A reworded option is
    // both: the user's choice, and the user's words.
    card: {
        withdraw: true,
        turn: (a, t) => (a.text ? {
            source: 'card', selectedText: a.text, selectedIndex: a.index,
            allOptions: t.cards.map((c) => c.text), reworded: !!a.rewritten,
        } : null),
    },
    // An Express button instead of any of the four: a choice of a short, ready-made
    // reply over the offered set, so it counts in the length measure. The phrase is a
    // button label, short for that reason alone, so it is never a voice example.
    phrase: {
        withdraw: true,
        turn: (a, t) => (a.text && t.cards.length ? {
            source: 'card', selectedText: a.text, allOptions: t.cards.map((c) => c.text),
            viaExpress: true,
        } : null),
    },
    // "I would have played a sound": the live choice was not what they wanted, and a
    // sound says nothing about how they word things.
    sound: { withdraw: true, turn: () => null },
    // "I would have asked for a different set": the four missed, for a reason the
    // answer does not say. Nothing to learn about the voice, only that the live choice
    // was not really their choice.
    more: { withdraw: true, turn: () => null },
};

/**
 * What a conversation's REVIEW says the user would rather have done, as user turns the
 * rest of this module already understands (Conversation Review, Ken, October 3 2026:
 * "We need to ensure that the work a user goes through to review a conversation
 * genuinely impacts the system's ability to sound like them"). The meaning of each
 * kind of answer lives in REVIEW_LESSONS above.
 *
 * `replaced` holds the timestamps of the live user turns a review answer overrides.
 */
export function reviewedTurns(data, rawReview, lessons = REVIEW_LESSONS) {
    const out = { replaced: new Set(), turns: [] };
    if (!data || !rawReview) return out;
    const review = normalizeReview(rawReview);
    let turns;
    try { turns = buildTurns(data); } catch { return out; }
    for (const t of turns) {
        const entry = review.turns[t.key];
        const a = entry && entry.answer;
        const lesson = a && lessons[a.kind];
        if (!lesson) continue;
        if (lesson.withdraw && t.user && t.user.at) out.replaced.add(t.user.at);
        const turn = lesson.turn({ ...a, text: String(a.text || '').trim() }, t);
        if (turn) out.turns.push({ role: 'user', ...turn, fromReview: true, lesson: a.kind });
    }
    return out;
}

function countByLesson(turns) {
    const out = {};
    for (const t of turns) if (t.lesson) out[t.lesson] = (out[t.lesson] || 0) + 1;
    return out;
}

/**
 * What ONE conversation's review gives the voice: the sentences that count as the
 * user's own words, and how many turns now count a different response option as their
 * choice. Uses the same length rule as the harvest, so the review screen never claims
 * a sentence the harvest would drop.
 */
export function reviewContributions(data, rawReview) {
    const { turns } = reviewedTurns(data, rawReview);
    const own = turns.filter((t) => t.source === 'composed' || t.reworded)
        .map((t) => t.selectedText);
    return {
        exemplars: own.filter((t) => words(t).length >= MIN_EXEMPLAR_WORDS),
        tooShort: own.filter((t) => words(t).length < MIN_EXEMPLAR_WORDS),
        choices: turns.filter((t) => t.source === 'card' && !t.reworded).length,
        byLesson: countByLesson(turns),
    };
}

/**
 * Everything the harvest concluded, from a flat list of user turns.
 * `conversations` is an array of parsed conversation-log objects, or the
 * { id, data, review } entries storage.listConversationLogs() returns.
 */
export function harvest(conversations, opts = {}) {
    const turns = [];
    const fromReview = [];
    for (const convo of conversations || []) {
        // storage.listConversationLogs() returns { id, data }; a bare log object is
        // accepted too so this stays testable against plain fixtures.
        const log = convo && convo.data ? convo.data : convo;
        const ex = log && Array.isArray(log.exchanges) ? log.exchanges : [];
        const reviewed = reviewedTurns(log, convo && convo.data ? convo.review : null);
        for (const t of ex) {
            if (!t || t.role !== 'user') continue;
            if (t.timestamp && reviewed.replaced.has(t.timestamp)) continue;
            turns.push(t);
        }
        fromReview.push(...reviewed.turns);
    }
    // Review answers go LAST, so the newest-first exemplar walk reaches them first:
    // a sentence the user wrote on purpose, looking back, outranks one typed in a hurry.
    const all = turns.concat(fromReview);
    return {
        exemplars: collectExemplars(all, opts),
        lengthLean: measureLengthLean(all, opts),
        counts: {
            userTurns: turns.length,
            composed: turns.filter((t) => classifyTurn(t, opts) === 'composed').length,
            cards: turns.filter((t) => classifyTurn(t, opts) === 'card').length,
            reviewed: fromReview.length,
            // How much each review lesson contributed, so its effect can be measured
            // and a lesson that turns out to be wrong can be found and removed.
            byLesson: countByLesson(fromReview),
        },
    };
}
