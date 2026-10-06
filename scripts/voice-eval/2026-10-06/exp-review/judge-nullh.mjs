// K0 (live harvest present) vs NULLH (harvest null), PREFERRED only, both orders.
import { readFileSync, writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
import { REFERENCE, HELD_OUT } from './spec.mjs';
L.llm.setApiKey(L.env.loadApiKey());
const usage = {};
const gen = JSON.parse(readFileSync('gen.json', 'utf8')); const gn = JSON.parse(readFileSync('gen-nullh.json', 'utf8'));
const R = {}; for (const r of [...gen.results, ...gn.results]) R[`${r.cond}|${r.turn}|${r.sample}`] = r;
const pref = (r) => (r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0]).text;
const SYS = `You compare two candidates in a voice-matching study. A non-speaking 17-year-old named Marc uses a device that suggests what he might say next. You get lines Marc has really said in other situations (his voice reference), the situation, and two candidates. Decide which candidate sounds more like Marc. Judge ONLY voice: word choice, length, rhythm, formality, attitude and humor. Ignore which is more polite, more correct or more helpful, and do not reward copying words from the reference. Reply with exactly one character: A, B, or T (T only if they are equally like him).`;
async function ask(t, a, b) {
  const msg = `Marc's voice reference (lines he has said elsewhere):\n${REFERENCE.map((x) => `- ${x}`).join('\n')}\n\nSituation: Marc is talking with ${t.who}. They just said: "${t.text}"\n\nCandidate A: "${a}"\nCandidate B: "${b}"\n\nWhich sounds more like Marc? Answer A, B, or T.`;
  const { text, usage: u } = await L.anthropic.complete({ system: SYS, messages: [{ role: 'user', content: msg }], maxTokens: 400 });
  L.addUsage(usage, u); const m = String(text || '').trim().toUpperCase().match(/[ABT]/); return m ? m[0] : '?';
}
const comps = [];
const jobs = [];
for (const t of HELD_OUT) for (let k = 0; k < 3; k++) {
  const x = pref(R[`K0|${t.id}|${k}`]), y = pref(R[`NULLH|${t.id}|${k}`]);
  const rec = { turn: t.id, x, y }; comps.push(rec);
  jobs.push(async () => { if (x.trim() === y.trim()) { rec.score = 0; rec.identical = true; return; } const v1 = await ask(t, x, y), v2 = await ask(t, y, x); rec.v = [v1, v2]; rec.score = (v1 === 'A' && v2 === 'B') ? 1 : (v1 === 'B' && v2 === 'A') ? -1 : 0; });
}
let i = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (i < jobs.length) await jobs[i++](); }));
const W = comps.filter((c) => c.score === 1).length, Lo = comps.filter((c) => c.score === -1).length, T = comps.length - W - Lo;
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const mw = (cond) => { const rs = Object.values(R).filter((r) => r.cond === cond && HELD_OUT.find((t) => t.id === r.turn) && !r.error); return (rs.reduce((s, r) => s + words(pref(r)), 0) / rs.length).toFixed(2) + ' (pref, n=' + rs.length + ')'; };
const out = { name: 'K0(live harvest)-vs-NULLH(harvest null)', W, L: Lo, T, n: comps.length, winRate: (W + 0.5 * T) / comps.length, meanPrefWords: { K0: mw('K0'), NULLH: mw('NULLH') }, cost: L.costOf(usage), usage, comps };
writeFileSync('judge-nullh.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, comps: undefined }, null, 1));
