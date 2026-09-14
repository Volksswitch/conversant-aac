/* Practice scenarios the USER owns — copies of the built-ins and ones they wrote
 * (Ken, September 13 2026; spec: Documents/Conversant AAC Practice Scenarios.docx,
 * sections 2, 4, 5 and 6).
 *
 * The built-in six (practice-scenarios.js) are NEVER edited. "Make a copy" puts an
 * editable copy here, which is what lets a built-in always be relied on as a starting
 * point — the document's own reason for the rule.
 *
 * A scenario is a DESCRIPTION OF A PERSON, not a script. The two fields this file adds
 * to the built-in shape are the ones that make it personal:
 *   behavior / behaviorText — how the other person is behaving today (section 5)
 *   details                 — facts about this person and this occasion (section 4)
 *
 *   { version, updated,
 *     scenarios: [ { id, basedOn, category, title, description, opensWith,
 *                    partnerPersona, register, behavior, behaviorText, details } ] }
 *
 * Storage mirrors places.js: <data folder>/practice-scenarios.json is the source of
 * truth, localStorage 'aac_practice_scenarios' the write-through cache, and the file
 * in the connected folder wins (the v0.2.25 rule).
 *
 * The prompt text lives here too (buildPartnerBrief / buildUserSideBlock) so the
 * wording that carries the safety line in section 5.3 has one home and is tested.
 */

import { readFile, writeFile, hasDataFolder } from './storage.js';

const FILE = 'practice-scenarios.json';
const CACHE_KEY = 'aac_practice_scenarios';

export const CATEGORIES = ['Social', 'Practical', 'Professional', 'Medical', 'Personal'];

// Easiest to hardest, which is the order the document lists them in on purpose: working
// down the list turns up the difficulty on the same conversation. `prompt` is what the
// other person is told; `label` is what the user reads.
export const BEHAVIORS = [
    { id: 'warm',        label: 'Warm and easy',        prompt: 'friendly, patient and on the user\'s side' },
    { id: 'businesslike', label: 'Businesslike',        prompt: 'polite and efficient — not unkind, but not warm either' },
    { id: 'distracted',  label: 'Distracted or rushed', prompt: 'short on time, only half paying attention, and wanting to move things along' },
    { id: 'skeptical',   label: 'Skeptical',            prompt: 'not convinced — asking for reasons and pushing back on what the user says' },
    { id: 'dismissive',  label: 'Brushing you off',     prompt: 'dismissive, treating what the user is saying as not really the point' },
    { id: 'hurt',        label: 'Hurt',                 prompt: 'upset by something, and it is about the user — more wounded than angry' },
    { id: 'angry',       label: 'Angry with you',       prompt: 'openly annoyed with the user, and saying so' },
    { id: 'custom',      label: 'In my own words',      prompt: '' },
];

let model = null;

function defaultModel() {
    return { version: 1, updated: new Date().toISOString(), scenarios: [] };
}

function str(v) { return String(v ?? '').trim(); }

// The scenario's own voice, one choice PER SPEECH SERVICE (document section 3). Keyed by
// service because a voice id only means something to the service that issued it, and
// a user who switches service must not have the doctor handed a meaningless id. An
// empty choice is not stored: it means "use the general practice voice".
function normalizeVoices(v) {
    const out = {};
    if (v && typeof v === 'object') {
        for (const [service, id] of Object.entries(v)) {
            const clean = str(id);
            if (clean) out[service] = clean;
        }
    }
    return out;
}

function normalizeScenario(s) {
    const behavior = BEHAVIORS.some((b) => b.id === s.behavior) ? s.behavior : 'warm';
    return {
        id: s.id,
        basedOn: s.basedOn || null,
        // A person from About Me this scenario is about (document section 2). While
        // practicing, that person is the active partner, so "how I talk with them" and
        // their goals apply exactly as they would in a real conversation.
        personId: s.personId ? String(s.personId) : null,
        voices: normalizeVoices(s.voices),
        category: CATEGORIES.includes(s.category) ? s.category : 'Personal',
        title: str(s.title),
        description: str(s.description),
        opensWith: s.opensWith === 'user' ? 'user' : 'partner',
        partnerPersona: str(s.partnerPersona),
        register: str(s.register),
        behavior,
        behaviorText: str(s.behaviorText),
        details: str(s.details),
    };
}

function normalize(m) {
    const base = defaultModel();
    return {
        version: m.version ?? base.version,
        updated: m.updated ?? base.updated,
        scenarios: (Array.isArray(m.scenarios) ? m.scenarios : [])
            .filter((s) => s && s.id).map(normalizeScenario),
    };
}

function newId() {
    return 'ps' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

function writeCache(m) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(m)); } catch { /* quota — disk is truth */ }
}

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

/** The user's own scenarios, as copies (the editor mutates freely). */
export function listScenarios() {
    return ensureLoaded().scenarios.map((s) => ({ ...s, userOwned: true }));
}

export function getScenario(id) {
    return listScenarios().find((s) => s.id === id) || null;
}

/** A blank form, for "Fill it in yourself". Not stored until addScenario. */
export function emptyScenario() {
    return normalizeScenario({ id: null, category: 'Personal', behavior: 'warm' });
}

export async function addScenario(fields = {}) {
    const m = ensureLoaded();
    const s = normalizeScenario({ ...fields, id: newId() });
    m.scenarios.push(s);
    await save();
    return s.id;
}

/**
 * "Make a copy". Works on a built-in or on one of the user's own. A scripted entry
 * (the controls tour, which carries `steps` and no persona) cannot be copied: there is
 * no description of a person to change.
 */
export async function copyScenario(source) {
    if (!source || !source.partnerPersona) return null;
    return addScenario({
        basedOn: source.id || null,
        category: source.category,
        title: source.userOwned ? `${source.title} (copy)` : source.title,
        description: source.description,
        opensWith: source.opensWith,
        partnerPersona: source.partnerPersona,
        register: source.register,
        behavior: source.behavior || 'warm',
        behaviorText: source.behaviorText || '',
        details: source.details || '',
        personId: source.personId || null,
        voices: source.voices || {},
    });
}

/**
 * "Start from someone in About Me". Fills the form from what the user already wrote,
 * so the same person is not described twice; everything stays editable, and editing
 * it here never touches About Me. Pure, so it is testable without a graph.
 */
export function scenarioFromPerson(person) {
    if (!person) return null;
    const label = str(person.nickname) || str(person.name);
    const rel = str(person.relationship);
    const persona = [
        rel ? `${str(person.name)}, my ${rel.toLowerCase()}.` : `${str(person.name)}.`,
        str(person.about),
    ].filter(Boolean).join(' ');
    return normalizeScenario({
        id: null,
        personId: person.id,
        title: `Talking with ${label}`,
        category: 'Personal',
        description: rel ? `A conversation with my ${rel.toLowerCase()}.` : '',
        partnerPersona: persona,
        register: 'a conversation between two people who know each other',
        behavior: 'warm',
    });
}

/** The AI's suggested opening lines, as a clean list. Tolerates prose around the JSON. */
export function parseOpeners(text) {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {
        const m = String(text || '').match(/\[[\s\S]*\]/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.openers)) parsed = parsed.openers;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((o) => str(typeof o === 'string' ? o : o && o.text)).filter(Boolean).slice(0, 8);
}

/**
 * Save-as-you-go edit. A blank title is IGNORED rather than stored, for the same reason
 * the People editor refuses to blank a name: walking away from an emptied box must not
 * erase what the scenario is called.
 */
export async function updateScenario(id, fields = {}) {
    const m = ensureLoaded();
    const i = m.scenarios.findIndex((s) => s.id === id);
    if (i < 0) return;
    const next = { ...m.scenarios[i], ...fields, id };
    if (!str(next.title)) next.title = m.scenarios[i].title;
    m.scenarios[i] = normalizeScenario(next);
    await save();
}

export async function removeScenario(id) {
    const m = ensureLoaded();
    m.scenarios = m.scenarios.filter((s) => s.id !== id);
    await save();
}

export function count() {
    return ensureLoaded().scenarios.length;
}

// --- prompt text -------------------------------------------------------------

function behaviorPhrase(scenario) {
    if (scenario.behavior === 'custom') return str(scenario.behaviorText);
    const b = BEHAVIORS.find((x) => x.id === scenario.behavior);
    return b ? b.prompt : '';
}

/**
 * Everything the PARTNER-authoring call needs beyond the persona: how they are behaving,
 * the details, and the line that is never adjustable (section 5.3).
 *
 * ⚠ THE SECTION 5.3 LINE IS EMITTED FOR EVERY SCENARIO, BUILT-IN INCLUDED, AND MUST STAY
 * UNCONDITIONAL. Practice happens alone, in the one place the user is meant to be able
 * to try things safely; a partner who turned on their disability there would repeat the
 * experience the product exists to make rarer. A test fails if it goes missing.
 */
export function buildPartnerBrief(scenario) {
    const lines = [];
    const mood = behaviorPhrase(scenario);
    if (mood) {
        lines.push(`How you are behaving when the conversation opens: ${mood}. That is where you START, not where you must stay — react to what the user actually says, and to what the conversation turns out to be about. Handled well, you can come around; handled badly, it can get worse. Do not give ground easily: folding the moment the user says something reasonable would flatter them and leave them unprepared for the real conversation.`);
    }
    if (scenario.details) {
        lines.push(`Details the user wrote for this practice. They are TRUE; you know them and can refer to them naturally, but do not recite them:\n${scenario.details}`);
    }
    lines.push('However difficult you are being, you are difficult about the SITUATION only. Never be difficult about the user\'s disability or the way they communicate: never remark on the device, never show impatience with how long they take to answer, and never comment on how they speak.');
    return lines.join('\n\n');
}

/**
 * The grounding for the USER's suggested replies. The details are the user's own word
 * about their situation, so they may be built on — the one way the no-fabrication rule
 * lets specifics onto the cards (document section 4.3).
 */
export function buildUserSideBlock(scenario) {
    const lines = [];
    if (scenario.details) {
        lines.push(`The user wrote these details for this practice. Treat them as TRUE facts about their situation and build on them, so the responses are about their actual situation from the first turn: ${scenario.details.replace(/\s+/g, ' ')}. The responses must still sound like the user, not like a professional speaking for them.`);
    }
    const mood = behaviorPhrase(scenario);
    if (mood && scenario.behavior !== 'warm') {
        lines.push(`The other person is ${mood}.`);
    }
    return lines.join(' ');
}

/**
 * Parse the AI's draft for "Describe it in a sentence". Tolerates prose around the JSON
 * and fills anything missing, so a partial draft is still a usable starting point rather
 * than an error — the user is going to edit it anyway.
 */
export function parseDraft(text, sentence = '') {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {
        const m = String(text || '').match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* fall through */ } }
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const s = normalizeScenario({ ...parsed, id: null });
    if (!s.partnerPersona) return null;
    if (!s.title) s.title = str(sentence).slice(0, 60) || 'My scenario';
    return s;
}
