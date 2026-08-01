const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');

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
function emptyPara() { return new Paragraph({ children: [] }); }

// headers: [str]; rows: [[cell]] where cell is str or {text, italics}; widths: twips summing ~9360
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
        const run = isObj
            ? new TextRun({ text, size: 20, italics: !!cell.italics, bold: !!cell.bold })
            : new TextRun({ text, size: 20 });
        return new TableCell({
            width: { size: w, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [run] })]
        });
    };
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders,
        rows: [
            new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
            ...rows.map(r => new TableRow({ children: r.map((c, i) => bodyCell(c, widths[i])) }))
        ]
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
            children: [new TextRun({ text: "Conversant AAC — Reframe Concepts", italics: true, color: "808080", size: 18, font: "Arial" })]
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
                children: [new TextRun({ text: "Reframe: Academic Foundations", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Frame Analysis, Register Theory, Appraisal, and Pragmatics as a Basis for How Users Redirect What the AI Says", italics: true, color: "595959", size: 24, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  July 2026", color: "808080", size: 20, font: "Arial" })]
            }),

            // ===== 1. PURPOSE =====
            heading1("1.  Purpose and Origin of This Document"),
            para("This document answers a question Ken raised about the Reframe feature: the user can hand the AI additional context or direction — \"reframe\" what it is about to say — but it is hard to predict in advance every way a person might want to redirect a conversation. Is there an academic discipline that already maps this territory?"),
            para("The answer is yes, though it is not one discipline but four that converge on it, each covering a different facet of the same act. This document synthesizes them the same way Conversation Analysis (CA) literature was synthesized into CA-Concepts-for-AAC-Architecture.docx — as a grounded vocabulary the team can design against, not an academic exercise for its own sake. Section 4 turns the synthesis into a working taxonomy of redirect types, each tied to a piece of the app as it exists today or as a candidate feature. Section 7 extends the same treatment to a related, broader concept Ken raised in review — what the user hopes to achieve from a whole conversation, or from a relationship as a whole, rather than from a single turn."),
            emptyPara(),

            // ===== 2. WHY NO SINGLE DISCIPLINE OWNS IT =====
            heading1("2.  Why No Single Discipline Owns This Question"),
            para("Conversation Analysis — the discipline already grounding the rest of the Conversation Engine (sequence stack, adjacency pairs, repair, the five modes) — studies how talk is structured turn by turn: who speaks next, how a sequence opens and closes, how misunderstandings get repaired. It is very good at describing how a redirect gets accomplished inside an unfolding exchange, but it does not offer a catalogue of what a speaker might want to redirect toward. That catalogue lives one level down, inside the turn itself — in the content, tone, and stance the speaker chooses — which is the territory of a different, complementary set of fields: the sociology of interaction (Goffman), functional linguistics (Halliday; Martin and White), and pragmatics (Grice; Brown and Levinson)."),
            para("Put simply: CA explains how a turn is built and how one turn connects to the next. The frameworks below explain what a speaker is doing to the content of a single turn — steering its topic, its register, its force, its truthfulness — which is precisely what the Reframe feature lets the user do to an AI-generated turn before it is spoken."),
            emptyPara(),

            // ===== 3. THE FOUR FRAMEWORKS =====
            heading1("3.  Four Frameworks, in Turn"),

            heading2("3.1  Goffman — Frame Analysis and Footing"),
            para("The word \"reframe\" is not a coincidence — it is Erving Goffman's own term. In Frame Analysis (1974), Goffman argued that participants in any interaction are always working within a \"frame\": a shared, often tacit answer to the question \"what is it that is going on here?\" A frame can be broken, bracketed, or shifted, and doing so changes how everything said within it is meant to be taken."),
            para("Goffman's later concept of footing (Forms of Talk, 1981) is even closer to what the feature does. Footing is a speaker's alignment to what is being said — the stance they are taking up toward their own utterance and toward the people they are addressing. A change in footing is a change in that alignment: from serious to joking, from committed to hedging, from speaking for oneself to relaying someone else's words. When a user reframes a set of AI-drafted response options, they are asking the system to represent them with a different footing for the next utterance — the single most direct academic description of the mechanic the feature implements."),
            emptyPara(),

            heading2("3.2  Halliday — Systemic Functional Linguistics and Register Theory"),
            para("Michael Halliday's Systemic Functional Linguistics (SFL) holds that every stretch of language does three jobs at once, called metafunctions: it represents content (the ideational metafunction), it enacts a relationship between speakers (the interpersonal metafunction), and it organizes itself into a coherent message (the textual metafunction). The situational counterpart to these three is register — the three variables of field, tenor, and mode that together describe why an utterance sounds the way it does."),
            simpleTable(
                ["SFL variable", "What it governs", "Redirect example"],
                [
                    ["Field", "The subject matter — what is being talked about.", { text: "\"Ask about their trip instead of this.\"", italics: true }],
                    ["Tenor", "The relationship between speakers — formality, closeness, power, affect.", { text: "\"Keep it light.\"  /  \"Be more formal — this is my boss.\"", italics: true }],
                    ["Mode", "The channel and rhetorical organization of the message.", { text: "Compressed hint vs. expanded spoken text (already built — see Response Option Display).", italics: true }]
                ],
                [1800, 4160, 3400]
            ),
            emptyPara(),
            para("The practical value of register theory here is that field and tenor vary independently — a user can want the same topic delivered more warmly, or a different topic delivered in the same register, without touching the other axis. That independence is a strong argument for organizing any future redirect shortcuts (see Section 5) along these axes rather than as one undifferentiated list."),
            emptyPara(),

            heading2("3.3  Martin and White — Appraisal Theory"),
            para("Appraisal Theory (Martin and White, The Language of Evaluation, 2005) is a detailed extension of SFL's interpersonal metafunction, built specifically to catalogue how speakers express attitude and adjust its strength. It has three systems, and each maps cleanly onto a kind of redirect a user might want:"),
            bulletBold("Attitude — ", "the speaker's affect (feelings), judgment (of people's behavior — competence, propriety), and appreciation (of things and situations). This is the vocabulary behind \"I'm frustrated about this\" or \"I want to come across as capable here.\""),
            bulletBold("Engagement — ", "how the speaker positions their own view relative to other possible viewpoints — asserting flatly versus acknowledging there could be another way to see it. This is the vocabulary behind \"soften it\" or \"leave room for their side.\""),
            bulletBold("Graduation — ", "turning the volume up or down on force (how strongly something is stated) and focus (how sharply a category boundary is drawn). This is the vocabulary behind \"keep it short\" and \"be more direct\" — a single dial rather than a list of discrete choices."),
            para("Appraisal is the most fine-grained of the four frameworks and the best source of precise labels for whatever a tone/stance redirect control ends up looking like."),
            emptyPara(),

            heading2("3.4  Grice and Brown & Levinson — Pragmatics and Politeness Theory"),
            para("H. P. Grice's Cooperative Principle (\"Logic and Conversation,\" 1975) describes conversation as governed by four tacit maxims: Quantity (say as much as is needed, no more), Quality (say what you believe to be true), Relation (be relevant to the matter at hand), and Manner (be clear and orderly). Each maxim corresponds to a distinct redirect: Quantity to \"keep it short\" or \"say more,\" Quality to injecting a fact the AI could not otherwise know, and Relation to a topic pivot."),
            para("Brown and Levinson's Politeness Theory (Politeness: Some Universals in Language Usage, 1987) builds on Grice to explain why speakers routinely violate these maxims on purpose — to manage face. Positive face is the desire to be liked and approved of; negative face is the desire not to be imposed upon. A face-threatening act (a refusal, a criticism, a demand) can be softened with positive politeness (warmth, common ground), negative politeness (hedging, indirectness, deference), or avoided altogether by going off-record, or it can be delivered bald-on-record when directness is what is wanted. This is the most direct academic description of the \"be more direct\" / \"soften it\" / \"let them save face\" family of redirects — and, notably, of a design decision the app already ships: the DISPREFERRED response slot's rule that a decline is never a bare \"no,\" but always a hedge plus an account. That rule is, in effect, an implementation of Brown and Levinson's negative politeness strategies, arrived at independently."),
            emptyPara(),

            heading2("3.5  A Secondary Reference: Giles — Communication Accommodation Theory"),
            para("Howard Giles's Communication Accommodation Theory (CAT) describes how speakers shift their style toward a listener (convergence — to signal closeness or ease understanding) or away from one (divergence — to signal distance or distinctiveness). It is a lighter-weight, secondary reference here, but it explains why a tone redirect is so often partner-specific — \"be more formal, this is my boss\" is a convergence move, and the app's existing per-partner personalization (nicknames, the address-term instruction, the Partner influencer toggle) is already a step toward accommodation-aware generation."),
            emptyPara(),

            // ===== 4. TAXONOMY =====
            heading1("4.  A Grounded Taxonomy of Redirect Types"),
            para("Combining the four frameworks produces a short, bounded list of redirect categories — not an exhaustive catalogue of every sentence a user might type into the Reframe box, but the recurring dimensions those sentences move along. The rightmost column notes whether the app already has a hook for that category, or whether it is still open ground."),
            emptyPara(),
            simpleTable(
                ["Redirect category", "Academic grounding", "Example user intent", "Existing system hook"],
                [
                    ["Topic / content pivot", "SFL — Field; Grice's Maxim of Relation", { text: "“Ask about their trip instead.”", italics: true }, "Reframe free text (steer); no preset yet."],
                    ["Tone / register", "SFL — Tenor; Appraisal — Attitude", { text: "“Keep it light.”  /  “Be more formal.”", italics: true }, "Not yet exposed; candidate preset chip."],
                    ["Stance / assertiveness", "Politeness Theory (face, FTAs); Appraisal — Engagement, Graduation", { text: "“Be more direct.”  /  “Soften it.”", italics: true }, "DISPREFERRED slot's hedge + account rule (shipped)."],
                    ["Length / pacing", "Grice's Maxim of Quantity; Appraisal — Graduation", { text: "“Keep it short.”  /  “Say more.”", italics: true }, "Not yet exposed."],
                    ["Ground-truth injection", "Grice's Maxim of Quality", { text: "“I actually already told them.”", italics: true }, "Reframe-as-truth-channel (v0.3.20); anti-fabrication rule (v0.3.18)."],
                    ["Emotional coloring", "Appraisal — Attitude (affect)", { text: "“I'm frustrated about this.”", italics: true }, "Not yet exposed; related to the Express Panel Feeling toggle."],
                    ["Footing / alignment shift", "Goffman — Frame Analysis, Footing", "The umbrella mechanic the six rows above all serve.", "The Reframe feature itself."]
                ],
                [1900, 2500, 2600, 2360]
            ),
            emptyPara(),

            // ===== 5. DESIGN IMPLICATIONS =====
            heading1("5.  What This Means for Reframe's Design"),
            para("Three implications follow directly from the synthesis above, none of which require building anything today — they are recorded here for when the Reframe feature's sticky/preset variants (see the Conversation & Relationship Goals design note in CLAUDE.md) are next picked up."),
            bulletBold("Organize presets by independent axis, not as one flat list. ", "Because field, tenor, and Appraisal's three systems vary independently (Section 3.2–3.3), a future quick-select layer for Reframe reads more naturally as a small set of axes (what to talk about / how warm or formal / how direct / how much to say) than as a single undifferentiated menu — the same reasoning already applied to the curated-menu-plus-free-text design for Conversation & Relationship Goals."),
            bulletBold("Politeness Theory is a ready-made source of preset labels. ", "Brown and Levinson's bounded strategy set — bald-on-record, positive politeness, negative politeness, off-record — translates almost directly into plain-language chip candidates: “Be direct,” “Soften it,” “Let them save face,” “Just hint at it.” Because the set is small and well studied, it is a safer source of labels than inventing one from scratch."),
            bulletBold("Two design choices already made are, in hindsight, applications of these frameworks. ", "The anti-fabrication rule (v0.3.18 — never invent specific events, dates, or outcomes not given) is a direct implementation of Grice's Quality maxim; the DISPREFERRED slot's hedge-plus-account requirement (never a bare “no”) is a direct implementation of Brown and Levinson's negative politeness. Neither was designed with these frameworks in hand — noting the correspondence here is a way of confirming, after the fact, that the existing design already sits on solid ground, and gives future decisions in the same area a citation to reason from."),
            emptyPara(),

            // ===== 6. RELATIONSHIP TO CA =====
            heading1("6.  Relationship to Conversation Analysis"),
            para("This document does not replace or compete with CA-Concepts-for-AAC-Architecture.docx. CA governs the Conversation Engine's core structural layer — the sequence stack, the four-slot palette, repair, the five modes — which is about how a turn connects to the turns around it. The frameworks in this document govern a finer grain: what is going on inside a single turn once it is that turn's moment to be produced. Reframe sits at exactly that finer grain — it does not restructure the sequence (the partner's turn is still owed a response, the stack is untouched), it redirects what fills the response. The two document sets are complementary layers of the same engine, not competing accounts of it."),
            emptyPara(),

            // ===== 7. CONVERSATIONAL GOALS =====
            heading1("7.  A Related, Broader Concept: Conversational Goals"),
            para("Ken raised a related observation while reviewing this document: everything in Sections 3–5 is about redirecting a single turn mid-conversation, but there is a broader, related question sitting one level above it — what does the user hope to achieve from the conversation as a whole, or from the relationship it is part of? That question has its own academic home. It does not compete with the four frameworks above; it explains where a redirect comes from in the first place."),
            emptyPara(),

            heading2("7.1  Dillard — Goals-Plans-Action (GPA) Model"),
            para("James Price Dillard's Goals-Plans-Action model (Dillard, Segrin, & Harden, 1989) is the standard account, in interpersonal communication research, of what a speaker is trying to accomplish in an interaction. It distinguishes a primary goal — the reason the interaction exists at all (persuade, comfort, get information, ask a favor) — from a set of secondary goals that constrain how the primary goal gets pursued without being the point of the interaction themselves:"),
            simpleTable(
                ["Secondary goal", "What it protects", "Example"],
                [
                    ["Identity goals", "How the speaker wants to be seen", { text: "“Come across as capable.”", italics: true }],
                    ["Relational-resource goals", "The relationship itself", { text: "“Don't damage this friendship.”", italics: true }],
                    ["Personal-resource goals", "The speaker's own time, money, or effort", { text: "“Keep it brief, I'm tired.”", italics: true }],
                    ["Arousal-management goals", "The speaker's own emotional composure", { text: "“Stay calm, don't escalate.”", italics: true }],
                    ["Conversation-management goals", "The smoothness of the interaction itself", { text: "“Keep it on-topic and orderly.”", italics: true }]
                ],
                [2400, 3160, 3800]
            ),
            emptyPara(),
            para("The fit with this document's own taxonomy (Section 4) is close to one-to-one: identity goals correspond to the stance/assertiveness category, relational-resource goals to tone/register, personal-resource goals to length/pacing, and conversation-management goals to topic pacing generally. Read this way, Section 4's redirect categories are Dillard's secondary goals made actionable mid-turn — a redirect is how a standing secondary goal gets asserted in the moment it is needed. The primary goal, by contrast, corresponds to the conversation goal layer of the three-layer Goals model already recorded in CLAUDE.md (see Section 7.3)."),
            emptyPara(),

            heading2("7.2  Canary and Stafford — Relational Maintenance Theory"),
            para("Daniel Canary and Laura Stafford's Relational Maintenance Theory (Canary & Stafford, 1992) catalogues the strategies people actually use to sustain an ongoing relationship, independent of any single conversation: positivity (being upbeat and pleasant), openness (self-disclosure, direct discussion of the relationship), assurances (expressing commitment and continuity), shared tasks (doing routine things together), and involvement with each other's social networks. Because these strategies describe maintaining a relationship that already exists, they only make sense where a relationship already exists — which makes them a ready-made, curated source list for the standing relationship goal layer of the three-layer Goals model, which is defined the same way: durable, tied to one specific person, and independent of any single conversation."),
            emptyPara(),

            heading2("7.3  How This Maps Onto the Three-Layer Goals Model Already Recorded"),
            para("CLAUDE.md already records a three-layer model — disposition, standing relationship goal, and conversation goal — as a design that is recorded but not yet built. Dillard and Canary & Stafford supply grounded, curated vocabularies for two of its three layers:"),
            simpleTable(
                ["Layer", "Grounded by", "Status"],
                [
                    ["Disposition", "Not covered by either theory here — closer to trait psychology (Big Five, Schwartz values), which is what the worldview questionnaire's Tier-B already targets.", "Unchanged."],
                    ["Standing relationship goal", "Canary & Stafford's five maintenance strategies", "A concrete curated list for the People editor's goal control."],
                    ["Conversation goal", "Dillard's primary goal categories", "A concrete curated list for the per-conversation goal control."]
                ],
                [2400, 4400, 2560]
            ),
            emptyPara(),
            para("This does not change anything already decided in CLAUDE.md — the curated-menu-plus-free-text expression format, the layered most-specific-wins resolution, and the open sub-questions all stand. It gives the standing-relationship and conversation layers a specific, citable set of options rather than an open-ended blank.", { run: { italics: true, color: "595959" } }),
            emptyPara(),

            // ===== 8. SUGGESTED READING =====
            heading1("8.  Suggested Reading and Key Citations"),
            bullet("Goffman, E. (1974). Frame Analysis: An Essay on the Organization of Experience. Harvard University Press."),
            bullet("Goffman, E. (1981). Forms of Talk. University of Pennsylvania Press. (See especially the chapter “Footing.”)"),
            bullet("Halliday, M. A. K., & Matthiessen, C. M. I. M. An Introduction to Functional Grammar. Routledge. (Register: field, tenor, mode.)"),
            bullet("Martin, J. R., & White, P. R. R. (2005). The Language of Evaluation: Appraisal in English. Palgrave Macmillan."),
            bullet("Grice, H. P. (1975). “Logic and Conversation.” In Syntax and Semantics, Vol. 3: Speech Acts. Academic Press."),
            bullet("Brown, P., & Levinson, S. C. (1987). Politeness: Some Universals in Language Usage. Cambridge University Press."),
            bullet("Giles, H. (ed.) Communication Accommodation Theory: Negotiating Personal Relationships and Social Identities Across Contexts. Cambridge University Press."),
            bullet("Dillard, J. P., Segrin, C., & Harden, J. M. (1989). “Primary and Secondary Goals in the Production of Interpersonal Influence Messages.” Communication Monographs, 56(1), 19–38."),
            bullet("Canary, D. J., & Stafford, L. (1992). “Relational Maintenance Strategies and Equity in Marriage.” Communication Monographs, 59(3), 243–267."),
            emptyPara(),
            para("As with the CA literature, none of this needs to be read cover to cover before it is useful — the taxonomies in Sections 4 and 7.3 are the load-bearing distillation. The citations above are here for whenever a specific design question wants to go back to the source.", { run: { italics: true, color: "595959" } }),
            emptyPara(),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    const out = 'Reframe-Concepts-for-AAC-Architecture.docx';
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out + ' (' + buffer.length + ' bytes)');
});
