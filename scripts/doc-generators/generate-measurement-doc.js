// Generates docPath("Conversant AAC Measurement Plan.docx") — what the app can and
// cannot measure about the user and the communication partner, written against the
// shipped code (usage-summary.js, weekly-send.js, diagnostics.js, storage.js) and the
// three measurement gaps named in the Strategic Assessment.
// Run: node generate-measurement-doc.js
const { docPath } = require('./doc-paths');   // resolves output, whatever the CWD
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
function numBold(label, text, ref) {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 100 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
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

const W3 = [3000, 3400, 2960];
const W3b = [2600, 4000, 2760];

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
            { reference: "findings",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "priority",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "headline",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Measurement Plan", italics: true, color: "808080", size: 18, font: "Arial" })]
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
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Measurement Plan", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "What the app can measure today about the user and the communication partner, what it records but does not report, and what it cannot see at all", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Prepared by Claude at Ken Hackbarth's request  |  August 16, 2026  |  Revised the same day, after the first five items were built", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. Why This Document Exists"),
            para("The Strategic Assessment named three measurement gaps: define the headline success metrics before beta rather than during it; the partner is unmeasured, and the partner is the thesis; and reading load under time pressure has never been measured. Ken asked whether the project's measurement capability had ever been written down in one place."),
            para("It had not. Measurement decisions are scattered across the decision record, the Beta Test Plan appendix, and the code itself, and no document says plainly what the app can count today. This document is that inventory. It is written against the shipped code, not against the design notes, so where the two disagree the code wins and the disagreement is called out."),
            para("The purpose is a decision, not a dashboard. With a handful of testers these numbers rank things and generate questions; they do not answer why anyone stopped. Every number below is interview fuel."),
            para("REVISED THE SAME DAY. Ken read the first version and directed that the first five items of Section 10 be built, which was done. This version describes the app as it now stands, and each section says plainly what changed. Two of the ten findings in Section 9 were defects and are fixed; a third was found only while verifying the work. What is still missing is Section 6's partner questionnaire, which is not code, and it is now the largest remaining gap in the whole measurement picture."),
            para("One correction to the first version, and it improved the measure rather than merely fixing it. Reading load was described as the time from the cards appearing to a card being tapped. Ken: it is read plus select, and the clock should stop when the user takes any action at all — an Express button, \"In my own words\", a Command Bar button, or asking for different options. He is right, and the wider rule catches what the narrow one would have missed: the turns where the reading was so heavy that the user gave up and typed instead. A clock that stopped only on a card tap would have reported reading as easier than it is, in precisely the cases that matter."),

            // ===== 2 =====
            heading1("2. How Measurement Works Today"),
            para("Four things on the device hold information about use, and three routes carry it back."),
            heading2("2.1 The four sources"),
            simpleTable(
                ["Source", "What it holds", "Where it lives"],
                [
                    ["Saved conversations", "One file per conversation: every turn, who said it, when, which suggestion was chosen and which were offered, who the partner was, the place, the feeling, which voice spoke it, which recognizer heard it", "The data folder (on an iPad, private app storage)"],
                    ["Error log", "Every failure the app noticed, with a time and the conversation it belonged to", "Browser storage, plus a file in the data folder"],
                    ["Spending counters", "AI tokens used, seconds of paid transcription, characters of paid voice, and the date counting began", "The settings, on that machine"],
                    ["System information", "Version, screen, browser, storage state, speech providers, voices installed, and every setting value", "Assembled on demand; nothing is stored"],
                ], W3),
            emptyPara(),
            heading2("2.2 The three routes back"),
            simpleTable(
                ["Route", "What it sends", "When"],
                [
                    ["Weekly report", "The usage summary, the error log with all speech stripped out, and the system information", "Automatically when the app is opened and a week has passed"],
                    ["Report a problem", "The tester's own words, plus everything the weekly report carries, plus the conversation transcripts", "When the tester chooses, from Settings or from the opening screen"],
                    ["Troubleshooting tab", "The same summary, on screen, for the tester to read", "Whenever they look"],
                ], W3),
            emptyPara(),
            para("Two rules hold across all three, and they shape what can ever be measured automatically. Nothing anyone said is ever sent without the tester deliberately attaching it. Neither key is ever sent. The consequence for this document is that every automatic measure has to be a count, a duration, or a category — never words."),

            // ===== 3 =====
            heading1("3. What the App Reports Today"),
            para("These are computed and travel in every weekly report. They come entirely from the saved conversations and the error log, which is why they existed before any measurement work began: the app had been writing this down all along and nothing was reading it."),
            heading2("3.1 Is it being used?"),
            simpleTable(
                ["Measure", "How it is worked out", "What it answers"],
                [
                    ["Conversations, and how many were practice", "Counted from the saved files; practice ones carry a practice stamp", "Volume, without letting rehearsal inflate it"],
                    ["Days used, and the span they fall across", "Distinct calendar days with any turn on them", "Whether use is spread out or clustered"],
                    ["First and last use, days since last use", "Earliest and latest turn recorded", "The clearest early-quit signal we have"],
                    ["Conversations per week of days used", "Conversations divided by days used, scaled to seven", "Adoption, without penalizing a tool used happily but not daily"],
                    ["Typical length", "Median turns and median minutes per conversation", "Whether conversations are real or token"],
                    ["Started but nothing said", "Conversations with no turns at all", "Abandonment at the very first step"],
                ], W3b),
            emptyPara(),
            heading2("3.2 Did a suggestion fit?"),
            simpleTable(
                ["Measure", "How it is worked out", "What it answers"],
                [
                    ["Things the user said", "Every turn spoken in the user's voice", "The denominator for everything below"],
                    ["Chosen from a card, as a share", "Turns where a card position was recorded", "The product's central bet, in one number"],
                    ["Typed or a fixed phrase", "Everything else", "How often the suggestions were not enough"],
                    ["Which kind of reply", "The conversation category of the chosen card — preferred, dispreferred, initiative, repair, choice", "Whether all four categories earn their place; heavy repair means something upstream is failing"],
                ], W3b),
            emptyPara(),
            para("The category distribution is deliberately not a ranking. Position on screen carries the kind of move, never its quality, so there is no such thing as a first-choice hit rate. A category never selected is a category not earning its cell, and dispreferred use is a success signal, because plain AAC makes declining hard."),
            heading2("3.3 How long the other person waited"),
            simpleTable(
                ["Measure", "How it is worked out", "What it answers"],
                [
                    ["Typical wait", "Median time from the partner's turn to the user's reply", "The four-second problem, measured"],
                    ["Waits over four seconds", "How many of those exceeded the threshold the whole product is built around", "How often the product's core promise was missed"],
                ], W3b),
            emptyPara(),
            para("Gaps longer than ten minutes are discarded as someone walking away rather than waiting. This is the single most important number the app currently produces, and Section 7 explains why it cannot yet be read as a reading-load measure."),
            heading2("3.4 Problems"),
            para("Errors are counted, grouped by what failed, and reported alongside how many conversations contained one. Because the app logs a failure when it generates no usable suggestions at all, a run of those is visible — but only that extreme case. An ordinary miss, where four perfectly working cards simply did not suit, produces no error and is invisible except as a fall in the share chosen from a card."),

            // ===== 4 =====
            heading1("4. Recorded but Not Reported — NOW BUILT"),
            para("The following was written into every saved conversation and read by nothing. It needed no new capture, no new consent, and no change to what leaves the device — only aggregation, which is why it was the cheapest measurement available to the project and why it was done first. All eight now appear in Settings → Troubleshooting and in the weekly report."),
            simpleTable(
                ["Already on disk", "What it gives", "Effort"],
                [
                    ["Where each spoken turn came from — a card, typed, an Express button, or one of our own control phrases", "Splits the current 'typed or a fixed phrase' figure, which today hides three different behaviors under one heading. Express use is engagement; our control phrases are not the user's voice at all", "Small"],
                    ["Every option that was offered, not only the one chosen", "The rejected-suggestion corpus — likely the most valuable qualitative material the beta will produce, and it is accumulating now with nothing reading it", "Small to review by hand; larger to summarize"],
                    ["Who the partner was, on every turn", "Whether the same partner comes back week after week. See Section 6 — this is the closest thing to a partner measure that costs nothing", "Small"],
                    ["Where the user was, and how they felt", "Whether the place and feeling buttons are used at all, and whether they change anything", "Small"],
                    ["Which voice actually spoke each turn, including when the paid voice failed and fell back", "How often a tester on a paid voice was silently dropped to the device voice — an identity failure, not a cosmetic one", "Small"],
                    ["Which recognizer heard each partner turn", "Lets every other number be read separately for browser and paid transcription, instead of averaging two different products together", "Small"],
                    ["Turn timestamps, one per turn", "The week-by-week trajectory. See Finding 1 — the retention curve, which is the headline number, is not currently computed even though the raw times are all present", "Small"],
                    ["Length of what the partner said, and of what the user said", "Whether partners shorten their turns over time, which would be a sign of accommodation rather than conversation", "Small"],
                ], W3b),
            emptyPara(),
            para("Personalization depth was built alongside this. How much of the About Me questionnaire is answered, how many people and places are recorded, how many Express buttons the user has added or edited, how many Sound Check items are answered — all of it was already stored and countable without a single new measurement. It matters for two reasons: editing your own phrases in week one is engagement before any conversation number can show it, and it splits a poor result in two. Suggestions being ignored by someone with an empty profile is an onboarding problem; the same result with a full profile is a generator problem. Those need completely different work and are indistinguishable without this. It is deliberately shown even for a tester with no conversations at all, because someone who has filled in their profile and then held no conversations is the tester about to quit, and reporting them as identical to someone who never touched the device would describe the opposite situation."),

            // ===== 5 =====
            heading1("5. Not Measurable At All — NOW CAPTURED"),
            para("These needed the app to record events as they happen, and none of them could have been recovered later: an event not recorded when it happens is gone. That is why this was the one item that could not be deferred, and it is now built. Every row below is captured, held as a per-day tally, and carried in the weekly report."),
            para("The rule that makes it safe to send automatically is enforced in one place rather than trusted to each call site: an event may carry counts, durations and small categories, and nothing else. A string is dropped unless it appears under one of a few names that could not plausibly hold speech, and is cut short even then. So a mistaken call that passed a partner's words would record nothing at all rather than quietly shipping a sentence. That is the difference between a privacy rule and a privacy hope, and it is guarded by a test."),
            simpleTable(
                ["Now captured", "Why it matters", "What it was before"],
                [
                    ["The app was opened but no conversation started", "The clearest possible sign of a tester drifting away while still nominally participating", "A tester who opens the app daily and never talks looks identical to one who has stopped opening it"],
                    ["Suggestions were shown and then abandoned", "Names the case where the app did its job and the user still went elsewhere", "Only visible indirectly, as a lower share chosen from a card"],
                    ["'Give me different options' was pressed", "Half of the agreed sufficiency measure is 'chosen from a card without a regenerate'", "That measure cannot be computed. Only a regenerate that failed is recorded"],
                    ["Reframe, choice chips, the composer being opened and canceled", "Whether the steering features are used, and whether the composer is opened and abandoned", "Invisible unless the user actually spoke something"],
                    ["Which Command Bar button was pressed", "A button never pressed in six weeks is a button the tester never understood — a design finding on its own", "Invisible. The icon-only rule makes this the likeliest quiet failure"],
                    ["Placeholders spoken per turn", "Whether the floor-holding phrases are heard occasionally or constantly, and whether partners tire of them", "Invisible"],
                    ["How long generation took, and when the cards appeared", "See Section 7 — one timestamp turns the existing wait figure into a reading-load measure", "The wait figure cannot be broken into its parts"],
                    ["Silence checkpoints per partner turn, and how many generations were thrown away", "The silence period was shortened to half a second on the expectation that discarded work would be cheap. Nothing checks that expectation", "Cost is visible only as spending, with no explanation attached"],
                    ["Rate-limit refusals from the AI", "Distinguishes 'the app is broken' from 'too many requests at once', which is a shared-key problem, not a product one", "Logged as a generic error, with no context about which checkpoint caused it"],
                    ["Recognition delay", "The real pause a partner must leave is the recognizer's delay plus the silence setting, so the setting understates the true wait", "The setting cannot be calibrated. Measurable on the paid recognizer, effectively not on the browser one"],
                ], W3b),

            // ===== 6 =====
            heading1("6. The Partner"),
            para("The Strategic Assessment is right that the partner is the thesis and is unmeasured. The position is worse than it first looks and better than it first looks, in different respects."),
            heading2("6.1 What can never come from the app"),
            para("The partner does not hold the device, does not touch it, and by design knows nothing about how it works. Nothing they experience — whether the pauses felt natural, whether it felt like talking with a person, whether they would do it again — can be inferred from anything the app can see. There is no software answer to this. It needs a short questionnaire, two or three questions, delivered outside the app, and it should be treated as a protocol item for the beta rather than a build item."),
            para("The printed partner card is the natural carrier: it is already going to sit on the back of the device, and a short address on it costs nothing to add. The card exists in the document set and has not yet been printed, so the moment to decide is now, before it is."),
            heading2("6.2 What the app can say about the partner, and mostly does not"),
            simpleTable(
                ["Partner measure", "Available from", "Status"],
                [
                    ["How long the partner waited for a reply", "Time between turns", "Reported today. The one genuine partner-experience number the app produces"],
                    ["Did the same partner come back?", "The partner stamp on every turn, across weeks", "On disk, not reported. The closest free proxy for willingness to converse again"],
                    ["How many turns the partner took, and how long they stayed", "Turn counts and conversation duration", "Partly reported, not split by partner"],
                    ["Did the partner give up early?", "Conversations ending after one or two turns", "Countable, not reported"],
                    ["Did the partner shorten their turns over time?", "Length of what they said, week by week", "On disk, not computed"],
                    ["Did the partner talk over the app, or keep going after a pause?", "Silence checkpoints within one partner turn", "Not recorded. Needs the event capture in Section 5"],
                ], W3b),
            emptyPara(),
            para("The second row deserves emphasis. Partner willingness to return is proposed as a co-equal headline metric, and a version of it is sitting in the saved conversations already: the same named person appearing across several weeks is a partner who kept coming back. It is not the same as asking them, and it should not be presented as if it were — a family member returns for reasons that have nothing to do with the device. But it costs nothing, it is available from day one, and it is the only partner-side signal that arrives without asking anybody anything."),

            // ===== 7 =====
            heading1("7. Reading Load Under Time Pressure — NOW MEASURED"),
            para("Four to eight cards of full sentences is a substantial reading task for someone with cerebral palsy while another person waits. The Strategic Assessment said it had never been measured. It is measured now, and the step needed turned out to be a single recorded moment."),
            para("The wait figure the app already reports is a composite. It runs from the moment the partner stopped speaking to the moment the user spoke, and it contains four things: the recognizer delivering the words, the AI producing the suggestions, the user reading them, and the user selecting one. Only the whole is visible, so a slow AI and a heavy reading load are currently indistinguishable — and they call for opposite responses. A slow AI is an engineering problem. A heavy reading load is a design problem, and the levers for it are fewer cards and shorter card text."),
            para("Recording one moment — when the cards appear on screen — splits the composite in two. Everything before it is the machine; everything after it is the person. That second half is reading load, measured in the field, in real conversations, with no test and nothing asked of the tester. Both halves are now reported side by side, which is what separates a slow model from a heavy reading task."),
            para("The clock stops at the user's FIRST action of any kind, which was Ken's correction and is the load-bearing part of the design. Tapping a card, tapping an Express button, opening \"In my own words\", pressing a Command Bar button and asking for different options all end the deliberation, and each is recorded with which kind of action ended it. That distinction is itself a finding: reading for six seconds and then tapping a card, and reading for six seconds and then typing instead, are the same reading load and opposite outcomes."),
            para("Two things already on disk make that measurement immediately useful rather than merely available. The app records every option it offered, so the number of cards and the amount of text on them are known for each turn; and the cards-per-category setting is in the system information, so testers running four cards can be compared with testers running eight. Reading time can therefore be set against how much there was to read, which is the actual question — not whether four seconds is exceeded, but what makes it be exceeded."),
            para("One caution about interpreting it, which no amount of engineering removes. The span is reading plus deciding plus the physical act of reaching, and for this population the last of those is not small. The number overstates reading. It is still the right measure, because those three together are what the partner actually waits through — and it must never be labeled as reading time alone."),

            // ===== 8 =====
            heading1("8. Headline Success Metrics"),
            para("The Strategic Assessment's first gap is that the choice of what counts as success is a product decision and must be made before beta, because it shapes the protocol. Most of that choice has now been made. Setting it out in one place is what remained."),
            heading2("8.1 The two agreed headline numbers"),
            numBold("Adoption — conversations per week of days used, and the week-one to week-four trajectory. ", "The question is: when a conversation opportunity arises, does the user reach for this? Deliberately not a daily-use measure — an AAC tool is opened when there is someone to talk to, so a daily metric would report a well-loved tool as a failure. The per-week figure is computed today; the trajectory is not, and that is Finding 1.", "headline"),
            numBold("Sufficiency — the share of spoken turns that came from a card without first asking for different options. ", "The product's central bet in one number. The first half was already computed; the second half could not be computed at all, because pressing 'give me different options' was recorded only when it failed. It is now counted whether it succeeds or not, so the measure can be stated as agreed rather than approximated.", "headline"),
            heading2("8.2 The proposed third, from the Strategic Assessment"),
            para("Partner willingness to converse again, as a co-equal headline number. This one cannot be computed from the app, for the reasons in Section 6.1, and needs the short partner questionnaire. The return-rate proxy in Section 6.2 is the free approximation and should be reported alongside it rather than instead of it."),
            heading2("8.3 The early-warning set"),
            para("These move before the headline numbers do, and say which part failed. Abandonment of suggestions, regenerates per turn, and the median wait. Only the last was measurable before; all three are now. That was the practical case for the event capture: the headline numbers tell you something is wrong several weeks after it started going wrong, and this set tells you sooner and tells you where."),
            heading2("8.4 What is explicitly not a headline number"),
            para("Feature counts are diagnostics, not the verdict. So is anything about the paid voice: whether it is worth its cost is answered by whether a tester who tries it keeps it and what they say about it, never by a timing figure. And there is no first-choice hit rate, because position carries the kind of reply and not its quality."),

            // ===== 9 =====
            heading1("9. Findings That Change How These Numbers Should Be Read"),
            para("Ten things found while checking the code against the plans. Each affects either what a number means or whether it exists at all."),
            numBold("FIXED — the weekly report was cumulative, so the retention curve was invisible. ", "Every report contained a summary of everything that had ever happened, not of the week just gone, so a tester whose use halved in week three still showed a healthy overall average. The trajectory is the agreed headline number and it was the one thing the report could not show. It is now bucketed on the device, where the individual turns still exist — it could not be done at the far end, because medians from separate reports cannot be subtracted from one another. Weeks run from the tester's own first day, and an empty week is still reported: a missing week is what quietly stopping looks like, so closing the gap up would hide it.", "findings"),
            numBold("A private conversation contributes nothing at all — not even counts. ", "The decision on record is that a conversation marked 'don't save' should still contribute counts, since a count carries no words. The code does not do that: nothing is written, so the conversation never happened as far as every number in this document is concerned. It cannot be fixed by aggregating differently, because there is nothing to aggregate. It is a reason to expect the counts to under-report, and how much depends on how often testers use the control.", "findings"),
            numBold("FIXED — the tester-facing description claimed the system information was sent only when it changes. ", "It is not: the spending counters live among the settings and increase after every conversation, so something has always changed. The behavior is harmless and mildly useful, because it means spending figures arrive weekly — so the sentence was corrected rather than the behavior. It matters because with no raw payload view in the app, that description IS the disclosure, and a disclosure nobody re-reads must not drift into saying something untrue.", "findings"),
            numBold("Spending is measured, and it is the beta's economic evidence. ", "Tokens, seconds of paid transcription, characters of paid voice, and the date counting began are all recorded, and they arrive with the weekly report by the accident above. This is the number that tests the whole no-server strategy: the promise is that users pay only for what they use, and beta is the first time anyone will find out what that is in practice.", "findings"),
            numBold("The share of cache reuse is a regression signal, not a cost line. ", "Roughly nine tenths of what is sent to the AI on a busy turn is unchanged from the previous one and is reused rather than re-billed. If that share falls, something has disturbed the fixed part of the request, and there is no error and no symptom anywhere except a larger bill. It should be watched as a fault indicator.", "findings"),
            numBold("Practice is counted separately, and that is right. ", "Rehearsal is engagement, but counting it as real use would overstate adoption. Both figures are reported. The controls tour needs no key and is the one thing a tester can do on day one, so early reports may be practice-heavy and should not be read as adoption.", "findings"),
            numBold("Nothing distinguishes the two speech configurations in any current number. ", "A tester on paid transcription and a tester on the browser's are averaged together, although they are having measurably different experiences. Which recognizer heard each turn is recorded on every partner turn, so splitting the figures costs nothing.", "findings"),
            numBold("On an iPad the usage history can be erased by the device. ", "Conversations are held in storage the operating system may clear, and in the browser-tab configuration that can happen after a period of non-use. The tester who stops for two weeks is both the most interesting case and the one whose record is most likely to vanish. Weekly reports already sent are safe, which is an argument for sending them rather than relying on reading the device later.", "findings"),
            numBold("Every automatic number is a count, a duration, or a category — never a word. ", "This is a strength worth stating rather than a limitation to apologize for. Analytics is usually where privacy goes wrong; here it is structurally incapable of carrying speech. It also sets the boundary for everything proposed in this document: anything needing the actual words has to be a deliberate, previewed, tester-initiated report.", "findings"),
            numBold("FOUND WHILE BUILDING, AND FIXED — pressing Start conversation recorded a conversation that had ended with no turns. ", "Start wipes the previous conversation before opening a new one, so the event was raised every time somebody started, whether or not anything had been there. Left alone it would have inflated the conversation count with conversations that never happened — quietly overstating adoption, in the one number most likely to be quoted. The lesson generalizes: an event about something ENDING has to be raised where it is known whether it had begun, which is not the call site. Worth recording because it argues for exercising instrumentation against the running app rather than reasoning about where the call sites go.", "findings"),
            numBold("Default-on reporting ends with the beta. ", "It is on by default because testers are told it is part of the arrangement, and because opt-in would lose exactly the tester who quits in week two. Neither reason survives public release, and the Beta Test Plan promises in writing that the arrangement ends. Shipping publicly with it still on would break that promise; nothing needs building to honor it, since the manual route already exists.", "findings"),

            // ===== 10 =====
            heading1("10. What Was Built, and What Is Left"),
            para("The first five items of the original list were built on August 16 2026, in the order given, and verified against the running app. What remains is shorter, and the largest remaining item is not code."),
            heading2("10.1 Built"),
            bulletBold("The week-by-week trajectory, computed on the device. ", "Weeks run from the tester's own first day; empty weeks are reported rather than dropped; and the receiving Sheet holds one row per tester per week, replaced rather than added to, so the curve can be charted directly."),
            bulletBold("The eight aggregations of what was already on disk. ", "Where each spoken turn came from, whether the same partner came back, place and feeling use, silent voice fallbacks, every figure split by which recognizer heard the partner, turn lengths, what was on offer, and personalization depth."),
            bulletBold("The deliberation clock. ", "From the cards appearing to the user acting, stopping on the first action of any kind, and recorded with which kind of action ended it."),
            bulletBold("The event capture. ", "About twenty moments, held as a per-day tally, with a short recent history attached to a problem report as reproduction context. Counts, durations and categories only, enforced in one place."),
            bulletBold("Checkpoints and delays. ", "Checkpoints per partner turn, the gaps between them, generations prepared and thrown away, rate-limit refusals, and recognizer delivery gaps — enough to settle whether the half-second silence setting is a good trade."),
            heading2("10.2 Left, in order"),
            numBold("Decide the partner questionnaire and put it on the printed card. ", "NOT CODE, and now the largest gap in the measurement picture. Nothing the partner experiences can be inferred from anything the app can see, so this is the only route to the co-equal headline metric. It has to be settled before the cards are printed, which is imminent.", "priority"),
            numBold("Add the gone-quiet alert to the receiver. ", "A daily check for any tester with no report in ten days. This is the alert most likely to change an outcome — it is the one where acting early still matters — and it is the only piece of the alerting that does not yet exist.", "priority"),
            numBold("Redeploy the receiver and chart the weeks tab. ", "Both are setup rather than building. Editing the script changes nothing at the live address until a new version of the same deployment is published, which is a mistake that looks completely successful from every side.", "priority"),
            numBold("Watch the checkpoint numbers for a few weeks before acting on them. ", "They were added to answer a question nobody can currently answer from a prior. One week of data is not an answer.", "priority"),
            numBold("Recognition delay, only if the delivery gaps do not explain what is seen. ", "Measurable on the paid recognizer essentially for free; on the browser's it needs a parallel capture rig resting on an unverified assumption. Do not build it speculatively.", "priority"),
            emptyPara(),
            para("A closing caution, because it is the easiest thing to lose sight of once numbers start arriving. With five testers, none of this is statistics. The numbers say what happened and never say whether the tester minded. The predecessor product failed on consistent use, and that lesson was learned by talking to people, not by charting them. Everything here exists to make the conversations with testers better informed — not to replace them."),
        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    const out = docPath("Conversant AAC Measurement Plan.docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out);
});
