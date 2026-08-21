/* Conversation-loop decision logic — the pure predicates app.js's generateOptions
 * uses to decide what to do with an ingested engine snapshot, extracted so they can
 * be unit-tested without the DOM/async orchestration around them (this is the layer
 * where the July 2026 user-started silent stall actually surfaced). No DOM, no
 * network, no side effects — app.js keeps the effects (logging, rendering, speech).
 */
import { MODE } from './engine.js';

// A placeholder plays on every partner turn — a social-presence signal that the user
// heard and is formulating a reply. It fires initialDelay seconds after the PAUSE and
// is aborted if the partner resumes (app.js handlePartnerResumed), so it doesn't need
// a "turn complete" judgment (Ken, July 10 2026). The ONE exception is a
// repair-initiator ("What?"/"Huh?"): that's the instant repair-of-self flow, where a
// "let me think" beat before re-speaking the same thing reads wrong.
//
// Since August 7 2026 the ladder is already running by the time this is consulted
// (placeholders.arm() starts it at the silence checkpoint), so a false here means
// STOP rather than "don't start" — and on a slow round-trip one acknowledgment may
// already have been spoken. Accepted: the alternative was holding every placeholder
// behind the AI, which made the timing setting inert.
export function shouldPlayPlaceholder(snap) {
    const c = snap.lastClassification;
    if (!c) return false;
    if (c.is_repair_initiator) return false;
    return true;
}

// `isQuestionFlavored` / `QUESTION_ACTIONS` were REMOVED August 7 2026 (Ken). They
// existed only to choose between a question-flavored acknowledgment ("Good
// question.") and a neutral one, which is exactly the choice that forced the
// placeholder to wait for the classification. Every acknowledgment phrase is now
// partner-statement independent, so there is nothing to choose. Do not reintroduce
// a turn-type-dependent placeholder pool without re-deciding the timing model.

// --- Fast-path closing detection (Ken, July 2026) ---------------------------
//
// When the user is winding down and the partner replies with a plain farewell,
// re-offer the goodbyes IMMEDIATELY without an AI round-trip. The AI would have
// classified the reply CLOSING and we'd have discarded its generated responses
// for the static closer list anyway, so the round-trip only adds latency — and
// here SPEED (letting the user speak another closing sooner) matters more than
// the token saving.
//
// FIELD-FEEDBACK NOTE / DECISION: this is a deliberately dumb keyword+length
// heuristic, applied ONLY while winding down (see app.js generateOptions'
// pre-closing guard). It is biased toward PRECISION, because the two error modes
// are asymmetric:
//   - A MISS (a real farewell we don't recognize, e.g. an unusual phrasing or a
//     reply longer than MAX_CLOSING_WORDS) simply falls through to the normal AI
//     path — same behavior as before, no harm, just no time saved.
//   - A FALSE POSITIVE (we treat a NON-farewell as a goodbye) would show closings
//     when the partner actually REOPENED the conversation. That's the annoying
//     case, so the patterns require a clear farewell token in a short reply, and
//     ambiguous bare words ("later", "night") are intentionally excluded.
// If the field reports either (goodbyes that still lag, or closings appearing when
// the partner kept talking), tune MAX_CLOSING_WORDS / FAREWELL_PATTERNS here — or
// remove the fast path entirely to always defer to the AI classification.
const FAREWELL_PATTERNS = [
    /\bbye\b/, /\bgoodbye\b/, /\bgood bye\b/, /\bbye bye\b/, /\bcya\b/, /\bttyl\b/,
    /\bfarewell\b/, /\bso long\b/, /\bpeace out\b/,
    /\bsee (you|ya|u)\b/, /\btake care\b/, /\btake it easy\b/,
    /\bgood ?night\b/,
    /\btalk (to you )?(soon|later)\b/, /\bcatch you later\b/,
    /\bhave a (good|great|nice) (one|day|night|evening|weekend|rest|time)\b/,
    /\b(gotta|got to|have to|need to|should|must) (get )?go(ing)?\b/,
    /\bi('m| am) off\b/,
    /\buntil next time\b/,
    /\byou too\b/,
    /\b(nice|good|great) (talking|seeing|chatting)\b/,
];

const MAX_CLOSING_WORDS = 6;

// Does this partner reply read as a plain farewell? Normalizes to lowercase
// letters/digits/apostrophes, requires it to be short, and to contain one of the
// farewell patterns above. Pure and side-effect-free (unit-tested).
export function looksLikeClosing(text) {
    if (!text) return false;
    const norm = String(text).toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
    if (!norm) return false;
    if (norm.split(' ').length > MAX_CLOSING_WORDS) return false;
    return FAREWELL_PATTERNS.some((re) => re.test(norm));
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

/**
 * After the user speaks AS THEMSELVES — an Express Panel phrase, or a composed
 * "In my own words" statement — should the app start capturing the reply?
 *
 * The bug this fixes (Ken, August 7 2026): both routes ended in app.js's
 * resumeOrIdle(), which opens the mic only when the session was already armed by a
 * manual Listen press AND auto-resume is on. So an Express phrase used to OPEN a
 * conversation — plausibly the first thing a user does in a session — left the app
 * idle. The partner then answered a conversation the app was not listening to and
 * nothing was captured, with no error anywhere: the same silent-failure class as
 * the July 2026 stall and the August 2026 Listen bug.
 *
 * Selecting an OPENER has always done the right thing here (app.js: `manualListenArmed
 * = true; startFreshListening()`), and opening a conversation with "Hi" from the
 * Express Panel is the same act — the user has spoken to someone and a reply is
 * coming. So the two paths are made consistent rather than a new policy invented.
 *
 * Mid-conversation, auto-resume keeps its meaning: a user who turned it off asked to
 * control the mic themselves, and the Listen button is one tap away. Overriding an
 * explicit setting is a different decision from fixing an unreachable state.
 */
export function captureAfterUserSpeaks({ opensConversation, armed, autoResume }) {
    if (opensConversation) return true;   // same act as selecting an opener
    return Boolean(armed && autoResume);
}

/**
 * A newer set of suggestions has arrived for the partner turn already on screen.
 * Should it be HELD rather than shown?
 *
 * THE MEASUREMENT THAT FORCED THIS (Ken, August 21 2026). One tester's report: 32
 * sets of suggestions offered in twenty minutes, 15 of them (47%) replaced before
 * she touched anything; a set surviving a typical 11s against her own 7.8s of
 * reading and choosing; and a last conversation of five sets, nothing chosen, then
 * a message to us. Her words were "the choices kept disappearing when I went to
 * pick one", and she was describing two things at once — the cards being wiped at
 * the start of each round-trip, and the replacement at the end of it.
 *
 * ⚠ THIS IMPLEMENTS A RULE THAT WAS ALREADY WRITTEN DOWN AND NEVER BUILT: palette
 * updates queue until a selection boundary, options never change under a user
 * mid-selection, stated as mandatory since June 2026. So it does not reopen the
 * continuous-capture design, which is right — a later pause genuinely knows more.
 * What was wrong was delivering that knowledge on top of someone's hand.
 *
 * TWO CONDITIONS, AND BOTH MATTER:
 *
 *   `paletteLive` — cards are up and the user has not acted on them. With an empty
 *   or already-answered palette there is nothing to disturb, so the newer set shows
 *   at once. This is what keeps the FIRST offer of every turn instant.
 *
 *   `shownMode === nextMode` — the modes agree. ⚠ A CHANGE OF MODE MUST ALWAYS
 *   LAND, and holding one would be worse than the defect being fixed: if the
 *   partner has begun closing, the user would sit answering a question nobody
 *   asked; if the partner said "What?", their request to repeat would hang behind
 *   cards that cannot answer it. Those are not better versions of the same offer,
 *   they are a different kind of offer.
 *
 * Anything the USER asked for — Reframe, a choice chip, the regenerate button — is
 * a selection boundary by definition and never reaches this decision.
 */
export function shouldHoldPalette({ paletteLive, shownMode, nextMode }) {
    if (!paletteLive) return false;
    return shownMode === nextMode;
}
