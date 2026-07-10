/* Conversation-loop decision logic — the pure predicates app.js's generateOptions
 * uses to decide what to do with an ingested engine snapshot, extracted so they can
 * be unit-tested without the DOM/async orchestration around them (this is the layer
 * where the July 2026 user-started silent stall actually surfaced). No DOM, no
 * network, no side effects — app.js keeps the effects (logging, rendering, speech).
 */
import { MODE } from './engine.js';

// Which partner actions get the QUESTION-flavored acknowledgment ("Good question.")
// vs. the neutral one ("Let me see.") — only the flavor of the FIRST placeholder
// differs; every complete turn still gets one.
export const QUESTION_ACTIONS = new Set(['QUESTION', 'INVITATION', 'REQUEST']);

// A placeholder plays on every partner turn — a social-presence signal that the user
// heard and is formulating a reply. It fires initialDelay seconds after the PAUSE and
// is aborted if the partner resumes (app.js handlePartnerResumed), so it doesn't need
// a "turn complete" judgment (Ken, July 10 2026). The ONE exception is a
// repair-initiator ("What?"/"Huh?"): that's the instant repair-of-self flow, where a
// "let me think" beat before re-speaking the same thing reads wrong.
export function shouldPlayPlaceholder(snap) {
    const c = snap.lastClassification;
    if (!c) return false;
    if (c.is_repair_initiator) return false;
    return true;
}

// Whether the first placeholder should use the question-flavored acknowledgment.
export function isQuestionFlavored(snap) {
    const c = snap.lastClassification;
    return !!(c && QUESTION_ACTIONS.has(c.partner_action));
}

/**
 * Decide whether an ingested snapshot represents a silent dead-end worth logging.
 * We always show a palette now (no turn_status suppression — Ken, July 10 2026), so
 * `respond` is always true; the one remaining anomaly is an EMPTY palette when the
 * model owed responses — it returned nothing usable, leaving the user with empty
 * cards. REPAIR_OF_SELF is exempt (its rephrase/expand cards are filled by a later
 * prefetch). Logging trips the transcript red-wash + errors.log. Pure: returns the
 * decision, performs no logging/rendering itself.
 */
export function generationOutcome(snap) {
    const c = snap.lastClassification;
    const emptyOwed = !snap.palette.length && snap.mode !== MODE.REPAIR_OF_SELF;
    const anomaly = emptyOwed
        ? { context: 'generateOptions', message: `no response options generated (action=${c && c.partner_action}, mode=${snap.mode})` }
        : null;
    return { respond: true, anomaly };
}
