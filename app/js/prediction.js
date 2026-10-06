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

// Top predictions for a typed prefix. Personalized matches (by the user's own
// count) come first, then dictionary matches (by frequency rank), deduped.
// The learned word counts travel in a backup (CR-170), so moving to a new device - or
// between the two iPad modes, which keep separate storage - does not start over.
// Counts only, never sentences.
export function exportFrequencies() {
    return { ...loadUserFreq() };
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

    // Personalized matches, most-used first; exclude the exact prefix itself.
    const personal = Object.keys(uf)
        .filter((w) => w !== p && w.startsWith(p))
        .sort((a, b) => uf[b] - uf[a]);

    const out = [];
    const seen = new Set();
    const push = (w) => { if (!seen.has(w)) { seen.add(w); out.push(w); } };
    // ⚠ A WORD TYPED ONCE DOES NOT BEAT THE DICTIONARY (CR-151): a single typo ("teh")
    // used to be offered ahead of the real word from then on. A word used at least twice
    // comes first; a word used once comes after the dictionary's matches.
    personal.filter((w) => uf[w] >= 2).forEach(push);

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
