// Test B setup: a copy of exp-review/lib.mjs that finds the project root from its own
// location (lib.mjs names one machine's path). Otherwise unchanged.
// Shared setup for the review-pipeline experiment. Loads Marc Delgado's data folder
// into the app's own modules the way the app would (cache -> load), with the test
// env shims. READ-ONLY on the project: files are only read.
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// exp-rewrite-review -> 2026-10-06 -> voice-eval -> scripts -> project root
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..').split(String.fromCharCode(92)).join('/');
const u = (p) => pathToFileURL(ROOT + '/' + p).href;

export const env = await import(u('tests/env.mjs'));
const DATA = ROOT + '/test-data-folder';
const seed = (key, file) => localStorage.setItem(key, readFileSync(`${DATA}/${file}`, 'utf8'));
seed('aac_worldview', 'worldview.json');
seed('aac_relationships', 'relationships.json');
seed('aac_places', 'places.json');
seed('aac_express_items', 'express-panel.json');
seed('aac_voice', 'voice.json');
seed('aac_control_phrases', 'control-phrases.json');
seed('aac_placeholders', 'placeholders.json');

export const worldview = await import(u('app/js/worldview.js'));
export const relationships = await import(u('app/js/relationships.js'));
export const places = await import(u('app/js/places.js'));
export const expressPanel = await import(u('app/js/express-panel.js'));
export const voice = await import(u('app/js/voice.js'));
export const voiceHarvest = await import(u('app/js/voice-harvest.js'));
export const reviewModel = await import(u('app/js/review-model.js'));
export const controlPhrases = await import(u('app/js/control-phrases.js'));
export const placeholderPhrases = await import(u('app/js/placeholder-phrases.js'));
export const llm = await import(u('app/js/llm.js'));
export const anthropic = (await import(u('app/js/suggest-anthropic.js'))).default;

env.mockFetchFromDisk();
await worldview.loadRegistry();
await worldview.load();
await relationships.load();
await places.load();
await expressPanel.load();
await voice.load();
if (controlPhrases.load) await controlPhrases.load();
if (placeholderPhrases.load) await placeholderPhrases.load();
env.restoreFetch();

// Pristine voice profile as shipped in the test folder (harvest: null).
export const VOICE_JSON = JSON.parse(readFileSync(`${DATA}/voice.json`, 'utf8'));

export function loadConversations() {
    const dir = DATA + '/conversations';
    return readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.review.json')).sort()
        .map((f) => ({ id: f.replace(/\.json$/, ''), data: JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')), review: null }));
}

export function harvestOpts() {
    return {
        controlPhrases: [...controlPhrases.allPhrases(), ...placeholderPhrases.allPhrases()],
        expressPhrases: expressPanel.allItems().filter((i) => i.type === 'phrase' && i.text).map((i) => i.text),
    };
}

export function idiom() {
    return expressPanel.userAuthoredItems().filter((it) => it.type === 'phrase' && it.text).map((it) => it.text);
}

// Runs the app's own harvest over { id, data, review } entries and returns the voice
// block the app would send. Resets the voice profile to the shipped voice.json first
// so conditions do not leak into each other.
export function voiceBlockFor(convos) {
    localStorage.setItem('aac_voice', JSON.stringify(VOICE_JSON));
    // voice.js caches `profile` in module scope; load() re-reads the cache.
    return voice.load().then(() => {
        const result = voiceHarvest.harvest(convos, harvestOpts());
        voice.setHarvest(result);
        return { result, block: voice.buildBlock(idiom()) };
    });
}

export async function voiceBlockNullHarvest() {
    localStorage.setItem('aac_voice', JSON.stringify(VOICE_JSON));
    await voice.load();
    return voice.buildBlock(idiom());
}

// Replicates app.js buildSituationBlock() (app.js:4888) for partner + place, no goals,
// no feeling, not practice.
export function situationFor({ personId = null, placeId = null } = {}) {
    const lines = [];
    if (personId) {
        const label = relationships.displayName(personId, '');
        if (label) lines.push(`You are currently talking with ${label} — ${label} is the person being spoken TO, not a topic to raise. When you address or refer to them, use "${label}".`);
        const how = relationships.buildPartnerBlock(personId, label);
        if (how) lines.push(how);
    }
    if (placeId) {
        const here = places.buildHereBlock(placeId);
        if (here) lines.push(here);
    }
    return lines.join(' ');
}

export function setStaticBlocks(placeId = null) {
    llm.setWorldviewKeys(worldview.fieldKeys());
    llm.setWorldviewBlock(worldview.buildBlock());
    llm.setExtraNames(worldview.extraNames());
    llm.setRelationshipsBlock(relationships.buildBlock());
    llm.setPlacesBlock(places.buildBlock(placeId));
}

// Pricing from app/data/pricing.json
export const PRICING = JSON.parse(readFileSync(ROOT + '/app/data/pricing.json', 'utf8'));
export function costOf(u) {
    const i = PRICING.inputCostPerMillionTokens / 1e6, o = PRICING.outputCostPerMillionTokens / 1e6;
    return (u.input || 0) * i + (u.output || 0) * o
        + (u.cacheWrite || 0) * i * PRICING.cacheWriteMultiplier + (u.cacheRead || 0) * i * PRICING.cacheReadMultiplier;
}
export function addUsage(acc, u) {
    for (const k of ['input', 'output', 'cacheWrite', 'cacheRead']) acc[k] = (acc[k] || 0) + (u[k] || 0);
    acc.calls = (acc.calls || 0) + 1;
    return acc;
}
