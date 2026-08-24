/* Express Panel — persistence model (June 26 2026; bands, August 23 2026)
 *
 * The user's editable panel content. Stored like the other user-owned data
 * (worldview.js, relationships.js):
 *   - <data folder>/express-panel.json   portable source of truth (FSA)
 *   - localStorage 'aac_express_items'    same-machine write-through cache
 * Reconciliation is the v0.2.25 rule: a file in the connected folder wins; the cache
 * is promoted to a new file only when none exists on disk yet.
 *
 * THE SHAPE CHANGED WITH BANDS. Version 1 was one flat ordered list mapped 1:1 onto
 * the cells of the keyboard layout. Version 2 is:
 *
 *   { version: 2, sizes: { shape, context, flex, contextRows, flexRows },
 *     always:  [ phrase, ... ],           the words that never move
 *     context: [ partner|place|feeling ], the buttons that never speak
 *     flex:    { "<partnerId>|<placeId>": [ phrase, ... ] } }
 *
 * ⚠ THE UPGRADE DISCARDS A VERSION-1 PANEL AND RESEEDS FROM THE SHIPPED DEFAULTS,
 * ONCE (Ken, August 23 2026). That is his decision and it is deliberate, not a gap:
 * the shipped set is being authored by the therapists, every tester is to start from
 * it, and merging a half-personalized flat list into three bands would leave people
 * with a panel that is neither theirs nor ours. It is announced in the release notes
 * because the panel visibly changes underneath somebody. Anything they do afterwards
 * is theirs and is never touched again.
 *
 * Editing is synchronous from the UI's perspective (the getters work off an in-memory
 * + localStorage copy); the file write is best-effort in the background, exactly like
 * worldview/relationships save().
 */

import { readFile, writeFile, hasDataFolder } from './storage.js';
import {
    ALWAYS_DEFAULTS, CONTEXT_DEFAULTS,
    ensureIds, ensureOrigin, markEdits, isUserAuthored,
} from './express-items.js';
import { DEFAULT_SIZES, SHAPE, CONTEXT_FLOOR, sortContext, flexKey } from './express-bands.js';

const FILE = 'express-panel.json';
const CACHE_KEY = 'aac_express_items';
const MODEL_VERSION = 2;

let model = null; // in-memory working copy

function defaults() {
    return {
        version: MODEL_VERSION,
        sizes: { ...DEFAULT_SIZES },
        always: ALWAYS_DEFAULTS.map((x) => ({ ...x })),
        context: CONTEXT_DEFAULTS.map((x) => ({ ...x })),
        flex: {},
    };
}

/** Coerce whatever was on disk into the current shape. */
function normalize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== MODEL_VERSION) {
        // Version 1 (a bare array, or { items: [...] }) — or nothing at all. Reseed.
        return d;
    }
    const sizes = raw.sizes || {};
    const flex = {};
    for (const [key, list] of Object.entries(raw.flex || {})) {
        if (!Array.isArray(list)) continue;
        flex[key] = ensureOrigin(ensureIds(list.filter((x) => x && x.type === 'phrase')));
    }
    return {
        version: MODEL_VERSION,
        sizes: {
            shape: sizes.shape === SHAPE.ROWS ? SHAPE.ROWS : SHAPE.COUNTS,
            context: Math.max(CONTEXT_FLOOR, num(sizes.context, DEFAULT_SIZES.context)),
            flex: Math.max(0, num(sizes.flex, DEFAULT_SIZES.flex)),
            contextRows: Math.max(1, num(sizes.contextRows, 1)),
            flexRows: Math.max(0, num(sizes.flexRows, 0)),
        },
        always: ensureOrigin(ensureIds(asList(raw.always))),
        context: sortContext(ensureOrigin(ensureIds(asList(raw.context)))),
        flex,
    };
}

function asList(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function num(v, fallback) { return Number.isFinite(+v) ? Math.round(+v) : fallback; }

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}
function writeCache(m) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(m)); } catch { /* quota — disk is truth */ }
}
function writeDisk(m) {
    // Best-effort; never blocks the UI. No-op without a data folder.
    writeFile(FILE, JSON.stringify({ ...m, updated: new Date().toISOString() }, null, 2))
        .catch(() => { /* disk write is best-effort */ });
}

/** Load: data folder (source of truth) → cache → defaults. */
export async function load() {
    let loaded = null;
    const raw = await readFile(FILE);
    if (raw) { try { loaded = JSON.parse(raw); } catch { loaded = null; } }
    if (!loaded) loaded = readCache();
    model = normalize(loaded);
    writeCache(model);
    return model;
}

/** Synchronous read for the renderer and the editor (returns a copy). */
export function getModel() {
    if (!model) model = normalize(readCache());
    return {
        version: model.version,
        sizes: { ...model.sizes },
        always: model.always.map((x) => ({ ...x })),
        context: model.context.map((x) => ({ ...x })),
        flex: Object.fromEntries(Object.entries(model.flex).map(([k, v]) => [k, v.map((x) => ({ ...x }))])),
    };
}

/**
 * Persist an edited model. Provenance is re-stamped by diffing against the model as
 * it was, so no editor path has to remember to do it (express-items.markEdits).
 */
export function setModel(next) {
    const prev = model || getModel();
    const n = normalize({ ...next, version: MODEL_VERSION });
    n.always = markEdits(n.always, prev.always);
    n.context = markEdits(n.context, prev.context);
    for (const key of Object.keys(n.flex)) {
        n.flex[key] = markEdits(n.flex[key], prev.flex[key] || []);
    }
    model = n;
    writeCache(model);
    writeDisk(model);
    return getModel();
}

/** Convenience for the editor: replace one band, leave the others alone. */
export function setBand(band, list) {
    const m = getModel();
    if (band === 'always') m.always = list;
    else if (band === 'context') m.context = sortContext(list);
    else return getModel();
    return setModel(m);
}

/** Convenience for the editor: replace one situational list. */
export function setFlexList(partnerId, placeId, list) {
    const m = getModel();
    const key = flexKey(partnerId, placeId);
    if (!list || !list.length) delete m.flex[key];
    else m.flex[key] = list;
    return setModel(m);
}

/**
 * Every item in every band, flattened. For counting and for anything that wants the
 * whole panel rather than one band - diagnostics, the voice block, an export summary.
 */
export function allItems() {
    const m = getModel();
    return [...m.always, ...m.context, ...Object.values(m.flex).flat()];
}

/** Every situation that has been given phrases, for the "what have I made?" list. */
export function flexSituations() {
    return Object.keys(getModel().flex);
}

/** Forget one situation — used when a person or place is deleted, and by the editor. */
export function removeFlexList(key) {
    const m = getModel();
    delete m.flex[key];
    return setModel(m);
}

/** Restore the shipped starting set for ONE band. Confirmed by the caller. */
export function resetBand(band) {
    const m = getModel();
    if (band === 'always') m.always = ALWAYS_DEFAULTS.map((x) => ({ ...x }));
    else if (band === 'context') m.context = CONTEXT_DEFAULTS.map((x) => ({ ...x }));
    return setModel(m);
}

/** Restore everything the app ships with. */
export function resetItems() {
    model = defaults();
    writeCache(model);
    writeDisk(model);
    return getModel();
}

/**
 * The phrases whose words are the USER's — the only ones that are evidence of how
 * they talk. Feeds the voice block (Sounds Like Me Phase 0), the catchphrase
 * redaction list, and the personalization-depth measure. Reads EVERY list, not just
 * the one showing: a phrase used only with one partner is exactly the kind of thing
 * that must never come out of the machine unprompted.
 */
export function userAuthoredItems() {
    const m = getModel();
    const all = [...m.always, ...m.context, ...Object.values(m.flex).flat()];
    return all.filter(isUserAuthored);
}

/**
 * Reconcile once a data folder becomes available (v0.2.25 rule): adopt an existing
 * express-panel.json, otherwise promote the cache to a new file.
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
    model = getModel();
    await writeFile(FILE, JSON.stringify({ ...model, updated: new Date().toISOString() }, null, 2));
    return 'wrote';
}
