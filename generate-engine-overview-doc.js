// Conversation Engine — Overview.
// Audience: clinicians (must be readable in plain terms) AND conversation-analysis
// experts (must show the engine takes the core CA concepts seriously).
// Styled to match the other design docs (Arial, blue headings, centered footer
// with "Page m of n"). American English spelling throughout.
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function heading3(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
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
function bullet(text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function bulletRich(children) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children
    });
}
function numberedItem(text) {
    return new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

function simpleTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true, size: 20 })] })]
    });
    const bodyCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, size: 20 })] })]
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

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 24 } } },
        paragraphStyles: [
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 28, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
            { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 24, bold: true, font: "Arial", color: "2E75B6" },
                paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
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
            children: [new TextRun({ text: "AI-Driven AAC — Conversation Engine Overview", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  June 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            new Paragraph({
                spacing: { before: 240, after: 80 },
                children: [new TextRun({ text: "The Conversation Engine", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "How an AI-driven AAC system organizes real-time talk — for clinicians and conversation-analysis readers", italics: true, color: "595959", size: 26, font: "Arial" })]
            }),

            // ---- About this document ----
            heading2("About This Document"),
            para("This overview describes the Conversation Engine — the part of the AI-driven AAC system that decides what kind of conversational move the user might want to make next, and when. It is written to be understood by a clinician without a background in linguistics, and at the same time to show a reader trained in Conversation Analysis (CA) that the engine is built on the structures CA has documented in ordinary talk: turn-taking, adjacency pairs, preference, repair, and the organization of openings and closings."),
            para("The engine is one layer of a larger system. It does not listen, speak, or draw anything on the screen; it reasons about the structure of the conversation and hands a small, typed set of candidate moves to the presentation layer, which displays them for the user to choose from. Keeping that boundary strict is deliberate, and is itself a CA-informed choice: the organization of talk is treated as a thing in its own right, separable from how any one person accesses it."),
            emptyPara(),

            // ---- The clinical problem ----
            heading2("The Clinical Problem It Addresses"),
            para("People who use AAC can usually produce the words they need; what they cannot do is produce them fast enough to hold a place in live conversation. Ordinary talk runs on a tight clock. Speakers begin their turns within a fraction of a second of the previous turn ending, and a silence of much more than a second is heard as meaningful — as hesitation, reluctance, trouble, or disengagement. Existing AAC keeps the user in near-real-time or batch communication, which pushes them toward transactional exchanges (requests, answers) and away from the interactional talk through which relationships are actually maintained."),
            para("The engine's job is to make a fitting next move available quickly enough that the user can stay inside that clock — and, when they cannot, to hold the floor in a way that reads as normal human hesitation rather than system failure. The system speaks as the user, in their own voice and stance, not as an assistant answering on their behalf."),
            emptyPara(),

            // ---- Design stance ----
            heading2("Design Stance: CA as the Grammar of the Engine"),
            para("Most conversational software is organized around content — what to say. The Conversation Engine is organized first around structure — what kind of act is due next, and to whom. This is the central CA insight applied as engineering: talk is orderly, and that order is describable independently of topic. A question makes an answer due; a request makes a granting-or-declining due; a greeting makes a return greeting due. The engine models those obligations explicitly and offers moves that fit them, then lets the AI fill in the user-specific wording."),
            para("Three properties follow from this stance and recur throughout the document. First, the engine is stateless about content but stateful about structure — it remembers what is conversationally owed, not a transcript. Second, classification precedes generation — the system first decides what the partner just did, then produces candidate responses shaped to that act. Third, every structural commitment the engine makes is inspectable, so a clinician or analyst can see why a given set of options appeared."),
            emptyPara(),

            // ---- Core CA concepts mapping ----
            heading2("The CA Concepts the Engine Implements"),
            para("The table below names the conversation-analytic structures the engine is built on and states, in one line each, how the engine embodies each one. The sections that follow explain the most consequential of them in plain terms."),
            emptyPara(),
            simpleTable(
                ["Conversation-analytic concept", "How the engine embodies it"],
                [
                    ["Turn-taking and the floor", "The system tracks whose turn it is (the floor: open, partner, or self) as a dimension separate from what the system itself is doing (its mode). The user can take the floor at any moment."],
                    ["Turn-constructional units and transition-relevance places (TRPs)", "Each partner pause is classified as a completed turn, an unfinished turn, or a mid-telling continuation, so the system responds at a legitimate transition point and not before one."],
                    ["Adjacency pairs; conditional relevance", "A partner action (first pair part) creates an obligation for a fitting response (second pair part). The engine records that obligation and clears it only when an answering move is made."],
                    ["Sequence organization and expansion (insert sequences)", "Open obligations are held on a stack. A repair started in the middle of a sequence nests on top; when it resolves, the original obligation is automatically restored."],
                    ["Preference organization; dispreferred turn shape", "Candidate responses are typed by social action, not just listed. The reluctant/declining option is built in proper dispreferred shape — a softener plus an account — never a bare refusal."],
                    ["Repair organization (self- and other-initiated)", "The engine supports the partner initiating repair on the user's turn, the user initiating repair on the partner's turn, and the user repairing their own last turn — the principal cells of the CA repair typology."],
                    ["Openings and closings; pre-closing", "Dedicated modes provide opening moves to start a conversation and pre-closing/closing moves to wind one down, reflecting that conversations are entered and left through recognizable sequences, not stopped arbitrarily."],
                    ["Recipient design", "Candidate moves are shaped to the specific user and the specific partner, using a stored profile of the user's identity and stance and a model of who the partner is to them."],
                    ["Intersubjectivity and its repair safeguard", "What the system heard is always shown to the user, and a repair path is always available, so shared understanding can be checked and restored rather than assumed."],
                    ["Continuers / backchannels", "Reserved in the classification scheme as a recognized category so they can be added later without re-architecting the engine."],
                    ["Floor-holding and the meaning of silence", "Brief reflective placeholders hold the floor during the choosing window, because past about a second silence is heard as trouble; they are timed and shaped not to read as the user's actual reply."],
                ],
                [4180, 5180]
            ),
            emptyPara(),

            // ---- Turn taking and floor ----
            heading2("Turn-Taking, the Floor, and End-of-Utterance"),
            para("CA describes talk as built from turn-constructional units whose possible completion creates a transition-relevance place — a point at which speaker change becomes relevant. Knowing when one has been reached is the hardest real-time judgment in conversation, and it is hardest for the listener, because the speaker pauses mid-thought, qualifies, and resumes."),
            para("The engine separates two things that are easy to conflate. The first is the floor — whose turn it is: open (at rest or between turns), the partner's, or the user's. The second is the system's own posture — its mode (listening, responding, repairing, opening, or closing). These are independent: while the system is in its listening posture the floor may be the partner's (they are mid-utterance) or open (the conversation is at rest). Treating them as one dimension produces the wrong behavior at the very start of a conversation, when nobody yet holds the floor; keeping them separate keeps the model honest and lets the user seize the floor regardless of what the system is doing."),
            para("At each pause in the partner's speech, the system classifies the turn so far as complete, incomplete (it trailed off), or continuing (a clause-boundary pause mid-telling). Only a complete turn licenses a full set of response options. An incomplete or continuing turn keeps the system listening and offers nothing, which protects against the high-cost error of treating a mid-utterance breath as the partner's finished turn. In the current phase, continuing is handled like incomplete; it is named separately now so that continuers can be added later without rework."),
            emptyPara(),

            // ---- Sequences and the stack ----
            heading2("Sequences: Adjacency Pairs and the Obligation Stack"),
            para("The smallest unit of conversational order is the adjacency pair: a first action by one party that makes a particular kind of second action conditionally relevant from the other — question and answer, invitation and acceptance/declination, greeting and return. When the partner produces a first pair part, the engine records the obligation it creates; that obligation is cleared only when the user makes an answering move."),
            para("Real conversation routinely interrupts one pair with another before the first is finished — a question answered with a clarifying question, for instance. CA calls this sequence expansion. The engine models it as a stack of open obligations, innermost on top. If the user has to stop and check what the partner meant, that repair is pushed onto the stack above the original question; when the partner clarifies and the repair resolves, it is popped and the original question — still owed — is automatically back on top. The user is never left having silently dropped an obligation, and never has to manually remember where they were."),
            emptyPara(),

            // ---- Preference and the palette ----
            heading2("Preference Organization and the Move Palette"),
            para("When the system has a complete partner turn to respond to, it offers a small palette of moves that are structurally distinct from one another — not three paraphrases of the same answer, but different social actions the user could take. The palette is typed, and the types are stable in position so that the user develops motor familiarity with where each kind of move sits."),
            simpleTable(
                ["Move type", "What it is, in CA terms"],
                [
                    ["Preferred", "The straightforward, affiliative second pair part — the answer/acceptance delivered plainly, without hedging. This is the structurally preferred response."],
                    ["Dispreferred", "A reluctant, declining, or disagreeing response built in proper dispreferred turn shape: a softening preface that carries meaning, the declination itself, and a brief account. Never a bare “No.”"],
                    ["Initiative", "A move that keeps the user from being purely responsive — a counter-offer, a return question, or a topic expansion — grammatically varied from the others so it reads as a genuine alternative course."],
                    ["Repair", "A request for clarification on the partner's turn — open-class (“Sorry?”) when little was caught, or restricted (“Dinner where?”) when one piece is uncertain."],
                ],
                [2600, 6760]
            ),
            para("", { after: 80 }),
            para("Preference here is the CA sense of the word — a structural property of how responses are designed and delivered, not the user's personal liking. Building the dispreferred option in its proper shape matters clinically: it lets the user decline or disagree in a way that preserves the relationship, rather than being limited to a blunt refusal because that was the only quick option available. The first position is always the system's best single guess; there is no special highlight, the design goal being simply that the first option is most often the right one, improving over time."),
            emptyPara(),

            // ---- Repair ----
            heading2("Repair: The Safeguard of Mutual Understanding"),
            para("CA treats repair — the organized ways speakers deal with trouble in hearing, speaking, or understanding — as the mechanism that keeps a conversation intersubjective: it is how participants restore shared understanding when it lapses. Because the AAC channel adds its own sources of trouble (speech recognition can mishear the partner; the user's synthesized turn can be missed), repair is treated as a first-class, always-available capability rather than an edge case."),
            para("The engine provides the principal positions of the repair system:"),
            bullet("Partner initiates repair on the user's turn (other-initiated self-repair). When the partner signals they did not catch the user — “What?”, “Say that again?” — the system does not generate a fresh answer. It switches to a repair-of-self posture and offers operations on the user's own last turn: say it again unchanged, say it differently, or expand it. This is the user repairing their own talk in response to the partner's signal."),
            bullet("User initiates repair on the partner's turn (other-initiation). A persistent control lets the user say, in effect, “I didn't catch that” at any moment. This pushes a repair onto the obligation stack and hands the turn back to the partner; the partner's restatement resolves it and restores whatever was owed beneath."),
            bullet("User repairs their own turn on their own initiative (self-initiated self-repair). The same say-again / rephrase / expand operations are available to the user without any partner prompt, through the persistent controls."),
            para("Crucially, what the speech recognizer heard is always displayed to the user. The system does not require the user to confirm the transcript before it generates options — that would slow every single turn — but it does always show it, so an error is visible and the repair path is there to catch it. Showing understanding and keeping repair available is how the engine protects intersubjectivity without making the user pay a confirmation tax on every exchange.", { after: 160 }),
            emptyPara(),

            // ---- Openings and closings ----
            heading2("Openings and Closings"),
            para("Conversations are not merely started and stopped; they are entered and left through recognizable sequences. The engine reflects this with dedicated postures. An opening mode offers the user moves to start a conversation — the pre-sequences and openers through which one bids for a partner's attention and engagement. A pre-closing/closing mode offers moves to wind a conversation down — the “I should get going” / “this was really nice” steps that make an ending mutual rather than abrupt. The engine also recognizes when the partner's own turn is closing-implicative and shifts to offer closing moves in response. For a person who otherwise cannot easily initiate or gracefully exit, having these sequences explicitly supported is significant: it returns to them the ability to open and to close, not only to answer."),
            emptyPara(),

            // ---- Modes table ----
            heading2("The Five Modes at a Glance"),
            para("The engine is always in exactly one mode — its current posture toward the conversation. The mode determines which kind of palette is offered. Mode is inferred from what the partner did, and the user can always override it through the persistent controls."),
            simpleTable(
                ["Mode", "The system's posture", "What it offers"],
                [
                    ["Listening", "Receiving the partner's talk; no completed turn to answer yet, or at rest.", "Nothing yet — it is waiting for a transition-relevance place."],
                    ["Responding", "A complete partner first pair part is on the table.", "The four-type move palette (preferred / dispreferred / initiative / repair)."],
                    ["Repair-of-self", "The partner signaled they did not understand the user's last turn.", "Say it again / say it differently / expand it."],
                    ["Initiating", "The user is opening a conversation.", "Opening moves and conversation starters."],
                    ["Pre-closing / closing", "The conversation is being wound down.", "Closing moves."],
                ],
                [2100, 4060, 3200]
            ),
            emptyPara(),

            // ---- Processing loop ----
            heading2("How a Single Exchange Flows"),
            para("In plain terms, one round of the conversation proceeds as follows."),
            numberedItem("The partner speaks. A live transcript appears so the user can see what was heard."),
            numberedItem("The partner pauses. The system takes the speech so far and, in one combined step, asks the AI both to classify what the partner just did and to generate candidate moves fitted to it. The classification is produced first, so the system commits to what kind of act it is responding to before any wording is chosen."),
            numberedItem("If the turn was judged unfinished, the system keeps listening and offers nothing, waiting for a real completion point. If it was complete, the engine records the new obligation, sets the floor to the user, and displays the typed palette."),
            numberedItem("While the user reads and chooses — and only when the partner asked something that warrants it — a brief reflective placeholder may be spoken to hold the floor, so the pause does not read as trouble. A quick choice means none is spoken at all."),
            numberedItem("The user selects a move. It is spoken in the user's voice; the obligation it answers is cleared from the stack; the exchange is recorded for context; and the floor opens again for the next turn."),
            para("At any point the user may step outside this flow through the persistent controls — open a conversation, hold the floor, ask the partner to repeat, repair their own last turn, wind down, or end the conversation outright — regardless of the mode the system has inferred.", { after: 160 }),
            emptyPara(),

            // ---- Floor holding ----
            heading2("Floor-Holding and the Meaning of Silence"),
            para("Because silence longer than about a second is heard as meaningful, the choosing window — the time the user spends reading options and selecting — is itself a conversational liability. The engine covers it with placeholders: short, reflective phrases spoken to hold the floor. Their design is governed by CA-aware constraints. They are offered only after a partner action that makes a response due, such as a question, and not after a plain statement or during a closing, where a stall reads as odd. They are differentiated by position so that successive placeholders progress rather than repeat — the first acknowledges (“Good question.”), a later one signals continued work (“Still thinking it through.”). They are deliberately neutral and never imperative, because the flat prosody of synthetic voices can make a phrase like “hold on” read as curt. And everything the system speaks on the user's behalf, including every placeholder, is shown on screen as it plays — nothing is ever said invisibly."),
            emptyPara(),

            // ---- Guaranteed capabilities ----
            heading2("Guaranteed Capabilities and User Control"),
            para("The system's stated behaviors are defaults for a standard profile, not fixed laws, because the people who will use it are individuals who will tune the flow to themselves. What is guaranteed is a set of capabilities that must always exist in some form, whatever the settings: a way to repair, a way to hold the floor, a way to close, a way to compose something the AI did not generate, visibility of everything the system says, and the ability to reverse a change. These are the engine's invariants. How each is presented — and almost every threshold and default around them — is configurable, and the configuration belongs to the user."),
            emptyPara(),

            // ---- Boundaries ----
            heading2("Scope and Boundaries"),
            para("The engine is the structural layer of a phased system. The current phase implements the full set of modes, the obligation stack, the typed palette, the principal repair positions, and the opening and closing postures, with classification and generation performed in a single combined step whose structural decision is always inspectable. Several refinements are named but deliberately deferred: continuers and backchannels, conversations with more than one partner, and the situational and longer-term personalization layers that will further shape recipient design. The engine is also explicitly not an assistant — it does not answer for the user, manage tasks, or act as an information service. It supports one thing: holding real-time conversation, as oneself."),
            para("For the underlying mechanisms in full detail — the classification schema, the stack operations, the generation contract, and the filler timing — see the companion Conversation Engine design document. This overview is the map; that document is the territory.", { after: 160 }),
            emptyPara(),

            // ---- Glossary ----
            heading2("Glossary of Conversation-Analytic Terms"),
            simpleTable(
                ["Term", "Plain-language meaning as used here"],
                [
                    ["Adjacency pair", "A two-part sequence where the first part makes a particular second part due — question/answer, greeting/greeting, invitation/acceptance-or-declination."],
                    ["First / second pair part", "The first action in such a pair (e.g. the question) and its fitting response (e.g. the answer)."],
                    ["Conditional relevance", "The way a first pair part makes its second part expectable, so that its absence is itself noticeable and meaningful."],
                    ["Turn-constructional unit", "A complete-enough piece of talk (a phrase, clause, or sentence) at whose end speaker change becomes relevant."],
                    ["Transition-relevance place (TRP)", "The point at the possible completion of a unit where another speaker may legitimately take the floor."],
                    ["Preference / dispreferred turn shape", "A structural property of responses: preferred responses are quick and plain; dispreferred ones (declines, disagreements) are delayed, softened, and accounted for."],
                    ["Repair", "The organized ways participants handle trouble in hearing, producing, or understanding talk; classified by who signals the trouble and who fixes it."],
                    ["Other-initiated self-repair", "The case where one speaker signals trouble (“What?”) and the other speaker repairs their own prior talk."],
                    ["Sequence expansion", "Adding sequences before, inside, or after a base pair — for instance a clarification inserted before an answer is given."],
                    ["Recipient design", "Shaping talk for the specific person being addressed — what they know, who they are to the speaker."],
                    ["Intersubjectivity", "The shared understanding between participants that conversation continually builds and, through repair, restores."],
                    ["Continuer / backchannel", "A brief signal (“mm-hm,” “right”) that passes on a chance to take the floor and invites the other to keep going."],
                    ["Pre-closing", "The moves that propose ending a conversation and let both parties agree to close, rather than stopping abruptly."],
                ],
                [3000, 6360]
            ),

            new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, space: 8, color: "CCCCCC" } },
                spacing: { before: 480, after: 0 },
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Conversation Engine implemented June 2026. Companion to the Conversation-Engine-Design document; see also the UI-Design and Configuration-Model documents.", italics: true, color: "808080", size: 18 })]
            }),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("Conversation-Engine-Overview.docx", buffer);
    console.log("Conversation-Engine-Overview.docx generated.");
});
