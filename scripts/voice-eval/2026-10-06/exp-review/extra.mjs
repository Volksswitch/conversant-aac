import { readFileSync, writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
const gen = JSON.parse(readFileSync('gen.json', 'utf8'));
const judge = JSON.parse(readFileSync('judge.json', 'utf8'));
// 1. judge position bias among non-identical voice comparisons
const vs = judge.comparisons.filter((c) => !c.identical && c.v && c.v.length === 2);
const pat = {}; for (const c of vs) { const k = c.v.join(''); pat[k] = (pat[k] || 0) + 1; }
console.log('verdict patterns (order1,order2) over', vs.length, 'pairs:', pat);
// 2. content leakage: specific items from review exemplars appearing in outputs
const items = ['rainbow road', 'warmed up', 'run it back', 'small child', 'third paragraph', 'granola', 'voice chat', 'keep the change', 'we don\'t bite', 'with a c', 'bugging me', 'mornings', 'clutch', 'blue shell', 'prepare to lose', 'nice try', 'mario kart', 'among us', 'packers', 'biscuit', 'promise', 'means a lot'];
const tab = {};
for (const r of gen.results.filter((r) => !r.error)) {
  const txt = r.responses.map((x) => x.text.toLowerCase()).join(' | ');
  const t = tab[r.cond] = tab[r.cond] || { gens: 0 };
  t.gens++;
  for (const it of items) if (txt.includes(it)) t[it] = (t[it] || 0) + 1;
}
console.log('item mentions (generations containing item):', JSON.stringify(tab, null, 1));
// 3. length-lean confound: which slots were the live "longer" selections?
const convos = L.loadConversations();
const opts = L.harvestOpts();
const slotTally = { shorter: {}, longer: {}, level: {} };
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
for (const c of convos) for (const t of c.data.exchanges) {
  if (t.role !== 'user' || L.voiceHarvest.classifyTurn(t, opts) !== 'card') continue;
  const offered = (t.allOptions || []).filter(Boolean); if (offered.length < 2) continue;
  const lens = offered.map((o) => words(o).length).sort((a, b) => a - b);
  const mid = lens.length % 2 ? lens[(lens.length - 1) / 2] : (lens[lens.length / 2 - 1] + lens[lens.length / 2]) / 2;
  const n = words(t.selectedText).length;
  const k = n < mid ? 'shorter' : n > mid ? 'longer' : 'level';
  const s = t.selectedSlot || '?'; slotTally[k][s] = (slotTally[k][s] || 0) + 1;
}
console.log('live selections by lean bucket x slot:', JSON.stringify(slotTally));
// 4. token share of voice block
const cf = JSON.parse(readFileSync('conditions.json', 'utf8'));
const p = readFileSync('prompt-K0-H1.txt', 'utf8');
console.log('prompt chars', p.length, 'voice block chars K0', cf.conds.K0.block.length, 'K10', cf.conds.K10.block.length);
// 5. CLOSER50 block lean sentence
writeFileSync('extra.json', JSON.stringify({ pat, tab, slotTally }, null, 1));
