// Reader check (Ken, November 8 2026): can a reader get the facts right from a document?
//
// A fresh AI reads one document and answers a fixed set of questions from it alone,
// quoting the sentences it relied on. A second call compares each answer with the
// correct answer in reader-questions.json. A WRONG answer points at a passage a person
// could misread too - the November 8 question-session test found three that way in the
// Product Overview (no-internet behavior, ranked options, picked replies as examples).
//
// Part of "sync docs" (step 3c in CLAUDE.md). Reports, never fails: a person decides.
//
// Usage:
//   node scripts/doc-tests/reader-check.mjs                 every document in the bank
//   node scripts/doc-tests/reader-check.mjs "Product Overview" [more name fragments]
//   add --out <file.md> to also write the report to a file
//
// Key from ANTHROPIC_API_KEY or the gitignored .anthropic-key.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DOCS_DIR = path.join(ROOT, 'Documents');
const MODEL = 'claude-sonnet-5-5';
const THINKING = { type: 'between_tools' };   // what the app sends for this model: no thinking
const RATES = { input: 2, output: 10, write: 2.5, read: 0.2 };   // $ per million tokens

const args = process.argv.slice(2);
let outFile = null;
const oi = args.indexOf('--out');
if (oi >= 0) { outFile = args[oi + 1]; args.splice(oi, 2); }

const bank = JSON.parse(fs.readFileSync(path.join(HERE, 'reader-questions.json'), 'utf8'));
const key = process.env.ANTHROPIC_API_KEY
    || fs.readFileSync(path.join(ROOT, '.anthropic-key'), 'utf8').trim();

const wanted = args.length ? args : bank.documents;
const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.docx') && !f.startsWith('~$'));
const targets = [];
for (const frag of wanted) {
    const hit = files.filter((f) => f.toLowerCase().includes(frag.toLowerCase()));
    if (hit.length !== 1) { console.error(`"${frag}": ${hit.length} documents match, need exactly 1`); process.exit(1); }
    targets.push(hit[0]);
}

// Document text in reading order, table cells included (the manuals keep their settings
// in tables, which document.paragraphs alone would miss).
function docText(file) {
    const py = `
import sys, docx
from docx.oxml.ns import qn
d = docx.Document(sys.argv[1])
out = []
for el in d.element.body.iter():
    if el.tag == qn('w:p'):
        t = ''.join(x.text or '' for x in el.iter(qn('w:t')))
        if t.strip(): out.append(t)
sys.stdout.buffer.write('\\n'.join(out).encode('utf-8'))
`;
    return execFileSync('python', ['-c', py, path.join(DOCS_DIR, file)], { maxBuffer: 64 << 20 }).toString('utf8');
}

let totalCost = 0;
async function call(system, user, schema, maxTokens) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
            model: MODEL, max_tokens: maxTokens, thinking: THINKING, system,
            messages: [{ role: 'user', content: user }],
            output_config: { format: { type: 'json_schema', schema } },
        }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    const u = json.usage;
    totalCost += (u.input_tokens * RATES.input + u.output_tokens * RATES.output
        + (u.cache_creation_input_tokens || 0) * RATES.write + (u.cache_read_input_tokens || 0) * RATES.read) / 1e6;
    return JSON.parse(json.content.find((b) => b.type === 'text').text);
}

const READER_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['answers'],
    properties: { answers: { type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['id', 'covered', 'answer', 'quotes'],
        properties: {
            id: { type: 'string' },
            covered: { type: 'boolean' },
            answer: { type: 'string' },
            quotes: { type: 'array', items: { type: 'string' } },
        } } } },
};
const JUDGE_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['verdicts'],
    properties: { verdicts: { type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['id', 'verdict', 'note'],
        properties: {
            id: { type: 'string' },
            verdict: { type: 'string', enum: ['correct', 'wrong', 'incomplete'] },
            note: { type: 'string' },
        } } } },
};

const READER_PROMPT = `You are an ordinary reader who has just been given this document about an app called Conversant AAC. You know nothing about the app except what the document says. Answer each question the way a careful reader would after reading it, using ONLY the document.

For each question:
- "covered": false if the document doesn't answer it at all; then "answer" says what, if anything, a reader might assume.
- "answer": two or three plain sentences.
- "quotes": the exact sentences from the document your answer rests on, copied word for word (at most three). Include any sentence that pulled you toward a wrong reading, even if another sentence corrected it.`;

const JUDGE_PROMPT = `You check a reader's answers about an app against the correct answers, which are true of the app. For each:
- "wrong": the reader's answer states or implies something the correct answer contradicts.
- "incomplete": nothing false, but it misses a point in the correct answer that a reader would need to avoid a mistake.
- "correct": otherwise. Different wording, extra true detail, or leaving out minor detail is still correct.
"note": one plain sentence saying what is wrong or missing; empty when correct.

Judge against what THIS document is for (given below). Leaving out something outside its scope is correct. Only call an answer "incomplete" when a reader of this document would act wrongly or believe something false because of what is missing; leaving out a detail is otherwise correct. A clearly marked note about the beta test (for example, that the project pays for a tester's AI account) is correct, not a contradiction.`;

const report = [];
const say = (s = '') => { report.push(s); console.log(s); };
say(`# Reader check - ${new Date().toISOString().slice(0, 10)}`);
say('');
say('A fresh AI read each document and answered questions from it alone. WRONG means a reader would come away believing something false; the quoted sentences are where to look. Nothing here blocks a sync: a person decides.');

let wrongTotal = 0, gapTotal = 0, incompleteTotal = 0;
const NL = String.fromCharCode(10);
const answerFor = (q, name) => Object.entries(q.aByDoc || {}).find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1] || q.a;
for (const file of targets) {
    const name = file.replace(/^Conversant AAC /, '').replace(/\.docx$/, '');
    const qs = bank.questions.filter((q) => q.docs.includes('*') || q.docs.some((d) => name.toLowerCase().includes(d.toLowerCase())));
    const text = docText(file);
    say('');
    say(`## ${name} (${text.split(/\s+/).length} words, ${qs.length} questions)`);
    let reader, judged;
    try {
        reader = await call(
            [{ type: 'text', text: `${READER_PROMPT}\n\nTHE DOCUMENT:\n${text}`, cache_control: { type: 'ephemeral' } }],
            `Questions:\n${qs.map((q) => `- [${q.id}] ${q.q}`).join('\n')}`, READER_SCHEMA, 6000);
        const byId = new Map(reader.answers.map((a) => [a.id, a]));
        const toJudge = qs.filter((q) => byId.get(q.id)?.covered);
        const scope = Object.entries(bank.scopes || {}).find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1] || '';
        judged = toJudge.length ? await call([{ type: 'text', text: `${JUDGE_PROMPT}

THIS DOCUMENT: ${scope}` }],
            toJudge.map((q) => [`[${q.id}] QUESTION: ${q.q}`, `CORRECT: ${answerFor(q, name)}`,
                `READER: ${byId.get(q.id).answer}`].join(NL)).join(NL + NL),
            JUDGE_SCHEMA, 3000) : { verdicts: [] };
        const verdict = new Map(judged.verdicts.map((v) => [v.id, v]));
        const errors = [], lookAt = [];
        for (const q of qs) {
            const a = byId.get(q.id);
            const right = answerFor(q, name);
            if (!a) { errors.push(`- **NO ANSWER** [${q.id}] ${q.q}`); continue; }
            if (!a.covered) {
                if (q.mustCover) { gapTotal++; errors.push(`- **NOT COVERED** [${q.id}] ${q.q}`, `  - A reader might assume: ${a.answer}`, `  - Correct: ${right}`); }
                continue;
            }
            const v = verdict.get(q.id);
            if (!v || v.verdict === 'correct') continue;
            if (v.verdict === 'incomplete') { incompleteTotal++; lookAt.push(`- [${q.id}] ${v.note}`); continue; }
            wrongTotal++;
            errors.push(`- **WRONG** [${q.id}] ${q.q}`,
                `  - Reader: ${a.answer}`, `  - Correct: ${right}`, `  - Problem: ${v.note}`,
                ...a.quotes.map((s) => `  - From the document: "${s}"`));
        }
        const bad = errors.filter((l) => l.startsWith('- **')).length;
        say(`${qs.length - bad - lookAt.length} of ${qs.length} right; ${bad} wrong or missing; ${lookAt.length} leave something out.`);
        if (errors.length) { say(''); errors.forEach((l) => say(l)); }
        if (lookAt.length) { say(''); say('Leaves something out (lower priority):'); lookAt.forEach((l) => say(l)); }
    } catch (e) {
        say(`FAILED: ${e.message}`);
    }
}
say('');
say(`Totals: ${wrongTotal} wrong, ${incompleteTotal} incomplete, ${gapTotal} not covered where expected. Cost ${(totalCost * 100).toFixed(1)} cents.`);
if (outFile) fs.writeFileSync(outFile, report.join('\n'));
