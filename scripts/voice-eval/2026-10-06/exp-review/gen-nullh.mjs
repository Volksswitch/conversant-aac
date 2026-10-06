// Extra condition NULLH: voice.json exactly as shipped (harvest: null) - i.e. the state
// BEFORE the app ever harvests. In the app, leaving a review is what first triggers the
// harvest, so NULLH -> K0 is the change the first review exit causes regardless of answers.
import { writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
import { HELD_OUT } from './spec.mjs';
L.llm.setApiKey(L.env.loadApiKey());
const usage = {}; L.llm.onUsage((u) => L.addUsage(usage, u));
const block = await L.voiceBlockNullHarvest();
const CTX = { stt_confidence: null, sequence_stack: [], register: 'ORDINARY', phase: 'BODY', last_user_utterance: null, user_holds_floor_to_lead: false };
function call(turn, sample) {
  L.setStaticBlocks(turn.placeId || null); L.llm.setVoiceBlock(block); L.llm.setSituationBlock(L.situationFor(turn));
  return L.llm.generateResponses([{ role: 'partner', text: turn.text }], CTX, { perCategory: 1, reason: 'experiment' })
    .then((r) => ({ cond: 'NULLH', turn: turn.id, sample, responses: r.responses }))
    .catch((e) => ({ cond: 'NULLH', turn: turn.id, sample, error: String(e.message).slice(0, 200) }));
}
const groups = {};
for (const t of HELD_OUT) for (let s = 0; s < 3; s++) (groups[t.placeId || '-'] = groups[t.placeId || '-'] || []).push([t, s]);
const results = [];
for (const g of Object.values(groups)) {
  const [first, ...rest] = g; results.push(await call(...first));
  let i = 0; await Promise.all(Array.from({ length: 4 }, async () => { while (i < rest.length) { const j = rest[i++]; results.push(await call(...j)); } }));
}
writeFileSync('gen-nullh.json', JSON.stringify({ block, usage, cost: L.costOf(usage), results }, null, 1));
console.log('cost $' + L.costOf(usage).toFixed(4), 'errors', results.filter((r) => r.error).length);
