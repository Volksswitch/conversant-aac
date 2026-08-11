/* Regenerates the Worldview Test Persona documents in Other/Personas/ so each one
 * is organized exactly like About Me: the same four sections in the same order
 * (Topics, People, Places, How I Sound), the same question wording (pulled live
 * from app/data/worldview-questions.json so it can never drift), and answers in
 * the same form the app actually stores them (a single "Very much like me"-style
 * choice, a comma-separated list for a free-multi field, etc.).
 *
 * Content that has no matching About Me property today — register/style prose,
 * catchphrases, greetings, "how you say no", self-description words, the old
 * passions follow-up notes — is left out entirely (Ken, August 10 2026), not
 * moved to an appendix. Where a field already lined up 1:1 with the source
 * document, the wording is carried over unchanged.
 *
 * Run: node generate-persona-docs.js
 */
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');

const REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'app/data/worldview-questions.json'), 'utf8'));

// ============================================================================
// Sound Check item bank — mirrors app/js/sound-check-items.js (August 7 2026).
// Kept as a plain copy here (rather than imported) because that file is an ES
// module used by the browser build; this generator runs under CommonJS.
// ============================================================================
const SOUND_CHECK_ITEMS = [
    { id: 'economy-weekend', stipulate: 'Suppose your weekend was a good one.', partner: 'How was your weekend?',
      candidates: ['Good, thanks.', 'Good, thanks. Quiet one.', 'It was good, thanks — quiet, but that suited me.'] },
    { id: 'economy-decided', stipulate: 'Suppose you have not made your mind up yet.', partner: 'Have you thought any more about what you want to do?',
      candidates: ['Not properly yet, no — I keep meaning to sit down and work it out.', 'Not properly yet, no.', 'Not yet.'] },
    { id: 'economy-queue', stipulate: 'Suppose you do not mind waiting.', partner: "There's a bit of a queue today, I'm afraid.",
      candidates: ["That's fine, no rush.", "That's fine.", "That's fine — I'm in no particular hurry."] },
    { id: 'formality-late', stipulate: 'Suppose you are not annoyed about it.', partner: "Sorry I'm late.",
      candidates: ['That is quite all right. Please don\'t worry.', "That's all right, don't worry about it.", 'No worries.'] },
    { id: 'formality-sit', stipulate: 'Suppose you would like to sit down.', partner: 'Would you like to sit down?',
      candidates: ['Yeah, thanks.', 'Yes please, thanks.', 'Thank you, I would.'] },
    { id: 'affect-coffee', stipulate: 'Suppose you are pleased about it.', partner: 'I brought you a coffee.',
      candidates: ['Oh, lovely. Thanks.', "Thanks, that's kind of you.", "That's really thoughtful, thank you."] },
    { id: 'affect-finished', stipulate: 'Suppose this is good news to you.', partner: "I've finished that thing you asked about.",
      candidates: ["Oh good, I'm really pleased. Thank you.", "That's great news, thank you.", 'Great, thanks.'] },
    { id: 'floor-busy', stipulate: 'Suppose your week has been busy too.', partner: "It's been a busy week.",
      candidates: ['Same here.', 'Same here. Busy with what?', 'Same here — how are you coping?'] },
    { id: 'floor-trip', stipulate: 'Suppose you are glad to hear it.', partner: "I've just got back from a trip.",
      candidates: ['Oh, whereabouts?', 'That sounds nice. Where did you go?', 'That sounds nice.'] },
    { id: 'floor-decision', stipulate: 'Suppose you think it is a big decision.', partner: "I'm thinking of changing jobs.",
      candidates: ["That's a big decision.", "That's a big decision. What's brought that on?", "That's a big decision — how are you feeling about it?"] },
    { id: 'warmth-next-week', stipulate: 'Suppose you are happy to see them again.', partner: "I'll see you next week, then.",
      candidates: ['See you then.', 'See you then, take care.', 'See you then — looking forward to it.'] },
    { id: 'warmth-let-you-go', stipulate: 'Suppose you have enjoyed the conversation.', partner: 'Right, I should let you go.',
      candidates: ['It was really good to talk to you. Take care.', 'Good to talk to you. Bye.', 'Okay, bye.'] },
    { id: 'initiate-opener', stipulate: 'Suppose you want to start a conversation with someone you know.',
      candidates: ['Hi.', 'Hi, how are you?', 'Hi - good to see you. How have you been?'] },
    { id: 'initiate-help', stipulate: 'Suppose you need someone to help you with something.',
      candidates: ['Can you help me?', 'Would you mind helping me?', "I don't suppose you could help me?"] },
    { id: 'initiate-slow-down', stipulate: 'Suppose you want the other person to slow down.',
      candidates: ['Would you mind slowing down a little?', 'Could you slow down a bit?', 'Slow down a bit, please.'] },
    { id: 'initiate-disagree', stipulate: 'Suppose you do not agree with what is being suggested.',
      candidates: ["I'm not sure about that.", "I'm not convinced, to be honest.", "I don't think so, no."] },
    { id: 'initiate-leaving', stipulate: 'Suppose you need to bring the conversation to an end.',
      candidates: ["Right, I'd better go.", 'I should get going.', 'I should get going - this has been lovely.'] },
    { id: 'levity-dontknow', stipulate: 'Suppose you genuinely do not know the answer.', partner: 'Do you happen to know what year that happened?',
      candidates: ["No, I don't know that one.", "No idea, I'm afraid.", 'Not a clue. That one left my head a long time ago.'] },
    { id: 'levity-mishap', stipulate: 'Suppose you have just knocked something over, and no harm is done.', partner: 'Oh — are you all right?',
      candidates: ['Well, that went beautifully.', "Fine, thanks. Not my finest moment.", "Fine, thanks. Sorry about that."] },
    { id: 'levity-late', stipulate: 'Suppose you have been kept waiting a while and you do not really mind.', partner: "Sorry, I've kept you waiting ages.",
      candidates: ["It's fine, honestly.", "It's fine - I had nowhere better to be.", "It's fine. I was starting to plan my escape, mind you."] },
];
function questionFor(item) {
    return item.partner
        ? 'Which of these sounds most like something you would say in response?'
        : 'Which of these sounds most like something you would say?';
}

// ============================================================================
// docx helpers (house style — matches generate-sounds-like-me-doc.js)
// ============================================================================
const PAGE_W = 12240;
const MARGIN = 1440;
const TABLE_W = 9360;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function para(text, opts = {}) {
    return new Paragraph({
        spacing: { before: 0, after: opts.after ?? 160 },
        children: [new TextRun({ text, ...opts.run })]
    });
}
function boldPara(label, text, after = 140) {
    return new Paragraph({
        spacing: { before: 0, after },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function bullet(text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

function cellPara(text, bold = false) {
    return new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: String(text), bold, font: "Arial", size: 20 })]
    });
}
function table(widths, headerRow, rows) {
    const mk = (cells, isHeader) => new TableRow({
        tableHeader: isHeader,
        children: cells.map((text, i) => new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            margins: cellMargins,
            shading: isHeader ? { type: ShadingType.CLEAR, fill: "DCE6F1" } : undefined,
            children: String(text).split('\n').map((line) => cellPara(line, isHeader))
        }))
    });
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        borders,
        rows: [mk(headerRow, true), ...rows.map((r) => mk(r, false))]
    });
}

// ============================================================================
// Registry-driven rendering — the wording always comes from the JSON, never
// retyped, so a future change to the questionnaire cannot leave a persona
// document quoting a question the app no longer asks.
// ============================================================================
function fmtAnswer(value) {
    if (Array.isArray(value)) return value.join(', ');
    return value;
}

function renderTopicsSection(topics) {
    const children = [heading1('Topics'),
        para('The same modules About Me groups its questions into, in the same order, with each question exactly as About Me asks it. A field the source material did not answer is left out, the same way an unanswered question simply has no card state in the app.')];
    for (const mod of REGISTRY.modules) {
        const rows = [];
        for (const field of mod.fields) {
            const v = topics[field.key];
            if (v === undefined || v === null || v === '') continue;
            rows.push([field.q, fmtAnswer(v)]);
        }
        if (!rows.length) continue;
        children.push(heading2(`${mod.id} — ${mod.title}`));
        if (mod.note) children.push(para(mod.note, { run: { italics: true, color: "595959", size: 20 } }));
        children.push(table([3200, 6160], ['Question', 'Answer'], rows));
        children.push(emptyPara());
    }
    return children;
}

function renderPeopleSection(people) {
    const children = [heading1('People'),
        para('Not a set of questions — the People editor in About Me, one entry per person, each with the same fields the editor asks for: a name, an optional nickname, their relationship to the user, whether they live with the user, anything worth knowing, and whether they are marked private.'),
        table([1300, 1300, 1700, 1150, 2860, 900],
            ['Name', 'Nickname', 'Relationship', 'Lives with me', 'Anything worth knowing', 'Private'],
            people.map((p) => [p.name, p.nickname || '—', p.relationship || '—',
                p.livesWithMe ? 'Yes' : 'No', p.about || '—', p.private ? 'Yes' : 'No'])),
        emptyPara()];
    return children;
}

function renderPlacesSection(places) {
    const children = [heading1('My Places'),
        para('The My Places editor in About Me: a name per place, plus as many "What / Is" facts as the user chooses to record, and whether the place is marked private.')];
    for (const pl of places) {
        children.push(heading2(pl.name + (pl.private ? '  [PRIVATE]' : '')));
        children.push(table([3200, 6160], ['What', 'Is'], pl.facts.map((f) => [f.key, f.value])));
        children.push(emptyPara());
    }
    return children;
}

function renderSoundCheckSection(picks, neverSay) {
    const children = [heading1('How I Sound'),
        para('The How I Sound module in About Me. Each item shows a few ways of saying the same thing; the one picked below is the one marked with a checkmark. This is a forced choice among the app\'s own hand-written candidate sentences, not a transcription of anything the person actually says — so the wording of the pick will not always match a catchphrase elsewhere in this document, and that is expected.')];
    let seenInitiating = false;
    for (const item of SOUND_CHECK_ITEMS) {
        if (!item.partner && !seenInitiating) {
            seenInitiating = true;
            children.push(heading2('When you start things off'));
            children.push(para('These are not replies — nobody has said anything yet.', { run: { italics: true, color: "595959", size: 20 }, after: 100 }));
        }
        const pick = picks[item.id];
        children.push(boldPara('', item.stipulate, 60));
        if (item.partner) children.push(para(`They said: "${item.partner}"`, { run: { italics: true, size: 20 }, after: 60 }));
        children.push(para(questionFor(item), { run: { bold: true, size: 20 }, after: 80 }));
        item.candidates.forEach((c, i) => {
            const chosen = pick === i;
            children.push(new Paragraph({
                spacing: { before: 0, after: 40 },
                indent: { left: 260 },
                children: [new TextRun({ text: (chosen ? '✓  ' : '     ') + c, bold: chosen })]
            }));
        });
        if (pick === 'ALL_FINE') children.push(para('✓  They all sound like me', { run: { italics: true, size: 20 }, after: 40 }));
        if (pick === 'NONE') children.push(para("✓  I wouldn't say any of these", { run: { italics: true, size: 20 }, after: 40 }));
        children.push(emptyPara());
    }
    children.push(heading2('Things I never say'));
    if (neverSay && neverSay.length) {
        for (const n of neverSay) children.push(bullet(n));
    } else {
        children.push(para('Not given in the source material.', { run: { italics: true, color: "595959", size: 20 } }));
    }
    children.push(emptyPara());
    return children;
}

// ============================================================================
// Document assembly for one persona
// ============================================================================
function buildDoc(p) {
    return new Document({
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
            config: [
                { reference: "bullets",
                    levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            ]
        },
        sections: [{
            properties: { page: { size: { width: PAGE_W, height: 15840 },
                margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
            headers: { default: new Header({ children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `Worldview Test Persona — ${p.displayName}`, italics: true, color: "808080", size: 18, font: "Arial" })]
            })] }) },
            footers: { default: new Footer({ children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: "Volksswitch.org  |  August 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                    new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
                ]
            })] }) },
            children: [
                new Paragraph({ spacing: { before: 240, after: 80 },
                    children: [new TextRun({ text: 'Worldview Test Persona', bold: true, color: "1F4E79", size: 40, font: "Arial" })] }),
                new Paragraph({ spacing: { before: 0, after: 60 },
                    children: [new TextRun({ text: p.displayName, italics: true, color: "595959", size: 24, font: "Arial" })] }),
                new Paragraph({ spacing: { before: 0, after: 240 },
                    children: [new TextRun({ text: 'A synthetic profile for testing the AI-Enabled AAC worldview collection feature', color: "808080", size: 20, font: "Arial" })] }),

                heading2('About this document'),
                para(`This is a fictional individual created so the worldview collection feature can be tested with someone other than yourself. ${p.name} is not a real person; any resemblance to a real person is coincidental.`),
                para('This edition is organized to match About Me exactly — the same four sections in the same order (Topics, People, Places, How I Sound), the same question wording, and answers in the same form the app actually stores them. Content that has no matching About Me property today — how the person talks, catchphrases, greetings, self-description words — has been left out rather than kept as background, so nothing here claims to be a field the app does not have.'),
                para('Fields the questionnaire marks private by default — contact info (A5) and beliefs (B5) — are filled in for completeness and flagged [PRIVATE]. Private means the assistant receives these for context but never volunteers them; one is spoken only if the user selects a response that includes it, or asks for it themselves. Where the source material explicitly declines to give a value (for instance, a political leaning kept to themselves), that field is marked "Prefer not to say" — the app\'s own decline state, which withholds the value from the assistant entirely.'),

                heading2(`Who ${p.name} is (quick read)`),
                ...p.quickRead.map((t) => para(t)),

                ...renderTopicsSection(p.topics),
                ...renderPeopleSection(p.people),
                ...renderPlacesSection(p.places),
                ...renderSoundCheckSection(p.soundCheck, p.neverSay),
            ]
        }]
    });
}

module.exports = { buildDoc, SOUND_CHECK_ITEMS, questionFor };
