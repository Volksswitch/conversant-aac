/* Conversant AAC — per-partner register and standing goal (content layer)
 *
 * The authored lists behind "how I talk with this person" in the People editor.
 * Content only, no mechanism and no DOM — the same split as sound-check-items.js
 * and practice-scenarios.js, so the wording can be revised without touching the
 * model or the editor.
 *
 * WHY A MENU HERE WHEN THE VOICE MODULE USES FORCED CHOICE (Ken, August 7 2026).
 * The Sound Check module deliberately does NOT ask people to describe their own
 * style, because trait-level self-description is the thing they are measurably bad
 * at (Sounds Like Me doc, section 3.3). That objection does not carry over to this
 * screen, and Ken's reasoning is why:
 *
 *   "When generally trying to ascertain the user's voice, I think a forced choice
 *    approach is appropriate. However, when capturing the user's voice for a
 *    specific, well known person with whom they have a history of conversations, I
 *    think we should provide more flexibility and take them at their word."
 *
 * Three things separate the two cases. Per-partner register is COMPARATIVE ("more
 * relaxed than I usually am") rather than absolute; it is grounded in a specific
 * remembered history rather than an average over all behavior; and code-switching
 * by relationship is largely DELIBERATE — you know you speak differently to your
 * brother than to your consultant, because you chose to. That is a recalled policy,
 * not a trait you would have to infer about yourself. Forced choice would also cost
 * a full item run per person, which does not scale across a graph.
 *
 * Two consequences that are load-bearing rather than cosmetic:
 *   - Every dimension defaults to NEUTRAL, and a neutral dimension emits no prompt
 *     text at all. An untouched person contributes nothing, so this cannot quietly
 *     start shaping responses for people the user never edited.
 *   - The prompt states these ASSERTIVELY ("this user is more relaxed with Mum"),
 *     because "take them at their word" is the decision. It does not hedge them as
 *     self-reports, which would invite the model to discount them.
 */

/**
 * Register dimensions, each relative to the user's OWN baseline rather than to any
 * absolute scale. `low`/`high` carry the prompt clause for that end; the neutral
 * middle deliberately has none.
 *
 * The five are the tenor-ish dimensions that actually vary by relationship, and
 * they line up with the stance modifiers already used by Reframe (CLAUDE.md,
 * "List B") so the two vocabularies do not drift apart.
 */
export const REGISTER_DIMENSIONS = [
    {
        key: 'formality',
        label: 'Formality',
        low: { value: 'relaxed', label: 'More relaxed', clause: 'noticeably more relaxed and informal than they usually are' },
        high: { value: 'careful', label: 'More careful', clause: 'more careful and more formal than they usually are' }
    },
    {
        key: 'length',
        label: 'Length',
        low: { value: 'shorter', label: 'Shorter', clause: 'briefer than usual — they keep things short with this person' },
        high: { value: 'fuller', label: 'Fuller', clause: 'fuller and more expansive than usual — they say more to this person' }
    },
    {
        key: 'warmth',
        label: 'Warmth',
        low: { value: 'matter_of_fact', label: 'More matter-of-fact', clause: 'more matter-of-fact and less openly affectionate than usual' },
        high: { value: 'warmer', label: 'Warmer', clause: 'warmer and more openly affectionate than usual' }
    },
    {
        key: 'directness',
        label: 'Directness',
        low: { value: 'hedged', label: 'More hedged', clause: 'more hedged and more careful about how things land than usual' },
        high: { value: 'direct', label: 'More direct', clause: 'more direct and blunter than usual — they get to the point with this person' }
    },
    {
        key: 'humor',
        label: 'Humor',
        low: { value: 'serious', label: 'More serious', clause: 'more serious than usual — they joke around less with this person' },
        high: { value: 'playful', label: 'More playful', clause: 'more playful and readier to joke than usual' }
    }
];

/**
 * Standing relationship goals — what the user wants from this relationship over
 * time, not from one conversation. The union of "List A" (primary conversation
 * goals, from Dillard's goals-plans-action categories) and "List C" (relational
 * maintenance, from Canary & Stafford), per CLAUDE.md July 13 2026.
 *
 * List C is offered ONLY here: "maintain" presupposes an existing relationship, so
 * it is meaningless for the arbitrary partner that the per-conversation goal
 * control will serve. That control, when it is built, offers List A alone.
 */
export const RELATIONSHIP_GOALS = [
    // List A — what the user typically wants OUT of talking with them
    { id: 'connect', text: 'Stay connected and catch up' },
    { id: 'information', text: 'Get information or advice' },
    { id: 'help', text: 'Ask for help' },
    { id: 'share', text: 'Share news and feelings' },
    { id: 'plans', text: 'Make plans together' },
    { id: 'repair', text: 'Repair things between us' },
    { id: 'sociable', text: 'Just be sociable, no agenda' },
    // List C — relational maintenance, standing attributes of the relationship
    { id: 'upbeat', text: 'Be upbeat with them' },
    { id: 'open', text: 'Talk openly about our relationship' },
    { id: 'reassure', text: 'Reassure them I am committed' },
    { id: 'together', text: 'Do things together' },
    { id: 'their_people', text: 'Support their other relationships' }
];

/** Look up a goal's display text; free-text goals carry their own. */
export function goalText(goal) {
    if (!goal) return '';
    if (goal.text) return goal.text;
    const found = RELATIONSHIP_GOALS.find((g) => g.id === goal.id);
    return found ? found.text : '';
}

/**
 * Turn a stored register object into prompt clauses. Neutral and unknown values
 * produce nothing, which is what makes an untouched person cost zero tokens and
 * exert zero influence.
 */
export function registerClauses(register) {
    if (!register) return [];
    const out = [];
    for (const dim of REGISTER_DIMENSIONS) {
        const v = register[dim.key];
        if (!v) continue;
        if (dim.low.value === v) out.push(dim.low.clause);
        else if (dim.high.value === v) out.push(dim.high.clause);
    }
    return out;
}

/** True when nothing on this profile would reach the prompt. */
export function isEmptyProfile(profile) {
    if (!profile) return true;
    const hasRegister = registerClauses(profile.register).length > 0;
    const hasGoal = !!goalText(profile.goal);
    const hasNote = !!(profile.note && profile.note.trim());
    const hasPhrases = !!(
        (profile.openers && profile.openers.length) ||
        (profile.windDowns && profile.windDowns.length) ||
        (profile.closings && profile.closings.length)
    );
    return !hasRegister && !hasGoal && !hasNote && !hasPhrases;
}
