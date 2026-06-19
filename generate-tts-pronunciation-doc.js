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
                children: [new TextRun({ text: "Punctuation and Characters That Affect How Browser Voices Pronounce a Phrase", italics: true, color: "595959", size: 24, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  June 2026", color: "808080", size: 20, font: "Arial" })]
            }),

            // ===== 1. PURPOSE & SCOPE =====
            heading1("1.  Purpose and Scope"),
            para("This document is a practical reference for nudging how the app's voices pronounce a phrase — pacing, pauses, and intonation — using only the characters you type into the text itself. It exists because our text-to-speech runs entirely in the browser, where the richer controls (SSML markup) are not available. The aim is to give you a short list of promising characters to try, and a clear note on what each one is likely to do, so you can experiment by ear."),
            para("Scope: the voices we ship with today — the voices built into Windows and the voices supplied by Google Chrome — driven through the browser's built-in speech engine. The first place to apply anything you discover is the placeholder (\"filler\") statements, where a more thoughtful, unhurried delivery would sound far less robotic. See Section 6."),
            emptyPara(),

            boldPara("How to test (no special tools needed): ", "Use the \"Speak my answer\" button already built into the About Me questionnaire. Type a candidate phrase — punctuation and all — into any free-text (\"in my own words\") answer field, then tap \"Speak my answer\" and listen. That speaks the exact text in the voice currently selected in Settings, which is precisely the path real responses and placeholders take. To compare, change the voice in Settings and speak the same text again."),
            emptyPara(),

            // ===== 2. THE ONE BIG CAVEAT =====
            heading1("2.  The One Big Caveat: Effects Are Per-Voice and Not Guaranteed"),
            para("There is no formal, documented way to control prosody through the browser speech engine. Everything in this document is an effect that the underlying voice may produce — not a setting it must honor. The same character can behave differently on a Windows voice (e.g., \"Microsoft David\" / \"Microsoft Zira\") than on a Google Chrome voice (e.g., \"Google US English\"), and differently again across Windows versions."),
            para("Two consequences follow, and they shape everything below:"),
            bullet("Always test on the actual voice you intend to ship with. A pause that sounds perfect on one voice may be ignored — or read aloud as a word — on another."),
            bullet("Some characters are spoken literally rather than interpreted. A voice may say \"dot dot dot\" for an ellipsis, \"ampersand\" for \"&\", or \"slash\" for \"/\". When that happens, the character is doing the opposite of what you want. Treat every candidate as guilty until you have heard it behave."),
            emptyPara(),
            para("What is reliable is the formal record: SSML (the markup standard that would let us write things like \"pause 400 milliseconds\" or \"raise the pitch here\") is not supported by the browser speech engine. Typing SSML tags into a phrase does not work — they are read aloud or stripped. Full prosody control is only available if we later move text-to-speech to a cloud voice service (a separate, future decision)."),
            emptyPara(),

            // ===== 3. PUNCTUATION FOR PAUSES & INTONATION =====
            heading1("3.  Punctuation: Pacing and Intonation"),
            para("Punctuation is the single most useful lever, because well-behaved voices already use it to decide where to pause and how a sentence rises or falls. The table lists the characters most likely to help, from shortest pause to longest, plus the intonation marks. \"Likely effect\" is the common behavior; confirm by ear."),
            emptyPara(),
            simpleTable(
                ["Character", "Type as", "Likely effect", "Watch for"],
                [
                    ["Comma", { text: ", ", mono: true }, "Short pause; slight intonation reset. The gentlest way to slow a phrase.", "Usually safe."],
                    ["Period", { text: ". ", mono: true }, "Sentence-final falling tone + a medium pause.", "Ends the 'sentence' — intonation drops."],
                    ["Semicolon", { text: "; ", mono: true }, "Medium pause, less final than a period (tone doesn't fully drop).", "Some voices treat it like a comma."],
                    ["Colon", { text: ": ", mono: true }, "Pause with an anticipatory feel ('here it comes').", "Varies; test."],
                    ["Ellipsis", { text: "…  or  ...", mono: true }, "Trailing, hesitant pause — the most 'thinking out loud' mark. Ideal for fillers.", "Some voices say 'dot dot dot'. Try the single … character vs three periods."],
                    ["Em dash", { text: "—  or  --", mono: true }, "Abrupt break or aside; a beat of separation.", "Some voices ignore it or say 'dash'."],
                    ["Question mark", { text: "? ", mono: true }, "Rising / yes-no question intonation.", "Strongest, most reliable intonation cue."],
                    ["Exclamation", { text: "! ", mono: true }, "A little more energy / emphasis.", "Effect is mild on most voices."],
                    ["Parentheses", { text: "( ) ", mono: true }, "Sometimes a lowered, aside-like delivery for the enclosed words.", "Many voices ignore them entirely."],
                    ["Line break", { text: "(new line)", mono: true }, "Often a pause similar to a period.", "Engine-dependent; not all honor it."]
                ],
                [1500, 1700, 3760, 2400]
            ),
            emptyPara(),
            boldPara("Lengthening a pause. ", "To stretch a pause, the first thing to try is a stronger mark (comma → period → ellipsis), not a repeated one. Repeating marks (\"wait,, for it\" or extra dots) sometimes lengthens the gap but just as often gets read aloud or ignored — test before relying on it."),
            boldPara("Stacking marks. ", "Combinations can read naturally: \"Hmm — let me think…\" gives a beat, then a trailing tail. Build the contour you want from the single-character effects above, then listen to the whole phrase, not the parts."),
            emptyPara(),

            // ===== 4. CHARACTERS THAT CHANGE PRONUNCIATION =====
            heading1("4.  Characters That Change Pronunciation (and Ones to Avoid)"),
            para("Beyond pacing, some characters change which words are said or how a word is pronounced. These are useful for getting names and unusual words right — and a few are traps that make a voice say something you didn't intend."),
            emptyPara(),
            simpleTable(
                ["Device", "Example", "Likely effect"],
                [
                    ["Hyphenate to separate syllables", { text: "Volks-switch", mono: true }, "Encourages a clean two-part pronunciation instead of a slur. Good for names the voice mangles."],
                    ["Respell phonetically", { text: "say 'kew' for Q", mono: true }, "Type the word the way it sounds. The most dependable way to fix a mispronounced name."],
                    ["Spaces between letters", { text: "A A C", mono: true }, "Often spoken as separate letters ('A-A-C'). Useful for acronyms — or a problem if you wanted a word."],
                    ["ALL CAPS", { text: "STOP", mono: true }, "Usually NOT louder or emphasized. Short all-caps words may be spelled out as letters instead — a common surprise."],
                    ["Digits vs. words", { text: "1996  vs  nineteen ninety-six", mono: true }, "Digits are interpreted ('nineteen ninety-six' or 'one thousand…') in ways that vary; spelling it out removes all doubt."],
                    ["Symbols read as words", { text: "&  %  $  #  /", mono: true }, "Commonly spoken as 'and', 'percent', 'dollars', 'number/hash', 'slash'. Spell out the word you actually want."],
                    ["Quotation marks", { text: "\"like this\"", mono: true }, "Usually silent (ignored). Safe, but don't expect them to add emphasis."],
                    ["Emoji / special glyphs", { text: "🙂  →  ★", mono: true }, "May be read aloud by name or skipped. Avoid in spoken text."]
                ],
                [2700, 2860, 3800]
            ),
            emptyPara(),
            boldPara("Rule of thumb. ", "If a word or name comes out wrong, do not fight the spelling of the real word — type a respelling that sounds right and hyphenate the syllables. The listener hears speech, not text, so the 'misspelling' is invisible."),
            emptyPara(),

            // ===== 5. WHEN CHARACTERS AREN'T ENOUGH =====
            heading1("5.  When Characters Aren't Enough"),
            para("Punctuation can shift pacing and the rise-and-fall at phrase boundaries, but it cannot raise the pitch of one word in the middle of a sentence or set an exact pause length. If a phrase needs more than the characters above can give, there are two deeper levers — noted here so the boundary is clear, but they are code changes, not things you type:"),
            bulletBold("Per-utterance voice settings. ", "The app can already set a whole phrase's pitch, speaking rate, and volume. A filler could be spoken a little slower and lower than a real response, for instance."),
            bulletBold("Splitting one phrase into several. ", "Because settings apply to a whole utterance, the only way to vary pitch or rate within a sentence is to speak it as two or three back-to-back pieces with different settings. This is how you would fake an inflection contour today."),
            para("Anything richer than that — precise pause durations, true word-level emphasis — needs a cloud voice service that accepts SSML, which is a separate future decision with its own cost and network implications."),
            emptyPara(),

            // ===== 6. FIRST APPLICATION: PLACEHOLDER STATEMENTS =====
            heading1("6.  First Application: Placeholder Statements"),
            para("Placeholders are the best first target. They are short, they repeat, and they are supposed to sound like the user is thinking — exactly the delivery that a trailing pause conveys well. A flat \"Let me think.\" sounds like a finished statement; \"Let me think…\" sounds like the thought is still forming. The goal for fillers is unhurried and tentative, not crisp and final."),
            emptyPara(),
            para("Candidate rewrites to speak through the \"Speak my answer\" button and compare against the current versions:"),
            emptyPara(),
            simpleTable(
                ["Current", "Try", "Why"],
                [
                    [{ text: "Hmm.", mono: true }, { text: "Hmm…", mono: true }, "Trailing tail reads as pensive rather than clipped."],
                    [{ text: "Let me think.", mono: true }, { text: "Let me think…", mono: true }, "Sounds like the thought is still forming."],
                    [{ text: "Good question.", mono: true }, { text: "Good question…", mono: true }, "Softens the full stop into a lead-in to the pause that follows."],
                    [{ text: "Give me a second.", mono: true }, { text: "Give me a second…", mono: true }, "Open-ended; less like an order, more like a request for patience."],
                    [{ text: "Well…", mono: true }, { text: "Well…  (keep)", mono: true }, "Already uses the trailing ellipsis — a good model for the rest."],
                    [{ text: "Oh.", mono: true }, { text: "Oh…", mono: true }, "Lets the reaction breathe instead of snapping shut."]
                ],
                [2700, 3000, 3660]
            ),
            emptyPara(),
            para("Two cautions specific to fillers, both from earlier design notes:"),
            bullet("A filler must read as 'I'm thinking', never as a real reply. (This is why short acknowledgment words that double as answers — 'Okay.', 'Right.', 'I see.' — were removed from the set: a partner hears them as the user's actual response to a greeting.)"),
            bullet("If a candidate's punctuation gets read aloud on your chosen voice (e.g., '…' becomes 'dot dot dot'), discard that punctuation for that voice — a verbalized mark is worse than none."),
            emptyPara(),

            // ===== 7. SUGGESTED TESTING PROTOCOL =====
            heading1("7.  Suggested Testing Protocol"),
            para("A quick, repeatable way to evaluate any candidate string:"),
            new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 80 },
                children: [new TextRun("In Settings, select the voice you intend to ship with, and note its name.")] }),
            new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 80 },
                children: [new TextRun("Open About Me, open any topic, and find a free-text (\"in my own words\") field.")] }),
            new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 80 },
                children: [new TextRun("Type the candidate phrase with its punctuation, then tap \"Speak my answer\" and listen.")] }),
            new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 80 },
                children: [new TextRun("Type the plain version (no special punctuation) and speak it. Compare the two by ear.")] }),
            new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 80 },
                children: [new TextRun("Confirm nothing was read aloud that shouldn't be (no 'dot dot dot', no 'dash', no symbol names).")] }),
            new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 160 },
                children: [new TextRun("Repeat on a second voice (one Windows, one Google) before deciding — effects differ by voice.")] }),
            para("Record which punctuation worked on which voice. Because behavior is per-voice, the practical output of this exploration is a short, voice-specific list of safe characters — not a universal rule.", { run: { italics: true, color: "595959" } }),
            emptyPara(),

            // ===== 8. QUICK REFERENCE =====
            heading1("8.  Quick Reference"),
            bulletBold("Slow a phrase gently: ", "add a comma."),
            bulletBold("Make it sound tentative / thinking: ", "end with an ellipsis (…)."),
            bulletBold("Add a beat or aside: ", "use an em dash (—)."),
            bulletBold("Question intonation: ", "end with ? (the most reliable intonation cue)."),
            bulletBold("Fix a mispronounced name: ", "respell it phonetically and hyphenate the syllables."),
            bulletBold("Avoid: ", "ALL CAPS for emphasis (doesn't work), bare symbols (& % $ # /), emoji, and any mark your chosen voice reads aloud."),
            bulletBold("Remember: ", "test on the real voice — none of this is guaranteed across voices, and SSML markup does not work in the browser engine."),
            emptyPara(),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    const out = 'Shaping-Speech-Through-Text.docx';
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out + ' (' + buffer.length + ' bytes)');
});
