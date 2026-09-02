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
 * ⚠ A SEED REVISION REPLACES THE ALWAYS BAND ONCE, AND NOTHING ELSE (Ken, August 25
 * 2026, for the therapists' set that landed September 2 2026). `seed` on the model
 * records which shipped Always set this panel started from; when it does not match the
 * current one, the Always band is replaced and the number stamped.
 *
 * ⚠ IT IS DELIBERATELY NOT A FULL RESEED, and bumping MODEL_VERSION instead would be
 * far too blunt: that path returns defaults() wholesale and would throw away the band
 * sizes, every Flex situational list, and the whole Context band - INCLUDING the
 * partner and place buttons that point at real people and places the user entered in
 * About Me and My Places, which can only be re-added by walking the picker again.
 * The Context band is refreshed only when the user has never touched it (every item
 * still ours), so nobody's own feelings are overwritten to change one of ours.
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
    ALWAYS_DEFAULTS, CONTEXT_DEFAULTS, SEED_REVISION,
    ensureIds, ensureOrigin, markEdits, isUserAuthored, ORIGIN,
} from './express-items.js';
import { DEFAULT_SIZES, SHAPE, CONTEXT_FLOOR, sortContext, flexKey } from './express-bands.js';

const FILE = 'express-panel.json';
const CACHE_KEY = 'aac_express_items';
const MODEL_VERSION = 2;

let model = null; // in-memory working copy

function defaults() {
    return {
        version: MODEL_VERSION,
        seed: SEED_REVISION,
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
    // The one-shot seed revision. A panel that started from an older shipped Always
    // set takes the current one; the Context band comes with it ONLY if the user has
    // never touched it. Everything else - sizes, Flex lists, a Context band with any
    // of the user's own buttons in it - is left exactly as they had it.
    const stale = num(raw.seed, 0) !== SEED_REVISION;
    // ⚠ Judge "untouched" AFTER stamping provenance, not before. A file written before
    // the origin field existed carries none at all, and a bare `!x.origin` would read
    // a partner button the user added as ours and throw it away - which is precisely
    // the loss this narrow rule exists to avoid.
    const rawContext = ensureOrigin(ensureIds(asList(raw.context)));
    const contextUntouched = rawContext.every((x) => x.origin === ORIGIN.DEFAULT);

    return {
        version: MODEL_VERSION,
        seed: SEED_REVISION,
        sizes: {
            // An absent shape means a file written before rows became the default, so
            // it keeps counts; only an explicit 'rows' switches.
            shape: sizes.shape === SHAPE.ROWS ? SHAPE.ROWS : SHAPE.COUNTS,
            context: Math.max(CONTEXT_FLOOR, num(sizes.context, DEFAULT_SIZES.context)),
            flex: Math.max(0, num(sizes.flex, DEFAULT_SIZES.flex)),
            contextRows: Math.max(1, num(sizes.contextRows, DEFAULT_SIZES.contextRows)),
            flexRows: Math.max(0, num(sizes.flexRows, DEFAULT_SIZES.flexRows)),
        },
        always: stale ? d.always : ensureOrigin(ensureIds(asList(raw.always))),
        context: stale && contextUntouched
            ? d.context
            : sortContext(rawContext),
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
        // ⚠ seed MUST be carried out and back in. setModel normalizes what it is
        // handed, so a getModel/setModel round trip that dropped it would look like a
        // panel that had never been seeded and would replace the Always band on the
        // user's very next edit - silently, and every time.
        seed: model.seed,
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
    const n = normalize({ ...next, version: MODEL_VERSION, seed: SEED_REVISION });
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
