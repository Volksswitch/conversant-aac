/* Generates docPath("Conversant AAC Pragmatics.docx") — what the app does for the
 * social use of language, area by area, and what it does not do.
 *
 * WHY THIS EXISTS. A speech and language therapist asked how well Conversant supports
 * pragmatics (Ken, September 6 2026). The answer is spread across a dozen places — the
 * Conversation Engine documents, the CA design layer, the closed-set decision, the
 * closing-sequence work, the per-partner profile, the honesty rule — and none of them
 * is addressed to a clinician. This is the single place that answer lives.
 *
 * AUDIENCE: a clinician or educator judging whether the app suits a particular person.
 * So their vocabulary is fair game (adjacency pair, repair, register, preference
 * organization); ours is not. No file names, no function names, no engineering terms.
 *
 * ⚠ EVERY CLAIM HERE WAS CHECKED AGAINST SHIPPED BEHAVIOR, September 6 2026, because a
 * clinician may make a recommendation on it:
 *   - the four slots, the CHOICE family, WIND_DOWN / CLOSING / CLOSING_DECLINE and the
 *     three repair-of-self operations are all real slots in the engine;
 *   - the command buttons really read "Wrap up", "Ask them to repeat", "Repeat what I
 *     said", "Hold on", "Start conversation", "New 4";
 *   - the defaults quoted are the shipped defaults (silence 0.5s, first holding phrase
 *     at 2s, then every 10s, at most 2 per turn);
 *   - continuers are NOT built — the classification field is reserved and nothing reads
 *     it, so the document says so plainly rather than implying coverage.
 *
 * Run: node generate-pragmatics-doc.js
 */
const { docPath } = require('./doc-paths');
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
function para(text) {
    return new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(text)] });
}
function lead(label, text) {
    return new Paragraph({
        spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function bullet(text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function bulletBold(label, text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function numBold(label, text) {
    return new Paragraph({
        numbering: { reference: "gaps", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function source(text) {
    return new Paragraph({
        numbering: { reference: "sources", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}

function simpleTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true })] })]
    });
    const bodyCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text })] })]
    });
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders,
        rows: [
            new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
            ...rows.map(r => new TableRow({ children: r.map((c, i) => bodyCell(c, widths[i])) }))
        ]
    });
}

const W3 = [2500, 4460, 2400];

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
            { reference: "gaps",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "sources",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Pragmatics", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  September 2026  |  For clinicians and educators  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            // ===== TITLE =====
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Pragmatics", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "What the app does for the social use of language, area by area, and what it does not do yet", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  September 2026  |  Last updated September 6, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("Pragmatics is the part of language that is not the words: taking turns, opening and closing a conversation, declining without giving offense, fixing a misunderstanding, sounding one way with a close friend and another way with a consultant. It is the area in which augmentative and alternative communication has always done least well. A word grid gives someone vocabulary. It gives them very little help with timing, with tone, or with repair — and those are what separate a conversation from an exchange of messages."),
            para("This document says what Conversant AAC does about each of those, and what it does not do. It is written for anyone who has to judge whether the app suits a particular person: a speech and language therapist, a teacher, a family member, or the person themselves."),
            lead("The short version. ",
                "Pragmatics is not a feature of this app. It is the reason the app exists, and the conversation engine was built from the conversation analysis literature rather than from a vocabulary model. Turn-taking, the structure of a response, repair in both directions, and the closing sequence are all handled explicitly. Continuers, more than one partner at a time, and control of tone of voice are not handled yet, and Section 5 says so plainly."),

            // ===== 2 =====
            heading1("2. Why Pragmatics Is the Whole of the Design"),
            para("The problem the app was built to solve is itself a pragmatic one. Conversation tolerates only a short silence before a gap becomes meaningful — about a second before it is noticed, about four before it is uncomfortable. Somebody using a letter board or a word grid cannot produce a reply inside that window. The consequence is not merely slowness: they are pushed out of interactional talk altogether and left with the transactional kind, answering when asked and rarely initiating."),
            para("So the app does not try to make selection faster. It uses generative artificial intelligence to have candidate replies waiting before the silence becomes uncomfortable, and the user chooses one."),
            lead("The system speaks as the user, not for them. ",
                "This is the founding rule and it constrains everything else. The app writes candidates; the person picks; nothing is ever spoken that was not selected by hand. There is no mode in which the device answers on its own, and there is no plan to add one — removing the selection step would not be a change of feature, it would be a different product."),
            lead("What it is not. ",
                "It is not a personal assistant, a smart speaker, or a chatbot on a tablet. It does not manage a calendar, triage messages, take notes, or answer questions put to it. It is a tool for one person’s own conversation."),

            // ===== 3 =====
            heading1("3. The Areas, One at a Time"),

            heading2("3.1 Turn-taking and timing"),
            para("The microphone stays open for the whole exchange rather than being switched on for each turn. Every time the other person pauses, the app treats that as a checkpoint and prepares a set of replies to everything heard so far. If they carry on talking, the next pause produces a better set built on the fuller utterance. The pause length that counts as a checkpoint is half a second by default, and it is a setting."),
            lead("The app never decides that the other person has finished. ",
                "An earlier design tried to, and that was abandoned in July 2026. Turn completion is something the participants accomplish between them, not a property that can be read off an utterance — and the device is not a participant, the user is. So the app only ever prepares options, silently, and the turn is complete when the user answers. A wrongly judged transition point therefore costs nothing, because nothing is ever said on the strength of one."),
            lead("Holding the floor. ",
                "While the user is reading and choosing, the device says a short floor-holding phrase — “I’m thinking about that” — which is what a speaking person does with “um” and “so”. The first comes two seconds after the pause and any later ones every ten seconds, at most two in a turn. All three numbers are settings, and zero turns them off."),
            para("Two rules govern what those phrases may say, and both were learned the hard way. They have to read correctly after a question, a greeting, an assessment or a plain statement, because the app does not know which it was when the first one fires. And they have to be declarative and in the first person: anything imperative or aimed at the other person — “hold on”, “give me a second” — reads as curt through a synthetic voice. Asking somebody to wait is a separate, deliberate button, so that it is chosen rather than produced automatically."),
            lead("Interrupting. ",
                "The user can speak while the other person is still talking. Whatever had been said up to that moment is captured and kept, the interruption is recorded in its right place, and listening carries on afterward. What is missing is speed: they still have to find or type the phrase. Section 5 lists it."),

            heading2("3.2 The four moves on offer"),
            para("Every time, the user is offered four structurally different second-pair-parts, and each one always sits in the same place on screen:"),
            bulletBold("Preferred — ", "the aligning, affiliative answer."),
            bulletBold("Dispreferred — ", "a way to decline, refuse, or disagree, delivered as a hedge plus an account rather than a bare no."),
            bulletBold("Initiative — ", "a way to take the conversation somewhere else: a counter-question, a new topic, a redirection."),
            bulletBold("Repair — ", "a way to ask for clarification of what was just said."),
            para("Two things about this matter clinically. The first is that the dispreferred slot is always there. Declining costs more words than agreeing, so in plain augmentative communication it is the move that most often gets abandoned halfway through — by the time it has been composed the moment has gone, and the person agrees instead. Here it is one tap, and it comes out softened rather than blunt, because a hedge and an account are what a speaker supplies without thinking."),
            lead("The second is that position carries category, never rank. ",
                "The four cells are not a best-first list. Preferred means the affiliative move, not the best answer, and the layout is stable so the person can learn where each kind of move lives and reach for it without reading. Ranking the four would defeat the purpose of having them."),
            para("Identity is carried three ways at once — by position, by color, and by a printed label — so nothing depends on being able to tell the colors apart. A button marked “New 4” asks for a different set of four for the same turn."),

            heading2("3.3 When the partner offers a menu"),
            para("A particular kind of turn breaks the four-move structure, and the app treats it separately. When the other person puts options on the table — “mild, moderate, or severe?”, or “we’ve got muffins, croissants, and a few different pastries” — the four structural moves are set aside and each alternative they named becomes its own card, in the order they said them."),
            para("Any cell left over is filled from a ranked set: an answer outside the list (“about the same”, “it comes and goes”), a way to turn the question back (“what would you recommend?”), and a way to ask for the choices again. The partner’s own alternatives always outrank anything the app adds; a four-way question fills all four cells with their four options and nothing else."),
            para("This was found in testing, and it is worth saying why. Asked whether the tiredness was mild, moderate or severe, the app came back with four different ways of saying “mild” — the two other alternatives the person had actually been offered were unreachable without typing. A menu question is not the same speech act as an open one, and it needs a different palette."),
            para("Two guards go with it. A list that is merely mentioned rather than offered — “I picked up milk, eggs, and bread on the way home” — must not become a menu. And a vague item is never dressed up as a definite choice: “a few different pastries” becomes a card that asks what kinds there are, rather than an invented specific."),

            heading2("3.4 Repair"),
            para("Repair is handled in both directions, and they are different mechanisms."),
            lead("When the other person did not understand the user. ",
                "If they say “what?”, the app recognizes that as an other-initiated repair of the user’s own turn and immediately offers three things: say it again exactly, say it differently, or say more. The last two are written out in full and waiting before the person chooses, so all three are one tap. This was the highest-priority item in the original design, because it is the breakdown that most often ends an exchange."),
            lead("When the user did not catch the other person. ",
                "A standing button reads “Ask them to repeat”. It speaks a phrase the user has written themselves, discards the garbled capture, and keeps listening. The re-speak is recorded as a new turn rather than being merged into the first, so the record shows the repair happening."),
            lead("Seeing what was heard. ",
                "The transcript of the other person’s speech is always on screen. That is treated as critical rather than optional: without it, a mishearing and a misunderstanding look identical to the user, and they cannot tell which one to fix."),

            heading2("3.5 Openings and closings"),
            para("A button marked “Start conversation” puts up a set of openers. They are the user’s own words, editable, and a person in the address book can have openers of their own that come up first when they are the one being spoken to."),
            lead("Winding down and saying goodbye are two separate steps, ",
                "because that is how closings actually work. “Wrap up” offers statements that signal an intent to end without ending anything — “I should get going”, “great catching up with you”. Choosing one speaks it and then automatically offers the goodbyes, so the second step needs no further navigation. If the other person does not take the hint, pressing “Wrap up” again offers a different set rather than escalating."),
            lead("A closing initiated by the other person is recognized from the pre-closing, not the farewell. ",
                "The move that opens a closing is usually semantically empty — “well…”, “so…”, “anyway”, “okay then” — or an other-attentive warrant such as “I should let you go”, an arrangement, or an appreciation. All of those are treated as closing-relevant, not just “bye”. Ending a topic is deliberately not treated as ending the conversation."),
            lead("And the closing can be declined. ",
                "A pre-closing is an offer to end, so declining it is maximally relevant at exactly that moment. One of the cards is the user’s own “actually, before you go —” phrase, and it is pinned so that paging through the goodbyes cannot hide it. This is offered only when the other person started the closing, never when the user did. It is a small thing that plain augmentative communication almost never leaves room for, because by the time the objection has been composed the other person has gone."),

            heading2("3.6 Taking the initiative, and steering"),
            para("Three things exist so that the user is not confined to answering."),
            bulletBold("The initiative card, ", "present on every turn, which moves the conversation somewhere the user chooses rather than continuing the topic they were handed."),
            bulletBold("“In my own words”, ", "a typing area with word completion, which either speaks what was typed or hands it to the artificial intelligence as direction — a topic, a fact it could not know, or an instruction such as “keep it short” or “lean toward declining” — and produces four fresh options built around it. That second use is how the user injects ground truth and how they redirect."),
            bulletBold("The Express Panel, ", "a grid of phrases that speak on a tap for the things that have to be instant. The set that ships was written by speech and language therapists."),

            heading2("3.7 Register, audience, and code-switching"),
            para("Sounding the same to everybody is one of the clearest markers of assisted speech. Several things address it, and they compose."),
            bulletBold("Per person. ", "For anybody in the address book, the user can record how they talk with that person — more relaxed, blunter, shorter — in a short menu plus a free note, together with a standing goal for that relationship. Those shape the wording and are never raised as a subject."),
            bulletBold("Per kind of person. ", "There is a second layer for categories — close friends, professionals, strangers — which reaches the people who will never be in an address book. The named person overrides the category where both exist."),
            bulletBold("Humor. ", "The user records their sense of humor, whether they tease, and whether the app may offer a light response at all. When it may, at most one of the four cards is light, so a straight way of saying the same thing always survives a mistaken tap; and never on a serious, distressing or medical turn."),
            bulletBold("Sounding like themselves. ", "A short exercise asks which of several phrasings sounds most like something they would say. It is deliberately a forced choice rather than a description, because people are poor judges of their own style in the abstract and good at recognizing it in a concrete example."),
            para("Signature phrases are handled differently and on purpose: they are buttons the user presses, never something the artificial intelligence produces. A catchphrase that the machine guessed at and used slightly wrong reads as impersonation, which is worse than not having it at all."),

            heading2("3.8 Not putting words in the user’s mouth"),
            para("Two rules govern what the app may say on somebody’s behalf, and both exist because early testing produced things the person had not done and did not know."),
            bulletBold("No invented life. ", "Standing facts from the profile are fair game — “I game with friends most evenings”. A specific episode that nobody supplied is not: the app will not report having beaten a friend at chess last night."),
            bulletBold("No outside knowledge. ", "Asked for the square root of two, or what entangled particles are, the app offers ways of saying it does not know, or turning the question back, rather than answering. It voices a person, not an information service, and a person is allowed not to know things. The exception is subjects the user has said they know well, which they list themselves."),
            para("Both can be overridden by the user in the moment: type the fact and ask for options built around it, and it will be used, because they put it there. This is the difference between the app supplying knowledge and the person supplying it."),

            heading2("3.9 Rehearsal"),
            para("A practice mode has the artificial intelligence play the other person in a scenario, speaking in a different voice, while the user responds exactly as they would in a real conversation. Six categories ship — getting started, practical, social, medical, personal, professional — and the whole conversation loop runs, so it exercises turn-taking, repair and closings rather than being a demonstration. It is meant for learning the flow without spending a real person’s patience, and for rehearsing a particular encounter before it happens."),

            heading2("3.10 Whose words are these?"),
            para("One risk deserves stating rather than glossing over, because it belongs to this kind of tool specifically. A person may come to defer to the machine on the grounds that it is a better communicator than they are — choosing what the app offered over what they meant. There is published evidence that writing assistants shift not only what people write but the opinions they afterward report holding, and augmentative communication users have described choosing a generated phrase as feeling as though the system had chosen."),
            para("Three things in the design work against it, and they are design constraints rather than good intentions: free composition is always available and is being made faster, because deferring must never be the rational choice; the four cards are never ranked, so there is no “best” one to defer to; and the app is deliberately barred from producing the person’s own signature phrases. It is not solved, and it is worth watching for in anybody using it."),

            // ===== 4 =====
            heading1("4. Summary"),
            para("What is covered, what is partly covered, and what is not."),
            simpleTable(
                ["Pragmatic area", "What the app does", "Status"],
                [
                    ["Turn-taking and timing",
                     "Continuous listening, options prepared at every pause, spoken floor-holders while choosing. The app never judges the turn finished.",
                     "Built"],
                    ["Adjacency pairs and preference organization",
                     "Four structurally distinct second-pair-parts every turn, positions stable; dispreferred always available, hedged and accounted for.",
                     "Built"],
                    ["Closed-set and menu questions",
                     "The partner’s alternatives become the cards, plus an outside-the-set answer, a question back, and a request to repeat the list.",
                     "Built"],
                    ["Repair, other-initiated",
                     "Say it again, say it differently, say more — all three written out before the user chooses.",
                     "Built"],
                    ["Repair, self-initiated",
                     "A standing button asks the partner to repeat, in the user’s own words, and keeps listening.",
                     "Built"],
                    ["Openings",
                     "User-authored openers, and openers particular to one person.",
                     "Built"],
                    ["Closings",
                     "Wind-down and goodbye as two steps; partner pre-closings recognized; the closing can be declined.",
                     "Built"],
                    ["Topic control",
                     "An initiative card every turn, plus typed direction that re-generates the options around a topic.",
                     "Built"],
                    ["Register and code-switching",
                     "Per person, per category of person, humor settings, and a forced-choice exercise for style.",
                     "Built"],
                    ["Politeness and face",
                     "Softening and accounts built into the dispreferred move; no vulgarity offered.",
                     "Built"],
                    ["Presupposition and shared knowledge",
                     "The app will not supply facts the user did not, and will not invent events in their life.",
                     "Built"],
                    ["Interruption",
                     "Works correctly and keeps the partner’s partial turn, but the user must still find or type the phrase.",
                     "Partial"],
                    ["Prosody",
                     "The wording is shaped; the delivery is not. No way to ask for warmth, emphasis or a pause.",
                     "Partial"],
                    ["Continuers and backchannels",
                     "Nothing is said while the partner is still talking. Designed for; not built.",
                     "Not yet"],
                    ["More than one partner",
                     "One partner is assumed. No speaker separation.",
                     "Not yet"],
                    ["Conversations at a distance",
                     "Video meetings are not supported: the partner’s voice comes from the device’s own speaker, and nobody holds a gap open.",
                     "Not yet"],
                ], W3),

            // ===== 5 =====
            heading1("5. What Is Not There Yet"),
            para("Stated plainly, because a clinician will notice each of these within a session."),
            numBold("Continuers. ",
                "Nothing is said while the other person is still speaking — no “mm-hm”, no “right”, no “yeah”. The design anticipates them and the classification already distinguishes a turn that is continuing from one that is finished, but no continuer is ever offered. This is probably the most conspicuous gap to a trained ear."),
            numBold("More than one partner. ",
                "The app assumes one person at a time. It does not separate speakers, does not know who said what, and has no way to direct a reply at one person in a group."),
            numBold("Tone of voice. ",
                "The wording is shaped in every way described above; the delivery is not. With the voices built into a tablet there is no control over pauses or intonation at all — punctuation was tested and does nothing. A paid voice does respond to respelling and to a few text devices, but there is still no way to ask for a sentence to be said warmly, or firmly, or with a pause in the middle."),
            numBold("Speed of interruption. ",
                "Interrupting is recorded correctly but is not fast. A remark that arrives ten seconds late is not an interruption."),
            numBold("Meetings and video calls. ",
                "The app works face to face and over a speakerphone. In a video meeting the other voices come out of the device’s own speaker, several people talk, and nobody holds a gap open for a slow reply. That is recognized as a real gap — people using augmentative communication are largely observers in meetings today — and it is deliberately being left until face-to-face conversation is reliable."),

            // ===== 6 =====
            heading1("6. What This Document Does Not Claim"),
            para("Everything above describes what the app does. None of it describes an outcome."),
            bullet("No clinical evaluation has been carried out. The app has not been trialed with a group of users, and there is no data on whether any of it improves participation, reduces breakdown, or is preferred to existing tools."),
            bullet("Beta testing began in September 2026 with a small number of people. The measures being collected are descriptive — how often conversations happen, how long the other person waits, which of the four moves get chosen, how often a set of options is abandoned unused. They are intended to inform the design, not to demonstrate efficacy."),
            bullet("The initial target user is literate, sixteen or older, and selects directly by touch. Scanning and eye gaze are planned and not built, though the engine was deliberately separated from the method of selection so that adding them is a change of presentation rather than a rewrite."),
            bullet("Nothing here is a claim about recording law. The other person’s speech is transcribed by an online service and the text is kept on the device; the audio is not stored. Whether and how that should be disclosed in a given setting is a matter for the people involved, and a printed card for the communication partner is provided for it."),

            // ===== 7 =====
            heading1("7. Where the Design Comes From"),
            para("The conversation engine was designed against the conversation analysis literature, which is why its structures carry those names rather than being invented. The main sources behind the behavior described above:"),
            source("Sacks, Schegloff and Jefferson on turn-taking, transition-relevance places, and the standard maximum silence — behind Section 3.1."),
            source("Schegloff and Sacks, “Opening up closings” — behind the two-step closing, the semantically empty pre-closing, and the option to decline a closing (Section 3.5)."),
            source("Schegloff, Jefferson and Sacks on the organization of repair, and the preference for self-correction — behind Section 3.4."),
            source("Pomerantz and Levinson on preference organization: dispreferred responses are delayed, hedged and accounted for — behind the shape of the dispreferred card (Section 3.2)."),
            source("Brown and Levinson on politeness and face — behind the softening rules on that same card."),
            source("Grice on the maxims of conversation, quality in particular — behind the rule against inventing facts (Section 3.8)."),
            source("Goffman on frame and footing, with Halliday on register and Martin and White on appraisal — behind the ways the user can redirect a conversation (Section 3.6)."),
            source("Kane and colleagues on how augmentative communication equipment constrains what its users can express, and Valencia and colleagues on how users experience generated phrases — behind Section 3.10."),
            para("A fuller treatment of each, and how it maps onto the engine, is in “Conversant AAC Conversation Engine Design” and “Conversant AAC Conversation Engine Overview”."),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    const out = docPath("Conversant AAC Pragmatics.docx");
    fs.writeFileSync(out, buffer);
    console.log("Created " + out);
});
