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
 *
 * ⚠ ALL GOALS ARE EQUIVALENT, AND THAT IS A DECISION (Ken, September 10 2026).
 * There is no primary-versus-constraint distinction and no type field: several may
 * be active at once and the USER'S ORDER is the only statement of relative
 * importance. Ken: "the primary goal versus constraints distinction is
 * overengineered and will be difficult for users to set up" — it asked the user to
 * sort their own goals into categories from the literature, which is exactly why
 * fixed roles were rejected for the Express Panel bands, and the answer is the same
 * one: the user orders their own list.
 *
 * AND THE DISTINCTION IS NOT LOST BY DROPPING IT — it is already in the WORDS. A
 * model given "Making peace, Being upbeat" reads the first as the aim and the second
 * as the manner, because that is what the language means. A type field would have
 * restated the label and charged the user for saying it.
 *
 * `label` IS THE BUTTON FACE, in the -ing form, and both halves of that are
 * deliberate (Ken, September 10 2026). Short, because a goal button's face is a
 * REMINDER RATHER THAN A QUOTATION: every other button in the Flex band shows the
 * words that will be spoken, so its face has to BE them, while a goal button speaks
 * nothing and only has to be enough to recognize which of your own goals it is. A
 * side-dock cell is about 77px wide — eight or nine characters — so the full wording
 * would truncate to the point where two goals look alike. And -ing because "Get
 * help" on a button, in a band where most buttons do speak, invites the user to
 * believe they have just said it; nobody utters "Getting help", so the grammar
 * itself carries intent rather than speech, at no cost in space.
 */
export const RELATIONSHIP_GOALS = [
    // List A — what the user typically wants OUT of talking with them
    { id: 'connect', text: 'Stay connected and catch up', label: 'Catching up' },
    { id: 'information', text: 'Get information or advice', label: 'Finding out' },
    { id: 'help', text: 'Ask for help', label: 'Getting help' },
    { id: 'share', text: 'Share news and feelings', label: 'Telling them' },
    { id: 'plans', text: 'Make plans together', label: 'Making plans' },
    { id: 'repair', text: 'Repair things between us', label: 'Making peace' },
    { id: 'sociable', text: 'Just be sociable, no agenda', label: 'Just chatting' },
    // List C — relational maintenance, standing attributes of the relationship
    { id: 'upbeat', text: 'Be upbeat with them', label: 'Being upbeat' },
    { id: 'open', text: 'Talk openly about our relationship', label: 'Talking about us' },
    { id: 'reassure', text: 'Reassure them I am committed', label: 'Reassuring them' },
    { id: 'together', text: 'Do things together', label: 'Spending time' },
    { id: 'their_people', text: 'Support their other relationships', label: 'Their people' }
];

/** Look up a goal's display text; free-text goals carry their own. */
export function goalText(goal) {
    if (!goal) return '';
    if (goal.text) return goal.text;
    const found = RELATIONSHIP_GOALS.find((g) => g.id === goal.id);
    return found ? found.text : '';
}

/**
 * A goal's SHORT face, for a button. Falls back to the full wording, which is the
 * honest failure: a typed goal has no label until the user gives it one, and showing
 * their own words truncated is better than showing nothing.
 */
export function goalLabel(goal) {
    if (!goal) return '';
    // A LABEL THE USER TYPED WINS OVER EVERYTHING ELSE (Ken, September 10 2026). It
    // only ever exists on a TYPED goal - the twelve carry their own - and it exists
    // because the fallback on the last line is the goal's full wording, which on a
    // three-column side dock is several words too long for one cell.
    if (goal.label && String(goal.label).trim()) return String(goal.label).trim();
    const found = RELATIONSHIP_GOALS.find((g) => g.id === goal.id);
    if (found && found.label) return found.label;
    return goalText(goal);
}

/**
 * How a goal is IDENTIFIED - one place, because two are how a stored goal and a lit
 * button end up disagreeing about whether they are the same goal.
 *
 * A menu goal is its id; a typed goal is its wording, folded to lower case so the
 * same words typed twice are the same goal. Deliberately NOT the label: a label is
 * a face the user can rewrite, and renaming a button must not turn the goal it is
 * switched on for into a different goal.
 */
export function goalKey(goal) {
    if (!goal) return '';
    return goal.id || ('text:' + String(goal.text || '').trim().toLowerCase());
}

/**
 * The goals as EXPRESS PANEL BUTTONS, in the user's own order of importance.
 *
 * One item per goal carrying the three things a button needs and nothing else: a
 * stable key to switch on, a short face, and the full wording that goes to the AI.
 * Built here rather than in the panel because the rules about what resolves to
 * nothing, what counts as a duplicate and what a face falls back to already live in
 * this module, and a second copy of them would drift from the prompt's copy.
 */
export function normalizeGoals(goals) {
    const list = Array.isArray(goals) ? goals : (goals ? [goals] : []);
    const seen = new Set();
    const out = [];
    for (const g of list) {
        if (!g || !(g.id || g.text)) continue;
        const key = goalKey(g);
        if (seen.has(key)) continue;
        seen.add(key);
        // A MENU goal stores its id and nothing else, so a later rewording of the
        // twelve reaches it. A TYPED goal stores its words and, if the user gave it
        // one, the short face its Express Panel button carries.
        if (g.id) { out.push({ id: g.id }); continue; }
        const one = { id: '', text: String(g.text).trim() };
        const label = String(g.label || '').trim();
        if (label) one.label = label;
        out.push(one);
    }
    return out;
}

export function goalItems(goals) {
    const list = Array.isArray(goals) ? goals : (goals ? [goals] : []);
    const out = [];
    const seen = new Set();
    for (const g of list) {
        const text = goalText(g);
        const key = goalKey(g);
        // A stale id from an older release resolves to no wording. It must not become
        // a button: a face with nothing behind it would steer the AI with nothing.
        if (!text || !key || seen.has(key)) continue;
        seen.add(key);
        out.push({ type: 'goal', id: key, label: goalLabel(g), text });
    }
    return out;
}

/**
 * The goals that would actually reach the prompt, IN THE USER'S ORDER, as display
 * strings. Anything that resolves to nothing is dropped and duplicates are removed:
 * a stale id from an older release, or the same goal added twice, would otherwise
 * spend prompt space saying nothing or saying one thing twice.
 *
 * Accepts the legacy single-goal shape as well, so every caller can be handed either
 * and none of them has to know which release wrote the file.
 */
export function goalTexts(goals) {
    const list = Array.isArray(goals) ? goals : (goals ? [goals] : []);
    const out = [];
    for (const g of list) {
        const t = goalText(g);
        if (t && !out.includes(t)) out.push(t);
    }
    return out;
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
    const hasGoal = goalTexts(profile.goals !== undefined ? profile.goals : profile.goal).length > 0;
    const hasNote = !!(profile.note && profile.note.trim());
    const hasPhrases = !!(
        (profile.openers && profile.openers.length) ||
        (profile.windDowns && profile.windDowns.length) ||
        (profile.closings && profile.closings.length)
    );
    return !hasRegister && !hasGoal && !hasNote && !hasPhrases;
}
