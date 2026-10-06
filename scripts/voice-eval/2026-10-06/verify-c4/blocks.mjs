import { readFileSync, writeFileSync } from 'node:fs';
const EXP = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm/exp-review';
const { closerEverything } = await import('file:///' + EXP + '/conditions.mjs');
const cf = JSON.parse(readFileSync(EXP + '/conditions.json', 'utf8'));
const c50 = await closerEverything();
const blocks = { ...Object.fromEntries(Object.entries(cf.conds).map(([k, c]) => [k, c.block])), CLOSER50: c50.block };
const gen = JSON.parse(readFileSync(EXP + '/gen.json', 'utf8'));
// which block does each request carry?
const tally = {}; const mism = [];
for (const r of gen.requests) {
  const hits = Object.entries(blocks).filter(([k, b]) => r.sys.includes(b)).map(([k]) => k);
  const tagCond = r.tag.split('|')[0];
  const key = hits.join('+') || 'NONE';
  tally[key] = (tally[key] || 0) + 1;
  if (!hits.includes(tagCond)) mism.push({ tag: r.tag, hits });
}
console.log('requests', gen.requests.length, 'by block carried', tally);
console.log('tag/block mismatches', mism.length, mism.slice(0, 5));
// CLOSER50 block vs K0 block diff
const A = blocks.K0.split('\n'), B = blocks.CLOSER50.split('\n');
console.log('CLOSER50 removed:', A.filter((l) => !B.includes(l)));
console.log('CLOSER50 added:', B.filter((l) => !A.includes(l)));
console.log('CLOSER50 lean', JSON.stringify(c50.harvest.lengthLean), 'counts', JSON.stringify(c50.harvest.counts), 'exemplars', c50.harvest.exemplars.length);
console.log('K0 block:\n' + blocks.K0);
