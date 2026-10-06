// Judge phase: blind persona identification + pairwise vs C0. Raw fetch to /v1/messages.
// Reads gen-raw.jsonl, writes judge-raw.jsonl (resumable). Never prints the key.
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { CORPUS } from './corpus.mjs';

const ROOT = 'C:/Users/ken/OneDrive/4 T-Z/Volksswitch/AI-driven AAC';
let KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) KEY = readFileSync(ROOT + '/.anthropic-key', 'utf8').trim();

const GEN = readFileSync(new URL('./gen-raw.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((r) => !r.error);
const OUT = new URL('./judge-raw.jsonl', import.meta.url);
const done = new Set();
if (existsSync(OUT)) for (const l of readFileSync(OUT, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); if (r.answer) done.add(r.key); }

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rnd = seeded(20261006);

const PERSONAS = ['marc-delgado', 'grace-thompson'];
const refs = (id) => CORPUS[id].ref.map((t) => `- ${t}`).join('\n');

const SCHEMA_AB = { type: 'object', properties: { answer: { type: 'string', enum: ['A', 'B'] }, confidence: { type: 'integer' } }, required: ['answer', 'confidence'], additionalProperties: false };
const SCHEMA_XY = { type: 'object', properties: { answer: { type: 'string', enum: ['X', 'Y'] } }, required: ['answer'], additionalProperties: false };

const usageTotals = {};
async function call(model, prompt, schema) {
    const body = { model, max_tokens: 200, messages: [{ role: 'user', content: prompt }] };
    if (model === 'claude-sonnet-5-5') { body.thinking = { type: 'between_tools' }; body.output_config = { format: { type: 'json_schema', schema } }; }
    for (let attempt = 1; attempt <= 4; attempt++) {
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
            if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status} ${t.slice(0, 200)}`); }
            const data = await res.json();
            const u = data.usage || {};
            const ut = usageTotals[model] || (usageTotals[model] = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, calls: 0 });
            ut.input += u.input_tokens || 0; ut.output += u.output_tokens || 0; ut.cacheWrite += u.cache_creation_input_tokens || 0; ut.cacheRead += u.cache_read_input_tokens || 0; ut.calls++;
            const block = (data.content || []).find((b) => b.type === 'text');
            const text = block ? block.text : '';
            const m = text.match(/\{[\s\S]*\}/);
            const parsed = m ? JSON.parse(m[0]) : null;
            return { parsed, usage: u, raw: text };
        } catch (err) {
            if (attempt === 4) return { error: String(err.message) };
            await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
    }
}

function identPrompt(textBlock, aId) {
    const bId = aId === PERSONAS[0] ? PERSONAS[1] : PERSONAS[0];
    return `This is a blind authorship test. Below are sample lines from two different people, Person A and Person B. The samples show how each person talks; their topics are deliberately unrelated to the text you will judge.

Person A:
${refs(aId)}

Person B:
${refs(bId)}

${textBlock}

Which person most likely said it? Judge only by HOW it is said - length, word choice, slang, formality, rhythm, warmth - not by what it is about. Reply with JSON only: {"answer": "A" or "B", "confidence": 1 to 5}.`;
}

function pairPrompt(personaId, partner, x, y) {
    return `Below are sample lines showing how one particular person talks.

${refs(personaId)}

Someone said to this person: "${partner}"

Here are two possible replies.
X: ${x}
Y: ${y}

Which reply sounds more like something THIS person would say? Judge only by HOW it is said - length, word choice, slang, formality, rhythm, warmth - not by whether its content is better. Reply with JSON only: {"answer": "X" or "Y"}.`;
}

const jobs = [];
for (const g of GEN) {
    const pref = (g.responses.find((r) => r.slot === 'PREFERRED') || g.responses[0]);
    const four = g.responses.slice(0, 4).map((r) => r.text);
    const base = `${g.persona}|${g.cond}|${g.rep}|${g.turn}`;
    for (const model of ['claude-sonnet-5-5', 'claude-haiku-4-5']) {
        for (const kind of ['pref', 'all4']) {
            const key = `ident|${model}|${kind}|${base}`;
            if (done.has(key)) continue;
            const aIsTrue = rnd() < 0.5;
            const aId = aIsTrue ? g.persona : PERSONAS.find((p) => p !== g.persona);
            const textBlock = kind === 'pref'
                ? `TEXT (a reply to "${g.partner}"):\n${pref.text}`
                : `TEXT (four alternative replies to "${g.partner}" - all written for the same person; treat them together):\n${four.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
            jobs.push({ key, type: 'ident', model, kind, persona: g.persona, cond: g.cond, rep: g.rep, turn: g.turn, aId, prompt: identPrompt(textBlock, aId), schema: SCHEMA_AB });
        }
    }
}
// POSITIVE CONTROL: the persona's own pool lines (authored in-voice, never in the
// reference set). If the judge cannot identify these, the instrument cannot see voice.
for (const p of PERSONAS) CORPUS[p].pool.forEach((line, idx) => {
    for (const model of ['claude-sonnet-5-5', 'claude-haiku-4-5']) {
        const key = `ident|${model}|poolctl|${p}|POOL|1|${idx}`;
        if (done.has(key)) continue;
        const aIsTrue = rnd() < 0.5;
        const aId = aIsTrue ? p : PERSONAS.find((x) => x !== p);
        jobs.push({ key, type: 'ident', model, kind: 'poolctl', persona: p, cond: 'POOL', rep: 1, turn: String(idx), aId, prompt: identPrompt(`TEXT:\n${line}`, aId), schema: SCHEMA_AB });
    }
});
// pairwise vs C0 rep1 (Sonnet judge only)
const c0 = {};
for (const g of GEN) if (g.cond === 'C0' && g.rep === 1) c0[`${g.persona}|${g.turn}`] = g;
for (const g of GEN) {
    if (g.cond === 'C0' && g.rep === 1) continue;
    const ref = c0[`${g.persona}|${g.turn}`];
    if (!ref) continue;
    const key = `pair|claude-sonnet-5-5|${g.persona}|${g.cond}|${g.rep}|${g.turn}`;
    if (done.has(key)) continue;
    const condText = (g.responses.find((r) => r.slot === 'PREFERRED') || g.responses[0]).text;
    const c0Text = (ref.responses.find((r) => r.slot === 'PREFERRED') || ref.responses[0]).text;
    const condIsX = rnd() < 0.5;
    jobs.push({ key, type: 'pair', model: 'claude-sonnet-5-5', persona: g.persona, cond: g.cond, rep: g.rep, turn: g.turn, condIsX, condText, c0Text,
        prompt: pairPrompt(g.persona, g.partner, condIsX ? condText : c0Text, condIsX ? c0Text : condText), schema: SCHEMA_XY });
}

console.log('jobs', jobs.length);
let i = 0;
async function worker() {
    while (i < jobs.length) {
        const j = jobs[i++];
        const r = await call(j.model, j.prompt, j.schema);
        const rec = { key: j.key, type: j.type, model: j.model, kind: j.kind, persona: j.persona, cond: j.cond, rep: j.rep, turn: j.turn };
        if (r.error || !r.parsed) { rec.error = r.error || ('unparsed: ' + (r.raw || '').slice(0, 200)); }
        else if (j.type === 'ident') {
            rec.answer = r.parsed.answer; rec.confidence = r.parsed.confidence; rec.aId = j.aId;
            const picked = r.parsed.answer === 'A' ? j.aId : PERSONAS.find((p) => p !== j.aId);
            rec.pickedPersona = picked; rec.correct = picked === j.persona;
        } else {
            rec.answer = r.parsed.answer; rec.condIsX = j.condIsX; rec.condWins = (r.parsed.answer === 'X') === j.condIsX;
            rec.condText = j.condText; rec.c0Text = j.c0Text;
        }
        rec.usage = r.usage || null;
        appendFileSync(OUT, JSON.stringify(rec) + '\n');
    }
}
await Promise.all([worker(), worker(), worker(), worker(), worker()]);
console.log('USAGE', JSON.stringify(usageTotals));
writeFileSync(new URL('./judge-usage-run-' + Date.now() + '.json', import.meta.url), JSON.stringify(usageTotals, null, 2));
