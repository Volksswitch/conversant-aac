// Render the real generateResponses system prompt for the test persona (Marc Delgado),
// using the app's own builders. READ-ONLY on the project. No real API call: fetch is
// stubbed and the request body is captured.
//
// Usage: node render.mjs [variant]
//   variant = base (default)      : Marc's data as shipped, Elena (Mom) active partner
//           = harvest             : same, but voice harvest run over the test conversations first (in memory only)
//           = noprofile           : nothing loaded (fixed prompt only), for baseline sizing
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/ken/OneDrive/4 T-Z/Volksswitch/AI-driven AAC';
const OUT = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm/prompt-assembly';
const TD = ROOT + '/test-data-folder';
const variant = process.argv[2] || 'base';
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

// Shared shims from the project's own test environment (window, document, localStorage, speechSynthesis).
const env = await imp('tests/env.mjs');

// fetch: route data/*.json to app/data, capture the Anthropic POST.
let captured = null;
globalThis.fetch = async (url, init) => {
    const m = String(url).match(/data\/([\w.-]+\.json)$/);
    if (m) {
        const text = readFileSync(path.join(ROOT, 'app/data', m[1]), 'utf8');
        return { ok: true, status: 200, async json() { return JSON.parse(text); }, async text() { return text; } };
    }
    if (String(url).includes('api.anthropic.com')) {
        captured = { url, body: JSON.parse(init.body), headers: Object.keys(init.headers || {}) };
        const reply = JSON.stringify({ partner_action: 'QUESTION', turn_status: 'COMPLETE', is_repair_initiator: false,
            offered_options: [], offered_range: null, responses: [], missing_facts: [], missing_other: [], heard_uncertain: [] });
        const data = { content: [{ type: 'text', text: reply }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' };
        return { ok: true, status: 200, async json() { return data; }, async text() { return JSON.stringify(data); } };
    }
    return { ok: false, status: 404, async json() { throw new Error('404'); }, async text() { return ''; } };
};

const read = (f) => readFileSync(path.join(TD, f), 'utf8');
if (variant !== 'noprofile') {
    localStorage.setItem('aac_worldview', read('worldview.json'));
    localStorage.setItem('aac_relationships', read('relationships.json'));
    localStorage.setItem('aac_places', read('places.json'));
    localStorage.setItem('aac_voice', read('voice.json'));
    localStorage.setItem('aac_express_items', read('express-panel.json'));
}

const worldview = await imp('app/js/worldview.js');
const relationships = await imp('app/js/relationships.js');
const places = await imp('app/js/places.js');
const voice = await imp('app/js/voice.js');
const expressPanel = await imp('app/js/express-panel.js');
const engine = await imp('app/js/engine.js');
const convLogic = await imp('app/js/conversation-logic.js');
const llm = await imp('app/js/llm.js');

await worldview.loadRegistry();
await worldview.load();
await relationships.load();
await places.load();
await voice.load();
await expressPanel.load();

if (variant === 'harvest') {
    const harvestMod = await imp('app/js/voice-harvest.js');
    const cp = await imp('app/js/control-phrases.js');
    const pp = await imp('app/js/placeholder-phrases.js');
    const dir = path.join(TD, 'conversations');
    const logs = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.review.json'))) {
        const data = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
        const rf = f.replace(/\.json$/, '.review.json');
        let review = null;
        try { review = JSON.parse(readFileSync(path.join(dir, rf), 'utf8')); } catch { /* none */ }
        logs.push({ id: f, data, review });
    }
    let controlList = [];
    try { controlList = [...cp.allPhrases(), ...pp.allPhrases()]; } catch (e) { console.error('phrase lists', e.message); }
    const result = harvestMod.harvest(logs, {
        controlPhrases: controlList,
        expressPhrases: expressPanel.allItems().filter((i) => i.type === 'phrase' && i.text).map((i) => i.text),
    });
    // In memory + localStorage shim only; storage has no data folder so nothing is written to disk.
    voice.setHarvest(result);
    writeFileSync(path.join(OUT, 'harvest-result.json'), JSON.stringify(result, null, 2));
}

// --- replicate app.js generateOptions setter block (app.js:2038-2045) ---
llm.setWorldviewKeys(worldview.fieldKeys());
llm.setApiKey('sk-ant-test-not-a-real-key-000000000000000000000');
const activePartner = variant === 'noprofile' ? null : { type: 'partner', name: 'Elena', personId: 'p-elena' };
const activePlace = null;
const activeFeeling = null;
llm.setWorldviewBlock(worldview.buildBlock());
llm.setExtraNames(worldview.extraNames());
llm.setRelationshipsBlock(relationships.buildBlock());
llm.setPlacesBlock(places.buildBlock(activePlace && activePlace.placeId));

// buildSituationBlock (app.js:4888) for: partner = Elena, no goals switched on, no feeling, no place.
function situation() {
    const lines = [];
    if (activePartner) {
        const label = relationships.displayName(activePartner.personId, activePartner.nickname || activePartner.name);
        if (label) lines.push(`You are currently talking with ${label} — ${label} is the person being spoken TO, not a topic to raise. When you address or refer to them, use "${label}".`);
        if (activePartner.personId) {
            const how = relationships.buildPartnerBlock(activePartner.personId, label);
            if (how) lines.push(how);
        }
    }
    return lines.join(' ');
}
llm.setSituationBlock(situation());

// voiceBlockText (app.js:4881)
const idiom = expressPanel.userAuthoredItems().filter((it) => it.type === 'phrase' && it.text).map((it) => it.text);
llm.setVoiceBlock(voice.buildBlock(idiom));

// Engine state for a fresh partner turn.
const partnerText = 'Hey Marc, how was your weekend?';
engine.partnerSpeaking(partnerText);
const ctx = engine.buildRequestContext();
const history = convLogic.historyForRequest([], partnerText, -1, "");

await llm.generateResponses(history, ctx, { reason: 'reprompt', perCategory: 1 });

if (!captured) { console.error('no request captured'); process.exit(1); }
const sys = captured.body.system;
const blocks = Array.isArray(sys) ? sys : [{ type: 'text', text: sys }];
const full = blocks.map((b) => b.text).join('');
const suffix = variant === 'base' ? '' : '-' + variant;
writeFileSync(path.join(OUT, `marc-prompt${suffix}.txt`),
    blocks.map((b, i) => `===== SYSTEM BLOCK ${i + 1}${b.cache_control ? ' (cache_control: ' + JSON.stringify(b.cache_control) + ')' : ''} — ${b.text.length} chars =====\n${b.text}`).join('\n\n')
    + `\n\n===== MESSAGES =====\n${JSON.stringify(captured.body.messages, null, 2)}\n`);
// Save the component blocks separately so sizing can be exact.
const parts = {
    voice: voice.buildBlock(idiom),
    worldview: worldview.buildBlock(),
    relationships: relationships.buildBlock(),
    places: places.buildBlock(null),
    situation: situation(),
    idiomCount: idiom.length,
    request: { model: captured.body.model, max_tokens: captured.body.max_tokens, thinking: captured.body.thinking,
        output_config: captured.body.output_config ? Object.keys(captured.body.output_config) : null,
        otherKeys: Object.keys(captured.body), blockCount: blocks.length,
        blockLens: blocks.map((b) => b.text.length), cache: blocks.map((b) => b.cache_control || null) },
    fullLen: full.length,
};
writeFileSync(path.join(OUT, `parts${suffix}.json`), JSON.stringify(parts, null, 2));
console.log(JSON.stringify(parts.request, null, 1));
console.log('full system chars', full.length, 'voice', parts.voice.length, 'worldview', parts.worldview.length,
    'relationships', parts.relationships.length, 'places', parts.places.length, 'situation', parts.situation.length, 'idiom', idiom.length);
