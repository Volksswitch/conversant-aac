/* Generates docPath("Conversant AAC Question Sessions Design.docx") - how the app
 * would help a user answer audience questions after a talk, in paragraphs, from their
 * own writing. Written October 11 2026 from the design conversation recorded in
 * CLAUDE.md under "Question sessions after a talk". Nothing in it is built.
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// Curly apostrophes and quotes, the house style for documents.
const smart = (s) => s.replace(/'/g, "’").replace(/"(?=\S)/g, "“").replace(/"/g, "”");
const heading1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(smart(text))] });
const heading2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(smart(text))] });
const para = (text) => new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(smart(text))] });
const lead = (label, text) => new Paragraph({ spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: smart(label), bold: true }), new TextRun(smart(text))] });
const bullet = (label, text) => new Paragraph({ numbering: { reference: "bullets", level: 0 },
    spacing: { before: 0, after: 80 },
    children: text === undefined ? [new TextRun(smart(label))]
        : [new TextRun({ text: smart(label), bold: true }), new TextRun(smart(text))] });

function simpleTable(headers, rows, widths) {
    const cell = (text, w, head) => new TableCell({
        width: { size: w, type: WidthType.DXA }, margins: cellMargins,
        shading: head ? { type: ShadingType.CLEAR, fill: "D5E8F0" } : undefined,
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, keepNext: !!head,
            children: [new TextRun({ text: smart(text), bold: !!head, size: 20 })] })],
    });
    return new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: widths, borders,
        rows: [
            new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
            ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) })),
        ],
    });
}
const W2 = [2600, 6760];

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, keepNext: true, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 26, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 220, after: 140 }, keepNext: true, outlineLevel: 1 } },
        ],
    },
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Question Sessions Design", italics: true, color: "808080", size: 18, font: "Arial" })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: "Volksswitch.org  |  October 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
            new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" }),
        ] })] }) },
        children: [
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Question Sessions Design", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: smart("Answering audience questions in paragraphs, from the user's own writing"), italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated October 11, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("A user gives a talk on a subject they've already written about in depth, in a paper or on a website. Then they open the floor to questions. They want to answer in complete paragraphs, not in one or two sentences."),
            para("Today the app can't help with that. Its suggestions are short on purpose, because in everyday conversation the other person is waiting. This document describes a question-session mode that changes that, for this one setting."),
            para("The case that prompted it is a real one. The project expects to present at ATIA 2027 in January, with a Conversant demo, and to take questions afterward."),
            lead("Status. ", "Nothing here is built. The design has been discussed and one test has been run. Section 8 lists what is still open."),

            heading2("1.1 Words used here"),
            simpleTable(["Term", "Means"], [
                ["User", "The person using the app, who doesn't speak"],
                ["Question session", "The questions and answers after a talk"],
                ["Material", "The documents the user chooses for a talk, such as a paper and a product description"],
                ["Card", "One suggested response on screen; the user taps it to have it spoken"],
                ["Place", "A location the user sets up in About Me and taps on the Express Panel"],
            ], W2),

            // ===== 2 =====
            heading1("2. The Larger Idea Behind It"),
            para("The broader goal is to let the AI draw on what the user has written. That helps with two separate things, and it's worth keeping them apart."),
            bullet("What the user thinks and knows. ", "Their opinions, their arguments, their stories. Today the AI has only About Me, and the app's honesty rule stops it from filling gaps. The user's own writing is something they gave us, so the AI may use it."),
            bullet("How the user sounds. ", "Here writing helps much less than you'd expect. Written style and spoken style differ, even for the same person."),
            para("That second point applies directly to question sessions. The way a person writes a journal article isn't the way they'd answer a therapist's question after a talk. Even the words in the talk itself would be different. In this mode, the material supplies the content and never the wording."),
            para("A general collection of the user's writing raises harder questions, which section 9 covers. The question session avoids most of them, which is why it is a good place to start."),

            // ===== 3 =====
            heading1("3. Why a Question Session Is Different"),
            bullet("Longer answers are expected. ", "In everyday talk a long reply holds up the other person. After a talk, the audience expects the presenter to answer at length."),
            bullet("A short pause is normal. ", "People expect a presenter to take a moment before answering. \"Good question\" is a natural way to fill it. The app removed that phrase from its everyday holding phrases because it sounded wrong after a greeting, but here it fits."),
            bullet("The user picks the material ahead of time. ", "The app never has to work out which of the user's writing is relevant to a question. A paper and a product description are small enough to send with every request, so no automatic selection is needed."),

            // ===== 4 =====
            heading1("4. How It Would Work"),
            heading2("4.1 Turning it on"),
            para("A place switches the mode on. The user sets up a place such as \"At my talk\" and taps it on the Express Panel. That one tap tells the app to use the talk's material and its question-session rules."),
            para("A place also fills the Flex band of the Express Panel with phrases for that setting. That matters for section 4.3."),
            heading2("4.2 Who is asking"),
            para("The audience matters as well as the place. Speech-language pathologists and occupational therapists want technical ideas in plain terms, tied to their clients. Academics want the published work named, and claims kept apart from what has been measured."),
            para("The app already has a way to say this. Each person in About Me has a \"how I talk with them\" setting. An entry such as \"SLPs at my talk\" can carry that audience's style, and the user switches it on with the place."),
            heading2("4.3 All four cards are answers"),
            para("In everyday conversation the four cards are four different kinds of reply. In a question session, two of those kinds are better handled elsewhere:"),
            bullet("Asking for the question again ", "is already the \"Ask them to repeat\" button in the Command Bar."),
            bullet("\"That's outside what I've worked on\" ", "and \"Thank you, next question\" are fixed phrases, so they belong on the Express Panel, in the place's Flex band."),
            para("That leaves all four cards for answers. They are a mix of different angles and different lengths. The working plan is three longer answers, each drawing on a different part of the material, and one short answer for when time is short."),
            heading2("4.4 Picking a paragraph quickly"),
            para("Nobody can read four paragraphs before choosing one. Every card already has a short label and a full version, and the user can choose which to see. In this mode the user picks by the label, such as \"How it avoids server costs\", and hears the full paragraph."),
            para("The user also needs a way to stop an answer partway through, and probably a way to ask for more. Neither is designed yet."),
            heading2("4.5 Hearing the questions"),
            para("Questions arrive through the microphone, like any other partner speech. When a moderator repeats a question, the app hears it twice. That's harmless, because the repeat joins the same question and the answers draw on both."),

            // ===== 5 =====
            heading1("5. Rules That Change in This Mode"),
            simpleTable(["Rule", "In this mode"], [
                ["Say what was asked and stop", "Relaxes to \"answer fully, from the material\""],
                ["The honesty rule", "Stays. Answers come only from the material and About Me. If a question goes beyond them, the answers say so plainly"],
                ["Use of the material", "Ideas and facts only. The AI must never reuse its sentences"],
                ["Voice", "The user's spoken voice, pitched for the audience in section 4.2"],
                ["Preparing answers ahead", "Not planned. The range of questions is too wide, so answers made on the spot have to work"],
            ], W2),

            // ===== 6 =====
            heading1("6. Preparing the Material"),
            para("The material will usually be PDFs and web pages. Reading them is heavier work than a tablet does well, so the preparation can happen on a computer instead."),
            para("On a computer, the app turns the documents into plain text and stores it with the place. The result reaches an iPad the way everything else does, through the data folder or a backup. The iPad never does the heavy work."),
            para("A web page is harder than a PDF, because a browser won't let one site read another. The simple route is to save the page as a file on the computer and add it like a PDF."),
            para("The app should keep the user's own text, not an AI summary of it. A summary loses the user's wording, and the AI may need to quote a figure or a name exactly. Shortening is a fallback, only if a talk's material is too big to send."),

            // ===== 7 =====
            heading1("7. The First Test"),
            para("On October 11 2026 the project ran a test of this mode. It used a prototype of the instructions the app would send, since the mode isn't built."),
            heading2("7.1 How it was run"),
            bullet("The material was the founder's 2024 ATOB article and the Conversant AAC Product Overview, about 22,700 words together."),
            bullet("The test asked twelve audience questions. Six are answered by the material, three are partly covered, and three aren't covered."),
            bullet("It asked each question twice, once for SLPs and OTs and once for academics, and got four answers each time."),
            bullet("The examples of the speaker's voice were five sentences the founder typed that day. There was no profile to draw on."),
            heading2("7.2 What it found"),
            simpleTable(["Measure", "Result"], [
                ["Wait for four answers", "7.6 seconds in the middle case, 4.3 to 9.5 overall. Everyday suggestions take about 3"],
                ["Cost", "About 2 cents per set of four answers, 52 cents for the whole test"],
                ["Staying inside the material", "Held on every question checked. Asked about Medicaid, the short answer began \"I don't know. I haven't written about Medicaid or insurance coverage.\""],
                ["Audience", "SLP answers talked about clients and setting up. Academic answers named the cited research"],
                ["Copying", "No whole sentence was reused. The longest copied stretch was 10 to 19 words, mostly descriptions from the Product Overview"],
            ], W2),
            para("The test can't judge whether the answers sound like the speaker. To the project they read clean and fairly polished, which may be more like writing than like speech. The founder is reviewing the answers and marking which ones sound like the founder and which don't."),
            para("The script and results are in scripts/qa-session-eval, with a Word copy for review."),

            // ===== 8 =====
            heading1("8. Still to Decide"),
            bullet("Stopping and continuing. ", "How the user stops an answer partway, and whether \"say more\" carries on."),
            bullet("What a place stores. ", "Exactly how material is added on a computer and kept with the place."),
            bullet("Keeping talks apart. ", "How a talk's material stays separate from the user's general writing."),
            bullet("The voice. ", "Whether the answers sound enough like the user, once the review comes back. If not, what better examples of the user's spoken voice would look like."),
            bullet("Noisy rooms. ", "How well the microphone hears a question asked from the back of a room."),

            // ===== 9 =====
            heading1("9. Later Work on a General Collection"),
            para("A question session uses material the user chose for one talk. A general collection would hold whatever the user has written, such as emails, essays and posts, and draw on it in everyday conversation. That is a bigger step, and these are the questions it raises."),
            heading2("9.1 Choosing what to send"),
            para("A collection can grow past what is sensible to send with every request. Then the app has to choose the relevant pieces. There are two ways:"),
            bullet("Matching words ", "to what the partner just said. It's free and runs on any device, but it's crude."),
            bullet("Matching meaning. ", "This needs either a small model running on the device or a paid service. Anthropic doesn't sell this, so a paid service means another account for the user. The project has found accounts to be the hardest part of setup."),
            para("Until a collection is that large, the app can simply send all of it. The AI service charges a tenth of the normal price for text it has already seen. About 20,000 words would roughly double the cost of each set of suggestions, to about 1 cent."),
            heading2("9.2 Risks"),
            bullet("Longer cards work against the main goal. ", "In everyday talk the other person waits while a long card is read and spoken."),
            bullet("Old writing goes stale. ", "Views change. Each piece needs a date, and the user needs to be able to remove it."),
            bullet("Privacy. ", "Emails hold other people's words, and anything in the collection goes to the AI. The user has to choose every piece, see it and remove it."),
            bullet("The Cyrano problem grows. ", "A longer, well-argued position in the user's own voice is easier to accept than to question."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Question Sessions Design.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
