// Builds the personalization blocks for a persona using the APP'S OWN builders.
// Read-only use of the project: imports modules, writes nothing there.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ROOT = 'C:/Users/ken/OneDrive/4 T-Z/Volksswitch/AI-driven AAC';
const u = (p) => pathToFileURL(ROOT + '/' + p).href;

const env = await import(u('tests/env.mjs'));
export { env };
export const llm = await import(u('app/js/llm.js'));
export const worldview = await import(u('app/js/worldview.js'));
export const relationships = await import(u('app/js/relationships.js'));
export const places = await import(u('app/js/places.js'));
export const voice = await import(u('app/js/voice.js'));
export const sc = await import(u('app/js/sound-check-items.js'));
export const harvestMod = await import(u('app/js/voice-harvest.js'));

const require = createRequire(import.meta.url);
export const { PERSONAS } = require(ROOT + '/scripts/doc-generators/persona-data.js');
const REGISTRY = JSON.parse(readFileSync(ROOT + '/app/data/worldview-questions.json', 'utf8'));
const FIELD = {};
for (const mod of REGISTRY.modules) for (const f of mod.fields) FIELD[f.key] = f;

// Same coercion as scripts/make-demo-import.mjs (copied, not imported: that script runs on import).
function coerce(key, raw) {
    const meta = FIELD[key];
    if (!meta) return null;
    if (meta.type === 'number') { const n = String(raw).match(/\d+/); return n ? Number(n[0]) : null; }
    if (meta.type === 'multi') return Array.isArray(raw) ? raw : [String(raw)];
    if (meta.type === 'choice') {
        const opts = meta.options || [];
        const hit = opts.find((o) => o.toLowerCase() === String(raw).trim().toLowerCase());
        return hit || null;
    }
    return typeof raw === 'string' ? raw : String(raw);
}

// Registry needs fetch of data/worldview-questions.json; route to disk once.
env.mockFetchFromDisk();
await worldview.loadRegistry();
env.restoreFetch();

export async function loadPersona(id) {
    const persona = PERSONAS.find((p) => p.id === id);
    if (!persona) throw new Error('no persona ' + id);
    // worldview
    const fields = {}; const skipped = [];
    for (const [key, raw] of Object.entries(persona.topics)) {
        const v = coerce(key, raw);
        if (v === null || v === '' || (Array.isArray(v) && !v.length)) { skipped.push(key); continue; }
        fields[key] = { value: v, state: 'answered', updated: '2026-09-01T00:00:00.000Z' };
    }
    localStorage.setItem('aac_worldview', JSON.stringify({ version: 1, updated: '2026-09-01T00:00:00.000Z', fields, privacy: {}, gaps: [], extras: [] }));
    await worldview.load();
    // relationships
    await relationships.resetAll();
    for (const p of persona.people) {
        await relationships.addPerson({ name: p.name === '(unnamed)' ? '' : p.name, relationship: p.relationship, about: p.about, nickname: p.nickname, livesWithMe: p.livesWithMe, isPrivate: p.private });
    }
    // places
    await places.resetAll();
    for (const pl of persona.places || []) {
        await places.addPlace({ name: pl.name, facts: pl.facts, isPrivate: pl.private });
    }
    return { persona, skipped };
}

export function soundCheckAnswers(persona) {
    const out = [];
    for (const [itemId, idx] of Object.entries(persona.soundCheck || {})) {
        const item = sc.getItem(itemId);
        if (!item) { out.push({ itemId, missing: true }); continue; }
        if (typeof idx === 'number') out.push({ itemId, choice: item.candidates[idx] });
    }
    return out;
}

// voice block: soundCheck (bool), exemplars (array or null). Uses voice.buildBlock.
export async function voiceBlock(persona, { soundCheck = false, exemplars = null } = {}) {
    localStorage.removeItem('aac_voice');
    await voice.resetAll();
    if (soundCheck) for (const a of soundCheckAnswers(persona)) if (a.choice) voice.recordAnswer(a.itemId, 'chose', a.choice);
    if (exemplars && exemplars.length) voice.setHarvest({ exemplars, lengthLean: null, counts: {} });
    return voice.buildBlock([]);
}

export function fullBlocks() {
    return {
        worldview: worldview.buildBlock(),
        relationships: relationships.buildBlock(),
        places: places.buildBlock(null),
        keys: worldview.fieldKeys(),
    };
}
