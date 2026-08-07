const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;
const TABLE_W = 9360;

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

// A hanging-indent reference entry for the bibliography.
function reference(text) {
    return new Paragraph({
        spacing: { before: 0, after: 120 },
        indent: { left: 480, hanging: 480 },
        children: [new TextRun({ text, size: 20 })]
    });
}

function cellPara(text, bold = false, mono = false) {
    return new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, bold, font: mono ? "Consolas" : "Arial", size: mono ? 18 : 20 })]
    });
}

// widths: array of DXA widths summing to TABLE_W. rows: array of arrays of strings.
function table(widths, headerRow, rows, monoCols = []) {
    const mk = (cells, isHeader) => new TableRow({
        tableHeader: isHeader,
        children: cells.map((text, i) => new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            margins: cellMargins,
            shading: isHeader ? { type: ShadingType.CLEAR, fill: "DCE6F1" } : undefined,
            children: String(text).split('\n').map(line =>
                cellPara(line, isHeader, !isHeader && monoCols.includes(i)))
        }))
    });
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        borders,
        rows: [mk(headerRow, true), ...rows.map(r => mk(r, false))]
    });
}

function caption(text) {
    return new Paragraph({
        spacing: { before: 80, after: 220 },
        children: [new TextRun({ text, italics: true, color: "595959", size: 18 })]
    });
}

// A quoted block of prompt text, monospace on a light ground.
function codeBlock(text) {
    const lines = text.split('\n');
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        rows: [new TableRow({ children: [new TableCell({
            width: { size: TABLE_W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
            margins: { top: 140, bottom: 140, left: 160, right: 160 },
            children: lines.map(line => new Paragraph({
                spacing: { before: 0, after: 20 },
                children: [new TextRun({ text: line.length ? line : " ", font: "Consolas", size: 17, color: "333333" })]
            }))
        })] })]
    });
}

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
            children: [new TextRun({ text: "Conversant AAC — Sounds Like Me", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  August 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [

// ===== TITLE =====
new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: "Sounds Like Me", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "A Build Plan for the Voice Layer — Register, Range, and How Suggested Responses Come to Sound Like a Specific Person", italics: true, color: "595959", size: 24, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  August 2026", color: "808080", size: 20, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Second edition. The first edition rested on writing samples as the primary instrument; that judgment was challenged on August 7 2026 and did not survive. Section 3 states what the evidence supports and what it does not, and Section 5 records the decisions taken.", italics: true, color: "808080", size: 18, font: "Arial" })]
}),

// ===== 1. SUMMARY =====
heading1("1.  Summary"),
para("Conversant AAC's central promise is that the device speaks as the user, not for them. The profile work built so far delivers half of that: the app knows a great deal about what the user can truthfully say. It knows almost nothing about how they would say it. This document plans the second half — the voice layer."),
boldPara("The central design judgment: ", "the app cannot ask this user to describe their own style, and it cannot afford to ask them to compose much prose either. It can afford to ask them to recognize. The primary instrument is therefore forced choice — the user is shown candidate replies and asked which they would rather say. This is cheap enough to be one tap, it is better-behaved psychometrically than a rating scale, and, critically, it still yields example sentences rather than adjectives, which is the form a language model actually uses."),
boldPara("The largest asset is already on disk. ", "Every palette selection the user has ever made is a forced-choice style judgment against three rejected alternatives, recorded with the alternatives, made in real conversation, at zero cost to the user. The app has been running this experiment since v0.3.0 and has never read the results. Harvesting it is the highest-value item in the plan and asks the user for nothing."),
boldPara("The recommended sequence: ", "make the prompt able to accept voice data at all (Phase 0), run a short forced-choice module and collect negative constraints (Phase 1), then harvest continuously from actual use, with live selections as the authority (Phase 2). Per-person register (Phase 3) follows, bundled with three other features that want the same data structure. The abstract personality and values inventory (Phase 4) goes last."),
boldPara("Phases 0 and 1 together are a small build ", "and are what would make the product's \"starts sounding like them specifically\" claim honest."),
emptyPara(),

// ===== 2. THE PROBLEM =====
heading1("2.  What the Problem Actually Is"),
para("Every profile subsystem shipped so far — the worldview questionnaire, the relationship graph, My Places — answers one question: what facts about this person are true, and therefore what may the assistant say on their behalf without inventing anything? That is the right question, it is well served, and it is guarded by the anti-fabrication rule."),
para("It is not the question \"sounds like me\" asks."),

heading2("2.1  Two responses, and the five things that separate them"),
codeBlock(`Partner:  "Hey! Good timing - your pull list came in this morning."

  (a)  "That is excellent news. I have been looking forward to
        collecting those issues all week."

  (b)  "Nice - what came in?"`),
para("Both are factually clean. Both draw on the same profile. Neither invents anything. And they are not the same person. Nothing currently in the app distinguishes them, because the distinction is not made of facts. It is made of five things, and the fourth is not a matter of style at all:"),
emptyPara(),
table([1900, 3730, 3730],
    ["Dimension", "(a)", "(b)"],
    [
        ["Economy", "17 words", "4 words"],
        ["Formality", "Formal lexis, no contractions,\nfull clauses", "Minimal, contracted, elliptical"],
        ["Affect", "States enthusiasm explicitly —\n\"excellent\", \"looking forward\"", "Implies it and moves on"],
        ["Handling of the floor", "Closes the exchange. It is complete\nand requires nothing further.", "Hands the turn back. Invites\ncontinuation with a question."],
        ["Self-presentation", "Someone being correct", "Someone being easy"],
    ]),
caption("Table 1. The same content, the same facts, two different people."),
boldPara("The fourth row is the one that reaches past style. ", "Whether this user is a person who keeps a conversation running is a fact about them, and it is a conversational fact, not a decorative one — it belongs to the same sequence model the engine already maintains. A user who habitually returns the floor generates longer conversations, gets asked more questions, and is treated by partners as more of an interlocutor. The palette is currently deciding this by accident, every turn."),

heading2("2.2  In the absence of voice data the app does not produce \"no voice\""),
boldPara("It produces the model's voice. ", "Given no stylistic information, a language model does not emit some neutral, unmarked English; it falls back on its own default register, which is verbose, formal, explicit, complete, and assistant-shaped. That is to say, it produces (a). The app is therefore not currently neutral on the question of who this person is — it is answering the question wrongly, in the same direction, on every card of every palette."),
boldPara("Facts drive topic selection; they do essentially nothing for register. ", "So adding more of the kind of data already collected — more favorites, more places, more people — will not close this gap, however much of it is collected. The voice layer needs a different kind of input."),
emptyPara(),

// ===== 3. WHAT THE EVIDENCE SUPPORTS =====
heading1("3.  What the Evidence Supports, and What It Does Not"),
para("The first edition of this document asserted that examples beat descriptions and that a few sentences the user wrote would outperform any number of trait scores. Those claims were reviewed on August 7 2026. This section states which of them survive contact with the literature, because the plan's shape follows directly from the answer. Full citations are in Section 10."),

heading2("3.1  For a language model, examples do steer style better than instructions"),
para("This much is supported. Across four prompting strategies — zero-shot, one-shot, few-shot, and text completion — few-shot prompting produced up to 23.5 times higher style-matching accuracy than zero-shot, and the choice of prompting strategy mattered more than the size of the model (Jemama & Naous, 2025). Related work finds style imitation improving up to roughly four or five demonstrations and then plateauing, which supports collecting a small number of examples rather than a large corpus."),
boldPara("The caveat points directly at our use case. ", "The largest study of imitating ordinary, non-famous authors — over four hundred real authors and forty thousand generations per model — found that models approximate user style adequately in structured formats such as news and email, but struggle with nuanced, informal writing (Bhandarkar et al., 2025). Informal conversational register is the only register this app ever operates in. Exemplar prompting is therefore the best available lever and is weakest exactly where we need it, which is a reason to expect partial success and to measure it, not a reason to choose a different lever."),
boldPara("What is NOT established: ", "there is no head-to-head study comparing trait-score prompting against exemplar prompting. The first edition's claim that three sentences outperform any number of trait scores was an inference stated in the register of a finding. It remains a reasonable inference — nobody has tested trait-score prompting because there is little reason to expect it to work — but it should not be relied on as measured fact, and the plan no longer does."),

heading2("3.2  Writing style is not speaking style"),
boldPara("This is the correction that reshaped the plan. ", "The authoritative source is Biber's multidimensional analysis of twenty-three spoken and written genres, which identifies dimensions of variation along which conversation and written prose separate systematically (Biber, 1988). A sample of someone's writing is evidence about a written register. Generalizing it to conversational turns is not warranted."),
para("Some individual features do carry across modality — vocabulary, characteristic hedging, humor, directness, a tendency toward length or brevity — which is why cross-genre authorship attribution works at all, though it degrades. But register-level features do not carry across, and register is most of what \"sounds like me\" means in a live conversation."),
boldPara("There is a wrinkle specific to this population, and it cuts against the writing-sample approach rather than rescuing it. ", "Biber's dimensions track the circumstances of production: speech is fast, unplanned, and interactive; writing is slow, planned, and revisable. AAC composition is slow and planned like writing but interactive like speech, so it sits in a place of its own. It follows that the best available evidence of how this person sounds is their own AAC output in real conversation, and the worst is prose they wrote at leisure. That is an argument for making harvest-from-use the authority and demoting authored samples to a cold-start stopgap — the opposite of the first edition's ordering."),
boldPara("A second problem with samples, which is methodological rather than linguistic. ", "A writing sample produced after ten minutes of effortful composition on an on-screen keyboard is shortened by the effort. The instrument distorts the thing it measures: we would be sampling how the user writes when writing is exhausting, and then teaching the model that they are terse. The first edition claimed a sample \"costs the user less\" than scale questions. That was asserted without measurement and is probably false on this population's terms."),

heading2("3.3  The speaker is not a reliable judge of their own style"),
para("Vazire's self-other knowledge asymmetry model holds that the self has privileged access to thoughts and feelings, while others are better placed to observe patterns of behavior; accuracy therefore divides by how observable and how evaluative a trait is (Vazire, 2010). Speaking style is highly observable and highly evaluative — the quadrant in which others out-perform the self. Gosling and colleagues, comparing self-reported act frequencies against observer codings, found accuracy varying with observability, base rate and desirability, and self-reports positively distorted on average (Gosling et al., 1998). And the linguistic features that most reliably mark an individual — function words, pronouns, hedges — are produced automatically, below the level of conscious attention (Tausczik & Pennebaker, 2010)."),
para("Three consequences, and the first is the largest:"),
numbered("It rules out the obvious design — asking the user to describe their own style — more firmly than the first edition did. \"How formal are you? Are you funny? Are your replies short?\" asks a person to report on behavior they cannot observe and are motivated to flatter."),
numbered("It is a real but weaker caveat on forced choice, which is still self-perception. Weaker for two reasons: recognition judgments are more accurate than free self-description, and, uniquely here, the app can check the answer against behavior. What the user says sounds like them can be compared against what they actually select in live conversation, continuously and for free. Where the two disagree, behavior wins."),
numbered("It argues for a channel that does not exist yet: the people who know the user well. See Section 5.4."),

heading2("3.4  Comparative judgment is the better-behaved instrument"),
para("Four independent lines converge on forced choice:"),
bulletBold("Comparative judgment outperforms absolute rating. ", "Thurstone's law of comparative judgment (1927) is the foundation; deployments of adaptive comparative judgment report rank-order reliability around 0.95 to 0.97, against rating scales that are noisy from anchoring and from individual differences in how a scale is read."),
bulletBold("Forced-choice formats reduce social-desirability bias. ", "This matters here: \"are you funny?\" invites a flattering answer, and \"which of these two replies is more like you?\" invites it much less."),
bulletBold("Recognition is far cheaper than production. ", "One tap against a composed sentence. For a user with limited motor control this is not a marginal difference, and it is the whole of the objection in Section 3.2."),
bulletBold("It is how language-model personalization is actually done. ", "Preference alignment is built on pairwise human comparison precisely because comparisons are more reliable and cheaper to collect than demonstrations or absolute ratings. Individual-user personalization from preference data is an active area (Zhang et al., 2025)."),
boldPara("The project already uses this format. ", "The Schwartz Portrait Values Questionnaire in the original question bank is a comparative, portrait-shaped instrument. Forced choice is not a new pattern here; it is the pattern the psychometrically strongest part of the existing design already chose."),
boldPara("Two constraints that decide whether the instrument works: ", "the candidate replies must vary on style while holding content constant, or the user chooses on content and we learn nothing about voice; and near-equivalent options must offer an escape, because forced choice can amplify a weak or nonexistent preference into a confident ordinal verdict. Aggregate across items; never trust a single one."),

heading2("3.5  The synthesis that resolves the tension"),
boldPara("Forced choice yields exemplars, not adjectives. ", "The user selects sentences, and selected sentences are examples. So the instrument that costs recognition rather than production still produces exemplar-shaped material for the prompt — which is what Section 3.1 says the model can actually use. The apparent conflict between \"examples work best\" and \"composing examples is too expensive\" dissolves: we buy examples at recognition price."),
boldPara("One honest limit follows immediately, and it constrains the build. ", "A Phase-1 exemplar is a sentence the model wrote and the user endorsed, which is weaker evidence than a sentence the user wrote. It is far stronger than a description, but it carries a risk: if the candidate sets are generated on the fly by the same model, the instrument can only ever discover which corner of the model's own range the user prefers. The Phase-1 item bank must therefore be hand-authored with deliberate stylistic spread, and Phase 2's genuinely user-composed prose retains a distinct and higher value."),
emptyPara(),

// ===== 4. WHERE IT STANDS =====
heading1("4.  Where It Stands Today"),
para("An audit against the shipped code, August 2026."),
heading2("4.1  The prompt already asks for voice, and nothing answers"),
para("The generation system prompt opens by telling the model to speak as the user:"),
codeBlock(`You are an AAC (Augmentative and Alternative Communication) assistant.
A non-speaking user is in a live conversation. You speak AS the user, in
their voice - not as a helpful assistant.`),
para("That instruction is correct and it has nothing behind it. The profile block assembled and appended to it is composed of exactly four sections — the worldview facts, the relationship graph, My Places, and the current situation — plus the rule forbidding bracketed placeholders. There is no voice section, and no field anywhere in the app produces one. The model is asked to imitate a person it has been given no stylistic information about, and it does what Section 2.2 describes."),
heading2("4.2  What the questionnaire can and cannot hold"),
para("The registry currently defines six modules: A1 About You, A2 Where You Are, A4 Daily Life, A5 Contact and Logistics, C1 Favorites, and C2 Passions. Module A3 was removed in v0.2.27 when people became the relationship graph. There is no Tier B module at all, and Tier C stops at C2. Measured against the Marc Delgado test persona, which was written to the full question-bank design, the gap is stark:"),
emptyPara(),
table([3400, 1500, 4460],
    ["Persona section", "Capturable today?", "Where it lives, or why not"],
    [
        ["A1, A2, A4, A5 — facts", "Yes", "worldview.json"],
        ["People and relationships", "Yes", "relationships.json"],
        ["My Places", "Yes", "places.json"],
        ["C1 Favorites, C2 Passions", "Yes", "worldview.json"],
        ["C3 Topics to seek and avoid", "No", "No field. Includes \"do not ask me what happened to you\" — arguably the single highest-value entry in the persona."],
        ["C4 Dislikes and pet peeves", "No", "No field."],
        ["B1 Energy and how you come across", "No", "No Tier B module exists."],
        ["B2 Humor and playfulness", "No", "No Tier B module exists."],
        ["B3 How you talk (register and style)", "No", "No Tier B module exists. See Section 5.2 — partly belongs on the person, not the profile."],
        ["B4 Values", "No", "No Tier B module exists."],
        ["B5 Beliefs", "No", "Deferred deliberately (June 2026)."],
        ["B6 How you treat different people", "No", "Cannot be a questionnaire field at all — see Section 5.2."],
        ["B7 Emotional landscape", "No", "No Tier B module exists."],
        ["B8 Your voice, in your own words", "No", "No Tier B module exists. This is the single most valuable missing field."],
    ]),
caption("Table 2. The test persona against the shipped registry. Everything in the lower two-thirds is background the app has never been told."),
boldPara("This has a practical consequence beyond the plan. ", "The demo script was using the persona's voice description as an acceptance criterion for live output — judging whether cards \"land on Marc\" against a register the app was never given. The operator would have judged the app as failing, correctly. That has been corrected in the script; it is recorded here because the same trap will recur in any future test material written from the persona."),
heading2("4.3  The Express Panel is a weaker voice channel than it appears"),
para("The first edition described the Express Panel as the one place in the product where the user's exact words are spoken, and called its phrases user-authored. That is true of the panel a user has edited. It is not true of the panel as shipped."),
boldPara("As shipped, all thirty-two items are ours. ", "The default list is six feelings and twenty-six phrases, every one written by us. It becomes the user's only after editing work that is, today, non-trivial: one row at a time in a Settings editor, with no path to it from the conversation screen."),
boldPara("The defaults are nonetheless not a mistake, and Section 5.5 keeps most of them. ", "Look at what they actually are — Yes, No, Okay, Thank you, Please, Wait, Help. That is the plumbing of conversation, not idiolect. Nobody's identity is in \"Yes.\" So unlike a fabricated catchphrase, a default phrase makes no false claim about the user; it simply carries no information about them."),
boldPara("The mistake was counting the panel as evidence of voice without distinguishing whose words are in it. ", "A default item carries zero signal; a user-added item carries a great deal; nothing in the data model tells them apart. Section 5.5 fixes that, and the fix pays for itself three times over."),
emptyPara(),

// ===== 5. DECISIONS =====
heading1("5.  Decisions That Shape the Plan"),
para("Five decisions, two taken August 5 2026 and three taken August 7 2026 in review of the first edition of this document."),

heading2("5.1  Catchphrases are Express Panel buttons, and the AI never produces them"),
boldPara("Decided (Ken, August 5 2026). ", "A user's characteristic turns of phrase — \"Let's go!\", \"That's clutch\", \"Nah, I'm good\" — live as Express Panel buttons, possibly scoped by place and person. They are never supplied to the model, and the model never produces or builds on them."),
para("This closes a real failure mode rather than mitigating it. Given a list of catchphrases, language models over-apply them: they sprinkle the marker into responses where a real speaker would not use it, and idiolect used slightly wrong is worse than idiolect absent, because it reads as impersonation. There is no reliable prompt instruction that prevents this; removing the input does."),
para("There is a second and better reason. A catchphrase the model guesses at is presented to the partner as though it were spontaneous, when in fact it was inferred. A catchphrase on a button is the user deliberately choosing to say their own words. That is the same principle as the anti-fabrication rule, applied to style instead of fact, and it is more honest."),
boldPara("The literature supports this decision more strongly than it was supported when it was taken. ", "Valencia and colleagues, studying twelve adult AAC users with live language-model suggestions, found participants wanted generated phrases to reflect their own communication style, and simultaneously reported that choosing a generated phrase made them feel the system had made the choice rather than they had (Valencia et al., 2023). A model-invented catchphrase sits precisely at the intersection of those two findings."),
para("Three consequences follow, and the second has teeth:"),
numbered("Phase 1 does not collect catchphrases as a voice field. The question \"what do you say a lot?\" instead seeds Express Panel buttons — producing something the user can immediately tap, rather than prompt text they never see."),
numbered("Phase 2 harvests the user's own composed prose, and that prose contains their catchphrases. The prohibition therefore needs enforcement at the harvest boundary, not merely an instruction in the prompt. The user's own Express Panel entries are themselves the catchphrase list, so they double as a redaction list: known phrases are stripped from harvested samples before those samples ever reach the model. Note that this requires the provenance marking in Section 5.5 — redacting against the shipped defaults would strip \"Yes\" and \"Thank you\" from every sample."),
numbered("Catchphrases become an early, concrete use case for the place- and person-scoped Express Panel work already on the roadmap — the phrases used with friends are not the phrases used with a doctor."),

heading2("5.2  Register is per-person, so it is graph data, not questionnaire data"),
boldPara("Decided (Ken, August 5 2026). ", "The observation that forced this: Marc would never say \"Let's go!\" to his mother except as a momentary joke. A single global register field would therefore not merely be incomplete — it would be wrong, because it asserts one answer where the true answer varies by audience."),
para("This is the second instance of one rule, and the rule is worth stating on its own:"),
boldPara("When a questionnaire field's correct answer varies per person, it is not a questionnaire field. ", "The first instance was module A3, \"People in Your Life,\" which was deleted in v0.2.27 and became the relationship graph. Tier B's B6 topic, \"how you treat different people,\" anticipated the content but not this consequence: it cannot live in a flat key-to-answer registry at all. Apply the test when authoring any remaining Tier-B question."),
para("What survives as a global field is the part that genuinely does not vary: the user's range, their floor and ceiling of formality, what they never say under any circumstances, and whether they are funny. What moves to the relationship graph is where a given person sits within that range."),
boldPara("A note on build economics. ", "Four separate features now want attributes on the same me-to-person edge: the standing relationship goal, per-partner openers and closings, vulgarity permission, and now register. That is one People-editor section — \"how I talk with this person\" — plus four small prompt contributions. It is one build, not four, and it should be scheduled as one."),

heading2("5.3  The question is authorization, not self-description"),
boldPara("Decided (Ken, August 7 2026). ", "Raised as an objection to forced choice — a user picking \"sounds like me\" is still self-perception, which is exactly the weakness Section 3.3 identifies — together with a genuine question: would it be so bad for the app to speak as the user would LIKE to speak?"),
boldPara("First, the objection applies to the entire class, not to this instrument. ", "Established personality inventories follow this methodology exactly; the Big Five and the Schwartz Portrait Values Questionnaire that the original Tier-B design was built on are self-report throughout. Self-perception is a known limit of every self-report measure, accepted by the field because the alternatives are more expensive. It is therefore not a reason to prefer one self-report instrument over another, and among self-report instruments comparative judgment is the better-behaved member (Section 3.4)."),
boldPara("Second, the aspirational voice is not obviously the wrong target. ", "Gonzales and Hancock found that presenting a trait publicly leads people to internalize it: participants who described themselves as extroverted in public computer-mediated communication subsequently rated themselves as more extroverted, while those who did so privately did not (Gonzales & Hancock, 2008). A voice the user aspires to and then speaks in is a voice they may come to have."),
boldPara("Third, and specific to this population: the descriptive baseline is contaminated by the technology. ", "A person who has typed every utterance for twenty years is terse because typing is slow. That terseness is a property of the device, not of them. Kane and colleagues documented AAC users' self-expression being constrained by their equipment, and the workarounds they improvised — switching voices, using accents, swearing — to get some personality past it (Kane et al., 2017). Faithfully modeling the observed baseline therefore risks modeling the disability rather than the person, which would be a strange thing for this product of all products to do."),
boldPara("Against all of that stands the real cost, which is the user's to weigh: authenticity, and the difficulty of living up to an AI voice. ", "The partner forms expectations from what the device says, and the user has to sustain them in every context where the device is not mediating."),
boldPara("The decision: change the question rather than choose a side. ", "The instrument does not ask \"which of these sounds like you?\" (descriptive, and Section 3.3 says they cannot answer it accurately) nor \"which would you rather be?\" (aspirational, and it drifts without a floor). It asks which one they would say:"),
codeBlock(`"Which would you rather say?"

  [ They're all fine ]     [ I wouldn't say any of these ]`),
boldPara("The exact wording matters, and a first draft got it wrong. ", "That draft read \"which of these would you be happy to have said?\" — rejected because \"happy\" is vague and, worse, admits a threshold reading: it can be heard as \"which of these is acceptable,\" or \"good enough.\" On a satisficing reading several options qualify, the user picks the first adequate one, and the instrument stops discriminating — which is precisely the failure mode Section 3.4 warns about, arriving by way of the question rather than the options. \"Rather\" is explicitly comparative and has no threshold: there is no way to read it as a filter."),
boldPara("The satisficing answer gets its own button rather than contaminating the choice. ", "\"They're all fine\" is the acceptability judgment, recorded as what it is — a weak or absent preference — instead of being expressed as a spurious first-place vote. \"I wouldn't say any of these\" is the genuinely different state and is at least as informative, because it is a negative constraint arriving unprompted."),
boldPara("The phrasing also replicates the live constraint, which is what makes the answers comparable to behavior. ", "In a real conversation the palette forces one choice among four. An item that forces one choice among four is measuring the same act, which is what licenses the convergence measure in Section 7. A question that merely collected approval ratings would not be."),
para("This is an authorization judgment, not a self-description. Three things recommend it:"),
numbered("It is the same judgment the user already makes every time they tap a card, so the instrument teaches the gesture the product runs on."),
numbered("It sidesteps the accuracy problem entirely. The user is not being asked to report a fact about themselves that they may get wrong; they are exercising a preference, and a preference cannot be inaccurate."),
numbered("It is the judgment the app actually needs. The app's job is to produce cards this user will endorse. Asking directly what they endorse is a shorter path than inferring it from a description of who they are."),
boldPara("The user and the partner are deliberately asked DIFFERENT questions, and this is not an inconsistency. ", "The user gets a preference question (\"which would you rather say?\"); the partner in Section 5.4 gets a descriptive one (\"which sounds most like how he talks with you?\"). That is Section 3.3 applied rather than ignored: the user cannot accurately describe their own style but can express a preference, and the partner cannot express the user's preference but can accurately report observed behavior. Each is asked the question they are qualified to answer. Asking either of them the other's question would produce the weakest version of both instruments."),
boldPara("Where the user wants to sound like a better version of themselves, that is their call to make. ", "It is consistent with the standing configurability philosophy, and it is their voice. The app should neither push them toward it nor prevent it."),

heading2("5.4  Partner review is offered, never required"),
boldPara("Decided (Ken, August 7 2026). ", "Section 3.3 establishes that people who know the user well are better judges of observable style than the user is. The app should suggest — not require — that the user answer the Phase-1 items with a partner who knows them well, or review the answers afterward with one."),
boldPara("The evidence says which partner, not just that a partner helps. ", "Self-observer agreement rises when the observer has had opportunity to see the person across many contexts — family members and close friends, not coworkers, classmates or incidental acquaintances. So the invitation should name that kind of person specifically. It also fits the person-centered profile tradition this project's question bank already draws on, in which a document about a person is assembled with the help of those around them (Millar & Aitken, 2003)."),
boldPara("Four constraints, and they exist because this can go wrong in a way the rest of the plan cannot. ", "The hazard Ken named is hurt feelings; the deeper hazard is that a product built so that a non-speaking person can speak as themselves becomes a product in which others define how they sound."),
numbered("The user invites the partner. The app never approaches a partner directly, and never suggests it more than once."),
numbered("The user sees every answer and can discard any of it. Nothing a partner says enters the profile without the user accepting it."),
numbered("Partner input is marked as second-hand and never outranks the user's own answer where the two conflict. The disagreement is information, not an error to be corrected in the user's direction."),
numbered("Partner answers are private to the user unless the user chooses to share them back. A mother answering about her son is answering about their relationship, and \"that is not how I am with you\" is a sentence that should be said by the user if it is said at all."),
boldPara("There is a design dividend. ", "A partner is qualified to answer about their own relationship with the user, not about the user in general — and per-relationship register is exactly what Phase 3 needs. The same forced-choice items, put to a partner as \"which of these sounds most like how he talks with you?\", produce graph-edge data directly. The partner channel is therefore not a parallel instrument; it is the Phase-3 instrument, administered to the person best placed to answer it."),

heading2("5.5  The Express Panel ships half-populated"),
boldPara("Decided (Ken, August 7 2026). ", "Roughly half the cells carry default phrases; the remainder are displayed but blank, inviting the user to put their own words in them."),
para("This resolves a genuine tension. An entirely empty panel on a reserved-cell grid means a screen of blank holes on day one, the feature is never discovered, and the app reads as broken. An entirely full panel of our phrases is complete, and so invites nothing."),
boldPara("The middle position has direct empirical support. ", "Nunes and Drèze's endowed progress effect: people given artificial advancement toward a goal persist further and complete more often than people starting from zero — a task framed as begun-but-incomplete outperforms the same task framed as not yet started (Nunes & Drèze, 2006). A half-filled panel is a begun task. An empty one is not, and a full one is finished."),
boldPara("Which half stays. ", "The conversational plumbing keeps its cells — Yes, No, Okay, Please, Thank you, Sorry, Wait, Help, Hi, Bye — because it is immediately useful and makes no claim about the user. The flavored items vacate: \"That's funny\", \"See you later\", \"I think so\", \"I'm not sure\". Those are the ones that look like voice while being ours, and they are exactly the cells worth handing over."),
boldPara("Provenance marking, in the same change. ", "Each item records whether it is an untouched default, user-added, or user-edited. Three payoffs for one small field:"),
numbered("Only user-touched items count as voice signal, so the Express Panel stops overstating what it knows."),
numbered("The Phase-2 catchphrase redaction list becomes the user's own phrases rather than ours — see Section 5.1, consequence 2."),
numbered("It yields the personalization-depth measure the August 7 2026 beta instrumentation decision explicitly asked for: Express items added or edited, which is plausibly a leading indicator of engagement."),
boldPara("Tapping a blank cell opens the editor for that cell — but not during a conversation (Ken, August 7 2026). ", "This makes the invitation real rather than decorative, and it carries a benefit beyond discovery that is worth stating on its own: the user edits the cell in the grid position they want it, instead of typing a phrase into a list and then reordering rows until it lands in the right place. That is a direct answer to the complaint in Section 4.3 that editing the panel is a non-trivial exercise — position and content stop being two separate operations."),
boldPara("The restriction is doing real safety work, not tidiness. ", "A filled cell speaks on tap; a blank cell would open an editor. Those are radically different consequences for adjacent holes in a keyguard, and this population taps imprecisely — which is why the double-tap safeguard exists. A stray tap on a blank cell today does nothing; opening a full-screen editor mid-conversation would be worse than nothing. Confining the affordance to the gaps between conversations removes the only genuinely bad outcome while keeping all of the benefit, since nobody composes their button set mid-exchange."),
boldPara("The predicate should be the conversation, not the moment. ", "Tie it to the span between Start conversation and End conversation rather than to instantaneous engine state. A control that works at some moments within a conversation and not others is less predictable than one that is simply unavailable for the duration, and predictability is worth more than reach here. The rule states in one sentence: you can edit your buttons between conversations, not during one."),
boldPara("One limitation to accept rather than design around. ", "The affordance disappears once the user has filled every cell, so in-situ positioning helps while populating the panel and not afterward. Editing a filled cell in place would need a distinct gesture such as a long press, and adding a gesture to the conversation surface is a larger decision than this one; it is deliberately not proposed here."),
emptyPara(),

// ===== 6. THE PLAN =====
heading1("6.  The Plan"),
emptyPara(),
table([900, 3700, 1200, 1500, 2060],
    ["Phase", "What", "Size", "User effort", "Depends on"],
    [
        ["0", "A voice block the prompt can use", "Small", "None", "—"],
        ["1", "\"Sound Check\" forced-choice module,\nplus C3, C4 and negative constraints", "Small", "About 12 taps, once", "Phase 0"],
        ["2", "Harvest voice from actual use", "Medium", "None — self-populating", "Phases 0, 1"],
        ["3", "Per-person register on the graph edge,\nwith optional partner review", "Medium", "Per person, optional", "Phase 1"],
        ["4", "Personality and values inventory", "Large", "High", "—"],
    ]),
caption("Table 3. Phases in recommended order. Phases 0 and 1 together are the minimum that makes the claim honest."),
emptyPara(),

heading2("6.1  Phase 0 — give the instruction something to act on"),
para("Add a voice block to the profile assembly, mirroring the four blocks already there. This is a well-established seam: each existing model exposes a builder, the app sets it on the LLM module before each generation, and the block is concatenated into the system prompt."),
boldPara("Placement matters and should not be treated as incidental. ", "Facts are situational — most of them are irrelevant to most turns. Register is a global constraint on every card in every palette. The voice block therefore needs explicit standing near the top of the prompt rather than being appended as one more paragraph in a growing pile, where instruction-following degrades."),
boldPara("The block carries exemplars, not adjectives. ", "Per Section 3.1 the model uses examples better than descriptions, and per Section 3.5 the forced-choice instrument produces examples. So the block should read as a short set of sentences this user endorsed, with at most a line of framing — not as a paragraph of style adjectives derived from those sentences, which would discard the very form that makes them effective."),
para("Phase 0 can ship before any new data is collected, seeded from whatever Express Panel phrases the user has written. Two cautions, both easy to get backwards:"),
bulletBold("Use user-written Express phrases as evidence of vocabulary and idiom, not of length. ", "Button labels are short by construction, so treating them as evidence of a preference for short replies would bake in a bias that came from the widget rather than the person."),
bulletBold("Use only user-written ones. ", "Seeding the voice block from the shipped defaults would tell the model that this user's characteristic vocabulary is \"Yes\", \"No\" and \"Thank you.\" This is why Section 5.5's provenance marking is a dependency of Phase 0, not a later refinement."),

heading2("6.2  Phase 1 — \"Sound Check\", a short forced-choice module"),
para("A new About Me module built on the instrument in Sections 3.4 and 5.3. Roughly twelve items, one tap each."),
boldPara("Item shape. ", "A partner turn, then three or four candidate replies that hold content constant and vary on exactly one dimension, and the question \"which would you rather say?\" — the wording settled in Section 5.3. Every item offers both escapes, so a weak preference is recorded as weak rather than forced into a verdict."),
emptyPara(),
codeBlock(`They said:  "How was your weekend?"

Which would you rather say?

  1  "Pretty good, thanks. Went to my brother's on Sunday."
  2  "It was good! I had a really nice time at my brother's
      place on Sunday - we cooked out."
  3  "Good. You?"
  4  "Not bad. What about yours?"

  [ They're all fine ]     [ I wouldn't say any of these ]`),
caption("Figure 1. One item, varying economy and floor-handling while holding the content fixed. Options 3 and 4 return the floor; 1 and 2 do not."),
boldPara("The dimensions worth covering, drawn from Table 1: ", "economy, formality and contraction, explicit versus implied affect, whether a reply returns the floor, and whether warmth is marked overtly. Five dimensions at two or three items each is the twelve."),
boldPara("The item bank is hand-authored, not model-generated. ", "Per Section 3.5, generating candidates from the same model at run time would limit the instrument to discovering which corner of the model's own range the user prefers. Hand-authoring is also what guarantees content is genuinely held constant, which is the condition on which the whole instrument depends."),
para("Alongside the forced-choice items, three things that are cheap and do not fit the format:"),
bulletBold("What you never say. ", "Swearing, slang, over-apologizing, particular words. Negative constraints are easy for a user to state, easy for a model to obey, and unusually high-value: getting this wrong is conspicuous in a way that getting warmth slightly wrong is not."),
bulletBold("C3 — topics to steer toward and away from. ", "Not voice, but in the same gap, and the highest-value single missing field in the persona audit. \"Do not ask me about my disability, especially not what happened to you\" is currently unrepresentable, and for this population that is a larger miss than any style question."),
bulletBold("C4 — dislikes and pet peeves. ", "Cheap, concrete, and shapes stance in a way values scores are supposed to but do not."),
boldPara("Writing samples become optional, not load-bearing. ", "A user who can and wants to compose two short samples — one to a close friend, one to someone official — should be offered the box, and the samples are genuinely the strongest single input when they exist. But they must be framed as conversational turns rather than as prose about oneself, per Section 3.2, and no part of the plan may depend on them. They are also a natural fit for supporter-assisted entry."),

heading2("6.3  Phase 2 — harvest voice from actual use"),
boldPara("The largest available asset is already on disk and unread. ", "Every committed turn records what the user said, and for palette selections it records the full set of options they were offered, the index chosen, and since August 7 2026 the CA category chosen. Composed and Express Panel turns are logged distinguishably, which is what makes differential weighting possible."),
boldPara("The weighting changed in this edition. ", "The first edition ranked card selections lowest, on the grounds that a selected card is the model's wording rather than the user's. That reasoning is correct about style exemplars and wrong about preference. A selection is a forced-choice judgment against three rejected alternatives, made in a real conversation, under no observation effect, at zero cost — which is behavioral evidence, and Section 3.3 says behavior beats self-report. It is now the authority for preference, while remaining unusable as a style exemplar."),
emptyPara(),
table([2500, 2700, 1700, 2460],
    ["Source", "What it actually is", "Weight", "Caution"],
    [
        ["Selected card, with the rejected alternatives", "A behavioral preference between wordings, in real use", "Highest, as preference", "Never as a style exemplar — see the feedback loop below."],
        ["\"In my own words\" composed text", "The user's own prose, typed by them", "Highest, as exemplar", "Rare and expensive to produce. Length may reflect effort rather than preference."],
        ["Reframe steers", "Typed direction, e.g. \"keep it short\"", "High when repeated", "A single steer is a one-off, not a standing preference. Look for repetition."],
        ["User-written Express phrases", "User-authored phrases", "High for idiom", "Not evidence of length (see 6.1). Defaults excluded. Also the catchphrase redaction list."],
        ["Sound Check answers", "Endorsed exemplars from a hand-authored bank", "Cold start", "Superseded by live selections once enough accumulate."],
    ]),
caption("Table 4. Harvest sources. The split between preference and exemplar is the design, not an implementation detail."),
boldPara("The failure mode to design against. ", "A selected card is the model's wording. Feeding selections back as style exemplars therefore teaches the model to imitate itself, converging on its own house style while producing every appearance of personalization. The mitigation is the column split in Table 4: selections inform which of several candidate wordings to prefer; they never become the sentences the model is shown as examples of how this user writes."),
para("Mechanically this is a fifth user-owned file, voice.json, following the same data-folder-with-cache pattern and the same file-in-folder-wins reconciliation as the other four. Two requirements are not optional:"),
bulletBold("It must honor \"Don't save this conversation.\" ", "The harvest is derived from conversation content, so a conversation the user marked private must contribute nothing."),
bulletBold("The user must be able to see and edit what it concluded. ", "\"Here is what I think you sound like\" cannot be a black box, and least of all for people who have spent their lives having others speak on their behalf. Making the conclusion visible and correctable is a dignity requirement, not a usability nicety. It is also the mechanism by which Section 3.3's self-versus-behavior disagreement becomes visible to the person it is about."),

heading2("6.4  Phase 3 — per-person register"),
para("Register attributes on the me-to-person edge in the relationship graph, edited in a new People-editor section, \"how I talk with this person\": how formal, what is talked about, what is avoided, and which Express Panel phrases belong to them."),
boldPara("The instrument is the Phase-1 instrument, put to the partner. ", "Per Section 5.4, a partner can answer about their own relationship with the user, which is precisely this data. The same items produce edge attributes directly, from the person best placed to supply them, with all four constraints in 5.4 in force. The question changes with the respondent — the user is asked \"which would you rather say?\" and the partner \"which sounds most like how he talks with you?\" — and Section 5.3 explains why that difference is deliberate rather than sloppy."),
boldPara("Schedule this with the other three edge features ", "— standing relationship goal, per-partner openers and closings, and vulgarity permission — per Section 5.2. Note that vulgarity permission is separately blocked on the unresolved question of guardian approval, so it may need to ship inert."),

heading2("6.5  Phase 4 — personality and values inventory"),
para("The original Tier-B design: Big Five personality, Schwartz values in Portrait format, emotional landscape. Retained, and placed last."),
para("The values half has independent worth that neither samples nor style preferences deliver — what matters to a person shapes what they push back on and what they let go, which is stance rather than style. The personality half is the weakest signal per unit of user effort in the entire question bank, and much of what it is trying to reach is delivered more directly and far more cheaply by Phases 1 and 2. Build it if the earlier phases leave an identifiable gap; do not build it first on the assumption that they will."),
emptyPara(),

// ===== 7. MEASUREMENT =====
heading1("7.  How We Will Know It Worked"),
para("This is the feature most likely to ship and never be evaluated, because \"sounds like me\" has no natural pass or fail and every phase produces output that looks plausible whether or not it is working. Deciding the instrument before building is the difference between knowing and assuming."),
bulletBold("A \"does this sound like you?\" mark on response cards, logged. ", "The cheapest real ground truth, and the only one that comes from the person whose voice it is. Low effort per use, and it accumulates."),
bulletBold("Practice Mode A/B. ", "Run the same scenario twice, with the voice block present and absent, and compare. Practice Mode is acoustically clean and repeatable, which makes it the natural test bench."),
bulletBold("Watch the Reframe steers. ", "If users stop typing \"keep it short,\" the voice layer has absorbed a correction they were previously making by hand every turn. This is a behavioral measure that costs nothing to collect and is hard to fool."),
bulletBold("Agreement between Sound Check and live selection. ", "Compare what the user endorsed in Phase 1 against what they actually pick in conversation. Convergence is evidence the instrument works; persistent divergence is more interesting still, and is the app noticing something about the person that Section 3.3 predicts."),
boldPara("One trap in this measurement plan, which Section 8.1 explains: ", "a falling share of composed \"In my own words\" turns is ambiguous. It may mean the cards have become good enough, or it may mean the user has begun deferring. It must never be read alone, only alongside the \"does this sound like you?\" mark."),
boldPara("One constraint on how all of this is presented: ", "these measure the app's output, never the user. The standing rule that session metrics inform and never score the user applies with full force here, because a metric about how well the app imitates someone is one careless label away from reading as a metric about the person."),
emptyPara(),

// ===== 8. RISKS =====
heading1("8.  Risks, and What We Are Deliberately Not Doing"),

heading2("8.1  The Cyrano problem"),
boldPara("Raised as a first-class risk (Ken, August 7 2026), by analogy to Cyrano de Bergerac and Christian. ", "The insidious failure is not that the user feels the system chose for them. It is that the user comes to believe the AI is the better communicator, and defers to it."),
boldPara("This is measured, not speculative. ", "Jakesch and colleagues gave 1,506 participants a language-model writing assistant configured to argue one side of a question. It changed what participants wrote — and it changed the opinions they subsequently reported on an attitude survey. They name the mechanism latent persuasion: influence exerted not by a persuader with a message but by a tool with a tilt (Jakesch et al., 2023). The human-factors literature has the general form: misuse of automation is over-reliance, and automation bias is the adoption of automated advice without independent verification (Parasuraman & Riley, 1997)."),
boldPara("The uncomfortable part, which this plan must state rather than bury: the voice layer makes this risk worse, not better. ", "Today, a card that does not sound like the user produces friction, and that friction is what prompts them to reach for \"In my own words.\" It is the user's own defense against deferring, and it is powered by exactly the mismatch this document proposes to eliminate. Succeeding at the stated goal removes the signal."),
boldPara("Ken's counterweight is recorded because it is right and because it constrains the mitigations: ", "falling back on a less-than-totally-me response can be entirely acceptable if it keeps you in the conversation. That is the product's founding premise — the four-second silence is the enemy. So the answer is emphatically not to make the cards worse."),
para("What actually mitigates it:"),
numbered("Free composition must not be so much slower than tapping a card that deferring becomes the rational choice. This reframes the composition-speed work — word prediction, phrase expansion, abbreviation expansion — as a dependency of the voice layer rather than an unrelated convenience."),
numbered("Cards must never be ranked by quality. Position carries category, not rank, per the August 7 2026 correction; a palette ordered best-first is a standing invitation to defer to slot 1. This is now a second, independent reason for a decision taken on other grounds."),
numbered("Measure it, accepting that the measurement is ambiguous. The composed-turn share and the Reframe-steer rate are the available indicators, and both move the same way whether the layer is succeeding or the user is deferring. Only the \"does this sound like you?\" mark separates the two, which is why Section 7 makes it the primary instrument rather than a nicety."),
numbered("Keep Section 5.1 in force. The catchphrase decision already removes the sharpest version of this — a device that produces the user's own idiom unprompted is the hardest of all to distinguish from the user."),

heading2("8.2  Other risks"),
bulletBold("Register lock-in. ", "A user who supplies only casual answers gets casual cards at a clinic. Mitigated by covering range in Phase 1 and properly solved by Phase 3."),
bulletBold("Model self-imitation through the harvest. ", "Addressed by the preference-versus-exemplar split in Table 4; it is called out again here because it is invisible when it happens and would be easy to declare a success."),
bulletBold("Instrument capture by the model's own range. ", "If Sound Check items were model-generated, the instrument could only find the user's preferred corner of the model's default style. Addressed by hand-authoring the item bank (Section 6.2)."),
bulletBold("Catchphrase over-application. ", "Eliminated by Section 5.1 rather than managed — the model is never given them."),
bulletBold("Effort cost. ", "Every question asked of this user has a physical price. This is the reason the primary instrument is recognition rather than production, the reason Phase 2 exists, and the reason Phase 4 is last: the best voice data is the data the user never had to sit down and provide."),
bulletBold("Partner overreach. ", "Addressed by the four constraints in Section 5.4, which exist because the failure here is not a bad profile but a person being described by others in a product built so they would not have to be."),
bulletBold("Not doing: a style-transfer or fine-tuning approach. ", "It would need far more data than one user generates, it conflicts with the no-backend architecture, and prompt-level imitation from good examples is sufficient at this quality bar."),
bulletBold("Not doing: inferring register from the partner's speech. ", "Mirroring whoever is talking would produce a user whose personality changes with the room, which is close to the opposite of the goal."),
emptyPara(),

// ===== 9. RECOMMENDATION =====
heading1("9.  Recommendation"),
para("Build Phase 0 and Phase 1 together, as one small increment, with the Express Panel provenance marking from Section 5.5 included — Phase 0 depends on it to avoid seeding the voice block with our own default phrases. Phase 0 alone changes nothing the user can perceive, and Phase 1 alone has nowhere to send its answers; together they are the first point at which the product's \"starts sounding like them specifically\" claim becomes true rather than aspirational."),
para("Phase 2 follows as the highest-value item in the plan, because it is the only one that improves without asking the user for anything, and because its raw material is already being written to disk and read by nothing. The aggregation half can begin before the rest of the phase, since the data has been accumulating since v0.3.0."),
para("Phase 3 should be scheduled when the other three me-to-person edge features are scheduled, not on its own. Phase 4 is optional and should be reconsidered only after Phases 1 and 2 have been in real use long enough to show what they do not reach."),
emptyPara(),

// ===== 10. REFERENCES =====
heading1("10.  References"),
para("Sources consulted August 7 2026. Claims in this document that rest on one of these name it inline; claims that rest on nothing are marked as inference in the text.", { run: { italics: true, color: "595959", size: 20 } }),
emptyPara(),
reference("Bhandarkar, A., Wang, R., Verma, N., & Roth, D. (2025). Catch Me If You Can? Not Yet: LLMs Still Struggle to Imitate the Implicit Writing Styles of Everyday Authors. arXiv:2509.14543."),
reference("Biber, D. (1988). Variation across Speech and Writing. Cambridge University Press."),
reference("Gonzales, A. L., & Hancock, J. T. (2008). Identity shift in computer-mediated environments. Media Psychology, 11(2), 167-185."),
reference("Gosling, S. D., John, O. P., Craik, K. H., & Robins, R. W. (1998). Do people know how they behave? Self-reported act frequencies compared with on-line codings by observers. Journal of Personality and Social Psychology, 74(5), 1337-1349."),
reference("Jakesch, M., Bhat, A., Buschek, D., Zalmanson, L., & Naaman, M. (2023). Co-Writing with Opinionated Language Models Affects Users' Views. Proceedings of the 2023 CHI Conference on Human Factors in Computing Systems (CHI '23)."),
reference("Jemama, R., & Naous, T. (2025). How Well Do LLMs Imitate Human Writing Style? arXiv:2509.24930."),
reference("Kane, S. K., Morris, M. R., Paradiso, A., & Campbell, J. (2017). \"At times avuncular and cantankerous, with the reflexes of a mongoose\": Understanding Self-Expression through Augmentative and Alternative Communication Devices. Proceedings of the 2017 ACM Conference on Computer Supported Cooperative Work and Social Computing (CSCW '17), 1166-1179."),
reference("Millar, S., & Aitken, S. (2003). Personal Communication Passports: Guidelines for Good Practice. CALL Centre, University of Edinburgh."),
reference("Nunes, J. C., & Drèze, X. (2006). The endowed progress effect: How artificial advancement increases effort. Journal of Consumer Research, 32(4), 504-512."),
reference("Parasuraman, R., & Riley, V. (1997). Humans and automation: Use, misuse, disuse, abuse. Human Factors, 39(2), 230-253."),
reference("Tausczik, Y. R., & Pennebaker, J. W. (2010). The psychological meaning of words: LIWC and computerized text analysis methods. Journal of Language and Social Psychology, 29(1), 24-54."),
reference("Thurstone, L. L. (1927). A law of comparative judgment. Psychological Review, 34(4), 273-286."),
reference("Valencia, S., Cave, R., Kallarackal, K., Seaver, K., Terry, M., & Kane, S. K. (2023). \"The less I type, the better\": How AI Language Models can Enhance or Impede Communication for AAC Users. Proceedings of the 2023 CHI Conference on Human Factors in Computing Systems (CHI '23)."),
reference("Vazire, S. (2010). Who knows what about a person? The self-other knowledge asymmetry (SOKA) model. Journal of Personality and Social Psychology, 98(2), 281-300."),
reference("Zhang, Z., et al. (2025). A Survey on Personalized and Pluralistic Preference Alignment in Large Language Models. arXiv:2504.07070."),
emptyPara(),

        ]
    }]
});

// Override with OUT_DOCX=... when the real file is open in Word (EBUSY).
const OUT = process.env.OUT_DOCX || "Conversant AAC Sounds Like Me.docx";
Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(OUT, buf);
    console.log("Wrote " + OUT + " (" + buf.length + " bytes)");
}).catch(err => { console.error(err); process.exit(1); });
