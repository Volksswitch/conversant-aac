/* Conversant AAC - Conversation Review (September 23 2026)
 *
 * The first of the four things Ken asked for, in his order: this document, then a UI
 * prototype the speech and language therapists can comment on, then an architecture
 * and UI design document, then the build. Nothing described here is built.
 *
 * Every design decision in here came out of a conversation with Ken on September 23
 * 2026, including three places where he corrected a position I had taken - grading the
 * set rather than the card, dismissing real-time playback, and stating that the app
 * must never give the user feedback. All three corrections are carried in the text
 * rather than quietly absorbed, because the reasoning is what stops them being
 * re-argued.
 *
 * Figures: node capture-review-figures.js  (from "Review Figures.html")
 *
 * AFTER GENERATING, run the post-processing chain or the document checker fails:
 *   python scripts/doc-generators/fix-drawing-ids.py   "<doc>"   (docx-js gives every
 *       image the same id; Word tolerates it, docx_safe refuses to write it)
 *   python scripts/doc-generators/apply-table-style.py "<doc>" --from "<Windows manual>"
 *   python scripts/doc-generators/apply-doc-style.py   "<doc>"
 * Those rewrite the file, so the manifest hash no longer matches and a later run of this
 * generator will REFUSE. That refusal is correct - check first that the document holds no
 * hand edits, then FORCE_DOC_WRITE=1 and run the chain again.
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, ImageRun,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// keepNext on the PARAGRAPH, not only on the style: the document checker reads each
// paragraph's own properties, so a heading that inherits the setting from its style
// still reports as able to be stranded at the foot of a page.
function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(text)] });
}
function para(text, opts = {}) {
    return new Paragraph({
        spacing: { before: 0, after: opts.after ?? 160 },
        children: [new TextRun({ text, ...opts.run })]
    });
}
function boldPara(label, text, after = 160) {
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

// Figures come from capture-review-figures.js. Scaled to the 6.5in text column:
// 820 css px wide becomes 624 px, a factor of 0.761.
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
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, keepNext: true,
            children: [new TextRun({ text, bold: true, size: 22 })] })]
    });
    const bodyCell = (cell, w) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const text = isObj ? cell.text : cell;
        const run = isObj
            ? new TextRun({ text, size: 22, italics: !!cell.italics, bold: !!cell.bold })
            : new TextRun({ text, size: 22 });
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
            new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
            ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => bodyCell(c, widths[i])) }))
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
            { reference: "goals",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "signals",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "stages",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "holds",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
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
            children: [new TextRun({ text: "Conversant AAC — Conversation Review", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  September 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            // ===== TITLE =====
            new Paragraph({
                spacing: { before: 240, after: 80 },
                children: [new TextRun({ text: "Conversation Review", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Going Back Over a Conversation You Have Already Had: What It Is For, What the User Does, and What the App Does With What They Say", italics: true, color: "595959", size: 24, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  September 2026  |  Last updated September 23, 2026", color: "808080", size: 20, font: "Arial" })]
            }),

            // ===== 1 =====
            heading1("1.  Why This Document Exists"),
            para("Conversant AAC has kept a detailed record of every conversation for some time, and has never had a way for anyone to look at one. This document proposes that way."),
            boldPara("Nothing here is built. ", "It is the first of four steps, in this order: this document, describing the purpose and shape of the feature; a working prototype of the screens, put in front of speech and language therapists for comment; a design document covering the architecture and the interface once the prototype has been vetted; and only then the build. The point of writing before building is that most of the hard choices here are about what to ask a user and what to do with the answer, and those are cheaper to get wrong on paper."),
            para("Section 12 lists the questions this document deliberately does not settle. Several of them are exactly what the therapists should be asked."),
            emptyPara(),

            // ===== 2 =====
            heading1("2.  What Review Is For"),
            boldPara("The idea the whole feature rests on: review is the only time the user can think about their own communication with nobody waiting. ", "During a conversation the entire design is fighting a four-second clock, because a silence longer than that is what makes people talk over an AAC user or answer for them. There is no room in that to consider whether a suggestion sounded right, and none at all to write something carefully. Review has no clock. So review should not only be looking back: it should be where the slow, careful work happens."),
            para("Five things a user might get out of it, in the order we think they matter."),
            bulletBold("Telling the app what it got wrong. ", "The strongest single use, and the one nothing else in the app can do. The record already knows which sets of suggestions the user walked away from, which turns sent them to the typing box, and which ones they asked to be redone. Those are precisely the moments where the app failed them, and at present nobody ever tells us why.", "goals"),
            bulletBold("Teaching the app how they want to sound. ", "When the user says “this one was right”, or writes what they would rather have said, that sentence becomes an example of their own voice. Examples are far more effective at shaping how the AI writes than any description of a person could be, and this is the only place in the app where they can be collected without the user being under time pressure.", "goals"),
            bulletBold("Turning repeated effort into a button. ", "If someone typed the same thing three times last week, review is where that becomes a button on the panel, or a phrase kept for one particular person.", "goals"),
            bulletBold("Reliving a conversation that mattered. ", "Not a lesser purpose, just a different one. Going back over an exchange with somebody they care about needs nothing except an accurate and readable record, and it does not have to justify itself by producing anything.", "goals"),
            bulletBold("Rehearsing, and being taught. ", "In practice conversations, where nothing is at stake and improving is the whole point, review can include the app talking through how it went. Section 9 explains why practice is a different case from a real conversation, in more ways than one.", "goals"),
            emptyPara(),

            // ===== 3 =====
            heading1("3.  What Review Is Not"),
            boldPara("The app does not grade the user. ", "Everything else in this product refuses to rank what the user chooses to say — the four suggestions are four different kinds of reply, deliberately not a best-to-worst list — and a review screen that scored their conversations would undo that in one stroke. It would also land on people who have spent decades being coached on how they communicate."),
            para("That rule needs a sharper edge than “no feedback ever”, though, because two different things are easy to run together."),
            simpleTable(
                ["", "Example", "Allowed?"],
                [
                    ["A remark about the exchange", "“That reply was short enough that it could read as curt.”", "Yes — it is about words, and it is checkable."],
                    ["A verdict on the person", "“You come across as abrupt.”", "No, permanently."],
                    ["A score, grade or progress chart", "“Your conversations improved 12% this week.”", "No, permanently."]
                ],
                [2400, 4400, 2560]
            ),
            emptyPara(),
            boldPara("Remarks about the exchange are never volunteered in a real conversation, are offered in practice, and are available anywhere the user asks for them. ", "Refusing feedback somebody has asked for is its own kind of condescension, and this product exists to avoid exactly that."),
            boldPara("One tempting argument does not hold, and is recorded here so it is not made again: ", "that feedback is unnecessary because the AI only ever offers safe options. It does not. The app deliberately offers a way to decline, and offers humor where the user has said they want it, and nothing anywhere checks that a particular suggestion suits the moment it arrived in. A card can land badly."),
            boldPara("Review must also never become a chore. ", "Answering questions is physically tiring for the people this product is for — that constraint shapes the whole “About Me” questionnaire, and it applies here just as hard. Nothing in review is required, every item can be skipped, and stopping loses nothing."),
            emptyPara(),

            // ===== 4 =====
            heading1("4.  What the App Already Remembers"),
            para("This feature is affordable because the record is already there. A saved conversation can be walked through moment by moment, and it holds more than a transcript."),
            bullet("What the other person said, as it accumulated — including the partial versions, so a turn that grew across several pauses can be seen growing.", "signals"),
            bullet("Every set of suggestions that appeared, when it appeared, how long it stayed, and how it ended — taken, replaced, regenerated, abandoned for the typing box.", "signals"),
            bullet("Which suggestion was taken, where it sat, and which of the four kinds of reply it was.", "signals"),
            bullet("What the user said, in which voice, with the exact wording that was handed to the speech service.", "signals"),
            bullet("Everything the app itself said out loud to hold the floor, and when.", "signals"),
            bullet("Who the user was talking with, where they were, how they said they felt, and which goals were switched on — each recorded at the moment it changed.", "signals"),
            bullet("Every time the microphone went on or off, every time the typing box was opened, and what was typed into it even when it was then abandoned.", "signals"),
            bullet("Any errors, in time order with everything else.", "signals"),
            emptyPara(),
            boldPara("One thing is missing and cannot be added: when the other person actually started and stopped speaking. ", "The app only learns their words when the transcription service delivers them, which is after the fact by an amount nobody can measure from inside the app. This matters in exactly one place — Section 7, where a silence is played back — and the consequence is that a replayed silence is shorter than the real one was."),
            emptyPara(),

            // ===== 5 =====
            heading1("5.  Getting In: Choosing a Conversation"),
            boldPara("Review lives in its own tab in Settings, alongside “Practice”. ", "It is an activity done outside a conversation, on purpose, in a quiet moment — which is what the Settings panel is for. It is deliberately not reachable from the conversation screen, where nothing may be added that could slow somebody down or be hit by mistake."),
            ...figure('rv-fig1.png', 820, 377, "Figure 1 — The way in. Conversations listed newest first, named by when, who, where and how long."),
            boldPara("The list is the main entry point, and the user chooses. ", "Some people will go through every conversation, especially anyone seriously trying to get the app to speak as them. Others will open only the two that bothered them. Both are correct, and the design should not imply that an unreviewed conversation is an outstanding task."),
            boldPara("Naming a conversation needs nothing new. ", "The date and time, the partner, the place and the length are all recorded already, so a row can be recognized at a glance without opening it."),
            boldPara("The app marks where it struggled, as a hint on the row rather than as the only way in. ", "Section 6 sets out what that mark is based on and what it honestly does and does not mean."),
            boldPara("Stopping and resuming has to work at the level of a single moment, not a whole conversation. ", "Somebody who works through four moments of a long conversation and puts the tablet down should come back to the fifth, so the row records how far they got."),
            emptyPara(),

            // ===== 6 =====
            heading1("6.  Looking at One Moment"),
            para("A moment is one exchange: what the other person said, the suggestions the user was offered, and what they did. This is the heart of the feature."),
            ...figure('rv-fig2.png', 820, 515, "Figure 2 — One moment. The four suggestions exactly as they appeared, the one that was spoken, and the two things the user can say about it."),

            heading2("6.1  Why the judgment is about one card and not the set"),
            boldPara("Asking for a score on all four suggestions would produce noise that looks like data. ", "The four are different kinds of reply by design — agreeing, declining, changing direction, asking for clarification — so on most turns only one or two are ever real candidates. Grading the other two would be grading cards the user never considered, and grading the set as a whole conflates “the two I thought about were poor” with “two of these were irrelevant to me, which is normal.”"),
            para("So the question is put in two short steps instead. Was any of these what you wanted to say? If one was closest, which one — and was it right, or merely the nearest of four? A card that was never in the running is never commented on, and that is the correct outcome rather than a gap in the data."),
            boldPara("Which card was closest is worth knowing in its own right. ", "Somebody who repeatedly says the declining suggestion was nearest, while actually speaking the agreeable one, has a problem with how the declining option is worded, not with the category. There is no other way to learn that: a record of what was chosen cannot distinguish a reply somebody wanted from the least bad of four under time pressure."),
            boldPara("This qualifies something the project had previously taken as settled. ", "The plan for teaching the app the user's voice treats a selection made during a live conversation as strong evidence of preference, on the grounds that behavior beats self-report. It is strong evidence of what they were willing to accept. It is not evidence of what they wanted, and only review can tell those apart."),

            heading2("6.2  Saying what they would rather have said"),
            boldPara("This is the main thing on the screen, not a fallback. ", "A bare “none of these were right” is close to useless — there is nothing the app can do with it except count it. A sentence in the user's own words is worth more than any number of grades, for three reasons: it is their own writing, which is the scarcest and most valuable material this project collects; it says directly what a record of choices can only hint at; and there is never time for it during a conversation."),
            boldPara("If typing is too much effort that day, the honest thing is to skip the moment ", "rather than leave behind a flag nobody can act on. A count of misses is a useful measure for us. It does nothing for the person who left it."),
            boldPara("The sentence can be spoken back. ", "Hearing it is the only way to judge whether it sounds right coming out of this device in this voice — the same reason the “About Me” answers and the voice comparison both have a way to hear them. Playing sound aloud is optional, since it fills the room; headphones or a private moment are the answer where that matters."),

            heading2("6.3  Commenting on the record"),
            boldPara("The user can say the app wrote down the wrong words, but they do not rewrite them. ", "A comment sits beside the record; the record stays as what actually happened. That keeps the saved conversation honest, and it gives us the more useful thing anyway: a growing picture of the conditions under which transcription struggles — which speech service, which person, a noisy room, a particular kind of word."),
            boldPara("There is nothing for the user to fix here, and the screen should not pretend otherwise. ", "A mishearing is handled while it happens, by asking the other person to repeat themselves. Afterwards it is a report, not a correction."),
            boldPara("⚠ The app cannot point a mishearing out, and the screen must never look as though it could. ", "If it knew the word was wrong it would have written the right one down. So nothing is marked until the user marks it, the control is offered on every moment rather than only on the ones that went wrong, and whatever they write appears beside the line labeled as theirs. A screen that showed the correction before they made it would be claiming knowledge the app does not have, and would quietly teach the user that the app catches its own mistakes."),
            boldPara("They may also say what the other person actually said, and it is optional. ", "That one word is the most useful thing in the whole report for us — it is the difference between knowing that transcription struggles and knowing which sounds it struggles with. It is asked for after the flag rather than instead of it, because somebody who only remembers that a line was wrong should still be able to say so."),
            boldPara("That box starts out holding what the app heard, so a mishearing is a one-word edit. ", "The alternative is retyping a whole sentence to change a single sound, which nobody will do twice — and this is a correction we actively want, so the cost of making it has to be close to nothing."),
            boldPara("⚠ Nothing the app says about a partner may guess at their gender. ", "The app records who the user was talking with, so its own labels use that person's name — \"What did Mom actually say?\", \"Mom waited twelve seconds\" — and where no name is known it says \"the other person\". This is not only a matter of courtesy: a pronoun the app picked is a fact it invented about somebody who never told it anything, in a product whose central discipline is never putting words or facts into anybody's mouth."),
            emptyPara(),

            // ===== 7 =====
            heading1("7.  Moving Through a Conversation, and Playing It Back"),
            para("There are three ways somebody might work through a conversation, and the prototype is where the choice between them should be made rather than here."),
            bulletBold("Stepping. ", "One moment at a time, with the next one arriving when the user is done. Fast, and it loses the timing completely.", "holds"),
            bulletBold("Scrolling the whole thing. ", "The conversation laid out as a transcript, with the user free to go straight to the part they remember. Best when they already know what they are looking for.", "holds"),
            bulletBold("Playing it back at the speed it happened. ", "The only one of the three that shows what the delays were like.", "holds"),
            ...figure('rv-fig3.png', 820, 409, "Figure 3 — Played at real speed, with the gaps shown as they open up."),
            boldPara("Real-time playback deserves to be built, and the reason is specific. ", "The problem this whole product exists to solve is the silence that opens up while an AAC user composes a reply. That silence is invisible in a transcript — reading a conversation, every turn follows the last immediately. Played at its real speed, the thirteen seconds the other person sat through is the first thing anybody notices, and it is the only route to a user deciding for themselves to shorten the pause before suggestions appear, or the delay before the app says something to hold the floor."),
            boldPara("It is a reconstruction, and the document should say so plainly wherever it is described to a user. ", "The other person's voice was never recorded, only their words, so their side is spoken by a substitute voice. Their real timing was never captured either, so the gaps are drawn from when their words arrived from the transcription service — which is later than when they stopped talking. A replayed silence is therefore, if anything, shorter than the one that actually happened. The difference between a two-second wait and a thirteen-second wait survives that imprecision easily, which is what makes the feature worth having anyway."),
            boldPara("A silent version does most of the same work. ", "The same walk-through with the clock running and the gaps opening on screen conveys the timing without filling the room, and it works in places where sound is not an option."),
            emptyPara(),

            // ===== 8 =====
            heading1("8.  What the App Does With What the User Says"),
            para("Review is only worth the effort if it changes something. What the user says in review sorts into a small number of destinations, and one of those destinations is “nothing”."),
            simpleTable(
                ["What the user says", "Where it goes", "What changes"],
                [
                    ["“This one was right”, or a sentence they typed", "Kept as an example of how they want to sound", "Suggestions gradually read more like them"],
                    ["A fact the app did not have — they love iced tea, their sister lives nearby", "“About Me”, the notes about that person, or the details of that place", "The AI can use it from then on"],
                    ["A phrase they keep reaching for", "A button on the Express Panel, for everyone or for one person", "One tap instead of typing it again"],
                    ["“It wrote down the wrong words”", "A comment beside the record, and a report to us", "Nothing for them; it tells us where transcription struggles"],
                    ["“It was too slow”, or a silence they could hear was too long", "A setting", "The timing changes"],
                    ["“Nothing was wrong — I just wanted to say something else”", "Nothing is fixed. The sentence is still kept.", "Only the voice examples"]
                ],
                [2900, 3300, 3160]
            ),
            emptyPara(),
            boldPara("That last row is important and should not be designed away. ", "A great deal of what somebody wishes they had said depended on something in their own head that morning — a plan, a joke, a decision they had just made. There was no fact missing from the profile and no setting that would have helped. If review pushes every correction into the profile, the profile fills up with entries that describe one afternoon and shape every conversation afterwards."),
            boldPara("But nothing they write is ever discarded. ", "Even a sentence that will never be said again is a sample of how this person writes, which is the material the voice work needs most. So the rule is: nothing is fixed, and the sentence is always kept."),
            ...figure('rv-fig4.png', 820, 449, "Figure 4 — Review proposes; the user decides. Nothing is added to the profile or the panel without being asked."),
            boldPara("Nothing changes without confirmation, and for the panel that is more than politeness. ", "Adding a button shifts every button after it, and button positions are learned by hand as much as by eye — the single thing the layout rules protect hardest. So a phrase is offered, never inserted."),
            boldPara("The choice between a phrase for everyone and a phrase for one person is asked at the only moment it can be answered well. ", "The person is right there in the record. Asked later, out of context, it is a much harder question."),
            boldPara("Whether the app should ever propose a fact for “About Me” is an open question. ", "Offering to remember that somebody likes iced tea is genuinely useful and saves a trip to a questionnaire nobody enjoys. It is also the app inferring a standing fact about a person from one afternoon, and a profile grown that way gets bloated and subtly wrong. Section 12 puts this to the therapists."),

            heading2("8.1  What leaves the device"),
            boldPara("Nothing the user writes in review is sent anywhere automatically. ", "That is the same promise the rest of the app makes, and review makes it more load-bearing rather than less: the sentences collected here are among the most personal things in the product."),
            boldPara("During the beta the weekly report may carry counts, and only counts: ", "how often a set of suggestions missed, how often the closest card was merely closest, how often review was used at all. No words, no sentences, no transcripts — the same rule the weekly report already follows."),
            boldPara("Sharing a conversation stays a deliberate act by the user. ", "Section 10 sets out why that matters more here than anywhere else in the app."),
            emptyPara(),

            // ===== 9 =====
            heading1("9.  Practice Conversations Are a Different Case"),
            boldPara("A practice conversation has no third-party privacy problem, because the other party is the app. ", "That one fact changes what is possible: a practice conversation can be shared with a clinician freely, where a real conversation carries the words of somebody who never agreed to be reviewed by anyone."),
            boldPara("It is also where being taught belongs. ", "There is no real person, nothing is at stake, and getting better is the entire purpose. Rehearsal with no debrief afterwards is half a feature. So at the end of a practice conversation the practice partner can offer to talk through how it went — remarks about the exchange, within the rule in Section 3, and never a score."),
            boldPara("A speech and language therapist has already asked for the surrounding piece: ", "the ability to write practice conversations for a client to work through, and to look at how the client got on. That is two separate things beyond this document — authoring a scenario, and handing it to a client's device and getting the result back — and both are recorded as work in their own right. It is worth noting here because it makes practice, not real conversation, the natural first place to build review: a named clinician wants it, and none of the consent questions apply."),
            emptyPara(),

            // ===== 10 =====
            heading1("10.  Privacy"),
            boldPara("A conversation the user asked not to save has no record, so there is nothing to review. ", "That is unchanged and is the strongest privacy control in the app."),
            boldPara("Every saved conversation contains another person's words, and they never agreed to be reviewed. ", "That is true today and review does not create it, but review is what makes it visible: it is one thing for a transcript to sit in a folder, and another for it to be played aloud, worked through, and possibly sent to a clinician."),
            bullet("Playing a conversation back out loud is audible to anybody in the room. Headphones or a private place are the answer, and the option to keep it silent must exist.", "holds"),
            bullet("Sharing a conversation with a therapist is a deliberate act, done through the existing export, with the user seeing what they are sending. There is no shared review session and no clinician login.", "holds"),
            bullet("The user's own written sentences — the most personal material review collects — never leave the device on their own.", "holds"),
            boldPara("The clinician reviews independently, from data the user chose to share. ", "That is simpler than a joint session to build and to explain, and it keeps the user in control of what a professional sees. It may need revisiting if the product widens to younger users or to people who cannot read, where a supporter is doing the reviewing with them rather than afterwards."),
            emptyPara(),

            // ===== 11 =====
            heading1("11.  What Review Cannot Do"),
            boldPara("The app cannot find the moment that mattered. ", "It can find where the user themselves said “not this” at the time, and that is a genuinely useful list. It cannot find the thing somebody said that landed hard, or the reply the user is still turning over two days later. Only they know that, which is why the list of conversations is the main entry point and the flagged moments are a hint on the row."),
            para("There are exactly three signals worth trusting, and all three are things the user did deliberately during the conversation."),
            bulletBold("They asked for different suggestions. ", "An unambiguous statement, made at the time, that the four on offer were not good enough.", "signals"),
            bulletBold("They opened the typing box after being offered suggestions. ", "They chose the slowest path in the app over anything the AI had written. Stronger still if they typed something and then abandoned it, because the words were kept.", "signals"),
            bulletBold("They steered the AI. ", "They typed a direction and asked for the suggestions to be rewritten around it, and that direction was saved.", "signals"),
            boldPara("Two tempting signals should be left out, because they mostly mean something else. ", "A set of suggestions that was replaced before anything was chosen looks like a failure and usually is not — on one real tester nearly half of all sets were replaced simply because the other person carried on talking. And a long pause before the user answered might be difficulty, or might be somebody reading carefully."),
            boldPara("Calling the result “interesting moments” would oversell it. ", "It is a list of moments where the user asked for something different, and it should be labeled as exactly that."),
            emptyPara(),

            // ===== 12 =====
            heading1("12.  Open Questions"),
            para("These are not being settled in this document. The first four in particular are what the prototype exists to answer, and are worth putting to the speech and language therapists directly."),
            bullet("Which way through a conversation should be the normal one: stepping moment by moment, scrolling a whole transcript and choosing where to stop, or playing it back at the speed it happened? Each suits a different reason for reviewing, and the answer may be that all three exist with one of them as the default.", "open"),
            bullet("Will a user actually write at length in review? The argument for it is that the clock is off. The argument against is that typing is tiring whether or not anybody is waiting, and the people this is for know that better than anybody.", "open"),
            bullet("Is a bare “none of these were right” worth collecting when no sentence follows it? It tells us something in aggregate and does nothing for the individual.", "open"),
            bullet("Should the app ever propose adding a fact to “About Me”, or should it only accept what the user offers? Proposing saves effort; proposing badly fills the profile with things that were true for one afternoon.", "open"),
            bullet("How many conversations would a real person review, realistically? The design assumes most conversations are never opened, and that assumption should be checked rather than hoped for.", "open"),
            bullet("Does the list of flagged moments help or does it annoy? It is the app saying where it thinks it did badly, which could read as useful or as the app steering the user's attention.", "open"),
            bullet("Does review need a summary view at all — how a week went, how often suggestions were used — or does anything of that shape slide into scoring the user?", "open"),
            emptyPara(),

            // ===== 13 =====
            heading1("13.  What Happens Next"),
            bullet("This document is read and marked up.", "stages"),
            bullet("A working prototype of the screens is built and put in front of the speech and language therapists, who comment on it. The prototype is a web page, not the app, so it can be changed quickly and shared by a link.", "stages"),
            bullet("A design document follows, covering the architecture and the interface, written against whatever the prototype settled.", "stages"),
            bullet("The feature is built — most likely for practice conversations first, for the reasons in Section 9.", "stages"),
            emptyPara(),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    const out = docPath('Conversant AAC Conversation Review.docx');
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out + ' (' + buffer.length + ' bytes)');
});
