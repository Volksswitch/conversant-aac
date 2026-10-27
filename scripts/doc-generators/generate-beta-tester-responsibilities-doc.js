/* Generates docPath("Conversant AAC Beta Tester Responsibilities.docx").
 *
 * A one-page handout of what a beta tester is asked to do (Ken, October 27 2026: "I'd
 * like to be able to hand the beta testers a < 1page overview of the responsibilities
 * of a beta tester"). Everything in it is a summary of the Beta Test Plan, so when the
 * plan changes, check this page too: it carries no fact the plan does not.
 *
 * ⚠ IT MUST STAY ON ONE PAGE. Check the page count in Word after any edit; a second
 * line in one item can push the last section over.
 *
 * ⚠ AS WITH EVERY GENERATOR HERE: once Ken edits the .docx by hand, the .docx is the
 * newer copy. The overwrite guard in doc-paths.js refuses to run over it; fold his
 * edits back in here first, or edit the .docx directly with docx_safe.py.
 *
 * Tester-facing, so the footer says "For beta testers", like the Beta Test Plan's.
 *
 * Run: node scripts/doc-generators/generate-beta-tester-responsibilities-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType,
        LevelFormat, HeadingLevel, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;
// Top and bottom are 3/4 inch rather than the house inch: it is what keeps this on one page.
const MARGIN_TB = 1080;
const GRAY = "808080";

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(text)] });
}
function para(text) {
    return new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(text)] });
}
// A list item led by a bolded phrase, so a reader can scan the list.
function item(ref, label, text) {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 28, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 0, keepNext: true } },
        ]
    },
    numbering: {
        config: [
            { reference: "asks",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
            { reference: "questions",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
            { reference: "know",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN_TB, right: MARGIN, bottom: MARGIN_TB, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Beta Tester Responsibilities", italics: true, color: GRAY, size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  October 2026  |  For beta testers  |  Page ", size: 18, font: "Arial", color: GRAY }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: GRAY }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: GRAY }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: GRAY })
            ]
        })]})},
        children: [

new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: "Beta Tester Responsibilities", bold: true, color: "1F4E79", size: 36, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: "Conversant AAC — your part in the beta, on one page", italics: true, color: "595959", size: 24, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated October 27, 2026", color: GRAY, size: 20, font: "Arial" })]
}),

para("Thank you for testing Conversant AAC. For six weeks, what you tell us decides what we fix, change, and drop. This page covers only the highlights. The full Beta Test Plan, linked at the bottom, explains setup, privacy, and why we ask what we ask. Please read it too."),

heading1("What We Ask of You"),
item("asks", "Set up, and enter your tester name. ", "Follow the setup in the User Manual for your device. Then type the tester name we gave you in Settings, then Troubleshooting, under “Tester name”, so we know whose reports are whose. Save your setup as a named settings profile, and tap “Update” after each change."),
item("asks", "Tell the people you talk with. ", "The app sends what they say to a transcription service and keeps the text. Tell them once, at the start. The Express Panel button “My device listens and speaks for me” says it for you."),
item("asks", "Learn the buttons first. ", "Take the tour in Settings, then Practice, then “A tour of the buttons”. Then practice a conversation or two."),
item("asks", "Use it when a conversation comes up. ", "There’s no daily quota. Practice in week 1. In week 2, make it yours: fill in About Me, add your people and places, and make the Express Panel phrases your own. Then have real conversations, at home first, then with new people and in new places."),
item("asks", "Report problems, and good moments too. ", "In Settings, then Troubleshooting, write a line under “Report a problem” and tap “Send”. “I pressed Listen and nothing happened” is a perfect report. Always report a conversation panel that turns faintly red, or anything that should happen and doesn’t. The opening screen has a report button too."),
item("asks", "Leave automatic reporting on. ", "About once a week the app sends us counts and timings, never what anyone said. Each report carries your tester name."),
item("asks", "Check the Known Issues page. ", "It lists the faults we already know about. Settings, then Troubleshooting, has a button for it. If one causes you real trouble, tell us anyway."),
item("asks", "Talk with us at the end. ", "After six weeks, we’d like to talk with you in whatever form works for you. If you stop early, we’d still like five minutes to hear why."),

heading1("What We’re Trying to Learn"),
item("questions", "Do you keep using it? ", "Six weeks in, do you still reach for it?"),
item("questions", "Can you say what you meant? ", "How often is a response option close enough to say?"),
item("questions", "Does it keep up? ", "Is the wait before you speak short enough to be comfortable?"),

heading1("Good to Know"),
item("know", "Any conversation can stay private. ", "Tap “Don’t save this conversation”, and nothing that was said is kept."),
item("know", "Questions? ", "Our contact details are in your welcome pack. Mention the version line on the opening screen."),
item("know", "The full Beta Test Plan, and your User Manual: ", "https://volksswitch.org/index.php/conversant-documents/"),

        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    const out = docPath("Conversant AAC Beta Tester Responsibilities.docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out);
});
