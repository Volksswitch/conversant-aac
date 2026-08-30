/* Control phrases — persistence model (Ken, June 28 2026)
 *
 * The user-editable spoken text behind the persistent override controls and the
 * conversation opener/closer cards, so a user can make each one sound like
 * something THEY would say:
 *   - holdOn   : LAST-RESORT fallback for "Hold on". That button now draws from
 *                the placeholder list and follows its no-repeat rule (Ken, comment
 *                76: it is a placeholder the user fires themselves), so this is
 *                reached only if every placeholder pool has been emptied. Kept
 *                because a button that says nothing is never acceptable; it has no
 *                editor on the Controls tab any more, since the words users edit
 *                are the placeholder ones.
 *   - pardon   : the phrases behind "Ask them to repeat". A LIST, picked from at
 *                random with the placeholder no-repeat rule, so a partner who has
 *                to be asked twice in one conversation does not hear the identical
 *                sentence twice (Ken, August 29 2026).
 *   - openers  : the cards shown by "Start conversation" (templates; {name} is
 *                replaced with the active Partner's name, dropped when none)
 *   - windDowns: the cards shown by "Wind down" — signal an intent to end the
 *                conversation ("I should get going.") WITHOUT saying goodbye yet
 *   - closings : the actual goodbyes ("Bye!", "Take care!") that appear once the
 *                user has selected a wind-down statement
 *   - declineClosing : the "one more thing" card offered when the PARTNER starts
 *                closing. Also a LIST — one is shown at a time and "New N" moves
 *                to the next, so every version is reachable without the card ever
 *                changing shape or leaving its pinned cell.
 * ("Say again" has no editable phrase — it re-speaks the user's own last words.)
 *
 * Wind-down vs. closing (Ken, July 2026): these are two distinct steps of the CA
 * closing sequence. "Wind down" surfaces the wind-downs; selecting one auto-offers
 * the closings; if the partner doesn't reciprocate, re-pressing "Wind down" dips
 * to the next page of wind-downs. Legacy files had a single `closers` list — it is
 * dropped and both new lists reseed from defaults (single-user pre-beta; re-edit
 * via Settings → Controls if you'd customized the old closers).
 *
 * Stored like the other user-owned data (express-panel.js, worldview.js):
 *   - <data folder>/control-phrases.json   portable source of truth (FSA)
 *   - localStorage 'aac_control_phrases'    same-machine write-through cache
 * Reconciliation is the v0.2.25 rule: a file in the connected folder wins; the
 * cache is promoted to a new file only when none exists on disk yet.
 *
 * Engine note: openers carry a {name} placeholder, but the name-substitution
 * lives in engine.js (applyName) where the opener palette is built — this model
 * just stores the raw templates. The engine keeps an inline default set mirroring
 * DEFAULTS so it works even before app.js injects these.
 */

import { readFile, writeFile, hasDataFolder } from './storage.js';

const FILE = 'control-phrases.json';
const CACHE_KEY = 'aac_control_phrases';

export const DEFAULTS = {
    holdOn: 'Let me think about that.',
    pardon: [
        "Sorry, I didn't catch that. Could you say it again?",
        'Sorry, could you say that again?',
        'I missed that. One more time?',
        "I didn't quite get that. Could you repeat it?",
        'Sorry, say that again for me?',
    ],
    // Shown alongside the goodbyes when the PARTNER starts closing. A pre-closing
    // is an offer to end, and CA is explicit that declining it — raising one more
    // thing — is made maximally relevant at exactly that moment. Without this card
    // the user's only options are to say goodbye or leave the palette (Ken, July
    // 27 2026). It buys the floor; the user then says the thing itself.
    declineClosing: [
        'Actually, before you go —',
        'Wait, one more thing.',
        "Hang on, there's something else.",
        'Before you head off, one more thing.',
        'Actually, can I say one more thing?',
    ],
    // {name} → the active Partner's name; dropped (with tidy punctuation) when
    // no Partner is active. Kept in sync with engine.js's inline fallback.
    openers: [
        'Hi {name}, got a minute?',
        'Can I ask you something, {name}?',
        'Guess what, {name}.',
        'Hey {name}, how are you doing?',
        'Good to see you, {name}.',
        'How have you been, {name}?',
        "What's new with you, {name}?",
        'I was just thinking about you, {name}.',
        'Got a story for you, {name}.',
    ],
    // Wind-down statements: signal "I'm ready to wrap up" without saying goodbye.
    windDowns: [
        'I should get going.',
        'I need to head out.',
        'This was really nice, thanks.',
        'Great catching up with you.',
        'Anyway, I should let you go.',
        "It's been good seeing you.",
        'I should probably wrap up.',
        "I've got to run soon.",
    ],
    // Closing statements: the actual goodbyes, offered after a wind-down.
    closings: [
        'Bye!',
        'Take care!',
        'See you later!',
        "Let's talk again soon.",
        'Have a good day!',
        'Talk soon!',
        'Goodbye!',
        'Catch you later.',
    ],
};

let phrases = null; // in-memory working copy

// Coerce any stored/edited value into the full shape, filling gaps from defaults.
// Blank list entries are KEPT (the editor needs a transient empty row to type
// into) — they're filtered out at engine-injection time, not here. A list that is
// entirely missing falls back to defaults.
function normalize(value) {
    const v = value && typeof value === 'object' ? value : {};
    const str = (x, d) => (typeof x === 'string' && x.trim() ? x : d);
    const list = (x, d) => {
        if (!Array.isArray(x)) return d.slice();
        const arr = x.map((s) => (typeof s === 'string' ? s : ''));
        return arr.length ? arr : d.slice();
    };
    const seededList = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string') : []);
    const seeded = (v.seeded && typeof v.seeded === 'object') ? v.seeded : {};
    // A legacy file has `closers` and neither new key — since windDowns/closings
    // are absent, list(undefined, DEFAULTS.*) reseeds both from defaults and the old
    // `closers` (which mixed the two senses) is simply ignored. No auto-classify.
    // "Ask them to repeat" and "one more thing" were single phrases until August 29
    // 2026. A file written before then holds a bare string: keep it as the first
    // entry rather than discarding it, and mergeNewDefaults then appends the rest of
    // the shipped set behind it. A user who had reworded theirs keeps their wording,
    // at the front, where it is the one most likely to be reached.
    const listOrString = (x, d) => (typeof x === 'string' && x.trim() ? [x] : list(x, d));
    return {
        holdOn: str(v.holdOn, DEFAULTS.holdOn),
        pardon: listOrString(v.pardon, DEFAULTS.pardon),
        declineClosing: listOrString(v.declineClosing, DEFAULTS.declineClosing),
        openers: list(v.openers, DEFAULTS.openers),
        windDowns: list(v.windDowns, DEFAULTS.windDowns),
        closings: list(v.closings, DEFAULTS.closings),
        // Watermark: every default opener/windDown/closing value ever injected into
        // this user's set. Drives additive merging (mergeNewDefaults) so a release
        // that adds new default cards shows them to existing users automatically,
        // WITHOUT resurrecting cards the user deliberately deleted.
        seeded: {
            openers: seededList(seeded.openers),
            windDowns: seededList(seeded.windDowns),
            closings: seededList(seeded.closings),
            pardon: seededList(seeded.pardon),
            declineClosing: seededList(seeded.declineClosing),
        },
    };
}

// Append default openers/closers the user has NOT been offered before to the END
// of their list — the "be smart about new functionality, but protect edits" rule
// (Ken, July 8 2026). "File in folder wins" still protects the user's edits; this
// only ADDS genuinely-new defaults. A default already in `seeded` is respected
// as-is: kept if present, and NOT re-added if the user removed it. A default NOT in
// `seeded` is new — appended once (unless already present) and recorded. There is
// no cap on how many can be defined (only on how many the UI shows at once), so
// appending is always safe. Returns true if anything changed (persist if so).
const LIST_KEYS = ['openers', 'windDowns', 'closings', 'pardon', 'declineClosing'];

function mergeNewDefaults(p) {
    let changed = false;
    for (const key of LIST_KEYS) {
        const seededSet = new Set(p.seeded[key]);
        const present = new Set(p[key]);
        for (const d of DEFAULTS[key]) {
            if (seededSet.has(d)) continue;   // already offered in a past release
            p.seeded[key].push(d);
            seededSet.add(d);
            if (!present.has(d)) { p[key].push(d); present.add(d); }  // append at the end
            changed = true;
        }
    }
    return changed;
}

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}
function writeCache(p) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch { /* quota — disk is truth */ }
}
function writeDisk(p) {
    writeFile(FILE, JSON.stringify({ version: 1, updated: new Date().toISOString(), ...p }, null, 2))
        .catch(() => { /* best-effort */ });
}

/** Load: data folder (source of truth) → cache → defaults. */
export async function load() {
    let loaded = null;
    const raw = await readFile(FILE);
    if (raw) { try { loaded = JSON.parse(raw); } catch { loaded = null; } }
    if (!loaded) loaded = readCache();
    phrases = normalize(loaded);
    const changed = mergeNewDefaults(phrases);   // append any new default cards
    writeCache(phrases);
    if (changed) writeDisk(phrases);              // persist the appended defaults + watermark
    return phrases;
}

/** Synchronous read for the editor / engine injection (returns a copy). */
export function getPhrases() {
    if (!phrases) phrases = normalize(readCache());
    const out = { ...phrases };
    for (const key of LIST_KEYS) out[key] = phrases[key].slice();
    return out;
}

/** Persist an edited set (cache immediately, disk in the background). */
/**
 * Every phrase the APP speaks on the user's behalf, flattened.
 *
 * Used by the voice harvest to tell OUR words apart from the user's own in
 * conversation logs written before the `source` field existed. Harvesting
 * "Let me think about that." as an example of how this person talks would be
 * teaching the model our own words back to itself.
 */
export function allPhrases() {
    const p = getPhrases();
    const out = [];
    for (const v of Object.values(p)) {
        if (typeof v === 'string') out.push(v);
        else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') out.push(x);
    }
    return out.filter(Boolean);
}

export function setPhrases(next) {
    // Carry the seeded watermark forward — the editor doesn't send it, and losing
    // it would make a deleted default reappear on the next load (mergeNewDefaults).
    const priorSeeded = (phrases && phrases.seeded) ? phrases.seeded : {};
    const incoming = (next && typeof next === 'object') ? next : {};
    phrases = normalize({ ...incoming, seeded: incoming.seeded || priorSeeded });
    writeCache(phrases);
    writeDisk(phrases);
    return getPhrases();
}

// Which entry each list handed out last, so the same one is not said twice running.
const lastIndex = {};

/**
 * One phrase from a list, never the same one twice in a row.
 *
 * The no-repeat rule is borrowed from the placeholder pool for the same reason it
 * exists there: these are phrases the app says on the user's behalf at moments that
 * can come round twice in one conversation - being asked to repeat something, or
 * holding a conversation open a second time - and hearing the identical sentence
 * again is what makes a device sound like a device.
 *
 * Blank entries are dropped HERE rather than in the model, because the editor needs
 * an empty row to type into and a half-finished edit must never become silence.
 * Returns '' only when the list is genuinely empty of words.
 */
export function pickPhrase(key) {
    const list = (getPhrases()[key] || []).map((s) => (s || '').trim()).filter(Boolean);
    if (!list.length) return '';
    if (list.length === 1) { lastIndex[key] = 0; return list[0]; }
    let index;
    do { index = Math.floor(Math.random() * list.length); } while (index === lastIndex[key]);
    lastIndex[key] = index;
    return list[index];
}

/**
 * The entry AFTER the one last handed out - the "show me a different one" gesture.
 *
 * The "one more thing" card is pinned into the response palette, where "New N" is
 * how the user asks for different wording. Random would work for variety but would
 * not let them reach a particular phrase, and a pinned card that a page turn hides
 * is useless, so this rotates the words inside the card and leaves the cell alone.
 */
export function nextPhrase(key) {
    const list = (getPhrases()[key] || []).map((s) => (s || '').trim()).filter(Boolean);
    if (!list.length) return '';
    const index = ((lastIndex[key] ?? -1) + 1) % list.length;
    lastIndex[key] = index;
    return list[index];
}

/** Restore the default phrases. */
export function resetPhrases() {
    phrases = normalize(DEFAULTS);
    // A reset adopts the full current defaults, so watermark them all — a later
    // release still appends only genuinely-new cards, not these.
    phrases.seeded = {};
    for (const key of LIST_KEYS) phrases.seeded[key] = DEFAULTS[key].slice();
    writeCache(phrases);
    writeDisk(phrases);
    return getPhrases();
}

/**
 * Reconcile once a data folder becomes available (v0.2.25 rule): adopt an
 * existing control-phrases.json, otherwise promote the cache to a new file.
 * Returns 'adopted' | 'wrote' | 'noop'.
 */
export async function syncToFolder() {
    if (!hasDataFolder()) return 'noop';
    const raw = await readFile(FILE);
    let disk = null;
    if (raw) { try { disk = JSON.parse(raw); } catch { disk = null; } }
    if (disk) {
        phrases = normalize(disk);
        const changed = mergeNewDefaults(phrases);   // append any new default cards
        writeCache(phrases);
        if (changed) await writeFile(FILE, JSON.stringify({ version: 1, updated: new Date().toISOString(), ...phrases }, null, 2));
        return 'adopted';
    }
    phrases = getPhrases();
    await writeFile(FILE, JSON.stringify({ version: 1, updated: new Date().toISOString(), ...phrases }, null, 2));
    return 'wrote';
}
