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

// A placeholder plays after ANY complete partner turn (Ken, July 8 2026) — a
// social-presence signal that the user heard and is formulating a reply. Only two
// cases stay silent: an INCOMPLETE turn (partner still talking — don't cut in) and a
// repair-initiator ("What?"/"Huh?" — the instant repair-of-self flow, where a "let
// me think" beat before re-speaking reads wrong).
export function shouldPlayPlaceholder(snap) {
    const c = snap.lastClassification;
    if (!c) return false;
    if (c.turn_status !== 'COMPLETE' || c.is_repair_initiator) return false;
    return true;
}

// Whether the first placeholder should use the question-flavored acknowledgment.
export function isQuestionFlavored(snap) {
    const c = snap.lastClassification;
    return !!(c && QUESTION_ACTIONS.has(c.partner_action));
}

/**
 * Decide, from an ingested snapshot + the engine request context, what
 * generateOptions should do — and whether the outcome is a silent dead-end worth
 * logging. Pure: returns the decision, performs no logging/rendering itself.
 *
 * Returns { respond, anomaly }:
 *   respond  — true → show the palette + (maybe) placeholders; false → the
 *              "Partner still speaking…" hold (mid-utterance pause).
 *   anomaly  — null, or { context, message } to log (trips the red-wash +
 *              errors.log). Two tripwires, both near-impossible in healthy use:
 *     (a) a non-COMPLETE turn WHILE THE USER IS LEADING — the signature of the
 *         user-started stall bug (the engine now forces COMPLETE there, so this is
 *         a regression tripwire); a normal partner mid-sentence pause is NOT logged.
 *     (b) a COMPLETE turn that produced an EMPTY palette — the model claimed a
 *         complete turn but gave no usable responses, leaving the user with empty
 *         cards. REPAIR_OF_SELF is exempt (its cards are filled by a later prefetch).
 */
export function generationOutcome(snap, requestContext = {}) {
    const c = snap.lastClassification;
    const incomplete = !!(c && c.turn_status !== 'COMPLETE' && !c.is_repair_initiator);

    if (incomplete) {
        const anomaly = requestContext.user_holds_floor_to_lead
            ? { context: 'generateOptions', message: `no options while user leading (turn_status=${c.turn_status}) — partner reply to an opener misclassified as incomplete` }
            : null;
        return { respond: false, anomaly };
    }

    const emptyOwed = !snap.palette.length && snap.mode !== MODE.REPAIR_OF_SELF;
    const anomaly = emptyOwed
        ? { context: 'generateOptions', message: `no options for a complete turn (action=${c && c.partner_action}, mode=${snap.mode}, user_leading=${!!requestContext.user_holds_floor_to_lead})` }
        : null;
    return { respond: true, anomaly };
}
