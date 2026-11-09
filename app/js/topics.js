/*
 * MY TOPICS — subjects the user takes questions on (Ken, November 9 2026).
 *
 * "These topic-focused conversations warrant their own dimension - topic. This
 * information is actually independent of place and has few of the properties
 * associated with a place... there's no address and GPS will never be applicable. I can
 * talk about Conversant at a conference, in a Zoom call, with a colleague."
 *
 * A topic is switched on from its button in the Context band, beside the partner,
 * place and feeling buttons. While it is on, each question the app hears gets four
 * answers drawn from the topic's documents (question sessions; see app.js
 * generateTalkAnswers and question-session.js). It switches off at End conversation,
 * like a partner: forgetting to switch it back on costs one tap, while forgetting to
 * switch it off would give the next conversation four paragraph answers to "How was
 * your weekend?".
 *
 *   { id, name, pronunciation, sources: [source-material ids], note }
 *
 *   sources  documents in the shared source-material folder, in the order chosen. A
 *            document is kept once, so replacing it reaches every topic using it.
 *   note     how the user relates to the material, in their words (rule 10 of the
 *            prompt: who "I" is). Blank means the user is NOT one of the people the
 *            material describes.
 *
 * "Talking about it" (everyday conversation drawing on the user's writing) is a
 * separate future project, not a mode of a topic (TODO.md).
 *
 * Same storage arrangement as places.js: topics.json in the data folder is the truth,
 * a localStorage copy for when there is no folder, and a file in the folder wins.
 */

import { readFile, readPortableFile, writeFile, hasDataFolder } from './storage.js';

const FILE = 'topics.json';
const CACHE_KEY = 'aac_topics';

// The note goes to the AI as though the user wrote it, so it is limited where it
// ENTERS: a file from elsewhere must not be able to send pages of it.
export const NOTE_MAX = 1000;
// A topic draws on at most this many documents. Each is up to ~65,000 words, and they
// are all sent with every question.
export const SOURCES_MAX = 20;

let model = null;

function defaultModel() {
    return { version: 1, updated: new Date().toISOString(), topics: [] };
}

// ⚠ A WHITELIST, like places.js normalizePlace: a field left out here is dropped on the
// next load with nothing saying so. Add every new field here in the same change.
function normalizeTopic(t) {
    return {
        id: t.id,
        name: String(t.name ?? '').trim(),
        pronunciation: String(t.pronunciation ?? '').trim(),
        sources: [...new Set((Array.isArray(t.sources) ? t.sources : [])
            .filter((x) => typeof x === 'string' && x))].slice(0, SOURCES_MAX),
        note: String(t.note ?? '').trim().slice(0, NOTE_MAX),
    };
}

function normalize(m) {
    const base = defaultModel();
    return {
        version: m.version ?? base.version,
        updated: m.updated ?? base.updated,
        topics: (Array.isArray(m.topics) ? m.topics : []).filter((t) => t && t.id).map(normalizeTopic),
    };
}

function newId() {
    return 'tp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

function writeCache(m) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(m)); } catch { /* quota - disk is truth */ }
}

/** Load: data folder (source of truth) -> cache -> empty. */
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

/** A topics.json in the connected folder wins; otherwise the cache is promoted. */
export async function syncToFolder() {
    if (!hasDataFolder()) return 'noop';
    const got = await readPortableFile(FILE);
    if (got.state === 'unreadable') return 'noop';   // never overwrite what could not be read
    if (got.data) {
        model = normalize(got.data);
        writeCache(model);
        return 'adopted';
    }
    model = normalize(readCache() || model || defaultModel());
    await save();
    return 'wrote';
}

export function listTopics() {
    return ensureLoaded().topics.map((t) => ({ ...t, sources: [...t.sources] }));
}

export function getTopic(id) {
    return listTopics().find((t) => t.id === id) || null;
}

export function count() {
    return ensureLoaded().topics.length;
}

export async function addTopic({ name = '', pronunciation = '', sources = [], note = '' } = {}) {
    const m = ensureLoaded();
    const t = normalizeTopic({ id: newId(), name, pronunciation, sources, note });
    m.topics.push(t);
    await save();
    return t.id;
}

export async function updateTopic(id, { name, pronunciation, sources, note } = {}) {
    const m = ensureLoaded();
    const i = m.topics.findIndex((x) => x.id === id);
    if (i < 0) return;
    const cur = m.topics[i];
    m.topics[i] = normalizeTopic({
        ...cur,
        ...(name !== undefined ? { name: String(name).trim() || cur.name } : {}),
        ...(pronunciation !== undefined ? { pronunciation } : {}),
        ...(sources !== undefined ? { sources } : {}),
        ...(note !== undefined ? { note } : {}),
    });
    await save();
}

export async function removeTopic(id) {
    const m = ensureLoaded();
    m.topics = m.topics.filter((t) => t.id !== id);
    await save();
}

export async function resetAll() {
    model = defaultModel();
    await save();
}

/** Remove a deleted document from every topic that points to it. */
export async function forgetSource(sourceId) {
    const m = ensureLoaded();
    let changed = false;
    for (const t of m.topics) {
        if (t.sources.includes(sourceId)) {
            t.sources = t.sources.filter((x) => x !== sourceId);
            changed = true;
        }
    }
    if (changed) await save();
    return changed;
}
