/* Express Panel — base-UI quick-speak + influencer panel (June 2026)
 *
 * The panel is now a single USER-EDITABLE, ORDERED list of typed items (Ken,
 * June 26 2026). Each item is one of three types, and the item's position in the
 * list maps 1:1 to a cell of the paired keyboard layout's grid (so one static
 * keyguard overlays both — Rule 9; the editor lets the user reorder = re-map):
 *
 *   - phrase  : { type:'phrase',  text, cat, speak? }   speaks directly on tap
 *                 (single- or confirming double-tap per Rule 10). `cat` colors it.
 *   - partner : { type:'partner', name, personId? }             a TOGGLE that
 *                 marks who the user is talking with (a substitute / validation
 *                 for partner recognition). Personalizes openers ("Hi Tim, …")
 *                 and tells the AI who the partner is. May reference a person in
 *                 the relationship graph (personId) or be a free-form name.
 *   - feeling : { type:'feeling', text }                a TOGGLE that sets the
 *                 user's current mood so suggestions lean that way.
 *   - place   : { type:'place',   name, placeId? }      a TOGGLE that marks WHERE
 *                 the user is (My Places — places.js). This is Phase-2 situational
 *                 awareness obtained without GPS: the user taps where they are, and
 *                 the AI is told the setting plus whatever facts are recorded about
 *                 it ("favorite drink: mocha latte").
 *   - empty   : { type:'empty' }                        a cell the user has NOT yet
 *                 defined. It holds a POSITION and nothing else: it renders as an
 *                 outlined, text-less button and carries no words, so it is never
 *                 spoken and is never evidence of the user's voice.
 *
 * WHY 'empty' HAS TO EXIST (Ken, August 8 2026). The list is dense — position N in
 * the list is cell N of the grid — so a cell PAST the end of the list cannot be
 * addressed at all. Without a placeholder, "put a button in this particular cell"
 * could only ever mean "append to the end", which is the very thing tapping a cell
 * exists to avoid: the user picks the position by tapping it, instead of typing into
 * a list and then reordering rows until it lands there. An empty item is how the
 * gap between the last defined item and the tapped cell is held open.
 *
 * Partner, Feeling and Place are mutually-exclusive WITHIN their kind (one active
 * partner, one active feeling, one active place); tapping an active one again turns
 * it off, and tapping a different one of the same kind switches. They carry distinct
 * colors (see INFLUENCER_COLORS) so they read apart from each other and from phrases.
 *
 * This module holds only DEFAULTS + metadata; the live list lives in the
 * express-panel.js model (data folder + cache) and is edited in Settings →
 * Express Panel.
 * The space cell of the layout is always "In my own words" (handled by the
 * renderer), independent of this list.
 */

// Functional categories for PHRASE items (Ken: color phrases by category). Color
// is the SECONDARY cue — the phrase text is always shown — so this never
// violates "no meaning by color alone"; it just groups at a glance.
export const CATEGORIES = {
  affirm: { label: 'Affirm / deny', color: '#00796B', tint: '#e0f2f1' }, // teal
  social: { label: 'Social',        color: '#3949AB', tint: '#e8eaf6' }, // indigo
  pace:   { label: 'Pace / turn',   color: '#E65100', tint: '#fff3e0' }, // deep orange
  repair: { label: 'Repair',        color: '#6A1B9A', tint: '#f3e5f5' }, // purple
  need:   { label: 'Needs',         color: '#AD1457', tint: '#fce4ec' }, // magenta
  cont:   { label: 'Continuer',     color: '#546E7A', tint: '#eceff1' }, // blue-grey
  // NOTICE (Ken, August 9 2026) — a phrase spoken ABOUT the device rather than as
  // part of the conversation: "this device listens and speaks for me". It is the
  // partner-awareness disclosure (SEC-7) made one tap instead of a sentence the
  // user has to compose, and it earns its own color because it is a different KIND
  // of utterance from everything else on the panel — the user steps out of the
  // conversation to say it. Amber: the only unused hue among the phrase tints, and
  // the conventional color for "take note".
  notice: { label: 'Notice',        color: '#F9A825', tint: '#fff8e1' }, // amber
};

// Distinct, saturated colors for the three influencer TYPES — different from each
// other and from every phrase category (Ken). Rendered as a solid fill so they
// pop apart from the pastel phrase buttons; the toggled-on state is stronger still.
// Place is olive: the palette had no yellow-green, so it cannot be confused with
// the deep orange (pace) or cyan (feeling) it sits nearest in hue.
export const INFLUENCER_COLORS = {
  partner: { color: '#5D4037', tint: '#efebe9' }, // brown
  feeling: { color: '#00838F', tint: '#e0f7fa' }, // cyan
  place:   { color: '#827717', tint: '#f9fbe7' }, // olive
};

// Choice chips: the alternatives the partner just offered ("mild / moderate /
// severe"), filled into the Express Panel's reserved leading cells and cleared
// when the turn ends. Green, echoing the CHOICE response cards they steer, so the
// two surfaces read as the same idea. Not user-editable — these are transient and
// AI-derived, which is exactly why they live in RESERVED cells rather than
// displacing the user's own phrases.
export const CHOICE_COLOR = { color: '#2E7D32', tint: '#e8f5e9' }; // green

// (A FEELING_PRESETS list lived here and is deliberately gone - Ken, August 25 2026.
// A feeling is typed, never chosen from a list; the reasoning is in the Architecture
// Overview, under the Express Panel. Do not reintroduce it.)

// --- item builders (defaults only) ------------------------------------------
const PH = (text, cat = 'cont', speak) => (speak ? { type: 'phrase', text, cat, speak } : { type: 'phrase', text, cat });
const FE = (text) => ({ type: 'feeling', text });

// --- provenance (Ken, August 7 2026) -----------------------------------------
// Whose words are in a cell. Load-bearing for three separate things, which is why
// one small field earns its place:
//   1. VOICE SIGNAL. The "sounds like me" voice block is seeded from Express
//      phrases, and seeding it from OUR defaults would tell the model this user's
//      characteristic vocabulary is "Yes", "No" and "Thank you". Only user-touched
//      items are evidence of anything.
//   2. CATCHPHRASE REDACTION. A user's own phrases are stripped from harvested
//      writing samples before those reach the model (the model must never produce
//      idiolect — Sounds Like Me 5.1). Redacting against the shipped defaults
//      instead would strip "Yes" and "Thank you" out of every sample.
//   3. PERSONALIZATION DEPTH. "Express items added or edited" is a measure the
//      beta instrumentation decision explicitly asked for, and plausibly a LEADING
//      indicator: a tester who edits their phrases in week 1 is invested before any
//      conversation metric can show it.
// 'added' and 'edited' are kept apart because they cost nothing to distinguish;
// every current consumer only asks the coarser question isUserAuthored().
export const ORIGIN = { DEFAULT: 'default', ADDED: 'added', EDITED: 'edited' };

/** Did the USER put these words here? The question all three consumers actually ask. */
export function isUserAuthored(item) {
  return !!item && item.origin !== ORIGIN.DEFAULT;
}

// --- undefined cells ---------------------------------------------------------

/** An undefined cell: holds a grid position, carries nothing else. */
export function newEmptyItem() {
  // origin DEFAULT deliberately: an empty slot contains no words, so crediting it
  // to the user would inflate "items added or edited" (the personalization-depth
  // measure) with cells that say nothing about them. It becomes theirs when they
  // choose a type for it — that replacement is stamped ADDED in the normal way.
  return { id: makeId(), type: 'empty', origin: ORIGIN.DEFAULT };
}

/** Is this a cell the user has not defined yet? */
export function isEmptyItem(item) {
  return !!item && item.type === 'empty';
}

// The provided STARTING LAYOUT (Ken: "a starting layout should be provided").
//
// HALF-POPULATED BY DESIGN (Ken, August 7 2026). An empty grid means blank holes on
// day one, the feature is never discovered, and the app reads as broken; a full grid
// of our phrases is complete, and so invites nothing. Half is a task framed as begun
// rather than not-yet-started, which is completed more often (Nunes & Dreze 2006,
// the endowed progress effect). The remaining cells render blank — the renderer
// already leaves leftover cells empty — and those blanks are the invitation.
//
// WHAT STAYS is conversational plumbing: immediately useful, and it makes no claim
// about the user, because nobody's identity is in "Yes". WHAT LEFT ("Yes please",
// "Maybe", "That's funny", "See you later", "I agree", "Got it", "One moment", …)
// is the set that LOOKS like voice while being ours — exactly the cells worth
// handing over.
//
// Feelings lead so the influencer concept is visible, then the common phrases.
// Partners start empty — they are personal; the user adds their own people in the
// editor (free-form or picked from People I Know).
// Stable ids ('d0', 'd1', …) so getItems() returns the SAME id every call —
// the toggle state (active partner/feeling) is tracked by id, so an unstable id
// would break the toggled-on highlight.
export const DEFAULT_ITEMS = [
  FE('Happy'), FE('Sad'), FE('Stressed'), FE('Curious'), FE('Tired'), FE('Excited'),
  PH('Yes', 'affirm'), PH('No', 'affirm'),
  PH('Okay', 'cont'),
  PH('Please', 'social'), PH('Thank you', 'social'), PH('Sorry', 'social'),
  PH('Hi', 'social'), PH('Bye', 'social'),
  PH('Wait', 'pace'),
  PH('Help', 'need'),
  // The partner-awareness disclosure, shipped as a default because the Beta Test
  // Plan asks every tester to say it and nobody should have to type it. Last, so
  // adding it moves none of the plumbing cells above.
  PH('This device listens and speaks for me', 'notice'),
].map((it, i) => ({ id: 'd' + i, ...it, origin: ORIGIN.DEFAULT }));


// WHICH SHIPPED ALWAYS SET A PANEL STARTED FROM. Bump it whenever the shipped Always
// phrases change and every existing panel should take the new ones: express-panel.js
// replaces that band once and stamps the number. Do NOT bump it for a change nobody
// needs to receive - it overwrites whatever the user had in that band.
export const SEED_REVISION = 1;

// --- BAND DEFAULTS ------------------------------------------------------------
// THE ALWAYS BAND IS THE SPEECH AND LANGUAGE THERAPISTS' SET (September 2 2026), and
// it REPLACED the project's own placeholder set wholesale rather than merging with it
// (Ken, August 25 2026 - the additive-merge watermark used by the control phrases is
// deliberately not used here; a merged panel would be neither theirs nor ours).
//
// The wording is theirs, with two house conventions applied across the whole set
// (Ken, September 2 2026): NO TRAILING PERIOD on a phrase, and no capital letter
// part-way through one. A panel button is a spoken utterance, not a sentence on a
// page - the period buys nothing when the phrase is said aloud and only makes the
// set look ragged when some have one and some do not. Question marks stay: they are
// part of the words ("Wanna chat?"), not punctuation at the end of a statement.
// The order is theirs too: it is what a user reaches for, most-used first, so the band
// shortens from its bottom when the Context band grows and the phrases that go first
// are the ones they ranked last.
//
// `cat` is not set. A phrase takes its color from the BAND it sits in, so a per-phrase
// category has had no effect since bands shipped (ui.renderExpressPanel voids it).
export const ALWAYS_DEFAULTS = [
  PH('Yes'), PH('No'),
  PH("I don't know"), PH('Maybe'),
  PH('OK'), PH('Excuse me'),
  PH('Hey there'), PH('Come here please'),
  PH('Hi'), PH('Bye'),
  PH('Awesome'), PH('No way'),
  PH('Please'), PH('Thank you'), PH("You're welcome"),
  PH('When?'), PH('Where?'), PH('Why?'), PH('Who?'), PH('What?'),
  PH('Wanna chat?'),
  PH('I need something for my care'),
  PH('Please help me'),
  PH("I'm typing a longer response and need more time"),
  PH('My device is glitching'),
  PH('My device listens and speaks for me'),
].map((it, i) => ({ id: 'a' + i, ...it, origin: ORIGIN.DEFAULT }));

// The Context band's starting contents. FEELINGS ONLY, and a shipped person or place
// would not merely be in poor taste - it would be BROKEN (Ken, August 25 2026).
//
// A partner button names somebody in About Me and carries their identity so the app
// can look up what it knows about them; a place button does the same for My Places.
// A new user has neither, so a defaulted one would point at a record that does not
// exist: the panel would show a name About Me has never heard of, and the picker in
// the editor - which lists only real people - could not represent it, so it would sit
// on "- choose -" while the button beside it showed a name. Out of sync from the first
// launch, with nothing on screen to say why. The softer reason stands too (inventing
// somebody's people is putting words in their mouth), but this is the structural one.
//
// THESE SIX STAY, and the therapists' set does NOT replace them (Ken, August 25 2026).
// They are deliberate placeholders, and that is not a stopgap waiting to be fixed:
// a feeling is one word, there are only a few of them, and a user swaps one for a word
// that actually means something to them in seconds - which is the opposite of the
// Always phrases, where getting the starting set right is real work by people who know
// what they are doing. And a Context band POPULATED FROM THE FIRST LAUNCH is worth
// having in itself: an empty band would read as something missing rather than as an
// invitation. So the only thing the therapists' set replaces is the Always band.
export const CONTEXT_DEFAULTS = [
  FE('Happy'), FE('Sad'), FE('Tired'), FE('Excited'), FE('Curious'), FE('Silly'),
].map((it, i) => ({ id: 'c' + i, ...it, origin: ORIGIN.DEFAULT }));

// Every phrase/feeling we have EVER shipped as a default. Used only to classify a
// legacy item that predates the origin field: without it, the sixteen defaults
// retired above would migrate as user-authored and be credited to the user as
// voice — the precise error provenance exists to prevent.
const SHIPPED_DEFAULT_TEXTS = new Set([
  // Feelings, current and retired
  'Happy', 'Sad', 'Stressed', 'Curious', 'Tired', 'Excited', 'Silly',
  // The therapists' Always set
  'Yes', 'No', "I don't know", 'Maybe', 'OK', 'Excuse me', 'Hey there',
  'Come here please', 'Hi', 'Bye', 'Awesome', 'No way', 'Please', 'Thank you',
  "You're welcome", 'When?', 'Where?', 'Why?', 'Who?', 'What?', 'Wanna chat?',
  'I need something for my care', 'Please help me',
  "I'm typing a longer response and need more time", 'My device is glitching',
  'My device listens and speaks for me',
  // Retired defaults, kept so a legacy file's copy is still recognized as ours
  'Yes please', 'No thank you', 'Maybe', "I don't know", "I'm not sure",
  'I think so', 'Okay', 'Got it', "That's funny", 'I agree', "You're welcome",
  'Sorry', 'See you later', 'Wait', 'One moment', 'Go on', 'Not now',
  'Say that again', 'Help', 'This device listens and speaks for me',
]);

// The user-authored content of an item, for change detection. Excludes id and
// origin; a recolor (cat) counts as a touch, because the user chose it.
function signature(item) {
  if (!item) return '';
  const { id, origin, ...rest } = item;
  return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
}

/**
 * Stamp origin on items that lack it — i.e. a file written before August 7 2026.
 * A phrase/feeling we have ever shipped is assumed to be ours; anything else was
 * put there by the user. Added and edited cannot be told apart retroactively, so
 * legacy user items are recorded as 'edited'.
 *
 * The one misclassification this can make is a user who typed a phrase character-
 * identical to one of our defaults, which is harmless: those are all plumbing words
 * carrying no voice signal either way.
 */
export function ensureOrigin(items) {
  return (items || []).map((it) => {
    if (!it || it.origin) return it;
    // An undefined cell has no words at all, so the text test below would read its
    // empty string as "not one of ours" and credit it to the user.
    if (it.type === 'empty') return { ...it, origin: ORIGIN.DEFAULT };
    const text = it.text || it.name || '';
    const ours = it.type !== 'partner' && it.type !== 'place' && SHIPPED_DEFAULT_TEXTS.has(text);
    return { ...it, origin: ours ? ORIGIN.DEFAULT : ORIGIN.EDITED };
  });
}

/**
 * Re-stamp origin after an edit, by diffing against the list as it was. Done here,
 * by comparison, rather than at each editor call site — the editor has several
 * paths that create or change an item (add, insert-before, recolor, per-row Save,
 * reorder) and any one of them could be missed.
 */
export function markEdits(next, prev) {
  const before = new Map((prev || []).map((it) => [it.id, it]));
  return (next || []).map((it) => {
    if (!it) return it;
    const was = before.get(it.id);
    if (!was) return { ...it, origin: it.origin === ORIGIN.DEFAULT ? ORIGIN.DEFAULT : ORIGIN.ADDED };
    if (signature(it) !== signature(was)) return { ...it, origin: ORIGIN.EDITED };
    return { ...it, origin: was.origin || it.origin };
  });
}

// Assign a stable id to any item missing one (defaults + freshly-added items).
let _n = 0;
export function makeId() {
  return 'fp' + Date.now().toString(36) + (_n++).toString(36);
}
export function ensureIds(items) {
  return (items || []).map((it) => (it && it.id ? it : { ...it, id: makeId() }));
}

// --- where the transient choice buttons sit (Ken, August 22 2026) ------------
/**
 * WHICH CELLS the partner's offered alternatives occupy, in the order they are
 * offered. Returns cell ordinals into the composed panel.
 *
 * ⚠ THEY LAND ON THE CELLS THE CONTEXT BAND RESERVES FOR THEM, AND ONLY THOSE.
 * Until August 26 2026 this was computed as "the last N cells of the WHOLE panel",
 * which is the same thing ONLY while the Flex band is empty — the shipped default,
 * which is why it looked right. Give the Flex band any size and the choice buttons landed on
 * Flex phrases while the Context band went on drawing "Choice button #1" over cells
 * that never received one: the reservation the user could SEE and the cells actually
 * used were two different places (Ken: "this is not allowed").
 *
 * They fill the reserved run from its FAR END, so the last alternative sits in the
 * last reserved cell and a short menu leaves the earlier reserved cells showing
 * whatever they normally show.
 *
 * COVERING A CONTEXT BUTTON IS CORRECT, NOT A FAILURE (Ken, August 26 2026): "the
 * app should cover existing Context panel buttons with option buttons if it needs
 * to. These covered buttons will not be used until the user selects and clears the
 * option buttons." The covered items are not re-homed and not lost — they are simply
 * not drawn for the turn, and come back untouched when it ends.
 *
 * More alternatives than reserved cells is not guarded against here: the app caps how
 * many it offers and the response options carry the full set regardless, so a surplus
 * simply does not render.
 */
export function choiceCells(choiceSlots, choiceCount) {
  const slots = Array.isArray(choiceSlots) ? choiceSlots.filter((n) => Number.isInteger(n) && n >= 0) : [];
  const shown = Math.max(0, Number(choiceCount) || 0);
  if (!shown || !slots.length) return [];
  return slots.slice(Math.max(0, slots.length - shown));
}
