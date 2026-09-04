const { docPath } = require('./doc-paths');   // resolves figures + output, whatever the CWD
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// keepNext goes on the PARAGRAPH, not on the paragraph style: setting it in the style
// definition is silently ignored, and the checker then reports every heading as able to
// be stranded at the foot of a page (rule S3).
function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true,
        children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true,
        children: [new TextRun(text)] });
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
function bullet(text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function bulletBold(label, text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

// Mono examples, lightly shaded.
function mono(text) {
    return new TextRun({ text, font: "Consolas", size: 20, color: "333333" });
}

// headers: [str]; rows: [[cell]] where cell is str or {text, mono}; widths: twips summing ~9360
function simpleTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true, size: 20 })] })]
    });
    const bodyCell = (cell, w) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const text = isObj ? cell.text : cell;
        const run = isObj && cell.mono
            ? new TextRun({ text, font: "Consolas", size: 19, color: "333333" })
            : new TextRun({ text, size: 20 });
        return new TableCell({
            width: { size: w, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [run] })]
        });
    };
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders,
        rows: [
            new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
            ...rows.map(r => new TableRow({ children: r.map((c, i) => bodyCell(c, widths[i])) }))
        ]
    });
}

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
            { reference: "numbers",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Shaping Speech Through Text", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  June 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            // ===== TITLE =====
            new Paragraph({
                spacing: { before: 240, after: 80 },
                children: [new TextRun({ text: "Shaping Speech Through Text", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "What Text Can and Cannot Do About the Way a Voice Says Something", italics: true, color: "595959", size: 24, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  June 2026  |  Last updated September 4, 2026", color: "808080", size: 20, font: "Arial" })]
            }),

            // ===== 1 =====
            heading1("1.  Purpose and Scope"),
            para("Everything the app says is text before it is sound. This is a practical reference for what can be done to that text to change how it comes out, what cannot, and which of the two problems you are actually looking at."),
            boldPara("Two jobs, and they are not the same one. ",
                "The first is getting a word MADE OF THE RIGHT SOUNDS - a family name, a place, a brand. The second is everything laid over the top: where the voice rises and falls, which word is leaned on, where it pauses, how fast it goes. They have different remedies, they fail in different directions, and neither rescues the other. A voice with faultless delivery still has no idea how your cousin's name is said; a voice given a perfect respelling still reads the sentence flat if its delivery is poor."),
            boldPara("Their names, because every company uses them. ",
                "Writing a word the way it sounds rather than the way it is spelled - Worcester as Wooster - is PHONETIC RESPELLING, or just respelling. Everything laid over the top is PROSODY; a voice working that out from the sentence unaided, with nothing marked up by hand, is doing PROSODY PREDICTION, which the companies usually advertise as expressiveness or naturalness."),
            boldPara("Scope: the voices the app can actually use. ",
                "Those are the voices built into the device, driven through the browser, and Deepgram's Aura voice. A third, running the speaking model on the machine itself, exists in the comparison bench but not in the app. Services the app does not use are covered only where they show what would be gained by adding one."),
            boldPara("⚠ This edition corrects the first, which was wrong about its own main subject. ",
                "The June 2026 edition was largely a table of what commas, periods, ellipses and dashes do to pacing and intonation. It was written days before that was tested, and the test found the device's voices ignore all of it. The table is gone. What survived is the section it gave least room to - respelling - which turns out to be the one lever that works everywhere."),

            // ===== 2 =====
            heading1("2.  What Works, and Where"),
            para("The single most useful thing to know is that the answer depends on which voice is speaking, not on which trick you use. Read down the column you are actually on."),
            simpleTable(
                ["Voice", "Respelling a name", "Marking up the delivery", "A stored list of names"],
                [
                    [{ text: "The device's own voices", bold: true },
                     "Works - heard (June 2026)",
                     "Nothing. Punctuation was tested and does not move pacing or intonation on the Google and Microsoft voices",
                     "None. A browser offers no way to pass one"],
                    [{ text: "Deepgram Aura", bold: true },
                     "Works - heard (August 2026)",
                     "No markup language, deliberately - but some text does carry through, measured below",
                     "None"],
                    [{ text: "On this device (bench only)", bold: true },
                     "Works - measured (September 2026)",
                     "Nothing",
                     "None"],
                    [{ text: "Azure, Google, Cartesia, ElevenLabs", bold: true },
                     "Works",
                     "Real markup, in various amounts",
                     "Yes, on most of them"],
                ], [2100, 1900, 3100, 2260]),
            boldPara("So in practice, today, respelling is the whole toolkit. ",
                "The app uses the first two rows and nothing else, and neither offers anything but respelling. That is not as thin as it sounds - respelling is the half that fixes names, which is the half that comes up."),

            // ===== 3 =====
            heading1("3.  Respelling: the Lever That Works Everywhere"),
            para("The app has a “How to say it” box beside every person, every place, and every Express Panel phrase. What is typed there is swapped in at the last moment, as the words are handed to the voice."),
            boldPara("⚠ Ask first whether it is needed at all. ",
                "This is the lesson from the most recent test and it is worth more than the technique. Three names were tried; one of them, Siobhan, was already said correctly, so the respelling changed nothing but where the stress fell. A respelling is a REPAIR, and repairing something that is not broken can only make it worse. Hear the real spelling first."),
            boldPara("Then write it the way it sounds. ",
                "Do not fight the real spelling - abandon it. Break the word at the syllables with hyphens if that helps the voice find them. Use whatever spelling would make an English reader say the right thing, however odd it looks on the page: it is never seen by anybody."),
            emptyPara(),
            para("Measured, on more than one voice:"),
            simpleTable(
                ["Written as", "Respelled", "What actually changed"],
                [
                    ["Volksswitch", "Folks-switch",
                     "The opening sound moved from a V to an F, and the vowel with it. Confirmed on two different voices"],
                    ["rendezvous", "rahn-day-voo",
                     "The middle vowel became “day”, as intended"],
                    ["Siobhan", "Shiv-awn",
                     "Almost nothing - the voice already said it correctly. The case that argues for listening first"],
                ], [2000, 2000, 5360]),
            emptyPara(),
            boldPara("⚠ Notice what the repair costs. ",
                "A hyphen buys the right sounds and can put a small pause in the middle of a name. Both respellings above produced a measurably longer clip than the original. A repair that fixes the name and breaks the rhythm may not be the one to keep."),
            boldPara("⚠ And it is per voice. ",
                "A spelling tuned to one voice is not guaranteed on another, so it has to be tried on the voice you actually intend to use. This is the strongest argument for the stored name lists the other services offer: those are held by the service and applied everywhere, rather than guessed at one sentence at a time."),

            // ===== 4 =====
            heading1("4.  Delivery: What Can and Cannot Be Asked For"),
            boldPara("On the device's own voices: nothing. ",
                "Commas, periods, ellipses and em dashes were tried and produced no usable change in pausing or intonation on either the Google or the Microsoft voices. There is no way to ask them for a pause or a stress. They still have whatever delivery is built into the voice - a question mark lifts the end of a sentence - but it cannot be steered, and they are the oldest and flattest voices available to the app."),
            boldPara("On Deepgram Aura: no markup, but some text does carry through. ",
                "Measured on one voice, one run each, in August 2026. An ellipsis produced the longest pause of anything tried, about twice a period; a comma produced almost none. Writing a word in capitals made the phrase around half again as long, which is a real emphasis lever - and worth hearing before using, since the company's own advice is to avoid it."),
            boldPara("⚠ Two pieces of common advice did NOT hold up when measured. ",
                "More dots do not make a longer pause: six spaced dots produced a SHORTER one than three. And a hyphen, which is widely said to add a pause, produced less of one than a plain period. Where a technique is repeated everywhere and nobody has timed it, assume nothing."),
            boldPara("What the app could still do on any voice, and does not. ",
                "The browser lets a whole utterance be given a speaking rate, a pitch and a volume. The app sets none of them today - it chooses the voice and nothing else. Because those apply to a whole utterance, the only way to vary delivery inside a sentence is to speak it as two, which is worth knowing but is a build, not a text trick."),
            boldPara("What a different service would add. ",
                "Azure, Google, Cartesia and ElevenLabs all accept real markup, so a pause of a stated length or a stress on a chosen word becomes possible. Set against that, Deepgram's stated reason for having none is that voices now get delivery right unaided, and that hand-marking it is on the way out. If that holds, this is the half of the problem that shrinks with time - while the name problem does not move at all."),

            // ===== 5 =====
            heading1("5.  Things Every Voice Transforms"),
            para("Separately from delivery, some characters change which words come out. These behave broadly alike everywhere and are worth knowing because they bite by accident."),
            simpleTable(
                ["What", "Example", "What happens"],
                [
                    ["Symbols", "&   %   $   #   /",
                     "Spoken as words - “and”, “percent”, “dollars”, “slash”. Write the word you actually want"],
                    ["Digits", "1235",
                     "Interpreted, and not always as you meant: read as a year, “twelve thirty five”. Adding the word “and” - twelve hundred and thirty five - settles it. Measured"],
                    ["Money and dates", "$45.82",
                     "Expanded correctly on the voices tried, including the cents. Measured"],
                    ["Digits with periods between them", "555.867.5309",
                     "Forces digit-by-digit reading, which is what a phone number wants. Measured"],
                    ["Initials and acronyms", "AAC   NASA",
                     "Said correctly untouched on the voices tried - no help needed. Spacing the letters out is the fix if one is wrong. Measured"],
                    ["Quotation marks", "“like this”",
                     "Usually silent. Do not expect emphasis from them"],
                    ["Emoji and stray glyphs", "★",
                     "Read aloud by name, or skipped. Keep them out of anything that will be spoken"],
                ], [2100, 1900, 5360]),

            // ===== 6 =====
            heading1("6.  Where This Shows Up in the App"),
            bulletBold("The “How to say it” boxes. ",
                "On every person, every place, and every Express Panel phrase. This is the main home for everything in section 3."),
            bulletBold("Placeholder statements. ",
                "The short phrases spoken while the user is choosing - “I'm thinking about that.”, “Still thinking it through.” and their siblings. The previous edition suggested adding trailing dots to make them sound pensive; that advice is WITHDRAWN for the device's own voices, which ignore them. On Aura an ellipsis does buy a real pause, so it is worth hearing there."),
            bulletBold("The command phrases. ",
                "Ask-them-to-repeat, hold on, the conversation openers, the wind-downs and the goodbyes are all user-authored text, so anything here applies to them too."),
            emptyPara(),
            boldPara("⚠ A respelling must never leave the sound. ",
                "It is swapped in at the last moment and reaches the voice alone - never the screen, never the saved conversation, never the AI. The last one is the trap: an assistant told that somebody is called “Shiv-awn” will write that into its suggestions, and the misspelling then appears on screen as the person's name."),

            // ===== 7 =====
            heading1("7.  How to Test"),
            boldPara("To compare services, use the bench. ",
                "prototypes/speech-providers.html speaks one sentence with every voice you have a key for. Its second box takes the same sentence respelled, and each voice then says both, one straight after the other - which is the only way to judge a respelling, since nobody can hold two deliveries in mind across a gap of several seconds."),
            boldPara("To test the voice you actually ship with, stay in the app. ",
                "Every Express Panel phrase has a speaker beside it in Settings, and every About Me answer has one. Those speak through the real voice with the real settings, which the bench does not."),
            emptyPara(),
            para("Four rules that matter more than the word list:"),
            bullet("Always inside a carrying sentence, never a bare name. A word alone gets end-of-sentence intonation and comes out differently from the same word in the middle of a sentence, which is the real case."),
            bullet("Hear the plain spelling first. Half the time there is nothing to fix."),
            bullet("Listen for what the repair costs, not only for whether it worked - an inserted pause is the usual price."),
            bullet("Test on the voice you will use. None of this transfers reliably between voices."),
            emptyPara(),
            para("A test set, each row aimed at something different:"),
            simpleTable(
                ["Sentence", "Respelled", "What it tells you"],
                [
                    ["Her name is Siobhan.", "Shiv-awn",
                     "Whether it is needed at all - some voices already say it right"],
                    ["I work with Volksswitch.", "Folks-switch",
                     "The known-good case, confirmed on two voices. Your control"],
                    ["She's from Worcester.", "Wooster",
                     "A place name where the real spelling actively misleads"],
                    ["I was talking to Nguyen.", "Win",
                     "A very common surname that most voices get wrong - the hardest case"],
                    ["Ask Regina about it.", "ruh-JY-nuh",
                     "Stress rather than sounds. Some voices will move the emphasis and some will not, and a name can be wrong in that way alone"],
                    ["I read that book last night.", "(nothing)",
                     "Tests the VOICE, not the box: it should say “red”. A voice that gets this from the sentence around it needs less help generally"],
                    ["It's an AAC device.", "A-A-C",
                     "Whether letters need forcing apart, and whether hyphens do it or get spoken"],
                ], [2500, 1500, 5360]),

            // ===== 8 =====
            heading1("8.  Quick Reference"),
            bullet("A name comes out wrong: respell it the way it sounds, hyphenate the syllables, and hear the plain version first in case it was already right."),
            bullet("A respelling is never seen by anyone - not on screen, not in the saved conversation, not by the AI."),
            bullet("Pauses and intonation cannot be steered at all on the device's own voices. Punctuation was tested and does nothing."),
            bullet("On Deepgram Aura an ellipsis buys the longest pause available, and capitals genuinely add emphasis - but more dots do not buy more pause."),
            bullet("Symbols, digits and emoji are transformed on every voice. Write the words you want said."),
            bullet("Nothing here transfers between voices. Test on the one you will use, in a full sentence."),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    const out = docPath('Shaping-Speech-Through-Text.docx');
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out + ' (' + buffer.length + ' bytes)');
});
