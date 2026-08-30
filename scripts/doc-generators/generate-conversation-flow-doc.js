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
 * SECOND EDITION, August 27 2026. Ken read the first one: "The description of
 * conversation flow is too simplified. I was expecting a flow diagram with decision
 * blocks, recursion loops, and a separation of user vs. partner actions... In parallel
 * there are placeholder statements on a timer and the partner could be
 * restarting/continuing their exchange. None of this kind of complexity is represented."
 * He is right, and the first edition's Figure 1 was the problem: a single column of
 * boxes with one arrow between each pair, which can only ever describe a conversation
 * that goes exactly once round. What the app actually does is a loop with two nested
 * recursions in it and three things running at the same time.
 *   - Figure 1 is now a THREE-LANE flow chart (the other person / the app / you) with
 *     decision diamonds and the two loop-back arrows drawn.
 *   - Figure 2 opens out the decision the user is actually at, grouped by CONSEQUENCE
 *     rather than by which button it is - that grouping is the point, and it is what
 *     answers Ken's list.
 *   - Figure 3 opens a single pause into EIGHT LANES.
 *   - Figure 4 is the same eighteen seconds when the partner resumes.
 *   - Figure 5 is the closing sub-flow, including the branch that declines a closing.
 *
 * THIRD EDITION, August 27 2026. Ken again, on the pause timeline: "It needs to show
 * the user, STT module, app separately. The app should be broken into the placeholder
 * statement logic and the AI prompt logic. It should make clear that the STT is sending
 * chunks of words and how they are bundled, when the STT module determines that the
 * user has stopped talking and when (if) that determination is sent to the app, the
 * different timers that start at that point. A second picture should show how that
 * timeline changes if the partner resumes talking." And then: "the original document
 * documented the figures at the same level of detail (not much). Ensure that you are now
 * providing descriptive documentation that matches the detail of the figures."
 *
 * So the old Figure 3 (four coarse tracks) and the old Figure 4 (one pause, five bands)
 * were BOTH replaced by the eight-lane pair, and sections 5 and 6 were rewritten to walk
 * every lane rather than summarize the picture. The lanes are: the other person / speech
 * recognition / its own verdict / the words the app has / the Silence Period clock /
 * holding phrases / asking the AI / you.
 *
 * ⚠ THE ANSWER TO KEN'S "WHEN (IF) IS THAT DETERMINATION SENT TO THE APP" IS THE MOST
 * IMPORTANT THING THESE FIGURES SAY, and it is counter-intuitive: BOTH recognizers make
 * their own end-of-utterance decision and BOTH send it, and the app acts on NEITHER.
 * Read off the code, not the design record:
 *   - stt-deepgram.js handleMessage: speech_final is reported as ordinary final text and
 *     the comment states the rule - "the app's own silence period decides when a turn is
 *     over (that is a user-facing setting and must behave the same on every backend), so
 *     both are reported as final text and neither is allowed to drive turn-taking."
 *   - stt.js never binds onspeechend (grep count: zero). Only onresult, onend, onerror.
 *   - resetSilenceTimer is called from afterIngest, i.e. from the ARRIVAL OF A CHUNK. So
 *     the Silence Period is restarted by every chunk and can only run out after the last
 *     one - which is why it can never fire mid-sentence, and why it starts later than the
 *     moment the person actually stopped.
 *   - generateOptions takes `const token = ++generationToken` and returns early when the
 *     token has moved on, so a request superseded by a later pause is DISCARDED on
 *     arrival rather than shown. Figure 4 draws that case; the note beside it says the
 *     other case (answer back before the next pause, so it IS shown) is equally normal.
 *
 * ⚠ EVERY NUMBER AND EVERY BUTTON NAME HERE WAS READ OFF THE SHIPPED CODE, not off the
 * design record - the two have disagreed before. Checked:
 *   - defaults: silence 0.5s, first holding phrase 2s, later ones 10s, at most 2,
 *     resume-listening OFF, four suggestions (storage.js)
 *   - the Command Bar's accessible names (ui.applyControlIcons) - the markup still
 *     reads "Wind down" and the app renames it to "Wrap up" at startup
 *   - which handlers CLEAR the suggestions and which keep them (app.js): handlePardon
 *     calls clearPalette(); handleSayAgain and handleHoldOn deliberately do not. That
 *     distinction is drawn in Figure 2 and in the table in section 4, and it was the
 *     one thing the first edition got wrong by grouping them together.
 *
 * FOURTH EDITION, August 30 2026. Ken asked for the flow "in a format and a level of
 * detail similar to" a hand-drawn chart he supplied - the classic engineering form, boxes
 * and diamonds and off-page connectors - and said not to assume his own draft had captured
 * every path. Added as section 12 with figures 6-9 rather than by replacing figure 1: that
 * one is a three-lane summary of the whole loop and answers "who does what", where these
 * four pages answer "what happens next, on what condition". Both are wanted.
 *
 * ⚠ WHAT HIS DRAFT HAD, THAT THE CODE DOES NOT, since these are the corrections the new
 * figures encode and the same mistakes are easy to make again:
 *   - it gated the app's silence timer behind the recognizer's own end-of-speech verdict.
 *     There is no such gate. resetSilenceTimer is called from afterIngest, i.e. from the
 *     ARRIVAL OF A CHUNK, so the clock is restarted by every chunk (interim included) and
 *     the recognizer's verdict is ignored (stt.js binds no onspeechend; stt-deepgram.js
 *     reports speech_final as ordinary final text, with the reason in a comment).
 *   - it started the silence timer and the placeholder timer in PARALLEL at the pause.
 *     They are sequential: placeholders.arm() is called from handleSilencePeriod, i.e.
 *     AFTER the Silence Period has already elapsed. What is parallel is the placeholder
 *     ladder and the AI request, which is figure 7.
 *   - it showed the partner resuming as "stop silence timer". It RESTARTS it; what stops
 *     is the placeholder ladder (handlePartnerResumed -> placeholders.stop()).
 *   - it ended the ladder at "PH2 timer fires". The ladder loops on subsequentDelay until
 *     maxPlaceholders; 0 means none are ever scheduled (arm() returns early).
 *   - "AI returns 4 or 8 options" is one of four outcomes: also a closed-set palette, the
 *     goodbyes (CLOSING), the three repair-of-self cards (is_repair_initiator), and the
 *     superseded case, which is discarded on arrival and never shown.
 *   - auto-resume is gated on manualListenArmed as well as the setting, and an opener
 *     opens the microphone unconditionally (handleResponseSelected, wasOpener branch).
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
function bullet(text) {
    return new Paragraph({ numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 0, after: 80 }, children: [new TextRun(text)] });
}
function bulletLead(label, text) {
    return new Paragraph({ numbering: { reference: 'bullets', level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)] });
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
// "Conversation Flow Figures.html" (re-run it after editing that file). Every figure is
// captured 1052 css px wide and is scaled here to the 6.5in text column, so they all
// share one scale factor and text is the same size from one figure to the next.
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
const WACT = [2760, 2400, 4200];

const numbering = { config: ["flow", "bullets", "acts"].map((reference) => ({
    reference,
    levels: [{ level: 0,
        format: reference === "bullets" ? LevelFormat.BULLET : LevelFormat.DECIMAL,
        text: reference === "bullets" ? "\u2022" : "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
})) };

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
    numbering,
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC \u2014 Conversation Flow", italics: true, color: "808080", size: 18, font: "Arial" })]
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
                children: [new TextRun({ text: `Conversant AAC`, bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: `Conversation Flow`, bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: `How one conversation runs from start to finish: the decisions in it, the loops it goes round, what every button does to that flow, and what is happening at the same time.`, italics: true, size: 22, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 260 },
                children: [new TextRun({ text: `Kenneth R. Hackbarth  |  Volksswitch.org  |  August 2026  |  Last updated August 30, 2026`, size: 18, color: "777777" })] }),

            heading1(`1.  What This Is For`),
            para(`What the app does during a conversation is described a step at a time in the User Manual, and mechanism by mechanism in the design documents. Neither shows the shape of a whole exchange. This does.`),
            para(`It is written for anyone who needs to know what the app will do next: someone setting it up for a user, a therapist watching a session, or anyone reading a report and trying to work out why a conversation went the way it did.`),
            lead(`One thing to hold on to before the detail. `, `The app never speaks on its own initiative. It hears, it suggests, and it waits. The only words it says without being asked are the short holding phrases, and those exist so the other person is not left in silence while the user reads.`),

            heading1(`2.  Three Parties, and What Each One Decides`),
            para(`A conversation has three participants and it is worth keeping them apart, because almost every question about the flow turns out to be a question about which of them is deciding something.`),
            bulletLead(`The other person `, `talks, and pauses. They are told nothing about how any of this works, and they cannot see the screen. Everything they contribute is speech, and everything they experience is either the user's voice or silence.`),
            bulletLead(`The app `, `listens, writes down what it heard, asks the AI, and waits. It makes exactly three decisions of its own: whether a silence counts as a pause, when a holding phrase is due, and whether to turn the microphone back on after a reply. It never chooses what to say.`),
            bulletLead(`The user `, `decides everything else. No suggestion is spoken because the AI liked it; a suggestion is spoken because it was tapped.`),
            emptyPara(),
            para(`Figure 1 gives each of them a column, so that a step can be read off as much by who does it as by when.`),

            heading1(`3.  The Loop`),
            ...figure('cf-fig1.png', 1052, 1251, `Figure 1 - one conversation as a loop. The decision blocks are the three the app makes and the one the user makes; the arrows running back up the page are where a conversation actually spends its time.`),
            para(`Reading down the middle column:`),
            numBold(`You open the conversation. `, `"Start conversation" puts a set of openers on the Response Panel to choose from. "Start Listening" skips them and begins listening straight away, which is what you want when the other person is already talking.`, "flow"),
            numBold(`They talk, and the app stays quiet. `, `Their words appear in the Conversation Log as they are heard. The microphone stays on for the whole exchange.`, "flow"),
            numBold(`The first decision, and the app makes it: have they been quiet for the Silence Period? `, `If they have not, nothing happens and their words keep arriving - the short loop near the top of the figure. If they have, the app calls it a pause.`, "flow"),
            numBold(`At the pause, two clocks start, and neither waits for the other. `, `One asks the AI for suggestions. The other counts down toward a holding phrase.`, "flow"),
            numBold(`A holding phrase is spoken. `, `Two seconds after the pause by default - I am thinking about that. It fills the gap while the user reads. It is not an answer, and because it never waits for the AI it still happens when the AI is slow or cannot be reached at all.`, "flow"),
            numBold(`Four suggestions replace whatever was on the panel. `, `A plain reply, a way to decline, a way to take the lead, and a way to ask for clarification. In practice they arrive four to eight seconds after the pause.`, "flow"),
            numBold(`The second decision, and this one is yours. `, `There are fifteen things you can do at this point and they do three different sorts of thing to the flow. Section 4 is entirely about this one step.`, "flow"),
            numBold(`If you answered, the app says it in your voice, `, `and writes the exchange to the Conversation Log and to the saved conversation.`, "flow"),
            numBold(`The third decision, back with the app: does listening resume by itself? `, `Only if "Resume listening automatically" is turned on, which it is not by default. Otherwise the user taps Listen when they are ready. Either way the loop returns to the top.`, "flow"),
            emptyPara(),
            lead(`The arrows that run back up the page are the point of the figure. `, `There are three of them, and each is a different kind of repetition. The short one at the top is the other person still talking, which happens many times inside one turn. The one on the right is the user doing something that does not answer, and finding themselves at the same decision again. The long one down the left is a finished exchange handing back to the next one. A conversation is almost entirely made of those three.`),
            para(`Section 12 draws the same loop a second time, as an engineering flow chart over four pages, for anyone who wants the condition on every branch spelled out.`),
            lead(`Why the default is to wait. `, `Resuming automatically is faster, and it means the microphone comes back on without anybody deciding that it should. Leaving it off makes every listening period something the user chose. Either is defensible; the app ships with the deliberate one.`),

            heading1(`4.  What You Can Do When Suggestions Are on Screen`),
            para(`This is the moment Figure 1 calls "What do you do next?". It is where a conversation waits, and it is the step the first version of this document flattened into a single line. Nothing happens until the user acts, and there are fifteen ways to act.`),
            ...figure('cf-fig2.png', 1052, 790, `Figure 2 - the same fifteen actions, grouped by what each one does to the turn rather than by which part of the screen the button is on.`),
            para(`The grouping matters more than the list. Every one of these is reachable at the same moment, and the only thing that distinguishes them is whether something is said, and whether the suggestions on screen survive it.`),
            emptyPara(),
            simpleTable([`What you do`, `Is anything said?`, `What happens to the suggestions`], [
                [`Tap a suggestion`, `Yes, in your voice`, `They clear. The exchange is recorded, and listening resumes or waits.`],
                [`Tap an Express Panel phrase`, `Yes, at once`, `They clear. It does not wait for a pause, and it works even while the other person is still talking.`],
                [`Type it, then tap Speak`, `Yes, in your voice`, `They clear, exactly as choosing a suggestion would.`],
                [`Ask them to repeat`, `Yes - a phrase asking them to say it again`, `They clear, and the floor goes back to the other person. What was already heard is kept, and their repeat starts a fresh turn.`],
                [`Hold on`, `Yes - a holding phrase you picked`, `They stay in front of you. Drawn from the same phrases the app uses by itself, and it will not repeat the one just spoken.`],
                [`Repeat what I said`, `Yes - your own last words again`, `They stay in front of you.`],
                [`New 4`, `No`, `Replaced by a different set for the same thing they said.`],
                [`Reframe`, `No`, `Rebuilt around what you typed, which the AI is given as a steer rather than as something to say.`],
                [`A choice button`, `No`, `Rebuilt around the alternative you picked, so you can go from a bare "coffee" to a full reply about it.`],
                [`The number button`, `No`, `Left alone. The number keys open, for when they have asked you for a number.`],
                [`Who you are with`, `No`, `Left alone now; the suggestions are shaped by it from the next turn onward.`],
                [`Where you are`, `No`, `The same. Tapping it costs nothing and interrupts nothing.`],
                [`How you are feeling`, `No`, `The same.`],
                [`Wrap up`, `No`, `Replaced by the wind-down statements. Press the same button again to put back what it covered.`],
                [`Start conversation`, `No`, `Replaced by the openers, and the same toggle applies. The old conversation is closed only when an opener is actually chosen.`],
            ], WACT),
            emptyPara(),
            lead(`The one that catches people out is "Ask them to repeat". `, `It sits with "Hold on" and "Repeat what I said" on the screen and it behaves like the answering group: it clears the suggestions. That is correct rather than inconsistent - the other two are things you say while you keep thinking, and asking them to repeat hands the turn back, so the suggestions on screen were built from a sentence you have just said you did not catch.`),
            lead(`Everything on that list is available at every one of those moments. `, `There is no state in which some of them are unavailable and no order they must be used in. A user can tap a choice button, then "New 4", then type something and press "Reframe", then tap "Hold on" because it is taking a while, and only then answer - and each of those loops back to the same place.`),

            heading1(`5.  What a Pause Actually Is`),
            para(`The Silence Period is the setting people ask about most, and it is the one most easily misread. It does not measure the silence you can hear, and the app does not simply wait for the speech recognition to say that the other person has finished. Figure 3 puts every part of it in its own lane.`),
            ...figure('cf-fig3.png', 1052, 772, `Figure 3 - one pause, with every part in its own lane. Eighteen seconds, left to right. The vertical lines are, in order: they stop talking, their last chunk of words lands, the app declares a pause, and the suggestions arrive.`),
            para(`Reading down the lanes:`),
            numBold(`The other person. `, `What somebody standing in the room would hear. They speak for about four seconds and stop. Nothing else on the diagram happens at that instant, which is the first surprise: at the moment they stop talking, no part of the app knows it yet.`, "flow"),
            numBold(`Speech recognition. `, `The service does not hand over one block of text when they finish. It sends the words back in a stream of chunks a few tenths of a second apart, each carrying what it has settled on so far. Every tick on that lane is one arrival. The heavier tick at the end is their last chunk, and it lands after they have already stopped talking, because recognition runs online and takes a moment to come back.`, "flow"),
            numBold(`Its own verdict. `, `Both recognizers decide for themselves that the speaker has finished, and both announce it. The app does not act on it. The Silence Period belongs to the user, it is a number they can change, and it has to mean the same thing whichever recognizer is in use - so the app makes its own decision from the arrival of the chunks and treats the recognizer as a source of text and nothing else. That lane is the one thing on the diagram that is sent and deliberately not used.`, "flow"),
            numBold(`The words the app has. `, `Each chunk is added to the ones before it, separated by a single space, so what builds up is one growing turn rather than a list of fragments. That is what appears in the Conversation Log while they are still speaking, and it is also what makes "Ask them to repeat" able to drop only the last thing they said rather than the whole turn.`, "flow"),
            numBold(`Is this a pause? `, `This is the Silence Period clock, and the mechanism is the whole point: every arriving chunk restarts it. While somebody is talking the chunks arrive faster than the clock runs, so it can never reach the end - which is exactly what stops the app interrupting mid-sentence. The only time it runs to completion is after the last chunk, and at the default setting that takes half a second. That short solid block is the only moment on the whole diagram at which the clock actually finishes.`, "flow"),
            numBold(`Holding phrases. `, `Not running at all until the pause. Then two seconds, then a phrase is spoken, then ten seconds before another would be due - at most two in one turn by default.`, "flow"),
            numBold(`Asking the AI. `, `One request, sent at the same instant the holding-phrase clock starts. The two never wait for each other, and that independence is deliberate: it is why a holding phrase is still spoken when the AI is slow, failing, or has no key at all.`, "flow"),
            numBold(`You. `, `Nothing to read until the suggestions land, typically four to eight seconds after the pause. On the very first exchange the panel is genuinely empty; on every later one it is still holding the previous set.`, "flow"),
            emptyPara(),
            lead(`What follows from all that. `, `The pause the other person actually experiences is longer than the number in Settings: it is the recognition delay plus the Silence Period. That delay varies with the connection and no setting can change it. So a Silence Period of half a second does not mean the app pounces half a second after somebody stops; in practice the real pause is closer to a second.`),
            para(`It also explains a complaint that sounds like a contradiction: that the app both interrupts too eagerly and takes too long. Those are different moments. Being cut off early is the Silence Period running out while the person was only drawing breath - which happens when their chunks stop arriving for a moment, not when they have finished. The wait before suggestions appear is the AI, and the holding phrase is what covers it.`),
            emptyPara(),
            simpleTable([`Setting`, `Default`, `What raising it does`], [
                [`Silence period`, `0.5 seconds`, `Gives the other person longer to pause mid-sentence without the app deciding they have finished. Costs a longer wait before suggestions start being prepared. Range 0 to 3 seconds; at 0 the app acts the moment the recognizer settles a chunk.`],
                [`Initial delay`, `2 seconds`, `How long after the pause the first holding phrase is spoken. Raise it if the app feels quick to fill a silence; lower it if the gap feels awkward.`],
                [`Subsequent delay`, `10 seconds`, `The gap before another holding phrase, measured from the end of the last one, if the user is still choosing.`],
                [`Maximum per turn`, `2`, `How many holding phrases one turn may have. 0 means none at all; No limit keeps them coming.`],
            ], W3),

            heading1(`6.  When They Start Talking Again`),
            para(`People do not speak in tidy turns. They pause, and carry on. The app is built around that rather than against it: every pause is a checkpoint, not an ending. Figure 4 is the same eighteen seconds as Figure 3, with one difference - after the first pause they start up again.`),
            ...figure('cf-fig4.png', 1052, 772, `Figure 4 - the same lanes when the other person resumes. Everything up to the first pause is identical to Figure 3; the vertical lines are the first pause, the moment they start again, the second pause, and the suggestions finally arriving.`),
            para(`What changes, lane by lane:`),
            numBold(`The other person `, `speaks twice, with about a second and a half of quiet between. To them it is one thought with a breath in the middle.`, "acts"),
            numBold(`Speech recognition `, `stops sending chunks, then starts again. Nothing in the stream marks the two bursts as separate; they are simply chunks, with a gap.`, "acts"),
            numBold(`Its own verdict `, `says they have stopped - twice - and the first time it was wrong. That is worth noticing on its own: a recognizer that had been allowed to end the turn would have ended it in the middle of what they were saying. The app not using that signal is what makes the second burst join the first.`, "acts"),
            numBold(`The words the app has `, `grow into one turn, not two. The second burst is appended to the first, and when the app asks the AI it sends the whole thing. This is why a partner who thinks out loud is not turned into a series of disconnected fragments.`, "acts"),
            numBold(`Is this a pause? `, `The clock behaves exactly as before - restarted by every new chunk, and running to completion only after their last one. It finishes twice, so there are two pauses in one turn.`, "acts"),
            numBold(`Holding phrases `, `are the visible casualty. The clock had been counting since the first pause and was a little over half a second from speaking; the moment they started again it was reset, and nothing was said. Only after the second pause does it run its two seconds through and speak. The app will not talk over somebody who has resumed.`, "acts"),
            numBold(`Asking the AI `, `is the lane that surprises people. Two requests overlap. The first is not canceled when they start talking again - it is still out there - and it is not canceled when the second one is sent either. It is superseded: when its answer comes back at 10.3 seconds the app has already asked again with the fuller sentence, so the older answer is discarded rather than put on screen.`, "acts"),
            numBold(`You `, `wait about ten seconds rather than about five. Not because anything went wrong, but because the clock effectively restarts at their last pause.`, "acts"),
            emptyPara(),
            lead(`Whether that first answer is thrown away depends purely on timing, `, `and both outcomes are normal. If it comes back before the next pause it is shown, and the fuller set replaces it a few seconds later - so the panel fills, then improves. If it comes back after the next pause, as in Figure 4, it is discarded and the panel stays as it was. Either way the user is never shown suggestions built from half a sentence while a better set is already on its way.`),
            lead(`The rule that holds all of this together: `, `the suggestions are never emptied and refilled. They are only ever replaced by a new set, at the moment that set is ready. There is no point at which the user is looking at an empty panel because the app is busy.`),
            para(`Five things replace the set on screen, and nothing else does:`),
            bullet(`The other person said more, and paused again.`),
            bullet(`The user pressed "New 4", asking for a different set for the same turn.`),
            bullet(`The user typed something and pressed "Reframe".`),
            bullet(`The user tapped one of the choices the other person had offered.`),
            bullet(`The kind of moment changed: the other person began saying goodbye, or asked the user to repeat themselves.`),
            para(`The suggestions clear only when something has been spoken, or when the conversation ends.`),
            lead(`The user is never locked out while any of this is going on. `, `A suggestion already on screen can be tapped, an Express Panel phrase can be spoken, or the Composition Pane can be opened, at any point. Any of those abandons the set that was on its way.`),
            emptyPara(),
            lead(`One limitation worth knowing. `, `While a holding phrase is actually playing, the app cannot reliably tell that the other person has started talking again, because the microphone is hearing the app's own voice and has no way to separate the two. Somebody who cuts in mid-phrase is not noticed until it finishes. Cutting in between phrases - which is what Figure 4 shows - is caught on the very first chunk.`),

            heading1(`7.  The Command Bar, Button by Button`),
            para(`The Command Bar sits between the Conversation Pane and the Response Panel. Its buttons are icons with no text; the names below are what a screen reader announces, and what this document and the manual call them.`),
            simpleTable([`Button`, `What it does`, `What it does to the flow`], [
                [`Start Listening`, `Turns the microphone on and off.`, `Turning it off and on again mid-turn does NOT throw away what was already heard. It is a pause, and the rest of what they say is added to the same turn.`],
                [`Start conversation`, `Puts a set of openers on the Response Panel.`, `A toggle: press it again and whatever was on screen comes back, with nothing said and nothing ended. The previous conversation is closed only when an opener is actually chosen.`],
                [`Repeat what I said`, `Says the user's last utterance again.`, `Stops any holding phrase at once. The other person's turn stays open and the suggestions stay on screen.`],
                [`Hold on`, `Says a holding phrase, chosen by the user rather than by the clock.`, `Draws on the same phrases the app uses automatically, and will not repeat the one just spoken. The suggestions stay on screen.`],
                [`Ask them to repeat`, `Says a phrase asking the other person to say it again.`, `Keeps what was already heard, clears the suggestions, and starts a fresh turn for the repeat, so the two are not run together.`],
                [`Wrap up`, `Offers ways to signal the conversation is finishing.`, `A toggle, like "Start conversation": press again to put back what was there. Choosing one speaks it and then offers the goodbyes.`],
                [`End conversation`, `Ends and saves the conversation.`, `Stops listening and clears the screen for the next one.`],
                [`Don't save this conversation`, `Marks the conversation private.`, `Nothing said by either person is written down. A technical error is still noted, without any of the words.`],
                [`Settings`, `Opens the Settings Panel.`, `The conversation is left as it is.`],
            ], [2100, 3300, 3960]),
            emptyPara(),
            lead(`Two of these are toggles on purpose. `, `"Wrap up" and "Start conversation" both replace what is on the Response Panel without saying anything, and a tap on either used to be impossible to take back. Pressing the same button again now restores exactly what it covered.`),

            heading1(`8.  The Express Panel During a Conversation`),
            para(`The Express Panel holds the words the user needs instantly, such as yes, no, thank you and wait, and it is available at every moment of a conversation, including while the other person is still talking.`),
            para(`Tapping a phrase says it immediately. It does not wait for a pause, it does not need suggestions to have arrived, and it is recorded in the Conversation Log exactly as a chosen suggestion would be. If the other person was mid-sentence, what they had said up to that point is kept.`),
            para(`Some buttons on the panel do not speak at all. They tell the app who the user is with, where they are, and how they are feeling, and that shapes the suggestions from the next turn onward. Tapping one costs nothing and interrupts nothing.`),
            lead(`When the other person offers a choice `, `such as tea, coffee, or something cold, those alternatives appear as buttons at the end of the panel for that turn, and disappear afterwards. Tapping one does not say it; it asks for suggestions built around that answer, so the user can go from a bare "coffee" to a full reply about it. When they ask for a number instead - a date, a time, how many - a number button appears in the same way and opens the number keys.`),

            heading1(`9.  The Composition Pane`),
            para(`"In my own words" opens the Composition Pane over the Response Panel, and the on-screen keyboard takes the place of the Express Panel if the user types that way. Nothing underneath is lost: closing it puts the suggestions back.`),
            simpleTable([`What the user taps`, `What happens`], [
                [`Speak`, `The app says the typed words in the user's voice and records the exchange, exactly as choosing a suggestion would.`],
                [`Reframe`, `Nothing is said. The typed words are handed to the AI as a steer, and the four suggestions are rebuilt around them. Useful for supplying a fact the app could not know, or for asking for a different tone.`],
                [`Cancel`, `Closes the pane without saying anything. The suggestions that were underneath come back.`],
            ], W2),
            emptyPara(),
            lead(`Typing does not silence the holding phrases. `, `Composing is the user deciding what to say, exactly as reading the suggestions is, and it is the slower of the two, so it is the moment the other person most needs something to listen to. The app carries on filling the silence while the user types, up to the usual limit.`),

            heading1(`10.  Ending a Conversation`),
            para(`Ending a conversation is two steps, because that is how people do it, and it can be started from either side. Figure 5 shows both routes and the point at which they join.`),
            ...figure('cf-fig5.png', 1052, 741, `Figure 5 - the closing, from both directions. The branch on the right is the one people do not expect: an offer to finish can be declined.`),
            lead(`Starting it yourself. `, `"Wrap up" replaces the Response Panel with statements that signal the user is finishing without actually saying goodbye - I should get going, it has been good talking to you. Nothing is said by pressing the button, and pressing it again puts back exactly what it covered, so a mis-hit costs nothing. Choosing one speaks it, and the goodbyes are then offered by themselves.`),
            lead(`When they start it. `, `A closing rarely begins with the word goodbye. It begins with something almost empty - anyway, so, right, I should let you go, see you Tuesday - and the app is looking for exactly that. When it recognizes one, it offers the goodbyes without being asked, so the user does not have to find the button while the other person is already leaving.`),
            lead(`Declining a closing. `, `On that branch, and only on that branch, one of the cards is a way not to finish: Actually, before you go. It is offered only when the other person started the closing, because that is the one moment at which declining is the natural thing to say - and without it the user's only options at that moment would be to say goodbye or to leave the palette entirely. Choosing it abandons the closing and puts the conversation back where it was, and the loop in Figure 1 carries on as though nothing had happened.`),
            lead(`Saying goodbye. `, `Choosing a goodbye speaks it and then offers the goodbyes again, because the other person will usually say goodbye back and the user will want to answer. If none of the offered farewells fits, "New 4" pages through the rest of the list rather than asking the AI for more - these are the user's own phrases, edited in Settings, not generated ones.`),
            lead(`Finishing. `, `"End conversation" stops listening, saves what was said, and clears the screen. The next Start begins a fresh record. It can be pressed at any point, including instead of any of the above.`),

            heading1(`11.  When Something Goes Wrong`),
            para(`Everything above assumes the parts are working. What the user actually sees when they are not:`),
            simpleTable([`What is wrong`, `What the user sees`], [
                [`The AI cannot be reached`, `The other person's words are still shown, and the user can still answer with the Express Panel or by typing. Suggestions are what is missing; nothing else stops. The holding phrases still play, because they never waited for the AI in the first place.`],
                [`No API key has been entered`, `The same. The app works as a manual communication aid, and says so on the way in.`],
                [`Speech recognition is not working`, `Nothing appears in the Conversation Log while the other person talks. This is the failure that stops the loop, because everything downstream is built from what was heard.`],
                [`The paid voice failed`, `That one sentence is said in the device's voice instead, and the next one goes back to the paid voice. It is recorded, because it changes the voice the user speaks in.`],
                [`Something was misheard`, `The words appear as they were heard. The app no longer rewrites them, and it now notes any word it suspects was misheard, counted in the weekly report and not shown during the conversation.`],
            ], W2),
            emptyPara(),
            lead(`The general shape of it: `, `the AI is an enhancement, not a dependency. Without it the app is still a communication aid with a live transcript. Without speech recognition it is not, which is why that is the one to check first.`),

            heading1(`12.  The Same Conversation, Drawn as a Flow Chart`),
            para(`The figures above answer "what happens, and why." This section answers a narrower question: what happens next, exactly, and on what condition. It is the same conversation drawn the way a flow chart draws things - one step to a box, a diamond wherever something is decided, and a numbered circle where the line runs off one page and picks the conversation up on another. Nothing in it is new behavior. It is the same loop at a finer grain, and it is the form to reach for when you are trying to work out why one particular session went the way it did.`),
            para(`The four circles carry the line between the pages:`),
            simpleTable([`Circle`, `Where the line goes`], [
                [`1`, `Listening. The microphone is on and the other person is talking. Page 1, middle.`],
                [`2`, `A pause. The app has decided they have stopped. End of page 1, top of page 2.`],
                [`3`, `Suggestions are on the Response Panel and the app is waiting. End of page 2, top of page 3.`],
                [`4`, `Wrapping up. End of page 3, top of page 4.`],
            ], W2),

            heading2(`12.1  Page 1 - opening, listening, and how a pause is decided`),
            ...figure('cf-fig6.png', 1052, 1398, `Figure 6 - page 1 of the flow chart. The lower half is the part worth reading twice: the clock that declares a pause is restarted by every arriving chunk of words, not started when the other person stops.`),
            lead(`Two ways in. `, `"Start conversation" fills the Response Panel with openers and does nothing else - nothing is said and nothing is ended by pressing it, and pressing it a second time puts back whatever it covered. Choosing an opener is the moment things actually happen: it is said in the user's voice, any conversation still open is closed and a new record begun, and the microphone opens. That last one is unconditional. It does not consult "Resume listening automatically", because the user has just spoken and a reply is coming. The other way in is "Start Listening", which skips the openers and is what you want when the other person is already talking.`),
            lead(`The listening loop. `, `Words arrive from the recognizer in chunks, several a second while someone is talking. Each chunk joins the turn and restarts the Silence-Period clock. The pause is declared when the clock runs out with no new chunk, and two things follow that are easy to get the wrong way round. The clock can never run out mid-sentence, because more words are still arriving. And it starts later than the moment the person actually went quiet, by however long the recognizer took to deliver their last words - so the silence the other person experiences is always somewhat longer than the number in Settings.`),
            lead(`The recognizer's own verdict is not used, and that is deliberate. `, `Both recognizers decide for themselves when someone has finished, and both tell the app. The app acts on neither. The Silence Period is a setting the user owns, and it has to mean the same thing whichever recognizer they are on, which it would not if one of them were allowed to declare turns of its own. The single exception is the setting at 0, which means "as soon as possible": there the pause fires the moment the recognizer settles a phrase, with a short fallback in case it never does.`),
            lead(`The app's own voice is filtered out. `, `While the app is speaking, and for a moment and a half afterwards, anything the microphone picks up is set aside: it does not join the turn, it does not restart the clock, and it cannot declare a pause. Without that, a holding phrase would be heard as the other person talking and the app would answer itself. The microphone is deliberately not muted, so somebody talking over the app is still heard.`),

            heading2(`12.2  Page 2 - the two things that start at a pause`),
            ...figure('cf-fig7.png', 1052, 1208, `Figure 7 - page 2. The two columns start at the same instant and neither waits for the other, which is the whole reason a holding phrase still gets spoken when the AI is slow.`),
            lead(`They are independent, and that is the point. `, `The left column counts down to a holding phrase. The right column writes down what was heard and asks the AI. Neither knows what the other is doing. If the AI takes six seconds, the holding phrase still lands at two; if the AI cannot be reached at all, the holding phrase still lands at two.`),
            lead(`The left column. `, `The first phrase is spoken after the initial delay, two seconds by default. Every later one waits the subsequent delay, ten seconds by default, and the ladder stops when it reaches the maximum for the turn, two by default. Set the maximum to none and nothing is ever spoken automatically, which is a legitimate way to run the app. Three things stop the ladder outright: the user saying anything, the other person starting to talk again, and the one turn where a holding phrase would be wrong, which is the turn where they have asked the user to repeat themselves.`),
            lead(`The right column. `, `What was heard is written to the saved conversation first, replacing the line written at the previous pause, so the record matches the screen even if the conversation is abandoned from here. Then the AI is asked, with the whole conversation so far and everything heard in this turn. If another pause has already asked again by the time the answer arrives - which happens whenever the other person carried on talking - the answer is thrown away unseen, because a newer one is coming that knows more. The other case is just as ordinary: the answer arrives before the next pause, is shown, and is replaced a few seconds later by a fuller set.`),
            lead(`Three kinds of answer. `, `Usually it is four suggestions, or eight if the user has asked for two of each kind. If the other person offered a list of things to choose between, it is one card for each thing they offered instead. If they were starting to say goodbye, it is the goodbyes. And if they were asking the user to repeat themselves, it is three ways to say the user's own last words again.`),

            heading2(`12.3  Page 3 - the decision the user is actually at`),
            ...figure('cf-fig8.png', 1052, 1188, `Figure 8 - page 3, grouped by consequence. Three of the four branches lead straight back to the same decision, which is where a conversation spends most of its time.`),
            lead(`Only one group ends the turn. `, `Tapping a suggestion, tapping an Express Panel phrase, and typing something and tapping Speak all do the same three things: the words are said in the user's voice, the exchange is written down, and the app decides whether to listen again. Everything else on the page leaves the turn open.`),
            lead(`The one that catches people out. `, `"Ask them to repeat" sits beside "Hold on" and "Repeat what I said" on the screen and behaves differently from both. All three say something, but only this one hands the floor back, so only this one clears the suggestions. What was already heard is kept as a turn of its own, and their repeat begins a fresh turn after it rather than being run onto the end of the old one.`),
            lead(`Nothing is emptied while the user is reading. `, `A new set of suggestions replaces the old one at the moment it is ready. The panel is never blanked in the meantime, so there is no window in which the user has nothing to choose from. That is as true of a set the app fetched by itself as of one the user asked for.`),
            lead(`Whether listening resumes. `, `It does only if "Resume listening automatically" is on and the user has tapped Listen at least once this session. It is off to begin with, and a manual stop withdraws the permission until the user taps Listen again. Otherwise the app waits, and the user opens the microphone when they are ready.`),

            heading2(`12.4  Page 4 - wrapping up and ending`),
            ...figure('cf-fig9.png', 1052, 1261, `Figure 9 - page 4. Two entrances, because a closing can be started by either side, and they meet at the goodbyes.`),
            lead(`Both entrances can be backed out of, and neither of them says anything. `, `Pressing "Wrap up" replaces the suggestions with the wind-down statements; pressing it again puts back exactly what it covered. When the other person starts a closing, the goodbyes appear on their own, with one extra card that holds them back for a moment - and choosing that card reopens the conversation and the microphone rather than ending anything.`),
            lead(`Saying goodbye is a loop. `, `Choosing one speaks it and offers the goodbyes again, because the other person will usually say goodbye back and the user will want to answer. If none of them fits, "New 4" pages through the rest of the user's own list rather than asking the AI for more.`),
            lead(`"End conversation" is the only thing that ends a conversation, `, `and it is available from any step on any of these four pages. It stops listening, writes anything the other person had half-said to this conversation rather than losing it, clears the panel and the log, and clears who the user is with and how they are feeling. Where they are stays, because ending a conversation does not move them.`),

            heading2(`12.5  What these four pages do not draw`),
            para(`Four things are deliberately left off, so that what is drawn stays readable:`),
            bulletLead(`Repeating yourself. `, `When the other person asks the user to repeat, the three cards that appear are say it again exactly, say it another way, and say more about it. They arrive on page 2 and are chosen on page 3 like any other card. The only difference worth knowing is that the second and third are still being written when they first appear, and gain their real wording a second or two later.`),
            bulletLead(`Practice Mode. `, `The chart is the same one, with the microphone replaced by the AI playing the other person. "Start Listening" cues them to speak instead of opening a microphone, and it honors the same permission, so practice rehearses the real rhythm rather than a shortcut.`),
            bulletLead(`Everything in Settings, `, `including editing the phrases, the panel and the keyboard. None of it is part of a conversation, and most of it cannot be reached during one.`),
            bulletLead(`The keyboard itself. `, `Typing, word prediction and the number keys all sit inside the one box on page 3 that says the user typed something.`),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Conversation Flow.docx");
    fs.writeFileSync(out, buffer);
    console.log("Conversation Flow.docx generated ->", out);
});
