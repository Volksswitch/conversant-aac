// Absolute fidelity rating (1-5) against the held-out reference, with anchors:
//  - the persona's own UNSEEN-by-generator pool lines (pool lines never shown in C3/C4/C5) = ceiling
//  - the OTHER persona's pool lines = floor
// Sonnet 5.5 judge, thinking off (between_tools), structured output. Writes rate-raw.jsonl.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { CORPUS } from './corpus.mjs';

const ROOT = 'C:/Users/ken/OneDrive/4 T-Z/Volksswitch/AI-driven AAC';
const KEY = process.env.ANTHROPIC_API_KEY || readFileSync(ROOT + '/.anthropic-key', 'utf8').trim();
const GEN = readFileSync(new URL('./gen-raw.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.error);
const BLOCKS = JSON.parse(readFileSync(new URL('./blocks.json', import.meta.url), 'utf8'));
const OUT = new URL('./rate-raw.jsonl', import.meta.url);
const done = new Set();
if (existsSync(OUT)) for (const l of readFileSync(OUT, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); if (r.score) done.add(r.key); }
const PERS = ['marc-delgado', 'grace-thompson'];
const refs = (id) => CORPUS[id].ref.map((t) => `- ${t}`).join('\n');
const SCHEMA = { type: 'object', properties: { score: { type: 'integer', enum: [1, 2, 3, 4, 5] } }, required: ['score'], additionalProperties: false };
const usage = { input: 0, output: 0, calls: 0 };

function prompt(personaId, text) {
    return `Below are sample lines showing how one particular person talks.

${refs(personaId)}

Here is another line:
${text}

How much does this line sound like something THIS person would say? Judge only HOW it is said - length, word choice, slang, formality, rhythm, warmth. Ignore whether its topic or content fits; it may be a reply to anything.
1 = clearly not their way of talking, 3 = could go either way, 5 = sounds exactly like them.
Reply with JSON only: {"score": 1-5}.`;
}

async function call(p) {
    const body = { model: 'claude-sonnet-5-5', max_tokens: 100, thinking: { type: 'between_tools' }, output_config: { format: { type: 'json_schema', schema: SCHEMA } }, messages: [{ role: 'user', content: p }] };
    for (let a = 1; a <= 4; a++) {
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
            if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 150));
            const d = await res.json();
            usage.input += d.usage.input_tokens || 0; usage.output += d.usage.output_tokens || 0; usage.calls++;
            const t = (d.content.find((b) => b.type === 'text') || {}).text || '';
            return { score: JSON.parse(t.match(/\{[\s\S]*\}/)[0]).score, usage: d.usage };
        } catch (e) { if (a === 4) return { error: String(e.message) }; await new Promise((r) => setTimeout(r, 2000 * a)); }
    }
}

const jobs = [];
for (const g of GEN) {
    const pref = (g.responses.find((r) => r.slot === 'PREFERRED') || g.responses[0]).text;
    const key = `gen|${g.persona}|${g.cond}|${g.rep}|${g.turn}`;
    if (!done.has(key)) jobs.push({ key, kind: 'gen', persona: g.persona, cond: g.cond, rep: g.rep, turn: g.turn, text: pref });
}
for (const p of PERS) {
    const shownAnywhereExceptC6 = new Set([...(BLOCKS[`${p}|C4`].exemplarsShown || [])]);
    const unseen = CORPUS[p].pool.filter((t) => !shownAnywhereExceptC6.has(t));
    unseen.forEach((t, i) => { const key = `ceil|${p}|${i}`; if (!done.has(key)) jobs.push({ key, kind: 'ceiling', persona: p, cond: 'CEIL', text: t }); });
    const other = PERS.find((x) => x !== p);
    CORPUS[other].pool.slice(0, 18).forEach((t, i) => { const key = `floor|${p}|${i}`; if (!done.has(key)) jobs.push({ key, kind: 'floor', persona: p, cond: 'FLOOR', text: t }); });
}
console.log('jobs', jobs.length);
let i = 0;
async function worker() { while (i < jobs.length) { const j = jobs[i++]; const r = await call(prompt(j.persona, j.text)); appendFileSync(OUT, JSON.stringify({ ...j, ...r }) + '\n'); } }
await Promise.all([worker(), worker(), worker(), worker(), worker()]);
console.log('USAGE', JSON.stringify(usage));
