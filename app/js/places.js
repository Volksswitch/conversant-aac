/* AAC Conversation Assistant — places model ("My Places", August 2026)
 *
 * WHY THIS EXISTS (Ken, August 3 2026). Phase 2 situational awareness is meant to
 * come from GPS. This is the same signal obtained WITHOUT GPS: the user taps the
 * place they are at in the Express Panel, exactly as they tap who they are talking
 * with, and the AI is told where the conversation is happening and what it knows
 * about that place. So a place is an INFLUENCER first and a stored record second —
 * the same pattern as Partner, deliberately.
 *
 * SHAPE — a place is a name plus ARBITRARY NAMED FACTS (Ken's example: Starbucks →
 * "Location: 123 Main Street", "favorite drink: mocha latte"). There is no fixed
 * field set on purpose: what is worth knowing about a coffee shop, a clinic and a
 * cousin's house have almost nothing in common, and any schema we invented would be
 * wrong for most places. "Location" is itself just a fact — it belongs only when the
 * place is one specific branch rather than a chain.
 *
 *   { version, updated,
 *     places: [ { id, name, private, facts: [ { key, value } ] } ] }
 *
 * Facts are an ORDERED ARRAY, not an object: the user controls the order they are
 * listed in (and therefore read to the AI), duplicate keys are possible without one
 * silently clobbering another, and a blank row can exist in the editor mid-typing.
 *
 * Storage mirrors relationships.js / worldview.js:
 *   - <data folder>/places.json   portable source of truth (FSA or OPFS)
 *   - localStorage 'aac_places'    same-machine write-through cache
 * Reconciliation is the v0.2.25 rule — the file in the connected folder wins; the
 * cache is promoted only when no file exists on disk yet.
 *
 * PRIVACY follows the standing three-level model, same as people: a private place is
 * sent to the AI for context but never raised on its own initiative; a place the user
 * does not want the AI to know about is simply not added.
 *
 * "Unprompted" needs a referent or the rule is unfollowable (Ken, August 3 2026).
 * TWO things count as a prompt and both must stay named in the prompt text, because
 * the AI's only output IS the response palette — if it never writes a card carrying
 * the fact, the user can never choose one:
 *   1. the PARTNER asks about it;
 *   2. the USER steers, by typing in "In my own words" and tapping Reframe — that
 *      steer already reaches the model as user-authored ground truth that overrides
 *      its other cautions (llm.js steerBlock).
 * Separately and always: nothing is spoken until the user taps it. That is the real
 * guarantee, and it is a property of SELECTION, not of authoring — so it must never
 * be written as a rule the model is asked to apply while writing options.
 */

import { readFile, writeFile, hasDataFolder } from './storage.js';

const FILE = 'places.json';
const CACHE_KEY = 'aac_places';

let model = null;

// --- shape helpers ----------------------------------------------------------

function defaultModel() {
    return {
        version: 1,
        updated: new Date().toISOString(),
        places: []
    };
}

// Keep only well-formed fact rows. A fact with no key is a blank editor row, not
// data; a fact with a key but no value IS kept, because "Wi-Fi password: (blank)"
// is a legitimate thing to have started recording.
function normalizeFacts(facts) {
    if (!Array.isArray(facts)) return [];
    return facts
        .filter((f) => f && typeof f === 'object')
        .map((f) => ({ key: String(f.key ?? '').trim(), value: String(f.value ?? '').trim() }))
        .filter((f) => f.key);
}

function normalizePlace(p) {
    return {
        id: p.id,
        name: String(p.name ?? '').trim(),
        private: !!p.private,
        facts: normalizeFacts(p.facts)
    };
}

function normalize(m) {
    const base = defaultModel();
    return {
        version: m.version ?? base.version,
        updated: m.updated ?? base.updated,
        places: (Array.isArray(m.places) ? m.places : []).filter((p) => p && p.id).map(normalizePlace)
    };
}

function newId() {
    return 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

function writeCache(m) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(m)); } catch { /* quota — disk is truth */ }
}

// --- load / save ------------------------------------------------------------

/** Load: data folder (source of truth) → cache → empty. */
export async function load() {
    let loaded = null;
    const raw = await readFile(FILE);
    if (raw) { try { loaded = JSON.parse(raw); } catch { loaded = null; } }
    if (!loaded) loaded = readCache();
    model = loaded ? normalize(loaded) : defaultModel();
    writeCache(model);
    return model;
}

function ensureLoaded() {
    if (!model) {
        const cached = readCache();
        model = cached ? normalize(cached) : defaultModel();
    }
    return model;
}

async function save() {
    model.updated = new Date().toISOString();
    writeCache(model);
    await writeFile(FILE, JSON.stringify(model, null, 2));
}

/**
 * Reconcile cache with the data folder once a folder becomes available. Same rule
 * as relationships.syncToFolder (v0.2.25): a places.json in the connected folder
 * wins outright; otherwise the cache is promoted to a new file.
 * Returns 'adopted' | 'wrote' | 'noop'.
 */
export async function syncToFolder() {
    if (!hasDataFolder()) return 'noop';

    const raw = await readFile(FILE);
    let disk = null;
    if (raw) { try { disk = JSON.parse(raw); } catch { disk = null; } }

    if (disk) {
        model = normalize(disk);
        writeCache(model);
        return 'adopted';
    }
    model = normalize(readCache() || model || defaultModel());
    await save();
    return 'wrote';
}

// --- places -----------------------------------------------------------------

/** All places, newest last, as copies (the editor mutates freely). */
export function listPlaces() {
    return ensureLoaded().places.map((p) => ({
        id: p.id,
        name: p.name,
        private: !!p.private,
        facts: p.facts.map((f) => ({ ...f }))
    }));
}

export function getPlace(id) {
    return listPlaces().find((p) => p.id === id) || null;
}

export async function addPlace({ name = '', facts = [], isPrivate = false } = {}) {
    const m = ensureLoaded();
    const id = newId();
    m.places.push({
        id,
        name: (name || '').trim(),
        private: !!isPrivate,
        facts: normalizeFacts(facts)
    });
    await save();
    return id;
}

export async function updatePlace(id, { name, facts, isPrivate } = {}) {
    const m = ensureLoaded();
    const p = m.places.find((x) => x.id === id);
    if (!p) return;
    if (name !== undefined) p.name = (name || '').trim();
    if (facts !== undefined) p.facts = normalizeFacts(facts);
    if (isPrivate !== undefined) p.private = !!isPrivate;
    await save();
}

export async function removePlace(id) {
    const m = ensureLoaded();
    m.places = m.places.filter((p) => p.id !== id);
    await save();
}

export async function resetAll() {
    const m = ensureLoaded();
    m.places = [];
    await save();
}

export function count() {
    return ensureLoaded().places.length;
}

// --- LLM blocks -------------------------------------------------------------

function factLine(p) {
    return p.facts.map((f) => `${f.key}: ${f.value}`).join('; ');
}

/**
 * Compact text for the generation system prompt — the places slice of "speak AS
 * this person." Mirrors relationships.buildBlock: known places are listed with
 * their facts; private places are listed under a do-not-volunteer instruction that
 * also names the two things which DO unlock one (partner asks / user steers) — see
 * the PRIVACY note at the top of this file for why naming them is load-bearing.
 *
 * Every place is included, as every person is. The set is small and user-curated,
 * and a place the user bothered to record is a place they talk about. If the block
 * ever outgrows its budget the answer is the same RAG-lite selection planned for
 * the worldview profile, not a special case here.
 *
 * `excludeId` omits the place the user is standing in, because buildHereBlock is
 * already carrying it with the correct framing and the two framings differ (Ken,
 * August 5 2026). This list describes places the user GOES — "Pulp Comics — When:
 * Saturdays" is useful context anywhere else, and is exactly the fact that produces
 * "what did you find here last Saturday?" when they are standing in the shop. Saying
 * the same place twice under two framings also doubles its salience, which pushes
 * the model toward making it the topic. Nothing is lost: the here-block repeats the
 * facts.
 */
export function buildBlock(excludeId = null) {
    const places = listPlaces().filter((p) => p.name && p.id !== excludeId);
    if (!places.length) return '';

    const open = [];
    const privateKnown = [];
    for (const p of places) {
        const facts = factLine(p);
        const entry = `- ${p.name}${facts ? ` — ${facts}` : ''}`;
        (p.private ? privateKnown : open).push(entry);
    }

    const lines = [];
    if (open.length) lines.push('Places I go:', ...open);
    if (privateKnown.length) {
        lines.push(
            'These places are known to you for context — do not bring them up unprompted. Never work one into a response on your own initiative. Include one ONLY when the partner has asked about it, or when the user\'s own typed guidance tells you to:',
            ...privateKnown
        );
    }
    return lines.join('\n');
}

/**
 * The situational line for the place the user has tapped as "I am here right now".
 * This is the GPS-free location signal: it tells the model where the conversation
 * is happening, which shapes what a plausible response even IS (an order, a waiting
 * room question, a neighbor's greeting). Facts are repeated here rather than left to
 * buildBlock so the current place's details are the ones in front of the model, not
 * one line among twenty.
 *
 * SETTING, NOT SUBJECT (Ken, August 5 2026). The place button is situational
 * awareness — it stands in for the GPS we do not have — and it is NOT a way to
 * frame what the conversation is about. Someone who wants to talk about comics
 * says so through Reframe; they do not say it by naming a comic shop. So the
 * block has to state both halves: where the user is, AND that the topic still
 * comes from what the partner actually said.
 *
 * The facts are the half that actually leaks, and it is the same defect found in
 * the privacy blocks on August 3: a list of details with nothing saying WHEN they
 * are for reads as material to work in. Hence the explicit occasion clause.
 */
export function buildHereBlock(id) {
    const p = getPlace(id);
    if (!p || !p.name) return '';
    const facts = factLine(p);
    const lines = [
        `The user is physically at ${p.name} right now — this is WHERE the conversation is happening.`,
        `What this place is for SHOULD inform your suggestions: what someone would plausibly say standing here, and what the partner is likely getting at. What it must not do is become the topic on its own — that comes from what the partner actually said.`,
    ];
    if (facts) lines.push(`What you know about ${p.name} — ${facts}. These are for UNDERSTANDING the situation, not for saying: they let a response be specific and competent here. Do not announce them back, and never treat this place as somewhere the user visits or remembers ("what did you find here last Saturday?") — they are standing in it right now, so anything that amounts to describing being here is already obvious to everyone present.`);
    if (p.private) lines.push(`Do not name ${p.name} on your own initiative — only if the partner asks where the user is, or the user's own typed guidance tells you to.`);
    return lines.join(' ');
}
