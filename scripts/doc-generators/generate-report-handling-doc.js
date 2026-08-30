// Generates docPath("Conversant AAC Weekly Report Handling.docx") — the plan for what
// happens to a report after it arrives: where it lands, the Monday routine, how to read
// each number, and what to do when one moves. Covers BOTH kinds of report — the weekly
// one the app sends by itself, and the problem report a tester writes and sends
// deliberately, which is a different animal and is answered rather than read.
// Run: node generate-report-handling-doc.js
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

const W3 = [2500, 3400, 3460];
const W3b = [2900, 3200, 3260];

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
            { reference: "monday",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "setup",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "problem",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "cadence",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Weekly Report Handling", italics: true, color: "808080", size: 18, font: "Arial" })]
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
                children: [new TextRun({ text: "Weekly Report Handling", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "What happens to a report after it arrives: where it lands, the weekly routine, how to read each number, what to do when one moves, and how to answer a problem a tester has written in about", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Prepared by Claude at Ken Hackbarth's request  |  August 16, 2026  |  Last updated August 29, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("The measuring is built. Reports will start arriving the day the first tester opens the app, and from then on they accumulate whether or not anybody reads them. This is the plan for reading them."),
            para("It is written to be a fifteen-minute routine, once a week, for a cohort of about five. That size is the governing constraint and it shapes everything below: with five testers none of this is statistics. The numbers rank things and raise questions; only talking to the tester answers them. The predecessor product failed on consistent use, and that lesson was learned by talking to people, not by charting them."),
            para("So the goal of the weekly routine is not a dashboard. It is a short list of questions to take into the next conversation with each tester, and an early warning when someone is drifting away while there is still time to ask why."),

            // ===== 2 =====
            heading1("2. Where a Report Lands"),
            para("A report is posted automatically when a tester opens the app and a week has passed. It goes to a Google Apps Script address, which writes it into a private Google Sheet with three places to look."),
            simpleTable(
                ["Tab", "What it holds", "How to read it"],
                [
                    ["weeks", "One row per tester per week: days used, conversations, things said, and how many came from a card", "THE MAIN TABLE. Read this first and chart it. Rows are replaced rather than added, so a week is always shown as the most recent report describes it"],
                    ["reports", "One row per report received — about forty columns of totals, timings and counts", "The detail, and the audit trail. Scan it when the weeks tab raises a question"],
                    ["raw (a column on reports)", "The whole report exactly as it arrived", "Nothing is lost. If a question comes up later that no column answers, the answer is in here"],
                    ["problems", "One row per problem a tester wrote in about, with their own words and the full diagnostic text", "A DIFFERENT ANIMAL — see section 6. It arrives by mail as well, and it is the only place in the Sheet that can contain what somebody actually said"],
                ], W3),
            emptyPara(),
            para("Three properties worth knowing before relying on any of it. WEEKLY reports carry no transcripts and no keys, by construction — if conversation text ever appears on the weeks or reports tabs, that is a fault in the app, not a change of policy. (The problems tab is the deliberate exception, and section 6 says why.) The Sheet holds the tester's assigned name, so it is confidential and should not be shared. And delivery cannot be confirmed by the app: it hands the report to the network and cannot read the reply, so the only way a lost report is ever noticed is a missing row here."),

            // ===== 3 =====
            heading1("3. The Weekly Routine"),
            para("Fifteen minutes, same time each week. In this order, because it goes from the question that matters most to the one that matters least."),
            numBold("Look for a missing report. ", "Every active tester should have a row from the last eight days. A tester with no report is the most important thing on the page: either they have stopped opening the app, or their device is not sending. Both need a message today, and the two look identical from here — which is why the first question to them is simply whether they have been using it.", "monday"),
            numBold("Read the weeks tab as a curve, per tester. ", "Conversations per week, and days used per week. The shape is the headline: rising, flat, or falling. A drop of half or more from one week to the next, or two consecutive weeks below the first week, is the trigger for a conversation. Expect a novelty spike in week one and a dip around week three — that dip is normal and is not by itself a finding.", "monday"),
            numBold("Read the sufficiency column beside it. ", "The share of things said that came from a card. Falling while conversations hold up means the suggestions are missing and the user is working around them. Falling together with conversations means something else is wrong and this is a symptom.", "monday"),
            numBold("Scan the three early-warning numbers. ", "Palettes abandoned as a share of palettes shown; regenerates per conversation; and the typical wait. These move BEFORE the headline numbers do and they say which part failed, so a change here is a question to ask this week rather than a problem to confirm in three weeks' time.", "monday"),
            numBold("Check for anything obviously broken. ", "Errors, voice fallbacks and rate limits. A run of any of these is a bug report the tester never had to write.", "monday"),
            numBold("Write one question per tester. ", "That is the output of the routine. Not a chart, not a summary — one specific question for the next check-in, grounded in what their own numbers did.", "monday"),

            // ===== 4 =====
            heading1("4. How to Read Each Number"),
            heading2("4.1 The headline numbers"),
            simpleTable(
                ["Number", "What a change means", "What to do"],
                [
                    ["Conversations per week", "The product's whole question: when a conversation opportunity arises, do they reach for this?", "Falling — ask what changed. Rising — ask what for, because the answer tells you which part is earning its place"],
                    ["Days used per week", "Whether use is spread through the week or was one long session", "Two figures that disagree (many conversations, one day) usually means a visit, not a habit"],
                    ["From a card, as a share", "Whether the suggestions are good enough to speak as they stand", "Falling — read the abandonment number next; the two together separate a generator problem from a user with their own thing to say"],
                    ["Returning people", "The nearest the app can get to whether a partner would do it again", "Rising is genuinely good news. Do not present it as partner willingness — a family member returns for reasons that have nothing to do with the device"],
                ], W3b),
            emptyPara(),
            heading2("4.2 The early-warning numbers"),
            simpleTable(
                ["Number", "What a change means", "What to do"],
                [
                    ["Palettes abandoned", "The app offered suggestions and the user went elsewhere. The clearest single measure of the suggestions missing", "Segment it by how much of About Me is filled in. High with an empty profile is an onboarding problem; high with a full profile is a generator problem"],
                    ["Regenerates", "Asking for different options is the user saying the first four were not right, without saying so to anyone", "A rise here usually precedes a fall in the from-a-card share by a week or two"],
                    ["Typical wait", "How long the other person actually waited. The four-second problem, measured", "Read it with the next two rows, which say whether the delay is the machine or the person"],
                    ["Median generation", "How long the AI took", "If this is most of the wait, the fix is engineering. If it is a small part, it is not"],
                    ["Median decide", "Reading plus choosing: from the cards appearing to the user acting. The half of the wait that is the person", "If this is most of the wait, the fix is fewer cards or shorter card text — the cards-shown and words-per-card columns are right beside it"],
                    ["Words doubted (“how well it heard them”)", "How often the AI suspected the microphone had misheard a word, as a share of the partner turns it checked. Broken down by who the tester was with, where they were, and which recognizer was listening. It is a rough read on recognition quality in a real setting, which nothing else in the report gives", "Read it as a comparison, never as a rate. A figure that is much higher with one person or in one room is the finding — that is a setting to ask about, and often a fixable one (a quieter corner, a closer microphone, the paid recognizer). A single number on its own says very little. See section 8 for why it is a floor"],
                ], W3b),
            emptyPara(),
            heading2("4.3 The setup and health numbers"),
            simpleTable(
                ["Number", "What a change means", "What to do"],
                [
                    ["About Me %, Express edited, people recorded", "How far into making it theirs the tester has got. Investment shows here before it can show in any conversation number", "A tester at zero in week two is the one about to quit. This is the earliest warning available and it needs no conversations at all to appear"],
                    ["App opens against conversations started", "Opening the app and never talking is a tester drifting away while still nominally taking part", "Many opens with few conversations is a specific and answerable question: what stopped you?"],
                    ["Errors and error kinds", "What actually failed", "Match the kind against the Known Issues page before asking the tester anything"],
                    ["Voice fallbacks", "The paid voice dropped to the device voice for a sentence. The user speaks in a different voice and nothing on screen says so", "Any sustained count is worth chasing; it is an identity failure, not a cosmetic one"],
                    ["Rate limited", "Too many requests at once", "Not a product fault. It is testers sharing one key, and the fix is separate keys"],
                    ["Superseded, checkpoint gaps, recognizer gaps", "How much AI work was prepared and thrown away, and why", "This is the evidence for whether the half-second silence setting is a good trade. Watch it; do not act on one week"],
                ], W3b),

            // ===== 5 =====
            heading1("5. What Should Reach You Without Looking"),
            para("The routine above assumes somebody looks. Three things should not wait for that, and the receiver can mail them."),
            bulletBold("A tester has gone quiet. ", "No report for more than ten days from someone still in the cohort. This is the highest-value alert in the whole system, because it is the one where acting early still changes the outcome."),
            bulletBold("A run of errors. ", "More errors in one report than a threshold worth setting once and leaving alone. Already built into the receiver; it needs an address putting in."),
            bulletBold("Reports stopped arriving from everyone at once. ", "That is not five testers quitting on the same day, it is the endpoint. Worth knowing within a day rather than at the next weekly read."),
            bulletBold("A tester has written in about a problem. ", "Mailed the moment it arrives, with their note in the body. This one is not an alert about a number, it is a person waiting for an answer — section 6."),
            para("Everything else can wait for the weekly read. Resist adding more alerts: an alert that fires often stops being read, and the failure mode here is not missing a number, it is stopping looking at all."),

            // ===== 6 =====
            heading1("6. When a Tester Writes In About a Problem"),
            para("Everything above is about a report the app sends by itself, describing a period, that nobody is waiting on. A problem report is the opposite of all three: a tester wrote it, it is about one moment, and they are waiting for an answer. It is not read on a Monday and it does not produce a question \u2014 it produces a reply."),
            para("It also carries the one thing the weekly numbers never do: words. The commonest complaints a tester will have \u2014 it misheard me, the suggestions were wrong, it said something I would never say \u2014 cannot be confirmed or ruled out from any weekly figure, because the measuring deliberately records counts and not speech. So this is the only channel through which most of what goes wrong can ever be seen."),

            heading2("6.1 How one reaches you, and what is in it"),
            simpleTable(
                ["Route", "When it is used", "What to watch for"],
                [
                    ["Sent from the app", "The normal route. It lands on the problems tab and mails you at the same time, with the tester's note in the body of the mail", "The mail is the trigger; the tab has the detail. Neither waits for the weekly read"],
                    ["Saved to a file", "When it could not send, and from the launch screen when the app did not start properly \u2014 which is exactly when the tester most needs to reach you", "It arrives however they choose to send it. There is no row on the Sheet, so nothing records it but you"],
                    ["Copied and pasted", "Into a message or an email, on a device where handling a file is awkward", "Same content, no row. Paste it onto the problems tab if you want it kept with the rest"],
                ], W3),
            emptyPara(),
            para("A report contains their note first, in their own words; the version and build they are running; their settings, device and speech setup; the errors the app recorded; and the transcripts of any conversation one of those errors happened in. A conversation they marked \u201cdon't save\u201d is not in it, and neither key is ever in it."),
            para("Nothing here is automatic. The tester was shown the exact text and confirmed it before it left the device, which is what makes sending the transcripts permissible at all. That is also why it must never become a background channel: the moment it sends without being read, the permission underneath it is gone."),

            heading2("6.2 Answer the same day, before you know anything"),
            para("This is the highest-value action in this whole document and it costs one sentence. A tester who writes in and hears nothing concludes that writing in does not work, and stops \u2014 which closes the only channel that carries words. Say it arrived, say whether you can see what happened yet, and say when you will come back to them. Do not wait until you have a fix, and do not wait for the weekly read."),

            heading2("6.3 Reading one, in this order"),
            numBold("Read their note first, and take it at face value. ", "It is the only sentence in the entire system written by the person using the app. Everything under it is context for their words \u2014 never a correction of them. If the diagnostics seem to say the app behaved correctly, the finding is usually that it behaved confusingly, which is a real fault.", "problem"),
            numBold("Check the version and build. ", "A good share of what arrives is already fixed. If they are behind, that is the first question, and it is worth asking what Settings \u2192 About actually shows rather than assuming \u2014 a device can go on running an older copy of the app than the one that has been published.", "problem"),
            numBold("Match the errors against the Known Issues page. ", "Before asking them anything. If it is listed, the answer is a workaround and a date, not an investigation.", "problem"),
            numBold("Read the transcript against their note. ", "Only if an error happened to be logged in that conversation. This is the one place words exist, so when it is there, read it before theorizing.", "problem"),
            numBold("Check what their setup actually is. ", "Which recognizer was listening, which voice was speaking, which device, whether they are using a keyguard. Several complaints that read as faults turn out to be one of these being different from what you pictured.", "problem"),
            numBold("Decide which of four it is. ", "Already known; a new fault; working as designed but confusing; or not answerable from what is here. Each has a different reply, and saying which one it is is most of the reply.", "problem"),

            heading2("6.4 When the report cannot answer it"),
            para("This will happen often, and it is a property of the design rather than a gap to be closed. The event record carries counts and no words, on purpose, so a complaint about what was heard or what was suggested leaves no trace at all unless an error was logged in the same conversation."),
            para("When that happens, ask the tester for one saved conversation file, naming roughly when it happened. Ask \u2014 do not treat it as owed. It is private material, the other person in it never agreed to anything, and a request that says what it is for and what will happen to it is the difference between a tester who sends one and a tester who quietly stops replying."),
            para("And a check that finds nothing has to be recorded as \u201cnot visible here\u201d, never as \u201cno problem\u201d. The tools that read these reports are written to say it that way for the same reason: the absence of evidence here is genuinely not evidence of absence."),

            heading2("6.5 Closing one out"),
            bulletBold("Already known. ", "Say so, give the workaround, and point at the Known Issues page. Knowing it is a known fault and not their own mistake is most of what they wanted."),
            bulletBold("A new fault. ", "Reproduce it if you can, and tell them whether it will be fixed and roughly when. \u201cNot for a while\u201d is a far better answer than silence, and it is the one that keeps them writing in."),
            bulletBold("Working as designed but confusing. ", "That IS the finding. It usually belongs to a label, a manual or a default \u2014 not to a bug list, where it will be closed and lost."),
            bulletBold("Not answerable. ", "Say so plainly and ask for the one thing that would settle it. An unanswered report is worse than one answered with \u201cI cannot tell from this\u201d."),
            para("Keep one line per report somewhere \u2014 date, tester, what they said, what was done. With a cohort of five the pattern across reports is worth more than any single one of them: the same complaint from two different people is a design finding, and it stays invisible unless somebody wrote both down."),

            heading2("6.6 Two things not to do"),
            bulletBold("Do not treat a problem report as a data point. ", "It is a person who took the trouble, on a device where taking trouble is expensive. Counting them tells you nothing the weekly numbers do not already say better."),
            bulletBold("Do not quote a transcript outside the project. ", "Not in a bug tracker, not in a message to another tester, not in a talk. The tester consented to sending it; the person they were talking to consented to nothing and does not know the report exists."),
            // ===== 7 =====
            heading1("7. Reporting Back"),
            heading2("7.1 The per-tester page, before each check-in"),
            para("One page per tester, taken from their own rows: the curve of conversations per week; the from-a-card share beside it; how much of About Me and the Express Panel they have filled in; and the two or three specific things their numbers raise. This is preparation for a conversation, not a report card — nothing on it is shown to the tester unless they ask, and if they do ask, show them, because it is their own data and the app already shows them the same summary."),
            heading2("7.2 The cohort view, monthly"),
            para("Five curves on one chart, weeks along the bottom. Not an average — averaging five people whose situations differ hides exactly the variation the beta exists to find, and one enthusiastic tester can carry four who quietly stopped. The useful reading is how many curves are still rising at week four and what separates them from the ones that are not."),
            para("Alongside it, the two or three findings that hold across testers: a Command Bar button nobody presses, a category never selected, a setting everybody changes. Those are design findings and are worth more than any single tester's numbers."),
            heading2("7.3 What NOT to produce"),
            bulletBold("No significance tests, no confidence intervals, no averages presented as results. ", "With five testers those are decoration on noise, and they invite conclusions the data cannot carry."),
            bulletBold("No ranking of testers. ", "The tester with the fewest conversations is the most informative person in the study, not the worst participant."),
            bulletBold("No number without its question. ", "Every figure in the app's own summary is printed under a heading saying what it answers; the same discipline applies here."),

            // ===== 8 =====
            heading1("8. Reading These Numbers Honestly"),
            para("Seven things that will otherwise be misread. Each is a property of how the data is collected, not a defect to be fixed."),
            bulletBold("A private conversation contributes nothing at all — not even counts. ", "The per-conversation “don't save” control keeps the whole conversation off disk, so it is invisible to every number here. Expect counts to under-report, by an amount that depends on how often that control is used, and ask each tester whether they use it."),
            bulletBold("Practice is counted separately, and early weeks will be practice-heavy. ", "The controls tour needs no key and is the first thing a tester can do, so week one may be mostly rehearsal. Read the practice column before reading week one as adoption."),
            bulletBold("The two speech configurations are different products. ", "A tester on paid transcription and one on the browser's are having measurably different experiences. Every figure can be split by which one heard the partner; do that before comparing two testers."),
            bulletBold("On an iPad, history can be erased by the device. ", "Conversations may live in storage the operating system can clear after a period of non-use. The tester who stops for two weeks is both the most interesting case and the one whose record is most likely to vanish — which is an argument for reading the weekly reports that already arrived rather than planning to inspect the device later."),
            bulletBold("Deliberation time is reading PLUS choosing PLUS reaching. ", "It overstates reading, and for this population the physical part is not small. It is still the right measure, because those three together are what the partner waits through."),
            bulletBold("Clocks differ. ", "The report carries both when it was sent by the device and when it was received. A device clock can be wrong; if a row looks impossible, compare the two before believing it."),
            bulletBold("The words-doubted figure is a FLOOR, not an error rate. ", "The AI can only doubt a word when something about it looks wrong. A mishearing that leaves an ordinary sentence — “can” where the person said “can’t”, “Tuesday” for “Thursday”, “fifty” for “fifteen” — looks like nothing at all, and those are the errors that matter most. So the true rate is always higher than the reported one, by an unknown amount. It is useful because a quiet room and a noisy cafe are being judged by the same blind judge, so the difference between them means something even though neither figure is the truth. Never quote it as “the recognizer is 94% accurate”."),

            // ===== 9 =====
            heading1("9. Setting It Up"),
            para("Most of this exists. What remains is small and should be done before the first tester starts, because none of it can be applied retrospectively."),
            numBold("Redeploy the receiver. ", "The script has been extended for the new material and adds the weeks tab. Editing and saving in the Apps Script editor changes nothing at the live address — it must be Manage deployments, then a new version of the SAME deployment. Confirm by visiting the address in a browser: it prints the script version.", "setup"),
            numBold("Put an address in the alert field. ", "One line in the receiver. Without it the error alerting is built and silent.", "setup"),
            numBold("Add the gone-quiet alert. ", "A daily scheduled check in the same script: any tester with no report in ten days, mail once. This is the alert most likely to change an outcome and it does not exist yet.", "setup"),
            numBold("Assign each tester a name in their app, at setup. ", "Reports without one still arrive and are still grouped by device, but they cannot be tied to a person you can contact.", "setup"),
            numBold("Chart the weeks tab once. ", "A line per tester, weeks along the bottom. Built once, it updates itself as rows are replaced.", "setup"),
            numBold("Note the first report is expected immediately. ", "The first send fires at first launch rather than after seven days, deliberately — so the whole path is proven while the tester is still sitting there during setup, instead of being found broken three weeks later. If no row appears that day, fix it that day.", "setup"),

            // ===== 10 =====
            heading1("10. The Cadence Around It"),
            para("The reports are one input among three, and they are the weakest of the three on their own."),
            numBold("Weekly: the fifteen-minute read. ", "Produces one question per tester, and catches anyone going quiet.", "cadence"),
            numBold("Every one to two weeks: a short check-in with each tester. ", "The numbers say what happened; only this says whether they minded. Carry the week's question into it. The channel has to suit them — their own AAC, email, or a supporter — and not a phone call.", "cadence"),
            numBold("On any drop-out: an exit conversation, treated as the most valuable session of the whole beta. ", "The predecessor's lesson lives exactly there. A tester who stops is not a lost data point; they are the finding.", "cadence"),
            emptyPara(),
            para("A closing note on the shape of all this. The instrumentation was built because the predecessor product's team never knew whether people were using their feature. It solves that. It does not, and cannot, tell you why — and the temptation once numbers start arriving weekly is to let the reading replace the asking. The routine above takes fifteen minutes precisely so that it stays the smaller half of the work."),
        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    const out = docPath("Conversant AAC Weekly Report Handling.docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out);
});
