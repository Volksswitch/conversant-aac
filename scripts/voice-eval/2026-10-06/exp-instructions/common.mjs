// Shared pieces for the October 6 2026 test of rearranged instructions and review by
// rewrite (scripts/voice-eval/TEST-PLAN-instructions-and-review.md). Used by
// exp-instructions/run-a.mjs (Test A) and exp-rewrite-review/run-b.mjs (Test B).
//
// Nothing here writes under app/. The instruction changes are applied by rewriting the
// outgoing request inside a wrapper around fetch, and only for generation requests
// (those carrying output_config). The fetch options and headers carry the key: they
// are never saved, logged or put in an error message.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REPLACEMENTS, WHOSE_WORDS_WIN, HABIT_SENTENCE, DECLINE_ANCHOR, declinePlacement } from './edits.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// exp-instructions -> 2026-10-06 -> voice-eval -> scripts -> project root
export const ROOT = resolve(HERE, '../../../..');
export const u = (p) => pathToFileURL(join(ROOT, p)).href;

export function outDir() {
    const OUT = process.env.OUT;
    if (!OUT) throw new Error('Set OUT to a folder outside the project (the session scratch folder).');
    if (resolve(OUT).toLowerCase().startsWith(ROOT.toLowerCase())) throw new Error('OUT must be outside the project.');
    mkdirSync(OUT, { recursive: true });
    return OUT;
}

// ---- word lists (copied verbatim from dose-validity/prep.mjs) ---------------------
export const INFORMAL = ['nah', 'yeah', 'yep', 'nope', 'gonna', 'kinda', 'wanna', 'gotta', 'lowkey', 'dude', 'bro', 'man', 'legit', 'sick', 'chill', 'chilling', 'cool', 'literally', 'honestly', 'ugh', 'eh', 'huh', 'whatever', 'wild', 'ya', 'yo', 'totally', 'pretty', 'okay', 'ok', 'stuff', 'lol', 'super', 'awesome', 'sweet', 'haha'];
export const INFORMAL_MW = ['for real', 'not gonna lie', 'real talk', 'no way', 'hard pass', 'fight me', 'i mean', 'no cap', 'my bad', 'i guess'];
export const FIVE = ['nah', 'dude', 'lowkey', 'bro', 'ugh'];
export const POLITE = ['please', 'thank you', 'thanks', 'glad'];
// Change 3's decline words (the plan's list).
export const DECLINE_WORDS = ['nah', 'nope', 'pass', 'not happening', 'not my thing', 'not really', "i'm good"];
export const VULGAR = ['fuck', 'shit', 'damn', 'hell', 'ass', 'crap', 'bitch', 'piss', 'bastard', 'dick', 'frick', 'frickin', 'freaking', 'frigging', 'effing', 'eff', 'wtf'];
export const MILD = ['heck', 'dang', 'darn'];
export const OPENERS = ['ah', 'oh', 'um', 'er', 'well', 'so', 'hmm', 'you know'];
export const INITIALISMS = ['fw', 'idk', 'tbh', 'ngl', 'imo', 'rn', 'afaik'];

export const words = (t) => String(t).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
export const hasItem = (text, item) => {
    const w = words(text);
    if (!item.includes(' ')) return w.includes(item);
    return (' ' + w.join(' ') + ' ').includes(' ' + item + ' ');
};
export const itemsIn = (text, list) => list.filter((it) => hasItem(text, it));
export const informalCount = (t) => itemsIn(t, [...INFORMAL, ...INFORMAL_MW]).length;
export function grams(s, n) {
    const w = words(s); const o = new Set();
    for (let i = 0; i + n <= w.length; i++) o.add(w.slice(i, i + n).join(' '));
    return o;
}
export const vulgarHits = (t) => itemsIn(t, VULGAR);
export const mildHits = (t) => itemsIn(t, MILD);
export function unsayable(t) {
    const s = String(t); const hits = [];
    for (const i of INITIALISMS) if (hasItem(s, i)) hits.push(i);
    if (/\bw\//i.test(s)) hits.push('w/');
    for (const c of ['&', '@', '+', '%']) if (s.includes(c)) hits.push(c);
    if (/\p{Extended_Pictographic}/u.test(s)) hits.push('emoji');
    if (/\*[^*]+\*/.test(s)) hits.push('*text*');
    return hits;
}
export function bannedOpener(t) {
    const w = words(t);
    if (!w.length) return null;
    if (w[0] === 'you' && w[1] === 'know') return 'you know';
    return OPENERS.includes(w[0]) ? w[0] : null;
}
// Whole phrase, any case, the way voice-harvest.redactCatchphrases matches.
export function catchphraseHits(text, phrases) {
    const hits = [];
    for (const p0 of phrases) {
        const p = String(p0).trim().replace(/[.!?,;:]+$/, '').trim();
        if (!p) continue;
        const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(^|[^\\w'])${esc}[.!?,;:]*(?=$|[^\\w'])`, 'i').test(text)) hits.push(p);
    }
    return hits;
}
export const pickDeclines = (lines) => lines.filter((l) => itemsIn(l, DECLINE_WORDS).length > 0);

// ---- the fetch wrapper ---------------------------------------------------------------
// state.cond: 'current' | 'new'. state.declines: the change-3 lines for this batch.
// state.tag: set synchronously just before each generateResponses call (the call
// reaches fetch with no await in between, so the tag read here is the caller's).
export const state = { cond: null, declines: [], tag: null, group: null };
export const records = [];   // { group, cond, tag, hash, system:[t0,t1], messages, original:[o0,o1] }
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function countOf(hay, needle) { let n = 0, i = 0; while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; } return n; }

// Applies the table to the two system texts. Every replacement must find its text
// exactly once across the two blocks, or this throws and the run stops.
export function rewriteSystem(t0, t1, cond, declines) {
    const texts = [t0, t1];
    const apply = (find, repl, id) => {
        const n = countOf(texts[0], find) + countOf(texts[1], find);
        if (n !== 1) throw new Error(`replacement ${id} found its text ${n} times (must be exactly once)`);
        const k = texts[0].includes(find) ? 0 : 1;
        texts[k] = texts[k].replace(find, () => repl);
    };
    for (const r of REPLACEMENTS) {
        if (r.when === 'both' || (r.when === 'new' && cond === 'new')) apply(r.find, r.replace, r.id);
    }
    if (cond === 'new' && declines.length) apply(DECLINE_ANCHOR, DECLINE_ANCHOR + declinePlacement(declines), 'C3-declines');
    return texts;
}

export function installWrapper(downstream) {
    const wrapped = async (url, opts = {}) => {
        let body;
        try { body = typeof opts.body === 'string' ? JSON.parse(opts.body) : null; } catch { body = null; }
        if (!body || !body.output_config) return downstream(url, opts);   // judge and everything else: untouched
        if (!state.cond) throw new Error('generation request with no condition set');
        if (!Array.isArray(body.system) || body.system.length !== 2) throw new Error('expected two system blocks');
        const original = [body.system[0].text, body.system[1].text];
        const [a, b] = rewriteSystem(original[0], original[1], state.cond, state.declines);
        body.system[0].text = a; body.system[1].text = b;   // in place: array and cache_control kept
        if (!body.system[0].cache_control) throw new Error('cache_control lost on block 0');
        records.push({ group: state.group, cond: state.cond, tag: state.tag, hash: sha(a + '\u0000' + b), declines: state.declines.slice(), system: [a, b], messages: body.messages, original });
        return downstream(url, { ...opts, body: JSON.stringify(body) });
    };
    globalThis.fetch = wrapped;
    return wrapped;
}

// The per-call check the plan requires. Returns a list of failures (empty = pass).
export function checkRecord(r) {
    const all = r.system[0] + '\n' + r.system[1];
    const f = [];
    const fancyFixed = rewriteSystem(r.original[0], r.original[1], 'current', []);
    if (r.cond === 'new') {
        if (!all.includes(WHOSE_WORDS_WIN)) f.push('missing WHOSE WORDS WIN');
        if (!all.includes(HABIT_SENTENCE)) f.push('missing habit-word sentence');
        if (all.includes('I wish I could —')) f.push('still has "I wish I could —"');
        if (r.declines.length && !all.includes(declinePlacement(r.declines))) f.push('decline placement missing');
        if (!r.declines.length && all.includes('own ways of saying no')) f.push('decline placement present with none picked');
    } else if (r.cond === 'current') {
        if (!all.includes('I wish I could —')) f.push('current lost "I wish I could —"');
        if (all.includes('WHOSE WORDS WIN')) f.push('current has WHOSE WORDS WIN');
        if (all.includes(HABIT_SENTENCE)) f.push('current has habit sentence');
        if (r.system[0] !== fancyFixed[0] || r.system[1] !== fancyFixed[1]) f.push('current differs from unwrapped prompt by more than the wording fix');
    } else f.push('unknown condition');
    if (all.includes('"What do you fancy doing?"') || all.includes('"what do you fancy?"')) f.push('still says "fancy"');
    return f;
}

export function saveRecords(file) {
    // system + messages + hash only. Never the fetch options or headers.
    writeFileSync(file, JSON.stringify(records.map((r) => ({ group: r.group, cond: r.cond, tag: r.tag, hash: r.hash, declines: r.declines, system: r.system, messages: r.messages })), null, 1));
}

// A stand-in for the API, for the no-cost dry run.
export function stubFetch() {
    return async (url, opts = {}) => {
        const body = JSON.parse(opts.body);
        const reply = body.output_config
            ? JSON.stringify({ partner_action: 'OTHER', turn_status: 'COMPLETE', is_repair_initiator: false, offered_options: [], offered_range: null,
                responses: [{ slot: 'PREFERRED', text: 'stub', hint: 's' }, { slot: 'DISPREFERRED', text: 'stub no', hint: 's' }, { slot: 'INITIATIVE', text: 'stub q?', hint: 's' }, { slot: 'REPAIR', text: 'Sorry?', hint: 's' }],
                missing_facts: [], missing_other: [], heard_uncertain: [] })
            : 'A';
        const data = { content: [{ type: 'text', text: reply }], usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'end_turn' };
        return { ok: true, status: 200, async json() { return data; }, async text() { return JSON.stringify(data); } };
    };
}

// ---- cost ledger, shared across processes through a file in OUT ----------------------
const PRICING = JSON.parse(readFileSync(join(ROOT, 'app/data/pricing.json'), 'utf8'));
export const CAP = 25;
export function costOf(u) {
    const i = PRICING.inputCostPerMillionTokens / 1e6, o = PRICING.outputCostPerMillionTokens / 1e6;
    return (u.input || 0) * i + (u.output || 0) * o + (u.cacheWrite || 0) * i * PRICING.cacheWriteMultiplier + (u.cacheRead || 0) * i * PRICING.cacheReadMultiplier;
}
export function ledger(OUT) {
    const file = join(OUT, 'cost-ledger.json');
    const read = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { entries: {}, total: 0 });
    return {
        add(label, usage) {
            const L = read();
            const e = L.entries[label] ||= { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, calls: 0, cost: 0 };
            for (const k of ['input', 'output', 'cacheWrite', 'cacheRead']) e[k] += usage[k] || 0;
            e.calls++; e.cost = costOf(e);
            L.total = Object.values(L.entries).reduce((a, x) => a + x.cost, 0);
            writeFileSync(file, JSON.stringify(L, null, 1));
            return L.total;
        },
        total() { return read().total; },
        guard() { const t = read().total; if (t >= CAP) throw new Error(`STOP: spending reached $${t.toFixed(2)} (cap $${CAP})`); return t; },
    };
}

// ---- concurrency -----------------------------------------------------------------
export async function pool(jobs, n) {
    const out = new Array(jobs.length); let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); } }));
    return out;
}

// ---- judge -----------------------------------------------------------------------
// From exp-review-moment's judge, made to take the user's name, pronouns and partner.
// who: { name, he, him, his, age (or null), partner (null = anybody, else e.g. 'Devon' or 'his mom'), partnerPron ('him'|'her'), partnerSubj }
export function judgeSystem(who) {
    const agePart = who.age ? `${who.age}-year-old` : 'person';
    if (!who.partner) {
        return `You compare two candidates in a voice-matching study. A non-speaking ${agePart} named ${who.name} uses a device that suggests what ${who.he} might say next. You get lines ${who.name} has really said (${who.his} voice reference), what the other person just said, and two candidates. Decide which candidate sounds more like the way ${who.he} talks. Judge ONLY voice: word choice, length, rhythm, formality, attitude and warmth toward the other person. Ignore which is more polite, more correct or more helpful, and do not reward copying words from the reference. Reply with exactly one character: A, B, or T (T only if they are equally like ${who.him}).`;
    }
    return `You compare two candidates in a voice-matching study. A non-speaking ${agePart} named ${who.name} uses a device that suggests what ${who.he} might say next. You get lines ${who.name} has really said to ${who.partner} (${who.his} voice reference for ${who.partnerPron}), what ${who.partner} just said, and two candidates. Decide which candidate sounds more like the way ${who.name} talks with ${who.partner}. Judge ONLY voice: word choice, length, rhythm, formality, attitude and warmth toward ${who.partnerPron}. Ignore which is more polite, more correct or more helpful, and do not reward copying words from the reference. Reply with exactly one character: A, B, or T (T only if they are equally like ${who.him}).`;
}
export function judgeMessage(who, refLines, partnerText, a, b, unit) {
    const head = who.partner ? `Lines ${who.name} has said to ${who.partner}:` : `Lines ${who.name} has said:`;
    const ref = `${head}\n${refLines.map((x) => `- ${x}`).join('\n')}`;
    const sit = who.partner ? `${cap(who.partner)} just said: "${partnerText}"` : `The other person just said: "${partnerText}"`;
    const how = who.partner ? `the way ${who.name} talks with ${who.partner}` : `the way ${who.name} talks`;
    if (unit === 'palette') return `${ref}\n\n${sit}\n\nThe device shows four suggestions at once and ${who.name} picks one.\n\nSuggestion set A:\n${a}\n\nSuggestion set B:\n${b}\n\nWhich SET sounds more like ${how}? Answer A, B, or T.`;
    return `${ref}\n\n${sit}\n\nCandidate A: "${a}"\nCandidate B: "${b}"\n\nWhich sounds more like ${how}? Answer A, B, or T.`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Asks twice with the order swapped. score +1 = x won both, -1 = y won both, 0 = tie/split.
export async function judgePair(anthropic, ledgerObj, label, who, refLines, partnerText, x, y, unit) {
    if (x.trim() === y.trim()) return { score: 0, identical: true, v: [] };
    const sys = judgeSystem(who);
    const ask = async (a, b) => {
        ledgerObj.guard();
        const { text, usage } = await anthropic.complete({ system: sys, messages: [{ role: 'user', content: judgeMessage(who, refLines, partnerText, a, b, unit) }], maxTokens: 400 });
        ledgerObj.add(label, usage);
        const m = String(text || '').trim().toUpperCase().match(/[ABT]/);
        return m ? m[0] : '?';
    };
    const v1 = await ask(x, y), v2 = await ask(y, x);
    const xw = (v1 === 'A') + (v2 === 'B'), yw = (v1 === 'B') + (v2 === 'A');
    return { v: [v1, v2], score: xw === 2 ? 1 : yw === 2 ? -1 : 0 };
}

// ---- statistics ------------------------------------------------------------------
export function signP(w, l) {
    const n = w + l; if (!n) return 1; const k = Math.min(w, l); let p = 0, c = 1;
    for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i <= k) p += c; }
    return Math.min(1, 2 * p / 2 ** n);
}
// Turn-by-turn (cluster) bootstrap, as in verify-c4/ci.mjs.
export function clusterCI(rows, B = 4000) {
    let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const turns = [...new Set(rows.map((r) => r.turn))];
    const by = Object.fromEntries(turns.map((t) => [t, rows.filter((r) => r.turn === t).map((r) => r.s)]));
    const est = [];
    for (let b = 0; b < B; b++) { let sum = 0, n = 0; for (let i = 0; i < turns.length; i++) { const t = turns[Math.floor(rnd() * turns.length)]; for (const s of by[t]) { sum += s; n++; } } est.push((1 + sum / n) / 2); }
    est.sort((a, b) => a - b);
    return [est[Math.floor(0.025 * B)], est[Math.floor(0.975 * B)]];
}
// rows: [{ turn, score, x, y }] for one comparison and one unit.
export function summarize(rows) {
    const W = rows.filter((r) => r.score === 1).length, L = rows.filter((r) => r.score === -1).length, T = rows.length - W - L;
    const n = rows.length;
    const winRate = n ? (W + 0.5 * T) / n : null;
    const decided = W + L;
    const ci = n ? clusterCI(rows.map((r) => ({ turn: r.turn, s: r.score }))) : [null, null];
    const p = signP(W, L);
    return { n, W, L, T, winRate: r3(winRate), decidedWinRate: decided ? r3(W / decided) : null, tieRate: n ? r3(T / n) : null, signP: r3(p), ci: ci.map(r3), beats: winRate >= 0.65 && p < 0.05 && ci[0] > 0.5 };
}
export const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
// Decided first-option pairs within one word of each other with equal casual-word counts.
export function matched(rows) {
    const m = rows.filter((r) => r.score !== 0 && Math.abs(words(r.x).length - words(r.y).length) <= 1 && informalCount(r.x) === informalCount(r.y));
    if (m.length < 10) return { n: m.length, note: 'too few matched pairs to tell' };
    const W = m.filter((r) => r.score === 1).length;
    return { n: m.length, W, L: m.length - W, winRate: r3(W / m.length) };
}
