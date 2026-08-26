/* Placeholder phrases — the user-owned pools (Ken, August 25 2026)
 *
 * The floor-holding phrases the app speaks while the user is choosing a response.
 * They were a bundled file nobody could edit; they are now a user-owned set like
 * the control phrases and the Express Panel items, so a user can make the app's
 * stalling sound like something THEY would say.
 *
 * Two pools, and the split is by JOB, not by mood:
 *   - acknowledgment : the FIRST phrase of a turn — "I heard you, I'm on it"
 *   - thinking       : every later one — "still working on it"
 * placeholders.js draws by position, which is what stops two near-identical
 * phrases landing back to back.
 *
 * TWO STANDING CONSTRAINTS ON THE WORDING, both load-bearing and both easy to
 * break from an editor, which is why the editor states them on screen:
 *   1. PARTNER-STATEMENT INDEPENDENT. Nothing knows whether the other person
 *      asked a question, made a statement or said hello — the ladder runs off
 *      their silence, not off the AI — so every phrase has to read correctly
 *      after any of them. "Good question." is the phrase that taught us this.
 *   2. DECLARATIVE AND FIRST-PERSON. Never imperative, never aimed at the other
 *      person ("Let me think", "Give me a second", "One moment"): the flat
 *      built-in voices make those read as curt or annoyed.
 * Neither can be enforced in code — they are judgments about wording — so the
 * defaults model them and the editor says them.
 *
 * Stored like the other user-owned data (control-phrases.js, express-items.js):
 *   - <data folder>/placeholders.json    portable source of truth
 *   - localStorage 'aac_placeholders'    same-machine write-through cache
 * Reconciliation is the v0.2.25 rule: a file in the connected folder wins; the
 * cache is promoted to a new file only when none exists on disk yet. New default
 * phrases added by a later release are APPENDED via the `seeded` watermark, so a
 * release can add one without resurrecting a phrase the user deleted.
 */

import { readFile, writeFile, hasDataFolder } from './storage.js';

const FILE = 'placeholders.json';
const CACHE_KEY = 'aac_placeholders';

export const DEFAULTS = {
    acknowledgment: [
        "I'm thinking about that.",
        'Thinking that over.',
        "I'm thinking.",
        'Working that out.',
    ],
    thinking: [
        'Still thinking it through.',
        "I'm working out what I want to say.",
        'Putting my thoughts together.',
        'Still mulling that over.',
        'Just gathering my thoughts.',
    ],
};

export const POOLS = ['acknowledgment', 'thinking'];

let phrases = null;   // in-memory working copy

/**
 * Coerce anything stored or edited into the full shape.
 *
 * Blank entries are KEPT — the editor needs a transient empty row to type into.
 * placeholders.js filters them at speaking time, which is the right place: an
 * empty row must never become a moment of silence where a phrase was expected.
 *
 * Two legacy shapes are tolerated, both from the bundled data/placeholders.json
 * this replaced: a flat array (used for both pools), and an object whose
 * `acknowledgment` is itself split into { question, general }. From that second
 * one only `general` survives — those were the turn-type-independent phrases, and
 * constraint 1 above is exactly why the split was abandoned.
 */
function normalize(value) {
    const v = Array.isArray(value)
        ? { acknowledgment: value, thinking: value }
        : (value && typeof value === 'object' ? value : {});
    const list = (x, d) => {
        if (!Array.isArray(x)) return d.slice();
        const arr = x.map((s) => (typeof s === 'string' ? s : ''));
        return arr.length ? arr : d.slice();
    };
    let ack = v.acknowledgment;
    if (ack && !Array.isArray(ack) && typeof ack === 'object') ack = ack.general;
    const seededList = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string') : []);
    const seeded = (v.seeded && typeof v.seeded === 'object') ? v.seeded : {};
    return {
        acknowledgment: list(ack, DEFAULTS.acknowledgment),
        thinking: list(v.thinking, DEFAULTS.thinking),
        seeded: {
            acknowledgment: seededList(seeded.acknowledgment),
            thinking: seededList(seeded.thinking),
        },
    };
}

// Append defaults this user has never been offered, at the END of their list —
// the additive-merge rule (Ken, July 8 2026). A default already in `seeded` is
// left exactly as the user left it, deleted included.
function mergeNewDefaults(p) {
    let changed = false;
    for (const key of POOLS) {
        const seededSet = new Set(p.seeded[key]);
        const present = new Set(p[key]);
        for (const d of DEFAULTS[key]) {
            if (seededSet.has(d)) continue;
            p.seeded[key].push(d);
            seededSet.add(d);
            if (!present.has(d)) { p[key].push(d); present.add(d); }
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
function serialize(p) {
    return JSON.stringify({ version: 1, updated: new Date().toISOString(), ...p }, null, 2);
}
function writeDisk(p) {
    writeFile(FILE, serialize(p)).catch(() => { /* best-effort */ });
}

/** Load: data folder (source of truth) → cache → defaults. */
export async function load() {
    let loaded = null;
    const raw = await readFile(FILE);
    if (raw) { try { loaded = JSON.parse(raw); } catch { loaded = null; } }
    if (!loaded) loaded = readCache();
    phrases = normalize(loaded);
    const changed = mergeNewDefaults(phrases);
    writeCache(phrases);
    if (changed) writeDisk(phrases);
    return getPools();
}

/**
 * Synchronous read for the editor and for speaking (returns a copy).
 *
 * placeholders.js calls this on the path to actually saying something, so it must
 * never wait on disk: an unloaded model answers from the cache, and failing that
 * from the defaults. A held floor is worth more than a fresh read.
 */
export function getPools() {
    if (!phrases) phrases = normalize(readCache());
    return {
        acknowledgment: phrases.acknowledgment.slice(),
        thinking: phrases.thinking.slice(),
    };
}

/** Persist an edited set (cache immediately, disk in the background). */
export function setPools(next) {
    // Carry the watermark forward — the editor does not send it, and losing it
    // would make a deleted default reappear on the next load.
    const prior = (phrases && phrases.seeded) ? phrases.seeded : { acknowledgment: [], thinking: [] };
    const incoming = (next && typeof next === 'object') ? next : {};
    phrases = normalize({ ...incoming, seeded: incoming.seeded || prior });
    writeCache(phrases);
    writeDisk(phrases);
    return getPools();
}

/** Restore the default phrases. */
export function resetPools() {
    phrases = normalize(DEFAULTS);
    // A reset adopts the whole current default set, so watermark all of it: a
    // later release still appends only genuinely-new phrases, not these.
    phrases.seeded = {
        acknowledgment: DEFAULTS.acknowledgment.slice(),
        thinking: DEFAULTS.thinking.slice(),
    };
    writeCache(phrases);
    writeDisk(phrases);
    return getPools();
}

/** Every phrase the app can speak as a placeholder, flattened. */
export function allPhrases() {
    const p = getPools();
    return [...p.acknowledgment, ...p.thinking].filter((s) => s && s.trim());
}

/**
 * Reconcile once a data folder becomes available (v0.2.25 rule): adopt an
 * existing placeholders.json, otherwise promote the cache to a new file.
 * Returns 'adopted' | 'wrote' | 'noop'.
 */
export async function syncToFolder() {
    if (!hasDataFolder()) return 'noop';
    const raw = await readFile(FILE);
    let disk = null;
    if (raw) { try { disk = JSON.parse(raw); } catch { disk = null; } }
    if (disk) {
        phrases = normalize(disk);
        const changed = mergeNewDefaults(phrases);
        writeCache(phrases);
        if (changed) await writeFile(FILE, serialize(phrases));
        return 'adopted';
    }
    phrases = normalize(phrases || readCache());
    await writeFile(FILE, serialize(phrases));
    return 'wrote';
}
