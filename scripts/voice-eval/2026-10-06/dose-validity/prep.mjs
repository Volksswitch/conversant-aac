// Read-only reanalysis prep: joins rate-raw scores to gen-raw texts and computes features.
// Writes ONLY into this folder (dose-validity). No API calls.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SLM = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm';
const D = SLM + '/exp-dose/';
const { CORPUS } = await import(pathToFileURL(D + 'corpus.mjs').href);
const rd = (f) => readFileSync(D + f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const GEN = rd('gen-raw.jsonl').filter((g) => !g.error);
const RATE = rd('rate-raw.jsonl');
const BLOCKS = JSON.parse(readFileSync(D + 'blocks.json', 'utf8'));
const STEER = 'shorter and more casual. talk like a 17 year old'; // gen2.mjs:15

// same tokenizer as exp-dose/analyze.mjs
const words = (t) => String(t).toLowerCase().replace(/[\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
// A PRIORI lexicons, copied verbatim from exp-dose/analyze.mjs (written by the same experiment agent, before this reanalysis)
const INFORMAL = ['nah', 'yeah', 'yep', 'nope', 'gonna', 'kinda', 'wanna', 'gotta', 'lowkey', 'dude', 'bro', 'man', 'legit', 'sick', 'chill', 'chilling', 'cool', 'literally', 'honestly', 'ugh', 'eh', 'huh', 'whatever', 'wild', 'ya', 'yo', 'totally', 'pretty', 'okay', 'ok', 'stuff', 'lol', 'super', 'awesome', 'sweet', 'haha'];
const INFORMAL_MW = ['for real', 'not gonna lie', 'real talk', 'no way', 'hard pass', 'fight me', 'i mean', 'no cap', 'my bad', 'i guess'];
const FORMAL = ['very', 'wonderful', 'kind', 'kindly', 'please', 'would', 'quite', 'goodness', 'glad', 'grateful', 'lovely', 'delightful', 'dear', 'perhaps', 'indeed', 'certainly', 'truly', 'such', 'shall', 'pleasure', 'thoughtful', 'appreciate', 'gentle', 'peaceful'];
const FORMAL_MW = ['thank you', 'so much', 'a great deal', "all right", "i'd love", "i'd like", 'how nice', 'oh my', 'take care'];
const OPEN_INTERJ = ['oh', 'well', 'so', 'ah', 'um', 'er', 'hmm', 'goodness'];
const MARC_OPEN = ['nah', 'yeah', 'dude', 'bro', 'wait', 'ugh', 'honestly', 'lowkey', 'eh', 'huh', 'cool', 'okay', 'real', 'nope'];
// Extra multiword signatures checked for Grace (style formulae a reader would call signature); listed so the reader can see them.
const EXTRA_MW = ['so sorry', 'no rush', 'take your time', 'sort of', 'not sure', 'at all', 'how are you', 'thank you for', 'i see', 'that sounds', 'how nice'];
const SIG_SINGLE = [...new Set([...INFORMAL, ...FORMAL, ...OPEN_INTERJ, ...MARC_OPEN])];
const SIG_MW = [...new Set([...INFORMAL_MW, ...FORMAL_MW, ...EXTRA_MW])];

function hasMW(text, p) { const t = ' ' + words(text).join(' ') + ' '; return t.includes(' ' + p + ' '); }
function sigItems(text) {
    const w = new Set(words(text));
    const s = SIG_SINGLE.filter((x) => w.has(x));
    const m = SIG_MW.filter((p) => hasMW(text, p));
    return [...s, ...m];
}
const tokSet = (lines) => new Set(lines.flatMap(words));
const sigSet = (lines) => new Set(lines.flatMap(sigItems));
const inter = (a, b) => [...a].filter((x) => b.has(x)).sort();

const out = { personas: {}, steer: {}, rows: [], anchors: [] };
for (const p of Object.keys(CORPUS)) {
    const ref = CORPUS[p].ref, pool = CORPUS[p].pool;
    const ex12 = BLOCKS[`${p}|C4`].exemplarsShown, ex4 = BLOCKS[`${p}|C3`].exemplarsShown;
    const refT = tokSet(ref), poolT = tokSet(pool), ex12T = tokSet(ex12);
    const refS = sigSet(ref), poolS = sigSet(pool), ex12S = sigSet(ex12), ex4S = sigSet(ex4);
    // Sound Check chosen lines as rendered in the voice block (C4 block) - quoted lines in the first two sections
    const vb = BLOCKS[`${p}|C4`].voice.split('\n');
    const harvestStart = vb.findIndex((l) => l.startsWith('Sentences this user has actually written'));
    const scLines = vb.slice(0, harvestStart < 0 ? vb.length : harvestStart).filter((l) => /^ {2}"/.test(l)).map((l) => l.trim().replace(/^"|"$/g, ''));
    const scS = sigSet(scLines);
    out.personas[p] = {
        allSharedTokens_ref_pool: inter(refT, poolT),
        sharedSignature_ref_pool: inter(refS, poolS),
        sharedSignature_ref_ex12: inter(refS, ex12S),
        sharedSignature_ref_ex4: inter(refS, ex4S),
        sharedSignature_ref_soundCheck: inter(refS, scS),
        refSignature: [...refS].sort(),
        poolSignature: [...poolS].sort(),
        ex12Signature: [...ex12S].sort(),
        soundCheckLines: scLines,
        soundCheckSignature: [...scS].sort(),
        refSignatureNotInAnyShownExemplar: [...refS].filter((x) => !ex12S.has(x)).sort(),
        // per ref line: which shared signature items it carries
        refLines: ref.map((t) => ({ t, words: words(t).length, sig: sigItems(t), sharedWithPool: sigItems(t).filter((x) => poolS.has(x)) })),
        poolLinesWithRefSig: pool.map((t) => ({ t, shown12: ex12.includes(t), sharedWithRef: sigItems(t).filter((x) => refS.has(x)) })).filter((x) => x.sharedWithRef.length),
        refMeanWords: ref.reduce((a, t) => a + words(t).length, 0) / ref.length,
        poolMeanWords: pool.reduce((a, t) => a + words(t).length, 0) / pool.length,
        ex12MeanWords: ex12.reduce((a, t) => a + words(t).length, 0) / ex12.length,
    };
    out.steer[p] = { steerTokens: words(STEER), sharedTokensWithRef: inter(tokSet([STEER]), refT), sharedSignatureWithRef: inter(sigSet([STEER]), refS) };
}

const pref = (g) => (g.responses.find((r) => r.slot === 'PREFERRED') || g.responses[0]);
const genByKey = Object.fromEntries(GEN.map((g) => [`gen|${g.persona}|${g.cond}|${g.rep}|${g.turn}`, g]));
let mismatch = 0;
for (const r of RATE) {
    const p = r.persona;
    const P = out.personas[p];
    const refSharedPool = new Set(P.sharedSignature_ref_pool);
    const refSig = new Set(P.refSignature);
    const feat = (text) => {
        const sig = sigItems(text);
        return {
            words: words(text).length,
            sig,
            anySharedMarker: sig.some((x) => refSharedPool.has(x)) ? 1 : 0,
            nSharedMarker: sig.filter((x) => refSharedPool.has(x)).length,
            anyRefMarker: sig.some((x) => refSig.has(x)) ? 1 : 0,
            nahUgh: /\b(nah|ugh)\b/i.test(text) ? 1 : 0,
        };
    };
    if (r.kind === 'gen') {
        const g = genByKey[r.key];
        const pr = pref(g);
        if (pr.text !== r.text) mismatch++;
        const cards = g.responses.map((x) => ({ slot: x.slot, text: x.text, ...feat(x.text) }));
        out.rows.push({ key: r.key, persona: p, cond: r.cond, rep: r.rep, turn: r.turn, slot: pr.slot, text: r.text, score: r.score, ...feat(r.text), allCards: cards });
    } else {
        out.anchors.push({ key: r.key, kind: r.kind, persona: p, text: r.text, score: r.score, ...feat(r.text) });
    }
}
out.joinCheck = { rated: out.rows.length, textMismatchVsGenPreferred: mismatch, anchors: out.anchors.length };
writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.joinCheck));
for (const p of Object.keys(out.personas)) {
    const P = out.personas[p];
    console.log('\n=====', p);
    for (const k of ['allSharedTokens_ref_pool', 'sharedSignature_ref_pool', 'sharedSignature_ref_ex12', 'sharedSignature_ref_ex4', 'sharedSignature_ref_soundCheck', 'refSignature', 'refSignatureNotInAnyShownExemplar', 'soundCheckSignature']) console.log(k + ':', JSON.stringify(P[k]));
    console.log('mean words ref/pool/ex12', P.refMeanWords.toFixed(2), P.poolMeanWords.toFixed(2), P.ex12MeanWords.toFixed(2));
    console.log('ref lines:'); for (const l of P.refLines) console.log('  ', JSON.stringify(l));
    console.log('pool lines carrying a ref signature item:'); for (const l of P.poolLinesWithRefSig) console.log('  ', JSON.stringify(l));
    console.log('steer:', JSON.stringify(out.steer[p]));
}
