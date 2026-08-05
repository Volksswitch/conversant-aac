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
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  August 2026", color: "808080", size: 20, font: "Arial" })]
}),

// ===== 1. SUMMARY =====
heading1("1.  Summary"),
para("Conversant AAC's central promise is that the device speaks as the user, not for them. The profile work built so far delivers half of that: the app knows a great deal about what the user can truthfully say. It knows almost nothing about how they would say it. This document plans the second half — the voice layer."),
boldPara("The central engineering judgment: ", "voice is an imitation problem, not a knowledge problem, and imitation is served far better by examples than by descriptions. Three sentences the user actually wrote outperform any number of trait scores. This reorders the Tier-B design in the original question bank, which leads with Big Five personality and Schwartz values — psychometrically respectable, but the path from \"scores high on Agreeableness\" to a spoken sentence is long, lossy, and expensive to collect from a user for whom answering questions is physically draining."),
boldPara("The recommended sequence: ", "make the prompt able to accept voice data at all (Phase 0), collect a small number of writing samples and negative constraints (Phase 1), then harvest voice continuously and invisibly from the user's own composed text as they use the app (Phase 2). Per-person register (Phase 3) follows, bundled with three other features that want the same data structure. The abstract personality and values inventory (Phase 4) goes last."),
boldPara("Phases 0 and 1 together are a small build ", "and are what would make the product's \"starts sounding like them specifically\" claim honest."),
emptyPara(),

// ===== 2. THE PROBLEM =====
heading1("2.  What the Problem Actually Is"),
para("Every profile subsystem shipped so far — the worldview questionnaire, the relationship graph, My Places — answers one question: what facts about this person are true, and therefore what may the assistant say on their behalf without inventing anything? That is the right question, it is well served, and it is guarded by the anti-fabrication rule."),
para("It is not the question \"sounds like me\" asks. Consider two responses to the same partner turn:"),
codeBlock(`Partner:  "Hey! Good timing - your pull list came in this morning."

  (a)  "That is excellent news. I have been looking forward to
        collecting those issues all week."

  (b)  "Nice - what came in?"`),
para("Both are factually clean. Both draw on the same profile. Neither invents anything. And they are not the same person. Nothing currently in the app distinguishes them, because the distinction is not made of facts."),
boldPara("Facts drive topic selection; they do essentially nothing for register. ", "So adding more of the kind of data already collected — more favorites, more places, more people — will not close this gap, however much of it is collected. The voice layer needs a different kind of input."),
heading2("2.1  Why examples beat descriptions"),
para("The obvious design is to ask the user to describe their own style: how formal are you, how long are your replies, are you funny. The demo persona does exactly this, in the sentence \"he keeps his replies short and snappy.\" Descriptions of this kind are weak instructions. They are abstract, they are self-report about behavior the speaker does not consciously observe, and the model has to invent the mapping from adjective to sentence."),
para("A writing sample is a strong instruction. It carries length, rhythm, formality, punctuation habits, vocabulary, and the shape of the person's sentences all at once, in the form the model is best at using. It also costs the user less: one open box beats ten scale questions, which matters more here than in most products, because information gathering is physically expensive for the target user and the question bank is explicitly designed to be chunked."),
boldPara("This is the reordering to be aware of. ", "The original Tier-B design is not discarded — the values half retains independent worth, since what matters to a person shapes stance in ways samples do not capture — but it is the weakest signal per unit of user effort of anything available, and it should not be the opening move."),
emptyPara(),

// ===== 3. WHERE IT STANDS =====
heading1("3.  Where It Stands Today"),
para("An audit against the shipped code, August 2026."),
heading2("3.1  The prompt already asks for voice, and nothing answers"),
para("The generation system prompt opens by telling the model to speak as the user:"),
codeBlock(`You are an AAC (Augmentative and Alternative Communication) assistant.
A non-speaking user is in a live conversation. You speak AS the user, in
their voice - not as a helpful assistant.`),
para("That instruction is correct and it has nothing behind it. The profile block assembled and appended to it is composed of exactly four sections — the worldview facts, the relationship graph, My Places, and the current situation — plus the rule forbidding bracketed placeholders. There is no voice section, and no field anywhere in the app produces one. The model is asked to imitate a person it has been given no stylistic information about, and it falls back on its own default register."),
heading2("3.2  What the questionnaire can and cannot hold"),
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
        ["B3 How you talk (register and style)", "No", "No Tier B module exists. See Section 4.2 — partly belongs on the person, not the profile."],
        ["B4 Values", "No", "No Tier B module exists."],
        ["B5 Beliefs", "No", "Deferred deliberately (June 2026)."],
        ["B6 How you treat different people", "No", "Cannot be a questionnaire field at all — see Section 4.2."],
        ["B7 Emotional landscape", "No", "No Tier B module exists."],
        ["B8 Your voice, in your own words", "No", "No Tier B module exists. This is the single most valuable missing field."],
    ]),
caption("Table 1. The test persona against the shipped registry. Everything in the lower two-thirds is background the app has never been told."),
boldPara("This has a practical consequence beyond the plan. ", "The demo script was using the persona's voice description as an acceptance criterion for live output — judging whether cards \"land on Marc\" against a register the app was never given. The operator would have judged the app as failing, correctly. That has been corrected in the script; it is recorded here because the same trap will recur in any future test material written from the persona."),
heading2("3.3  The one voice channel that does exist"),
para("The Express Panel is, today, the only place in the product where the user's exact words are spoken. Its phrases are user-authored, stored in express-panel.json, and spoken verbatim on a tap. It is a partial answer to \"sounds like me\" that already works, and Section 4.1 makes it the permanent home for one specific part of the problem."),
emptyPara(),

// ===== 4. TWO DECISIONS =====
heading1("4.  Two Decisions That Shape the Plan"),
heading2("4.1  Catchphrases are Express Panel buttons, and the AI never produces them"),
boldPara("Decided (Ken, August 5 2026). ", "A user's characteristic turns of phrase — \"Let's go!\", \"That's clutch\", \"Nah, I'm good\" — live as Express Panel buttons, possibly scoped by place and person. They are never supplied to the model, and the model never produces or builds on them."),
para("This closes a real failure mode rather than mitigating it. Given a list of catchphrases, language models over-apply them: they sprinkle the marker into responses where a real speaker would not use it, and idiolect used slightly wrong is worse than idiolect absent, because it reads as impersonation. There is no reliable prompt instruction that prevents this; removing the input does."),
para("There is a second and better reason. A catchphrase the model guesses at is presented to the partner as though it were spontaneous, when in fact it was inferred. A catchphrase on a button is the user deliberately choosing to say their own words. That is the same principle as the anti-fabrication rule, applied to style instead of fact, and it is more honest."),
para("Three consequences follow, and the second has teeth:"),
numbered("Phase 1 does not collect catchphrases as a voice field. The question \"what do you say a lot?\" instead seeds Express Panel buttons — producing something the user can immediately tap, rather than prompt text they never see."),
numbered("Phase 2 harvests the user's own composed prose, and that prose contains their catchphrases. The prohibition therefore needs enforcement at the harvest boundary, not merely an instruction in the prompt. The Express Panel list is itself the catchphrase list, so it doubles as a redaction list: known phrases are stripped from harvested samples before those samples ever reach the model."),
numbered("Catchphrases become an early, concrete use case for the place- and person-scoped Express Panel work already on the roadmap — the phrases used with friends are not the phrases used with a doctor."),
emptyPara(),
heading2("4.2  Register is per-person, so it is graph data, not questionnaire data"),
boldPara("Decided (Ken, August 5 2026). ", "The observation that forced this: Marc would never say \"Let's go!\" to his mother except as a momentary joke. A single global register field would therefore not merely be incomplete — it would be wrong, because it asserts one answer where the true answer varies by audience."),
para("This is the second instance of one rule, and the rule is worth stating on its own:"),
boldPara("When a questionnaire field's correct answer varies per person, it is not a questionnaire field. ", "The first instance was module A3, \"People in Your Life,\" which was deleted in v0.2.27 and became the relationship graph. Tier B's B6 topic, \"how you treat different people,\" anticipated the content but not this consequence: it cannot live in a flat key-to-answer registry at all. Apply the test when authoring any remaining Tier-B question."),
para("What survives as a global field is the part that genuinely does not vary: the user's range, their floor and ceiling of formality, what they never say under any circumstances, and whether they are funny. What moves to the relationship graph is where a given person sits within that range."),
boldPara("A note on build economics. ", "Four separate features now want attributes on the same me-to-person edge: the standing relationship goal, per-partner openers and closings, vulgarity permission, and now register. That is one People-editor section — \"how I talk with this person\" — plus four small prompt contributions. It is one build, not four, and it should be scheduled as one."),
emptyPara(),

// ===== 5. THE PLAN =====
heading1("5.  The Plan"),
emptyPara(),
table([900, 3700, 1200, 1500, 2060],
    ["Phase", "What", "Size", "User effort", "Depends on"],
    [
        ["0", "A voice block the prompt can use", "Small", "None", "—"],
        ["1", "\"How I Sound\" module, plus C3 and C4", "Small", "About 8 questions, once", "Phase 0"],
        ["2", "Harvest voice from actual use", "Medium", "None — self-populating", "Phases 0, 1"],
        ["3", "Per-person register on the graph edge", "Medium", "Per person, optional", "Phase 1"],
        ["4", "Personality and values inventory", "Large", "High", "—"],
    ]),
caption("Table 2. Phases in recommended order. Phases 0 and 1 together are the minimum that makes the claim honest."),
emptyPara(),

heading2("5.1  Phase 0 — give the instruction something to act on"),
para("Add a voice block to the profile assembly, mirroring the four blocks already there. This is a well-established seam: each existing model exposes a builder, the app sets it on the LLM module before each generation, and the block is concatenated into the system prompt."),
boldPara("Placement matters and should not be treated as incidental. ", "Facts are situational — most of them are irrelevant to most turns. Register is a global constraint on every card in every palette. The voice block therefore needs explicit standing near the top of the prompt rather than being appended as one more paragraph in a growing pile, where instruction-following degrades."),
para("Phase 0 can ship before any new data is collected, seeded from the Express Panel phrases the user has already written. One caution, which is easy to get backwards:"),
bulletBold("Use existing Express phrases as evidence of vocabulary and idiom, not of length. ", "Button labels are short by construction, so treating them as evidence of a preference for short replies would bake in a bias that came from the widget rather than the person."),
emptyPara(),

heading2("5.2  Phase 1 — a short \"How I Sound\" module"),
para("A new About Me module of roughly eight questions, every one of them sample-shaped or constraint-shaped rather than scale-shaped."),
bulletBold("Two writing samples: one written to a close friend, one to someone official. ", "This is the load-bearing item. Two questions capture range, which is what register actually is — a single sample captures only one register and would produce a user who sounds identical at a party and at a clinic. These two also become the interpolation endpoints that Phase 3 places individual people between."),
bulletBold("Reply length preference. ", "Short, medium, or long. Cheap, and directly actionable by the model."),
bulletBold("What you never say. ", "Swearing, slang, over-apologizing, particular words. Negative constraints are easy for a user to state, easy for a model to obey, and unusually high-value: getting this wrong is conspicuous in a way that getting warmth slightly wrong is not."),
bulletBold("Humor: do you joke around, and what kind. ", "The one abstract trait worth asking directly, because humor does not sample reliably from a short writing prompt — a person can be funny without being funny in the two sentences they happened to write."),
bulletBold("What you say a lot. ", "Collected here, but routed to the Express Panel as buttons rather than into the voice block — see Section 4.1."),
para("Two further fields should be bundled into the same registry edit, because the registry is open anyway and they are cheap:"),
bulletBold("C3 — topics to steer toward and away from. ", "Not voice, but in the same gap, and the highest-value single missing field in the persona audit. \"Do not ask me about my disability, especially not what happened to you\" is currently unrepresentable, and for this population that is a larger miss than any style question."),
bulletBold("C4 — dislikes and pet peeves. ", "Cheap, concrete, and shapes stance in a way values scores are supposed to but do not."),
emptyPara(),

heading2("5.3  Phase 2 — harvest voice from actual use"),
boldPara("The largest available asset is already on disk and unread. ", "Every committed turn records what the user said, and for palette selections it records the full set of options they were offered alongside the index they chose. Composed and Express Panel turns are logged distinguishably, which is precisely what makes differential weighting possible."),
emptyPara(),
table([2700, 2800, 1400, 2460],
    ["Source", "What it actually is", "Weight", "Caution"],
    [
        ["\"In my own words\" composed text", "The user's own prose, typed by them", "Highest", "None — this is genuinely and unambiguously their voice."],
        ["Reframe steers", "Typed direction, e.g. \"keep it short\"", "High when repeated", "A single steer is a one-off, not a standing preference. Look for repetition."],
        ["Express Panel phrases", "User-authored phrases", "High for idiom", "Not evidence of length (see 5.1). Also the catchphrase redaction list."],
        ["Selected card, and the rejected alternatives", "A preference between the model's wordings", "Low as style", "Feedback loop — see below. Useful as preference data, not as style exemplars."],
    ]),
caption("Table 3. Harvest sources in descending value. The weighting is the design, not an implementation detail."),
boldPara("The failure mode to design against. ", "A selected card is the model's wording, not the user's — the user chose among four options the model wrote. Feeding selections back as style exemplars therefore teaches the model to imitate itself, converging on its own house style while producing every appearance of personalization. The mitigation is the weighting in Table 3: composed prose dominates, and selections are used as preference signal (this wording was chosen over those three) rather than as samples of how the user writes."),
para("Mechanically this is a fifth user-owned file, voice.json, following the same data-folder-with-cache pattern and the same file-in-folder-wins reconciliation as the other four. Two requirements are not optional:"),
bulletBold("It must honor \"Don't save this conversation.\" ", "The harvest is derived from conversation content, so a conversation the user marked private must contribute nothing."),
bulletBold("The user must be able to see and edit what it concluded. ", "\"Here is what I think you sound like\" cannot be a black box, and least of all for people who have spent their lives having others speak on their behalf. Making the conclusion visible and correctable is a dignity requirement, not a usability nicety."),
emptyPara(),

heading2("5.4  Phase 3 — per-person register"),
para("Register attributes on the me-to-person edge in the relationship graph, edited in a new People-editor section, \"how I talk with this person\": how formal, what is talked about, what is avoided, and which Express Panel phrases belong to them. Phase 1's friend-and-official pair gives this a scale to place people on, so the editor asks where someone sits between two known points rather than asking the user to characterize each relationship from nothing."),
boldPara("Schedule this with the other three edge features ", "— standing relationship goal, per-partner openers and closings, and vulgarity permission — per Section 4.2. Note that vulgarity permission is separately blocked on the unresolved question of guardian approval, so it may need to ship inert."),
emptyPara(),

heading2("5.5  Phase 4 — personality and values inventory"),
para("The original Tier-B design: Big Five personality, Schwartz values in Portrait format, emotional landscape. Retained, and placed last."),
para("The values half has independent worth that samples do not deliver — what matters to a person shapes what they push back on and what they let go, which is stance rather than style. The personality half is the weakest signal per unit of user effort in the entire question bank, and much of what it is trying to reach is delivered more directly and far more cheaply by Phases 1 and 2. Build it if the earlier phases leave an identifiable gap; do not build it first on the assumption that they will."),
emptyPara(),

// ===== 6. MEASUREMENT =====
heading1("6.  How We Will Know It Worked"),
para("This is the feature most likely to ship and never be evaluated, because \"sounds like me\" has no natural pass or fail and every phase produces output that looks plausible whether or not it is working. Deciding the instrument before building is the difference between knowing and assuming."),
bulletBold("A \"does this sound like you?\" mark on response cards, logged. ", "The cheapest real ground truth, and the only one that comes from the person whose voice it is. Low effort per use, and it accumulates."),
bulletBold("Practice Mode A/B. ", "Run the same scenario twice, with the voice block present and absent, and compare. Practice Mode is acoustically clean and repeatable, which makes it the natural test bench."),
bulletBold("Watch the Reframe steers. ", "If users stop typing \"keep it short,\" the voice layer has absorbed a correction they were previously making by hand every turn. This is a behavioral measure that costs nothing to collect and is hard to fool."),
boldPara("One constraint on how this is presented: ", "these measure the app's output, never the user. The standing rule that session metrics inform and never score the user applies with full force here, because a metric about how well the app imitates someone is one careless label away from reading as a metric about the person."),
emptyPara(),

// ===== 7. RISKS =====
heading1("7.  Risks, and What We Are Deliberately Not Doing"),
bulletBold("Register lock-in. ", "A user who supplies only casual samples gets casual cards at a clinic. Mitigated by the two-sample design in Phase 1 and properly solved by Phase 3."),
bulletBold("Model self-imitation through the harvest. ", "Addressed by the weighting in Table 3; it is called out again here because it is invisible when it happens and would be easy to declare a success."),
bulletBold("Catchphrase over-application. ", "Eliminated by Section 4.1 rather than managed — the model is never given them."),
bulletBold("Effort cost. ", "Every question asked of this user has a physical price. This is the reason Phase 2 exists and the reason Phase 4 is last: the best voice data is the data the user never had to sit down and provide."),
bulletBold("Not doing: a style-transfer or fine-tuning approach. ", "It would need far more data than one user generates, it conflicts with the no-backend architecture, and prompt-level imitation from good examples is sufficient at this quality bar."),
bulletBold("Not doing: inferring register from the partner's speech. ", "Mirroring whoever is talking would produce a user whose personality changes with the room, which is close to the opposite of the goal."),
emptyPara(),

// ===== 8. RECOMMENDATION =====
heading1("8.  Recommendation"),
para("Build Phase 0 and Phase 1 together, as one small increment. Phase 0 alone changes nothing the user can perceive, and Phase 1 alone has nowhere to send its answers; together they are the first point at which the product's \"starts sounding like them specifically\" claim becomes true rather than aspirational."),
para("Phase 2 follows as the highest-value item in the plan, because it is the only one that improves without asking the user for anything, and because its raw material is already being written to disk and thrown away."),
para("Phase 3 should be scheduled when the other three me-to-person edge features are scheduled, not on its own. Phase 4 is optional and should be reconsidered only after Phases 1 and 2 have been in real use long enough to show what they do not reach."),
emptyPara(),

        ]
    }]
});

const OUT = "Conversant AAC Sounds Like Me.docx";
Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(OUT, buf);
    console.log("Wrote " + OUT + " (" + buf.length + " bytes)");
}).catch(err => { console.error(err); process.exit(1); });
