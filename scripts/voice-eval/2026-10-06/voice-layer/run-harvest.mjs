// Run the real voice harvest over test-data-folder, shaped the way
// storage.listConversationLogs() returns it ({ id, data, review }).
// Read-only on the project. Run from the project root.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const TD = resolve(ROOT, 'test-data-folder');
const OUTDIR = process.argv[2];

// Minimal browser globals so voice.js / storage.js can import (same shape as tests/env.mjs).
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
};
globalThis.window = globalThis.window || { SpeechRecognition: function () {} };

const mod = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const vh = await mod('app/js/voice-harvest.js');

// --- the logs, as listConversationLogs would build them ---
const dir = resolve(TD, 'conversations');
const names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.json'));
const reviews = new Map();
const logs = [];
for (const n of names) {
    const parsed = JSON.parse(readFileSync(resolve(dir, n), 'utf8'));
    if (n.toLowerCase().endsWith('.review.json')) reviews.set(n.slice(0, -'.review.json'.length), parsed);
    else logs.push({ id: n.slice(0, -5), data: parsed });
}
for (const c of logs) if (reviews.has(c.id)) c.review = reviews.get(c.id);
logs.sort((a, b) => a.id.localeCompare(b.id));

// --- classification lists, as voice-refresh.js builds them ---
const cp = JSON.parse(readFileSync(resolve(TD, 'control-phrases.json'), 'utf8'));
const ph = JSON.parse(readFileSync(resolve(TD, 'placeholders.json'), 'utf8'));
const ep = JSON.parse(readFileSync(resolve(TD, 'express-panel.json'), 'utf8'));
const strings = (o) => {
    const out = [];
    for (const [k, v] of Object.entries(o || {})) {
        if (k === 'seeded' || k === 'version' || k === 'updated') continue;
        if (typeof v === 'string') out.push(v);
        else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') out.push(x);
    }
    return out;
};
const controlPhrases = [...strings(cp), ...strings(ph)];
const allExpress = [...(ep.always || []), ...(ep.context || []), ...Object.values(ep.flex || {}).flat()];
const expressPhrases = allExpress.filter((i) => i && i.type === 'phrase' && i.text).map((i) => i.text);
const idiom = allExpress.filter((i) => i && i.type === 'phrase' && i.text && i.origin !== 'default').map((i) => i.text);

const opts = { controlPhrases, expressPhrases };
const result = vh.harvest(logs, opts);

const lines = [];
const log = (...a) => lines.push(a.join(' '));
log('conversations:', logs.length, ' reviewed:', logs.filter((c) => c.review).length);
log('control/placeholder phrases known:', controlPhrases.length, ' express phrases known:', expressPhrases.length, ' user-authored idiom:', idiom.length);
log('');
log('HARVEST RESULT');
log(JSON.stringify(result, null, 2));

// --- per-turn breakdown ---
let user = 0; const bySrc = {}; const composed = []; const cardTurns = [];
let offers = 0; const offerOutcomes = {}; let regenerate = 0;
const partnerOf = {};
for (const c of logs) {
    for (const e of c.data.exchanges || []) {
        if (e.role === 'offer') { offers++; offerOutcomes[e.outcome] = (offerOutcomes[e.outcome] || 0) + 1; }
        if (e.role !== 'user') continue;
        user++;
        const s = vh.classifyTurn(e, opts);
        bySrc[s] = (bySrc[s] || 0) + 1;
        const who = (e.partner && (e.partner.label || e.partner.name)) || '(none)';
        partnerOf[who] = (partnerOf[who] || 0) + 1;
        if (s === 'composed') composed.push({ id: c.id, who, words: e.selectedText.trim().split(/\s+/).length, text: e.selectedText });
        if (s === 'card') {
            const offered = (e.allOptions || []).map((o) => (typeof o === 'string' ? o : o && o.text) || '');
            const lens = offered.map((o) => o.split(/\s+/).filter(Boolean).length);
            cardTurns.push({ id: c.id, who, idx: e.selectedIndex, slot: e.selectedSlot, chosenWords: e.selectedText.split(/\s+/).filter(Boolean).length, offeredWords: lens });
        }
    }
}
log('');
log('user turns:', user, ' by source:', JSON.stringify(bySrc));
log('composed share:', (100 * (bySrc.composed || 0) / user).toFixed(1) + '%');
log('user turns by partner stamp:', JSON.stringify(partnerOf));
log('offers recorded:', offers, ' outcomes:', JSON.stringify(offerOutcomes));
log('');
log('COMPOSED TURNS (all, including too-short):');
for (const t of composed) log(`  [${t.id}] (${t.who}) ${t.words}w: "${t.text}"`);
log('');
log('CARD TURNS (chosen word count vs offered word counts):');
const slotCount = {};
for (const t of cardTurns) { slotCount[t.slot] = (slotCount[t.slot] || 0) + 1; log(`  [${t.id}] (${t.who}) idx=${t.idx} slot=${t.slot} chosen=${t.chosenWords} offered=${JSON.stringify(t.offeredWords)}`); }
log('selected slot distribution:', JSON.stringify(slotCount));

// --- review contributions ---
for (const c of logs.filter((x) => x.review)) {
    log('');
    log('REVIEW CONTRIBUTION', c.id, JSON.stringify(vh.reviewContributions(c.data, c.review)));
}

// --- the voice block the model actually receives, from the real voice.js ---
const voiceRaw = readFileSync(resolve(TD, 'voice.json'), 'utf8');
localStorage.setItem('aac_voice', voiceRaw);
const voice = await mod('app/js/voice.js');
voice.setHarvest(result);   // what refreshVoiceHarvest would store
log('');
log('repeatedSteers():', JSON.stringify(voice.repeatedSteers()));
log('activeExemplars():', JSON.stringify(voice.activeExemplars()));
const block = voice.buildBlock(idiom);
log('');
log('VOICE BLOCK (' + block.length + ' chars, ~' + Math.round(block.length / 4) + ' tokens):');
log(block);

// Also the block with harvest null (the state test-data ships in until the user
// presses "Read my conversations" or leaves a review).
voice.setHarvest(null);
const blockNoHarvest = voice.buildBlock(idiom);
log('');
log('VOICE BLOCK WITHOUT HARVEST (' + blockNoHarvest.length + ' chars) — differs from above only by harvest lines.');

const text = lines.join('\n');
console.log(text);
if (OUTDIR) writeFileSync(resolve(OUTDIR, 'harvest-output.txt'), text);
