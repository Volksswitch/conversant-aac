// The "review by moment" test. Modes:
//   node run.mjs build   - no API calls: builds the four conditions and prints what changes
//   node run.mjs gen     - live generation through the app's own llm.generateResponses
//   node run.mjs judge   - blind pairwise judge, both orders, against the Mom reference
//   node run.mjs analyze - win rates, lengths, copying, leakage
// Outputs go to OUT (default: a folder beside this file named out/). The key is read by
// tests/env.mjs loadApiKey() and never printed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../exp-review/lib.mjs';
import { LESSONS, MOM_REFERENCE, MOM_TURNS, OTHER_TURNS, pairedLessonBlock, bareLessonBlock } from './spec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || join(HERE, 'out');
mkdirSync(OUT, { recursive: true });
const MODE = process.argv[2] || 'build';
const rm = L.reviewModel;

// ---- conditions -----------------------------------------------------------------
async function buildConditions() {
    // K0: the app as it is, with no review.
    const base = await L.voiceBlockFor(L.loadConversations());
    // TODAY: the same answers entered through today's review screen (typed sentences),
    // read by today's harvest into the shared pool of example sentences.
    const convos = L.loadConversations();
    for (const c of convos) {
        const mine = LESSONS.filter((l) => l.convo === c.id);
        if (!mine.length) continue;
        const turns = rm.buildTurns(c.data);
        let review = rm.emptyReview(c.id);
        for (const l of mine) {
            const t = turns.find((x) => x.key === l.key);
            if (!t) throw new Error(`no turn ${l.key} in ${c.id}`);
            if (t.partnerText !== l.partner) throw new Error(`turn text differs at ${l.key}: ${t.partnerText}`);
            review = rm.setTypedAnswer(review, t, l.chosen);
            review = rm.markReached(review, t.index);
        }
        c.review = review;
    }
    const today = await L.voiceBlockFor(convos);
    return {
        K0: { voice: base.block, extra: '' },
        TODAY: { voice: today.block, extra: '', harvest: today.result },
        PAIRED: { voice: base.block, extra: pairedLessonBlock(LESSONS) },
        BARE: { voice: base.block, extra: bareLessonBlock(LESSONS) },
    };
}

// NOPROFILE=1: a user who has not filled in "how I talk with them" for anyone, so the
// situation names the partner and nothing more.
const NOPROFILE = !!process.env.NOPROFILE;
function situationFor(cond, turn) {
    const s = NOPROFILE && turn.personId
        ? L.situationFor(turn).split(' How this user speaks WITH ')[0]
        : L.situationFor(turn);
    // The lessons belong to Mom, so they reach the prompt only when talking with her.
    return cond.extra && turn.personId === 'p-elena' ? `${s}\n${cond.extra}` : s;
}

function grams(s, n = 3) {
    const w = String(s).toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(Boolean);
    const o = new Set(); for (let i = 0; i + n <= w.length; i++) o.add(w.slice(i, i + n).join(' ')); return o;
}

if (MODE === 'build') {
    const C = await buildConditions();
    const lines = (s) => new Set(s.split('\n'));
    const added = [...lines(C.TODAY.voice)].filter((l) => !lines(C.K0.voice).has(l));
    const removed = [...lines(C.K0.voice)].filter((l) => !lines(C.TODAY.voice).has(l));
    console.log('TODAY changes to the shared voice block (sent with EVERY partner):');
    console.log(' added:', added); console.log(' removed:', removed);
    console.log('\nPAIRED adds to the situation block, with Mom only:\n' + C.PAIRED.extra);
    console.log('\nK0 situation for Mom:\n' + situationFor(C.K0, MOM_TURNS[0]));
    const ref = new Set(MOM_REFERENCE.flatMap((r) => [...grams(r)]));
    const hits = LESSONS.flatMap((l) => [...grams(l.chosen)].filter((g) => ref.has(g)).map((g) => `${l.chosen} :: ${g}`));
    console.log('\nreference / lesson 3-gram overlaps:', hits);
    writeFileSync(join(OUT, 'conditions.json'), JSON.stringify(C, null, 1));
}

// ---- generation -----------------------------------------------------------------
const CTX = { stt_confidence: null, sequence_stack: [], register: 'ORDINARY', phase: 'BODY', last_user_utterance: null, user_holds_floor_to_lead: false };

async function pool(jobs, n) {
    const out = new Array(jobs.length); let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); } }));
    return out;
}

if (MODE === 'gen') {
    const C = await buildConditions();
    L.llm.setApiKey(L.env.loadApiKey());
    const usage = {};
    L.llm.onUsage((u) => L.addUsage(usage, u));
    const call = (name, turn, sample) => {
        // Every block is set and the request built before the first await inside
        // generateResponses, so calls running side by side cannot see each other's blocks.
        L.setStaticBlocks(turn.placeId || null);
        L.llm.setVoiceBlock(C[name].voice);
        L.llm.setSituationBlock(situationFor(C[name], turn));
        const t0 = Date.now();
        return L.llm.generateResponses([{ role: 'partner', text: turn.text }], CTX, { perCategory: 1, reason: 'experiment' })
            .then((r) => ({ cond: name, turn: turn.id, sample, ms: Date.now() - t0, responses: r.responses, classification: r.classification }))
            .catch((e) => ({ cond: name, turn: turn.id, sample, ms: Date.now() - t0, error: String(e.message).slice(0, 300) }));
    };
    const plan = [];
    const S = NOPROFILE ? { K0: 6, TODAY: 3, PAIRED: 3 } : { K0: 6, TODAY: 3, PAIRED: 3, BARE: 3 };
    for (const [c, n] of Object.entries(S)) for (const t of MOM_TURNS) for (let s = 0; s < n; s++) plan.push([c, t, s]);
    for (const c of ['K0', 'TODAY']) for (const t of OTHER_TURNS) for (let s = 0; s < 3; s++) plan.push([c, t, s]);
    // One condition at a time: the first call writes the cache entry, the rest read it.
    const results = [];
    for (const name of Object.keys(S)) {
        const mine = plan.filter((p) => p[0] === name);
        results.push(await call(...mine[0]));
        results.push(...await pool(mine.slice(1).map((p) => () => call(...p)), 4));
        console.log(name, mine.length, 'calls; cost so far $' + L.costOf(usage).toFixed(3));
    }
    writeFileSync(join(OUT, 'gen.json'), JSON.stringify({ usage, cost: L.costOf(usage), results }, null, 1));
    const errs = results.filter((r) => r.error);
    console.log('done', results.length, 'calls, errors', errs.length, errs.slice(0, 3), 'cost $' + L.costOf(usage).toFixed(3));
}

// ---- judging --------------------------------------------------------------------
const SYS_VOICE = `You compare two candidates in a voice-matching study. A non-speaking 17-year-old named Marc uses a device that suggests what he might say next. You get lines Marc has really said to his mom (his voice reference for her), what his mom just said, and two candidates. Decide which candidate sounds more like the way Marc talks with his mom. Judge ONLY voice: word choice, length, rhythm, formality, attitude and warmth toward her. Ignore which is more polite, more correct or more helpful, and do not reward copying words from the reference. Reply with exactly one character: A, B, or T (T only if they are equally like him).`;

if (MODE === 'judge') {
    L.llm.setApiKey(L.env.loadApiKey());
    const usage = {};
    const gen = JSON.parse(readFileSync(join(OUT, 'gen.json'), 'utf8'));
    const R = {}; for (const r of gen.results) R[`${r.cond}|${r.turn}|${r.sample}`] = r;
    const pref = (r) => (r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0]).text;
    const palette = (r) => r.responses.map((x, i) => `${i + 1}. ${x.text}`).join('\n');
    const ref = `Lines Marc has said to his mom:\n${MOM_REFERENCE.map((x) => `- ${x}`).join('\n')}`;
    const msg = (turn, a, b, unit) => {
        const sit = `His mom just said: "${turn.text}"`;
        if (unit === 'palette') return `${ref}\n\n${sit}\n\nThe device shows four suggestions at once and Marc picks one.\n\nSuggestion set A:\n${a}\n\nSuggestion set B:\n${b}\n\nWhich SET sounds more like the way Marc talks with his mom? Answer A, B, or T.`;
        return `${ref}\n\n${sit}\n\nCandidate A: "${a}"\nCandidate B: "${b}"\n\nWhich sounds more like the way Marc talks with his mom? Answer A, B, or T.`;
    };
    const ask = async (turn, a, b, unit) => {
        const { text, usage: u } = await L.anthropic.complete({ system: SYS_VOICE, messages: [{ role: 'user', content: msg(turn, a, b, unit) }], maxTokens: 400 });
        L.addUsage(usage, u);
        const m = String(text || '').trim().toUpperCase().match(/[ABT]/);
        return m ? m[0] : '?';
    };
    const comparisons = []; const jobs = [];
    const add = (name, xc, xs, yc, ys, unit) => {
        for (const t of MOM_TURNS) for (let k = 0; k < xs.length; k++) {
            const X = R[`${xc}|${t.id}|${xs[k]}`], Y = R[`${yc}|${t.id}|${ys[k]}`];
            if (!X || !Y || X.error || Y.error) continue;
            const x = unit === 'palette' ? palette(X) : pref(X), y = unit === 'palette' ? palette(Y) : pref(Y);
            const rec = { name, unit, turn: t.id, action: t.action, xc, xs: xs[k], yc, ys: ys[k], x, y };
            comparisons.push(rec);
            jobs.push(async () => {
                if (x.trim() === y.trim()) return Object.assign(rec, { score: 0, identical: true });
                const v1 = await ask(t, x, y, unit), v2 = await ask(t, y, x, unit);
                const xw = (v1 === 'A') + (v2 === 'B'), yw = (v1 === 'B') + (v2 === 'A');
                return Object.assign(rec, { v: [v1, v2], score: xw === 2 ? 1 : yw === 2 ? -1 : 0 });
            });
        }
    };
    for (const unit of ['preferred', 'palette']) {
        add('K0b-vs-K0a', 'K0', [3, 4, 5], 'K0', [0, 1, 2], unit);
        for (const c of ['TODAY', 'PAIRED', 'BARE']) add(`${c}-vs-K0`, c, [0, 1, 2], 'K0', [0, 1, 2], unit);
        add('PAIRED-vs-TODAY', 'PAIRED', [0, 1, 2], 'TODAY', [0, 1, 2], unit);
        add('PAIRED-vs-BARE', 'PAIRED', [0, 1, 2], 'BARE', [0, 1, 2], unit);
    }
    await pool(jobs, 6);
    writeFileSync(join(OUT, 'judge.json'), JSON.stringify({ usage, cost: L.costOf(usage), comparisons }, null, 1));
    console.log('judge calls', usage.calls, 'cost $' + L.costOf(usage).toFixed(3));
}

// ---- analysis -------------------------------------------------------------------
function signP(w, l) {
    const n = w + l; if (!n) return 1; const k = Math.min(w, l); let p = 0, c = 1;
    for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i <= k) p += c; }
    return Math.min(1, 2 * p / 2 ** n);
}

if (MODE === 'analyze') {
    const gen = JSON.parse(readFileSync(join(OUT, 'gen.json'), 'utf8'));
    const judge = JSON.parse(readFileSync(join(OUT, 'judge.json'), 'utf8'));
    const words = (s) => String(s).split(/\s+/).filter(Boolean).length;
    const report = { cost: { gen: gen.cost, judge: judge.cost }, groups: {}, byAction: {}, length: {}, copying: {}, leakage: {}, lengthBias: {} };

    for (const c of judge.comparisons) {
        const g = report.groups[`${c.name} ${c.unit}`] ||= { W: 0, L: 0, T: 0, n: 0 };
        g.n++; if (c.score === 1) g.W++; else if (c.score === -1) g.L++; else g.T++;
        if (c.unit === 'preferred' && c.score) {
            const lb = report.lengthBias[c.name] ||= { decisive: 0, shorterWon: 0, sameLength: 0 };
            const xw = words(c.x), yw = words(c.y);
            lb.decisive++; if (xw === yw) lb.sameLength++; else if ((c.score === 1) === (xw < yw)) lb.shorterWon++;
        }
        if (c.name === 'PAIRED-vs-K0' || c.name === 'TODAY-vs-K0' || c.name === 'K0b-vs-K0a') {
            const a = report.byAction[`${c.name} ${c.unit}`] ||= {};
            const s = a[c.action] ||= { W: 0, L: 0, T: 0 };
            if (c.score === 1) s.W++; else if (c.score === -1) s.L++; else s.T++;
        }
    }
    for (const g of Object.values(report.groups)) { g.winRate = +((g.W + 0.5 * g.T) / g.n).toFixed(2); g.signP = +signP(g.W, g.L).toFixed(3); }

    const lessonGrams = new Set(LESSONS.flatMap((l) => [...grams(l.chosen)]));
    const momIds = new Set(MOM_TURNS.map((t) => t.id));
    for (const r of gen.results.filter((r) => !r.error)) {
        const p = r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0];
        const bucket = momIds.has(r.turn) ? report : null;
        if (bucket) {
            const m = report.length[r.cond] ||= { prefWords: [], cardWords: [] };
            m.prefWords.push(words(p.text)); for (const x of r.responses) m.cardWords.push(words(x.text));
            const cp = report.copying[r.cond] ||= { cards: 0, withLessonPhrase: 0, verbatimLesson: 0, examples: [] };
            for (const x of r.responses) {
                cp.cards++;
                const hit = [...grams(x.text)].filter((g) => lessonGrams.has(g));
                if (hit.length) { cp.withLessonPhrase++; if (cp.examples.length < 6) cp.examples.push(`${r.turn}: ${x.text}  [${hit.join(' | ')}]`); }
                if (LESSONS.some((l) => l.chosen.toLowerCase() === x.text.toLowerCase())) cp.verbatimLesson++;
            }
        } else {
            const lk = report.leakage[r.cond] ||= { cards: 0, withLessonPhrase: 0, examples: [] };
            for (const x of r.responses) {
                lk.cards++;
                const hit = [...grams(x.text)].filter((g) => lessonGrams.has(g));
                if (hit.length) { lk.withLessonPhrase++; if (lk.examples.length < 6) lk.examples.push(`${r.turn}: ${x.text}`); }
            }
        }
    }
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
    const mean = (a) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
    for (const [k, m] of Object.entries(report.length)) report.length[k] = { prefMedian: med(m.prefWords), prefMean: mean(m.prefWords), cardMean: mean(m.cardWords) };

    // Sample palettes for one turn per condition, to read by eye.
    report.samples = {};
    for (const t of ['M2-quiet', 'M3-dishes', 'M6-proud', 'M8-morning']) for (const c of ['K0', 'TODAY', 'PAIRED', 'BARE']) {
        const r = gen.results.find((x) => x.cond === c && x.turn === t && x.sample === 0 && !x.error);
        if (r) (report.samples[t] ||= {})[c] = r.responses.map((x) => `${x.slot}: ${x.text}`);
    }
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report, null, 1));
}
