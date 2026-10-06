// Analysis: style stats, copying, judge accuracy, cost. Writes results.json + prints tables.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { CORPUS, TURNS } from './corpus.mjs';

const ROOT = 'C:/Users/ken/OneDrive/4 T-Z/Volksswitch/AI-driven AAC';
const PRICING = JSON.parse(readFileSync(ROOT + '/app/data/pricing.json', 'utf8'));
const GEN = readFileSync(new URL('./gen-raw.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const JUDGE = existsSync(new URL('./judge-raw.jsonl', import.meta.url))
    ? readFileSync(new URL('./judge-raw.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
const BLOCKS = JSON.parse(readFileSync(new URL('./blocks.json', import.meta.url), 'utf8'));
const CONDS = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
const PERS = ['marc-delgado', 'grace-thompson'];
const ok = GEN.filter((g) => !g.error);

// ---------- text features ----------
const words = (t) => String(t).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const INFORMAL = ['nah', 'yeah', 'yep', 'nope', 'gonna', 'kinda', 'wanna', 'gotta', 'lowkey', 'dude', 'bro', 'man', 'legit', 'sick', 'chill', 'chilling', 'cool', 'literally', 'honestly', 'ugh', 'eh', 'huh', 'whatever', 'wild', 'ya', 'yo', 'totally', 'pretty', 'okay', 'ok', 'stuff', 'lol', 'super', 'awesome', 'sweet', 'haha'];
const INFORMAL_MW = ['for real', 'not gonna lie', 'real talk', 'no way', 'hard pass', 'fight me', 'i mean', 'no cap', 'my bad', 'i guess'];
const FORMAL = ['very', 'wonderful', 'kind', 'kindly', 'please', 'would', 'quite', 'goodness', 'glad', 'grateful', 'lovely', 'delightful', 'dear', 'perhaps', 'indeed', 'certainly', 'truly', 'such', 'shall', 'pleasure', 'thoughtful', 'appreciate', 'gentle', 'peaceful'];
const FORMAL_MW = ['thank you', 'so much', 'a great deal', 'all right', 'i\'d love', 'i\'d like', 'how nice', 'oh my', 'take care'];
const HEDGES = ['i think', 'maybe', 'perhaps', 'i suppose', 'kind of', 'sort of', 'i guess', 'i mean', 'probably', 'a bit', 'a little', 'not sure', 'i\'m not sure'];
const OPEN_INTERJ = ['oh', 'well', 'so', 'ah', 'um', 'er', 'hmm', 'goodness'];
const MARC_OPEN = ['nah', 'yeah', 'dude', 'bro', 'wait', 'ugh', 'honestly', 'lowkey', 'eh', 'huh', 'cool', 'okay', 'real', 'nope'];

function countMW(text, list) { const t = ' ' + words(text).join(' ') + ' '; let n = 0; for (const p of list) { let i = 0; const pp = ' ' + p + ' '; while ((i = t.indexOf(pp, i)) >= 0) { n++; i += pp.length - 1; } } return n; }
function feats(text) {
    const w = words(text);
    const nW = w.length || 1;
    return {
        words: w.length,
        contrPerWord: w.filter((x) => x.includes("'")).length / nW,
        informal: w.filter((x) => INFORMAL.includes(x)).length + countMW(text, INFORMAL_MW),
        formal: w.filter((x) => FORMAL.includes(x)).length + countMW(text, FORMAL_MW),
        excl: (String(text).match(/!/g) || []).length,
        question: (String(text).match(/\?/g) || []).length > 0 ? 1 : 0,
        hedge: countMW(text, HEDGES),
        openInterj: OPEN_INTERJ.includes(w[0]) ? 1 : 0,
        marcOpen: MARC_OPEN.includes(w[0]) ? 1 : 0,
        first: w[0] || '',
    };
}
const FKEYS = ['words', 'contrPerWord', 'informal', 'formal', 'excl', 'question', 'hedge'];
function profile(texts) {
    const fs = texts.map(feats); const out = { n: texts.length };
    for (const k of [...FKEYS, 'openInterj', 'marcOpen']) out[k] = fs.reduce((a, f) => a + f[k], 0) / (fs.length || 1);
    const firsts = {}; for (const f of fs) firsts[f.first] = (firsts[f.first] || 0) + 1;
    out.topFirst = Object.entries(firsts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w, c]) => `${w}:${c}`).join(' ');
    return out;
}
const refProfiles = Object.fromEntries(PERS.map((p) => [p, profile(CORPUS[p].ref)]));
const poolProfiles = Object.fromEntries(PERS.map((p) => [p, profile(CORPUS[p].pool)]));
// pooled sd across both personas' reference lines, per feature
const allRef = PERS.flatMap((p) => CORPUS[p].ref).map(feats);
const SD = {};
for (const k of FKEYS) { const m = allRef.reduce((a, f) => a + f[k], 0) / allRef.length; SD[k] = Math.sqrt(allRef.reduce((a, f) => a + (f[k] - m) ** 2, 0) / (allRef.length - 1)) || 1; }
const dist = (prof, ref) => Math.sqrt(FKEYS.reduce((a, k) => a + ((prof[k] - ref[k]) / SD[k]) ** 2, 0));

const pref = (g) => (g.responses.find((r) => r.slot === 'PREFERRED') || g.responses[0]).text;
const nonRepair = (g) => g.responses.filter((r) => r.slot !== 'REPAIR').map((r) => r.text);

const style = {};
for (const p of PERS) for (const c of CONDS) {
    const rows = ok.filter((g) => g.persona === p && g.cond === c);
    if (!rows.length) continue;
    const pp = profile(rows.map(pref)); const pn = profile(rows.flatMap(nonRepair));
    style[`${p}|${c}`] = { n: rows.length, pref: pp, nonRepair: pn,
        distPrefToOwnRef: dist(pp, refProfiles[p]), distPrefToOtherRef: dist(pp, refProfiles[PERS.find((x) => x !== p)]),
        distNRToOwnRef: dist(pn, refProfiles[p]), distNRToOtherRef: dist(pn, refProfiles[PERS.find((x) => x !== p)]) };
}

// ---------- copying ----------
const norm = (t) => words(t).join(' ');
function lev(a, b) { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
function sim(a, b) { const A = words(a), B = words(b); const L = Math.max(A.length, B.length) || 1; return 1 - lev(A, B) / L; }
function ngrams(t, n) { const w = words(t); const s = new Set(); for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' ')); return s; }
const copying = {};
const copyExamples = [];
for (const p of PERS) for (const c of CONDS) {
    const rows = ok.filter((g) => g.persona === p && g.cond === c);
    if (!rows.length) continue;
    const shown = (BLOCKS[`${p}|${c}`] || {}).exemplarsShown || [];
    const pool = CORPUS[p].pool;
    let cards = 0, verbatimShown = 0, nearShown = 0, nearPool = 0, tri = 0, cardsWithTri = 0;
    for (const g of rows) for (const r of g.responses) {
        cards++;
        const bestShown = shown.length ? Math.max(...shown.map((e) => sim(r.text, e))) : 0;
        const bestPool = Math.max(...pool.map((e) => sim(r.text, e)));
        const containsShown = shown.some((e) => words(e).length >= 3 && (' ' + norm(r.text) + ' ').includes(' ' + norm(e) + ' '));
        if (shown.some((e) => norm(e) === norm(r.text))) verbatimShown++;
        if (bestShown >= 0.75 || containsShown) { nearShown++; copyExamples.push({ persona: p, cond: c, turn: g.turn, card: r.text, exemplar: shown.find((e) => sim(r.text, e) === bestShown), sim: +bestShown.toFixed(2) }); }
        if (bestPool >= 0.75) nearPool++;
        const t3 = ngrams(r.text, 3); let hit = 0; for (const e of shown) for (const x of ngrams(e, 3)) if (t3.has(x)) hit++;
        if (hit) cardsWithTri++;
    }
    copying[`${p}|${c}`] = { cards, verbatimShown, nearShown, nearPoolAny: nearPool, cardsSharingA3gramWithShownExemplar: cardsWithTri };
}

// ---------- judges ----------
const ident = {}; const pair = {};
for (const j of JUDGE) {
    if (j.error) continue;
    if (j.type === 'ident') {
        const k = `${j.model}|${j.kind}|${j.persona}|${j.cond}`; const o = ident[k] || (ident[k] = { n: 0, correct: 0, conf: 0 });
        o.n++; if (j.correct) o.correct++; o.conf += j.confidence || 0;
    } else {
        const k = `${j.persona}|${j.cond}`; const o = pair[k] || (pair[k] = { n: 0, wins: 0 });
        o.n++; if (j.condWins) o.wins++;
    }
}
// position-bias check for ident (answer A rate)
const posA = {}; for (const j of JUDGE) if (j.type === 'ident' && !j.error) { const k = j.model; const o = posA[k] || (posA[k] = { n: 0, a: 0 }); o.n++; if (j.answer === 'A') o.a++; }
const posX = { n: 0, x: 0 }; for (const j of JUDGE) if (j.type === 'pair' && !j.error) { posX.n++; if (j.answer === 'X') posX.x++; }

// ---------- cost ----------
function costOf(u, inRate, outRate) { return (u.input * inRate + u.cacheWrite * inRate * PRICING.cacheWriteMultiplier + u.cacheRead * inRate * PRICING.cacheReadMultiplier + u.output * outRate) / 1e6; }
const genU = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, calls: 0 };
for (const g of GEN) if (g.usage) { for (const k of ['input', 'output', 'cacheWrite', 'cacheRead']) genU[k] += g.usage[k] || 0; genU.calls++; }
const genCost = costOf(genU, PRICING.inputCostPerMillionTokens, PRICING.outputCostPerMillionTokens);
const jU = {};
for (const j of JUDGE) if (j.usage) { const o = jU[j.model] || (jU[j.model] = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, calls: 0 }); o.input += j.usage.input_tokens || 0; o.output += j.usage.output_tokens || 0; o.cacheWrite += j.usage.cache_creation_input_tokens || 0; o.cacheRead += j.usage.cache_read_input_tokens || 0; o.calls++; }
const RATES = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5] };   // Sonnet from pricing.json; Haiku from the claude-api skill table
const judgeCost = Object.fromEntries(Object.entries(jU).map(([m, u]) => [m, costOf(u, ...RATES[m])]));

// ---------- output ----------
const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-';
const f2 = (x) => (typeof x === 'number' ? x.toFixed(2) : x);
console.log('REFERENCE PROFILES (held-out 10 lines):');
for (const p of PERS) console.log(p, JSON.stringify(Object.fromEntries(Object.entries(refProfiles[p]).map(([k, v]) => [k, f2(v)]))));
console.log('POOL PROFILES (30 exemplar lines):');
for (const p of PERS) console.log(p, JSON.stringify(Object.fromEntries(Object.entries(poolProfiles[p]).map(([k, v]) => [k, f2(v)]))));
console.log('SD used for distance', JSON.stringify(Object.fromEntries(Object.entries(SD).map(([k, v]) => [k, f2(v)]))));
for (const p of PERS) {
    console.log('\n===== ' + p);
    console.log('cond | n | idSonnet pref | idSonnet all4 | idHaiku pref | idHaiku all4 | pairwin vs C0 | PREF words contr informal formal excl q hedge openInterj marcOpen | dist own/other | NR dist own/other | copy near/verb/cards | top first words');
    for (const c of CONDS) {
        const s = style[`${p}|${c}`]; if (!s) continue;
        const g = (m, k) => { const o = ident[`${m}|${k}|${p}|${c}`]; return o ? `${pct(o.correct, o.n)} (${o.correct}/${o.n})` : '-'; };
        const pw = pair[`${p}|${c}`]; const cp = copying[`${p}|${c}`];
        const P = s.pref;
        console.log([c, s.n, g('claude-sonnet-5-5', 'pref'), g('claude-sonnet-5-5', 'all4'), g('claude-haiku-4-5', 'pref'), g('claude-haiku-4-5', 'all4'),
            pw ? `${pct(pw.wins, pw.n)} (${pw.wins}/${pw.n})` : '-',
            [P.words, P.contrPerWord, P.informal, P.formal, P.excl, P.question, P.hedge, P.openInterj, P.marcOpen].map(f2).join(' '),
            `${f2(s.distPrefToOwnRef)}/${f2(s.distPrefToOtherRef)}`, `${f2(s.distNRToOwnRef)}/${f2(s.distNRToOtherRef)}`,
            `${cp.nearShown}/${cp.verbatimShown}/${cp.cards}`, P.topFirst].join(' | '));
    }
}
for (const m of ['claude-sonnet-5-5', 'claude-haiku-4-5']) for (const p of PERS) { const o = ident[`${m}|poolctl|${p}|POOL`]; if (o) console.log(`POSITIVE CONTROL (pool lines) ${m} ${p}: ${pct(o.correct, o.n)} (${o.correct}/${o.n})`); }
// pooled across personas per condition
console.log('\nPOOLED ACROSS PERSONAS');
for (const c of CONDS) {
    const row = [c];
    for (const m of ['claude-sonnet-5-5', 'claude-haiku-4-5']) for (const k of ['pref', 'all4']) { let n = 0, cr = 0; for (const p of PERS) { const o = ident[`${m}|${k}|${p}|${c}`]; if (o) { n += o.n; cr += o.correct; } } row.push(`${m.split('-')[1]}-${k} ${pct(cr, n)} (${cr}/${n})`); }
    let n = 0, w = 0; for (const p of PERS) { const o = pair[`${p}|${c}`]; if (o) { n += o.n; w += o.wins; } } row.push(`pair ${pct(w, n)} (${w}/${n})`);
    console.log(row.join(' | '));
}
console.log('\nposition bias ident (share answering A):', JSON.stringify(posA), ' pair X share:', JSON.stringify(posX));
console.log('GEN usage', JSON.stringify(genU), 'cost $' + genCost.toFixed(3));
console.log('JUDGE usage', JSON.stringify(jU), 'cost', JSON.stringify(judgeCost));
const total = genCost + Object.values(judgeCost).reduce((a, b) => a + b, 0);
console.log('TOTAL $' + total.toFixed(3));
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify({ refProfiles, poolProfiles, SD, style, copying, copyExamples, ident, pair, posA, posX, genU, genCost, jU, judgeCost, total }, null, 2));
