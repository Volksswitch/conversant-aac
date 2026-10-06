// Builds the review files with the app's own review-model, runs the app's harvest,
// and records the exact voice block per condition. No API calls.
import { writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
import { REVIEWS, REVIEWS_CLOSER_ONLY, REVIEWS_MOM_WARM, K_SETS, REFERENCE } from './spec.mjs';

const rm = L.reviewModel;

export function buildReview(convo, answers) {
    const turns = rm.buildTurns(convo.data);
    let review = rm.emptyReview(convo.id);
    const log = [];
    for (const a of answers) {
        const t = turns.find((x) => x.key === a.key);
        if (!t) throw new Error(`no turn ${a.key} in ${convo.id}`);
        if (a.kind === 'closer') {
            if (a.index === t.took) throw new Error(`closer on the taken card ${a.key}`);
            if (!t.cards[a.index]) throw new Error(`no card ${a.index} at ${a.key}`);
            review = rm.setCardAnswer(review, t, a.index);
        } else if (a.kind === 'reword') {
            if (!t.cards[a.index]) throw new Error(`no card ${a.index} at ${a.key}`);
            review = rm.setCardAnswer(review, t, a.index, a.text);
        } else if (a.kind === 'typed') {
            review = rm.setTypedAnswer(review, t, a.text);
        }
        review = rm.markReached(review, t.index);
        log.push({ ...a, original: a.index != null ? t.cards[a.index].text : null, took: t.took, liveUser: t.user && t.user.text, turnsInConvo: turns.length });
    }
    return { review, log, turnCount: turns.length };
}

// Effort model (assumptions stated in the report).
function wordsOf(s) { return String(s || '').split(/\s+/).filter(Boolean); }
function effortFor(entry) {
    const out = { typedChars: 0, taps: 0 };
    if (entry.kind === 'closer') { out.taps += 1; }
    else if (entry.kind === 'typed') { out.typedChars += entry.text.length; out.taps += 2 + entry.text.length; }
    else if (entry.kind === 'reword') {
        // characters of the words that are new relative to the card (word-level), plus a space each
        const orig = wordsOf(entry.original).map((w) => w.toLowerCase().replace(/[^a-z']/g, ''));
        const pool = [...orig];
        let chars = 0; let replacedWords = 0;
        for (const w of wordsOf(entry.text)) {
            const k = w.toLowerCase().replace(/[^a-z']/g, '');
            const i = pool.indexOf(k);
            if (i >= 0) pool.splice(i, 1); else { chars += w.length + 1; replacedWords++; }
        }
        out.typedChars += chars;
        out.taps += 2 /* choose + second tap to edit */ + replacedWords /* select word */ + chars + 1 /* finish */;
    }
    return out;
}

export async function buildCondition(name, reviewMap, extra = {}) {
    const convos = L.loadConversations();
    const answerLog = [];
    let effort = { typedChars: 0, taps: 0, closer: 0, reword: 0, typed: 0, convos: 0, navTaps: 0 };
    for (const c of convos) {
        const answers = reviewMap[c.id];
        if (!answers) continue;
        const { review, log, turnCount } = buildReview(c, answers);
        c.review = review;
        effort.convos++;
        effort.navTaps += 1 /* open row */ + turnCount /* step through turns */ + 1 /* leave */;
        for (const e of log) {
            const f = effortFor(e);
            effort.typedChars += f.typedChars; effort.taps += f.taps; effort[e.kind]++;
            answerLog.push({ convo: c.id, ...e });
        }
    }
    const { result, block } = await L.voiceBlockFor(convos);
    effort.totalTaps = effort.taps + effort.navTaps + (effort.convos ? 2 : 0);
    return { name, block, harvest: result, answers: answerLog, effort, reviews: Object.fromEntries(convos.filter((c) => c.review).map((c) => [c.id, c.review])), ...extra };
}

function pick(map, ids) { return Object.fromEntries(ids.map((id) => [id, map[id]])); }

export async function allConditions() {
    return {
        K0: await buildCondition('K0', {}),
        K1: await buildCondition('K1', pick(REVIEWS, K_SETS.K1)),
        K3: await buildCondition('K3', pick(REVIEWS, K_SETS.K3)),
        K10: await buildCondition('K10', pick(REVIEWS, K_SETS.K10)),
        K3C: await buildCondition('K3C', REVIEWS_CLOSER_ONLY),
        MOM: await buildCondition('MOM', REVIEWS_MOM_WARM),
    };
}

function lineDiff(a, b) {
    const A = a.split('\n'), B = b.split('\n');
    const SA = new Set(A), SB = new Set(B);
    return { removed: A.filter((l) => !SB.has(l)), added: B.filter((l) => !SA.has(l)) };
}

function ngrams(s, n = 3) {
    const w = String(s).toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
    const out = new Set();
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
    return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('conditions.mjs')) {
    const conds = await allConditions();
    const nullBlock = await L.voiceBlockNullHarvest();
    const summary = {};
    for (const [k, c] of Object.entries(conds)) {
        const d = lineDiff(conds.K0.block, c.block);
        const exLines = c.block.split('\n').filter((l) => /^  "/.test(l));
        summary[k] = {
            blockChars: c.block.length,
            exemplarsHarvested: c.harvest.exemplars.length,
            lengthLean: c.harvest.lengthLean,
            leanSentence: (c.block.match(/Offered a choice of wordings[^\n]*/) || [null])[0],
            counts: c.harvest.counts,
            effort: c.effort,
            diffVsK0: d,
            promptVisibleLineChanges: d.added.length + d.removed.length,
        };
        console.log(`\n##### ${k}`);
        console.log(JSON.stringify(summary[k], null, 1));
    }
    // overlap check: held-out reference vs every authored review answer text
    const answerTexts = Object.values(conds).flatMap((c) => c.answers.filter((a) => a.text).map((a) => a.text));
    const refGrams = new Set(REFERENCE.flatMap((r) => [...ngrams(r)]));
    const overlaps = [];
    for (const t of answerTexts) for (const g of ngrams(t)) if (refGrams.has(g)) overlaps.push({ t, g });
    console.log('\nreference/review 3-gram overlaps:', overlaps);
    const nd = lineDiff(nullBlock, conds.K0.block);
    console.log('\nharvest-null -> K0 diff:', JSON.stringify(nd, null, 1));
    writeFileSync('conditions.json', JSON.stringify({ conds, summary, nullBlock, nullToK0: nd, overlaps }, null, 1));
}

// Ceiling case for closer marks: every card turn in all 17 conversations marked closer
// on the SHORTEST card the user did not take live (50 marks, no typing).
export async function closerEverything() {
    const convos = L.loadConversations();
    const answers = [];
    for (const c of convos) {
        let review = rm.emptyReview(c.id);
        for (const t of rm.buildTurns(c.data)) {
            if (!t.user || t.cards.length < 2) continue;
            const cand = t.cards.map((x, i) => ({ i, n: x.text.split(/\s+/).length })).filter((x) => x.i !== t.took).sort((a, b) => a.n - b.n);
            if (!cand.length) continue;
            review = rm.setCardAnswer(review, t, cand[0].i);
            answers.push({ convo: c.id, key: t.key, kind: 'closer', index: cand[0].i });
        }
        c.review = review;
    }
    const { result, block } = await L.voiceBlockFor(convos);
    return { name: 'CLOSER50', block, harvest: result, answers, effort: { closer: answers.length, typedChars: 0, taps: answers.length, convos: convos.length } };
}
