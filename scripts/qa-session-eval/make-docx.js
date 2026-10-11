// Turns a question-session results.md (written by run.mjs) into a Word document for
// Ken to read and mark up. Usage: node make-docx.js <results.md> <out.docx>
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat,
    Header, Footer, PageNumber } = require('docx');

const [mdPath, outPath] = process.argv.slice(2);
const md = fs.readFileSync(mdPath, 'utf8').replace(/\r/g, '').split('\n');

const GRAY = '808080';
const body = (text, opts = {}) => new Paragraph({ spacing: { after: 160 }, ...opts,
    children: Array.isArray(text) ? text : [new TextRun(text)] });
const bullet = (runs) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 },
    children: Array.isArray(runs) ? runs : [new TextRun(runs)] });
const lead = (b, rest) => [new TextRun({ text: b, bold: true }), new TextRun(rest)];

const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 120 },
        children: [new TextRun({ text: 'Question Session Test', bold: true, size: 40, color: '1F4E79' })] }),
    body([new TextRun({ text: 'Kenneth R. Hackbarth  |  Volksswitch.org  |  October 2026', color: GRAY })]),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('What this is')] }),
    body('This is a first test of answering audience questions after a talk, in paragraphs, from your own writing. The app does not have this mode yet. The test asked the AI the same way the app would, to see whether the answers are good enough to build it.'),
    body('The AI was given two documents: your ATOB article and the Conversant AAC Product Overview, about 22,700 words together. It was asked twelve questions, each twice: once with an audience of SLPs and OTs, and once with an audience of academics. Each time it wrote four answers: three longer answers that each take a different angle, and one short answer.'),
    body('Six of the questions are answered by the documents, three are partly covered, and three are not covered at all. The last group tests whether the AI admits it does not know instead of making something up.'),
    body('The AI had no profile of how you talk. As examples of your voice it used five sentences you typed to me on October 11. That is closer to how you speak than the article, but it is still typing.'),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('What we found')] }),
    bullet(lead('Speed. ', 'A set of four answers took 7.6 seconds in the middle case, and 4.3 to 9.5 seconds overall. Everyday suggestions take about 3 seconds. A holding phrase such as "Good question" would cover most of the wait.')),
    bullet(lead('Cost. ', 'About 2 cents for each set of four answers, 52 cents for the whole test. An hour of questions would cost well under a dollar.')),
    bullet(lead('Staying inside what you wrote. ', 'Every answer to an uncovered question said plainly that you had not written about it. Asked about Medicaid, the short answer began "I don\'t know. I haven\'t written about Medicaid or insurance coverage."')),
    bullet(lead('Audience. ', 'Answers for SLPs talked about clients and setting up. Answers for academics named the research the article cites and kept what has been measured apart from what is proposed.')),
    bullet(lead('Copying. ', 'No answer reused a whole sentence. The longest stretch of words taken straight from the documents was 10 to 19 words, mostly descriptions from the Product Overview. Those are noted beside the answers below.')),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('What to mark')] }),
    body('The one thing the test cannot judge is whether the answers sound like you. As you read, please mark:'),
    bullet('answers that sound like you'),
    bullet('answers that do not'),
    bullet('any fact that is wrong'),
];

const audienceName = { slp: 'SLPs and OTs', academics: 'academics' };
const groupName = { 'answered by the documents': 'Answered by the documents',
    'partly covered': 'Partly covered by the documents', 'not covered': 'Not covered by the documents' };

let inQuestions = false;
for (let i = 0; i < md.length; i++) {
    const line = md[i];
    let m;
    if ((m = line.match(/^## (.*)$/))) {
        inQuestions = true;
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(m[1])] }));
    } else if (!inQuestions) {
        continue;
    } else if ((m = line.match(/^\*\((.*)\)\*$/))) {
        children.push(body([new TextRun({ text: groupName[m[1]] || m[1], italics: true, color: GRAY })]));
    } else if ((m = line.match(/^### Audience: (.*?)\s+\(([\d.]+) s, \d+ output tokens, ([\d.]+)¢\)/))) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2,
            children: [new TextRun(`For ${m[1]}`)] }));
        children.push(body([new TextRun({ text: `Four answers in ${m[2]} seconds, ${Number(m[3]).toFixed(1)} cents.`, color: GRAY })]));
    } else if ((m = line.match(/^### (.*FAILED.*)$/))) {
        children.push(body(m[1]));
    } else if ((m = line.match(/^\*\*(.+?)\*\* \((angle|short), (\d+) words, copied (\d+)(?: - "(.*)")?\)$/))) {
        const kind = m[2] === 'short' ? 'short answer' : 'longer answer';
        const runs = [new TextRun({ text: m[1], bold: true }),
            new TextRun({ text: `   (${kind}, ${m[3]} words)`, color: GRAY })];
        const para = new Paragraph({ spacing: { before: 160, after: 80 }, keepNext: true, children: runs });
        children.push(para);
        if (m[5]) children.push(new Paragraph({ spacing: { after: 80 }, keepNext: true,
            children: [new TextRun({ text: `Reuses ${m[4]} words from the documents: "${m[5]}"`, italics: true, color: GRAY, size: 20 })] }));
    } else if (line.trim()) {
        children.push(body(line));
    }
}

const footerRun = (t) => new TextRun({ text: t, size: 18, font: 'Arial', color: GRAY });
const doc = new Document({
    styles: {
        default: { document: { run: { font: 'Arial', size: 22 } } },
        paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 30, bold: true, font: 'Arial', color: '1F4E79' },
                paragraph: { spacing: { before: 320, after: 180 }, keepNext: true, outlineLevel: 0 } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { size: 26, bold: true, font: 'Arial', color: '1F4E79' },
                paragraph: { spacing: { before: 220, after: 140 }, keepNext: true, outlineLevel: 1 } },
        ],
    },
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
        properties: { page: { size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Conversant AAC — Question Session Test', italics: true, color: GRAY, size: 18, font: 'Arial' })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
            footerRun('Volksswitch.org  |  October 2026  |  For internal use  |  Page '),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: GRAY }),
            footerRun(' of '),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: 'Arial', color: GRAY }),
        ] })] }) },
        children,
    }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(outPath, b); console.log('wrote', outPath); });
