/* Voice — how this user SOUNDS, as distinct from what they can truthfully say
 * (Sounds Like Me, Phase 0 + Phase 1; Ken, August 7 2026)
 *
 * The fifth user-owned file, following the same shape as worldview / relationships /
 * express-panel / places:
 *   - <data folder>/voice.json        portable source of truth (FSA/OPFS)
 *   - localStorage 'aac_voice'        same-machine write-through cache
 * Reconciliation is the v0.2.25 rule: a file in the connected folder wins; the cache
 * is promoted to a new file only when none exists on disk yet.
 *
 * WHY THIS EXISTS. The generation prompt has told the model "You speak AS the user,
 * in their voice" since v0.3.0 with nothing behind it. Given no stylistic information
 * a model does not produce neutral English — it produces its OWN register, which is
 * verbose, formal, explicit and assistant-shaped. So the app was not neutral on the
 * question of who this person is; it was answering it wrongly, the same way, on every
 * card of every palette.
 *
 * WHAT GOES IN THE BLOCK: EXEMPLARS, NOT ADJECTIVES. Few-shot examples steer style
 * far better than descriptions do — measured at up to 23.5x the style-matching
 * accuracy of no examples, with the prompting strategy mattering more than the size
 * of the model (Jemama & Naous 2025). Descriptions are additionally the worst thing
 * to ask this user for, because people cannot accurately describe their own style:
 * the features that most mark an individual are produced below conscious awareness
 * (Tausczik & Pennebaker 2010), and style is highly observable and highly evaluative,
 * the quadrant where the self is least accurate (Vazire 2010). So the user is never
 * asked to characterize themselves; they are asked which of several replies they
 * would rather say, and the sentences they pick ARE the examples.
 */

import { readFile, readPortableFile, writeFile, hasDataFolder } from './storage.js';
// For the item's dimension only, so buildBlock can tell a bland exemplar (safe to
// reuse verbatim) from a levity one (never reuse). sound-check-items.js imports
// nothing, so there is no cycle.
import { getItem, isLighterChoice, SOUND_CHECK_ITEMS, RENAMED_CANDIDATES, soundCheckLengthLean } from './sound-check-items.js';
import { redactCatchphrases, MIN_EXEMPLAR_WORDS, MAX_EXEMPLARS } from './voice-harvest.js';

const FILE = 'voice.json';
const CACHE_KEY = 'aac_voice';

let profile = null;

function emptyProfile() {
    return {
        version: 1,
        updated: new Date().toISOString(),
        // Sound Check: itemId -> { verdict, choice }. `choice` is the exemplar the
        // user endorsed; null when they answered with one of the two escapes.
        soundCheck: {},
        // "What you never say" — negative constraints. Cheap for a user to state,
        // easy for a model to obey, and unusually high-value: getting this wrong is
        // conspicuous in a way that getting warmth slightly wrong is not.
        never: [],
        // Optional authored samples (Phase 1, deliberately NOT load-bearing — a
        // sample depends on the slowest feature in the app and is shortened by the
        // effort of producing it).
        samples: {},
        // Phase 2: what reading the user's own past conversations concluded.
        // { exemplars: [], lengthLean: {...}|null, counts: {}, at: ISO }
        harvest: null,
        // Harvested sentences the user has explicitly removed. Kept so a later
        // re-harvest does not put them straight back — "I can see and correct what
        // it concluded" is worthless if the correction does not stick.
        dismissed: [],
        // Every Reframe steer the user has typed: [{ text, at }].
        //
        // A steer is the user telling the app its suggestion was not right and how —
        // "keep it short", "lean toward saying no". It lives HERE rather than in the
        // conversation log because it is never spoken and never appears in the
        // conversation pane, so recording it there would muddy the standing rule that
        // the transcript mirrors the pane. Errors are in the log as a deliberate
        // diagnostic exception; a steer is not a diagnostic.
        // Since October 6 2026 each also carries the person it was typed to:
        // { text, at, personId, label }.
        steers: [],
        // Instructions the user chose to KEEP, from About Me: [{ text, personId, label,
        // at }]. personId null means "for everyone"; otherwise it is sent only while
        // that person's partner button is on.
        kept: [],
        // Offers the user turned down in About Me's "Instructions you typed recently"
        // list, as `${personId}|${normalized text}`. Kept apart from `dismissed` on
        // purpose: turning down an offer to keep one wording must not stop that request
        // from ever becoming standing if the user keeps asking for it.
        hidden: [],
    };
}

// A stored Sound Check answer keeps the candidate's TEXT. When a candidate was
// reworded (CR-191) the old text would no longer match any card and would still be
// sent to the AI as the user's wording, so it is mapped onto the new text here.
function migrateChoices(sc) {
    if (!sc || typeof sc !== 'object') return {};
    const out = {};
    for (const [id, a] of Object.entries(sc)) {
        out[id] = (a && typeof a === 'object' && Object.prototype.hasOwnProperty.call(RENAMED_CANDIDATES, a.choice))
            ? { ...a, choice: RENAMED_CANDIDATES[a.choice] }
            : a;
    }
    return out;
}

function normalize(raw) {
    const base = emptyProfile();
    if (!raw || typeof raw !== 'object') return base;
    return {
        ...base,
        ...raw,
        soundCheck: migrateChoices(raw.soundCheck),
        never: Array.isArray(raw.never) ? raw.never.filter((s) => typeof s === 'string' && s.trim()) : [],
        samples: (raw.samples && typeof raw.samples === 'object') ? raw.samples : {},
        harvest: (raw.harvest && typeof raw.harvest === 'object') ? raw.harvest : null,
        dismissed: Array.isArray(raw.dismissed) ? raw.dismissed.filter((x) => typeof x === 'string') : [],
        steers: Array.isArray(raw.steers) ? raw.steers.filter((x) => x && typeof x.text === 'string') : [],
        kept: Array.isArray(raw.kept) ? raw.kept.filter((x) => x && typeof x.text === 'string' && x.text.trim()) : [],
        hidden: Array.isArray(raw.hidden) ? raw.hidden.filter((x) => typeof x === 'string') : [],
    };
}

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}
function writeCache(p) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch { /* quota — disk is truth */ }
}
function writeDisk(p) {
    writeFile(FILE, JSON.stringify(p, null, 2)).catch(() => { /* best-effort */ });
}

/** Load: data folder (source of truth) → cache → empty. */
export async function load() {
    let loaded = null;
    const raw = await readFile(FILE);
    if (raw) { try { loaded = JSON.parse(raw); } catch { loaded = null; } }
    if (!loaded) loaded = readCache();
    profile = normalize(loaded);
    writeCache(profile);
    return profile;
}

function current() {
    if (!profile) profile = normalize(readCache());
    return profile;
}

function save() {
    profile.updated = new Date().toISOString();
    writeCache(profile);
    writeDisk(profile);
    return profile;
}

/**
 * Record one Sound Check answer. `choice` is the exemplar text the user endorsed, or
 * null for the two escapes — "They're all fine" (a weak or absent preference,
 * recorded as what it is rather than as a spurious first-place vote) and "I wouldn't
 * say any of these" (the genuinely different state, and at least as informative,
 * because it is a negative constraint arriving unprompted).
 */
export function recordAnswer(itemId, verdict, choice = null) {
    const p = current();
    p.soundCheck[itemId] = { verdict, choice: choice || null, at: new Date().toISOString() };
    return save();
}

export function getAnswer(itemId) {
    return current().soundCheck[itemId] || null;
}

export function clearAnswer(itemId) {
    const p = current();
    delete p.soundCheck[itemId];
    return save();
}

/** How many Sound Check items have been answered — drives the module's progress. */
export function answeredCount() {
    return Object.keys(current().soundCheck).length;
}

export function getNever() { return current().never.slice(); }
export function setNever(list) {
    const p = current();
    p.never = (Array.isArray(list) ? list : []).map((s) => String(s).trim()).filter(Boolean);
    return save();
}

export function getSample(key) { return current().samples[key] || ''; }
export function setSample(key, text) {
    const p = current();
    const t = String(text || '').trim();
    if (t) p.samples[key] = t; else delete p.samples[key];
    return save();
}

// A steer typed once is a one-off about that particular turn; asked for again it is a
// standing preference the app keeps failing to meet. Two is the bar because asking
// twice is deliberate, and because the user can see the count and remove it — a
// wrongly promoted preference shapes every future response, so it is shown with its
// evidence rather than asserted.
const STEER_REPEAT_MIN = 2;
const MAX_STEERS = 200;
const MAX_RECENT = 8;

function normalizeSteer(text) {
    return String(text || '').toLowerCase().replace(/[’‘]/g, "'")
        .replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/*
 * WHAT A STEER ASKS FOR, so two wordings of one request count as one (October 6 2026).
 * Grouping by exact wording meant "shorter" and "keep it to five words" were two
 * different requests, and a terse user could ask for brevity in a dozen ways without
 * the app ever keeping it.
 *
 * ⚠ A WRONG READING IS WORSE THAN NONE, so this is deliberately cautious. A recognized
 * request becomes a standing instruction in every later response, so a request read
 * as its opposite ("too informal" read as "casual") or a content steer read as a style
 * rule ("say it would be nice to see her" read as "warmer") does lasting harm, while a
 * missed one only falls back to the exact-wording rule this replaced. So a steer counts
 * as a style request only when:
 *   - every style word in it is either read in a known negated form (NEGATED) or has
 *     no negating word in front of it - otherwise it is not read at all; and
 *   - once its style words and filler are taken out, at most one other word is left.
 *     "Shorter, and say I'm tired" is about content and keeps its exact wording.
 * A recognized request reaches the AI in the app's own words (MEANINGS), never the
 * user's.
 */
const NEGATED = [
    [/\b(?:less|not so|not as|too|not|don't be|do not be|stop being(?: so)?) (?:formal|stiff|proper|professional)\b/g, 'casual'],
    [/\b(?:less|not so|not as|too|not|don't be|do not be|stop being(?: so)?) (?:casual|informal|relaxed|chill|slangy|sloppy)\b/g, 'formal'],
    [/\b(?:less|not so|not as|too|don't be|do not be|stop being(?: so)?) (?:polite|nice|soft|gentle|careful)\b/g, 'blunter'],
    [/\b(?:less|not so|not as|too|don't be|do not be|stop being(?: so)?) (?:blunt|harsh|rude|cold|abrupt|direct)\b/g, 'warmer'],
    [/\b(?:less|not so|not as|too) (?:wordy|long)\b/g, 'shorter'],
    [/\b(?:less|not so|not as|too) (?:short|brief|curt|terse|concise)\b/g, 'longer'],
    [/\b(?:less|not so|not as|too|don't be|do not be|stop being(?: so)?) (?:serious|stiff)\b/g, 'funnier'],
    [/\b(?:less|not so|not as|too|don't be|do not be|stop being(?: so)?) (?:funny|jokey|silly)\b|\bno jokes?\b|\b(?:don't|do not|stop|no) (?:make |making |crack |cracking )?(?:a )?jok(?:e|es|ing)\b/g, 'serious'],
];
const POSITIVE = [
    [/\b(?:shorter|keep it short|short and sweet|short (?:reply|replies|answer|answers|response|responses)|brief|briefer|briefly|concise|terse|fewer words|few words|cut it down)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)[ -]words?\b/g, 'shorter'],
    [/\b(?:longer (?:reply|replies|answer|answers|response|responses|sentences)|make it longer|more detail|more detailed|more words|fuller)\b/g, 'longer'],
    [/\b(?:casual|casually|informal|laid back|talk like (?:a |an )?(?:kid|teen|teenager|young person|\d+ year old))\b/g, 'casual'],
    [/\b(?:more formal|be formal|sound formal|formally|more professional|more respectful)\b/g, 'formal'],
    [/\b(?:warmer|more warmth|friendlier|be friendly|nicer|kinder|softer|gentler)\b/g, 'warmer'],
    [/\b(?:blunter|be blunt|more blunt|more direct|be direct|firmer|be firm)\b/g, 'blunter'],
    [/\b(?:funnier|be funny|more playful|be playful|more humor|lighten it up|more sarcastic)\b/g, 'funnier'],
    [/\b(?:be serious|more serious|keep it serious)\b/g, 'serious'],
];
// A word in front of a style word that turns it around ("don't be blunt").
// Up to three words may sit between ("no need to be blunter").
const NEGATOR = /\b(?:don't|do not|doesn't|not|no|never|stop|stop being|without|avoid|less|too)(?: [\w']+){0,3}\s*$/;
// Words that carry no request of their own, so a steer made only of these and style
// words is a pure style request.
const FILLER = new Set(('please a an the it it\'s its them they be more much bit little lot way really very so just '
    + 'and or but also keep make sound talk use with me my i you your reply replies response responses answer '
    + 'answers option options wording words word sentence sentences tone this that try again still even can could '
    + 'would should maybe to for of like than less too').split(' '));
const MEANINGS = {
    shorter: { text: 'Keep responses short.', opposite: 'longer' },
    longer: { text: 'Give fuller responses; do not clip them down to the minimum.', opposite: 'shorter' },
    casual: { text: 'Keep the wording casual and relaxed.', opposite: 'formal' },
    formal: { text: 'Keep the wording more formal.', opposite: 'casual' },
    warmer: { text: 'Make the wording warmer.', opposite: 'blunter' },
    blunter: { text: 'Make the wording more direct and less cushioned.', opposite: 'warmer' },
    funnier: { text: 'A lighter, more playful wording is welcome wherever the rest of these instructions allow it.', opposite: 'serious' },
    serious: { text: 'Keep the wording serious, with no joking.', opposite: 'funnier' },
};

/** The style requests a steer makes, as MEANINGS keys. Empty for anything else. */
export function steerMeanings(text) {
    let t = ` ${normalizeSteer(text).replace(/\b(?:kind|sort) of\b/g, ' ')} `;
    const found = new Set();
    for (const [re, key] of NEGATED) {
        re.lastIndex = 0;
        if (re.test(t)) { found.add(key); re.lastIndex = 0; t = t.replace(re, ' '); }
        re.lastIndex = 0;
    }
    for (const [re, key] of POSITIVE) {
        re.lastIndex = 0;
        let m;
        let hit = false;
        while ((m = re.exec(t))) {
            if (NEGATOR.test(t.slice(0, m.index))) return [];   // turned around - do not guess
            hit = true;
        }
        re.lastIndex = 0;
        if (hit) { found.add(key); t = t.replace(re, ' '); }
        re.lastIndex = 0;
    }
    if (!found.size) return [];
    const left = t.split(' ').filter((w) => w && !FILLER.has(w));
    return left.length <= 1 ? [...found] : [];
}

/** Record one typed Reframe steer, with who the user was talking to when they typed
 *  it. Callers gate on storage.isConversationSaving() and skip practice. */
export function recordSteer(text, { personId = null, label = null } = {}) {
    const t = String(text || '').trim();
    if (!t) return current();
    const p = current();
    p.steers.push({ text: t, at: new Date().toISOString(), personId: personId || null, label: label || null });
    if (p.steers.length > MAX_STEERS) p.steers = p.steers.slice(-MAX_STEERS);
    return save();
}

// Every steer the app knows about: typed live, and typed in review (rebuilt from the
// review files by the harvest).
function allSteers(p) {
    const fromReview = (p.harvest && Array.isArray(p.harvest.steers)) ? p.harvest.steers : [];
    return p.steers.concat(fromReview.filter((x) => x && typeof x.text === 'string'));
}

function goneSet(p) {
    return new Set(p.dismissed.map(normalizeSteer));
}

/*
 * Every request asked for at least `min` times, before removals and before the
 * opposite-request rule. A group belongs to ONE PERSON when every time it was asked
 * was with that person, and to everyone otherwise: a request typed only to Mom is
 * about talking with Mom, and sending it with every partner is how a correction for
 * one person becomes the user's voice for all of them.
 */
function steerGroups(p, min) {
    const groups = new Map();
    const add = (key, meaning, s) => {
        if (!groups.has(key)) groups.set(key, { key, meaning, text: s.text, texts: [], count: 0, last: '', people: new Map() });
        const g = groups.get(key);
        g.count++;
        if (!g.texts.includes(s.text)) g.texts.push(s.text);
        if ((s.at || '') >= g.last) { g.last = s.at || ''; g.text = s.text; }
        g.people.set(s.personId || null, s.label || null);
    };
    for (const s of allSteers(p)) {
        const norm = normalizeSteer(s.text);
        if (!norm) continue;
        const meanings = steerMeanings(s.text);
        if (meanings.length) for (const m of meanings) add(`meaning:${m}`, m, s);
        else add(norm, null, s);
    }
    return [...groups.values()].filter((g) => g.count >= min).map((g) => {
        const only = g.people.size === 1 ? [...g.people.entries()][0] : null;
        const personId = only && only[0] ? only[0] : null;
        return { key: g.key, meaning: g.meaning, text: g.text, texts: g.texts, count: g.count,
            last: g.last, personId, label: personId ? only[1] : null };
    });
}

function isGone(g, gone) {
    return gone.has(normalizeSteer(g.key)) || g.texts.some((t) => gone.has(normalizeSteer(t)));
}

/**
 * Requests the user has made more than once, most-repeated first. A style request
 * counts however it was worded; anything else counts only when typed word for word.
 * Each group: { key, text, texts, count, meaning, personId, label } - `text` is the
 * newest wording, `texts` every wording, `meaning` the MEANINGS key or null, and
 * `personId` set when every time it was asked was with one person.
 */
export function repeatedSteers(min = STEER_REPEAT_MIN) {
    const p = current();
    // Removing a request takes its key or any of its wordings (CR-163): a removed
    // correction came back once its first wording aged out of the list and a later
    // variant ("keep it short!") became the one shown.
    const gone = goneSet(p);
    let out = steerGroups(p, min).filter((g) => !isGone(g, gone));
    // Two opposite requests (shorter and longer) cannot both stand for the same people;
    // the newer wins.
    out = out.filter((g) => {
        if (!g.meaning) return true;
        const opp = out.find((o) => o.meaning === MEANINGS[g.meaning].opposite && o.personId === g.personId);
        return !opp || g.last >= opp.last;
    });
    return out.map(({ key, text, texts, count, meaning, personId, label }) => ({ key, text, texts, count, meaning, personId, label }))
        .sort((a, b) => b.count - a.count);
}

/** Stop using a repeated request. Takes a group's key or any of its wordings. */
export function dismissSteer(keyOrText) {
    const p = current();
    const t = String(keyOrText || '').trim();
    if (t && !p.dismissed.includes(t)) p.dismissed.push(t);
    return save();
}

function keptKey(text, personId) {
    return `${personId || ''}|${normalizeSteer(text)}`;
}

/**
 * Keep a typed instruction for good (About Me, one tap). `personId` null keeps it for
 * everyone; otherwise it reaches the AI only while that person's partner button is on.
 * There is no limit: each one is a deliberate choice, and quietly dropping the oldest
 * to make room would undo one the user made.
 */
export function keepSteer(text, { personId = null, label = null } = {}) {
    const t = String(text || '').trim();
    if (!t) return current();
    const p = current();
    if (!p.kept.some((k) => keptKey(k.text, k.personId) === keptKey(t, personId))) {
        p.kept.push({ text: t, personId: personId || null, label: label || null, at: new Date().toISOString() });
    }
    return save();
}

/** Stop using a kept instruction. It is not offered for keeping again afterwards. */
export function unkeepSteer(text, personId = null) {
    const p = current();
    const key = keptKey(text, personId);
    p.kept = p.kept.filter((k) => keptKey(k.text, k.personId) !== key);
    if (!p.hidden.includes(key)) p.hidden.push(key);
    return save();
}

/** Turn down the offer to keep one typed instruction (About Me's recent list). */
export function hideSteer(text, personId = null) {
    const p = current();
    const key = keptKey(text, personId);
    if (!p.hidden.includes(key)) p.hidden.push(key);
    return save();
}

/** Every kept instruction. */
export function keptSteers() { return current().kept.slice(); }

/** Kept instructions for one person (personId), or for everyone (null). */
export function keptFor(personId = null) {
    return current().kept.filter((k) => (k.personId || null) === (personId || null));
}

/**
 * Everything that stands for one person and no one else: what the user chose to keep
 * for them, and what they have asked for repeatedly only with them. As lines ready for
 * the prompt's situation block, which is the part sent only while that person's
 * partner button is on (the voice block is shared by every partner).
 */
export function instructionsFor(personId) {
    if (!personId) return [];
    const kept = keptFor(personId).map((k) => `"${k.text}"`);
    const repeated = repeatedSteers().filter((g) => g.personId === personId)
        .map((g) => (g.meaning ? MEANINGS[g.meaning].text : `"${g.text}"`));
    return kept.concat(repeated);
}

/**
 * The instructions typed recently, live and in review, that About Me offers to keep:
 * not kept, not turned down, and not part of any request asked for repeatedly
 * (standing, removed, or overridden by its opposite - keeping one of those would only
 * be a second way to say the same thing, or would contradict it). Newest first, one
 * per wording and person.
 */
export function recentSteers(limit = MAX_RECENT) {
    const p = current();
    const gone = goneSet(p);
    const hidden = new Set(p.hidden);
    const kept = new Set(p.kept.map((k) => keptKey(k.text, k.personId)));
    const keptAnywhere = new Set(p.kept.filter((k) => !k.personId).map((k) => normalizeSteer(k.text)));
    const repeated = new Set(steerGroups(p, STEER_REPEAT_MIN).flatMap((g) => g.texts.map(normalizeSteer)));
    const seen = new Set();
    const out = [];
    const sorted = allSteers(p).slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    for (const s of sorted) {
        const norm = normalizeSteer(s.text);
        const key = keptKey(s.text, s.personId);
        if (!norm || gone.has(norm) || hidden.has(key) || kept.has(key) || keptAnywhere.has(norm)
            || repeated.has(norm) || seen.has(key)) continue;
        seen.add(key);
        out.push({ text: s.text, at: s.at || null, personId: s.personId || null, label: s.label || null });
        if (out.length >= limit) break;
    }
    return out;
}

/** Store what the harvest concluded (voice-harvest.js does the reading). */
export function setHarvest(result) {
    const p = current();
    p.harvest = result ? { ...result, at: new Date().toISOString() } : null;
    return save();
}

export function getHarvest() { return current().harvest; }

/**
 * The harvested sentences that are actually in play — everything found, minus what
 * the user has removed. "Here is what I think you sound like" cannot be a black box,
 * least of all for people who have spent their lives having others speak for them.
 *
 * The harvest keeps more than the prompt shows, so removing one lets the next take its
 * place. `exemplarsShown` is the part the AI is given.
 */
export function activeExemplars() {
    const p = current();
    const found = (p.harvest && Array.isArray(p.harvest.exemplars)) ? p.harvest.exemplars : [];
    const gone = new Set(p.dismissed.map((s) => s.trim().toLowerCase()));
    return found.filter((t) => !gone.has(String(t).trim().toLowerCase()));
}

export function exemplarsShown(idiom = []) {
    return exemplarsSent(idiom).map((e) => e.sent);
}

/** The user's own short replies (one to three words), minus what they have removed. */
export function activeShortReplies() {
    const p = current();
    const found = (p.harvest && Array.isArray(p.harvest.shortReplies)) ? p.harvest.shortReplies : [];
    const gone = new Set(p.dismissed.map((s) => s.trim().toLowerCase()));
    return found.filter((t) => !gone.has(String(t).trim().toLowerCase()));
}

/*
 * EXACTLY what the AI is given, so About Me can show the same thing (October 6 2026).
 * Catchphrases are taken out and a sentence left too short is dropped BEFORE the
 * twelve are chosen, so About Me listing the first twelve found would show one the AI
 * never got and hide one it did - and a sentence that cannot be seen cannot be
 * removed. Each entry is { text, sent }: `text` is what was found (and what removing it
 * records), `sent` is the wording the AI gets. `idiom` is the user's own Express
 * phrases, the same list buildBlock takes.
 */
export function exemplarsSent(idiom = []) {
    return activeExemplars()
        .map((text) => ({ text, sent: redactCatchphrases(text, idiom) }))
        .filter((e) => e.sent.split(/\s+/).filter(Boolean).length >= MIN_EXEMPLAR_WORDS)
        .slice(0, MAX_EXEMPLARS);
}

export function shortRepliesSent(idiom = []) {
    return activeShortReplies()
        .map((text) => ({ text, sent: redactCatchphrases(text, idiom) }))
        .filter((e) => e.sent.trim())
        .slice(0, 8);
}

// Older builds stored a length reading taken against the whole set offered, which
// mostly measured which KIND of reply was picked. It is not used until the
// conversations are read again (October 6 2026).
const HARVEST_VERSION = 2;

/*
 * The one length instruction the AI is given, and where it came from - so About Me
 * says what is actually sent. Live picks are compared within each kind of reply
 * (voice-harvest); How I Sound's brevity questions hold the content constant and are
 * the cleaner evidence, so when the two point opposite ways only How I Sound is used.
 * Returns { source: 'live'|'soundcheck', lean, shorter, longer } or null.
 */
export function lengthInstruction() {
    const p = current();
    const h = p.harvest;
    const live = h && h.version >= HARVEST_VERSION ? h.lengthLean : null;
    const liveDir = live && (live.lean === 'shorter' || live.lean === 'longer') ? live.lean : null;
    const sc = soundCheckLengthLean(p.soundCheck);
    const scDir = sc && (sc.lean === 'shorter' || sc.lean === 'longer') ? sc.lean : null;
    if (liveDir && (!scDir || scDir === liveDir)) return { source: 'live', lean: liveDir, shorter: live.shorter, longer: live.longer };
    if (scDir) return { source: 'soundcheck', lean: scDir, shorter: sc.shorter, longer: sc.longer };
    return null;
}

/** Remove a harvested sentence, permanently — a re-harvest must not resurrect it. */
export function dismissExemplar(text) {
    const p = current();
    const t = String(text || '').trim();
    if (t && !p.dismissed.includes(t)) p.dismissed.push(t);
    return save();
}

export async function resetAll() {
    profile = emptyProfile();
    writeCache(profile);
    await writeFile(FILE, JSON.stringify(profile, null, 2)).catch(() => {});
    return profile;
}

/** Reconcile once a data folder becomes available — v0.2.25 file-in-folder-wins. */
export async function syncToFolder() {
    if (!hasDataFolder()) return 'noop';
    const got = await readPortableFile(FILE);
    if (got.state === 'unreadable') return 'noop';   // never overwrite what could not be read (CR-097)
    const disk = got.data;
    if (disk) {
        profile = normalize(disk);
        writeCache(profile);
        return 'adopted';
    }
    profile = current();
    await writeFile(FILE, JSON.stringify(profile, null, 2));
    return 'wrote';
}

/**
 * The voice block for the system prompt.
 *
 * `idiom` is the user's OWN Express Panel phrases (provenance-filtered — see
 * express-items.js). Two cautions are wired into the wording itself rather than left
 * to whoever calls this:
 *
 *   1. Express phrases are evidence of VOCABULARY and IDIOM, never of LENGTH. Button
 *      labels are short by construction, so a model shown a list of them will
 *      conclude the user is terse — a bias that came from the widget, not the person.
 *      The block says so explicitly.
 *   2. The model must never PRODUCE the user's catchphrases (Sounds Like Me 4.1).
 *      Given a list of them, models over-apply: they sprinkle the marker where a real
 *      speaker would not, and idiolect used slightly wrong reads as impersonation,
 *      which is worse than idiolect absent. Those phrases live as Express Panel
 *      buttons the user taps deliberately; the model is told to recognize the
 *      register, not to reproduce the phrases.
 *
 * Returns '' when there is nothing to say, so the prompt gains no empty heading.
 */
export function buildBlock(idiom = []) {
    const p = current();
    const lines = [];

    /*
     * The bank's items split into two kinds and they need OPPOSITE instructions —
     * a distinction that did not exist until the levity items were added on
     * August 8 2026, and that a live check made unavoidable.
     *
     * Most items are deliberately bland ("Good, thanks.", "That's fine, no rush."),
     * and the model reusing one verbatim is not a defect: the user picked it because
     * it is what they would say, and nobody notices someone saying "Good, thanks."
     * twice. A LEVITY item is the opposite — its whole value is that it is
     * distinctive, and a distinctive line reused becomes a verbal tic. The same
     * brush-off on every unanswerable question is the placeholder-predictability
     * failure ("predictable fillers become a joke to partners over time") arriving
     * through the voice layer.
     *
     * So they are listed separately and told apart, rather than one blanket plea not
     * to copy anything — which the model followed about two times in three.
     */
    const answered = Object.entries(p.soundCheck)
        .filter(([, a]) => a && a.choice);
    // A FLAT answer to a levity item is a plain exemplar, not permission to joke: it
    // goes with the others and never into the lighter list (CR-052).
    const lighter = ([id, a]) => isLighterChoice(getItem(id), a.choice);
    // In BANK order, not answer order: answer order put the initiating items after
    // the twelve responsive ones, past a cap of 12, so they never reached the prompt
    // (CR-053). Bank order is also stable between turns, which the cached prefix needs.
    const bankOrder = new Map(SOUND_CHECK_ITEMS.map((it, i) => [it.id, i]));
    answered.sort(([a], [b]) => (bankOrder.get(a) ?? 1e9) - (bankOrder.get(b) ?? 1e9));
    const chosen = answered
        .filter((e) => !lighter(e))
        .map(([, a]) => a.choice);
    const chosenLevity = answered
        .filter((e) => lighter(e))
        .map(([, a]) => a.choice);
    const maxChosen = SOUND_CHECK_ITEMS.length;   // the whole bank fits (CR-053)

    if (chosen.length) {
        lines.push('Examples of how this user prefers to reply. They were shown several ways of saying the same thing and picked these:');
        for (const t of chosen.slice(0, maxChosen)) lines.push(`  "${t}"`);
        // Two parts of this block used to call themselves the most important guide,
        // with nothing to say which won (October 6 2026). The user's own sentences win:
        // these were picked from lines we wrote, those are lines the user wrote.
        lines.push("Match the length, directness, and level of formality of those examples. They are a strong guide to wording. Where this user's own sentences appear further down, those come first.");
        // The exemplars are STYLE, not autobiography. They were picked off a fixed
        // list of hypothetical replies, so anything they appear to mention is a
        // property of the question bank, not of this user — and the anti-fabrication
        // rule is the project's oldest guardrail. The item bank is authored to keep
        // specifics out for the same reason (see sound-check-items.js), but a prompt
        // must not depend on content it does not control.
        lines.push('Treat those examples as evidence of WORDING ONLY. They were chosen from a fixed list of made-up replies, so nothing they mention is a fact about this user and none of it may appear in a response.');
        // Found August 8 2026, the first time the bank carried a DISTINCTIVE example
        // (the levity items): the model returned the chosen sentence back verbatim as
        // a response. It went unnoticed while every example was bland — "Good,
        // thanks." reused is invisible — but a memorable line reused is not, and it
        // would come out on every similar turn, which is the placeholder-predictability
        // failure ("the same joke twice is not a joke") arriving through the voice
        // layer. The rule above forbids reusing their CONTENT; this forbids reusing
        // the SENTENCE, which is a different thing and was never stated.
    }

    if (chosenLevity.length) {
        lines.push('');
        lines.push('Offered a flat reply and a lighter one for an awkward moment — not knowing something, a small mishap, being kept waiting — this user picked the lighter one. This is how they take the edge off:');
        for (const t of chosenLevity.slice(0, 6)) lines.push(`  "${t}"`);
        lines.push('These show you their KEY, not their script. NEVER reply with one of them, or a lightly reworded copy — write a fresh line in the same spirit each time. A memorable phrase reused is a verbal tic, and it stops sounding like a person by about the third outing. Choosing the lighter option here IS this user telling you a lighter reply suits them, so one light response is welcome — UNLESS this profile says elsewhere that they do not want joking suggestions, which overrides this outright and leaves you taking only the length and directness from these.');
    }

    const samples = Object.entries(p.samples).filter(([, v]) => v && v.trim());
    if (samples.length) {
        lines.push('');
        lines.push('Things this user has written, in their own words:');
        for (const [key, text] of samples) lines.push(`  (${key}) ${text}`);
    }

    // PHASE 2 — sentences the user actually composed in past conversations. These
    // are the strongest exemplars there are, and they take the OPPOSITE instruction
    // to the Sound Check ones above. Those were picked off a list WE made up, so
    // nothing in them is a fact. These are the user's real words about real things,
    // so calling them fabrications would be false. But they are PAST utterances, and
    // treating a month-old sentence as currently true is the anti-fabrication failure
    // from the other direction — hence "not current facts" rather than "not facts".
    // Catchphrases are taken out first: they are the user's to say, on a button, and
    // an exemplar sent under "follow their phrasing" would teach the model to say them
    // unprompted (CR-070). Against the FULL idiom list, not the 20 shown below.
    const harvested = exemplarsSent(idiom).map((e) => e.sent);
    if (harvested.length) {
        lines.push('');
        // Not "in real conversations": some were written in review, looking back, and
        // practice conversations are no longer read at all (October 6 2026).
        lines.push(chosen.length
            ? 'Sentences this user has written themselves, during their conversations or when looking back over one. This is the best evidence you have of how they put things, and where it differs from the picked examples above, follow it:'
            : 'Sentences this user has written themselves, during their conversations or when looking back over one. This is the best evidence you have of how they put things:');
        for (const t of harvested) lines.push(`  "${t}"`);
        // The plan's own caution, which never reached the prompt: typed text is
        // shortened by the effort of typing (Sounds Like Me, Table 5).
        lines.push('Follow their phrasing, rhythm and level of detail. They typed these by hand, which is slow for them, so their length may partly reflect that effort. They are things this person said in the PAST, not current facts — do not assume any of it is still true, and do not repeat their content.');
    }

    // Replies too short to show phrasing, kept rather than dropped (October 6 2026).
    const short = shortRepliesSent(idiom).map((e) => e.sent);
    if (short.length) {
        lines.push('');
        lines.push(`Short replies this user has typed themselves: ${short.map((t) => `"${t}"`).join(', ')}.`);
        lines.push('These show how briefly they answer when a few words will do. Do not copy them; let them set how short a reply can be.');
    }

    // Length: one instruction, from whichever source lengthInstruction() trusts.
    const len = lengthInstruction();
    if (len) {
        const decided = len.shorter + len.longer;
        const n = len.lean === 'shorter' ? len.shorter : len.longer;
        lines.push('');
        if (len.source === 'live') {
            lines.push(len.lean === 'shorter'
                ? `Offered a choice in their conversations, this user picks wordings shorter than is typical for that kind of reply far more often than longer ones (${n} of ${decided} decided). Keep responses brief unless there is a clear reason not to.`
                : `Offered a choice in their conversations, this user picks wordings fuller than is typical for that kind of reply far more often than shorter ones (${n} of ${decided} decided). Do not clip responses down to the minimum.`);
        } else {
            lines.push(len.lean === 'shorter'
                ? `Shown several ways of saying the same thing, this user picked the shortest in ${n} of ${decided} questions about length. Keep responses brief unless there is a clear reason not to.`
                : `Shown several ways of saying the same thing, this user picked the fullest in ${n} of ${decided} questions about length. Do not clip responses down to the minimum.`);
        }
    }

    if (idiom.length) {
        lines.push('');
        lines.push(`Words and turns of phrase this user actually uses: ${idiom.slice(0, 20).map((s) => `"${s}"`).join(', ')}.`);
        lines.push('Use these ONLY to judge their vocabulary and level of formality. They are button labels, so they are short for that reason alone — do NOT treat them as evidence that this user prefers short replies. Do NOT put these exact phrases into responses; the user says those themselves.');
    }

    // Instructions the user chose to keep for everyone (About Me). Their own words,
    // because they chose these exact words to keep.
    const keptAll = keptFor(null);
    if (keptAll.length) {
        lines.push('');
        lines.push('Instructions this user has asked you to keep. Follow them in every response:');
        for (const k of keptAll) lines.push(`  "${k.text}"`);
    }

    // Requests the user has had to make more than once. This is the strongest signal
    // in the file, because it is not a preference they reported — it is one they were
    // driven to state repeatedly by the app getting it wrong. A style request is sent
    // in the app's own words (see MEANINGS); any other is sent as the user typed it.
    // Only requests made with more than one person, or with no partner set, are here:
    // one made only with one person goes in the situation block, sent with that person.
    const steers = repeatedSteers().filter((g) => !g.personId);
    if (steers.length) {
        lines.push('');
        lines.push('When your suggestions have not been right, this user has asked for the same thing more than once. Treat each as a standing instruction, not a one-off:');
        for (const s of steers.slice(0, 6)) {
            lines.push(s.meaning
                ? `  ${MEANINGS[s.meaning].text} (asked ${s.count} times)`
                : `  "${s.text}" (asked ${s.count} times)`);
        }
    }

    // Several parts of this block bear on length. Say which comes first, so the model
    // is not left to weigh them (found by the October 6 2026 review).
    const lengthRequest = steers.some((s) => s.meaning === 'shorter' || s.meaning === 'longer');
    if ((len ? 1 : 0) + (lengthRequest ? 1 : 0) + (short.length ? 1 : 0) + (harvested.length ? 1 : 0) + (chosen.length ? 1 : 0) >= 2) {
        lines.push('');
        lines.push('On length: an instruction this user asked for comes first, then the length line above. The examples show their style; their length is a guide, not a rule.');
    }

    if (p.never.length) {
        lines.push('');
        lines.push(`This user never says: ${p.never.join('; ')}. Respect this without exception.`);
    }

    if (!lines.length) return '';
    return `HOW THIS USER SOUNDS — this governs the WORDING of every response you write.\n${lines.join('\n')}`;
}
