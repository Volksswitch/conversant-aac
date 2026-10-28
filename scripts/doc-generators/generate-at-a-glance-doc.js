/* Generates docPath("Conversant AAC at a Glance.docx").
 *
 * A one-page description of Conversant and what makes it special (Ken, October 28 2026:
 * "a brief (one page or less) description of Conversant and what makes it special").
 * Written for someone who has never heard of the app, so "the user" is the person who
 * uses AAC and the reader is somebody else. Every fact is a summary of the Product
 * Overview and the website home page text; when either changes, check this page too.
 *
 * ⚠ IT MUST STAY ON ONE PAGE, with about one line to spare (October 28 2026). Check
 * the page count in Word after any edit; a second line in one item pushes the last
 * section over. The subtitle line was dropped to make it fit.
 *
 * After running it, run apply-doc-style.py and fix-docx-lists.py on the document: they
 * change no formatting here, but they rewrite the file in the order Word expects
 * (check docs rule S1), which this generator's output does not have.
 *
 * ⚠ AS WITH EVERY GENERATOR HERE: once Ken edits the .docx by hand, the .docx is the
 * newer copy. The overwrite guard in doc-paths.js refuses to run over it; fold his
 * edits back in here first, or edit the .docx directly with docx_safe.py.
 *
 * Meant to be handed to anyone, so the footer carries no audience line.
 *
 * Run: node scripts/doc-generators/generate-at-a-glance-doc.js
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
// A numbered step with no bold lead.
function step(ref, text) {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
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
            { reference: "steps",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
            { reference: "different",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN_TB, right: MARGIN, bottom: MARGIN_TB, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC at a Glance", italics: true, color: GRAY, size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  October 2026  |  Page ", size: 18, font: "Arial", color: GRAY }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: GRAY }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: GRAY }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: GRAY })
            ]
        })]})},
        children: [

new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: "Conversant AAC at a Glance", bold: true, color: "1F4E79", size: 36, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated October 28, 2026", color: GRAY, size: 20, font: "Arial" })]
}),

para("Conversant AAC is a free app that helps people who use AAC take part in conversation. It listens to the other person, offers four ways to reply within seconds, and says the one the user taps. It runs in a web browser on an iPad, Android device, Windows computer, Chromebook or Mac."),

heading1("The Problem It Solves"),
para("Most AAC devices are built to get a message across. In conversation, after one to four seconds of silence, people often finish the user’s sentence, change the subject or move on. Building a reply takes much longer, so many AAC users answer questions instead of taking part. Conversant puts a reply in front of the user within that window."),

heading1("How It Works"),
step("steps", "The other person talks, and Conversant shows what it heard so the user can check it."),
step("steps", "Four response options appear: a friendly answer, a polite no, a new direction and a way to ask what they meant. Each kind always appears in the same place."),
step("steps", "While the user reads, Conversant can say a short phrase like “I’m thinking about that,” so the other person knows a reply is coming."),
step("steps", "The user taps one, and Conversant says it in the voice they’ve chosen. If none fit, they tap a saved phrase or type their own words."),
para("The other person needs no app, no training and no special knowledge."),

heading1("What Makes It Different"),
item("different", "It speaks as the user. ", "Its options reflect what the user has told it about themselves, their people, their places and their goals. Nothing is said until the user taps it."),
item("different", "It doesn’t make up facts. ", "It won’t answer with facts the user never gave it. Instead it offers what a person would say: that they don’t know, or a question back."),
item("different", "It follows how conversation works. ", "The four kinds of reply come from research on how people talk. When the other person says goodbye, the options become goodbyes."),
item("different", "Nothing on the screen moves. ", "The user learns where things are, and one keyguard fits every screen."),
item("different", "It keeps working without the AI. ", "Saved phrases and typing still work."),
item("different", "The user can practice first. ", "The AI plays the other person, so the user can rehearse a conversation that matters, like a doctor’s appointment."),
item("different", "It’s private. ", "The user’s information stays on their own device. Only what’s needed to suggest replies goes to the AI company."),
item("different", "It has no server to pay for. ", "Earlier AI-driven AAC projects stopped when funding ran out. Conversant is free and open source. Users pay the AI company directly, usually a fraction of a cent per reply."),

heading1("Who It’s For Right Now"),
para("It’s for adults who make their own decisions, can read, and point at the screen directly or by eye gaze used as a mouse. Switch scanning and younger users come later."),

para("More, including the user manuals: https://volksswitch.org/index.php/conversant-documents/"),

        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    const out = docPath("Conversant AAC at a Glance.docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out);
});
