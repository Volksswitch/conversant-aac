// Offline: is the K=3 closer-only prompt byte-identical to K=0? (mock fetch, no API)
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
import { allConditions } from './conditions.mjs';
import { HELD_OUT, REVIEWS } from './spec.mjs';
L.llm.setApiKey('sk-ant-dummy-offline-not-a-real-key-0000000000');
const conds = await allConditions();
const out = {};
for (const name of ['K0', 'K3C', 'K1', 'K3', 'K10', 'MOM']) {
  const hashes = [];
  for (const t of HELD_OUT) {
    L.env.mockFetch(JSON.stringify({ responses: [] }));
    L.setStaticBlocks(t.placeId || null);
    L.llm.setVoiceBlock(conds[name].block);
    L.llm.setSituationBlock(L.situationFor(t));
    try { await L.llm.generateResponses([{ role: 'partner', text: t.text }], {}, {}); } catch {}
    const b = L.env.getFetchCalls()[0].body;
    const sys = b.system.map((x) => x.text).join('\n<<B>>\n');
    hashes.push(createHash('sha256').update(sys).digest('hex').slice(0, 12));
    if (name === 'K0' && t.id === 'H1-mom-test') writeFileSync('prompt-K0-H1.txt', sys);
    if (name === 'K10' && t.id === 'H1-mom-test') writeFileSync('prompt-K10-H1.txt', sys);
  }
  out[name] = hashes;
}
console.log(out);
console.log('K3C identical to K0 on all 8 turns:', out.K3C.every((h, i) => h === out.K0[i]));

// Ceiling for closer marks: mark EVERY card turn in all 17 conversations closer on the
// SHORTEST card that the user did not take. Does the lean sentence flip?
const convos = L.loadConversations();
let marks = 0;
for (const c of convos) {
  let review = L.reviewModel.emptyReview(c.id);
  for (const t of L.reviewModel.buildTurns(c.data)) {
    if (!t.user || t.cards.length < 2) continue;
    const cand = t.cards.map((x, i) => ({ i, n: x.text.split(/\s+/).length })).filter((x) => x.i !== t.took).sort((a, b) => a.n - b.n);
    if (!cand.length) continue;
    review = L.reviewModel.setCardAnswer(review, t, cand[0].i); marks++;
  }
  c.review = review;
}
const r = await L.voiceBlockFor(convos);
console.log('closer-everything marks:', marks, 'lean:', r.result.lengthLean, (r.block.match(/Offered a choice[^\n]*/) || ['(no lean sentence)'])[0]);
// And the LONGEST card everywhere
for (const c of convos) {
  let review = L.reviewModel.emptyReview(c.id);
  for (const t of L.reviewModel.buildTurns(c.data)) {
    if (!t.user || t.cards.length < 2) continue;
    const cand = t.cards.map((x, i) => ({ i, n: x.text.split(/\s+/).length })).filter((x) => x.i !== t.took).sort((a, b) => b.n - a.n);
    if (!cand.length) continue;
    review = L.reviewModel.setCardAnswer(review, t, cand[0].i);
  }
  c.review = review;
}
const r2 = await L.voiceBlockFor(convos);
console.log('closer-longest-everywhere lean:', r2.result.lengthLean);
