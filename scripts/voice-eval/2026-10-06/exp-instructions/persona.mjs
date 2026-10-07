// Test A setup: a copy of exp-dose/build.mjs (persona About Me, How I Sound, example
// sentences) that finds the project root from its own location. Copied rather than
// imported because build.mjs names one machine's path. It also loads Marc's
// user-authored Express Panel phrases from the test data, which are the catchphrase
// list. Read-only on the project.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { ROOT, u } from './common.mjs';
import { CORPUS } from '../exp-dose/corpus.mjs';

export const env = await import(u('tests/env.mjs'));
export const llm = await import(u('app/js/llm.js'));
export const anthropic = (await import(u('app/js/suggest-anthropic.js'))).default;
export const worldview = await import(u('app/js/worldview.js'));
export const relationships = await import(u('app/js/relationships.js'));
export const places = await import(u('app/js/places.js'));
export const voice = await import(u('app/js/voice.js'));
export const sc = await import(u('app/js/sound-check-items.js'));
export const voiceHarvest = await import(u('app/js/voice-harvest.js'));
const expressPanel = await import(u('app/js/express-panel.js'));

const require = createRequire(import.meta.url);
export const { PERSONAS } = require(ROOT + '/scripts/doc-generators/persona-data.js');
const REGISTRY = JSON.parse(readFileSync(ROOT + '/app/data/worldview-questions.json', 'utf8'));
const FIELD = {};
for (const mod of REGISTRY.modules) for (const f of mod.fields) FIELD[f.key] = f;

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

localStorage.setItem('aac_express_items', readFileSync(ROOT + '/test-data-folder/express-panel.json', 'utf8'));
env.mockFetchFromDisk();
await worldview.loadRegistry();
await expressPanel.load();
env.restoreFetch();

// Marc's user-authored Express Panel phrases (the catchphrase list), from the test data.
export const CATCHPHRASES = expressPanel.userAuthoredItems().filter((it) => it.type === 'phrase' && it.text).map((it) => it.text);

export async function loadPersona(id) {
    const persona = PERSONAS.find((p) => p.id === id);
    if (!persona) throw new Error('no persona ' + id);
    const fields = {};
    for (const [key, raw] of Object.entries(persona.topics)) {
        const v = coerce(key, raw);
        if (v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
        fields[key] = { value: v, state: 'answered', updated: '2026-09-01T00:00:00.000Z' };
    }
    localStorage.setItem('aac_worldview', JSON.stringify({ version: 1, updated: '2026-09-01T00:00:00.000Z', fields, privacy: {}, gaps: [], extras: [] }));
    await worldview.load();
    await relationships.resetAll();
    for (const p of persona.people) {
        await relationships.addPerson({ name: p.name === '(unnamed)' ? '' : p.name, relationship: p.relationship, about: p.about, nickname: p.nickname, livesWithMe: p.livesWithMe, isPrivate: p.private });
    }
    await places.resetAll();
    for (const pl of persona.places || []) await places.addPlace({ name: pl.name, facts: pl.facts, isPrivate: pl.private });
    return persona;
}

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function shuffle(arr, seed) { const a = arr.slice(); const r = seeded(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// The C4 arrangement from exp-dose/gen.mjs: same seeds, first 12.
export function twelve(personaId) {
    return shuffle(CORPUS[personaId].pool, personaId === 'marc-delgado' ? 11 : 23).slice(0, 12);
}

export function soundCheckChoices(persona) {
    const out = [];
    for (const [itemId, idx] of Object.entries(persona.soundCheck || {})) {
        const item = sc.getItem(itemId);
        if (item && typeof idx === 'number') out.push({ itemId, choice: item.candidates[idx] });
    }
    return out;
}

// Builds the blocks exactly as gen.mjs does for C4: About Me + How I Sound + the 12
// sentences, voice.buildBlock([]) with no Express phrase list.
export async function c4Blocks(personaId) {
    const persona = await loadPersona(personaId);
    const ex12 = twelve(personaId);
    localStorage.removeItem('aac_voice');
    await voice.resetAll();
    const hs = soundCheckChoices(persona);
    for (const a of hs) voice.recordAnswer(a.itemId, 'chose', a.choice);
    voice.setHarvest({ exemplars: ex12, lengthLean: null, counts: {} });
    return {
        persona, ex12, howISound: hs.map((a) => a.choice),
        worldview: worldview.buildBlock(), relationships: relationships.buildBlock(), places: places.buildBlock(null),
        keys: worldview.fieldKeys(), voice: voice.buildBlock([]),
    };
}

export function setBlocks(b) {
    llm.setWorldviewKeys(b.keys);
    llm.setExtraNames([]);
    llm.setWorldviewBlock(b.worldview);
    llm.setRelationshipsBlock(b.relationships);
    llm.setPlacesBlock(b.places);
    llm.setVoiceBlock(b.voice);
    llm.setSituationBlock('');
}
