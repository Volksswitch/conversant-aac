// Read-only: (a) recompute verifier-c6's turn-stratified permutation tests for ALL slot x contrast
// cells so the family size is known; (b) turn-stratified permutation tests on the exp-dose fidelity
// table (never tested in deep-out.txt). Writes perms-out.json/.txt here only.
import { readFileSync, writeFileSync } from 'node:fs';
const SLM = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm';
const J = (f) => JSON.parse(readFileSync(SLM + '/' + f, 'utf8'));
const lines = []; const P = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
let seed = 987654321; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// turn-stratified permutation: within each turn, shuffle group labels among that turn's units
function permTest(unitsA, unitsB, N = 20000) {
    const turns = [...new Set([...unitsA, ...unitsB].map((u) => u.turn))];
    const by = turns.map((t) => ({ a: unitsA.filter((u) => u.turn === t).map((u) => u.v), b: unitsB.filter((u) => u.turn === t).map((u) => u.v) }));
    const obs = mean(unitsB.map((u) => u.v)) - mean(unitsA.map((u) => u.v));
    const nA = unitsA.length, nB = unitsB.length;
    let c = 0;
    for (let i = 0; i < N; i++) {
        let sA = 0, sB = 0;
        for (const g of by) {
            const all = g.a.concat(g.b);
            for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [all[k], all[j]] = [all[j], all[k]]; }
            for (let k = 0; k < g.a.length; k++) sA += all[k];
            for (let k = g.a.length; k < all.length; k++) sB += all[k];
        }
        if (Math.abs(sB / nB - sA / nA) >= Math.abs(obs) - 1e-12) c++;
    }
    return { diff: obs, p: (c + 1) / (N + 1) };
}

// ---------- (a) verifier-c6 ----------
const { HELD_OUT } = await import('file:///' + SLM + '/exp-review/spec.mjs');
const turnIds = new Set(HELD_OUT.map((t) => t.id));
const rev = J('exp-review/gen.json').results.filter((r) => !r.error && r.cond === 'K0' && turnIds.has(r.turn) && r.sample >= 0 && r.sample < 6);
const nul = [...J('exp-review/gen-nullh.json').results, ...J('verifier-c6/gen.json').results.filter((r) => r.cond === 'NULLH')].filter((r) => !r.error && turnIds.has(r.turn));
const ver = J('verifier-c6/gen.json').results.filter((r) => !r.error && (r.cond === 'EXONLY' || r.cond === 'LEANONLY'));
const all = [...rev, ...nul, ...ver];
const wc = (t) => String(t).trim().split(/\s+/).filter(Boolean).length;
const SLOTS = ['PREFERRED', 'DISPREFERRED', 'INITIATIVE', 'REPAIR'];
const units = (cond, slot) => all.filter((r) => r.cond === cond).map((r) => { const x = r.responses.find((y) => y.slot === slot); return x ? { turn: r.turn, v: wc(x.text) } : null; }).filter(Boolean);
P('verifier-c6 recompute: n per cond', ['NULLH', 'LEANONLY', 'EXONLY', 'K0'].map((c) => c + '=' + all.filter((r) => r.cond === c).length).join(' '));
for (const s of SLOTS) P(`mean words ${s}:`, ['NULLH', 'LEANONLY', 'EXONLY', 'K0'].map((c) => c + ' ' + mean(units(c, s).map((u) => u.v)).toFixed(2)).join(' | '));
const CONTRASTS = [['NULLH', 'K0'], ['NULLH', 'LEANONLY'], ['NULLH', 'EXONLY'], ['LEANONLY', 'K0']];
const c6 = [];
for (const s of SLOTS) for (const [a, b] of CONTRASTS) {
    const r = permTest(units(a, s), units(b, s));
    c6.push({ test: `${s} ${b}-${a}`, diff: r.diff, p: r.p });
    P(`  ${s} ${b}-${a}: diff ${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(2)} p=${r.p.toFixed(4)}`);
}

// ---------- (b) exp-dose fidelity contrasts ----------
const D = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const dose = [];
for (const [persona, list] of [['marc-delgado', [['C0', 'C1'], ['C0', 'C2'], ['C0', 'C3'], ['C0', 'C4'], ['C0', 'C5'], ['C0', 'C6'], ['C0', 'C7'], ['C0', 'C8'], ['C4', 'C5'], ['C4', 'C7'], ['C4', 'C8'], ['C1', 'C2'], ['C4', 'C6']]],
    ['grace-thompson', [['C0', 'C1'], ['C0', 'C2'], ['C0', 'C3'], ['C0', 'C4'], ['C0', 'C5'], ['C0', 'C6'], ['C4', 'C5'], ['C1', 'C2'], ['C4', 'C6']]]]) {
    P(`\nexp-dose fidelity, turn-stratified permutation, ${persona}`);
    for (const [a, b] of list) {
        const U = (c) => D.rows.filter((r) => r.persona === persona && r.cond === c).map((r) => ({ turn: r.turn, v: r.score }));
        const r = permTest(U(a), U(b));
        dose.push({ persona, test: `${b}-${a}`, diff: r.diff, p: r.p });
        P(`  ${b}-${a}: diff ${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(2)} p=${r.p.toFixed(4)} (n ${U(b).length} vs ${U(a).length})`);
    }
}
// C7 nah/ugh cards
P('\nMarc C7 cards (all slots) containing nah/ugh:');
for (const r of D.rows.filter((r) => r.persona === 'marc-delgado' && r.cond === 'C7')) for (const c of r.allCards) if (c.nahUgh) P(`  ${r.turn} ${c.slot}: ${c.text}`);
writeFileSync(new URL('./perms-out.json', import.meta.url), JSON.stringify({ c6, dose }, null, 1));
writeFileSync(new URL('./perms-out.txt', import.meta.url), lines.join('\n'));
