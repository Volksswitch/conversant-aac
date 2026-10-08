/* Generates docPath("Conversant AAC Layout Review.docx") - the keyboard and Express
 * Panel layouts trimmed to the shapes that are actually different, drawn side by side
 * for Ken to review (October 8 2026). Prompted by a tall Android phone, where the
 * ten-across bottom layout leaves the buttons very narrow.
 *
 * Figures and the across/down/button counts come from capture-layout-review-figures.mjs,
 * which reads the app's own layouts. Run that first, then this.
 *
 * Run: node generate-layout-review-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
        WidthType, ShadingType, PageNumber, ImageRun } = require('docx');

const facts = JSON.parse(fs.readFileSync('layout-review-facts.json', 'utf8'));
const byId = Object.fromEntries(facts.map((f) => [f.id, f]));

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const heading1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(t)] });
const heading2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(t)] });
const para = (t) => new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(t)] });
const lead = (l, t) => new Paragraph({ spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: l, bold: true }), new TextRun(t)] });
const bullet = (l, t) => new Paragraph({ numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 0, after: 100 },
    children: l ? [new TextRun({ text: l, bold: true }), new TextRun(t)] : [new TextRun(t)] });

// All figures are drawn at one width and shown at one width, so button widths compare
// directly across the whole document.
let figNo = 0;
function figure(id, caption) {
    const f = byId[id];
    const k = 500 / f.size[0];
    figNo += 1;
    return [
        new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER, keepNext: true,
            children: [new ImageRun({ type: 'png', data: fs.readFileSync(f.fig + '.png'),
                transformation: { width: 500, height: Math.round(f.size[1] * k) } })] }),
        new Paragraph({ spacing: { before: 0, after: 240 }, alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Figure ${figNo}. ${caption}`, italics: true, size: 18, color: '666666' })] }),
    ];
}

function table(headers, rows, widths) {
    const cell = (text, w, head) => new TableCell({
        width: { size: w, type: WidthType.DXA }, margins: cellMargins,
        shading: head ? { type: ShadingType.CLEAR, fill: 'D5E8F0' } : undefined,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: !!head })] })] });
    return new Table({ width: { size: 9360, type: WidthType.DXA }, borders, rows: [
        new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
        ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, widths[i])) })) ] });
}

// Button width compared with Bottom Layout 2 (ten across), the layout on Ken's phone.
const wider = (across) => {
    const x = 10 / across;
    return Math.abs(x - 1) < 0.05 ? 'the same' : `${x.toFixed(1)} times as wide`;
};
const shape = (id) => `${byId[id].across} × ${byId[id].down}`;

const LAYOUTS = [
    { id: 'S6',  name: 'Alphabet', was: 'Side Layout 6',
      note: 'The widest buttons of any layout. Three letters to a row means eleven rows, so this one only makes sense where height is plentiful, like a phone held upright.' },
    { id: 'S2',  name: 'Alphabet', was: 'Side Layout 2',
      note: 'Four across. The space bar has a whole row to itself.' },
    { id: 'S1',  name: 'Alphabet', was: 'Side Layout 1',
      note: 'Five across, which puts the alphabet in neat blocks of five. Four other layouts share this exact shape; see section 5.' },
    { id: 'S7',  name: 'Alphabet down the columns', was: 'Side Layout 7',
      note: 'The same shape as the one above, with the alphabet running down each column instead of across each row. Kept for people who find letters easier to find that way. On the Express Panel the two look the same.' },
    { id: 'QW5', name: 'QWERTY in halves', was: 'New, not in the app',
      note: 'New, and not in the app yet. Section 6 shows it beside the standard QWERTY.' },
    { id: 'S8',  name: 'Alphabet, wide punctuation', was: 'Side Layout 8',
      note: 'The only layout with buttons of more than one width in its letter area: the comma, period and Enter take two columns each.' },
    { id: 'S10', name: 'Alphabet with numbers', was: 'Side Layout 10',
      note: 'Adds two rows of digits, which gives the Express Panel 41 buttons instead of 32.' },
    { id: 'S3',  name: 'Alphabet', was: 'Side Layout 3',
      note: 'Six across and six down, the squarest of the layouts.' },
    { id: 'B4',  name: 'Alphabet', was: 'Bottom Layout 4',
      note: 'Today the narrowest choice for the bottom of the screen.' },
    { id: 'B1',  name: 'Alphabet', was: 'Bottom Layout 1',
      note: 'Nine across. Three other layouts share this shape; see section 5.' },
    { id: 'B8',  name: 'Alphabet split in two', was: 'Bottom Layout 8',
      note: 'Two blocks with an empty column between them, one block for each hand. Each block has its own space bar.' },
    { id: 'B2',  name: 'Alphabet', was: 'Bottom Layout 2',
      note: 'The layout on the phone that prompted this review. Every width in this document is compared with it.' },
    { id: 'B9',  name: 'Alphabet with numbers', was: 'Bottom Layout 9',
      note: 'Adds a row of digits on top, which gives the Express Panel 42 buttons.' },
    { id: 'B11', name: 'QWERTY', was: 'Bottom Layout 11 (QWERTY)',
      note: 'The standard typing arrangement, and the default for the bottom of the screen.' },
    { id: 'B3',  name: 'Alphabet', was: 'Bottom Layout 3',
      note: 'The shortest layout: half the alphabet on each of two rows. The narrowest buttons in the list.' },
];

const children = [
    new Paragraph({ spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: 'Conversant AAC', bold: true, size: 44, color: '1F4E79' })] }),
    new Paragraph({ spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: 'Layout Review', bold: true, size: 32, color: '444444' })] }),
    new Paragraph({ spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: 'The keyboard and Express Panel layouts, trimmed to the shapes that are actually different', italics: true, size: 24, color: '555555' })] }),
    new Paragraph({ spacing: { before: 0, after: 320 },
        children: [new TextRun({ text: 'Kenneth R. Hackbarth  |  Volksswitch.org  |  October 2026  |  Last updated October 8, 2026', size: 20, color: '808080' })] }),

    heading1('1. What This Is For'),
    para('On a tall Android phone held upright, the Express Panel buttons come out very narrow. The phone has plenty of height and very little width, and the layout in use puts ten buttons across. The fix is a layout with fewer columns and more rows.'),
    para('Those layouts already exist. They are the side layouts, and the app only offers them when the keyboard sits at the side of the screen. This document lays out every layout that has a different shape, so you can choose which ones to keep before they are offered on both sides.'),
    para('The proposal behind it has three parts. Every layout is offered whichever side of the screen the keyboard is on. Each layout gets a name that says what it looks like. And layouts that only repeat another shape are removed.'),

    heading1('2. How to Read the Figures'),
    bullet('Same width, same row height. ', 'Every figure is drawn at the same width with rows of the same height, so you can compare how wide the buttons are by eye, from one figure to the next.'),
    bullet('Real buttons will be taller or shorter. ', 'In the app, button height depends on the button size setting and on how much room the screen has. The figures keep it fixed so that width is the only thing that changes.'),
    bullet('The dark button is the space bar. ', 'On the Express Panel the same position holds the "In my own words" button.'),
    bullet('Gray buttons are actions. ', 'They are Shift, Backspace, Enter, and 123, which opens the numbers and symbols.'),
    bullet('The Express Panel uses the same grid. ', 'Every letter and action key becomes a phrase button, so the button count in each name is how many Express Panel buttons the layout gives you.'),

    heading1('3. The Names'),
    para('Each name gives the letter arrangement, then the number of buttons across, then the number down. "Alphabet, 5 × 7" means the alphabet in order, five buttons across and seven rows down. The app would work these numbers out from the layout itself, so a name can never go out of date. If you are already using a layout, your choice carries over to its new name.'),

    heading1('4. Summary'),
    para('Width is compared with Bottom Layout 2, the ten-across layout on the phone.'),
    table(['Name', 'Buttons', 'Button width', 'Today'],
        LAYOUTS.map((l) => [`${l.name}, ${shape(l.id)}`, String(byId[l.id].buttons), wider(byId[l.id].across), l.was]),
        [3300, 1100, 2160, 2800]),
    new Paragraph({ spacing: { before: 0, after: 160 }, children: [] }),
];

LAYOUTS.forEach((l, i) => {
    children.push(heading2(`4.${i + 1} ${l.name}, ${shape(l.id)}`));
    children.push(lead(`${byId[l.id].buttons} buttons. Button width: ${wider(byId[l.id].across)} Bottom Layout 2. `, l.note));
    children.push(...figure(l.id, `${l.name}, ${shape(l.id)}`));
});

children.push(
    heading1('5. What Was Left Out'),
    para('These layouts have the same shape as one that was kept. On the Express Panel they would look the same, because the panel only uses the grid. They differ only in where the space bar, Shift and Enter sit, or in the order of the letters.'),
    table(['Layout', 'Same shape as', 'The difference'], [
        ['Bottom Layout 10', 'Alphabet, 9 × 4', 'None. It is an exact copy of Bottom Layout 1.'],
        ['Bottom Layout 5', 'Alphabet, 9 × 4', 'A shorter space bar, with two empty spaces in the bottom row.'],
        ['Bottom Layout 6', 'Alphabet, 9 × 4', 'A second Backspace in the bottom row.'],
        ['Bottom Layout 7', 'Alphabet, 10 × 4', 'The space bar sits at the right of the bottom row, after y and z.'],
        ['Side Layout 4', 'Alphabet, 6 × 6', 'The action keys run down the right-hand column.'],
        ['Side Layout 5', 'Alphabet, 5 × 7', 'A shorter space bar and an empty space.'],
        ['Side Layout 9', 'Alphabet, 5 × 7', 'A double-width Backspace in the bottom row.'],
    ], [2400, 2400, 4560]),
    new Paragraph({ spacing: { before: 0, after: 160 }, children: [] }),

    heading1('6. A Narrow QWERTY'),
    para('Somebody who touch-types wants QWERTY. Today the only QWERTY layout is 12 across, which on a phone gives buttons narrower than the layout that started this review.'),
    para('The narrow QWERTY puts the left-hand half of the keyboard on top and the right-hand half underneath, in five columns. Each half keeps its familiar shape, so q, a and z still line up down the left edge, and y, h and n line up below them.'),
    para('Here it is above the standard QWERTY, so the two can be compared key by key.'),
    ...figure('QW5', 'QWERTY in halves, 5 × 7'),
    ...figure('B11', 'QWERTY, 12 × 3, for comparison'),
    para('It is a landscape arrangement squeezed into a portrait shape. It is offered for people who type on QWERTY and use a narrow screen.'),

    heading1('7. Decisions'),
    para('Decided October 8 2026: all fifteen layouts in section 4 are kept, including the narrow QWERTY and the alphabet running down the columns. The remaining layouts in section 5 are removed, and anybody using one moves to the kept layout of the same shape.'),
);

const doc = new Document({
    styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
        paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 30, bold: true, font: 'Arial', color: '1F4E79' },
                paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 0, keepNext: true } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 26, bold: true, font: 'Arial', color: '1F4E79' },
                paragraph: { spacing: { before: 220, after: 140 }, outlineLevel: 1, keepNext: true } },
        ],
    },
    numbering: { config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
            alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ] },
    sections: [{
        properties: { page: { size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Conversant AAC — Layout Review', italics: true, color: '808080', size: 18 })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: 'Volksswitch.org  |  October 2026  |  For internal use  |  Page ', size: 18, color: '808080' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '808080' }),
            new TextRun({ text: ' of ', size: 18, color: '808080' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '808080' }),
        ] })] }) },
        children,
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath('Conversant AAC Layout Review.docx');
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out);
});
