// Disentangle NULLH->K0: exemplars-only vs lean-only, plus 3 more NULLH samples. Key never printed.
import { writeFileSync, readFileSync } from 'node:fs';
import * as L from '../exp-review/lib.mjs';
import { HELD_OUT } from '../exp-review/spec.mjs';
const key = L.env.loadApiKey(); if (!key) { console.error('no key'); process.exit(1); }
L.llm.setApiKey(key);
const usage = {}; L.llm.onUsage((u) => L.addUsage(usage, u));
const B = JSON.parse(readFileSync('blocks.json', 'utf8'));
const CTX = { stt_confidence: null, sequence_stack: [], register: 'ORDINARY', phase: 'BODY', last_user_utterance: null, user_holds_floor_to_lead: false };
function call(cond, turn, sample) {
  L.setStaticBlocks(turn.placeId || null); L.llm.setVoiceBlock(B[cond]); L.llm.setSituationBlock(L.situationFor(turn));
  return L.llm.generateResponses([{ role: 'partner', text: turn.text }], CTX, { perCategory: 1, reason: 'experiment' })
    .then((r) => ({ cond, turn: turn.id, sample, responses: r.responses }))
    .catch((e) => ({ cond, turn: turn.id, sample, error: String(e.message).slice(0, 200) }));
}
const plan = [];
for (const t of HELD_OUT) {
  for (let s = 3; s < 6; s++) plan.push(['NULLH', t, s]);
  for (let s = 0; s < 6; s++) { plan.push(['EXONLY', t, s]); plan.push(['LEANONLY', t, s]); }
}
const groups = {};
for (const p of plan) { const g = p[0] + '|' + (p[1].placeId || '-'); (groups[g] = groups[g] || []).push(p); }
const results = [];
for (const [g, ps] of Object.entries(groups)) {
  const [first, ...rest] = ps; results.push(await call(...first));
  let i = 0; await Promise.all(Array.from({ length: 4 }, async () => { while (i < rest.length) { const j = rest[i++]; results.push(await call(...j)); } }));
  console.log(g, ps.length, 'cost so far $' + L.costOf(usage).toFixed(3));
}
writeFileSync('gen.json', JSON.stringify({ usage, cost: L.costOf(usage), results }, null, 1));
console.log('total $' + L.costOf(usage).toFixed(3), 'errors', results.filter((r) => r.error).length);
