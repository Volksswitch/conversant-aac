// Test B: review by rewrite, for Marc with Devon and with a blunt-with-Mom Marc.
//   OUT=<scratch> node run-b.mjs check    - write the material and run the checks on it (no API)
//   OUT=<scratch> node run-b.mjs dry      - every call through a stand-in API; per-call checks; habit lists (no cost)
//   OUT=<scratch> node run-b.mjs gap      - the gap check (live): rewrites against the AI's first option
//   OUT=<scratch> node run-b.mjs gen [devon|mom]  - live generation, cells one at a time, + the crude probe
//   OUT=<scratch> node run-b.mjs judge [devon|mom]
//   OUT=<scratch> node run-b.mjs analyze
// Runs in its own process, separately from Test A. The key is never printed or saved.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as T from './testdata.mjs';
import * as C from '../exp-instructions/common.mjs';
import { PARTNERS, EXTRA_SLANG, CRUDE, reviewBlock } from './spec.mjs';

const OUT = join(C.outDir(), 'test-b');
const MAT = join(C.outDir(), 'materials');
mkdirSync(OUT, { recursive: true }); mkdirSync(MAT, { recursive: true });
const MODE = process.argv[2] || 'check';
const ONLY = process.argv[3] || null;
const L = C.ledger(C.outDir());
const anthropic = T.anthropic;
const nativeFetch = globalThis.fetch;   // after every import (testdata.mjs restores fetch while loading)

const CTX = { stt_confidence: null, sequence_stack: [], register: 'ORDINARY', phase: 'BODY', last_user_utterance: null, user_holds_floor_to_lead: false };
const WHO = (p) => ({ name: 'Marc', he: 'he', him: 'him', his: 'his', age: 17, partner: p.judgeName, partnerPron: p.pron });
const COMMON = new Set('a an the i i\'m im you your you\'re it it\'s its is was be to of and or but so that this for on in at with my me we us they he she her him his not no yes do did does don\'t what where when how why who just can could would will i\'ll ok okay oh well up out get got go one all there here then than as if about after before first though'.split(' '));

const base = await T.voiceBlockFor(T.loadConversations());

function situation(p, review) {
    let s = T.situationFor({ personId: p.personId });
    if (p.noProfile) s = s.split(' How this user speaks WITH ')[0];
    const rw = review === 'smallest' ? p.rewrites.filter((r) => r.smallest) : review === 'full' ? p.rewrites : [];
    return rw.length ? `${s}\n${reviewBlock(p, rw)}` : s;
}
const cellRewrites = (p, review) => (review === 'smallest' ? p.rewrites.filter((r) => r.smallest) : review === 'full' ? p.rewrites : []);

// ---- material checks ----------------------------------------------------------------
if (MODE === 'check') {
    const out = { partners: {} };
    const md = ['# Test B material', '', 'Invented for the test. Reference lines are shown only to the judge. No profanity anywhere.', ''];
    // base instructions text, for "not in the base instructions"
    const baseText = base.block + '\n' + T.situationFor({ personId: 'p-devon' }) + '\n' + T.situationFor({ personId: 'p-elena' });
    for (const [id, p] of Object.entries(PARTNERS)) {
        const rw = p.rewrites.map((r) => r.rewrite);
        const ref3 = new Set(p.reference.flatMap((r) => [...C.grams(r, 3)]));
        const shared3 = rw.flatMap((r) => [...C.grams(r, 3)].filter((g) => ref3.has(g)).map((g) => `${r} :: ${g}`));
        const rwTok = new Set(rw.flatMap(C.words));
        const sharedWords = [...new Set(p.reference.flatMap(C.words))].filter((w) => rwTok.has(w) && !COMMON.has(w) && !C.hasItem(baseText, w));
        const perWord = Object.fromEntries(sharedWords.map((w) => [w, p.reference.filter((r) => C.words(r).includes(w)).length]));
        const tooMany = Object.entries(perWord).filter(([, n]) => n > 2);
        const informal = [...C.INFORMAL, ...C.INFORMAL_MW].filter((it) => rw.some((r) => C.hasItem(r, it)));
        const extra = EXTRA_SLANG.filter((it) => rw.some((r) => C.hasItem(r, it)));
        const vul = [...rw, ...p.reference].flatMap((t) => [...C.vulgarHits(t), ...C.mildHits(t)].map((h) => `${t} :: ${h}`));
        const smallestPerConvo = Object.entries(p.rewrites.reduce((a, r) => { a[r.convo] = (a[r.convo] || 0) + (r.smallest ? 1 : 0); return a; }, {}));
        const declines = { smallest: C.pickDeclines(cellRewrites(p, 'smallest').map((r) => r.rewrite)), full: C.pickDeclines(rw) };
        out.partners[id] = { threeWordOverlaps: shared3, sharedDistinctiveWords: perWord, overTwoLines: tooMany, informalInRewrites: informal, otherSlangInRewrites: extra, profanity: vul, smallestPerConvo, declinesPicked: declines,
            declineTurns: p.turns.filter((t) => t.decline).map((t) => t.id) };
        md.push(`## ${p.label}${p.noProfile ? ' (his "how I talk with them" settings for her removed)' : ''}`, '',
            '| conversation | what the partner was doing | partner said | said at the time | rewrite | smallest review |', '|---|---|---|---|---|---|',
            ...p.rewrites.map((r) => `| ${r.convo} | ${r.action} | ${r.partner} | ${r.spoken} | ${r.rewrite} | ${r.smallest ? 'yes' : ''} |`), '',
            'Reference lines (judge only):', '', ...p.reference.map((r) => `- ${r}`), '',
            'New partner turns (* = written to invite a decline):', '', ...p.turns.map((t) => `- ${t.decline ? '* ' : ''}${t.text}`), '',
            `Checks: three-word sequences shared between reference and rewrites: ${shared3.length ? shared3.join('; ') : 'none'}. Shared distinctive words and how many reference lines carry each: ${JSON.stringify(perWord)}${tooMany.length ? ' FAIL' : ' (none in more than 2 lines)'}. Profanity, softened forms included: ${vul.length ? vul.join('; ') : 'none'}.`, '',
            `Casual words in the rewrites, from the INFORMAL lists: ${informal.join(', ')}. Other slang: ${extra.join(', ')}.`, '',
            `Change 3 declines picked by the word list: smallest review ${JSON.stringify(declines.smallest)}; full review ${JSON.stringify(declines.full)}.`, '');
    }
    writeFileSync(join(MAT, 'test-b-material.md'), md.join('\n'));
    writeFileSync(join(MAT, 'test-b-material.json'), JSON.stringify({ PARTNERS, EXTRA_SLANG, CRUDE, checks: out }, null, 1));
    console.log(JSON.stringify(out, null, 1));
    const bad = Object.values(out.partners).some((x) => x.threeWordOverlaps.length || x.overTwoLines.length || x.profanity.length);
    if (bad) { console.log('MATERIAL CHECK FAILED'); process.exit(1); }
}

// ---- generation ----------------------------------------------------------------
function cellsFor(id) {
    const cells = [];
    for (const cond of ['current', 'new']) for (const [review, batch] of [['none', 1], ['none', 2], ['smallest', 1], ['full', 1]]) cells.push({ name: `${id}|${cond}|${review}|b${batch}`, id, cond, review, batch, turns: PARTNERS[id].turns, samples: 4 });
    if (id === 'devon') for (const cond of ['current', 'new']) cells.push({ name: `devon|${cond}|full|crude`, id, cond, review: 'full', batch: 'crude', turns: [CRUDE], samples: 5 });
    return cells;
}

async function runCells(cells, live, file) {
    const results = live && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).results : [];
    const done = new Set(results.filter((r) => !r.error).map((r) => `${r.group}|${r.turn}|${r.sample}`));
    for (const c of cells) {
        const p = PARTNERS[c.id];
        const sit = situation(p, c.review);
        C.state.cond = c.cond; C.state.group = c.name;
        C.state.declines = c.cond === 'new' ? C.pickDeclines(cellRewrites(p, c.review).map((r) => r.rewrite)) : [];
        const call = (turn, s, history) => async () => {
            const key = `${c.name}|${turn.id}|${s}`;
            if (done.has(key)) return null;
            for (let attempt = 1; ; attempt++) {
                if (live) L.guard();
                // Every block set and the request built before the first await.
                T.setStaticBlocks(null);
                T.llm.setVoiceBlock(base.block);
                T.llm.setSituationBlock(sit);
                C.state.tag = key;
                const t0 = Date.now();
                try {
                    const r = await T.llm.generateResponses([...(history || []), { role: 'partner', text: turn.text }], CTX, { perCategory: 1, reason: 'experiment' });
                    return { group: c.name, id: c.id, cond: c.cond, review: c.review, batch: c.batch, turn: turn.id, decline: !!turn.decline, partner: turn.text, sample: s, ms: Date.now() - t0, responses: r.responses, classification: r.classification };
                } catch (e) {
                    if (String(e.message).startsWith('STOP') || attempt >= 3) return { group: c.name, turn: turn.id, sample: s, error: String(e.message).slice(0, 200) };
                    await new Promise((res) => setTimeout(res, 2000 * attempt));
                }
            }
        };
        const jobs = c.turns.flatMap((t) => Array.from({ length: c.samples }, (_, s) => call(t, s, t.history)));
        const first = await jobs[0]();
        const rest = await C.pool(jobs.slice(1), live ? 5 : 8);
        for (const r of [first, ...rest]) if (r) results.push(r);
        if (live) {
            writeFileSync(file, JSON.stringify({ results }, null, 1));
            console.log(c.name, jobs.length, 'calls; total spent $' + L.total().toFixed(3));
            const stop = results.find((r) => r.error && r.error.startsWith('STOP'));
            if (stop) throw new Error(stop.error);
        }
    }
    return results;
}

function checkAll() {
    const fails = [];
    for (const r of C.records) {
        const f = C.checkRecord(r);
        const id = r.group.split('|')[0];
        if (id === 'devon' && !r.system[1].includes('How this user speaks WITH Devon')) f.push('Devon settings missing');
        if (id === 'mom' && r.system[1].includes('How this user speaks WITH Mom')) f.push('Mom settings present');
        const review = r.group.split('|')[2];
        const hasReview = /would rather have said/.test(r.system[1]);
        if ((review === 'none') === hasReview && review !== undefined && !r.group.startsWith('gap')) f.push('review block presence wrong');
        if (f.length) fails.push({ tag: r.tag, f });
    }
    const byGroup = {};
    for (const r of C.records) { const g = byGroup[r.group] ||= { calls: 0, cond: r.cond, hashes: new Set(), declines: r.declines.length ? r.declines : 'none' }; g.calls++; g.hashes.add(r.hash); }
    return { fails, byGroup: Object.fromEntries(Object.entries(byGroup).map(([k, v]) => [k, { ...v, hashes: v.hashes.size }])) };
}

// The rewritten turns, with the earlier turns of their conversation as history.
function gapTurns(id) {
    const p = PARTNERS[id];
    const convos = T.loadConversations();
    return p.rewrites.map((rw, i) => {
        const c = convos.find((x) => x.id === rw.convo);
        const turns = T.reviewModel.buildTurns(c.data);
        const k = turns.findIndex((t) => t.key === rw.key);
        if (k < 0 || turns[k].partnerText !== rw.partner) throw new Error(`turn ${rw.key} not found or text differs`);
        if (!turns[k].user) throw new Error(`turn ${rw.key} has no reply at the time`);
        const history = [];
        for (const t of turns.slice(0, k)) { if (t.partnerText) history.push({ role: 'partner', text: t.partnerText }); if (t.user) history.push({ role: 'user', text: t.user.text }); }
        return { id: `${id}-rw${i + 1}`, text: rw.partner, history, rewrite: rw.rewrite, action: rw.action };
    });
}
const gapCells = (ids) => ids.map((id) => ({ name: `gap|${id}`, id, cond: 'current', review: 'none', batch: 'gap', turns: gapTurns(id), samples: 2 }));

if (MODE === 'dry') {
    C.installWrapper(C.stubFetch());
    T.llm.setApiKey('dry-run-not-a-key');
    await runCells([...gapCells(['devon', 'mom']), ...cellsFor('devon'), ...cellsFor('mom')], false);
    const chk = checkAll();
    C.saveRecords(join(OUT, 'dry-instructions.json'));
    const lists = {};
    for (const id of Object.keys(PARTNERS)) {
        const recs = C.records.filter((r) => r.group.startsWith(id + '|'));
        const rw = PARTNERS[id].rewrites.map((r) => r.rewrite);
        let rest = [...new Set(recs.flatMap((r) => r.system))].join('\n');
        for (const s of rw) rest = rest.split(s).join(' ');
        const ITEMS = [...C.INFORMAL, ...C.INFORMAL_MW];
        const inRw = ITEMS.filter((it) => rw.some((s) => C.hasItem(s, it)));
        const inRest = new Set(ITEMS.filter((it) => C.hasItem(rest, it)));
        // review getting through: rewrite words not in the base (no-review) instructions
        const baseRecs = recs.filter((r) => r.group.split('|')[2] === 'none');
        const baseText = [...new Set(baseRecs.flatMap((r) => r.system))].join('\n');
        // Words the partner's own turns contain are topic, not review, so they do not count.
        const partnerWords = new Set([...PARTNERS[id].turns, ...PARTNERS[id].rewrites.map((r) => ({ text: r.partner }))].flatMap((t) => C.words(t.text)));
        const through = [...new Set(rw.flatMap(C.words))].filter((w) => !COMMON.has(w) && !C.hasItem(baseText, w) && !partnerWords.has(w));
        lists[id] = { seen: inRw.filter((it) => !inRest.has(it)), notSeen: ITEMS.filter((it) => !inRest.has(it) && !inRw.includes(it)), inRewritesButAlsoElsewhere: inRw.filter((it) => inRest.has(it)), reviewThroughWords: through };
    }
    writeFileSync(join(MAT, 'habit-lists-test-b.json'), JSON.stringify(lists, null, 1));
    writeFileSync(join(OUT, 'dry-check.json'), JSON.stringify(chk, null, 1));
    const ex = C.records.find((r) => r.group === 'mom|new|full|b1');
    console.log('--- mom new full, situation part ---\n' + ex.system[1].slice(0, 2500));
    const ex2 = C.records.find((r) => r.group === 'devon|new|smallest|b1');
    const i0 = ex2.system[0].indexOf('How this user says no');
    console.log('\n--- devon new smallest, decline placement ---\n' + ex2.system[0].slice(i0, i0 + 400));
    console.log('\ncalls checked', C.records.length, 'failures', chk.fails.length, JSON.stringify(chk.fails.slice(0, 5)));
    console.log(JSON.stringify(chk.byGroup));
    console.log('habit lists', JSON.stringify(lists));
    if (chk.fails.length) process.exit(1);
}

if (MODE === 'gap') {
    C.installWrapper(nativeFetch);
    T.llm.setApiKey(T.env.loadApiKey());
    T.llm.onUsage((u) => L.add('B-gap-gen', u));
    const ids = ONLY ? [ONLY] : ['devon', 'mom'];
    const tag = process.env.GAP_TAG || 'gap';
    const file = join(OUT, `${tag}-gen.json`);
    const res = (await runCells(gapCells(ids), true, file)).filter((r) => !r.error);
    const chk = checkAll();
    if (chk.fails.length) { console.log('INSTRUCTION CHECK FAILED', JSON.stringify(chk.fails.slice(0, 5))); process.exit(1); }
    const comps = [];
    const jobs = [];
    for (const id of ids) {
        const p = PARTNERS[id];
        for (const t of gapTurns(id)) for (const r of res.filter((x) => x.id === id && x.turn === t.id)) {
            const ai = (r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0]).text;
            jobs.push(async () => { comps.push({ id, turn: t.id, partner: t.text, rewrite: t.rewrite, ai, ...(await C.judgePair(anthropic, L, 'B-gap-judge', WHO(p), p.reference, t.text, t.rewrite, ai, 'preferred')) }); });
        }
    }
    await C.pool(jobs, 6);
    const summary = {};
    for (const id of ids) { const s = C.summarize(comps.filter((c) => c.id === id)); summary[id] = { ...s, goAhead: s.winRate >= 0.7 }; }
    writeFileSync(join(OUT, `${tag}-judge.json`), JSON.stringify({ summary, comps }, null, 1));
    console.log(JSON.stringify(summary, null, 1));
    for (const c of comps) console.log(c.id, c.turn, c.score, '| rewrite:', c.rewrite, '| AI:', c.ai);
    console.log('total spent $' + L.total().toFixed(3));
}

if (MODE === 'gen') {
    C.installWrapper(nativeFetch);
    T.llm.setApiKey(T.env.loadApiKey());
    T.llm.onUsage((u) => L.add('B-gen', u));
    const ids = ONLY ? [ONLY] : ['devon', 'mom'];
    for (const id of ids) {
        await runCells(cellsFor(id), true, join(OUT, `gen-${id}.json`));
        const chk = checkAll();
        C.saveRecords(join(OUT, `instructions-${id}.json`));
        writeFileSync(join(OUT, `instruction-check-${id}.json`), JSON.stringify(chk, null, 1));
        console.log(id, 'instruction check: calls', C.records.length, 'failures', chk.fails.length);
        if (chk.fails.length) { console.log(JSON.stringify(chk.fails.slice(0, 5))); process.exit(1); }
        C.records.length = 0;
    }
}

// ---- judging ------------------------------------------------------------------------
const pref = (r) => (r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0]).text;
const palette = (r) => r.responses.map((x, i) => `${i + 1}. ${x.text}`).join('\n');

if (MODE === 'judge') {
    T.llm.setApiKey(T.env.loadApiKey());
    for (const id of ONLY ? [ONLY] : ['devon', 'mom']) {
        const p = PARTNERS[id];
        const gen = JSON.parse(readFileSync(join(OUT, `gen-${id}.json`), 'utf8')).results.filter((r) => !r.error);
        const R = Object.fromEntries(gen.map((r) => [`${r.group}|${r.turn}|${r.sample}`, r]));
        const jf = join(OUT, `judge-${id}.json`);
        const prev = existsSync(jf) ? JSON.parse(readFileSync(jf, 'utf8')).comparisons : [];
        const have = new Set(prev.map((c) => `${c.name}|${c.unit}|${c.turn}|${c.k}`));
        const comps = [...prev]; const jobs = [];
        const add = (name, xg, yg) => {
            for (const unit of ['preferred', 'palette']) for (const t of p.turns) for (let k = 0; k < 4; k++) {
                const X = R[`${xg}|${t.id}|${k}`], Y = R[`${yg}|${t.id}|${k}`];
                if (!X || !Y || have.has(`${name}|${unit}|${t.id}|${k}`)) continue;
                const x = unit === 'palette' ? palette(X) : pref(X), y = unit === 'palette' ? palette(Y) : pref(Y);
                jobs.push(async () => { comps.push({ name, unit, turn: t.id, decline: !!t.decline, k, xg, yg, x, y, ...(await C.judgePair(anthropic, L, 'B-judge', WHO(p), p.reference, t.text, x, y, unit)) }); });
            }
        };
        for (const cond of ['current', 'new']) {
            add(`${cond}: smallest-vs-none`, `${id}|${cond}|smallest|b1`, `${id}|${cond}|none|b1`);
            add(`${cond}: full-vs-none`, `${id}|${cond}|full|b1`, `${id}|${cond}|none|b1`);
            add(`${cond}: full-vs-smallest`, `${id}|${cond}|full|b1`, `${id}|${cond}|smallest|b1`);
            add(`${cond}: none2-vs-none`, `${id}|${cond}|none|b2`, `${id}|${cond}|none|b1`);
        }
        add('new-none-vs-current-none', `${id}|new|none|b1`, `${id}|current|none|b1`);
        try { await C.pool(jobs, 6); } finally {
            writeFileSync(jf, JSON.stringify({ comparisons: comps }, null, 1));
            console.log(id, 'comparisons', comps.length, 'total spent $' + L.total().toFixed(3));
        }
    }
}

// ---- analysis -----------------------------------------------------------------------
if (MODE === 'analyze') {
    const lists = JSON.parse(readFileSync(join(MAT, 'habit-lists-test-b.json'), 'utf8'));
    const shown = base.block.split('\n').filter((l) => /^ {2}"/.test(l)).map((l) => l.trim().replace(/^"|"$/g, ''));
    const rep = {};
    for (const id of Object.keys(PARTNERS)) {
        const p = PARTNERS[id];
        const gen = JSON.parse(readFileSync(join(OUT, `gen-${id}.json`), 'utf8')).results.filter((r) => !r.error);
        const judge = JSON.parse(readFileSync(join(OUT, `judge-${id}.json`), 'utf8')).comparisons;
        const R = { judge: {}, byTurnType: {}, counts: {}, safety: {}, samples: {}, crude: {} };
        for (const name of [...new Set(judge.map((c) => c.name))]) for (const unit of ['preferred', 'palette']) {
            const rows = judge.filter((c) => c.name === name && c.unit === unit);
            R.judge[`${name} | ${unit}`] = { ...C.summarize(rows), ...(unit === 'preferred' ? { matched: C.matched(rows) } : {}) };
            if (/smallest-vs-none|full-vs-none/.test(name)) for (const [k, f] of [['decline turns', (c) => c.decline], ['other turns', (c) => !c.decline]]) {
                const s = C.summarize(rows.filter(f));
                R.byTurnType[`${name} | ${unit} | ${k}`] = { n: s.n, W: s.W, L: s.L, T: s.T, winRate: s.winRate };
            }
        }
        const L2 = lists[id];
        for (const g of [...new Set(gen.map((r) => r.group))]) {
            const rs = gen.filter((r) => r.group === g);
            const cell = rs[0];
            const rwLines = cellRewrites(p, cell.review).map((r) => r.rewrite);
            const g3 = new Set([...rwLines, ...shown].flatMap((s) => [...C.grams(s, 3)]));
            const g4 = new Set([...rwLines, ...shown].flatMap((s) => [...C.grams(s, 4)]));
            const opts = rs.flatMap((r) => r.responses);
            const per100 = (n) => C.r3((100 * n) / opts.length);
            const decl = rs.filter((r) => r.decline).map((r) => r.responses.find((x) => x.slot === 'DISPREFERRED')).filter(Boolean);
            const withWord = decl.filter((d) => C.itemsIn(d.text, C.DECLINE_WORDS).length);
            const copyDecl = withWord.filter((d) => [...C.grams(d.text, 4)].some((x) => g4.has(x)));
            const habitWords = [...C.INFORMAL, ...C.INFORMAL_MW].filter((it) => p.rewrites.some((r) => C.hasItem(r.rewrite, it)));
            R.counts[g] = {
                options: opts.length,
                habitSeenPer100: per100(opts.reduce((a, o) => a + C.itemsIn(o.text, L2.seen).length, 0)),
                habitNotSeenPer100: per100(opts.reduce((a, o) => a + C.itemsIn(o.text, L2.notSeen).length, 0)),
                five: Object.fromEntries(C.FIVE.map((w) => [w, opts.filter((o) => C.hasItem(o.text, w)).length])),
                declineOptions: decl.length, ownStyleDeclines: withWord.length - copyDecl.length, declineCopies: copyDecl.length,
                softenedDeclines: decl.filter((d) => /\b(love to|like to|wish i could)\b/i.test(d.text)).length,
                noReasonDeclines: decl.filter((d) => C.words(d.text).length <= 3).map((d) => d.text),
                bannedOpeners: opts.filter((o) => C.bannedOpener(o.text)).length,
                ticSets: rs.filter((r) => habitWords.some((w) => r.responses.filter((x) => C.hasItem(x.text, w)).length >= 2)).length,
                copyOptions: opts.filter((o) => [...C.grams(o.text, 3)].some((x) => g3.has(x))).length,
                reviewThroughShare: C.r3(opts.filter((o) => C.words(o.text).some((w) => L2.reviewThroughWords.includes(w))).length / opts.length),
                prefWordsMean: C.r3(rs.reduce((a, r) => a + C.words(pref(r)).length, 0) / rs.length),
            };
            const all = opts.map((o) => o.text);
            R.safety[g] = {
                catchphrases: all.flatMap((t) => C.catchphraseHits(t, T.idiom()).map((h) => `${h} :: ${t}`)),
                unsayable: all.filter((t) => C.unsayable(t).length), vulgarity: all.filter((t) => C.vulgarHits(t).length), mild: all.filter((t) => C.mildHits(t).length),
            };
            if (cell.batch === 'crude') R.crude[g] = rs.map((r) => r.responses.map((x) => `${x.slot}: ${x.text}`));
        }
        for (const g of [...new Set(gen.map((r) => r.group))].filter((g) => !g.endsWith('b2') && !g.endsWith('crude'))) {
            const r = gen.find((x) => x.group === g && x.turn === p.turns[p.turns.findIndex((t) => t.decline)].id && x.sample === 0);
            if (r) R.samples[g] = { partner: r.partner, options: r.responses.map((x) => `${x.slot}: ${x.text}`) };
        }
        rep[id] = R;
    }
    writeFileSync(join(OUT, 'report.json'), JSON.stringify(rep, null, 1));
    for (const [id, R] of Object.entries(rep)) { console.log('=====', id); console.log(JSON.stringify(R.judge, null, 1)); console.log(JSON.stringify(R.counts, null, 1)); }
}
