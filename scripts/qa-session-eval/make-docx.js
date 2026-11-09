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
    body([new TextRun({ text: 'Kenneth R. Hackbarth  |  Volksswitch.org  |  November 2026', color: GRAY })]),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('What this is')] }),
    body('The second run of the question-session test, after your comments on the first. The app does not have this mode yet; the test asks the AI the way the app would. Same twelve questions, each asked twice (SLPs and OTs, then academics), with your ATOB article and the Product Overview as the material.'),
    body('Two sentences in the Product Overview were corrected in the copy the AI was given, and only there: what still works when the internet is gone, and what the app reads from the replies the user picked. The real document still needs those fixes.'),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('What changed since the first run')] }),
    bullet(lead('Short answer first. ', 'It now summarizes the other three, so a deeper answer can follow it.')),
    bullet(lead('No voice imitation. ', 'Your typed examples are gone. The answers are plain spoken American English.')),
    bullet(lead('"I don’t know, and I haven’t thought about it very much." ', 'This replaces "I haven’t written about it" everywhere.')),
    bullet(lead('Part of a question unanswered. ', 'Answers now say which part they can’t answer. Five of the six questions the documents only partly cover, or don’t cover, now say so.')),
    bullet(lead('Clarifying buttons. ', 'The AI names a word in the question that could be read two ways, for a "What do you mean by ...?" button. It flagged "covered" in the Medicaid question and "outcomes" in the research question, and nothing else.')),
    bullet(lead('Nothing about the audience’s work. ', '"I know funding is a huge part of your day" and its kind no longer appear.')),
    bullet(lead('Not repeating a point. ', 'The AI is told what was already said in the session and refers back instead ("as I said a moment ago"). In a real session that list would be the answers actually spoken.')),
    bullet(lead('Speed and cost. ', 'A set of four answers took 7.2 seconds in the middle case, 53 cents for all 24 sets.')),

    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Still not right')] }),
    bullet(lead('"Honest." ', 'Told never to use the word, the AI still used it twice in 96 answers ("the honest summary is"). An instruction alone does not stop it; the app would need to catch it after the answer is written.')),
    bullet(lead('"First option." ', 'The question about tapping the first option carries the idea in its own wording, and some answers still repeat it ("the first option is meant to be the most natural one"). The material calls the green option the most natural answer, and the AI treats green as "first".')),
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
    } else if ((m = line.match(/^\*Clarifying buttons: (.*)\*$/))) {
        children.push(body([new TextRun({ text: `Clarifying buttons: ${m[1]}`, italics: true })]));
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
            footerRun('Volksswitch.org  |  November 2026  |  For internal use  |  Page '),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: GRAY }),
            footerRun(' of '),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: 'Arial', color: GRAY }),
        ] })] }) },
        children,
    }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(outPath, b); console.log('wrote', outPath); });
