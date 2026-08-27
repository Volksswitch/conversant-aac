/* Generates docPath("Conversant AAC Conversation Flow.docx") - the flow of one
 * conversation from start to finish, in one place.
 *
 * WHY THIS EXISTS. Ken asked for it during the manual review: "with a figure, the flow
 * of a conversation from start to finish including the effects of choosing various
 * buttons in the command bar, partner exchange resumption, placeholder statements,
 * Express Panel and Compose Panel usage." No document covered the whole loop - the
 * manual teaches it a step at a time, and the design records each mechanism separately,
 * so the shape of an exchange had to be reassembled from a dozen places every time.
 *
 * ⚠ EVERY NUMBER AND EVERY BUTTON NAME HERE WAS READ OFF THE SHIPPED CODE, August 27
 * 2026, not off the design record - the two have disagreed before, and the review found
 * the manual naming a module ("Sounds Like Me") that no user ever sees. Checked:
 *   - defaults: silence 0.5s, first holding phrase 2s, later ones 10s, at most 2,
 *     resume-listening OFF, four suggestions (storage.js)
 *   - the Command Bar's accessible names, which are what the icons stand for
 *     (ui.applyControlIcons) - the button in the markup still reads "Wind down" and
 *     the app renames it to "Wrap up" at startup
 *   - the region names settled August 26 2026 (Conversation Pane, Conversation Log,
 *     Response Panel, Command Bar, Express Panel, Composition Pane)
 *
 * Figures come from "Conversation Flow Figures.html" via
 * capture-conversation-flow-figures.js. Re-run that after editing it.
 *
 * Run: node generate-conversation-flow-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, ImageRun } = require('docx');

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
function lead(label, text) {
    return new Paragraph({
        spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function bullet(text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 100 },
        children: [new TextRun(text)]
    });
}
function numBold(label, text, ref) {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 100 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

// Figures are produced by capture-conversation-flow-figures.js from
// "Conversation Flow Figures.html" (re-run it after editing that file). Scaled to the
// 6.5in text column: 820 css px wide becomes 624 px, a factor of 0.761.
function figure(file, w, h, caption) {
    const k = 624 / w;
    return [
        new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER,
            children: [new ImageRun({ type: 'png', data: fs.readFileSync(file),
                transformation: { width: Math.round(w * k), height: Math.round(h * k) } })] }),
        new Paragraph({ spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: caption, italics: true, size: 18, color: '666666' })] }),
    ];
}

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
        const run = isObj
            ? new TextRun({ text, size: 20, italics: !!cell.italics, bold: !!cell.bold })
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

const W3 = [2400, 3480, 3480];
const W2 = [3200, 6160];

function bullet(text) {
    return new Paragraph({ numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 0, after: 80 }, children: [new TextRun(text)] });
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
            { reference: "flow",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "why",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "principles",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "build",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "open",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC \u2014 Express Panel Design", italics: true, color: "808080", size: 18, font: "Arial" })]
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
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversation Flow", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "How one conversation runs from start to finish: what the app does at each step, what each button does to that flow, and where the waiting actually goes.", italics: true, size: 22, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 260 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  August 2026  |  Last updated August 27, 2026", size: 18, color: "777777" })] }),

            heading1("1.  What This Is For"),
            para("The app behavior during a conversation is described a step at a time in the User Manual, and mechanism by mechanism in the design documents. Neither shows the shape of a whole exchange. This does."),
            para("It is written for anyone who needs to know what the app will do next: someone setting it up for a user, a therapist watching a session, or anyone reading a report and trying to work out why a conversation went the way it did."),
            lead("One thing to hold on to before the detail. ", "The app never speaks on its own initiative. It hears, it suggests, and it waits. The only words it says without being asked are the short holding phrases, and those exist so the other person is not left in silence while the user reads."),

            heading1("2.  One Exchange, End to End"),
            ...figure('cf-fig1.png', 1000, 974, "Figure 1 — One exchange, from the other person speaking to the reply being said aloud."),
            para("Reading down the figure:"),
            numBold("You open the conversation. ", "“Start conversation” puts a set of openers on the Response Panel to choose from. “Start Listening” skips them and begins listening straight away, which is what you want when the other person is already talking.", "flow"),
            numBold("The other person talks. ", "Their words appear in the Conversation Log as they are heard. The microphone stays on for the whole exchange; the app says nothing while they are still speaking.", "flow"),
            numBold("They pause. ", "When they have been quiet for the Silence Period, the app treats that as a pause. Two things start at that moment and they do not depend on each other: the app asks the AI for suggestions, and the clock for the holding phrases starts running.", "flow"),
            numBold("A holding phrase is spoken. ", "Two seconds after the pause by default — I am thinking about that. It fills the gap while the user reads. It is not an answer, and it does not wait for the AI, so it still happens if the AI is slow or unreachable.", "flow"),
            numBold("Four suggestions appear. ", "A plain reply, a way to decline, a way to take the lead, and a way to ask for clarification. In practice they arrive four to eight seconds after the pause.", "flow"),
            numBold("The user answers. ", "By tapping a suggestion, by tapping a phrase in the Express Panel, or by typing their own in the Composition Pane and tapping Speak.", "flow"),
            numBold("The app says it in their voice, ", "and writes the exchange to the Conversation Log and to the saved conversation.", "flow"),
            numBold("Listening resumes, or waits. ", "It restarts by itself only if Resume listening automatically is turned on, which it is not by default. Otherwise the user taps Listen when they are ready.", "flow"),
            emptyPara(),
            lead("Why the default is to wait. ", "Resuming automatically is faster and it means the microphone comes back on without anybody deciding that it should. Leaving it off makes every listening period something the user chose. Either is defensible; the app ships with the deliberate one."),

            heading1("3.  Where the Waiting Goes"),
            para("The Silence Period is the setting people ask about most, and it is the one most easily misread. It does not measure the silence you can hear."),
            ...figure('cf-fig2.png', 1000, 421, "Figure 2 — One pause, laid out in time. The Silence Period starts later than you would expect."),
            para("Speech recognition runs online. The other person stops talking, and a moment later the service reports what it heard. The app cannot know they have stopped until that report arrives, so the Silence Period is counted from the arrival of their last words, not from the moment they went quiet."),
            lead("What follows from that. ", "The pause the other person actually experiences is longer than the number in Settings: it is the recognition delay plus the Silence Period. That delay varies with the connection and no setting can change it. So a Silence Period of half a second does not mean the app pounces half a second after someone stops; in practice the real pause is closer to a second."),
            para("It also explains a complaint that sounds like a contradiction: that the app both interrupts too eagerly and takes too long. Those are different moments. Being cut off early is the Silence Period expiring while the person was only drawing breath. The wait before suggestions appear is the AI, and the holding phrase is what covers it."),
            emptyPara(),
            simpleTable(["Setting", "Default", "What raising it does"], [
                ["Silence period", "0.5 seconds", "Gives the other person longer to pause mid-sentence without the app deciding they have finished. Costs a longer wait before suggestions start being prepared. Range 0 to 3 seconds."],
                ["Initial delay", "2 seconds", "How long after the pause the first holding phrase is spoken. Raise it if the app feels quick to fill a silence; lower it if the gap feels awkward."],
                ["Subsequent delay", "10 seconds", "The gap before another holding phrase, if the user is still choosing."],
                ["Maximum per turn", "2", "How many holding phrases one turn may have. 0 means none at all; No limit keeps them coming."],
            ], W3),

            heading1("4.  When They Keep Talking"),
            para("People do not speak in tidy turns. They pause, and carry on. The app is built around that rather than against it."),
            para("Every pause is a checkpoint, not an ending. If the other person starts up again, the holding phrases stop immediately and their new words are added to the same turn. At their next pause the app asks again, with everything they have said so far, and a better set of suggestions replaces the one on screen."),
            lead("The rule that matters here: ", "the suggestions are never emptied and refilled. They are only ever replaced by a new set, at the moment that set is ready. There is no point at which the user is looking at an empty panel because the app is busy."),
            para("Five things replace the set on screen, and nothing else does:"),
            bullet("The other person said more, and paused again."),
            bullet("The user pressed New 4, asking for a different set for the same turn."),
            bullet("The user typed something and pressed Reframe."),
            bullet("The user tapped one of the choices the other person had offered."),
            bullet("The kind of moment changed: the other person began saying goodbye, or asked the user to repeat themselves."),
            para("The suggestions clear only when something has been spoken, or when the conversation ends."),
            lead("The user is never locked out while this is going on. ", "A suggestion already on screen can be tapped, an Express Panel phrase can be spoken, or the Composition Pane can be opened, at any point. Any of those abandons the set that was on its way."),
            emptyPara(),
            lead("A limitation worth knowing. ", "While a holding phrase is actually playing, the app cannot reliably tell that the other person has started talking again, because the microphone is hearing the app's own voice. Someone who cuts in mid-phrase is not noticed until it finishes. Cutting in between phrases is caught immediately."),

            heading1("5.  The Command Bar, Button by Button"),
            para("The Command Bar sits between the Conversation Pane and the Response Panel. Its buttons are icons with no text; the names below are what a screen reader announces, and what this document and the manual call them."),
            simpleTable(["Button", "What it does", "What it does to the flow"], [
                ["Start Listening", "Turns the microphone on and off.", "Turning it off and on again mid-turn does NOT throw away what was already heard. It is a pause, and the rest of what they say is added to the same turn."],
                ["Start conversation", "Puts a set of openers on the Response Panel.", "A toggle: press it again and whatever was on screen comes back, with nothing said and nothing ended. The previous conversation is closed only when an opener is actually chosen."],
                ["Repeat what I said", "Says the user's last utterance again.", "Stops any holding phrase at once. The other person's turn stays open."],
                ["Hold on", "Says a holding phrase, chosen by the user rather than by the clock.", "Draws on the same phrases the app uses automatically, and will not repeat the one just spoken."],
                ["Ask them to repeat", "Says a phrase asking the other person to say it again.", "Keeps what was already heard, and starts a fresh turn for the repeat, so the two are not run together."],
                ["Wrap up", "Offers ways to signal the conversation is finishing.", "A toggle, like Start conversation: press again to put back what was there. Choosing one speaks it and then offers the goodbyes."],
                ["End conversation", "Ends and saves the conversation.", "Stops listening and clears the screen for the next one."],
                ["Don't save this conversation", "Marks the conversation private.", "Nothing said by either person is written down. A technical error is still noted, without any of the words."],
                ["Settings", "Opens the Settings Panel.", "The conversation is left as it is."],
            ], [2100, 3300, 3960]),
            emptyPara(),
            lead("Two of these are toggles on purpose. ", "Wrap up and Start conversation both replace what is on the Response Panel without saying anything, and a tap on either used to be impossible to take back. Pressing the same button again now restores exactly what it covered."),

            heading1("6.  The Express Panel During a Conversation"),
            para("The Express Panel holds the words the user needs instantly, such as yes, no, thank you and wait, and it is available at every moment of a conversation, including while the other person is still talking."),
            para("Tapping a phrase says it immediately. It does not wait for a pause, it does not need suggestions to have arrived, and it is recorded in the Conversation Log exactly as a chosen suggestion would be. If the other person was mid-sentence, what they had said up to that point is kept."),
            para("Some buttons on the panel do not speak at all. They tell the app who the user is with, where they are, and how they are feeling, and that shapes the suggestions from the next turn onward. Tapping one costs nothing and interrupts nothing."),
            lead("When the other person offers a choice ", "such as tea, coffee, or something cold, those alternatives appear as buttons at the end of the panel for that turn, and disappear afterwards. Tapping one does not say it; it asks for suggestions built around that answer, so the user can go from a bare “coffee” to a full reply about it."),

            heading1("7.  The Composition Pane"),
            para("“In my own words” opens the Composition Pane over the Response Panel, and the on-screen keyboard takes the place of the Express Panel if the user types that way. Nothing underneath is lost: closing it puts the suggestions back."),
            simpleTable(["What the user taps", "What happens"], [
                ["Speak", "The app says the typed words in the user's voice and records the exchange, exactly as choosing a suggestion would."],
                ["Reframe", "Nothing is said. The typed words are handed to the AI as a steer, and the four suggestions are rebuilt around them. Useful for supplying a fact the app could not know, or for asking for a different tone."],
                ["Cancel", "Closes the pane without saying anything. The suggestions that were underneath come back."],
            ], W2),
            emptyPara(),
            lead("Typing does not silence the holding phrases. ", "Composing is the user deciding what to say, exactly as reading the suggestions is, and it is the slower of the two, so it is the moment the other person most needs something to listen to. The app carries on filling the silence while the user types, up to the usual limit."),

            heading1("8.  Winding Up and Ending"),
            para("Ending a conversation is two steps, because that is how people do it. Wrap up offers statements that signal the user is finishing without actually saying goodbye. Choosing one speaks it, and then the goodbyes are offered."),
            para("If the other person starts closing first, the app offers goodbyes without being asked. One of the options on offer is a way to decline the closing, because being able to say that at that exact moment is the whole point of noticing the closing at all."),
            para("End conversation stops listening, saves what was said, and clears the screen. The next Start begins a fresh record."),

            heading1("9.  When Something Goes Wrong"),
            para("The flow above assumes everything is working. What the user actually sees when it is not:"),
            simpleTable(["What is wrong", "What the user sees"], [
                ["The AI cannot be reached", "The other person's words are still shown, and the user can still answer with the Express Panel or by typing. Suggestions are what is missing; nothing else stops."],
                ["No API key has been entered", "The same. The app works as a manual communication aid, and says so on the way in."],
                ["Speech recognition is not working", "Nothing appears in the Conversation Log while the other person talks. This is the failure that stops the loop, because everything downstream is built from what was heard."],
                ["The paid voice failed", "That one sentence is said in the device's voice instead, and the next one goes back to the paid voice. It is recorded, because it changes the voice the user speaks in."],
                ["Something was misheard", "The words appear as they were heard. The app no longer rewrites them, and it now notes any word it suspects was misheard, counted in the weekly report and not shown during the conversation."],
            ], W2),
            emptyPara(),
            lead("The general shape of it: ", "the AI is an enhancement, not a dependency. Without it the app is still a communication aid with a live transcript. Without speech recognition it is not, which is why that is the one to check first."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Conversation Flow.docx");
    fs.writeFileSync(out, buffer);
    console.log("Conversation Flow.docx generated ->", out);
});
