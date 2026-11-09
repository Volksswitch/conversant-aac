/*
 * QUESTION SESSIONS — the prompt and the reading of its reply (Ken, November 2026).
 *
 * The user has given a talk and is taking audience questions. Instead of the usual four
 * KINDS of reply, each question gets four ANSWERS drawn from documents the user chose for
 * the talk: a short one first that sums up the other three, then three that each go
 * deeper on a different part. See "Question sessions after a talk" in CLAUDE.md and
 * Documents/Conversant AAC Question Sessions Design.docx.
 *
 * Pure: builds the request and reads the reply, and knows nothing about the network.
 * llm.generateAnswers sends it through the provider seam like every other request.
 *
 * ⚠ THE INSTRUCTIONS ARE THE TESTED PROTOTYPE, word for word
 * (scripts/qa-session-eval/run.mjs, run October 11, November 8 and November 9 2026).
 * Each rule is there because a test caught the AI doing the thing it forbids. Change a
 * rule only with a re-run of that script to show the change helped, and change it in
 * both places.
 *
 * ⚠ THE MATERIAL GOES IN THE CACHED BLOCK. It is tens of thousands of words, the same
 * for every question in a talk, so after the first question it is billed at a tenth.
 * Anything that changes per question (the audience is small and stays with it in the
 * prototype; what has already been said changes every time) goes in the second block,
 * or every question would discard the cache.
 */

// What the reply must look like. The service enforces it, so a reply that carries on
// the conversation instead of answering (the October 2026 failure) cannot happen.
export const ANSWERS_SCHEMA = {
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

// Four, always: the two-per-category setting does not apply here (Ken, November 8 2026).
export const ANSWER_COUNT = 4;

// Used when the talk has no note. Rule 10's own default, stated where the note would go
// so the AI is never left to guess (Ken, November 9 2026).
export const NO_NOTE = "(No note was given. Assume the speaker is not one of the people the material describes.)";

// The rules, from the prototype. `extraRules` are the app's standing rules for anything
// spoken aloud (sayable words, no vulgarity), appended after the prototype's own.
function instructions(extraRules) {
    return `The user has just given a talk and is taking questions from the audience. You write answers they may choose to have their AAC device speak aloud for them. They pick one by its short label and the full answer is spoken. The answers stay on screen after one is spoken, so the user may pick a second one to go deeper.

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
10. "I" AND "MY" MEAN THE SPEAKER, AND ONLY IN THE ROLE THE NOTE BELOW GIVES THEM. The material describes things (a product, the people who use it, a method, a condition) that the speaker may or may not be part of. Describe those in the third person: "the person using it", "their people", "their device". Never say the speaker uses, owns, has, or has done something the material describes unless the note says so. If the note doesn't say, assume the speaker is not one of the people the material describes.${(extraRules || []).filter(Boolean).map((r) => `\n\n${r}`).join('')}`;
}

/**
 * Build the request for one audience question.
 *
 *   question     what the audience member asked (the partner's words)
 *   material     [{ name, text }] — the talk's documents, as plain text
 *   speakerNote  how the presenter relates to the material; NO_NOTE when blank
 *   audience     how to pitch the answers for this audience; blank says nothing
 *   alreadySaid  [{ q, a }] — answers already SPOKEN in this session, oldest first
 *   extraRules   standing rules for spoken text, from llm.js
 *   avoid        answers already offered for this question ("New 4"), to differ from
 *   steer        guidance the user typed and sent with Reframe
 *
 * avoid and steer are additions to the tested prototype, and both go in the second
 * block, never the cached one. A typed steer is the user's own words, so a fact in it
 * may be used even though it is not in the material, exactly as in everyday Reframe.
 *
 * Returns { system, messages, maxTokens, schema } for the provider seam.
 */
export function buildAnswerRequest({ question, material = [], speakerNote = '', audience = '', alreadySaid = [], extraRules = [], avoid = [], steer = '' }) {
    const note = String(speakerNote || '').trim() || NO_NOTE;
    const docs = (material || []).filter((d) => d && String(d.text || '').trim());
    const cached = `${instructions(extraRules)}

THE SPEAKER AND THIS MATERIAL: ${note}

THE MATERIAL (chosen by the speaker for this talk; not necessarily about the speaker):
${docs.map((d) => `=== ${d.name} ===\n${d.text}`).join('\n\n')}`;

    const said = (alreadySaid || []).filter((x) => x && x.a);
    const turn = `THE AUDIENCE: ${String(audience || '').trim() || '(not described)'}

ALREADY SAID IN THIS SESSION:
${said.length ? said.map((x) => `- Asked: ${x.q || '(not heard)'}\n  Answered: ${x.a}`).join('\n') : '(nothing yet)'}${avoidBlock(avoid)}${steerBlock(steer)}`;

    return {
        system: [{ text: cached, cache: true }, { text: turn }],
        messages: [{ role: 'user', content: `A member of the audience asks: "${String(question || '').trim()}"` }],
        // Four answers of up to ~160 words, plus labels: the prototype never came near.
        maxTokens: 3000,
        schema: ANSWERS_SCHEMA,
    };
}

/**
 * Read the reply. Returns { answers: [{ label, kind, text }], unclearWords: [] } with the
 * short answer first and at most four answers.
 *
 * ⚠ IT PUTS THE SHORT ANSWER FIRST ITSELF rather than trusting the order. The short one
 * is the answer that sums up the rest, and its place on screen is what the user learns;
 * a reply that put it third would otherwise move it. A reply with no short answer at all
 * keeps its order, since there is nothing to move.
 */
export function parseAnswers(text) {
    let obj;
    try {
        obj = JSON.parse(String(text || '').trim());
    } catch {
        throw new Error('the answers could not be read');
    }
    const raw = Array.isArray(obj && obj.answers) ? obj.answers : [];
    const answers = raw
        .filter((a) => a && typeof a.text === 'string' && a.text.trim())
        .map((a) => ({
            label: String(a.label || '').trim() || shortLabel(a.text),
            kind: a.kind === 'short' ? 'short' : 'angle',
            text: a.text.trim(),
        }));
    if (!answers.length) throw new Error('the reply held no answers');
    const shortAt = answers.findIndex((a) => a.kind === 'short');
    if (shortAt > 0) answers.unshift(answers.splice(shortAt, 1)[0]);
    // Words the questioner should be asked about. Only short, real phrases: a long one is
    // not a word too vague to answer, it is the AI quoting the question back.
    const unclearWords = (Array.isArray(obj.unclear_words) ? obj.unclear_words : [])
        .map((w) => String(w || '').trim())
        .filter((w) => w && w.split(/\s+/).length <= 4);
    return { answers: answers.slice(0, ANSWER_COUNT), unclearWords: [...new Set(unclearWords)] };
}

/**
 * The answers as response cards for the engine: the label is the card's short form,
 * the full answer is what is spoken. Slots match engine.SLOT.ANSWER_SHORT / ANSWER.
 */
export function answersToResponses(answers) {
    return (answers || []).map((a) => ({
        slot: a.kind === 'short' ? 'ANSWER_SHORT' : 'ANSWER',
        text: a.text,
        hint: a.label,
    }));
}

/**
 * An answer split into the sentences it is spoken in (Ken, November 9 2026: a tap
 * pauses an answer and a later tap continues it from the start of the sentence it was
 * in). Speaking one sentence at a time is what tells the app exactly which sentence was
 * playing, on every voice, with nothing estimated.
 *
 * Uses the browser's own sentence splitter where there is one, which knows that "Dr."
 * does not end a sentence; otherwise a plain split after . ! or ? and a space. Never
 * loses a word: the pieces joined back together are the whole answer.
 */
export function splitSentences(text) {
    const t = String(text || '').trim();
    if (!t) return [];
    let parts = null;
    try {
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            parts = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(t)]
                .map((s) => s.segment.trim()).filter(Boolean);
        }
    } catch { parts = null; }
    if (!parts) parts = t.split(/(?<=[.!?]["”']?)\s+/).map((s) => s.trim()).filter(Boolean);
    // A "sentence" of one or two words ("Yes." "No.") is joined to the next, so a
    // pause never resumes on a fragment that makes no sense alone.
    const out = [];
    for (const p of parts) {
        if (out.length && out[out.length - 1].split(/\s+/).length < 3) out[out.length - 1] += ` ${p}`;
        else out.push(p);
    }
    return out;
}

/*
 * A CHECK ON EACH ANSWER AFTER IT IS WRITTEN (Ken, November 9 2026: "word check, then
 * rewrite"). The tests showed the AI still slips now and then despite the rules, and
 * runs vary, so instructions alone are not enough. This is the free half: a list of
 * known slips, checked as each set of answers arrives. A flagged answer is then
 * rewritten by the AI in the background (llm.rewriteAnswer); the original stays on
 * screen meanwhile.
 *
 * Every entry here was seen in a real test run, or is a rule in the prompt stated as
 * words. Keep it to forms with no innocent reading in an answer, or the check rewrites
 * good answers and costs money for nothing. "Honestly" is included because rule 6 bans
 * it outright ("never 'I honestly don't know'").
 */
// ⚠ NARROW ON PURPOSE, MEASURED (November 9 2026): run over the 129 real answers from the
// November 8 and 9 tests, a bare "honest" caught "three things keep it honest" and "an
// honest partner", and a "first option" rule caught the AI CORRECTLY saying "there's no
// first option" (rule 3 working) and describing the article's own worry about the first
// option. A rewrite there could remove a correct correction, so that rule was dropped.
const SELF_TALK = [
    /\bto be (?:honest|frank|clear|precise)\b/i,
    /\bhonestly\b/i,
    /\bthe honest (?:summary|answer|truth|version|picture)\b/i,
    /\bin all honesty\b/i,
    /\b(?:frankly|candidly)\b/i,
    /\btruth be told\b/i,
    /\bI(?:'ll| will| want to| should| need to| have to)? be (?:plain|careful|precise|clear|straight|direct|upfront)\b/i,
    /\bI'd (?:say )?plainly\b/i,
    /\blet me be (?:clear|plain|precise|careful|honest)\b/i,
    /\bI'd rather tell you than guess\b/i,
    /\bI take (?:it|that|this) seriously\b/i,
];
const AUDIENCE = [
    /\bI know (?:how |that )?(?:you|your|funding|this is)\b/i,
    /\bas (?:you|all of you|many of you) (?:all )?know\b/i,
    /\bI'm sure (?:you|many of you)\b/i,
];
const LEAD_IN = [/^(?:that's an? )?(?:great|good|excellent|interesting) question\b/i];
const NOT_WRITTEN = [/\bI haven't written about\b/i];

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let britishCache = null;
function britishMatchers(lists) {
    if (!lists) return null;
    if (britishCache && britishCache.lists === lists) return britishCache;
    // Same matching as tests/american-spelling.test.mjs: a stem with its endings, and a
    // stem ending in -e also without it ("practise" -> "practising").
    const alts = (lists.words || []).flatMap(([b]) => (b.endsWith('e')
        ? [`${escapeRx(b)}(?:s|d)?`, `${escapeRx(b.slice(0, -1))}(?:ing|ed|es)`]
        : [`${escapeRx(b)}(?:s|es|d|ed|ing|ful|ly)?`]));
    const phrases = (lists.phrases || []).map(([b]) => b.trim().split(/\s+/).map(escapeRx).join('\\s+'));
    britishCache = {
        lists,
        word: alts.length ? new RegExp(`\\b(?:${alts.join('|')})\\b`, 'i') : null,
        phrase: phrases.length ? new RegExp(`\\b(?:${phrases.join('|')})\\b`, 'i') : null,
    };
    return britishCache;
}

/**
 * The known slips in one answer, as [{ kind, found }]. Empty for a clean answer.
 * `british` is { words, phrases } from app/data/slip-words.json, or null to skip that
 * part (the file could not be loaded).
 */
export function answerSlips(text, british = null) {
    const t = String(text || '');
    const out = [];
    const scan = (kind, list) => {
        for (const rx of list) {
            const m = t.match(rx);
            if (m) { out.push({ kind, found: m[0] }); return; }
        }
    };
    scan('talks about its own honesty or manner', SELF_TALK);
    scan('claims to know the audience', AUDIENCE);
    scan('opens with a lead-in', LEAD_IN);
    scan('says "I haven\'t written about it" instead of "I don\'t know"', NOT_WRITTEN);
    const b = britishMatchers(british);
    if (b) {
        const m = (b.word && t.match(b.word)) || (b.phrase && t.match(b.phrase));
        if (m) out.push({ kind: 'uses British wording', found: m[0] });
    }
    return out;
}

/** True for a card that is a talk answer. */
export function isAnswerSlot(slot) {
    return slot === 'ANSWER_SHORT' || slot === 'ANSWER';
}

function avoidBlock(avoid) {
    const list = (avoid || []).map((t) => String(t || '').trim()).filter(Boolean);
    if (!list.length) return '';
    return `\n\nThe speaker asked for different answers to this question. Take different parts of the material or different angles; do not reword these:\n${list.map((t) => `- ${t}`).join('\n')}`;
}

function steerBlock(steer) {
    const t = String(steer || '').trim();
    if (!t) return '';
    return `\n\nTHE SPEAKER TYPED THIS GUIDANCE FOR THESE ANSWERS. Shape all four around it. It may say what to get across or how to come across. Being the speaker's own words, any fact in it is true and may be used even though it is not in the material:\n"${t}"`;
}

// A label from the text, for the rare answer that came without one.
function shortLabel(text) {
    const words = String(text).trim().split(/\s+/).slice(0, 5).join(' ');
    return words.replace(/[.,;:!?]+$/, '');
}
