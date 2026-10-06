import { readFileSync } from 'node:fs';
const EXP = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm/exp-review';
const J = JSON.parse(readFileSync(EXP + '/judge.json', 'utf8'));
const R = JSON.parse(readFileSync('rejudge.json', 'utf8')).recs;
function binom(w, l) { const n = w + l; if (!n) return 1; const k = Math.min(w, l); let p = 0, c = 1; for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i <= k) p += c; } return Math.min(1, 2 * p / 2 ** n); }
// parse diagnostics
const all = R.flatMap((r) => [r.r1, r.r2]);
const how = {}; for (const a of all) how[a.how] = (how[a.how] || 0) + 1;
const verbose = all.filter((a) => a.how !== 'single').length;
const changed = all.filter((a) => a.v !== a.old).length;
const vdist = {}; for (const a of all) vdist[a.v] = (vdist[a.v] || 0) + 1;
console.log('parse how', how, 'verbose', verbose, '/', all.length, 'old-parser != new-parser', changed);
console.log('verdict dist', vdist);
// old parser applied to the NEW replies: how much AA does it create?
const pat = (f) => { const p = {}; for (const r of R) { const k = f(r.r1) + f(r.r2); p[k] = (p[k] || 0) + 1; } return p; };
console.log('NEW replies, OLD parser patterns', pat((a) => a.old));
console.log('NEW replies, NEW parser patterns', pat((a) => a.v));
// position bias with new parser: share of 'A' among A/B verdicts
const ab = all.filter((a) => a.v === 'A' || a.v === 'B'); console.log('A share among A/B verdicts (new parser)', (ab.filter((a) => a.v === 'A').length / ab.length).toFixed(3), 'n', ab.length);
// groups, counting identical as ties (n=24 like original)
const ident = {}; for (const c of J.comparisons) if (c.identical) { const g = `${c.name}|${c.unit}|${c.kind}`; ident[g] = (ident[g] || 0) + 1; }
const G = {};
for (const r of R) { const g = `${r.name}|${r.unit}|${r.kind}`; const s = G[g] = G[g] || { W: 0, L: 0, T: 0, oW: 0, oL: 0 }; if (r.score === 1) s.W++; else if (r.score === -1) s.L++; else s.T++; if (r.origScore === 1) s.oW++; else if (r.origScore === -1) s.oL++; }
for (const [g, s] of Object.entries(G)) { const n = s.W + s.L + s.T + (ident[g] || 0); const T = s.T + (ident[g] || 0); console.log(g.padEnd(42), 'n', n, 'NEW W/L/T', s.W, s.L, T, 'winRate', ((s.W + 0.5 * T) / n).toFixed(3), 'p', binom(s.W, s.L).toFixed(3), '| ORIG W/L', s.oW, s.oL); }
