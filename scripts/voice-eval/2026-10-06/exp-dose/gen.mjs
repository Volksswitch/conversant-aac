// Generation phase: calls the APP's own llm.generateResponses (real prompt, real model
// claude-sonnet-5-5 via app/js/suggest-anthropic.js). Appends one JSON line per call.
import * as B from './build.mjs';
import { CORPUS, TURNS } from './corpus.mjs';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('./gen-raw.jsonl', import.meta.url);
const BLOCKS_OUT = new URL('./blocks.json', import.meta.url);
const KEY = B.env.loadApiKey();
if (!KEY) throw new Error('no key');
B.llm.setApiKey(KEY);            // never printed

let lastUsage = null;
const totals = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, calls: 0 };
B.llm.onUsage((u) => { lastUsage = u; totals.input += u.input; totals.output += u.output; totals.cacheWrite += u.cacheWrite; totals.cacheRead += u.cacheRead; totals.calls++; });

// deterministic shuffle
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function shuffle(arr, seed) { const a = arr.slice(); const r = seeded(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const PLAN = [
    { cond: 'C0', reps: 2 },
    { cond: 'C1', reps: 2 },
    { cond: 'C2', reps: 1 },
    { cond: 'C3', reps: 1 },
    { cond: 'C4', reps: 2 },
    { cond: 'C5', reps: 1 },
    { cond: 'C6', reps: 1 },
];

const done = new Set();
if (existsSync(OUT)) for (const line of readFileSync(OUT, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line); if (!r.error) done.add(`${r.persona}|${r.cond}|${r.rep}|${r.turn}`);
}

const blocksRecord = existsSync(BLOCKS_OUT) ? JSON.parse(readFileSync(BLOCKS_OUT, 'utf8')) : {};

async function blocksFor(personaId, cond) {
    const { persona } = await B.loadPersona(personaId);
    const about = B.fullBlocks();
    const order = shuffle(CORPUS[personaId].pool, personaId === 'marc-delgado' ? 11 : 23);
    const ex4 = order.slice(0, 4), ex12 = order.slice(0, 12), ex30 = order;
    let wv = '', rel = '', pl = '', vc = '', exemplarsShown = [];
    if (cond !== 'C0') { wv = about.worldview; rel = about.relationships; pl = about.places; }
    if (cond === 'C2') vc = await B.voiceBlock(persona, { soundCheck: true });
    if (cond === 'C3') { vc = await B.voiceBlock(persona, { soundCheck: true, exemplars: ex4 }); exemplarsShown = ex4; }
    if (cond === 'C4') { vc = await B.voiceBlock(persona, { soundCheck: true, exemplars: ex12 }); exemplarsShown = ex12; }
    if (cond === 'C5') { vc = await B.voiceBlock(persona, { soundCheck: false, exemplars: ex12 }); exemplarsShown = ex12; }
    if (cond === 'C6') {
        // HAND-CONSTRUCTED: voice.buildBlock caps harvested exemplars at 12 (voice.js
        // `harvested.slice(0, 12)`). Build the 12-exemplar block, then insert the other
        // 18 lines in the same format directly after the 12th.
        vc = await B.voiceBlock(persona, { soundCheck: true, exemplars: ex12 });
        const lines = vc.split('\n');
        const lastIdx = lines.findIndex((l) => l === `  "${ex12[11]}"`);
        if (lastIdx < 0) throw new Error('could not find 12th exemplar line');
        lines.splice(lastIdx + 1, 0, ...ex30.slice(12).map((t) => `  "${t}"`));
        vc = lines.join('\n');
        exemplarsShown = ex30;
    }
    return { worldview: wv, relationships: rel, places: pl, voice: vc, keys: about.keys, exemplarsShown, persona };
}

function context(turn) {
    return {
        stt_confidence: null,
        sequence_stack: [{ action: turn.action, opened_by: 'PARTNER', utterance: turn.text }],
        register: 'ORDINARY', phase: 'BODY', last_user_utterance: null, user_holds_floor_to_lead: false,
    };
}

for (const personaId of ['marc-delgado', 'grace-thompson']) {
    for (const { cond, reps } of PLAN) {
        const b = await blocksFor(personaId, cond);
        blocksRecord[`${personaId}|${cond}`] = { worldviewChars: b.worldview.length, relationshipsChars: b.relationships.length, placesChars: b.places.length, voice: b.voice, exemplarsShown: b.exemplarsShown };
        writeFileSync(BLOCKS_OUT, JSON.stringify(blocksRecord, null, 2));
        B.llm.setWorldviewKeys(b.keys);
        B.llm.setExtraNames([]);
        B.llm.setWorldviewBlock(b.worldview);
        B.llm.setRelationshipsBlock(b.relationships);
        B.llm.setPlacesBlock(b.places);
        B.llm.setVoiceBlock(b.voice);
        B.llm.setSituationBlock('');
        for (let rep = 1; rep <= reps; rep++) {
            for (const turn of TURNS) {
                const k = `${personaId}|${cond}|${rep}|${turn.id}`;
                if (done.has(k)) continue;
                let attempt = 0;
                while (true) {
                    attempt++;
                    lastUsage = null;
                    const t0 = Date.now();
                    try {
                        const res = await B.llm.generateResponses([{ role: 'partner', text: turn.text }], context(turn), { reason: 'experiment', perCategory: 1 });
                        const rec = { persona: personaId, cond, rep, turn: turn.id, partner: turn.text, ms: Date.now() - t0, usage: lastUsage,
                            classification: res.classification, responses: res.responses };
                        appendFileSync(OUT, JSON.stringify(rec) + '\n');
                        console.log(k, 'ok', rec.ms + 'ms', JSON.stringify(lastUsage), '|', (res.responses.find((r) => r.slot === 'PREFERRED') || res.responses[0] || {}).text);
                        break;
                    } catch (err) {
                        console.log(k, 'ERR', attempt, String(err.message).slice(0, 200));
                        if (attempt >= 3) { appendFileSync(OUT, JSON.stringify({ persona: personaId, cond, rep, turn: turn.id, error: String(err.message).slice(0, 500), usage: lastUsage }) + '\n'); break; }
                        await new Promise((r) => setTimeout(r, 3000 * attempt));
                    }
                }
            }
        }
    }
}
console.log('TOTALS', JSON.stringify(totals));
writeFileSync(new URL('./gen-usage-totals.json', import.meta.url), JSON.stringify(totals, null, 2));
