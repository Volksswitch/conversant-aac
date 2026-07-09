const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, PageBreak } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function para(text, opts = {}) {
    return new Paragraph({
        spacing: { before: 0, after: opts.after ?? 160 },
        children: [new TextRun({ text, ...opts.run })]
    });
}
function boldPara(label, text, after = 140) {
    return new Paragraph({
        spacing: { before: 0, after },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function bullet(text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function bulletBold(label, text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function numbered(text, ref = "numbers") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

// A monospace, lightly-shaded block for verbatim prompt text. Preserves line
// breaks by splitting on \n into separate Paragraphs (docx-js rule).
function codeBlock(text) {
    const lines = text.split('\n');
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        rows: [ new TableRow({ children: [ new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
            margins: { top: 140, bottom: 140, left: 160, right: 160 },
            children: lines.map(line => new Paragraph({
                spacing: { before: 0, after: 20 },
                children: [new TextRun({ text: line.length ? line : " ", font: "Consolas", size: 17, color: "333333" })]
            }))
        }) ] }) ]
    });
}

function simpleTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true, size: 20 })] })]
    });
    const bodyCell = (cell, w) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const text = isObj ? cell.text : cell;
        const bold = isObj && cell.bold;
        const run = isObj && cell.mono
            ? new TextRun({ text, font: "Consolas", size: 19, color: "333333" })
            : new TextRun({ text, size: 20, bold: !!bold });
        return new TableCell({
            width: { size: w, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [run] })]
        });
    };
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders,
        columnWidths: widths,
        rows: [
            new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
            ...rows.map(r => new TableRow({ children: r.map((c, i) => bodyCell(c, widths[i])) }))
        ]
    });
}

// ===================== The three system-prompt texts, verbatim =====================

const BASE_SYSTEM_PROMPT = `You are an AAC (Augmentative and Alternative Communication) assistant. A non-speaking user is in a live conversation. You speak AS the user, in their voice — not as a helpful assistant. Their communication partner just spoke. First classify what the partner is doing, then generate a palette of structurally distinct responses the user might want to say.

Return ONLY a JSON object, no other text, with exactly this shape:
{
  "partner_action": "INVITATION|QUESTION|REQUEST|STATEMENT|GREETING|ASSESSMENT|CLOSING|OTHER",
  "turn_status": "COMPLETE|INCOMPLETE|CONTINUING",
  "is_repair_initiator": false,
  "responses": [
    {"slot": "PREFERRED", "text": "...", "hint": "..."},
    {"slot": "DISPREFERRED", "text": "...", "hint": "...", "account": true},
    {"slot": "INITIATIVE", "text": "...", "hint": "...", "format": "counter-offer|return-question|expansion"},
    {"slot": "REPAIR", "text": "...", "hint": "...", "trigger": "low_stt_confidence|uncertain_span|long_utterance|none"}
  ],
  "missing_facts": ["<key>", ...]
}

Speak only to what is real — this is the most important rule. You are voicing a real person in a real conversation, NOT writing fiction about a character. Never invent specific events, episodes, outcomes, results, scores, dates, numbers, places, or names that you were not given. Do NOT fabricate autobiography. You MAY draw on the standing facts in the user's profile below (habitual activities, interests, the people in their life) and you MAY offer general, open, or non-committal replies. Every option must be something the user could select and have it be TRUE.

Classification (commit to these BEFORE writing responses):
- "partner_action": the first-pair-part type the partner's utterance performs.
- "turn_status": COMPLETE if the partner's turn is grammatically and pragmatically finished; INCOMPLETE if it trails off mid-utterance; CONTINUING if they are mid-telling, paused at a clause boundary.
- "is_repair_initiator": true ONLY if the partner is asking the USER to repeat or clarify the user's own last utterance.

Responses (omit entirely — return "responses": [] — when turn_status is not COMPLETE, or when is_repair_initiator is true):
- "hint" is a short glanceable label naming the response, not a truncation of "text".
- PREFERRED: the most likely thing THIS user would say, delivered plainly, no hedging.
- DISPREFERRED: a properly formed reluctant / declining / disagreeing reply — a brief meaningful softener, the declination, and a short general account/reason. Never a bare "No."
- INITIATIVE: a counter-offer, a return question, or a topic expansion. Vary its grammatical format from the other responses.
- REPAIR: a clarification request on the PARTNER's turn.

Get to the point: NO response may begin with an empty interjection ("Ah", "Oh", "Um", "Er", "Well", "So", "Hmm", "You know").

- "missing_facts": lowercase snake_case keys for personal facts you needed but were not given. Use [] if none.

Conversation context (engine state — use it, do not echo it):
{ ...engine state JSON... }{ worldview profile block }{ relationships block }`;

const PERCATEGORY_2_ADDITION = `Provide TWO distinct options for EACH of the four slots — 8 responses total (2 PREFERRED, 2 DISPREFERRED, 2 INITIATIVE, 2 REPAIR), in that slot order, best-first within each slot. The two options within a slot must be meaningfully DIFFERENT alternatives (different wording, angle, or content), both valid for that slot — not minor rephrasings.`;

const REFRAME_STEER_ADDITION = `The user typed this guidance for how to respond right now — treat it as additional context AND direction, and shape every response around it. It may state facts to convey (use them — being user-authored, they are TRUE and override the "keep it general" caution), and/or how to come across (tone, length, stance). Honor it while keeping the four-slot structure. User's guidance:
"<preset reframe phrase — see Table 3>"`;

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 26, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 220, after: 140 }, outlineLevel: 1 } },
        ]
    },
    numbering: {
        config: [
            { reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "numbers",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Response Generation Latency Experiment", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  July 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            // ===== TITLE =====
            new Paragraph({
                spacing: { before: 240, after: 80 },
                children: [new TextRun({ text: "Response Generation Latency Experiment", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "One Response Per Category vs. Two — and a Third Option: On-Demand \"Reframe\" Round-Trips", italics: true, color: "595959", size: 24, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  July 2026", color: "808080", size: 20, font: "Arial" })]
            }),

            // ===== 1. SUMMARY =====
            heading1("1.  Summary"),
            para("Conversant AAC's Settings already let a user request either one or two response options per palette category (\"Suggestions per category,\" v0.5.12), yielding either 4 or 8 response cards from a single API call. This experiment measured what that choice actually costs in latency and tokens against the live Claude API, then went a step further: it measured a proposed alternative — keep the default call at one option per category, and let the user request an alternate framing (tone, length, warmth) on demand via a second, directed call, similar to the existing \"Reframe\" composer feature but triggered by a preset Express Panel button rather than typed text."),
            boldPara("Headline finding: ", "requesting 2-per-category in a single call costs roughly 54% more latency and 50% more tokens on EVERY turn, whether or not the extra options are ever used. An on-demand second \"reframe\" call keeps the default turn exactly as fast and cheap as today, and only pays a comparable (or slightly larger) cost on the turns where the user actually asks for a different angle — likely the minority of turns. Recommendation in Section 7: prefer the on-demand reframe-button approach over raising the default to 2-per-category."),
            emptyPara(),

            // ===== 2. BACKGROUND =====
            heading1("2.  Background"),
            para("The generation call in app/js/llm.js (generateResponses) sends the full conversation history plus the user's worldview and relationship profile blocks to Claude, and asks for a single structured JSON object containing a classification of the partner's utterance and a four-slot response palette (PREFERRED / DISPREFERRED / INITIATIVE / REPAIR). A Settings option (\"Suggestions per category,\" max 2) adds one extra instruction paragraph asking for two distinct options per slot instead of one — 8 responses instead of 4 — in the SAME call."),
            para("Separately, the app already has a \"Reframe\" feature on the \"In your own words\" composer (v0.3.20): the user types free-text guidance (tone, content, a fact to convey), and a SECOND call re-runs generation with that text appended to the system prompt as steering guidance, replacing the palette. Ken is considering exposing this same steering mechanism as one or more preset buttons directly on the Express Panel — e.g. \"More playful,\" \"Shorter,\" \"Warmer,\" \"More detail\" — as an alternative to (or alongside) the existing undirected \"New 4\" regenerate button, which asks for a different set with no direction."),
            para("This raised the question this experiment was built to answer: is it better to pay for the extra variety up front, on every turn (2-per-category), or to keep the default call cheap and fast and pay only on the turns where the user actually wants an alternate framing (a directed second round-trip)?"),
            emptyPara(),

            // ===== 3. EXPERIMENTAL PROCEDURE =====
            heading1("3.  Experimental Procedure"),
            heading2("3.1  Environment"),
            bullet("Model: claude-sonnet-4-6 (the model currently hardcoded in app/js/llm.js — unchanged for this test)."),
            bullet("API: live calls to https://api.anthropic.com/v1/messages, billed to Ken's Anthropic account (not a mock/stub)."),
            bullet("Runner: standalone Node.js (v24.18.0) scripts, run outside the browser app, that reconstruct the exact request shape (system prompt, message array, max_tokens) that app/js/llm.js sends for generateResponses(), so the measurements reflect the real production request."),
            bullet("A fixed, ~400ms delay was inserted between calls to avoid rate-limit contention; this delay is excluded from all reported latency figures (latency = time from request sent to response received)."),
            emptyPara(),

            heading2("3.2  The \"medium size conversational prompt\""),
            para("A single representative conversational turn was held constant across every call in both experiments, so that latency/token differences are attributable only to the setting under test, not to variation in the input:"),
            bulletBold("Conversation history: ", "7 turns of realistic back-and-forth dialogue between a communication partner and the user (a greeting, small talk about school, friends, and weekend plans — approximately 90 words total), matching the length of a typical live exchange rather than a first or trivial turn."),
            bulletBold("Worldview profile block: ", "a representative compact profile (name, age, city, interests, communication style, one close friendship) — the same shape and rough length as worldview.buildBlock() produces for a partially-completed questionnaire."),
            bulletBold("Relationships block: ", "three people (one shareable, one private, one shareable), the same shape as relationships.buildBlock()."),
            bulletBold("Engine context: ", "a representative engine-state object (stt_confidence, sequence_stack, register, phase, last_user_utterance), the same shape as engine.buildRequestContext()."),
            para("This combination (~1,700–1,830 input tokens depending on condition) is deliberately in the middle of the app's real range — heavier than an early, profile-light conversation, lighter than a long session with an extensively answered worldview questionnaire — hence \"medium size.\""),
            emptyPara(),

            heading2("3.3  Experiment 1 — 1-per-category vs. 2-per-category (single call)"),
            para("20 live calls were made with the Settings-equivalent of \"1 suggestion per category\" (max_tokens 700, 4 responses requested), and 20 live calls were made with \"2 suggestions per category\" (max_tokens 1000, 8 responses requested, with the additional instruction paragraph shown in Table 2). Each call used the identical conversation/profile/context input described in 3.2. For every call the script recorded: wall-clock latency, input and output token counts from the API's usage object, whether the JSON response parsed successfully, and whether the number of responses returned matched what was requested."),
            emptyPara(),

            heading2("3.4  Experiment 2 — a two-round-trip \"on-demand reframe\" alternative"),
            para("To evaluate Ken's proposed alternative, 10 two-call cycles were run:"),
            numbered("Round 1: an ordinary generation call at 1-per-category (4 responses) — the same default request every turn already makes today."),
            numbered("Round 2: a SECOND call for the SAME conversational turn, reusing the app's existing \"steer\" mechanism (the same code path the free-text Reframe box already uses), but with a short PRESET phrase in place of user-typed text — simulating a proposed Express Panel \"Reframe\" button. Four preset phrases were rotated across the 10 cycles to sample a range of plausible button labels: \"Make these more playful and lighthearted,\" \"Make these shorter and more direct,\" \"Make these warmer and more affectionate,\" and \"Add a bit more detail and enthusiasm.\" Round 2 also passed Round 1's four response texts as the existing \"avoid repeating these\" instruction, matching how a real reframe would follow an already-shown palette."),
            para("Round 1 in Experiment 2 used a slightly condensed system prompt (the same rules, trimmed prose) to keep the supplementary run efficient — this is why Experiment 2's Round-1 input-token count (1,173) differs from Experiment 1's 1-per-category count (1,732); the two are not directly comparable in absolute terms. The Round-1-vs-Round-2 delta WITHIN Experiment 2 is unaffected by this and is the number that matters for the reframe comparison."),
            emptyPara(),

            heading2("3.5  What was measured, per call"),
            bullet("Wall-clock latency (ms) from request to response."),
            bullet("Input tokens and output tokens (from the API response's usage object)."),
            bullet("Parse success (did the response parse as valid JSON matching the expected schema)."),
            bullet("Response count match (did the number of response cards returned match what was requested — 4 or 8)."),
            para("All 60 live calls across both experiments (40 in Experiment 1, 20 in Experiment 2) succeeded, parsed correctly, and returned the expected response count — there were no failures, timeouts, or malformed responses in this run."),
            emptyPara(),

            // ===== 4. PROMPTS USED (VERBATIM) =====
            heading1("4.  Prompts Used (Verbatim)"),
            para("The following are the actual system-prompt texts sent to the API, copied from the experiment scripts (which mirror app/js/llm.js). Bracketed sections mark where per-turn data (engine context, worldview/relationship blocks) is interpolated — that data is described in Section 3.2 and is NOT reproduced verbatim here since it is not the prompt text itself, but is included in every real request."),
            emptyPara(),

            heading2("4.1  Base system prompt (used for both 1-per-category and 2-per-category)"),
            codeBlock(BASE_SYSTEM_PROMPT),
            emptyPara(),

            heading2("4.2  Addition appended when \"2 suggestions per category\" is requested"),
            para("This paragraph is appended to the end of the base system prompt above (after the engine context and profile blocks) only when the Settings option is set to 2:"),
            codeBlock(PERCATEGORY_2_ADDITION),
            emptyPara(),

            heading2("4.3  The \"reframe\" steer addition (Experiment 2, Round 2)"),
            para("This paragraph is appended to the end of the base system prompt when a steer/reframe phrase is present — whether typed freely into the existing composer box, or (as tested here) a preset phrase from a proposed Express Panel button. This is the exact mechanism already shipped for the free-text Reframe feature (v0.3.20); only the SOURCE of the phrase (typed vs. preset button) differs."),
            codeBlock(REFRAME_STEER_ADDITION),
            emptyPara(),
            boldPara("Preset reframe phrases tested (Table 3 below shows results per phrase): ", ""),
            bullet("\"Make these more playful and lighthearted.\""),
            bullet("\"Make these shorter and more direct.\""),
            bullet("\"Make these warmer and more affectionate.\""),
            bullet("\"Add a bit more detail and enthusiasm.\""),
            para("Round 2 also included the standing \"avoid repeating these previous options\" instruction (already part of the production \"New 4\" / Reframe code path), populated with Round 1's four response texts, so the second call is not just re-angled but explicitly steered away from repeating the first palette."),
            emptyPara(),

            // ===== 5. RESULTS: EXPERIMENT 1 =====
            heading1("5.  Results — Experiment 1 (Single Call: 1 vs. 2 per Category)"),
            simpleTable(
                ["Metric", "1 per category (4 responses)", "2 per category (8 responses)", "Delta"],
                [
                    ["Calls made / succeeded", "20 / 20", "20 / 20", "—"],
                    ["Parse failures", "0", "0", "—"],
                    ["Response-count mismatches", "0", "0", "—"],
                    ["Latency — mean", "6,846 ms", "10,515 ms", { text: "+54% (+3,669 ms)", bold: true }],
                    ["Latency — median", "6,342 ms", "10,548 ms", "+66%"],
                    ["Latency — p95", "11,603 ms", "11,653 ms", "≈ flat (tails converge)"],
                    ["Latency — std. dev.", "1,353 ms", "643 ms", "2-per-category is more consistent"],
                    ["Input tokens (fixed)", "1,732", "1,826", "+94 (the extra instruction)"],
                    ["Output tokens — mean", "263", "547", { text: "+108%", bold: true }],
                    ["Est. cost per call*", "$0.0091", "$0.0137", "+50%"],
                ],
                [3200, 2200, 2200, 1760]
            ),
            emptyPara(),
            para("* Estimated using illustrative Sonnet-tier pricing of $3 / million input tokens and $15 / million output tokens. Actual billed rates should be confirmed against Anthropic's current published pricing for the exact model in use; the relative comparison (which condition costs more, and by roughly how much) is the meaningful takeaway, not the absolute dollar figures.", { after: 240 }),

            // ===== 6. RESULTS: EXPERIMENT 2 =====
            heading1("6.  Results — Experiment 2 (Two Round-Trips: Default + On-Demand Reframe)"),
            simpleTable(
                ["Metric", "Round 1 (default, 4 responses)", "Round 2 (preset reframe, 4 responses)", "Combined (both rounds)"],
                [
                    ["Calls made / succeeded", "10 / 10", "10 / 10", "—"],
                    ["Parse failures", "0", "0", "—"],
                    ["Latency — mean", "6,205 ms", "6,745 ms", "12,950 ms"],
                    ["Latency — median", "6,013 ms", "7,356 ms", "13,208 ms"],
                    ["Latency — p95", "7,874 ms", "8,302 ms", "16,176 ms"],
                    ["Input tokens — mean", "1,173", "1,413", "2,586"],
                    ["Output tokens — mean", "266", "313", "579"],
                    ["Est. cost — mean*", "$0.0075", "$0.0089", "$0.0164"],
                ],
                [3200, 2200, 2200, 1760]
            ),
            emptyPara(),
            para("* Same illustrative pricing as Table 1. Round 1's absolute figures here are not directly comparable to Experiment 1's 1-per-category figures because Round 1 used a condensed system prompt (Section 3.4) — but the Round-1-to-Round-2 delta is the number that matters: a reframe round-trip costs roughly what the default call already costs (a second ~4-response generation, now steered), not the doubled OUTPUT of a 2-per-category call.", { after: 240 }),

            // ===== 7. ANALYSIS AND CONSIDERATION: WHICH APPROACH FITS THE PRODUCT =====
            heading1("7.  Analysis: 2-per-Category vs. On-Demand Reframe Button"),
            para("Both experiments confirm the request was reliable — every condition returned valid, correctly-shaped responses 100% of the time. The decision is therefore purely about latency, cost, and how those costs are distributed across a conversation, not about risk."),
            emptyPara(),

            heading2("7.1  The core difference: paid on every turn vs. paid on demand"),
            para("2-per-category pays its full latency and token cost (roughly +54% latency, +50% cost) on EVERY generation call, whether or not the user ever looks at, or needs, the second option in any slot. This works directly against the product's central mission — closing the awkward-silence gap — because it adds roughly 3.7 seconds of dead air before ANY response appears, on every single turn, for the entire conversation."),
            para("An on-demand reframe button, by contrast, leaves the DEFAULT call exactly as fast and cheap as it is today (Round 1 in Experiment 2 behaves like ordinary 1-per-category generation). The extra cost is only incurred on the turns where the user actively taps a reframe button — which, by the nature of the feature, is expected to be a minority of turns. Across a full conversation of, say, 20 exchanges, 2-per-category pays its tax 20 times; a reframe button pays a comparable (per-use) tax only on the handful of turns where the user wants a different angle."),
            emptyPara(),

            heading2("7.2  Per-use cost of a reframe round-trip vs. per-turn cost of 2-per-category"),
            para("Looked at per-instance rather than per-conversation: a full reframe cycle (Round 1 + Round 2 combined, ~12,950 ms, ~$0.0164) is actually SLOWER and slightly more expensive than a single 2-per-category call (~10,515 ms, ~$0.0137) — because it is two complete round trips rather than one call with a longer output. So if a user were to reframe on EVERY turn, 2-per-category would be the cheaper and faster of the two approaches. The reframe-button design only wins in total cost/latency across a conversation if reframing is the exception rather than the rule — which matches how Ken is describing the feature (an alternative to \"New 4,\" not a replacement for the default four cards)."),
            emptyPara(),

            heading2("7.3  A qualitative difference, not just a cost difference"),
            para("The two approaches aren't purely interchangeable variants of the same feature — they offer different things to the user:"),
            bulletBold("2-per-category ", "gives two same-slot alternatives (e.g., two different PREFERRED phrasings) with no direction — the model's default sense of variety within a category."),
            bulletBold("A directed reframe ", "re-angles the ENTIRE palette in a direction the user chooses (playful, shorter, warmer, more detail) — a qualitatively richer and more expressive control than \"give me another option in this same slot,\" and it reuses a code path (steer + refreshPalette) that is already built and shipped for the free-text Reframe box (v0.3.20). Turning it into one or more preset Express Panel buttons is a comparatively small addition on top of existing, working plumbing — no new LLM contract, no new parsing, no engine changes."),
            emptyPara(),

            heading2("7.4  Interaction with the existing \"New 4\" button"),
            para("Ken's framing — \"instead of, or as an alternative to, pressing New 4\" — fits well: New 4 already performs an undirected second round-trip (regenerate with the previous options passed as \"avoid\"). A preset Reframe button would sit alongside it as a DIRECTED version of the exact same mechanism. No new Settings-tier latency tradeoff is introduced for users who never press either button; the cost only appears when a button — any button — is pressed, which is already true of New 4 today."),
            emptyPara(),

            // ===== 8. RECOMMENDATION =====
            heading1("8.  Recommendation"),
            boldPara("Prefer the on-demand \"Reframe\" button(s) over raising the default to 2-per-category. ", "It keeps every ordinary turn exactly as fast as it is today (the product's central value is closing the response gap, so the default path should never get slower), reuses an already-built and verified mechanism (the free-text Reframe steer + refreshPalette), and gives the user a more expressive control (steer the WHOLE palette in a chosen direction) than a same-slot alternate. The tradeoff is honest and small: a turn where the user actually taps Reframe costs about as much as two ordinary turns combined — but that is only paid when the user chooses it, not on every turn as 2-per-category currently is."),
            para("If Ken wants to keep the existing 2-per-category Setting available as well (some users may simply prefer more choice on every turn and accept the latency), no change is needed there — the two approaches are not mutually exclusive. The Settings hint for \"Suggestions per category\" could be updated to disclose the latency tradeoff measured here, so the choice is informed."),
            emptyPara(),
            boldPara("Suggested next step if this direction is adopted: ", "design the actual preset phrase set for the Express Panel Reframe buttons (the four tested here — playful, shorter, warmer, more detail — are a reasonable starting set, not a final recommendation), decide how many such buttons the Express Panel should reserve space for, and confirm whether Reframe should also update the stored \"avoid\" list so a THIRD reframe in the same turn doesn't re-suggest an already-rejected phrasing."),
            emptyPara(),

            // ===== 9. LIMITATIONS =====
            heading1("9.  Limitations"),
            bullet("Single conversational scenario. All calls used one fixed \"medium size\" conversation/profile combination (Section 3.2). Latency and token counts will vary with conversation length, profile size, and topic; the relative comparisons (which condition costs more, by roughly how much) are expected to hold, but absolute numbers will shift."),
            bullet("Sample size. 20 calls per condition in Experiment 1 and 10 cycles in Experiment 2 are enough to see clear, consistent effects, but not enough for tight statistical confidence intervals — treat the reported figures as representative, not exact."),
            bullet("Illustrative pricing. Dollar costs use a placeholder rate ($3 / $15 per million tokens); confirm against Anthropic's current published pricing for the exact model before using these figures in any budget discussion."),
            bullet("Network conditions. All calls were made from one location on one network at one point in time; latency will vary with time of day, API load, and the tester's connection."),
            bullet("Experiment 2's Round-1 prompt was condensed relative to Experiment 1's 1-per-category prompt (Section 3.4) to keep the supplementary run efficient. This affects the absolute input-token comparison between the two experiments but not the Round-1-vs-Round-2 delta within Experiment 2, which is the number the recommendation relies on."),
            bullet("This was a scripted, out-of-app test against the live API, not a test of the in-app UI or a live conversation on the tablet — it validates the request/response cost model, not the on-device user experience of pressing a Reframe button."),
            emptyPara(),

            // ===== 10. RAW ARTIFACTS =====
            heading1("10.  Raw Artifacts"),
            para("The Node.js scripts used to run both experiments, their full console logs, and the raw per-call JSON results (latency, token counts, and parsed response text for every one of the 60 calls) are retained for reference: perCategory-experiment.mjs / result.json / progress.log (Experiment 1) and reframe-experiment.mjs / result2.json / progress2.log (Experiment 2)."),
        ],
    }],
});

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync('Response-Generation-Latency-Experiment.docx', buf);
    console.log('Wrote Response-Generation-Latency-Experiment.docx');
});
