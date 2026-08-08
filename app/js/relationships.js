/* AAC Conversation Assistant — relationship graph model
 *
 * Relationship data is a *graph*, not flat question/answer: people are nodes
 * (each with attributes), and relationships are edges (which also carry data).
 * That is structurally different from the worldview questionnaire (worldview.js),
 * so it lives in its own file and its own model layer (Ken, June 15 2026).
 *
 * Storage mirrors worldview.js:
 *   - <data folder>/relationships.json   per-user graph (FSA), source of truth
 *   - localStorage 'aac_relationships'    same-machine write-through cache
 * Reconciliation is the v0.2.25 rule — the file in the connected folder wins;
 * the cache is promoted only when no file exists on disk yet.
 *
 * Shape:
 *   { version, updated,
 *     people: [ { id, name, private, attrs: { about, ... } } ],
 *     edges:  [ { from, to, type, attrs: {} } ] }
 * The user is the implicit node "me"; a person's relationship to the user is the
 * `type` of the me->person edge. Person<->person edges are supported by the data
 * model (e.g. "my sister is married to my brother-in-law") even though the
 * current UI only edits me->person edges — keeping the build small without
 * trapping the schema.
 */

import { readFile, writeFile, hasDataFolder } from './storage.js';
import { registerClauses, goalText } from './partner-profile.js';

const FILE = 'relationships.json';
const CACHE_KEY = 'aac_relationships';
const ME = 'me';

let graph = null;

// --- shape helpers ----------------------------------------------------------

function defaultGraph() {
    return {
        version: 1,
        updated: new Date().toISOString(),
        people: [],
        edges: []
    };
}

function normalize(g) {
    const base = defaultGraph();
    return {
        version: g.version ?? base.version,
        updated: g.updated ?? base.updated,
        people: Array.isArray(g.people) ? g.people : [],
        edges: Array.isArray(g.edges) ? g.edges : []
    };
}

function newId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

function writeCache(g) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(g)); } catch { /* quota — disk is truth */ }
}

// --- load / save ------------------------------------------------------------

/** Load the graph: data folder (source of truth) → cache → empty. */
export async function load() {
    let loaded = null;
    const raw = await readFile(FILE);
    if (raw) { try { loaded = JSON.parse(raw); } catch { loaded = null; } }
    if (!loaded) loaded = readCache();
    graph = loaded ? normalize(loaded) : defaultGraph();
    writeCache(graph);
    return graph;
}

function ensureLoaded() {
    if (!graph) graph = readCache() ? normalize(readCache()) : defaultGraph();
    return graph;
}

async function save() {
    graph.updated = new Date().toISOString();
    writeCache(graph);
    await writeFile(FILE, JSON.stringify(graph, null, 2));
}

/**
 * Reconcile cache with the data folder once a folder becomes available. Same
 * rule as worldview.syncToFolder (v0.2.25): the file in the connected folder is
 * the source of truth — if a relationships.json is present it wins; otherwise
 * the cache is promoted to a new file. Returns 'wrote' | 'adopted' | 'noop'.
 */
export async function syncToFolder() {
    if (!hasDataFolder()) return 'noop';

    const raw = await readFile(FILE);
    let disk = null;
    if (raw) { try { disk = JSON.parse(raw); } catch { disk = null; } }

    if (disk) {
        graph = normalize(disk);
        writeCache(graph);
        return 'adopted';
    }
    graph = normalize(readCache() || graph || defaultGraph());
    await save();
    return 'wrote';
}

// --- people / edges ---------------------------------------------------------

function meEdge(personId) {
    return ensureLoaded().edges.find((e) => e.from === ME && e.to === personId);
}

/** People joined with their relationship-to-the-user, for the editor + display. */
export function listPeople() {
    return ensureLoaded().people.map((p) => {
        const edge = meEdge(p.id);
        return {
            id: p.id,
            name: p.name,
            nickname: (p.attrs && p.attrs.nickname) || '',
            relationship: edge ? edge.type : '',
            about: (p.attrs && p.attrs.about) || '',
            livesWithMe: !!(p.attrs && p.attrs.livesWithMe),
            private: !!p.private
        };
    });
}

export function getPerson(id) {
    return listPeople().find((p) => p.id === id) || null;
}

export async function addPerson({ name, relationship = '', about = '', nickname = '', livesWithMe = false, isPrivate = false } = {}) {
    const g = ensureLoaded();
    const id = newId();
    g.people.push({
        id, name: (name || '').trim(), private: !!isPrivate,
        attrs: { about: (about || '').trim(), nickname: (nickname || '').trim(), livesWithMe: !!livesWithMe }
    });
    if ((relationship || '').trim()) {
        g.edges.push({ from: ME, to: id, type: relationship.trim(), attrs: {} });
    }
    await save();
    return id;
}

export async function updatePerson(id, { name, relationship, about, nickname, livesWithMe, isPrivate } = {}) {
    const g = ensureLoaded();
    const p = g.people.find((x) => x.id === id);
    if (!p) return;
    if (name !== undefined) p.name = (name || '').trim();
    if (about !== undefined) { p.attrs = p.attrs || {}; p.attrs.about = (about || '').trim(); }
    if (nickname !== undefined) { p.attrs = p.attrs || {}; p.attrs.nickname = (nickname || '').trim(); }
    if (livesWithMe !== undefined) { p.attrs = p.attrs || {}; p.attrs.livesWithMe = !!livesWithMe; }
    if (isPrivate !== undefined) p.private = !!isPrivate;
    if (relationship !== undefined) {
        const edge = meEdge(id);
        const t = (relationship || '').trim();
        if (edge) {
            if (t) edge.type = t;
            // Clearing the relationship must NOT drop the edge when it carries a
            // profile — "how I talk with this person" lives in its attrs, and
            // deleting the edge would silently destroy it while the user thinks
            // they only blanked a dropdown. Empty the type instead; an edge with
            // no type reads exactly like no edge everywhere else.
            else if (Object.keys(edge.attrs || {}).length) edge.type = '';
            else g.edges = g.edges.filter((e) => e !== edge);
        } else if (t) {
            g.edges.push({ from: ME, to: id, type: t, attrs: {} });
        }
    }
    await save();
}

export async function removePerson(id) {
    const g = ensureLoaded();
    g.people = g.people.filter((p) => p.id !== id);
    g.edges = g.edges.filter((e) => e.from !== id && e.to !== id);
    await save();
}

export async function resetAll() {
    const g = ensureLoaded();
    g.people = [];
    g.edges = [];
    await save();
}

export function count() {
    return ensureLoaded().people.length;
}

// --- per-partner profile (the me->person edge's attrs) ----------------------
//
// "How I talk with this person": register, a standing relationship goal, a free
// note, and this person's own conversation starters and closings. All of it lives
// on the me->person EDGE rather than the person node, because every one of these is
// a property of the RELATIONSHIP, not of them — how the user speaks to their
// brother is not a fact about the brother (Ken, August 5 2026).
//
// Four features were queued for this same edge; three are built here. The fourth,
// per-partner permission for coarse language, is deliberately NOT — it is blocked
// on the guardian-approval question, and until that is settled the prompt's blanket
// no-vulgarity rule stands (Ken, August 3 2026). The seam is this same object.

const PROFILE_KEYS = ['register', 'goal', 'note', 'openers', 'windDowns', 'closings'];

/**
 * The me->person edge, created on demand. A person can exist with no relationship
 * type set, in which case there is no edge yet — but they can still have a profile,
 * so writing one has to be able to make the edge.
 */
function ensureMeEdge(personId) {
    const g = ensureLoaded();
    let edge = meEdge(personId);
    if (!edge) {
        edge = { from: ME, to: personId, type: '', attrs: {} };
        g.edges.push(edge);
    }
    if (!edge.attrs) edge.attrs = {};
    return edge;
}

/** Everything on the edge, with empty defaults so callers need no guards. */
export function getPartnerProfile(personId) {
    const edge = meEdge(personId);
    const a = (edge && edge.attrs) || {};
    return {
        register: { ...(a.register || {}) },
        goal: a.goal ? { ...a.goal } : null,
        note: a.note || '',
        openers: Array.isArray(a.openers) ? a.openers.slice() : [],
        windDowns: Array.isArray(a.windDowns) ? a.windDowns.slice() : [],
        closings: Array.isArray(a.closings) ? a.closings.slice() : []
    };
}

/** Patch the edge's attrs; only the keys present are touched. */
export async function setPartnerProfile(personId, patch = {}) {
    const g = ensureLoaded();
    if (!g.people.some((p) => p.id === personId)) return;
    const edge = ensureMeEdge(personId);
    for (const key of PROFILE_KEYS) {
        if (patch[key] === undefined) continue;
        const v = patch[key];
        if (key === 'register') {
            // Drop neutral dimensions rather than storing them as empty strings, so
            // the stored shape says only what the user actually set.
            const reg = {};
            for (const [k, val] of Object.entries(v || {})) if (val) reg[k] = val;
            edge.attrs.register = reg;
        } else if (key === 'goal') {
            edge.attrs.goal = v && (v.id || v.text) ? { ...v } : null;
        } else if (key === 'note') {
            edge.attrs.note = (v || '').trim();
        } else {
            edge.attrs[key] = (Array.isArray(v) ? v : [])
                .map((s) => (s || '').trim())
                .filter(Boolean);
        }
    }
    await save();
}

/**
 * This person's own conversation phrases. These ADD to the global lists rather
 * than replacing them, and theirs come FIRST (Ken, August 7 2026) — so adding a
 * single starter for one person costs nothing and loses nothing: page 1 of the
 * palette shows theirs, and paging reaches the global set. Replacing would mean
 * authoring a full set per person or silently narrowing the palette.
 */
export function partnerPhrases(personId) {
    const p = getPartnerProfile(personId);
    return { openers: p.openers, windDowns: p.windDowns, closings: p.closings };
}

// --- LLM profile block ------------------------------------------------------

/**
 * Compact text for the generation system prompt — the relationship slice of
 * "speak AS this person." A private person IS described (v0.3.12 — withholding the
 * value entirely made Private identical to Declined), under an instruction not to
 * raise them on the AI's own initiative.
 *
 * That instruction names the two things which DO unlock one, and the naming is
 * load-bearing (Ken, August 3 2026): the AI's only output IS the response palette,
 * so "don't raise it unless the user picks a response that does" points at nothing —
 * if no card ever carries the fact there is nothing for the user to pick. The two
 * real prompts are (1) the PARTNER asks, and (2) the USER steers by typing in "In my
 * own words" and tapping Reframe. Nothing being spoken until the user taps it is a
 * separate, always-on guarantee about SELECTION — never a rule for authoring.
 */
export function buildBlock() {
    ensureLoaded();
    const people = listPeople();
    if (!people.length) return '';

    const facts = [];
    const privateKnown = [];   // AI knows these people but must not mention them spontaneously
    for (const p of people) {
        const displayName = p.name || p.relationship || 'someone';
        const nick = p.nickname ? ` (called "${p.nickname}")` : '';
        const relParts = [p.relationship, p.livesWithMe ? 'lives with me' : ''].filter(Boolean);
        const rel = relParts.length ? ` (${relParts.join(', ')})` : '';
        const about = p.about ? ` — ${p.about}` : '';
        const entry = `- ${displayName}${nick}${rel}${about}`;
        if (p.private) {
            privateKnown.push(entry);
        } else {
            facts.push(entry);
        }
    }

    if (!facts.length && !privateKnown.length) return '';
    const lines = ['People in my life:'];
    if (facts.length) lines.push(...facts);
    // Address people by their preferred term, not their given name (Ken: "when
    // I'm talking to my mother Mary, I always call her 'mom', not 'Mary'").
    if (people.some((p) => p.nickname)) {
        lines.push('When you refer to or address any of these people, ALWAYS use the name shown in quotes after "called" (their preferred term of address — e.g. "mom", "dad"), never their given name.');
    }
    if (privateKnown.length) {
        lines.push(
            'These people are known to you for context — do not bring them up unprompted. Never work one into a response on your own initiative. Include one ONLY when the partner has asked about them, or when the user\'s own typed guidance tells you to:',
            ...privateKnown
        );
    }
    return lines.join('\n');
}

/**
 * How the user talks with the person they are speaking to RIGHT NOW — emitted only
 * for the active partner, so it stays small and specific where buildBlock() above
 * is the standing list of everyone.
 *
 * Stated ASSERTIVELY, on Ken's decision (August 7 2026) to "take them at their
 * word" for a specific, well-known person. These are not hedged as self-reports;
 * hedging invites the model to discount them, and the user knows how they speak to
 * their own mother better than any inference we could make.
 *
 * THE GUARD IS THE LOAD-BEARING PART, and it is the August 5 2026 lesson applied
 * to a second kind of context. The place block had to be told that where you are is
 * the SETTING, not the subject, because a list of facts with no stated purpose
 * reads to a model as material to work in. A standing relationship goal is far more
 * dangerous that way: "Repair things between us" is a reason to choose warmer
 * wording, and would be a catastrophe read as an instruction to raise the subject
 * of repairing the relationship. So the purpose is stated before the content, and
 * again after it.
 */
export function buildPartnerBlock(personId, label = '') {
    ensureLoaded();
    const person = getPerson(personId);
    if (!person) return '';
    const name = (label || person.nickname || person.name || '').trim();
    if (!name) return '';

    const profile = getPartnerProfile(personId);
    const clauses = registerClauses(profile.register);
    const goal = goalText(profile.goal);
    const note = (profile.note || '').trim();
    if (!clauses.length && !goal && !note) return '';

    const lines = [`How this user speaks WITH ${name}. This shapes the WORDING of your suggestions only — none of it is a topic to raise.`];

    if (clauses.length) {
        lines.push(`Talking with ${name}, this user is ${clauses.join('; ')}. Match that, relative to how you would otherwise write for them.`);
    }
    if (goal) {
        lines.push(`Over time, what this user wants from their relationship with ${name} is: ${goal}. Let that steer which of several possible responses feels right — never mention it, and never suggest a response that is ABOUT it unless the partner raises it first.`);
    }
    if (note) {
        // The user's own words about the relationship, so they outrank the menu
        // above — the menu is five dimensions we chose, this is whatever they
        // actually wanted to say.
        lines.push(`In the user's own words about talking with ${name}: "${note}" Treat this as authoritative — it is the user's own description and it overrides the general guidance above where they conflict.`);
    }

    return lines.join('\n');
}
