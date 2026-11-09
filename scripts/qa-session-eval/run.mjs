// Question-session test (Ken, October 11 2026). See "Question sessions after a talk"
// in CLAUDE.md. A PROTOTYPE PROMPT, not the app's: the mode does not exist yet, and
// this measures two things before anything is built - whether four answers in
// paragraphs come back fast enough with the talk's documents in the request, and
// whether they read like the presenter speaking rather than like the documents.
//
// Usage:
//   node scripts/qa-session-eval/run.mjs <out.md> <doc1.txt> [doc2.txt ...]
// The documents are plain text extracted beforehand; they are not kept in the repo
// (the paper carries a home address and phone number).
//
// Key from ANTHROPIC_API_KEY or the gitignored .anthropic-key, like the live tests.

import fs from 'node:fs';
import path from 'node:path';

const MODEL = 'claude-sonnet-5-5';
const THINKING = { type: 'between_tools' };   // what the app sends for this model
const RATES = { input: 2, output: 10, write: 2.5, read: 0.2 }; // $ per million tokens

const [outPath, ...docPaths] = process.argv.slice(2);
if (!outPath || !docPaths.length) {
    console.error('usage: node run.mjs <out.md> <doc1.txt> [doc2.txt ...]');
    process.exit(1);
}
const key = process.env.ANTHROPIC_API_KEY
    || fs.readFileSync(path.resolve('.anthropic-key'), 'utf8').trim();

const docs = docPaths.map((p) => ({ name: path.basename(p), text: fs.readFileSync(p, 'utf8') }));

const AUDIENCES = {
    slp: 'Speech-language pathologists and occupational therapists in clinical practice. They know AAC and their clients well and know little about software. Speak a little more formally than in casual conversation, explain any technical idea in plain terms, and connect answers to clients and therapy where the material allows.',
    academic: 'Academic researchers in AAC and assistive technology. They know the research literature. Speak in a measured, precise way, name the published work the material cites where it is relevant, and be clear about what is a claim versus what has been measured.',
};

const QUESTIONS = [
    ['direct', 'You said words per minute is the wrong thing to focus on. Can you say more about that? Most of us were trained to measure rate.'],
    ['direct', 'How does the device know what to suggest? Where does that come from?'],
    ['direct', "If the AI writes the sentences, how is that still the person's own voice?"],
    ['direct', "Couldn't a user just keep picking the first option to save time? Doesn't that take away their autonomy?"],
    ['direct', "What about the communication partner's privacy? The device is recording what they say."],
    ['direct', 'Does this only work for people who can read?'],
    ['partly', 'How would I start a client on this? What does a first session look like?'],
    ['partly', "What happens when there's no internet, like in a school with restricted Wi-Fi?"],
    ['partly', 'You mentioned eye gaze. Would this work for my clients who use switch scanning?'],
    ['outside', 'Is there any research yet showing this improves outcomes for AAC users?'],
    ['outside', 'What does it cost a family per month?'],
    ['outside', 'Is this covered by Medicaid or insurance?'],
];

const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['unclear_words', 'answers'],
    properties: {
        unclear_words: { type: 'array', items: { type: 'string' } },
        answers: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'kind', 'text'],
                properties: {
                    label: { type: 'string' },
                    kind: { type: 'string', enum: ['angle', 'short'] },
                    text: { type: 'string' },
                },
            },
        },
    },
};

const INSTRUCTIONS = `The user has just given a talk and is taking questions from the audience. You write answers they may choose to have their AAC device speak aloud for them. They pick one by its short label and the full answer is spoken. The answers stay on screen after one is spoken, so the user may pick a second one to go deeper.

Return exactly four answers, in this order:
- FIRST, one of kind "short": a brief complete answer in two or three sentences. It summarizes what the other three cover.
- then three of kind "angle": each goes deeper on a DIFFERENT part of the answer, in one or two spoken paragraphs (about 80 to 160 words).
Each label is 2 to 6 words naming what that answer covers.

Also return "unclear_words": a word or short phrase FROM THE QUESTION only when it is too vague to answer well without asking what the questioner means. Example: in "Is this covered by Medicaid or insurance?", "covered" could mean paid for, approved as a device, or reimbursed as a service, and the right answer depends on which. Most questions are clear enough to answer: return [] for them. Never flag a word just because it could be more specific ("client", "family", "research").

Rules:
1. CONTENT ONLY FROM THE MATERIAL BELOW. Never add facts, figures, studies, prices or claims that are not in it. If the material does not answer the question, say so in these words or close to them: "I don't know, and I haven't thought about it very much." Then offer what the material does say that is related. Do not guess.
2. IF ONLY PART OF THE QUESTION IS ANSWERED BY THE MATERIAL, say which part you can't answer, in the same plain way, and answer the rest. Never let an answer look complete when part of the question went unanswered.
3. IF THE QUESTION RESTS ON SOMETHING THE MATERIAL CONTRADICTS, correct it plainly. For example, the response options are four different kinds of reply and are not ranked, so there is no "first" or "top" option.
4. NEVER REUSE THE MATERIAL'S WORDING. It was written to be read; these answers are spoken. Take the ideas and say them fresh.
5. Plain spoken American English with contractions, first person. No British words or phrasing. No technical or professional terms the material doesn't use itself.
6. Never comment on your own honesty, openness or accuracy, or announce how you are about to say something: no "the honest summary is", "to be honest", "I should be honest about", "I'll be plain", "I want to be precise", "I'd rather tell you than guess", "I take it seriously". People don't talk like that; it sounds formal and self-important. Just say the thing. For not knowing, say "I don't know", "I'm afraid I don't know" or "I'm sorry, I don't know", never "I honestly don't know".
7. Never claim to know about the audience's work, feelings or experience ("I know funding is a big part of your day"). You don't.
8. Don't repeat a point already made in an earlier answer in this session (listed below the audience) unless the question asks about it again. Refer back briefly instead ("as I said a moment ago").
9. No lead-ins like "Great question" and no closing summary. Answer, then stop.

THE MATERIAL (the speaker's own writing):
${docs.map((d) => `=== ${d.name} ===\n${d.text}`).join('\n\n')}`;

function words(s) {
    return s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
}
const sourceWords = words(docs.map((d) => d.text).join(' '));
const sourceGrams = new Map();   // n-gram set by length, built lazily
function gramSet(n) {
    if (!sourceGrams.has(n)) {
        const set = new Set();
        for (let i = 0; i + n <= sourceWords.length; i++) set.add(sourceWords.slice(i, i + n).join(' '));
        sourceGrams.set(n, set);
    }
    return sourceGrams.get(n);
}
// Longest run of words in the answer that appears word for word in the material.
function longestCopied(text) {
    const w = words(text);
    let best = 0, bestRun = '';
    for (let n = 4; n <= 40; n++) {
        const set = gramSet(n);
        let found = '';
        for (let i = 0; i + n <= w.length; i++) {
            const g = w.slice(i, i + n).join(' ');
            if (set.has(g)) { found = g; break; }
        }
        if (!found) break;
        best = n; bestRun = found;
    }
    return { length: best, run: bestRun };
}

async function ask(question, audienceKey, spoken) {
    const body = {
        model: MODEL,
        max_tokens: 3000,
        thinking: THINKING,
        system: [
            { type: 'text', text: INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: `THE AUDIENCE: ${AUDIENCES[audienceKey]}

ALREADY SAID IN THIS SESSION:
${spoken.length ? spoken.map((x) => `- Asked: ${x.q}
  Answered: ${x.a}`).join(String.fromCharCode(10)) : '(nothing yet)'}` },
        ],
        messages: [{ role: 'user', content: `A member of the audience asks: "${question}"` }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    };
    const t0 = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
    });
    const ms = Date.now() - t0;
    const json = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    const block = json.content.find((b) => b.type === 'text');
    const u = json.usage;
    const cost = (u.input_tokens * RATES.input + u.output_tokens * RATES.output
        + (u.cache_creation_input_tokens || 0) * RATES.write + (u.cache_read_input_tokens || 0) * RATES.read) / 1e6;
    const out = JSON.parse(block.text);
    return { ms, usage: u, cost, answers: out.answers, unclear: out.unclear_words || [], stop: json.stop_reason };
}

const lines = [];
const spokenBy = { slp: [], academic: [] };   // the short answer is treated as spoken
let total = 0;
const times = [];
lines.push('# Question-session test', '');
lines.push(`Run ${new Date().toISOString()}, model ${MODEL}. Documents: ${docs.map((d) => `${d.name} (${words(d.text).length} words)`).join(', ')}.`, '');
lines.push('"Copied" is the longest run of words in an answer that appears word for word in the documents. Under about 6 is ordinary; 10 or more means it is reusing the documents\' wording.', '');

const ONLY = process.env.QS_ONLY;   // optional: rerun only questions containing this text
for (const [group, q] of QUESTIONS.filter(([, q]) => !ONLY || ONLY.split('|').some((o) => q.includes(o)))) {
    lines.push(`## ${q}`, '', `*(${group === 'direct' ? 'answered by the documents' : group === 'partly' ? 'partly covered' : 'not covered'})*`, '');
    for (const aud of Object.keys(AUDIENCES)) {
        let r;
        try { r = await ask(q, aud, spokenBy[aud]); }
        catch (e) { lines.push(`### ${aud.toUpperCase()}: FAILED - ${e.message}`, ''); console.error(e.message); continue; }
        total += r.cost; times.push(r.ms);
        lines.push(`### Audience: ${aud === 'slp' ? 'SLPs and OTs' : 'academics'}  (${(r.ms / 1000).toFixed(1)} s, ${r.usage.output_tokens} output tokens, ${(r.cost * 100).toFixed(2)}¢)`, '');
        if (r.unclear.length) lines.push(`*Clarifying buttons: ${r.unclear.map((w) => `"What do you mean by '${w}'?"`).join(', ')}*`, '');
        const short = r.answers.find((a) => a.kind === 'short');
        if (short) spokenBy[aud].push({ q, a: short.text });
        for (const a of r.answers) {
            const c = longestCopied(a.text);
            lines.push(`**${a.label}** (${a.kind}, ${words(a.text).length} words, copied ${c.length}${c.length >= 10 ? ` - "${c.run}"` : ''})`, '', a.text, '');
        }
        console.error(`${aud} ${(r.ms / 1000).toFixed(1)}s  ${q.slice(0, 50)}`);
    }
}
times.sort((a, b) => a - b);
const med = times[Math.floor(times.length / 2)];
lines.splice(2, 0, `**Wait for a full set of four answers: median ${(med / 1000).toFixed(1)} s, range ${(times[0] / 1000).toFixed(1)} to ${(times[times.length - 1] / 1000).toFixed(1)} s. Total cost ${(total * 100).toFixed(0)}¢ for ${times.length} sets.**`, '');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'));
// Report British wording, since the answers are meant to be American English.
const { execFileSync } = await import('node:child_process');
const { fileURLToPath } = await import('node:url');
console.error(execFileSync(process.execPath, [fileURLToPath(new URL('./british-check.mjs', import.meta.url)), outPath]).toString().trim());
console.error('wrote', outPath);
