/* Conversant AAC — Taking Questions After a Talk (November 9 2026)
 *
 * A short guide for a presenter getting ready to take questions with a topic switched
 * on: choosing documents, writing the note, the audience, the Express Panel, a
 * practice run, and the day itself. Ken asked for it after 0.14.0 shipped question
 * sessions. The User Manuals (4.8 and 5.8) carry the screen-by-screen detail; this is
 * the preparation that sits around them. Reader and user are the same person, so
 * "you" is the presenter throughout.
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
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(text)] });
}
function para(text) {
    return new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(text)] });
}
function boldPara(label, text) {
    return new Paragraph({ spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)] });
}
function item(text, ref) {
    return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { before: 0, after: 80 },
        children: [new TextRun(text)] });
}
function itemBold(label, text, ref) {
    return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)] });
}
function emptyPara() { return new Paragraph({ children: [] }); }

function simpleTable(headers, rows, widths) {
    const cell = (text, w, head) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: head ? { type: ShadingType.CLEAR, fill: "D5E8F0" } : undefined,
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, keepNext: !!head,
            children: [new TextRun({ text, bold: !!head, size: 22 })] })]
    });
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders,
        rows: [
            new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
            ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) }))
        ]
    });
}

const bulletList = (ref) => ({ reference: ref,
    levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });
const numberList = (ref) => ({ reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });

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
        config: [bulletList("docs"), numberList("setup"), bulletList("panel"), bulletList("practice"),
                 bulletList("before"), bulletList("during")]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Taking Questions After a Talk", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  November 2026  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            new Paragraph({ spacing: { before: 240, after: 80 },
                children: [new TextRun({ text: "Taking Questions After a Talk", bold: true, color: "1F4E79", size: 40, font: "Arial" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Getting ready to answer questions with Conversant AAC", italics: true, color: "595959", size: 24, font: "Arial" })] }),
            new Paragraph({ spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  November 2026  |  Last updated November 9, 2026", color: "808080", size: 20, font: "Arial" })] }),

            heading1("1.  What This Guide Covers"),
            para("Conversant AAC can help you answer questions about a subject you know well, such as after a talk you give. You give it the documents your answers should come from. When someone asks a question, it offers four answers drawn from those documents, and you choose what to say."),
            para("This guide covers getting ready: choosing the documents, setting up the topic and your audience, setting up the Express Panel, and a practice run. Sections 4.8 and 5.8 of the User Manual for your device show each screen in detail."),
            emptyPara(),

            heading1("2.  Choose Your Documents"),
            para("The answers come only from your documents and the note you write about them. If a fact isn’t there, the app offers an answer saying you don’t know rather than a guess. When you choose them, ask yourself what you want to be able to say."),
            itemBold("Your own writing first. ", "A paper, an article, or a description of your work. These carry your facts and your reasoning.", "docs"),
            itemBold("A page of likely questions. ", "Write down the questions you expect, with a few lines on how you’d answer each. It’s often the most useful document you can add, because it says what you’d stress.", "docs"),
            itemBold("What people always ask about. ", "Cost, where to get it, who it’s for, what research there is. If the answer isn’t in a document, it can’t be offered.", "docs"),
            para("The app takes facts and ideas from your documents, not their wording. Answers are written the way you’d say them out loud, so a formal paper is fine to include."),
            boldPara("Limits. ", "Each document can be up to about 65,000 words, and a topic can use up to 20 documents. A PDF made by scanning printed pages has no text in it, so copy the text from somewhere else and use “Paste text”. To use a web page, save it as a PDF or copy its text. Slides need to be saved as a PDF too, or you can paste in your speaker notes."),
            para("Every question sends all of the topic’s documents to the AI, so more material makes every request bigger. Choose the documents that matter for this talk rather than everything you have."),
            emptyPara(),

            heading1("3.  Set Up the Topic"),
            item("In About Me, tap “My Topics”. On a computer or an Android device, choose a data folder first, because your documents are kept there.", "setup"),
            item("Under “Add a topic”, type its name, such as the title of your talk.", "setup"),
            item("Add your documents with “Add a PDF or text file” or “Paste text”, and check the box beside each one this topic uses.", "setup"),
            item("Fill in the note on how you relate to the material. Section 3.1 explains what to write.", "setup"),
            item("Tap “Add topic”.", "setup"),
            heading2("3.1  Writing the Note"),
            para("The note tells the app who “I” is in your answers. Write it plainly, in a sentence or two, such as “I wrote this paper and I lead the project. I don’t use the app myself.”"),
            para("Without a note, the app assumes you aren’t one of the people your documents describe. It won’t have you say “I use this every day” unless your note says so."),
            emptyPara(),

            heading1("4.  Tell It Who’s Listening"),
            para("Answers for therapists and answers for researchers aren’t pitched the same way. To say who’s listening, add your audience in About Me as a People entry, such as “SLPs and OTs”, and check “This is a group, not one person”."),
            para("Then open “How I talk with them” for that entry. Set how you want to come across, such as a little more formal than usual, and use its note to say what this audience cares about, such as “tie it to their clients”."),
            emptyPara(),

            heading1("5.  Set Up the Express Panel"),
            itemBold("The topic and audience buttons. ", "On the Express Panel tab in Settings, add the topic to the Context band, and add a partner button for your audience.", "panel"),
            itemBold("Room in the Flex band. ", "Give the Flex band at least one row. Your topic’s own phrases appear there, and so do the “What do you mean by…?” buttons the app adds when a question turns on a vague word. With no Flex band, neither can appear.", "panel"),
            itemBold("Your topic’s phrases. ", "In the Flex section, choose “Topic: …” and add the short things you’ll say often, such as “Thank you, next question” or “That’s outside what I’ve worked on”.", "panel"),
            itemBold("Short labels. ", "Answers are long. Showing just the short label on each card makes them quicker to choose, and you still hear the whole answer. Set it with “What a response option shows” on the Conversation tab in Settings, or with “Show short labels only” on the topic’s form.", "panel"),
            emptyPara(),

            heading1("6.  Practice Before the Talk"),
            para("Ask a friend to put questions to you with the topic and the audience switched on. Use the questions you expect and a few you don’t, and read each set of answers as it comes up."),
            itemBold("An answer is wrong or leaves something out. ", "The fix is almost always in the documents. Add or correct the fact, or write it into your page of likely questions. “Replace” on the topic’s form swaps in a newer version of a document.", "practice"),
            itemBold("“I” is in the wrong role. ", "Reword your note.", "practice"),
            itemBold("The answers aren’t pitched right for the audience. ", "Adjust that audience’s “How I talk with them”.", "practice"),
            itemBold("A name or term is said wrongly. ", "Add it to “Words the voice gets wrong” on the Speech tab in Settings, spelled the way it sounds.", "practice"),
            para("If you can, practice in a room like the one you’ll speak in. A large room changes how well the app hears the questions."),
            emptyPara(),

            heading1("7.  At the Talk"),
            heading2("7.1  Before You Start"),
            item("Charge the device and bring its charger.", "before"),
            item("Check the internet connection. The answers are written by an AI service, and hearing the questions needs the connection too. Conference Wi-Fi can be slow, so a phone hotspot is a good backup.", "before"),
            item("Place the device where it can hear the person asking. If questions come from the audience, ask the moderator to repeat each one near the device. The app treats the repeat as part of the same question.", "before"),
            item("Switch on the topic and the audience on the Express Panel.", "before"),
            heading2("7.2  During Questions"),
            item("Tap “Listen” for each question. The microphone doesn’t turn itself back on while a topic is on, so you decide when the next question starts.", "during"),
            item("While you read, the app says a short holding phrase so the room knows you’re answering. People expect a pause before an answer in a question session.", "during"),
            item("Tap the short answer for a quick reply, or one of the deeper ones. All four stay on screen, so you can add a second answer.", "during"),
            item("Tap an answer while it’s playing to pause it. Say something else if you need to, then tap it again to carry on from the start of that sentence.", "during"),
            item("If a “What do you mean by…?” button appears, tap it to ask. The next answers take the explanation into account.", "during"),
            item("If none of the four fits, “New 4 – different options” gives four more, and “Reframe” in “In my own words” steers them. You can always type your own answer too.", "during"),
            item("If you didn’t catch the question, tap “Ask them to repeat”.", "during"),
            heading2("7.3  When You’re Done"),
            para("Tap “End conversation”. It switches the topic off, so your next everyday conversation gets ordinary response options. Between questions, tap “Listen” instead, so the topic stays on."),
            emptyPara(),

            heading1("8.  A Checklist"),
            simpleTable(["When", "What to do"], [
                ["A week before", "Choose your documents and write a page of likely questions. Set up the topic, the note and the audience."],
                ["A few days before", "Set up the Express Panel. Practice with a friend, and fix what the practice showed."],
                ["On the day", "Charge the device, check the internet, place the device, and switch on the topic and the audience."],
                ["Afterward", "Tap “End conversation”."],
            ], [2400, 6960]),
            emptyPara(),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    const out = docPath('Conversant AAC Taking Questions After a Talk.docx');
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out + ' (' + buffer.length + ' bytes)');
});
