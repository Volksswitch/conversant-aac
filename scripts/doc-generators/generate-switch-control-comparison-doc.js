/* Generates docPath("Conversant AAC Switch Control Comparison (draft for SLP review).docx").
 *
 * A short note for the speech and language therapists (Ken, November 26 2026: "write a
 * version for the SLPs"). Ken has asked them how much it matters that Conversant works
 * well with the iPad's own Switch Control; this gives them the press counts behind the
 * question. The measurements are in CLAUDE.md, "Apple Switch Control with Conversant",
 * and TODO.md, "Apple Switch Control on the iPad". Keep the three in step.
 *
 * HOW THE NUMBERS WERE MADE (November 26 2026). Two switches, next and choose.
 *   Conversant: from its scanning rules (app/js/scan-rules.js, switch-access.js) and the
 *   iPad screen at 1180 x 763: Express Panel 3 rows of 11, Command Bar 9 buttons, four
 *   response options plus New 4. After a choice the highlight stays in its area; after an
 *   option is spoken the options clear and the highlight is on the Express Panel's first
 *   row; new options highlight the options area.
 *   Switch Control: from Ken's recording of the test page (RPReplay_Final1795636422,
 *   November 25 2026), read frame by frame. Back to the top after every choice; Apple's
 *   own groups. Assumed: four lines of conversation on screen (four stops with groups
 *   off, one with groups on); top-level groups conversation, Command Bar in two halves
 *   (5 and 4), options, Express Panel; each Express row split in half (6 and 5). "With
 *   the delay" adds one pass of the old screen: 5 stops with groups on, 47 with them off.
 *   Express phrase: average over the 21 phrases in the first two rows.
 *   Ten-turn mix: 6 options, 3 Express phrases, 1 "Ask them to repeat".
 *
 * ⚠ AS WITH EVERY GENERATOR HERE: once Ken edits the .docx by hand, the .docx is the
 * newer copy. The overwrite guard in doc-paths.js refuses to run over it; edit the
 * .docx directly with docx_safe.py instead.
 *
 * Run: node scripts/doc-generators/generate-switch-control-comparison-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType,
        LevelFormat, HeadingLevel, PageNumber, Table, TableRow, TableCell,
        WidthType, BorderStyle } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;
const TABLE_W = PAGE_W - 2 * MARGIN;
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
function bullets(reference) {
    return { reference,
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] };
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "7B8794" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
function table(widths, headerRow, rows) {
    const mk = (cells, isHeader) => new TableRow({
        tableHeader: isHeader,
        cantSplit: true,
        children: cells.map((text, i) => new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({
                spacing: { before: 0, after: 0 },
                keepNext: isHeader,
                alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                children: [new TextRun({ text: String(text), bold: isHeader })]
            })]
        }))
    });
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        columnWidths: widths,
        borders,
        rows: [mk(headerRow, true), ...rows.map(r => mk(r, false))]
    });
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
            bullets("compared"),
            bullets("behaved"),
            bullets("better"),
            bullets("rests"),
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
            children: [new TextRun({ text: "Conversant AAC — Switch Control Comparison", italics: true, color: GRAY, size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  November 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: GRAY }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: GRAY }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: GRAY }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: GRAY })
            ]
        })]})},
        children: [

new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: "Switch Control and Conversant’s Own Scanning", bold: true, color: "1F4E79", size: 36, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: "How many switch presses typical tasks take on an iPad — a draft for SLP review", italics: true, color: "595959", size: 24, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated November 26, 2026", color: GRAY, size: 20, font: "Arial" })]
}),

para("An iPad has its own switch scanning, Switch Control, which works the same way in every app. Conversant also has scanning of its own, built into the app. Many switch users stay in Switch Control all day, so we’d like Conversant to work well with it."),
para("When we tried Switch Control with Conversant, it needed many extra presses. To put numbers on it, we counted how many switch presses some typical tasks take each way. We’d like your view on how much this matters to your clients. Our questions are at the end."),

heading1("What We Compared"),
item("compared", "Two switches. ", "One switch moves the highlight to the next item and the other chooses it. We counted presses on both switches."),
item("compared", "Conversant’s scanning. ", "The highlight moves through four areas: the response options, the Express Panel, “In my own words” and the Command Bar. A press enters an area. After a choice, the highlight stays in the area you were working in. When new response options arrive, the highlight goes to them."),
item("compared", "Switch Control with Group Items on. ", "Switch Control gathers buttons into groups of its own, and a press enters a group. This is the setting we used in our tests."),
item("compared", "Switch Control with Group Items off. ", "Every item is its own stop, one after another down the page."),

heading1("How Switch Control Behaved"),
para("We recorded Switch Control on a test page that copies parts of Conversant, and we tried it with Conversant itself. A web page can’t change any of the following:"),
item("behaved", "It goes back to the top after every choice. ", "To choose a second phrase, the user starts again from the top of the page and enters each group again."),
item("behaved", "It makes its own groups. ", "It ignores the groups Conversant sets up. For example, it splits each row of the Express Panel in half."),
item("behaved", "It stops on plain text. ", "Headings, notes and each line of the conversation are stops, although tapping them does nothing."),
item("behaved", "It’s slow to notice a new screen. ", "When Settings opens, it goes once around the old screen before it reaches the new one. Closing Settings does the same."),
item("behaved", "It highlights items that are out of view. ", "When a list scrolls, it highlights items hidden below the edge without scrolling to show them."),
para("We’ve reported the slow response to a new screen to Apple."),

heading1("Presses for Typical Tasks"),
// Kept with the table, so the table never starts a page without the sentence that explains it.
new Paragraph({ spacing: { before: 0, after: 160 }, keepNext: true, keepLines: true, children: [new TextRun(
    "Each number is the average number of presses to finish the task. The numbers in parentheses assume Switch Control is also slow to notice new response options. We haven’t measured that yet.")] }),

table([3600, 1820, 1970, 1970],
    ["Task", "Conversant’s scanning", "Switch Control, groups on", "Switch Control, groups off"],
    [
        ["Choose a response option when new ones arrive", "3.5", "6.5 (11.5)", "15.5 (62)"],
        ["Say an Express Panel phrase", "7", "11", "25"],
        ["Press “Ask them to repeat” after choosing an option", "11", "4", "10"],
        ["Open Settings and choose the Speech tab", "23", "13 (18)", "20 (67)"],
        ["A ten-turn conversation: six options, three phrases and one “Ask them to repeat”", "54", "75 (105)", "180 (460)"],
    ]),
new Paragraph({ spacing: { before: 0, after: 160 }, children: [] }),

para("For a whole conversation, Switch Control with groups on takes about 40% more presses than Conversant’s scanning. If it’s also slow to notice new options, it takes about twice as many. With groups off it takes more than three times as many."),

heading1("Where Each One Does Better"),
item("better", "Conversant’s scanning is quicker for responses and phrases. ", "The highlight stays where the user is working, and new response options are highlighted for them. Saying several phrases in a row costs the same each time."),
item("better", "Switch Control is quicker for the Command Bar and Settings. ", "Going back to the top costs little when the button is near the top, and the Command Bar is near the top of the page. Conversant’s scanning visits the Command Bar last, after the response options, the Express Panel and “In my own words.”"),
para("We could change Conversant’s scanning so the Command Bar is easier to reach. “Ask them to repeat” is usually needed right away, so it may deserve a quicker route."),

heading1("What These Numbers Rest On"),
item("rests", "Conversant’s numbers come from its own scanning rules. ", "We used the starting layout on an iPad, with an Express Panel of three rows of 11 buttons. A different layout gives different numbers."),
item("rests", "Switch Control’s numbers include some guesses. ", "We watched it on the test page, not on Conversant’s conversation screen. We assumed four lines of conversation on screen, and that Switch Control splits the Command Bar and each Express Panel row in half, as we saw in our tests."),
item("rests", "We counted presses, not time. ", "Each press also takes time to plan and make. With one switch and automatic scanning, the extra stops would cost waiting time instead of presses."),
item("rests", "We didn’t count typing. ", "Typing in “In my own words” uses the on-screen keyboard in both cases."),

heading1("Questions for You"),
question("How many of your clients who use switches on an iPad use Switch Control for everything, rather than an app’s own scanning?"),
question("Would they accept Conversant’s own scanning inside Conversant and Switch Control everywhere else? Switching between the two usually needs a helper today."),
question("How much do extra presses matter to your clients? Is 40% more acceptable for the sake of using one scanning system everywhere?"),
question("Do you know Switch Control settings that make it work better than what we found?"),

        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    const out = docPath("Conversant AAC Switch Control Comparison (draft for SLP review).docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out);
});
