/* Generates docPath("Conversant AAC Layout Suggestions.docx") - suggested starting
 * layouts for each screen shape, including how much of the screen each of the four
 * panes gets (Ken, October 8 2026). For review; nothing here is built.
 *
 * Figures and every number in the text come from capture-layout-suggestion-figures.mjs.
 * Run that first, then this.
 *
 * Run: node generate-layout-suggestions-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
        WidthType, ShadingType, PageNumber, ImageRun } = require('docx');

const S = JSON.parse(fs.readFileSync('layout-suggestion-facts.json', 'utf8'));
const pct = (x) => Math.round(x * 100) + '%';

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const heading1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(t)] });
const heading2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(t)] });
const para = (t) => new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(t)] });
const bullet = (l, t) => new Paragraph({ numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 0, after: 100 },
    children: l ? [new TextRun({ text: l, bold: true }), new TextRun(t)] : [new TextRun(t)] });

let figNo = 0;
function figure(s) {
    // Portrait screens are shown narrower so the page is not one tall picture.
    const maxW = s.size[0] < s.size[1] ? 300 : 600;
    const k = maxW / s.size[0];
    figNo += 1;
    return [
        new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER, keepNext: true,
            children: [new ImageRun({ type: 'png', data: fs.readFileSync(s.fig + '.png'),
                transformation: { width: maxW, height: Math.round(s.size[1] * k) } })] }),
        new Paragraph({ spacing: { before: 0, after: 240 }, alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Figure ${figNo}. ${s.title}`, italics: true, size: 18, color: '666666' })] }),
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

const NOTES = {
    'ls-1': [
        'This is the setup for a phone like the one that prompted the review. The Express Panel takes almost half the screen, because on a phone it holds the buttons the user taps most and there is plenty of height to give it.',
        'Today on this phone the Express Panel buttons are about 37 points wide. Here they are about twice that.',
        'The Command Bar buttons are the narrowest on the screen. They show icons rather than words, so they still work at this width.',
    ],
    'ls-2': [
        'An iPad or other tablet held upright. With more width than a phone, six across still gives wide buttons, so the Express Panel needs less of the height.',
        'The transcript gets a quarter of the screen, which is room for several turns of the conversation.',
    ],
    'ls-3': [
        'A Surface or iPad on its side, with the keyboard down one edge. This matches the app’s current side layout, except that the response options are two by two with New 4 underneath.',
        'The Express Panel buttons come out taller than they are wide, because a sideways tablet has more height in that column than the buttons need. Six across would make them squarer.',
    ],
    'ls-4': [
        'The same tablet with the keyboard along the bottom, for somebody who types on QWERTY. These are the app’s current proportions, and the response options stay in one row.',
        'In one row each option is a quarter of the width. That works on a wide screen and is what goes wrong on a phone.',
    ],
    'ls-5': [
        'A phone on its side is the tightest of the five. There is so little height that only a keyboard at the side works, and the transcript has room for about three lines.',
        'It is included so a user who turns the phone gets something usable. For a phone, upright is the better choice, and the orientation setting in section 5 is what holds it there.',
    ],
};

const children = [
    new Paragraph({ spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: 'Conversant AAC', bold: true, size: 44, color: '1F4E79' })] }),
    new Paragraph({ spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: 'Layout Suggestions', bold: true, size: 32, color: '444444' })] }),
    new Paragraph({ spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: 'Suggested starting layouts for phones and tablets, held upright or on their side', italics: true, size: 24, color: '555555' })] }),
    new Paragraph({ spacing: { before: 0, after: 320 },
        children: [new TextRun({ text: 'Kenneth R. Hackbarth  |  Volksswitch.org  |  October 2026  |  Last updated October 8, 2026', size: 20, color: '808080' })] }),

    heading1('1. What This Is For'),
    para('Setting up the conversation screen means choosing where the keyboard sits, which layout it uses, how the response options are arranged, and how much of the screen each part gets. That is a lot to decide before you know the app. This document suggests a starting point for each common screen shape.'),
    para('A suggestion is offered, not applied. The user picks one or skips, and every part of it stays an ordinary setting they can change later. The app never switches to a different suggestion by itself.'),
    para('Each suggestion has a picture drawn at the device’s real size with the app’s real text size, so the buttons and words look the way they would on the screen.'),

    heading1('2. The Four Panes'),
    para('The conversation screen has four parts. Each needs something different, and that is what decides how big it should be.'),
    bullet('Express Panel. ', 'It has the most buttons and gets the most taps, and its buttons are the size the rest of the app follows. It gets the biggest share on a screen held upright.'),
    bullet('Response options. ', 'Four large targets, each showing the full wording, which can run to about fifteen words. They need width for the words more than height. Two by two gives each option half the width instead of a quarter.'),
    bullet('Command Bar. ', 'One row of nine icon buttons. It gets about the height of one row of Express Panel buttons. More than that would only make the icons taller.'),
    bullet('Transcript. ', 'It is read, never tapped, so it takes what is left. It should never drop below about three lines.'),
    para('The suggestions start from the Express Panel: enough height for its rows at a comfortable button size. The Command Bar gets one row of the same height, and the response options about a third of the screen. The transcript gets the rest.'),
    para('A point, used for the sizes below, is the unit screens use for layout. On most phones and tablets 100 points is about two thirds of an inch.'),

    heading1('3. Summary'),
    para('For the two sideways layouts with the keyboard at the side, the Express Panel figure is a share of the width. The other three figures are shares of the height of the column beside it.'),
    table(['Screen', 'Keyboard', 'Layout', 'Options', 'Transcript', 'Command Bar', 'Options', 'Express Panel'],
        S.map((s) => [s.title, s.dock === 'side' ? 'Side' : 'Bottom', s.layoutName,
            s.options === '2x2' ? '2 by 2' : 'One row', pct(s.t), pct(s.c), pct(s.r),
            pct(s.e) + (s.dock === 'side' ? ' of width' : '')]),
        [1700, 900, 1400, 900, 1100, 1100, 1000, 1260]),
    new Paragraph({ spacing: { before: 0, after: 160 }, children: [] }),

    heading1('4. The Suggestions'),
];

S.forEach((s, i) => {
    children.push(heading2(`4.${i + 1} ${s.title}`));
    for (const n of NOTES[s.fig]) children.push(para(n));
    children.push(bullet('Express Panel button: ', `${s.ep[0]} by ${s.ep[1]} points, ${s.layoutName}.`));
    children.push(bullet('Each response option: ', `${s.opt[0]} by ${s.opt[1]} points.`));
    children.push(bullet('Command Bar button: ', `${s.cmd[0]} by ${s.cmd[1]} points.`));
    children.push(...figure(s));
});

children.push(
    heading1('5. How the Suggestions Would Be Offered'),
    bullet('At setup. ', 'The app knows the shape of the screen, so it shows the suggestions that fit it as small pictures. The user taps one or skips. On a tablet that means two sideways choices and one upright; on a phone, upright first.'),
    bullet('From Settings, any time. ', 'The same pictures sit beside the layout settings, so a user can start again from a suggestion later.'),
    bullet('Everything stays adjustable. ', 'Picking a suggestion sets the dock, the layout, the response options arrangement and the four proportions. Each can then be changed on its own, and the borders between the panes can still be dragged.'),
    bullet('Turning the device. ', 'Turning a device doesn’t switch suggestions. The app keeps the same choices and fits them to the new shape, as it does today.'),
    bullet('Holding the screen still. ', 'A "Screen orientation" setting would keep the screen upright or sideways. On Android it can hold the screen in place when the app is installed or full screen. On an iPad it can only point the user to the iPad’s own rotation lock. On a Windows tablet it hasn’t been tested yet.'),
    bullet('The keyguard. ', 'A suggestion is a starting point. A keyguard is cut after the user has settled on their layout, from the Keyguard Design tab, as it is today.'),

    heading1('6. What Changes the Numbers'),
    bullet('A bigger button size. ', 'If the user turns button size up, the Express Panel grows and the transcript gives up the room.'),
    bullet('Two options per kind. ', 'With eight response options instead of four, each option is half as tall. On the upright phone that makes them about 50 points tall, which is tight for longer wording.'),
    bullet('A different layout. ', 'Choosing a layout with more rows makes the Express Panel buttons shorter at the same share of the screen. The suggestion would need its Express Panel share raised to match.'),

    heading1('7. Decisions'),
    bullet('', 'Whether these five screens are the right set, and whether a phone on its side should be offered.'),
    bullet('', 'The four proportions for each screen.'),
    bullet('', 'Which layout each suggestion uses. For example, the upright phone could start on Alphabet, 5 × 7 or QWERTY in halves, 5 × 7.'),
    bullet('', 'Whether New 4 goes under the two-by-two options on a sideways tablet too, so it sits in the same place wherever the options are two by two.'),
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
            children: [new TextRun({ text: 'Conversant AAC — Layout Suggestions', italics: true, color: '808080', size: 18 })] })] }) },
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
    const out = docPath('Conversant AAC Layout Suggestions.docx');
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out);
});
