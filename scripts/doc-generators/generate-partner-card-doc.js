/* Generates docPath("Conversant AAC Partner Card.docx") — the printed card for the
 * back of the device (SEC-7, the partner-disclosure answer).
 *
 * WHY THIS EXISTS. The tablet screen faces the USER, not the person they are talking
 * with, so an on-screen indicator only reaches the partner on a glance. The two
 * signals that actually reach them are audible (the listening chime, and the amber
 * Notice button in the Express Panel) and PRINTED — a card on the surface they are
 * already looking at. Partner awareness is mostly a one-time disclosure, not a
 * continuous beacon, and the card is the version that does not have to be repeated.
 * Beta Test Plan §5.2 promises testers this card by name.
 *
 * ⚠ EVERY CLAIM ON THE CARD IS LOAD-BEARING — it is handed to a member of the public
 * about a recording they did not agree to, so nothing on it may overstate or
 * understate what happens. Checked against the shipped behavior, August 15 2026:
 *   - The words ARE sent to an online service. Browser recognition ships audio to
 *     Google or Microsoft; the paid path ships it to Deepgram. There is no on-device
 *     option, so "an online service" is true on every configuration.
 *   - The TEXT is kept, in the conversation record on the device. The audio is not
 *     stored — speech recognition transcribes and discards it.
 *   - Nothing is spoken unless the user picks it. That is a permanent invariant.
 *   - It must NOT claim to satisfy anybody's recording-consent law. That is a matter
 *     for counsel, not for a card, and a printed card cannot obtain consent anyway —
 *     it only discloses. Say what happens; make no legal claim about it.
 * The headline is word-for-word the Express Panel's Notice button, so the spoken
 * disclosure and the printed one say the same thing.
 *
 * Ken chose the size and content (August 15 2026): 3.5in x 2.5in, eight to a sheet,
 * disclosure plus a web address so a partner who wants the detail has somewhere to go.
 *
 * ⚠ THE PAGE GEOMETRY IS EXACT AND THE MARGINS ARE WHAT MAKE IT FIT. Four rows of
 * 2.5in is 10in of cards on an 11in page, which leaves 1in for BOTH margins together.
 * Hence 0.4in top and bottom and the sheet instructions living in the header and
 * footer, which sit inside the margin rather than taking a row. Raise a margin or add
 * a line of body text above the grid and the eighth card silently moves to page two.
 * Row heights are HeightRule.EXACT for the same reason: a card that grows to fit its
 * text would push the sheet over the page.
 * ⚠ EXACT CLIPS SILENTLY, so if you lengthen the wording, open the file and look. The
 * text as written measures about 1.9in in a 2.5in card, which is why it is safe today
 * — but nothing warns you when it stops being.
 *
 * Run: node generate-partner-card-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, BorderStyle, WidthType, HeightRule,
        PageNumber, VerticalAlign } = require('docx');

// Twips (1/1440 in). The card, and the page it is cut from.
const CARD_W = 5040;   // 3.5in
const CARD_H = 3600;   // 2.5in
const COLS = 2;
const ROWS = 4;

// A hairline cut line. Visible enough to cut along, faint enough not to look like a
// border the card is meant to have.
const cut = { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" };
const cardBorders = { top: cut, bottom: cut, left: cut, right: cut,
                      insideHorizontal: cut, insideVertical: cut };

const HEADLINE = "This device listens and speaks for me.";

// Kept SHORT deliberately: a partner reads this in a second or two, mid-conversation,
// while deciding whether they mind. Anything longer goes unread, which is worse than
// saying less. The detail lives at the address on the last line.
const BODY = [
    "I use it to talk. It listens to you so it can show me what you said and suggest "
    + "replies. I choose which one, and it speaks in my voice.",
    "Your words are turned into text by an online service and kept as part of our "
    + "conversation on this device. The audio itself is not saved.",
];
const URL = "conversant.volksswitch.org";

function card() {
    return new TableCell({
        width: { size: CARD_W, type: WidthType.DXA },
        margins: { top: 170, bottom: 170, left: 200, right: 200 },
        borders: cardBorders,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                spacing: { after: 120 },
                children: [new TextRun({ text: HEADLINE, bold: true, size: 24, font: "Arial" })],
            }),
            ...BODY.map((t) => new Paragraph({
                spacing: { after: 100 },
                children: [new TextRun({ text: t, size: 16, font: "Arial" })],
            })),
            new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: URL, size: 16, font: "Arial", color: "555555" })],
            }),
        ],
    });
}

const sheet = new Table({
    width: { size: CARD_W * COLS, type: WidthType.DXA },
    borders: cardBorders,
    rows: Array.from({ length: ROWS }, () => new TableRow({
        height: { value: CARD_H, rule: HeightRule.EXACT },
        children: Array.from({ length: COLS }, () => card()),
    })),
});

const MONTH = "August 2026";

const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
        properties: {
            page: {
                // ⚠ MUST BE STATED. docx defaults to A4 (8.27in wide), and two 3.5in
                // cards plus 0.75in margins need 8.5in exactly — so on the default the
                // sheet overflowed the page width by a quarter inch and the right-hand
                // column would have been cut off by the printer. Caught by measuring
                // the generated file rather than by looking at it, which is the only
                // way this shows up before the paper does.
                size: { width: 12240, height: 15840 },   // US Letter, 8.5in x 11in
                margin: { top: 576, bottom: 576, left: 1080, right: 1080,   // 0.4in / 0.75in
                          header: 288, footer: 288 },
            },
        },
        headers: {
            default: new Header({
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({
                        text: "Conversant AAC — partner card. Print on card stock, cut along the lines. "
                            + "Eight cards per sheet, 3.5 x 2.5 inches.",
                        size: 16, color: "777777", font: "Arial",
                    })],
                })],
            }),
        },
        footers: {
            default: new Footer({
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({
                        children: ["Volksswitch.org | " + MONTH + " | For beta testers    Page ",
                                   PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
                        size: 16, color: "777777", font: "Arial",
                    })],
                })],
            }),
        },
        children: [sheet],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Partner Card.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
