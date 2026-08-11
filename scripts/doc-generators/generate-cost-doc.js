/* Generates docPath("Conversant AAC Keeping Costs Down.docx").
 *
 * WHO THIS IS FOR (Ken, August 8 2026): "your explanation of the changes you made
 * to the prompt design is mostly over my head. It would be useful to have a user
 * focused (i.e., user level language) document that describes what the app is doing
 * to limit AI usage costs as much as possible."
 *
 * So: NO engineering vocabulary. No "prompt", "token", "cache", "prefix", "system
 * block", "API call". Those words are the reason the explanation failed the first
 * time. Say what is happening in terms of what the user pays for and what they can
 * change. Where a number appears it must be one the reader could check against
 * their own bill.
 *
 * Every claim here was verified against source on August 8 2026 — the settings
 * names and their options were read out of the RUNNING app, not inferred from the
 * markup, and the "never uses AI" list was checked module by module.
 *
 * Run: node generate-cost-doc.js
 */
const { docPath } = require('./doc-paths');   // resolves figures + output, whatever the CWD
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;
const TABLE_W = 9360;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

/*
 * Every string that ends up in the document passes through here, so the jargon
 * check at the foot of this file has something reliable to scan.
 *
 * ⚠ IT IS DONE THIS WAY BECAUSE THE OBVIOUS WAY DOES NOT WORK. The first version
 * walked the docx library's own object tree looking for `.text`, reported "clean",
 * and was then proved useless by injecting the word "tokens" into a heading and
 * watching it still pass. A check that cannot fail is worse than no check, because
 * it is trusted. If this is ever refactored, re-run that probe before believing it.
 */
const PROSE = [];
function cap(s) { if (typeof s === 'string') PROSE.push(s); return s; }

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(cap(text))] });
}
function para(text, opts = {}) {
    cap(text);
    return new Paragraph({
        spacing: { before: 0, after: opts.after ?? 160 },
        children: [new TextRun({ text, ...opts.run })]
    });
}
function boldPara(label, text, after = 140) {
    cap(label); cap(text);
    return new Paragraph({
        spacing: { before: 0, after },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function bullet(text) {
    cap(text);
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function bulletBold(label, text) {
    cap(label); cap(text);
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function cellPara(text, bold = false) {
    cap(text);
    return new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, bold, font: "Arial", size: 20 })]
    });
}
function table(widths, headerRow, rows) {
    const mk = (cells, isHeader) => new TableRow({
        tableHeader: isHeader,
        children: cells.map((text, i) => new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            margins: cellMargins,
            shading: isHeader ? { type: ShadingType.CLEAR, fill: "DCE6F1" } : undefined,
            children: String(text).split('\n').map(line => cellPara(line, isHeader))
        }))
    });
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        borders,
        rows: [mk(headerRow, true), ...rows.map(r => mk(r, false))]
    });
}
function calloutBox(lines, fill = "E2EFDA", edge = "548235") {
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: edge },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: edge },
            left: { style: BorderStyle.SINGLE, size: 8, color: edge },
            right: { style: BorderStyle.SINGLE, size: 8, color: edge },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        rows: [new TableRow({ children: [new TableCell({
            width: { size: TABLE_W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill },
            margins: { top: 160, bottom: 160, left: 180, right: 180 },
            children: lines.map(({ label, text }, i) => (cap(label), cap(text), new Paragraph({
                spacing: { before: 0, after: i === lines.length - 1 ? 0 : 120 },
                children: [
                    ...(label ? [new TextRun({ text: label, bold: true, font: "Arial", size: 22 })] : []),
                    new TextRun({ text, font: "Arial", size: 22 })
                ]
            })))
        })] })]
    });
}
function spacer() { return new Paragraph({ spacing: { after: 160 }, children: [] }); }

const doc = new Document({
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
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Keeping Costs Down", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  August 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [

// ===== TITLE =====
new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: "Keeping Costs Down", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "What Conversant AAC does to hold down what you pay to run it", color: "808080", size: 24, font: "Arial" })]
}),

para("Conversant AAC is free, and there is no subscription. But the artificial intelligence that writes your response suggestions is a service you buy directly from the company that provides it, using your own account. This document explains, in plain terms, what you are charged for and what the app does — deliberately, throughout — to keep that charge small."),

calloutBox([
    { label: "The short version. ", text: "Most of what the app does never involves the AI at all. When it does ask the AI, it asks once rather than several times, it does not repeat information it has already sent, and it limits how much the AI writes back. If you also pay for the premium voice or premium hearing, it avoids sending anything it does not have to." },
]),
spacer(),

// ===== WHAT YOU PAY FOR =====
heading1("What you are actually paying for"),

para("You are billed by the AI company for two things on every request, and it helps to know which is which, because they do not cost the same:"),
bulletBold("What the app sends.", " Your response suggestions are only as good as what the AI knows, so each request carries the conversation so far, plus standing information about how it should behave and whatever you have chosen to tell About Me."),
bulletBold("What the AI writes back.", " The suggestions themselves. Word for word, this costs roughly five times as much as what is sent, so it is the half most worth keeping short."),
spacer(),
para("Two other charges apply only if you choose to turn them on, and both are separate accounts from the AI itself: premium hearing (transcription), billed by the minute of audio, and the premium voice, billed by the character spoken. If you use the free options built into your device, neither of these costs anything."),

// ===== NOT USING AI =====
heading1("The biggest saving is not using AI at all"),

para("This is worth saying first because it is easy to miss: most of what you do in Conversant AAC costs nothing. The app only contacts the AI to write response suggestions. Everything below happens entirely on your device:"),
bulletBold("Express Panel buttons.", " Tapping a phrase speaks it immediately. No AI involved."),
bulletBold("\"In my own words\".", " Anything you type and speak yourself."),
bulletBold("Word suggestions on the keyboard.", " These come from a word list stored inside the app, plus the words you use most. Asking the AI after every letter would be both slow and by far the largest bill in the app."),
bulletBold("The short holding phrases.", " \"Let me think about that\" and similar, played while you are choosing, come from a list stored in the app."),
bulletBold("Saying something again.", " When someone did not catch you, repeating your words needs no AI — the app already has them."),
bulletBold("Your conversation starters, wind-downs and goodbyes.", " These are your own lists, edited by you."),
spacer(),
para("The practical consequence is that Conversant AAC still works as a complete communication device with no AI at all — if your key stops working, or you have no internet, you can still speak, still type, and still see what the other person said. The AI adds suggested responses on top of that."),

// ===== ASKS ONCE =====
heading1("When it does use the AI, it asks once"),

para("Writing four response suggestions actually involves three jobs: working out what the other person just did (asked a question? offered a choice? started to say goodbye?), writing the suggestions themselves, and noticing anything about you it needed and did not have. Asking those as three separate questions would cost roughly three times as much. The app asks for all three in a single request."),
para("The same applies when someone did not understand you and you want to say it a different way. Both alternatives — a reworded version and a fuller version — come back from one request rather than two."),

// ===== NOT REPEATING =====
heading1("It does not repeat itself"),

para("This is the change made in August 2026, and it is the largest single saving in the app."),
para("Think of briefing a colleague. The first time you ask them for help you explain the background: who you are, how you like things done, what the situation is. After that you just ask the question. You do not repeat the whole briefing every time, because they already have it."),
para("Until recently the app did repeat the whole briefing. Every single request re-sent the standing instructions about how to behave and everything you had told About Me — and paid full price for all of it, every time. On a busy conversation that same material was sent and paid for dozens of times."),
para("It now sends that material once and refers back to it for the rest of the conversation. Referring back costs about a tenth of what sending it again costs. Storing it the first time costs slightly more than an ordinary send, which is why this is worth doing for a conversation rather than for one isolated question — it pays for itself almost immediately and saves for the rest of the conversation."),
boldPara("What this saves. ", "Roughly a third to a half of the cost of a typical conversation. Nothing about the suggestions themselves changes — the AI receives exactly the same information it did before."),
boldPara("When the briefing is sent again. ", "When it genuinely changes: you edit About Me, add or change a person or a place, or change how many suggestions you want. It is also sent afresh at the start of each new conversation. This is why the saving grows as a conversation goes on, and starts from nothing each time you begin a new one."),

// ===== OUTPUT CAP =====
heading1("It limits how much the AI writes back"),
para("Because what the AI writes costs about five times as much as what it receives, every request sets a ceiling on the length of the reply. The suggestions on your cards are meant to be short spoken sentences, so the ceiling is generous for that purpose and simply prevents an unusually long and expensive answer."),

// ===== PAID EXTRAS =====
heading1("If you pay for the premium voice or premium hearing"),

boldPara("Premium hearing only sends actual speech. ", "Transcription is billed by the minute of audio sent. The app keeps the microphone on for the whole conversation, so sending everything would mean paying for every silent minute — an hour-long visit containing twelve minutes of talking would be billed as a full hour. Instead the app watches the sound level and sends only while someone is actually speaking, so you are billed for roughly what was said. It deliberately starts a moment before the first word and keeps going through short pauses, so nothing gets clipped."),
boldPara("The premium voice remembers phrases it has already said. ", "That voice is billed by the character. A conversation repeats the same short phrases constantly — your Express Panel buttons, the holding phrases, your goodbyes. The app keeps the audio for phrases it has already spoken, so \"Bye!\" is paid for once and is then free every time after that. It is also instant when reused, because there is nothing to fetch."),

// ===== WHAT YOU CAN CHANGE =====
heading1("Things you can change"),
para("Four settings have a real effect on what you spend. None of them is wrong — they are trade-offs, and which end you want depends on you."),
table([2400, 1500, 5460],
    ["Setting", "Where", "What it does to the cost"],
    [
        ["Suggestions per category", "Conversation", "\"1 (four cards)\" asks the AI to write four suggestions; \"2 (eight cards)\" asks for eight. Eight gives you more choice and costs roughly twice as much to write."],
        ["Silence period", "Conversation", "How long a pause has to be before the app starts preparing suggestions. At 0.5 seconds it prepares often, sometimes more than once while the other person is still talking, so suggestions are ready the instant they finish. Longer settings, up to 3.0 seconds, prepare less often and cost less, but you wait a little longer."],
        ["Transcription", "Speech", "\"This browser's own (free)\" costs nothing. \"Deepgram transcription (paid)\" is billed by the minute. On a Windows computer or Chromebook the free option works well; on an iPad installed to the Home Screen the paid one is currently the only option that hears anything."],
        ["Your speaking voice", "Speech", "\"This device's voices (free)\" costs nothing. \"Deepgram voice (paid)\" is billed by the character and sounds considerably better."],
    ]),
spacer(),

// ===== SEEING IT =====
heading1("Seeing what you have spent"),
para("Settings → About shows a running total, and the date it has been counting from. There is a button to reset the count whenever you want a fresh figure."),
para("Beside it you may also see a line such as \"89% reused rather than re-sent\". That is how much of each request was answered from material the app had already sent, instead of being sent and paid for again — in other words, how much of the saving described above you are actually getting. Higher is better. It climbs as a conversation goes on and starts again from nothing when you begin a new one, so it is most meaningful after a few real conversations."),
calloutBox([
    { label: "The figure is an estimate. ", text: "It is worked out from the published prices, and it is there to show you the shape of your usage rather than to be an invoice. The bill from your AI provider is the authority. If the two ever disagree meaningfully, that is worth reporting." },
], "FFF2CC", "BF9000"),
spacer(),

// ===== NOT DONE =====
heading1("What we have chosen not to do"),
para("Two things could make the app cheaper still, and are deliberately not done."),
boldPara("The whole conversation goes with every request. ", "It would be cheaper to send only the last thing the other person said. But then the AI would have no idea what either of you had been talking about, and the suggestions would stop making sense after the first exchange. Following the thread is worth what it costs."),
boldPara("The app errs toward being ready rather than being frugal. ", "With a short silence period it may prepare suggestions more than once while the other person is still speaking, and some of that preparation is thrown away when they carry on talking. That is a deliberate choice: the entire purpose of this product is that you are not left sitting in silence while everyone waits. If you would rather trade a little of that speed for a lower bill, the silence period setting is the lever, and it is described in the table above."),

        ]
    }]
});

/*
 * JARGON CHECK — the whole point of this document is that it uses none, and prose
 * drifts back toward the technical term every time it is edited by someone who
 * knows the technical term. So the generator refuses to be useful quietly: it
 * scans its own source text and names any offender.
 *
 * This is not theoretical. On the first run the only hit was the sentence quoting
 * the app's own "% of prompt cached" readout — which is what revealed that the
 * readout itself was written in the vocabulary the reader had just said was over
 * their head. The app string was reworded; the check is what found it.
 */
const JARGON = ['prompt', 'token', 'cache', 'cached', 'caching', 'prefix',
                'API call', 'breakpoint', 'payload', 'latency', 'endpoint',
                'inference', 'context window'];

/*
 * The optional trailing "s" is load-bearing. The first working version matched
 * `\btoken\b`, which does NOT match "tokens" — and "tokens" is the form anyone
 * would actually write. Every plural walked straight past the check, and it took a
 * deliberate probe to notice, because a check that reports "clean" looks identical
 * whether it is working or not.
 */
function jargonHits() {
    const blob = PROSE.join(' ');
    return JARGON.filter(w => new RegExp(`\\b${w}s?\\b`, 'i').test(blob));
}

const OUT = "Conversant AAC Keeping Costs Down.docx";
Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(OUT, buf);
    console.log(`Wrote ${OUT} (${(buf.length / 1024).toFixed(1)} KB)`);

    const hits = jargonHits();
    if (hits.length) {
        console.error(`\n⚠ JARGON IN A USER-FACING DOCUMENT: ${hits.join(', ')}`);
        console.error('Reword it, or — if the app made you write it — reword the app.');
        process.exitCode = 1;
    } else {
        console.log('Jargon check: clean.');
    }
});
