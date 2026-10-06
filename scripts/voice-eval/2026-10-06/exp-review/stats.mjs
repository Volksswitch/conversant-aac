import { readFileSync } from 'node:fs';
import { REFERENCE, REVIEWS, REVIEWS_MOM_WARM, HELD_OUT } from './spec.mjs';
const w = (s) => s.split(/\s+/).filter(Boolean).length;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
console.log('reference mean words', mean(REFERENCE.map(w)).toFixed(2));
const typed = Object.values(REVIEWS).flat().filter((a) => a.kind === 'typed').map((a) => w(a.text));
const rew = Object.values(REVIEWS).flat().filter((a) => a.kind === 'reword').map((a) => w(a.text));
console.log('review typed mean words', mean(typed).toFixed(2), 'n', typed.length, '; reworded mean', mean(rew).toFixed(2), 'n', rew.length);
const g = JSON.parse(readFileSync('gen.json', 'utf8')).results.concat(JSON.parse(readFileSync('gen-nullh.json', 'utf8')).results);
const pref = (r) => (r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0]).text;
for (const c of ['NULLH', 'K0', 'K1', 'K3', 'K10', 'CLOSER50']) {
  const a = g.filter((r) => r.cond === c && HELD_OUT.find((t) => t.id === r.turn)).map((r) => w(pref(r)));
  const all = g.filter((r) => r.cond === c && HELD_OUT.find((t) => t.id === r.turn)).flatMap((r) => r.responses.map((x) => w(x.text)));
  console.log(c, 'PREFERRED words mean', mean(a).toFixed(2), '±95%', (1.96 * sd(a) / Math.sqrt(a.length)).toFixed(2), 'n', a.length, '| all-card mean', mean(all).toFixed(2));
}
