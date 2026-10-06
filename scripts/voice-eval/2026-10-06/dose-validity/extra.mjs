// Read-only extras: shared-prior check (similarity of rated cards to lines the generator NEVER saw),
// Sound Check line profile, per-turn fidelity. Writes extra-out.txt here only.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const SLM = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm';
const { CORPUS } = await import(pathToFileURL(SLM + '/exp-dose/corpus.mjs').href);
const D = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const BL = JSON.parse(readFileSync(SLM + '/exp-dose/blocks.json', 'utf8'));
const L = []; const P = (...a) => { const s = a.join(' '); L.push(s); console.log(s); };
const words = (t) => String(t).toLowerCase().replace(/[\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
function lev(a, b) { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
const sim = (a, b) => { const A = words(a), B = words(b); return 1 - lev(A, B) / (Math.max(A.length, B.length) || 1); };
const bigrams = (t) => { const w = words(t); const s = new Set(); for (let i = 0; i + 1 < w.length; i++) s.add(w[i] + ' ' + w[i + 1]); return s; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
for (const p of Object.keys(CORPUS)) {
    const ex12 = BL[`${p}|C4`].exemplarsShown, ex30 = CORPUS[p].pool;
    const unseen = ex30.filter((t) => !ex12.includes(t)); const ref = CORPUS[p].ref;
    const refBi = new Set(ref.flatMap((t) => [...bigrams(t)])), unseenBi = new Set(unseen.flatMap((t) => [...bigrams(t)])), shownBi = new Set(ex12.flatMap((t) => [...bigrams(t)]));
    P(`\n===== ${p}: PREFERRED cards' max word-edit similarity / shared bigrams vs (ref | 18 unseen pool | 12 shown exemplars)`);
    P('cond | n | maxSim ref | maxSim unseen | maxSim shown | %cards sharing a bigram with ref | with unseen | with shown');
    for (const c of ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']) {
        const rs = D.rows.filter((r) => r.persona === p && r.cond === c); if (!rs.length) continue;
        const ms = (set) => mean(rs.map((r) => Math.max(...set.map((t) => sim(r.text, t)))));
        const bi = (S) => rs.filter((r) => [...bigrams(r.text)].some((b) => S.has(b))).length / rs.length;
        P(`${c} | ${rs.length} | ${ms(ref).toFixed(2)} | ${ms(unseen).toFixed(2)} | ${ms(ex12).toFixed(2)} | ${(100 * bi(refBi)).toFixed(0)}% | ${(100 * bi(unseenBi)).toFixed(0)}% | ${(100 * bi(shownBi)).toFixed(0)}%`);
    }
    // top near-matches to lines the generator never saw
    const top = D.rows.filter((r) => r.persona === p).map((r) => { let best = null; for (const t of [...ref, ...unseen]) { const s = sim(r.text, t); if (!best || s > best.s) best = { s, t, src: ref.includes(t) ? 'REF' : 'UNSEEN-POOL' }; } return { ...r, best }; }).sort((a, b) => b.best.s - a.best.s).slice(0, 8);
    P('closest matches between rated cards and lines the generator NEVER saw:');
    for (const r of top) P(`  ${r.cond} ${r.turn} score ${r.score} sim ${r.best.s.toFixed(2)} | "${r.text}" ~ ${r.best.src} "${r.best.t}"`);
    // Sound Check lines (persona-data.js authored) vs ref (exp-dose authored)
    const sc = D.personas[p].soundCheckLines;
    P(`Sound Check lines in voice block: n ${sc.length}, mean words ${mean(sc.map((t) => words(t).length)).toFixed(2)}; signature items ${JSON.stringify(D.personas[p].soundCheckSignature)}`);
    const other = p === 'marc-delgado' ? 'grace-thompson' : 'marc-delgado';
    const otherRef = new Set(D.personas[other].refSignature);
    P(`  of those Sound Check signature items, in OWN ref: ${JSON.stringify(D.personas[p].soundCheckSignature.filter((x) => D.personas[p].refSignature.includes(x)))}; in OTHER persona's ref: ${JSON.stringify(D.personas[p].soundCheckSignature.filter((x) => otherRef.has(x)))}`);
    // per-turn fidelity
    const turns = [...new Set(D.rows.map((r) => r.turn))];
    P('per-turn mean fidelity (all conds) | mean words: ' + turns.map((t) => { const rs = D.rows.filter((r) => r.persona === p && r.turn === t); return `${t} ${mean(rs.map((r) => r.score)).toFixed(2)}/${mean(rs.map((r) => r.words)).toFixed(1)}w`; }).join(' | '));
}
// C7 vs C4 Marc PREFERRED side by side
P('\nMarc C4 (rep1, rep2) vs C7 PREFERRED, same turn:');
for (const t of ['greeting', 'weekend', 'invitation', 'badnews', 'request', 'clerk', 'disagree', 'hobby']) {
    const g = (c, rep) => D.rows.find((r) => r.persona === 'marc-delgado' && r.cond === c && r.turn === t && r.rep === rep);
    const a = g('C4', 1), b = g('C4', 2), c = g('C7', 1);
    P(`  ${t}: C4 [${a.score}] "${a.text}" | [${b.score}] "${b.text}" || C7 [${c.score}] "${c.text}"`);
}
writeFileSync(new URL('./extra-out.txt', import.meta.url), L.join('\n'));
