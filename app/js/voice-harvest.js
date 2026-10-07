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

import { buildTurns, normalizeReview, isPractice } from './review-model.js';

// A turn is only a usable exemplar if it is long enough to carry any style at all.
// Shorter ones are kept apart as SHORT REPLIES (below): "Nah, I'm good." says little
// about phrasing but a great deal about how briefly this person answers.
const MIN_EXEMPLAR_WORDS = 4;
const MAX_EXEMPLARS = 12;          // what buildBlock shows
// More are kept than are shown, so a sentence the user removes, or one the catchphrase
// redaction empties, frees its place for the next one instead of shrinking the list.
const MAX_POOL = 30;
const MAX_SHORT_REPLIES = 8;
const MIN_SELECTIONS_FOR_LEAN = 6; // below this, a lean is noise
// The four kinds of reply the length measure compares within. Openers, wind-downs,
// goodbyes, the partner's own choices and the repair-of-self options are fixed or
// shaped by something other than the user's taste, so a pick among them says nothing
// about how long they like a reply.
const STRUCTURAL_SLOTS = new Set(['PREFERRED', 'DISPREFERRED', 'INITIATIVE', 'REPAIR']);
// A kind of reply needs this many past examples before its typical length means much.
const MIN_SLOT_SAMPLES = 8;

function words(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean);
}

function normalized(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
}

export { MIN_EXEMPLAR_WORDS, MAX_EXEMPLARS };

/**
 * Strip the user's catchphrases out of a harvested sentence.
 *
 * ⚠ CATCHPHRASES ARE EXPRESS PANEL BUTTONS AND THE AI NEVER PRODUCES THEM (CLAUDE.md,
 * August 5 2026). A sentence the user typed can contain one ("Let's go! I'll meet you
 * Saturday."), and an exemplar is sent under "follow their phrasing" - so left in, it
 * teaches the model to say the user's signature line for them. The redaction happens
 * at the boundary where harvested prose reaches the model (CR-070).
 *
 * `phrases` must be the user's OWN Express phrases (provenance-filtered), never the
 * shipped defaults: stripping "Yes" or "Thank you" out of every sentence would wreck
 * the exemplars. Case-insensitive, whole-phrase, trailing punctuation included.
 * Returns the cleaned sentence, possibly empty.
 */
export function redactCatchphrases(text, phrases = []) {
    let out = String(text || '');
    const list = phrases.map((p) => String(p || '').trim().replace(/[.!?,;:]+$/, '').trim())
        .filter((p) => p.length > 0)
        .sort((a, b) => b.length - a.length);   // longest first: "Let's go team" before "Let's go"
    for (const p of list) {
        const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(^|[^\\w'])${esc}[.!?,;:]*(?=$|[^\\w'])`, 'gi');
        out = out.replace(re, '$1');
    }
    return out.replace(/\s+/g, ' ')
        .replace(/\s+([.!?,;:])/g, '$1')
        .replace(/^[\s.!?,;:\-]+/, '')
        .replace(/[\s,;:\-]+$/, '')
        .trim();
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
    return ownSentences(turns, opts, (n) => n >= MIN_EXEMPLAR_WORDS, opts.max || MAX_EXEMPLARS);
}

/**
 * The user's own replies that are too short to show phrasing - one to three words
 * they typed themselves. They used to be dropped, which lost the clearest evidence a
 * terse user gives: that a few words are often all they want to say. Newest first.
 */
export function collectShortReplies(turns, opts = {}) {
    return ownSentences(turns, opts, (n) => n > 0 && n < MIN_EXEMPLAR_WORDS, opts.max || MAX_SHORT_REPLIES);
}

function ownSentences(turns, opts, lengthOk, max) {
    const seen = new Set();
    const out = [];
    for (let i = turns.length - 1; i >= 0; i--) {
        const turn = turns[i];
        // A response option the user REWORDED in review is their own words too: the
        // sentence is theirs even though the model wrote the first draft of it.
        if (classifyTurn(turn, opts) !== 'composed' && !turn.reworded) continue;
        const text = String(turn.selectedText || '').trim();
        if (!lengthOk(words(text).length)) continue;
        const key = normalized(text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= max) break;
    }
    return out;
}

/**
 * Two newest-first lists, taken in turn, so neither can crowd the other out for good.
 * Review answers lead each pair: a sentence written on purpose, looking back, is the
 * better example of the two. Until October 6 2026 every review answer went ahead of
 * every live one, so a few reviews filled all twelve places and nothing typed in a
 * conversation reached the AI again.
 */
export function interleave(first, second, max) {
    const seen = new Set();
    const out = [];
    for (let i = 0; out.length < max && (i < first.length || i < second.length); i++) {
        for (const t of [first[i], second[i]]) {
            if (t === undefined || out.length >= max) continue;
            const key = normalized(t);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(t);
        }
    }
    return out;
}

/**
 * The typical length of each kind of reply the app has offered, from the offer records
 * (every set shown carries the kind of each response option since September 10 2026).
 * Returns { SLOT: median word count } for kinds with enough examples. Practice
 * conversations are left out, for the same reason they are left out of the harvest.
 */
export function slotMedians(conversations) {
    const lengths = new Map();
    for (const convo of conversations || []) {
        const log = convo && convo.data ? convo.data : convo;
        if (!log || isPractice(log)) continue;
        const ex = Array.isArray(log.exchanges) ? log.exchanges : [];
        for (const e of ex) {
            if (!e || e.role !== 'offer' || !Array.isArray(e.options)) continue;
            for (const o of e.options) {
                if (!o || !STRUCTURAL_SLOTS.has(o.slot)) continue;
                const n = words(o.text).length;
                if (!n) continue;
                if (!lengths.has(o.slot)) lengths.set(o.slot, []);
                lengths.get(o.slot).push(n);
            }
        }
    }
    const out = {};
    for (const [slot, list] of lengths) {
        if (list.length < MIN_SLOT_SAMPLES) continue;
        out[slot] = median(list);
    }
    return out;
}

function median(list) {
    const a = list.slice().sort((x, y) => x - y);
    return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
}

/**
 * Length preference, measured from real selections.
 *
 * ⚠ IT COMPARES LIKE WITH LIKE (October 6 2026). It used to compare a pick with the
 * median of the whole set offered. But the four response options are four different
 * KINDS of reply - a decline and a change of direction are long by design, and the
 * clarify option is nearly always the shortest and is rarely picked - so the old
 * measure mostly recorded which kind the user picked. A user who simply never needed
 * to clarify read as preferring fuller replies; for a terse test persona it told the
 * AI "do not clip responses down to the minimum", and that sentence alone made the
 * options longer (Conversant AAC Sounds Like Me Evaluation, October 6 2026).
 *
 * So a pick now counts only against options OF ITS OWN KIND: a best guess against the
 * typical length of the best guesses the app has offered this user, and so on. A user
 * who picks by content gives no lean, which is right. Picks from the fixed openers,
 * wind-downs and goodbyes do not count at all. The typical lengths drift as the
 * suggestions change; that blurs the measure a little and never biases it toward one
 * kind of reply.
 *
 * `opts.slotMedians` is { SLOT: median words } (see slotMedians). An Express button
 * chosen in review instead of the four counts as shorter only when it is shorter than
 * every option offered - it was chosen over the whole set, not within one kind.
 *
 * Returns null below MIN_SELECTIONS_FOR_LEAN, because a lean drawn from three taps
 * is noise presented as a finding.
 */
export function measureLengthLean(turns, opts = {}) {
    const medians = opts.slotMedians || {};
    let shorter = 0, longer = 0, level = 0;
    for (const turn of turns) {
        if (classifyTurn(turn, opts) !== 'card') continue;
        const chosen = String(turn.selectedText || '');
        if (!chosen.trim()) continue;
        const n = words(chosen).length;

        if (turn.viaExpress) {
            const offered = (Array.isArray(turn.allOptions) ? turn.allOptions : [])
                .map((o) => words(typeof o === 'string' ? o : (o && o.text)).length)
                .filter((x) => x > 0);
            if (!offered.length) continue;
            if (n < Math.min(...offered)) shorter++;
            else level++;
            continue;
        }
        const mid = STRUCTURAL_SLOTS.has(turn.selectedSlot) ? medians[turn.selectedSlot] : undefined;
        if (mid === undefined || mid === null) continue;

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
 * What the app learns from a review answer. Since October 6 2026 there is ONE kind,
 * the rewrite (Ken: "Let's simplify everything"): the whole reply the user would rather
 * have said. Kept as a table of one, so a lesson can still be removed without touching
 * anything else.
 *
 *   withdraw  - the live choice for that turn stops counting
 *   pair(a,t) - a pair kept for ONE person: what they said and were doing, and what the
 *               user would rather have said. Used only when talking with that person.
 *   turn(a,t) - a user turn to count with everyone, or null for none
 *
 * WITH A KNOWN PERSON, A REWRITE IS A PAIR FOR THEM, NOT A SHARED EXAMPLE. Before this a
 * sentence written for Mom went into the examples sent with every partner, so it shaped
 * how the user spoke to a store clerk. The October 6 test gave rewrites to the AI as
 * pairs for one person and they changed how it spoke with that person.
 * With nobody named, there is no one to keep it for, so it is one of the user's own
 * sentences, as a sentence typed in a live conversation is.
 */
export const REVIEW_LESSONS = {
    rewrite: {
        withdraw: true,
        pair: (a, t) => {
            const personId = (t.context && t.context.partnerId) || (a.moment && a.moment.partnerId) || null;
            if (!personId || !a.text) return null;
            return {
                personId,
                person: (t.context && t.context.partner) || (a.moment && a.moment.partner) || null,
                action: t.partnerAction || (a.moment && a.moment.action) || null,
                partnerText: t.partnerText || (a.moment && a.moment.partnerText) || '',
                text: a.text,
                at: (t.user && t.user.at) || (t.partner && t.partner.at) || null,
            };
        },
        turn: (a, t) => {
            const personId = (t.context && t.context.partnerId) || (a.moment && a.moment.partnerId) || null;
            return personId || !a.text ? null : { source: 'composed', selectedText: a.text };
        },
    },
};

/**
 * What a conversation's REVIEW says the user would rather have said. `replaced` holds
 * the timestamps of the live user turns a rewrite overrides; `pairs` are the rewrites
 * kept for one person; `turns` are rewrites counted with everyone.
 */
export function reviewedTurns(data, rawReview, lessons = REVIEW_LESSONS) {
    const out = { replaced: new Set(), turns: [], pairs: [], steers: [] };
    if (!data || !rawReview) return out;
    const review = normalizeReview(rawReview);
    let turns;
    try { turns = buildTurns(data); } catch { return out; }
    for (const t of turns) {
        const entry = review.turns[t.key];
        const a = entry && entry.answer;
        const lesson = a && lessons[a.kind];
        if (!lesson) continue;
        const ans = { ...a, text: String(a.text || '').trim() };
        if (lesson.withdraw && t.user && t.user.at) out.replaced.add(t.user.at);
        const pair = lesson.pair ? lesson.pair(ans, t) : null;
        if (pair) out.pairs.push({ ...pair, lesson: a.kind });
        const turn = lesson.turn ? lesson.turn(ans, t) : null;
        if (turn) out.turns.push({ role: 'user', ...turn, fromReview: true, lesson: a.kind });
    }
    return out;
}

// Newest first, at most MAX_PAIRS_PER_PERSON for each person, so one long review of
// one conversation cannot crowd out what the user said with them later.
const MAX_PAIRS_PER_PERSON = 12;
function newestPairs(pairs) {
    const sorted = pairs.slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    const per = new Map();
    const out = [];
    for (const p of sorted) {
        const n = per.get(p.personId) || 0;
        if (n >= MAX_PAIRS_PER_PERSON) continue;
        per.set(p.personId, n + 1);
        const { lesson, ...rest } = p;
        out.push(rest);
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
    const { turns, pairs } = reviewedTurns(data, rawReview);
    const own = turns.filter((t) => t.source === 'composed' || t.reworded)
        .map((t) => t.selectedText);
    return {
        exemplars: own.filter((t) => words(t).length >= MIN_EXEMPLAR_WORDS),
        // Kept as short replies rather than dropped (see collectShortReplies).
        shortReplies: own.filter((t) => words(t).length > 0 && words(t).length < MIN_EXEMPLAR_WORDS),
        choices: 0,
        byLesson: countByLesson(turns),
        pairs: pairs.length,
    };
}

/**
 * Everything the harvest concluded, from a flat list of user turns.
 * `conversations` is an array of parsed conversation-log objects, or the
 * { id, data, review } entries storage.listConversationLogs() returns.
 *
 * ⚠ PRACTICE CONVERSATIONS ARE LEFT OUT (October 6 2026). The partner there is the AI
 * playing a scenario, the scenario sets the register (a job interview is not how
 * anyone talks to their sister), and content invented for the role-play can leak in.
 * They were read as though they were real, and the prompt said so. Running one shipped
 * scenario three times was enough to change the length instruction on the test data.
 */
export function harvest(conversations, opts = {}) {
    const live = [];
    const fromReview = [];
    const reviewSteers = [];
    const reviewPairs = [];
    let practiceSkipped = 0;
    for (const convo of conversations || []) {
        // storage.listConversationLogs() returns { id, data }; a bare log object is
        // accepted too so this stays testable against plain fixtures.
        const log = convo && convo.data ? convo.data : convo;
        if (log && isPractice(log)) { practiceSkipped++; continue; }
        const ex = log && Array.isArray(log.exchanges) ? log.exchanges : [];
        const reviewed = reviewedTurns(log, convo && convo.data ? convo.review : null);
        for (const t of ex) {
            if (!t || t.role !== 'user') continue;
            if (t.timestamp && reviewed.replaced.has(t.timestamp)) continue;
            live.push(t);
        }
        fromReview.push(...reviewed.turns);
        reviewSteers.push(...reviewed.steers);
        reviewPairs.push(...reviewed.pairs);
    }
    const all = live.concat(fromReview);
    const pool = { ...opts, max: MAX_POOL };
    return {
        // Read by voice.js: a length reading from an older version measured the whole
        // set offered and is not used (October 6 2026).
        version: 2,
        // Review answers and live sentences share the places (see interleave).
        exemplars: interleave(collectExemplars(fromReview, pool), collectExemplars(live, pool), MAX_POOL),
        shortReplies: interleave(collectShortReplies(fromReview, opts), collectShortReplies(live, opts), MAX_SHORT_REPLIES),
        lengthLean: measureLengthLean(all, { ...opts, slotMedians: slotMedians(conversations) }),
        // Reframe instructions typed in review. Live ones are recorded as they happen
        // (voice.recordSteer); these are rebuilt from the review files each time.
        steers: reviewSteers,
        // Review rewrites kept for one person each, newest first. voice.reviewPairsFor
        // hands a person's to the AI only while talking with them.
        pairs: newestPairs(reviewPairs),
        counts: {
            userTurns: live.length,
            composed: live.filter((t) => classifyTurn(t, opts) === 'composed').length,
            cards: live.filter((t) => classifyTurn(t, opts) === 'card').length,
            reviewed: fromReview.length,
            practiceSkipped,
            // How much each review lesson contributed, so its effect can be measured
            // and a lesson that turns out to be wrong can be found and removed.
            byLesson: countByLesson(fromReview),
            reviewPairs: reviewPairs.length,
        },
    };
}
