// Blind pairwise judge. Uses the app's own Anthropic adapter (claude-sonnet-5-5,
// first TEXT block). Each pair is judged in BOTH orders; a win counts only if both
// orders agree, otherwise it is a tie. The key is never printed.
import { readFileSync, writeFileSync } from 'node:fs';
import * as L from './lib.mjs';
import { REFERENCE, HELD_OUT, VARIANT_B } from './spec.mjs';

const MODE = process.argv[2] || 'test';
L.llm.setApiKey(L.env.loadApiKey());
const usage = {};
const gen = JSON.parse(readFileSync('gen.json', 'utf8'));
const R = {};
for (const r of gen.results) R[`${r.cond}|${r.turn}|${r.sample}`] = r;
const TURN = Object.fromEntries([...HELD_OUT, ...VARIANT_B].map((t) => [t.id, t]));

const pref = (r) => (r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0]).text;
const palette = (r) => r.responses.map((x, i) => `${i + 1}. ${x.text}`).join('\n');

const SYS_VOICE = `You compare two candidates in a voice-matching study. A non-speaking 17-year-old named Marc uses a device that suggests what he might say next. You get lines Marc has really said in other situations (his voice reference), the situation, and two candidates. Decide which candidate sounds more like Marc. Judge ONLY voice: word choice, length, rhythm, formality, attitude and humor. Ignore which is more polite, more correct or more helpful, and do not reward copying words from the reference. Reply with exactly one character: A, B, or T (T only if they are equally like him).`;
const SYS_WARM = `You compare two candidate replies. Decide which reply is WARMER toward the person being spoken to: more affectionate, reassuring, or emotionally open. Ignore length and correctness. Reply with exactly one character: A, B, or T (T only if equally warm).`;

function userMsg(kind, turn, a, b, unit) {
    const sit = `Situation: Marc is talking with ${turn.who}. They just said: "${turn.text}"`;
    if (kind === 'warm') return `${sit}\n\nReply A: "${a}"\nReply B: "${b}"\n\nWhich reply is warmer? Answer A, B, or T.`;
    const ref = `Marc's voice reference (lines he has said elsewhere):\n${REFERENCE.map((x) => `- ${x}`).join('\n')}`;
    if (unit === 'palette') return `${ref}\n\n${sit}\n\nThe device shows four suggestions at once and Marc picks one.\n\nSuggestion set A:\n${a}\n\nSuggestion set B:\n${b}\n\nWhich SET sounds more like Marc overall? Answer A, B, or T.`;
    return `${ref}\n\n${sit}\n\nCandidate A: "${a}"\nCandidate B: "${b}"\n\nWhich sounds more like Marc? Answer A, B, or T.`;
}

async function ask(kind, turn, a, b, unit) {
    const { text, usage: u } = await L.anthropic.complete({
        system: kind === 'warm' ? SYS_WARM : SYS_VOICE,
        messages: [{ role: 'user', content: userMsg(kind, turn, a, b, unit) }],
        maxTokens: 400,
    });
    L.addUsage(usage, u);
    const m = String(text || '').trim().toUpperCase().match(/[ABT]/);
    return m ? m[0] : '?';
}

// Returns +1 if `x` wins in both orders, -1 if `y` wins in both, 0 otherwise.
async function judgePair(kind, turn, x, y, unit) {
    if (x.trim() === y.trim()) return { score: 0, identical: true, v: [] };
    const v1 = await ask(kind, turn, x, y, unit);   // x is A
    const v2 = await ask(kind, turn, y, x, unit);   // x is B
    const xWins = (v1 === 'A') + (v2 === 'B');
    const yWins = (v1 === 'B') + (v2 === 'A');
    const score = xWins === 2 ? 1 : yWins === 2 ? -1 : 0;
    return { score, v: [v1, v2] };
}

async function pool(jobs, n) {
    const out = new Array(jobs.length); let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); } }));
    return out;
}

const jobs = [];
const comparisons = [];
function addVoice(name, xCond, xs, yCond, ys, turns, unit) {
    for (const t of turns) for (let k = 0; k < xs.length; k++) {
        const X = R[`${xCond}|${t.id}|${xs[k]}`], Y = R[`${yCond}|${t.id}|${ys[k]}`];
        if (!X || !Y || X.error || Y.error) continue;
        const x = unit === 'palette' ? palette(X) : pref(X);
        const y = unit === 'palette' ? palette(Y) : pref(Y);
        const rec = { name, unit, kind: 'voice', turn: t.id, xCond, xSample: xs[k], yCond, ySample: ys[k], x, y };
        comparisons.push(rec);
        jobs.push(async () => Object.assign(rec, await judgePair('voice', t, x, y, unit)));
    }
}
function addWarm(name, turns, xs, ys, unit) {
    for (const t of turns) for (let k = 0; k < xs.length; k++) {
        const X = R[`MOM|${t.id}|${xs[k]}`], Y = R[`K0|${t.id}|${ys[k]}`];
        const x = unit === 'palette' ? palette(X) : pref(X);
        const y = unit === 'palette' ? palette(Y) : pref(Y);
        const rec = { name, unit, kind: 'warm', turn: t.id, xCond: 'MOM', xSample: xs[k], yCond: 'K0', ySample: ys[k], x, y };
        comparisons.push(rec);
        jobs.push(async () => Object.assign(rec, await judgePair('warm', t, x, y, unit)));
        const rec2 = { ...rec, name: name + '-voice', kind: 'voice' };
        delete rec2.score;
        comparisons.push(rec2);
        jobs.push(async () => Object.assign(rec2, await judgePair('voice', t, x, y, unit)));
    }
}

if (MODE === 'test') {
    addVoice('test', 'K10', [0], 'K0', [0], [HELD_OUT[2]], 'preferred');
} else {
    for (const unit of ['preferred', 'palette']) {
        addVoice('K0b-vs-K0a', 'K0', [3, 4, 5], 'K0', [0, 1, 2], HELD_OUT, unit);
        for (const c of ['K1', 'K3', 'K10', 'CLOSER50']) addVoice(`${c}-vs-K0`, c, [0, 1, 2], 'K0', [0, 1, 2], HELD_OUT, unit);
        // Variant (b): MOM correction vs K0 on the later Mom turn and the later stranger turn
        addWarm('MOM-vs-K0-H2', [VARIANT_B[0]], [0, 1, 2, 3], [0, 1, 2, 3], unit);
        addWarm('MOM-vs-K0-S1', [VARIANT_B[1]], [0, 1, 2, 3], [0, 1, 2, 3], unit);
    }
}

await pool(jobs, 6);
const out = { usage, cost: L.costOf(usage), comparisons };
writeFileSync(MODE === 'test' ? 'judge-test.json' : 'judge.json', JSON.stringify(out, null, 1));
console.log('judge calls', usage.calls, 'cost $' + L.costOf(usage).toFixed(4), usage);
if (MODE === 'test') console.log(JSON.stringify(comparisons, null, 1));
