/* Word prediction — fully LOCAL, no AI per keystroke (CLAUDE.md "Word
 * prediction — local tiers"). Per-keypress prediction must be instant and
 * offline; the LLM is reserved for explicit phrase EXPANSION, never this.
 *
 * Two local layers here:
 *   1. Prefix completion from a bundled frequency-ordered list (data/words.json)
 *      — earlier in the list = more common, so we keep file order as the rank.
 *   2. Personalized learning — the user's own word frequency, persisted locally
 *      (localStorage), boosted ahead of the dictionary so their vocabulary and
 *      recent words surface first and improve over time. No network, no privacy
 *      cost.
 *
 * NEXT-WORD prediction is deliberately NOT here (decided August 30 2026, see
 * CLAUDE.md "Word prediction — local tiers"). The guessing would be easy; the
 * problem is that at a word boundary there is no remainder to shade in and no
 * spare keystroke to accept a guess with, so it would need on-keyboard buttons
 * whose meaning changes every keypress — to save one letter. Do not add it.
 *
 * predict(prefix) returns up to `limit` lowercase words; the caller (keyboard)
 * matches the typed prefix's capitalization when inserting.
 */


const FREQ_KEY = 'aac_word_freq';

let words = [];                 // frequency-ordered dictionary (file order = rank)
let userFreq = null;            // { word: count } personalized, lazy-loaded

function loadUserFreq() {
    if (userFreq) return userFreq;
    try { userFreq = JSON.parse(localStorage.getItem(FREQ_KEY)) || {}; }
    catch { userFreq = {}; }
    return userFreq;
}

function saveUserFreq() {
    try { localStorage.setItem(FREQ_KEY, JSON.stringify(userFreq)); } catch { /* quota/full */ }
}

export async function load() {
    if (words.length) return;
    try {
        const data = await fetch('data/words.json').then((r) => r.json());
        if (Array.isArray(data)) {
            words = data.map((w) => String(w).toLowerCase());
        }
    } catch { /* prediction simply yields nothing until the list loads */ }
    loadUserFreq();
}

// Off for a "Don't save this conversation" conversation (CR-012). A private
// conversation leaves nothing behind, and a learned word is kept for good and comes
// back in bold as a suggestion, possibly with someone else watching. app.js sets this
// from the same place it sets the conversation's save state.
let learning = true;
export function setLearning(on) { learning = !!on; }

// Record that the user committed a word (on word boundary, or by picking a
// prediction) — boosts it for next time. Words shorter than 2 chars are ignored.
//
// A word with a letter outside a-z is skipped rather than stored as a fragment ("José"
// would have become "jos"). The list is capped, keeping the most used words, so it
// cannot grow without limit in the shared browser storage (CR-151).
const LEARNED_MAX = 2000;
export function learn(word) {
    if (!learning) return;
    const raw = String(word || '').toLowerCase();
    if (/[^\x00-\x7f]/.test(raw)) return;
    const w = raw.replace(/[^a-z']/g, '');
    if (w.length < 2) return;
    const uf = loadUserFreq();
    uf[w] = (uf[w] || 0) + 1;
    const keys = Object.keys(uf);
    if (keys.length > LEARNED_MAX + 500) {
        keys.sort((a, b) => uf[b] - uf[a]).slice(LEARNED_MAX).forEach((k) => { delete uf[k]; });
    }
    saveUserFreq();
}

// --- Names the app already knows (Ken, October 25 2026) ---------------------------
//
// The bundled list holds 560 common words and no names, so the words a user types most
// - the people in their life, the places they go - were suggested only after being
// typed in full twice. Those words are already in the app: About Me, My Places and the
// "Words the voice gets wrong" list. So app.js supplies them here and they are
// suggested from the start, with nothing to type twice and nothing to keep in step.
//
// They are read fresh on every prediction rather than copied into the learned list, so
// an edit in About Me shows at once, "Forget" never removes a name that will only come
// back, and a person removed from About Me stops being suggested. The provider must
// leave out anything marked Private: a suggestion is shown on screen while someone else
// may be watching.
//
// ⚠ ONLY THE UNUSUAL WORDS. A place called "The Coffee Shop" would otherwise put
// "coffee" ahead of "come" for everything the user types; the dictionary's own words
// are already suggested, in their proper order, so those are skipped.
let knownWordsProvider = () => [];
export function setKnownWordsProvider(fn) {
    knownWordsProvider = typeof fn === 'function' ? fn : () => [];
}

// The words in a list of names, as the suggestions store them: lowercase a-z and the
// apostrophe, two letters or more. A word with any other letter ("José") is skipped
// whole rather than stored as a fragment, as learn() does. Pure.
export function wordsIn(texts) {
    const out = new Set();
    for (const t of texts || []) {
        for (const raw of String(t || '').toLowerCase().split(/[\s\-\/.,;:!?()"]+/)) {
            if (!raw || /[^\x00-\x7f]/.test(raw)) continue;
            const w = raw.replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '');
            if (w.length >= 2) out.add(w);
        }
    }
    return [...out];
}

function knownWords() {
    let texts = [];
    try { texts = knownWordsProvider() || []; } catch { texts = []; }
    const dictionary = new Set(words);
    return wordsIn(texts).filter((w) => !dictionary.has(w));
}

// --- The list the user can see and change (Ken, October 25 2026) -------------------

// Every learned or added word, most used first. For Settings.
export function listLearned() {
    const uf = loadUserFreq();
    return Object.keys(uf)
        .map((word) => ({ word, count: uf[word] }))
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

// Add words the user wants suggested. Each counts as used twice, which is what puts a
// word ahead of the dictionary (CR-151), so it is suggested at once. Returns
// { added: [word], skipped: [text] } - a word with a letter outside a-z cannot be
// suggested and is said back rather than dropped silently.
export function addWords(text) {
    const added = [];
    const skipped = [];
    const uf = loadUserFreq();
    for (const piece of String(text || '').split(/\s+/).filter(Boolean)) {
        const [w] = wordsIn([piece]);
        if (!w) { skipped.push(piece); continue; }
        uf[w] = Math.max(uf[w] || 0, 2);
        added.push(w);
    }
    if (added.length) saveUserFreq();
    return { added, skipped };
}

// Remove one word from the list. The dictionary and the names from About Me are not
// in the list, so they are not affected.
export function removeWord(word) {
    const uf = loadUserFreq();
    const w = String(word || '').toLowerCase();
    if (!(w in uf)) return false;
    delete uf[w];
    saveUserFreq();
    return true;
}

// Top predictions for a typed prefix. Personalized matches (by the user's own
// count) come first, then dictionary matches (by frequency rank), deduped.
// The learned word counts travel in a backup (CR-170), so moving to a new device - or
// between the two iPad modes, which keep separate storage - does not start over.
// Counts only, never sentences.
export function exportFrequencies() {
    return { ...loadUserFreq() };
}
// How many words the user's typing has taught the suggestions. Shown in Settings so the
// user can see there is something to clear.
export function learnedCount() {
    return Object.keys(loadUserFreq()).length;
}

// Forget every learned word (Ken, October 25 2026). Kept for good and carried in a
// backup, the list had no way out - not a word typed in a moment nobody should see
// again, nor one planted by somebody else's backup. The bundled dictionary is not
// touched, so suggestions keep working; they simply stop putting the user's own words
// first until those are learned again.
export function clearLearned() {
    userFreq = {};
    try { localStorage.removeItem(FREQ_KEY); } catch { /* storage blocked - memory is cleared */ }
}

export function importFrequencies(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    const clean = {};
    for (const [w, n] of Object.entries(obj)) {
        if (/^[a-z']{2,}$/.test(w) && Number.isFinite(n) && n > 0) clean[w] = Math.floor(n);
    }
    userFreq = clean;
    saveUserFreq();
    return true;
}

export function predict(prefix, limit = 3) {
    const p = String(prefix || '').toLowerCase().replace(/[^a-z']/g, '');
    if (!p) return [];
    const uf = loadUserFreq();

    // Personalized matches, most-used first; exclude the exact prefix itself. A name the
    // app knows counts as used twice, so it comes first from the start.
    const counts = { ...uf };
    for (const w of knownWords()) counts[w] = Math.max(counts[w] || 0, 2);
    const personal = Object.keys(counts)
        .filter((w) => w !== p && w.startsWith(p))
        .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));

    const out = [];
    const seen = new Set();
    const push = (w) => { if (!seen.has(w)) { seen.add(w); out.push(w); } };
    // ⚠ A WORD TYPED ONCE DOES NOT BEAT THE DICTIONARY (CR-151): a single typo ("teh")
    // used to be offered ahead of the real word from then on. A word used at least twice
    // comes first; a word used once comes after the dictionary's matches.
    personal.filter((w) => counts[w] >= 2).forEach(push);

    // Then dictionary matches in frequency order until we hit the limit.
    if (out.length < limit) {
        for (const w of words) {
            if (out.length >= limit) break;
            if (w !== p && w.startsWith(p)) push(w);
        }
    }
    personal.forEach(push);
    return out.slice(0, limit);
}
