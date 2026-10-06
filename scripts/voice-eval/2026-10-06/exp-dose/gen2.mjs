// Follow-up conditions, Marc only (the persona the base conditions moved least):
//  C7 = C4 + a one-shot Reframe steer (opts.steer, the app's composer Reframe channel)
//  C8 = C4 + a measured length lean "shorter" in the harvest (what Conversation Review's
//       "closer card" answers and live card picks feed: voice-harvest measureLengthLean)
import * as B from './build.mjs';
import { CORPUS, TURNS } from './corpus.mjs';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('./gen-raw.jsonl', import.meta.url);
B.llm.setApiKey(B.env.loadApiKey());
let lastUsage = null; B.llm.onUsage((u) => { lastUsage = u; });
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function shuffle(arr, seed) { const a = arr.slice(); const r = seeded(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const personaId = 'marc-delgado';
const STEER = 'shorter and more casual. talk like a 17 year old';
const blocks = JSON.parse(readFileSync(new URL('./blocks.json', import.meta.url), 'utf8'));
const { persona } = await B.loadPersona(personaId);
const about = B.fullBlocks();
const ex12 = shuffle(CORPUS[personaId].pool, 11).slice(0, 12);
const ctx = (turn) => ({ stt_confidence: null, sequence_stack: [{ action: turn.action, opened_by: 'PARTNER', utterance: turn.text }], register: 'ORDINARY', phase: 'BODY', last_user_utterance: null, user_holds_floor_to_lead: false });
for (const cond of ['C7', 'C8']) {
    // voice block
    localStorage.removeItem('aac_voice'); await B.voice.resetAll();
    for (const a of B.soundCheckAnswers(persona)) if (a.choice) B.voice.recordAnswer(a.itemId, 'chose', a.choice);
    B.voice.setHarvest({ exemplars: ex12, lengthLean: cond === 'C8' ? { lean: 'shorter', shorter: 9, longer: 2, level: 1, total: 12 } : null, counts: {} });
    const vc = B.voice.buildBlock([]);
    blocks[`${personaId}|${cond}`] = { voice: vc, exemplarsShown: ex12, steer: cond === 'C7' ? STEER : null };
    B.llm.setWorldviewKeys(about.keys); B.llm.setExtraNames([]);
    B.llm.setWorldviewBlock(about.worldview); B.llm.setRelationshipsBlock(about.relationships); B.llm.setPlacesBlock(about.places);
    B.llm.setVoiceBlock(vc); B.llm.setSituationBlock('');
    for (const turn of TURNS) {
        lastUsage = null; const t0 = Date.now();
        const res = await B.llm.generateResponses([{ role: 'partner', text: turn.text }], ctx(turn), { reason: 'experiment', perCategory: 1, steer: cond === 'C7' ? STEER : undefined });
        const rec = { persona: personaId, cond, rep: 1, turn: turn.id, partner: turn.text, ms: Date.now() - t0, usage: lastUsage, classification: res.classification, responses: res.responses };
        appendFileSync(OUT, JSON.stringify(rec) + '\n');
        console.log(cond, turn.id, JSON.stringify(lastUsage), '|', res.responses.map((r) => r.slot[0] + '=' + r.text).join(' || '));
    }
}
writeFileSync(new URL('./blocks.json', import.meta.url), JSON.stringify(blocks, null, 2));
