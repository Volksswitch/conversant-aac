/* Express Panel — base-UI quick-speak + influencer panel (June 2026)
 *
 * The panel is now a single USER-EDITABLE, ORDERED list of typed items (Ken,
 * June 26 2026). Each item is one of three types, and the item's position in the
 * list maps 1:1 to a cell of the paired keyboard layout's grid (so one static
 * keyguard overlays both — Rule 9; the editor lets the user reorder = re-map):
 *
 *   - phrase  : { type:'phrase',  text, cat, speak? }   speaks directly on tap
 *                 (single- or confirming double-tap per Rule 10). `cat` colors it.
 *   - partner : { type:'partner', name, nickname?, personId? }   a TOGGLE that
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

// Suggested feelings for the editor's quick-add (the user can type any).
export const FEELING_PRESETS = [
  'Happy', 'Sad', 'Angry', 'Stressed', 'Curious', 'Bored',
  'Excited', 'Tired', 'Anxious', 'Calm', 'Frustrated', 'Grateful',
];

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

// Every phrase/feeling we have EVER shipped as a default. Used only to classify a
// legacy item that predates the origin field: without it, the sixteen defaults
// retired above would migrate as user-authored and be credited to the user as
// voice — the precise error provenance exists to prevent.
const SHIPPED_DEFAULT_TEXTS = new Set([
  'Happy', 'Sad', 'Stressed', 'Curious', 'Tired', 'Excited',
  'Yes', 'No', 'Yes please', 'No thank you', 'Maybe', "I don't know", "I'm not sure",
  'I think so', 'Okay', 'Got it', "That's funny", 'I agree', 'Please', 'Thank you',
  "You're welcome", 'Sorry', 'Excuse me', 'Hi', 'Bye', 'See you later', 'Wait',
  'One moment', 'Go on', 'Not now', 'Say that again', 'Help',
  'This device listens and speaks for me',
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

// --- where the transient choice chips sit (Ken, August 22 2026) ---------------
/**
 * The cell ordinal at which the partner's offered alternatives begin.
 *
 * They take the LAST cells of the panel, not the first. Claiming the leading cells
 * — which is what shipped until August 22 2026 — pushed every phrase along by the
 * number of alternatives on offer, so for the duration of one turn every button sat
 * a cell or three from where the user had learned it and the same number dropped off
 * the end. Claiming the last cells moves nothing: each phrase keeps its position, and
 * at most the final few are covered until the turn ends.
 *
 * More alternatives than cells is not a failure worth guarding against here — the
 * app caps how many chips it offers, and the response cards carry the full set
 * regardless — so the surplus simply does not render.
 */
export function chipStartIndex(itemCells, chipCount) {
  const cells = Math.max(0, Number(itemCells) || 0);
  const chips = Math.max(0, Number(chipCount) || 0);
  return Math.max(0, cells - chips);
}
