/* Generates docPath("Conversant AAC Response Option Guardrails.docx") - the rules the app
 * imposes on the words the AI may put in a suggested reply, and what those rules do NOT
 * restrict: the user's own words.
 *
 * WHY THIS EXISTS (Ken, September 14 2026). He asked whether any document described the
 * guardrails on the response suggestions. None did: parts sat in Pragmatics, the Product
 * Overview, the Architecture Overview and the engine documents, and several rules (no
 * vulgarity beyond one line, faith and politics, humor limits, speakability, empty
 * openers, catchphrases, topics to avoid) were in no document at all. He chose a single
 * document for supporters and therapists, and asked that it say plainly that the app does
 * not restrict what the user can say through their own starters, placeholder phrases,
 * wind-downs, goodbyes, Express Panel phrases and sound buttons.
 *
 * AUDIENCE: a supporter or therapist deciding whether to trust the app with a person's
 * voice. Plain language, no file or function names.
 *
 * ⚠ EVERY RULE WAS CHECKED AGAINST THE PROMPT TEXT THE APP ACTUALLY SENDS (llm.js,
 * worldview.js, relationships.js, places.js, partner-profile.js, voice.js), September 14
 * 2026, not written from the design record. If a rule changes there, this document is
 * wrong until it is regenerated.
 *
 * ⚠ SECTION 5 MUST NOT BE SOFTENED. How the AI company's own safety behavior treats a
 * user who needs to say something distressing has NOT been tested, and saying otherwise
 * would be a claim nobody has measured.
 *
 * Run: node scripts/doc-generators/generate-suggestion-guardrails-doc.js
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

// A rule, laid out the same way every time: what the suggestions will not do, why, and
// what a supporter can change.
function rule(title, what, why, change) {
    return [
        heading2(title),
        para(what),
        lead("Why. ", why),
        lead("What you can change. ", change),
    ];
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
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Response Option Guardrails", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  September 2026  |  For supporters and therapists  |  Page ", size: 18, font: "Arial", color: "808080" }),
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
                children: [new TextRun({ text: "Response Option Guardrails", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "What the AI is not allowed to put in a suggested reply, why, and how the user can still say anything they want", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  September 2026  |  Last updated September 14, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("When the other person finishes speaking, Conversant AAC shows a few suggested replies, and the user taps the one they want. An AI writes those suggestions. This document sets out the rules the app gives the AI about what a suggestion may contain, why each rule is there, and what a supporter can change."),
            para("It is written for a supporter, family member or therapist deciding whether to trust the app with a person’s voice. Every rule here was checked against the instructions the app actually sends to the AI, not written from memory."),
            lead("The short version. ",
                "The suggestions will not make things up about the user, will not answer general-knowledge questions on their behalf, will not swear, will not take sides on faith or politics, and will only joke when the user has said that is welcome. None of this limits what the user can say. Anything they type, or put on a button, is spoken exactly as they wrote it (Section 4)."),

            // ===== 2 =====
            heading1("2. Why the Suggestions Have Rules at All"),
            lead("The app speaks as the user, not for them. ",
                "A suggestion is spoken in the user’s own voice, to somebody who will take it as the user’s own words. A wrong suggestion is not a slip by a machine. It is something the user appears to have said."),
            lead("A card can be tapped by mistake. ",
                "Many people who use the app have limited control of their hands, which is why a double tap can be required on some buttons. Something spoken by accident cannot be taken back, so when in doubt the rules choose the blander suggestion over the more colorful one."),
            lead("The AI only knows what it is told. ",
                "It knows what the user has entered in About Me, the people and places they have recorded, and what has been said in this conversation. It does not know what happened last weekend, what medication the user takes unless they said so, or what they believe. Most of the rules exist to stop it filling those gaps with a plausible guess."),
            lead("Nothing is spoken unless the user taps it. ",
                "The rules shape what is offered. The user always decides what is said, and no suggestion is ever spoken on its own."),

            // ===== 3 =====
            heading1("3. The Rules"),

            ...rule("3.1 It does not make up events in the user’s life",
                "A suggestion will not describe something that happened to the user unless the user supplied it. Asked what they have been up to, a user whose profile says they play online games with friends may be offered “Been gaming with friends lately”, but never “I beat Tyler last night”. A polite refusal will not invent an excuse either: “I’m pretty wiped today” may be offered, “I have a dentist appointment at three” will not.",
                "An invented event spoken in the user’s voice becomes something they said. It can be repeated, asked about later, and found to be untrue.",
                "To put a real event into the suggestions, the user types it in “In my own words” and taps “Reframe”. Whatever they type is treated as true and the suggestions are built around it."),

            ...rule("3.2 It does not invent personal details it was not given",
                "If the other person asks for something about the user that is not in their profile — an allergy, a medication, a date of birth, an address — no suggestion will answer it. Instead the user is offered ways to get to the answer: saying plainly that they do not know, promising to give it in a moment (only where they certainly know it, such as their own name or address), asking whether it is already on record, or asking exactly what is needed. An absence counts as an answer too, so “No allergies” or “Not that I know of” will not be offered about something the app was never told.",
                "Said to a doctor, “No allergies” is not a conversational slip. It is charted and acted on. Saying “I don’t know” is safe because the other person can act on it.",
                "Fill in the About Me questions that matter for the places the user goes. The health questions are kept private by default, so they are used when asked and never raised unprompted."),

            ...rule("3.3 It does not answer general-knowledge questions for the user",
                "If the other person asks for a fact about the world — a date, a figure, a definition, how something works, who did what — the suggestions will not supply it, however well known the answer is. The user is offered the moves a person makes when they do not know: saying so, turning the question back, or asking what the other person is really after. A fact is not slipped in with a hedge either, so “I think it’s about 1.4, but don’t quote me” will not be offered. Even when the user is answering, the suggestions say what was asked and stop, with no unrequested explanation.",
                "The app voices a person, not an information service. If the other person is asking, they do not have the answer, and a device that hands it over turns the user into a reference book rather than a participant in the conversation.",
                "Answer the About Me question “What do you know a lot about?”. Within the subjects listed there, and only those, the suggestions answer with real substance, as someone who knows the subject would, and still briefly. If the user knows an answer outside those subjects, they type it and tap “Reframe”."),

            ...rule("3.4 No vulgarity",
                "Suggestions never contain swearing, obscenity, slurs or crude sexual language, including softened or abbreviated forms. Where the natural wording would be coarse, it is said plainly instead. The app is told not to read anything as permission: not the user’s age, not their profile, not how crude the other person sounds, not how casual the setting is, and not the lack of an instruction.",
                "An obscenity spoken in the user’s own voice to a support worker or a stranger cannot be taken back, and a card can be tapped by mistake. A blander card costs nothing.",
                "Nothing, for now. Allowing coarser language with particular people is a possible future setting, but for a younger user it would need a guardian’s approval, and how that would work is not decided. The user can always speak such words themselves (Section 4)."),

            ...rule("3.5 It does not take a side on faith or politics",
                "Suggestions never raise faith, politics or a social issue, never argue a side, agree with a claim or concede a point, and never imply a view the user has not stated. When the other person raises one, the suggestions let the user say as much or as little as they choose, and one of them is always a way not to engage at all.",
                "A card that takes a position is remembered, and the risk is greatest when the AI knows nothing about the user and fills the gap with an average view.",
                "The About Me questions “Is faith or spirituality part of your life?” and “Do you hold strong views on social or political issues?” help the AI avoid guessing wrong about the user. They never make it raise the subject."),

            ...rule("3.6 Jokes only when the user has said they are welcome",
                "A joking or cheeky suggestion is offered only if the user has said that is welcome, either in About Me or by choosing the lighter replies in the “How I Sound” questions. Even then, at most one suggestion on a turn is the light one, so there is always a straight way to say the same thing, and no joke is offered on a turn that is serious, upsetting or medical, or where the other person sounds distressed. If the user has said teasing is not for them, no suggestion teases.",
                "A joke in the user’s voice at the wrong moment cannot be taken back.",
                "Answer “Is it okay for the app to offer you a cheeky or joking response when one fits?” with “Yes, whenever it fits”, “Only with people I’m close to”, or “No — keep my suggestions straight”. A “No” outranks everything else, including lighter replies chosen in “How I Sound”."),

            ...rule("3.7 Private facts, people and places are not volunteered",
                "Anything marked private — an About Me answer, a person or a place — is known to the AI for context but never worked into a suggestion on its own initiative. It is offered only when the other person asks about it, or when the user types it into “In my own words” and taps “Reframe”. An About Me question answered with “Prefer not to say” goes further: the AI is never given the answer at all, and phrases around the subject if it comes up.",
                "The user decides what is shared with whom. The AI using a fact to understand the conversation is different from the user saying it out loud.",
                "Mark answers, people and places private, or choose “Prefer not to say”, in About Me."),

            ...rule("3.8 Topics the user would rather avoid",
                "Topics listed as ones the user would rather not be asked about are never raised in a suggestion. If the other person brings one up, the suggestions do not volunteer detail, and one of them always lets the user move the conversation on. If the user steers toward the topic themselves, the suggestions follow.",
                "The app cannot stop another person asking, but it can make sure the user always has a way out.",
                "Answer “What would you rather not be asked about?” in About Me, and fill in “Topics to avoid” for particular people and places."),

            ...rule("3.9 Every suggestion can be spoken aloud",
                "Suggestions are written the way words are said, because a speech synthesizer reads them. There is no texting shorthand (“idk”, “tbh”), no symbols (“&”, “@”, “%”), no emoji and no stage directions. Spoken slang is fine; the rule is only that the words must come out as intended when read aloud.",
                "Shorthand that reads well on a screen can come out as nonsense, or as something worse, when a synthesizer sounds it out letter by letter.",
                "Nothing needs changing. How casual or formal the suggestions sound comes from the user’s profile, not from this rule."),

            ...rule("3.10 No empty openings",
                "No suggestion starts with a filler such as “Um”, “Er”, “Well”, “So” or “Hmm”. A polite refusal may still open with a softener that carries meaning, such as “I’d love to, but…”.",
                "Filler at the start of a synthesized sentence wastes the user’s moment and sounds hesitant rather than natural.",
                "Nothing needs changing. The user can add filler to their own phrases if they want it."),

            ...rule("3.11 It does not produce the user’s catchphrases",
                "The AI is shown the user’s own Express Panel phrases so it can match how they talk, but it is told never to reproduce them. The same goes for the lighter replies chosen in “How I Sound”: they show the AI the user’s style, and it writes something fresh rather than repeating them.",
                "A catchphrase the AI slips in is presented as though the user chose to say it. Used slightly wrong it sounds like an impersonation, and repeated it becomes a verbal tic.",
                "Put catchphrases on Express Panel buttons, where the user says them deliberately."),

            ...rule("3.12 The AI company’s own rules also apply",
                "The AI company builds its own safety behavior into the model, and the app cannot switch it off. In practice the rules above are stricter and apply first, so it rarely comes into play.",
                "This is a property of the AI service, not a choice made by the app.",
                "Nothing within the app. See Section 5 for what has not yet been tested."),

            heading2("3.13 The rules at a glance"),
            simpleTable(
                ["Rule", "What a supporter can change"],
                [
                    ["No invented events or excuses", "Type a real event in “In my own words” and tap “Reframe”"],
                    ["No invented personal details", "Fill in the About Me questions that matter"],
                    ["No general-knowledge answers", "“What do you know a lot about?” in About Me"],
                    ["No vulgarity", "Nothing for now"],
                    ["No sides taken on faith or politics", "The faith and politics questions help it avoid guessing wrong"],
                    ["Jokes only when welcome", "The joking-response question in About Me"],
                    ["Private facts not volunteered", "Mark private, or “Prefer not to say”"],
                    ["Topics to avoid", "About Me, and each person and place"],
                    ["Every suggestion speakable", "Nothing needs changing"],
                    ["No empty openings", "Nothing needs changing"],
                    ["No catchphrases", "Put them on Express Panel buttons"],
                    ["The AI company’s rules", "Nothing within the app"],
                ],
                [4200, 5160]),

            // ===== 4 =====
            heading1("4. What These Rules Do Not Restrict: The User’s Own Words"),
            para("Every rule above applies only to the suggestions the AI writes. None of them limits what the user can say. Words the user writes themselves are spoken exactly as written, with nothing checked, softened or removed, and a sound the user adds is played as it was recorded. The only change the app ever makes is to how a word sounds, and only where the user has spelled out a pronunciation in a “How to say it” box."),
            para("The user has six ways to say exactly what they want:"),
            bulletBold("“In my own words”. ", "Type anything and tap “Speak”. It is spoken as typed."),
            bulletBold("Conversation starters. ", "On the Commands tab of Settings, under “Openers (Start conversation)”. These are offered when the user taps “Start conversation”."),
            bulletBold("Wind-down statements and goodbyes. ", "Also on the Commands tab, under “Wind-down statements (Wrap up)” and “Closings (goodbyes)”. The other phrases on that tab, such as what is said when asking someone to repeat, are the user’s to write as well."),
            bulletBold("Placeholder phrases. ", "On the Placeholders tab, under “What it says first” and “What it says while you are still choosing”. These are said while the user reads the suggestions."),
            bulletBold("Express Panel phrases. ", "On the Express Panel and Keyboard tab, “Add a phrase” puts a phrase on a button that speaks it with one tap."),
            bulletBold("Sound buttons. ", "On the same tab, “Add a sound” puts a recording on a button: the user’s own recorded voice, someone else’s voice, or a sound or music. Tapping it plays the recording."),
            lead("One thing to know about “Reframe”. ",
                "Typing in “In my own words” and tapping “Reframe”, instead of “Speak”, asks the AI for new suggestions built around what was typed. What is typed is treated as true, so it overrides the rules against inventing events and supplying knowledge. The suggestions are still written by the AI, though, so the other rules still apply: a word the AI will not suggest, such as a swear word, has to be spoken with “Speak” or put on a button."),

            // ===== 5 =====
            heading1("5. What Has Not Been Tested"),
            lead("Distress has not been tested. ",
                "A user may need to say something bleak: that they are frightened, that they want to die, that they do not want to continue a treatment. Helping them say it is exactly what the app is for. How the AI company’s built-in safety behavior responds when the suggestions have to carry something like that has not yet been tested. If the AI declines, the suggestions may simply fail to appear. The user can always type the words and tap “Speak”, which does not involve the AI at all."),
            lead("The rules are instructions, not a filter. ",
                "They are written into what the app tells the AI. Several of them have been checked against the live AI, but an AI cannot be made to follow an instruction with certainty, and not every rule has been tried in every kind of conversation. What makes that acceptable is Section 2’s last point: nothing is spoken unless the user taps it, so a suggestion that breaks a rule can be passed over."),
            lead("Clinical use. ",
                "Nothing in this document is a clinical evaluation or advice about recording or consent law."),

            // ===== 6 =====
            heading1("6. If a Suggestion Breaks a Rule"),
            para("Please tell us. In Settings, open the Troubleshooting tab, describe what was suggested and what had been said under “Report a problem”, and send it. A saved conversation records every set of suggestions the app offered, which is what lets us see exactly what went wrong."),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(docPath("Conversant AAC Response Option Guardrails.docx"), buffer);
    console.log("Wrote Conversant AAC Response Option Guardrails.docx");
});
