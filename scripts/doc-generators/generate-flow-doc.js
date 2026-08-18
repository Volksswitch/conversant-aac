// Standalone memo describing the revised partner-speech capture flow.
// Styled to match the Architecture Overview (Arial, blue headings, centered footer).
const { docPath } = require('./doc-paths');   // resolves figures + output, whatever the CWD
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

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
function boldBullet(label, text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 100 },
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
function numberedItem(text) {
    return new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

function simpleTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true, size: 20 })] })]
    });
    const bodyCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, size: 20 })] })]
    });
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
        default: { document: { run: { font: "Arial", size: 24 } } },
        paragraphStyles: [
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 28, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
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
            children: [new TextRun({ text: "Conversant AAC — Partner Speech Capture", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  June 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            new Paragraph({
                spacing: { before: 240, after: 80 },
                children: [new TextRun({ text: "Continuous Partner Capture", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "A revised conversational flow for partner speech recording", italics: true, color: "595959", size: 26, font: "Arial" })]
            }),

            heading2("The Problem"),
            para("Knowing when a person has finished speaking is genuinely hard — and it is hardest for the communication partner, who pauses mid-thought, resumes, qualifies what they just said, and circles back. The earlier design used a single silence timeout to decide the partner was done: after the configured number of seconds of silence, recording stopped and the collected speech was sent to the AI. That forces the system to guess whether the partner has actually finished. Guess too early and the partner is cut off mid-utterance; wait longer to be safe and the user sits through avoidable delay on every turn."),
            emptyPara(),

            heading2("The Revised Model"),
            para("The silence period is no longer a stop — it is a checkpoint. In Settings it is now labeled “Silence period.” When the partner goes quiet for that period, the system takes the speech collected so far and sends it to the AI for response options, and speaks a placeholder to hold the conversational floor — but it keeps recording. Recording stops only when the user chooses a response."),
            para("If the partner resumes talking, the new speech is appended to what was already captured. After the next silence period, the combined speech is sent to the AI for a fresh, more complete set of options, and another placeholder is spoken. This repeats for as long as the partner keeps going — every pause yields an updated set of options built on everything said so far. The user may select a response at any moment; doing so stops recording, speaks the response, and stores the exchange."),
            emptyPara(),

            heading2("Step by Step"),
            numberedItem("The user taps Start Listening. The partner begins speaking; the live transcript appears on screen."),
            numberedItem("The partner pauses for the silence period. The speech so far is sent to the AI for response options; a placeholder is spoken. Recording continues."),
            numberedItem("If the partner resumes, the new speech is appended. The next silence period sends the combined speech for a new set of options and speaks another placeholder."),
            numberedItem("Steps 2–3 repeat for as long as the partner keeps talking."),
            numberedItem("The user selects a response at any time. Recording stops, the response is spoken, and the exchange is stored."),
            emptyPara(),

            heading2("Two Supporting Guarantees"),
            boldPara("Latest set of options wins. ", "Because each checkpoint starts its own request to the AI, an earlier request may still be in flight when a later one fires. The system tags each request and discards any result that a newer checkpoint has superseded, so the options on screen never flicker backward to a less complete answer."),
            boldPara("Ask them to repeat. ", "A persistent command, always available. Selecting it speaks a phrase asking the partner to repeat themselves — the phrase itself is user-editable in Settings — and keeps everything already captured for the current exchange rather than discarding it. The partner’s next words are recorded as a fresh, separate turn immediately following the request, instead of being merged into what came before. Earlier versions of this control discarded the captured speech outright; that was reversed once it became clear the user should never lose speech they had already heard confirmed on screen."),
            emptyPara(),

            heading2("Why Cleanup Happens Only at the End"),
            para("Throughout the exchange, options are generated directly from the raw speech-to-text — there is no transcript-cleanup step at each checkpoint. The single cleanup pass runs only after the user has selected and the response has been spoken, so it never delays the user’s words; its only job is to improve the text carried into the context of future turns and into the saved record. The raw, uncleaned line is itself written to the saved transcript as soon as the partner pauses — so the record always mirrors what is on screen, even if the app is closed mid-conversation — and the cleaned version overwrites it in place once the background pass finishes. The persistent “Ask them to repeat” control is what makes working from raw text safe: when a capture is too garbled to work with, the user can ask the partner to say it again without losing what was already captured. If raw-text quality proves to be a problem in practice, per-checkpoint cleanup can be reintroduced."),
            emptyPara(),

            heading2("Robustness Additions Since This Design"),
            para("Three behaviors were added after this design was first implemented, closing gaps that only showed up in live use. All three are part of “the shipped capture pipeline” this document describes."),
            boldBullet("The app’s own speech is filtered out of what it hears. ", "Placeholders and spoken responses play with the microphone still on (so the partner can talk over them), so the speech-to-text stream is checked against what the app itself just said and that content is excised — including a partial, mis-heard, or slightly delayed echo of it — before it can be mistaken for something the partner said. Without this, the app’s own placeholder could restart the silence timer, trigger a fresh checkpoint, or bleed a few words into the partner’s transcript."),
            boldBullet("A placeholder is canceled if the partner starts talking again first. ", "If the partner resumes speaking before a scheduled placeholder plays, the placeholder is dropped rather than talking over them. (Known limitation: if the partner starts talking while a placeholder is already mid-playback, the app cannot yet tell the partner’s voice apart from its own audio, so the interruption isn’t caught until the placeholder finishes. Reliably solving this is deferred to a later phase, when the app can recognize the communication partner’s voice specifically.)"),
            boldBullet("Interrupting the partner still captures what they had said. ", "If the user cuts in with an immediate statement — an Express Panel phrase, for example — before the partner has paused, the partner’s speech up to that moment is captured and recorded rather than lost, interleaved before the interrupting statement. No AI cleanup runs on that fragment, since it is not a completed utterance; it is recorded as heard."),
            boldBullet("The start of listening plays an audible chime, since the app cannot count on the partner watching the screen. ", "Added later (v0.5.96) as a partner-facing recording indicator: a short two-note tone plays each time the microphone starts capturing, alongside the Listen button turning a pulsing red, so a communication partner who is facing the user rather than the tablet still gets a cue that the device is now listening. The chime is user-toggleable (default on). With “resume listening automatically” on, listening restarts after every exchange, so the chime plays only once at the start of the conversation rather than on every automatic re-listen (v0.5.98) — the disclosure has already been made, and listening is effectively continuous for the rest of the conversation. With auto-resume off, each manual Start Listening is a separate, deliberate listening episode and still chimes every time."),
            boldBullet("Stopping and restarting listening mid-turn is a pause, not a turn boundary. ", "The Listen button controls the microphone; it does not end the partner’s turn. Restarting while they still hold the floor keeps what they have said and appends the rest, so a mic toggle and an uninterrupted pause produce the same captured turn. Previously the restart cleared the accumulated text and then overwrote the already-written transcript line with the shorter remainder — a double loss, and a silent one. A partner turn now ends only at a floor change: the user selects a response, asks them to repeat, or ends the conversation. Added August 2026."),
            emptyPara(),

            heading2("Settings Summary"),
            simpleTable(
                ["Setting", "Meaning under the revised flow"],
                [
    ["Silence period", "How long the partner can pause before the speech collected so far is sent for response options. Recording continues; the combined speech is re-sent after each subsequent pause. (Originally labeled “Silence Threshold,” then “Optional Responses silence period”; renamed “Silence period” for clarity.) The default is 0.5 seconds; the range is 0 to 3.0 seconds, where 0 fires on the recognizer’s own end-of-speech signal rather than on a timer."],
                    ["Initial / Subsequent placeholder delay, Maximum placeholders per turn", "Govern the placeholder spoken to hold the floor while options are generated. A placeholder no longer fires at every checkpoint: it plays only once the partner’s turn is classified complete (not while they are still mid-utterance, and not when they are asking the user to repeat themselves), the first one lands after the initial delay, later ones re-fill after the subsequent delay, and “Maximum placeholders per turn” caps how many can play in a row (0 = none)."],
                    ["Listening chime", "Whether a short tone plays each time listening starts (default on) and, with auto-resume on, whether it plays only once per conversation rather than on every automatic re-listen (v0.5.96, refined v0.5.98)."],
                ],
                [3400, 5960]
            ),
            emptyPara(),

            heading2("Relationship to the Conversation-Analysis Design Layer"),
            para("This is a pragmatic Phase 1 realization of the end-of-utterance problem framed in the Conversation Engine design. Rather than classify each pause as complete, incomplete, or continuing and act differently for each, Phase 1 treats every pause as provisional: it offers options on what has been heard so far, but never commits, and simply regenerates as the utterance grows. The Conversation Engine later built exactly the three-way classifier described here and, for a time, gated generation on it — suppressing options while a turn looked incomplete. That gate caused silent stalls when the classifier misjudged a short or disfluent turn as unfinished, and was removed in July 2026 in favor of this design’s original guarantee: every pause generates and shows options, refined turn by turn, and the partner’s turn is treated as complete only when the user responds or ends the conversation — never by the system’s guess."),

            new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, space: 8, color: "CCCCCC" } },
                spacing: { before: 480, after: 0 },
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Implemented June 2026; the checkpoint-and-regenerate model, and the guarantee that the partner is never cut off and the user is never blocked from responding, remain unchanged as of July 2026. See the Architecture Overview, Section 9, for placement within the Phase 1 implementation.", italics: true, color: "808080", size: 18 })]
            }),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(docPath("Conversant AAC Continuous Partner Capture.docx"), buffer);
    console.log("Continuous-Partner-Capture.docx generated.");
});
