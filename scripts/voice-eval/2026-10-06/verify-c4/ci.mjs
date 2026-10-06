import { readFileSync } from 'node:fs';
const EXP = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm/exp-review';
const J = JSON.parse(readFileSync(EXP + '/judge.json', 'utf8')).comparisons;
const R = JSON.parse(readFileSync('rejudge.json', 'utf8')).recs;
const A = JSON.parse(readFileSync('ablate.json', 'utf8')).comps;
const key = (c) => `${c.name}|${c.unit}|${c.kind}|${c.turn}|${c.xSample}|${c.ySample}`;
const fixed = Object.fromEntries(R.map((r) => [key(r), r.score]));
// rebuild full n=24 sets (identical = 0)
function set(name, unit, kind, src) { return J.filter((c) => c.name === name && c.unit === unit && c.kind === kind).map((c) => ({ turn: c.turn, s: c.identical ? 0 : (src === 'fixed' ? fixed[key(c)] : c.score) })); }
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
function boot(rows, B = 4000) { const turns = [...new Set(rows.map((r) => r.turn))]; const by = Object.fromEntries(turns.map((t) => [t, rows.filter((r) => r.turn === t).map((r) => r.s)])); const est = []; for (let b = 0; b < B; b++) { let sum = 0, n = 0; for (let i = 0; i < turns.length; i++) { const t = turns[Math.floor(rnd() * turns.length)]; for (const s of by[t]) { sum += s; n++; } } est.push((1 + sum / n) / 2); } est.sort((a, b) => a - b); const m = (1 + rows.reduce((x, r) => x + r.s, 0) / rows.length) / 2; return [m.toFixed(3), est[Math.floor(0.025 * B)].toFixed(3), est[Math.floor(0.975 * B)].toFixed(3)]; }
for (const unit of ['preferred', 'palette']) for (const n of ['K0b-vs-K0a', 'K1-vs-K0', 'K3-vs-K0', 'K10-vs-K0', 'CLOSER50-vs-K0']) {
  console.log(unit.padEnd(10), n.padEnd(16), 'ORIG winRate [95% turn-cluster bootstrap]', boot(set(n, unit, 'voice', 'orig')).join(' '), '| FIXED', boot(set(n, unit, 'voice', 'fixed')).join(' '));
}
for (const n of ['FLIP-vs-K0', 'CLOSER50-vs-FLIP', 'K0-vs-NULLH', 'K1-vs-NULLH', 'K10-vs-NULLH']) console.log('ablation  ', n.padEnd(16), 'FIXED', boot(A.filter((c) => c.name === n).map((c) => ({ turn: c.turn, s: c.score }))).join(' '));
// pooled palette K1+K3+K10, fixed
function binom(w, l) { const n = w + l; const k = Math.min(w, l); let p = 0, c = 1; for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i <= k) p += c; } return Math.min(1, 2 * p / 2 ** n); }
for (const unit of ['preferred', 'palette']) { let W = 0, L = 0; for (const n of ['K1-vs-K0', 'K3-vs-K0', 'K10-vs-K0']) for (const r of set(n, unit, 'voice', 'fixed')) { if (r.s === 1) W++; if (r.s === -1) L++; } console.log('pooled K1+K3+K10', unit, 'FIXED W/L', W, L, 'naive sign p', binom(W, L).toFixed(4), '(pairs share K0 opponents; not independent)'); }
// per-turn fixed preferred for K10
const pt = {}; for (const r of set('K10-vs-K0', 'preferred', 'voice', 'fixed')) { pt[r.turn] = pt[r.turn] || []; pt[r.turn].push(r.s); } console.log('K10 preferred fixed per turn', JSON.stringify(pt));
