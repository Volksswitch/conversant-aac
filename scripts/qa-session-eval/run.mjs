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

// Ken's own typed words from the October 11 2026 conversation, used as examples of how
// he talks. The app would draw these from the voice block; there is no Ken profile here.
const VOICE_EXAMPLES = [
    "I think this is a lesser feature if \"on the fly\" works sufficiently well. The variety of possible questions is too great.",
    "If that is the only, or one of the few responses relevant for this category, they could simply be express panel phrases and free up a card.",
    "Note that the sentence structure and word choice that I use in a journal article is different from the choices I would make when answering the questions of an SLP/OT after a presentation.",
    "A place is a reasonable place to start, especially since it can drive the content of the flex band.",
    "Note that there may be an option to consolidate the information outside of the app and on a platform that could better handle the complex processing.",
];

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
    required: ['answers'],
    properties: {
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

const INSTRUCTIONS = `The user is a non-speaking person who uses an AAC device. They have just given a talk and are taking questions from the audience. You write answers they may choose to have the device speak aloud, in their own voice. They pick one by its short label and the full answer is spoken.

Return exactly four answers:
- three of kind "angle": each answers the question from a DIFFERENT part of the material or a different emphasis, in one or two spoken paragraphs (about 80 to 160 words);
- one of kind "short": a brief complete answer in two or three sentences, for when time is short.
Each label is 2 to 6 words naming what that answer covers.

Rules:
1. CONTENT ONLY FROM THE MATERIAL BELOW and the facts about the user. Never add facts, figures, studies, prices or claims that are not in it. If the material does not answer the question, the answers say plainly that the speaker hasn't written about that or doesn't know, and offer what the material does say that is related. Do not guess.
2. NEVER REUSE THE MATERIAL'S WORDING. It was written to be read; these answers are spoken. Take the ideas and say them fresh. Do not copy any sentence or long phrase from it.
3. Speak the way this person talks, in plain spoken American English with contractions, first person. Examples of how they put things:
${VOICE_EXAMPLES.map((s) => '   - ' + s).join('\n')}
   Match the manner, not the topics, and never reuse these sentences.
4. No lead-ins like "Great question" and no closing summary. Answer, then stop.

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

async function ask(question, audienceKey) {
    const body = {
        model: MODEL,
        max_tokens: 3000,
        thinking: THINKING,
        system: [
            { type: 'text', text: INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: `THE AUDIENCE: ${AUDIENCES[audienceKey]}` },
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
    return { ms, usage: u, cost, answers: JSON.parse(block.text).answers, stop: json.stop_reason };
}

const lines = [];
let total = 0;
const times = [];
lines.push('# Question-session test', '');
lines.push(`Run ${new Date().toISOString()}, model ${MODEL}. Documents: ${docs.map((d) => `${d.name} (${words(d.text).length} words)`).join(', ')}.`, '');
lines.push('"Copied" is the longest run of words in an answer that appears word for word in the documents. Under about 6 is ordinary; 10 or more means it is reusing the documents\' wording.', '');

for (const [group, q] of QUESTIONS) {
    lines.push(`## ${q}`, '', `*(${group === 'direct' ? 'answered by the documents' : group === 'partly' ? 'partly covered' : 'not covered'})*`, '');
    for (const aud of Object.keys(AUDIENCES)) {
        let r;
        try { r = await ask(q, aud); }
        catch (e) { lines.push(`### ${aud.toUpperCase()}: FAILED - ${e.message}`, ''); console.error(e.message); continue; }
        total += r.cost; times.push(r.ms);
        lines.push(`### Audience: ${aud === 'slp' ? 'SLPs and OTs' : 'academics'}  (${(r.ms / 1000).toFixed(1)} s, ${r.usage.output_tokens} output tokens, ${(r.cost * 100).toFixed(2)}¢)`, '');
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
console.error('wrote', outPath);
