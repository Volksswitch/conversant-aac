import { readFileSync, writeFileSync } from 'node:fs';
import { HELD_OUT, VARIANT_B, REVIEWS, REVIEWS_MOM_WARM } from './spec.mjs';

const gen = JSON.parse(readFileSync('gen.json', 'utf8'));
const judge = JSON.parse(readFileSync('judge.json', 'utf8'));
const condFile = JSON.parse(readFileSync('conditions.json', 'utf8'));

// ---- judge win rates
function binomTwoSided(w, l) {
    const n = w + l; if (!n) return 1;
    const k = Math.min(w, l);
    let p = 0; let c = 1;
    for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i <= k) p += c; }
    return Math.min(1, 2 * p / 2 ** n);
}
const groups = {};
for (const c of judge.comparisons) {
    const g = `${c.name}|${c.unit}|${c.kind}`;
    const s = groups[g] = groups[g] || { name: c.name, unit: c.unit, kind: c.kind, n: 0, W: 0, L: 0, T: 0, identical: 0, orderDisagree: 0 };
    s.n++;
    if (c.identical) s.identical++;
    if (c.score === 1) s.W++; else if (c.score === -1) s.L++; else { s.T++; if (!c.identical && c.v && c.v[0] !== '?' && !(c.v[0] === 'T' && c.v[1] === 'T')) s.orderDisagree++; }
}
for (const s of Object.values(groups)) { s.winRate = +((s.W + 0.5 * s.T) / s.n).toFixed(3); s.signP = +binomTwoSided(s.W, s.L).toFixed(3); }

// per-turn for voice/preferred
const perTurn = {};
for (const c of judge.comparisons.filter((c) => c.kind === 'voice')) {
    const k = `${c.name}|${c.unit}`; perTurn[k] = perTurn[k] || {};
    const t = perTurn[k][c.turn] = perTurn[k][c.turn] || { W: 0, L: 0, T: 0 };
    if (c.score === 1) t.W++; else if (c.score === -1) t.L++; else t.T++;
}

// ---- mechanical metrics per condition
const words = (s) => String(s).split(/\s+/).filter(Boolean);
const SLANG = /\b(nah|yeah|yep|yup|bro|man|dude|kinda|gonna|wanna|gotta|lol|legit|lowkey|nope|cool|bet|ugh|sick|clutch)\b/i;
const CONTR = /\b\w+'(s|re|m|ll|d|ve|t)\b/i;
const NOCONTR = /\b(I am|it is|do not|does not|did not|I will|that is|you are|can not|cannot|I have not|is not|was not)\b/i;
const reviewTexts = Object.values(REVIEWS).flat().filter((a) => a.text).map((a) => a.text);
const momTexts = Object.values(REVIEWS_MOM_WARM).flat().map((a) => a.text);
function grams(s, n = 4) { const w = s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean); const o = new Set(); for (let i = 0; i + n <= w.length; i++) o.add(w.slice(i, i + n).join(' ')); return o; }
const reviewGrams = new Set(reviewTexts.flatMap((t) => [...grams(t, 3)]));
const momGrams = new Set(momTexts.flatMap((t) => [...grams(t, 3)]));
const metrics = {};
for (const r of gen.results.filter((r) => !r.error)) {
    if (!HELD_OUT.find((t) => t.id === r.turn)) continue;
    const m = metrics[r.cond] = metrics[r.cond] || { gens: 0, prefWords: 0, cardWords: 0, cards: 0, contr: 0, nocontr: 0, slang: 0, honestly: 0, reviewGramHits: 0, cardsWithReviewGram: 0 };
    m.gens++;
    const p = r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0];
    m.prefWords += words(p.text).length;
    for (const x of r.responses) {
        m.cards++; m.cardWords += words(x.text).length;
        if (CONTR.test(x.text)) m.contr++;
        if (NOCONTR.test(x.text)) m.nocontr++;
        if (SLANG.test(x.text)) m.slang++;
        if (/honestly/i.test(x.text)) m.honestly++;
        const g = [...grams(x.text, 3)].filter((z) => reviewGrams.has(z));
        if (g.length) { m.cardsWithReviewGram++; m.reviewGramHits += g.length; }
    }
}
for (const m of Object.values(metrics)) {
    m.meanPrefWords = +(m.prefWords / m.gens).toFixed(2);
    m.meanCardWords = +(m.cardWords / m.cards).toFixed(2);
    m.pctCardsContraction = +(100 * m.contr / m.cards).toFixed(1);
    m.pctCardsUncontracted = +(100 * m.nocontr / m.cards).toFixed(1);
    m.pctCardsSlang = +(100 * m.slang / m.cards).toFixed(1);
    m.pctCardsReusing3gramFromReviewAnswers = +(100 * m.cardsWithReviewGram / m.cards).toFixed(1);
}

// ---- exact PREFERRED identity & Jaccard vs K0
const R = {}; for (const r of gen.results) R[`${r.cond}|${r.turn}|${r.sample}`] = r;
const pref = (r) => (r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0]).text;
function jacc(a, b) { const A = new Set(words(a.toLowerCase().replace(/[^a-z' ]/g, ' '))), B = new Set(words(b.toLowerCase().replace(/[^a-z' ]/g, ' '))); const i = [...A].filter((x) => B.has(x)).length; return i / (A.size + B.size - i || 1); }
const sim = {};
for (const [name, xc, xs, yc, ys] of [['K0b-vs-K0a', 'K0', [3, 4, 5], 'K0', [0, 1, 2]], ['K1', 'K1', [0, 1, 2], 'K0', [0, 1, 2]], ['K3', 'K3', [0, 1, 2], 'K0', [0, 1, 2]], ['K10', 'K10', [0, 1, 2], 'K0', [0, 1, 2]], ['CLOSER50', 'CLOSER50', [0, 1, 2], 'K0', [0, 1, 2]]]) {
    let n = 0, same = 0, j = 0;
    for (const t of HELD_OUT) for (let k = 0; k < 3; k++) {
        const a = R[`${xc}|${t.id}|${xs[k]}`], b = R[`${yc}|${t.id}|${ys[k]}`]; if (!a || !b) continue;
        n++; if (pref(a).trim() === pref(b).trim()) same++; j += jacc(pref(a), pref(b));
    }
    sim[name] = { n, identicalPreferred: same, meanWordJaccard: +(j / n).toFixed(3) };
}

// ---- variant (b) markers
const varB = {};
for (const t of VARIANT_B) for (const c of ['K0', 'MOM']) {
    const rs = gen.results.filter((r) => r.cond === c && r.turn === t.id && !r.error).slice(0, 4);
    const all = rs.flatMap((r) => r.responses.map((x) => x.text));
    varB[`${c}|${t.id}`] = {
        samples: rs.length,
        prefs: rs.map(pref),
        cardsWithMomCorrection3gram: all.filter((x) => [...grams(x, 3)].some((g) => momGrams.has(g))).length,
        cardsWithReassure: all.filter((x) => /\b(promise|don'?t worry|means a lot|honestly|i'?m (okay|ok|fine|good)|love you)\b/i.test(x)).length,
        cardsWithSorry: all.filter((x) => /\bsorry\b/i.test(x)).length,
        cardsWithThanks: all.filter((x) => /\bthank/i.test(x)).length,
        meanCardWords: +(all.reduce((s, x) => s + words(x).length, 0) / (all.length || 1)).toFixed(2),
        cards: all.length,
    };
}

// ---- side-by-side examples
const examples = {};
for (const tid of ['H3-devon-squads', 'H4-sof-homework', 'H8-stranger-inspiration', 'H6-stranger-packers', 'H1-mom-test']) {
    examples[tid] = {};
    for (const c of ['K0', 'K1', 'K3', 'K10', 'CLOSER50']) {
        const r = R[`${c}|${tid}|0`]; if (r) examples[tid][c] = r.responses.map((x) => `${x.slot}: ${x.text}`);
    }
}

const errors = gen.results.filter((r) => r.error);
const spend = { generation: gen.cost, judging: judge.cost, testCalls: 0.0452 + 0.0042 };
spend.total = +(spend.generation + spend.judging + spend.testCalls).toFixed(4);
const out = { groups: Object.values(groups), perTurn, metrics, sim, varB, examples, errors: errors.length, spend, genUsage: gen.usage, judgeUsage: judge.usage };
writeFileSync('analysis.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
