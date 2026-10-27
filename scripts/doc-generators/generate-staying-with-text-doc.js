/* Generates docPath("Conversant AAC Staying With Text (draft for SLP review).docx").
 *
 * A short note for the speech and language therapists on the project (Ken, October 27
 * 2026): Conversant widens to younger and less literate users without ever adding
 * picture symbols, and asks for their view. The decision and its reasoning are in
 * CLAUDE.md, "Lower literacy: stay with text, never add picture symbols"; the follow-up
 * work is in TODO.md, "Lower literacy: what staying with text needs". Keep the three in
 * step.
 *
 * Every citation was checked on October 27 2026 against the DOI registry or a published
 * abstract. The Closing the Gap talk itself is cited from its slides.
 *
 * ⚠ AS WITH EVERY GENERATOR HERE: once Ken edits the .docx by hand, the .docx is the
 * newer copy. The overwrite guard in doc-paths.js refuses to run over it; fold his
 * edits back in here first, or edit the .docx directly with docx_safe.py.
 *
 * Run: node scripts/doc-generators/generate-staying-with-text-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType,
        LevelFormat, HeadingLevel, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;
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
function question(text) {
    return new Paragraph({
        numbering: { reference: "questions", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
// A reference in APA style: each part is [text, italic?]. Hanging indent, never split
// across a page.
function ref(...parts) {
    return new Paragraph({
        spacing: { before: 0, after: 160 },
        keepLines: true,
        indent: { left: 720, hanging: 720 },
        children: parts.map(([text, italics]) => new TextRun({ text, italics: !!italics }))
    });
}
function bullets(reference) {
    return { reference,
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] };
}

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 28, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0, keepNext: true } },
        ]
    },
    numbering: {
        config: [
            bullets("research"),
            bullets("cues"),
            bullets("caution"),
            bullets("listen"),
            bullets("unknown"),
            { reference: "questions",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Staying With Text", italics: true, color: GRAY, size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  October 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: GRAY }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: GRAY }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: GRAY }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: GRAY })
            ]
        })]})},
        children: [

new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: "Staying With Text", bold: true, color: "1F4E79", size: 36, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: "Conversant AAC for users who read little or not at all — a draft for SLP review", italics: true, color: "595959", size: 24, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated October 27, 2026", color: GRAY, size: 20, font: "Arial" })]
}),

para("Conversant shows words on every button and no picture symbols. Today it’s for adults who read. Over time we’d like it to work for younger users and for people who read little or not at all."),
para("We plan to get there without adding picture symbols. We would lower the reading needed a step at a time and stay with print throughout. A user who learns to find words this way never has to move from symbols to print later, because they’ve used print from the start."),
para("We’d like your view before we design any of it. Our questions are at the end."),

heading1("The Closing the Gap Talk"),
para("At Closing the Gap 2026, Melanie Gylling, Amanda Grabiner and Alicia Alverson of Smartbox presented “Rethinking Symbols in AAC: What We Know, What We Assume, and What Matters.” They reviewed the research on picture symbols. The points below come from their review, the studies it cites, and a few studies on learning to read."),

heading1("What the Research Says"),
item("research", "A picture that looks like its meaning is easier to guess, but no easier to learn. ", "In two small studies, children with developmental and language delays learned arbitrary shapes about as well as more picture-like symbols (Barton et al., 2006; Sevcik et al., 2018). Young children don’t see resemblance on their own. In one series of studies, children recognized that a gesture resembled what it stood for at 26 months but not at 18 months (Namy et al., 2004; Namy, 2008)."),
item("research", "Pictures above text make reading harder. ", "Readers with intellectual and developmental disabilities understood short texts less well, and read them more slowly, when symbols appeared above the words (Benson-Goldberg, 2025)."),
item("research", "A picture beside a new word slows learning the word. ", "The picture draws attention away from the letters (Samuels, 1967). In one study, five of six students with moderate intellectual disabilities learned sight words fastest when each word was shown on its own (Didden et al., 2000)."),
item("research", "Symbols are hard to interpret, even for professionals. ", "Fifty-two speech-language pathology graduate students, most of whom knew the symbol set, tried to say what each Communication Bill of Rights symbol stood for. More than half of their answers had nothing to do with the right. When they matched each symbol to its statement, they were right less than half the time (Benson-Goldberg & Erickson, 2020)."),
item("research", "Symbols still have a place. ", "The presenters noted that symbols can support face-to-face communication. Most of the evidence above is about pictures added to text that someone reads, which is a different task from choosing a button."),

heading1("How a User Would Find a Button"),
para("Buttons on the Express Panel stay in the same place. A user who reads little would learn three things about each one together:"),
item("cues", "Where it is. ", "A fixed place also lets the panel work with a keyguard."),
item("cues", "What the word looks like. ", "Lowercase print has tall letters (b, d, h, l, t) and letters that hang below the line (g, p, y). Together they give each word and phrase its own outline."),
item("cues", "What it sounds like. ", "The app says the word or phrase when the user taps it."),
para("To someone who can’t read yet, a printed word is an arbitrary shape. The studies above suggest that arbitrary shapes can be learned, and printed words are the only ones that also lead toward reading. The presenters made a similar point. For small words such as “the” and “of,” and for names, the printed word can work better than a symbol."),

heading1("An Outline Around the Word"),
para("We’re considering an optional line drawn around each word on a button. It would rise over the tall letters and dip under the hanging ones, making each word’s shape easier to see. The reading research gives two reasons for caution:"),
item("caution", "Many short words share an outline. ", "“Cat,” “eat” and “oat” have the same one, and so do “hat,” “bat” and “hot.” Groff (1975) found shape an unreliable cue to a word for this reason."),
item("caution", "Learners lock onto whatever stands out. ", "Children who were taught words on cards, with a thumbprint beside one of them, used the thumbprint to recognize that word instead of its letters (Gough, 1993). Children who recognize a store’s sign mostly can’t read the same word in plain type (Masonheimer et al., 1984). A bold outline could work the same way, and the user might learn the outline instead of the word."),
para("On a panel of about 30 buttons, most of them short phrases, we expect place, outline and sound together to be plenty for finding a button. The cost would fall on learning to read, and on recognizing the word where it appears without an outline."),
para("One study found that adults with dyslexia read words with tall and hanging letters faster than words without them, while typical readers didn’t (Lavidor, 2011). An outline may therefore help the users we have in mind. We found no study of outlined words on AAC buttons. If we build it, it would be a setting that stays off unless someone turns it on."),

heading1("The Response Options"),
para("After the other person speaks, the AI writes four response options and the user picks one. These are new sentences every time. Each option’s position tells the user what kind of reply it is, such as agreeing or politely declining, but not what it says. Place and shape can’t help someone who can’t read four new sentences."),
para("For a user who reads little, the response options would have to be heard. Two additions would make that possible:"),
item("listen", "A short spoken label. ", "Each response option already carries a short version of a few words. The app could say it when the user first touches the option. Hearing four short labels takes a few seconds."),
item("listen", "A private preview. ", "Today the sound of a tap reaches the other person too, so the user finds out what a button says by saying it. When the app is set to need two taps, the first tap could play the words quietly, ideally in an earphone, and only the second would speak them aloud. We haven’t yet checked whether a web browser can send speech to an earphone alone."),

heading1("What We Don’t Know"),
item("unknown", "The studies are small. ", "The symbol-learning studies had 4 and 13 children. The Bill of Rights study tested graduate students rather than AAC users."),
item("unknown", "No study tests this plan. ", "We found no research on text-only AAC buttons for people who don’t read. Our plan rests on the evidence that arbitrary shapes can be learned and on the research on learning to read."),
item("unknown", "Where it stops working. ", "We don’t know how many buttons, or which users, this approach suits."),

heading1("Questions for You"),
question("Have you seen users learn printed words on buttons that stay in one place? What helped them?"),
question("Would an outline around each word help the users you work with, or pull their attention away from the letters?"),
question("Which users would you try a text-only approach with first, and which would you hold off on?"),
question("Roughly how many buttons could a user manage this way before it stops working?"),
question("Is any of the research above out of date, or is anything important missing?"),

heading1("References"),
ref(["Barton, A., Sevcik, R. A., & Romski, M. A. (2006). Exploring visual-graphic symbol acquisition by pre-school age children with developmental and language delays. "], ["Augmentative and Alternative Communication, 22", true], ["(1), 10–20. https://doi.org/10.1080/07434610500238206"]),
ref(["Benson-Goldberg, S. (2025). Symbolated texts as an assistive technology: Exploring the impact on reading comprehension. "], ["Research in Developmental Disabilities, 161", true], [", 104998. https://doi.org/10.1016/j.ridd.2025.104998"]),
ref(["Benson-Goldberg, S., & Erickson, K. (2020). Graphic symbols: Improving or impeding comprehension of the Communication Bill of Rights? "], ["Assistive Technology Outcomes and Benefits, 14", true], [", 1–18."]),
ref(["Didden, R., Prinsen, H., & Sigafoos, J. (2000). The blocking effect of pictorial prompts on sight-word reading. "], ["Journal of Applied Behavior Analysis, 33", true], ["(3), 317–320. https://doi.org/10.1901/jaba.2000.33-317"]),
ref(["Gough, P. B. (1993). The beginning of decoding. "], ["Reading and Writing, 5", true], [", 181–192."]),
ref(["Groff, P. (1975). Research in brief: Shapes as cues to word recognition. "], ["Visible Language, 9", true], ["(1)."]),
ref(["Gylling, M., Grabiner, A., & Alverson, A. (2026). "], ["Rethinking symbols in AAC: What we know, what we assume, and what matters", true], [" [Conference presentation]. Closing the Gap Conference."]),
ref(["Lavidor, M. (2011). Whole-word shape effect in dyslexia. "], ["Journal of Research in Reading, 34", true], ["(4), 443–454. https://doi.org/10.1111/j.1467-9817.2010.01444.x"]),
ref(["Masonheimer, P. E., Drum, P. A., & Ehri, L. C. (1984). Does environmental print identification lead children into word reading? "], ["Journal of Reading Behavior, 16", true], [", 257–271."]),
ref(["Namy, L. L. (2008). Recognition of iconicity doesn’t come for free. "], ["Developmental Science, 11", true], ["(6), 841–846. https://doi.org/10.1111/j.1467-7687.2008.00732.x"]),
ref(["Namy, L. L., Campbell, A. L., & Tomasello, M. (2004). The changing role of iconicity in non-verbal symbol learning: A U-shaped trajectory in the acquisition of arbitrary gestures. "], ["Journal of Cognition and Development, 5", true], ["(1), 37–57. https://doi.org/10.1207/s15327647jcd0501_3"]),
ref(["Samuels, S. J. (1967). Attentional process in reading: The effect of pictures on the acquisition of reading responses. "], ["Journal of Educational Psychology, 58", true], ["(6), 337–342."]),
ref(["Sevcik, R. A., Barton-Hulsey, A., Romski, M. A., & Hyatt Fonseca, A. (2018). Visual-graphic symbol acquisition in school age children with developmental and language delays. "], ["Augmentative and Alternative Communication, 34", true], ["(4), 265–275. https://doi.org/10.1080/07434618.2018.1522547"]),

        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    const out = docPath("Conversant AAC Staying With Text (draft for SLP review).docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out);
});
