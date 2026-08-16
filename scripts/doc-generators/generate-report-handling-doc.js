// Generates docPath("Conversant AAC Weekly Report Handling.docx") — the plan for what
// happens to a weekly report after it arrives: where it lands, the Monday routine, how
// to read each number, and what to do when one moves.
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
                children: [new TextRun({ text: "What happens to a report after it arrives: where it lands, the weekly routine, how to read each number, and what to do when one moves", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Prepared by Claude at Ken Hackbarth's request  |  August 16, 2026", size: 20, color: "808080" })] }),

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
                ], W3),
            emptyPara(),
            para("Three properties worth knowing before relying on any of it. Reports carry no transcripts and no keys, by construction — if conversation text ever appears in the Sheet, that is a fault in the app, not a change of policy. The Sheet holds the tester's assigned name, so it is confidential and should not be shared. And delivery cannot be confirmed by the app: it hands the report to the network and cannot read the reply, so the only way a lost report is ever noticed is a missing row here."),

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
            para("Everything else can wait for the weekly read. Resist adding more alerts: an alert that fires often stops being read, and the failure mode here is not missing a number, it is stopping looking at all."),

            // ===== 6 =====
            heading1("6. Reporting Back"),
            heading2("6.1 The per-tester page, before each check-in"),
            para("One page per tester, taken from their own rows: the curve of conversations per week; the from-a-card share beside it; how much of About Me and the Express Panel they have filled in; and the two or three specific things their numbers raise. This is preparation for a conversation, not a report card — nothing on it is shown to the tester unless they ask, and if they do ask, show them, because it is their own data and the app already shows them the same summary."),
            heading2("6.2 The cohort view, monthly"),
            para("Five curves on one chart, weeks along the bottom. Not an average — averaging five people whose situations differ hides exactly the variation the beta exists to find, and one enthusiastic tester can carry four who quietly stopped. The useful reading is how many curves are still rising at week four and what separates them from the ones that are not."),
            para("Alongside it, the two or three findings that hold across testers: a Command Bar button nobody presses, a category never selected, a setting everybody changes. Those are design findings and are worth more than any single tester's numbers."),
            heading2("6.3 What NOT to produce"),
            bulletBold("No significance tests, no confidence intervals, no averages presented as results. ", "With five testers those are decoration on noise, and they invite conclusions the data cannot carry."),
            bulletBold("No ranking of testers. ", "The tester with the fewest conversations is the most informative person in the study, not the worst participant."),
            bulletBold("No number without its question. ", "Every figure in the app's own summary is printed under a heading saying what it answers; the same discipline applies here."),

            // ===== 7 =====
            heading1("7. Reading These Numbers Honestly"),
            para("Six things that will otherwise be misread. Each is a property of how the data is collected, not a defect to be fixed."),
            bulletBold("A private conversation contributes nothing at all — not even counts. ", "The per-conversation “don't save” control keeps the whole conversation off disk, so it is invisible to every number here. Expect counts to under-report, by an amount that depends on how often that control is used, and ask each tester whether they use it."),
            bulletBold("Practice is counted separately, and early weeks will be practice-heavy. ", "The controls tour needs no key and is the first thing a tester can do, so week one may be mostly rehearsal. Read the practice column before reading week one as adoption."),
            bulletBold("The two speech configurations are different products. ", "A tester on paid transcription and one on the browser's are having measurably different experiences. Every figure can be split by which one heard the partner; do that before comparing two testers."),
            bulletBold("On an iPad, history can be erased by the device. ", "Conversations may live in storage the operating system can clear after a period of non-use. The tester who stops for two weeks is both the most interesting case and the one whose record is most likely to vanish — which is an argument for reading the weekly reports that already arrived rather than planning to inspect the device later."),
            bulletBold("Deliberation time is reading PLUS choosing PLUS reaching. ", "It overstates reading, and for this population the physical part is not small. It is still the right measure, because those three together are what the partner waits through."),
            bulletBold("Clocks differ. ", "The report carries both when it was sent by the device and when it was received. A device clock can be wrong; if a row looks impossible, compare the two before believing it."),

            // ===== 8 =====
            heading1("8. Setting It Up"),
            para("Most of this exists. What remains is small and should be done before the first tester starts, because none of it can be applied retrospectively."),
            numBold("Redeploy the receiver. ", "The script has been extended for the new material and adds the weeks tab. Editing and saving in the Apps Script editor changes nothing at the live address — it must be Manage deployments, then a new version of the SAME deployment. Confirm by visiting the address in a browser: it prints the script version.", "setup"),
            numBold("Put an address in the alert field. ", "One line in the receiver. Without it the error alerting is built and silent.", "setup"),
            numBold("Add the gone-quiet alert. ", "A daily scheduled check in the same script: any tester with no report in ten days, mail once. This is the alert most likely to change an outcome and it does not exist yet.", "setup"),
            numBold("Assign each tester a name in their app, at setup. ", "Reports without one still arrive and are still grouped by device, but they cannot be tied to a person you can contact.", "setup"),
            numBold("Chart the weeks tab once. ", "A line per tester, weeks along the bottom. Built once, it updates itself as rows are replaced.", "setup"),
            numBold("Note the first report is expected immediately. ", "The first send fires at first launch rather than after seven days, deliberately — so the whole path is proven while the tester is still sitting there during setup, instead of being found broken three weeks later. If no row appears that day, fix it that day.", "setup"),

            // ===== 9 =====
            heading1("9. The Cadence Around It"),
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
