/*
 * Can a topic's documents help an EVERYDAY conversation? (Ken, November 26 2026.)
 *
 * Today a switched-on topic means question-session answers: four paragraphs drawn from
 * its documents. At a clinic the user wants the ordinary four response options, with
 * their own documents (test results, a medication list, notes for the visit) available
 * as background facts. This runs a made-up clinic visit through the app's REAL
 * suggestion prompt twice per turn:
 *   A - no documents (what the app does today at the clinic)
 *   B - the documents added as background, with a prototype instruction
 * and records the options, the time taken and the size of each request.
 *
 * What a person reads for, per turn:
 *   - does B use a fact from the documents when the turn calls for it, briefly and
 *     correctly?
 *   - does B leave the documents alone when the turn does not call for them?
 *   - does B invent anything that is not in the documents (a flu shot, a number)?
 *   - are B's four options still the usual kinds (agree, decline, raise, repair)?
 *
 * Run:  node --no-warnings scripts/everyday-docs-eval.mjs
 * Needs .anthropic-key (or ANTHROPIC_API_KEY). About 20 requests, well under a dollar.
 * Writes Reports/everyday-docs-eval-<date>.md (git-ignored). The person and documents
 * are made up.
 */
import '../tests/env.mjs';
import { loadApiKey } from '../tests/env.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import * as llm from '../app/js/llm.js';

const PROFILE = `About the user:
- Name: Jordan Reyes. Age: 41. Lives in Columbus, Ohio, with daytime support from an aide.
- Has cerebral palsy and does not speak; uses this app to talk.
- Enjoys baseball (Guardians), audiobooks, and video calls with a younger sister, Dana.`;

const DOCS = [
    { name: 'Lab results, October 28 2026', text: `RIVERSIDE FAMILY CLINIC - LABORATORY REPORT
Patient: Jordan Reyes   DOB: 03/14/1985   Ordering: Dr. Tom Okafor
Collected: 10/28/2026 08:10

HEMOGLOBIN A1C ........ 7.2 %      (ref < 5.7)   HIGH   [prior 05/12/2026: 8.1 %]
GLUCOSE, FASTING ...... 138 mg/dL  (ref 70-99)   HIGH
CHOLESTEROL, TOTAL .... 186 mg/dL  (ref < 200)
LDL ................... 112 mg/dL  (ref < 100)   HIGH
HDL ................... 44 mg/dL   (ref > 40)
TRIGLYCERIDES ......... 151 mg/dL  (ref < 150)   HIGH
CREATININE ............ 0.8 mg/dL  (ref 0.6-1.2)
eGFR .................. > 90
VITAMIN D, 25-OH ...... 19 ng/mL   (ref 30-100)  LOW
TSH ................... 2.1 mIU/L  (ref 0.4-4.0)

Comment: A1C improved since May. Vitamin D low; consider supplement.` },
    { name: 'My medications', text: `Medications I take (updated October 2026)
- Metformin 500 mg, twice a day with meals (started May 2026). Some stomach upset the first month, better now.
- Baclofen 10 mg, three times a day, for muscle tightness.
- Omeprazole 20 mg, once a day in the morning.
- No vitamin D supplement yet.
Allergies: penicillin (rash).` },
    { name: 'Notes for my visit', text: `Things I want to ask Dr. Okafor on November 30:
1. Can I take the metformin as one pill a day instead of two? I forget the evening one.
2. My legs have been tighter in the mornings since September. Should the baclofen change?
3. Do I need a vitamin D pill, and which one?
4. Can my aide pick up prescriptions for me?` },
];

const DOCS_BLOCK = `Documents the user has chosen for this conversation. They are BACKGROUND FACTS ABOUT THE USER, exactly like the profile: use a fact from them only when the other person's turn calls for it, and say it briefly, the way the user would say it out loud - never read a document out, never list values the other person did not ask about, and never add a number, date, name or event that is not in them. If the other person asks about something the documents do not cover, the user does not know it from here: do not guess. The four response options keep their usual kinds. The user's own notes may say what they want to raise; the INITIATIVE option may raise one of those when there is room for it.

${DOCS.map((d) => `=== ${d.name} ===\n${d.text}`).join('\n\n')}`;

const TURNS = [
    { id: 'T1', partner: 'Hi Jordan, good to see you. How have you been?' },
    { id: 'T2', partner: 'So your A1C came back at 7.2. How do you feel about that?' },
    { id: 'T3', partner: 'How are you getting on with the metformin? Any stomach trouble?' },
    { id: 'T4', partner: 'Remind me, what are you taking for the muscle tightness, and how much?' },
    { id: 'T5', partner: 'Do you happen to remember what your cholesterol numbers were?' },
    { id: 'T6', partner: 'Have you had your flu shot this year?' },
    { id: 'T7', partner: 'Any allergies I should know about before I write a new prescription?' },
    { id: 'T8', partner: 'Is there anything else you wanted to ask me about today?' },
    { id: 'T9', partner: "We'll check your blood again in three months. Does that work for you?" },
];

async function ask(turn, withDocs) {
    llm.setWorldviewBlock(withDocs ? `${PROFILE}\n\n${DOCS_BLOCK}` : PROFILE);
    llm.setSituationBlock('The user is talking with: Dr. Tom Okafor, their doctor. The user is at: Riverside Family Clinic.');
    let usage = null;
    llm.onUsage((u) => { usage = u; });
    const t0 = Date.now();
    try {
        const r = await llm.generateResponses([{ role: 'partner', text: turn.partner }], {}, {});
        return { ms: Date.now() - t0, usage, options: r.responses || [] };
    } catch (err) {
        return { ms: Date.now() - t0, usage, error: err.message };
    }
}

function fmtUsage(u) {
    if (!u) return 'size unknown';
    const parts = [];
    for (const [k, v] of Object.entries(u)) if (typeof v === 'number') parts.push(`${k} ${v}`);
    return parts.join(', ');
}

async function run() {
    const key = loadApiKey();
    if (!key) { console.error('No API key: add .anthropic-key or set ANTHROPIC_API_KEY.'); process.exit(1); }
    llm.setApiKey(key);
    const date = new Date().toISOString().slice(0, 10);
    const L = [`# Everyday conversation with a topic's documents - ${date}`, '',
        'A: no documents (today). B: the documents as background facts. Same made-up visit, same prompt otherwise.', ''];
    const times = { A: [], B: [] };
    for (const t of TURNS) {
        L.push(`## ${t.id}`, '', `**Dr. Okafor:** ${t.partner}`, '');
        for (const [label, withDocs] of [['A', false], ['B', true]]) {
            const r = await ask(t, withDocs);
            times[label].push(r.ms);
            L.push(`**${label}** (${(r.ms / 1000).toFixed(1)} s; ${fmtUsage(r.usage)})`, '');
            if (r.error) L.push(`- FAILED: ${r.error}`);
            for (const o of r.options) L.push(`- **${o.slot}:** ${o.text}`);
            L.push('');
            process.stdout.write(`${t.id}${label} `);
        }
    }
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return (s[Math.floor(s.length / 2)] / 1000).toFixed(1); };
    L.splice(3, 0, `Typical wait: A ${med(times.A)} s, B ${med(times.B)} s.`, '');
    mkdirSync('Reports', { recursive: true });
    const out = `Reports/everyday-docs-eval-${date}.md`;
    writeFileSync(out, L.join('\n'));
    console.log(`\nWrote ${out}`);
}

run();
