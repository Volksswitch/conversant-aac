/* Generates "Conversant AAC Beta Test Plan.docx".
 *
 * ⚠ THE FIRST LINE OF THIS COMMENT USED TO SAY "from BETA-TEST-PLAN.md" AND THAT IS
 * NOT WHAT HAPPENS. Nothing here reads that file — every paragraph below is a second,
 * hand-authored copy of it. So editing the markdown and then running this does NOT
 * carry the edit across: it rewrites the .docx from the older text here, silently
 * reverting it, with no error and a document that looks freshly built. That nearly
 * dropped the "reports are not anonymous" disclosure from §9 on Aug 8 2026, which is
 * the one paragraph in the document a tester is entitled to.
 * ⚠ EDIT BOTH FILES IN THE SAME PASS. If they ever disagree, diff them — the .docx is
 * what a tester reads and the markdown is what Ken reads, so neither is automatically
 * the newer one. (Making this generator parse the markdown would be the real fix, but
 * Appendix B and the callout boxes mean it is a rewrite, not a tidy-up.)
 *
 * TESTER-FACING. Two deliberate differences from the other generators in this
 * folder, both because of who reads it:
 *   1. The footer says "For beta testers", NOT the usual "For internal use" —
 *      handing someone a document stamped internal-use is a contradiction.
 *   2. Appendix B of the .md ("For Ken, not for testers") is DROPPED. It lists
 *      unbuilt features and open decisions and must never reach a tester.
 *
 * Run: node generate-beta-test-plan-doc.js
 */
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
function numbered(text, ref = "numbers") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function numberedBold(label, text, ref = "numbers") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

function cellPara(text, bold = false) {
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

// A call-out box for the things a tester must not skim past.
function calloutBox(lines, fill = "FFF2CC", edge = "BF9000") {
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
            children: lines.map(({ label, text }, i) => new Paragraph({
                spacing: { before: 0, after: i === lines.length - 1 ? 0 : 120 },
                children: [
                    ...(label ? [new TextRun({ text: label, bold: true, font: "Arial", size: 22 })] : []),
                    new TextRun({ text, font: "Arial", size: 22 })
                ]
            }))
        })] })]
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
            { reference: "steps",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Beta Test Plan", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  August 2026  |  For beta testers  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [

// ===== TITLE =====
new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: "Beta Test Plan", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "Conversant AAC — What We Are Asking of You, What We Are Trying to Learn, and How to Tell Us When Something Goes Wrong", italics: true, color: "595959", size: 24, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  August 2026", color: "808080", size: 20, font: "Arial" })]
}),

// ===== 1 =====
heading1("1.  What This Is"),
para("Conversant AAC is a free, open-source communication app for people who cannot speak. It listens to the person you are talking with, and within a few seconds it offers you several things you might say back. You pick one and the device speaks it in your voice."),
para("Most communication devices are built for getting a message out. Conversant AAC is built for something harder: keeping a conversation going in real time. People find silence awkward after about four seconds, and that is the gap this app is trying to close."),
para("You are among the first people outside the project to use it. Nothing about it is finished, and your experience over the next six weeks will decide what gets fixed, what gets changed, and what gets thrown away."),

// ===== 2 =====
heading1("2.  What We Are Trying to Learn"),
para("Please read this section, because it explains why we ask what we ask."),
boldPara("Question 1 — Do you keep using it?  ", "Not “do you use it every day.” You will open this app when there is a conversation to have, and some weeks have more of those than others. What we want to know is whether, six weeks in, you still reach for it when a conversation comes up. If you stop, we badly want to know why. A tester who quits in week two teaches us more than one who is politely enthusiastic in week six."),
boldPara("Question 2 — Can you say what you actually meant?  ", "When the app offers you cards, how often is one of them close enough to say out loud without asking for a new set or typing your own? This is the central bet of the whole product. If the answer is “rarely,” we need to know that plainly and early."),
boldPara("Question 3 — Does it keep up?  ", "How long is the gap between the other person finishing and you speaking? If it is still long enough to be uncomfortable, the app has not solved the problem it exists to solve."),
para("Everything else — buttons, colors, layout, voices — matters, but it matters in service of those three."),

// ===== 3 =====
heading1("3.  What We Ask of You"),
table([2600, 6760],
    ["", ""],
    [
        ["How long", "Six weeks"],
        ["How much", "Use it when you would naturally have a conversation. There is no daily quota."],
        ["Weekly", "A short note back — three questions, a couple of minutes (see section 8)"],
        ["When something goes wrong", "Tap Report a problem. That is the whole procedure."],
        ["At the end", "A conversation with Ken, in whatever form works for you"],
    ]),
emptyPara(),
para("You may stop at any time, for any reason, and we would still like the five minutes it takes to tell us why."),

// ===== 4 =====
heading1("4.  What You Need"),
bulletBold("A tablet or computer.  ", "Either a Windows tablet or Chromebook, or an iPad. A Windows tablet (a Microsoft Surface is the usual choice) is the configuration we know best."),
bulletBold("An internet connection.  ", "The app needs it both to hear the other person and to suggest responses. It will not work offline."),
bulletBold("An API key for the AI — we provide this, at no cost to you.  ", "It is what powers the response suggestions. Ken will send you a key to paste into Settings. You do not need an account and you will not be billed."),
bulletBold("A free Deepgram account, for the voice.  ", "Deepgram gives the app a much more natural, more varied voice than the ones built into your device, and signing up gives you $200 of free credit — no credit card. That is far more than six weeks of testing will use. On an iPad running the installed app it also does the listening, which the device cannot do on its own. If you somehow run through the credit, tell us and we will sort it out."),
bulletBold("A supporter, for setup.  ", "Choosing a folder, pasting a key, and setting the layout are fiddly one-time jobs. After that the app is yours to drive."),
emptyPara(),
para("Your User Manual covers your device specifically. Use the one for your device — they are self-contained, and you should never need both."),

// ===== 5 =====
heading1("5.  Before Your First Real Conversation"),

heading2("5.1  Setup Checklist (With Your Supporter)"),
numbered("Open the app and choose a data folder. Do this first. Everything you enter lives there.", "steps"),
numbered("Paste the AI key we sent you and press Test. It should say your key is working.", "steps"),
numbered("Create your free Deepgram account, paste that key, and press its Test.", "steps"),
numbered("Pick your voice, and listen to it. This is the voice people will hear as you. Try the Deepgram voices — they are the reason you set that account up.", "steps"),
numbered("On a Windows tablet or Chromebook, leave the listening set to your browser's own — it is free, reliable, and does not spend your Deepgram credit. On an iPad running the installed app, set listening to Deepgram; it is the only option that works there.", "steps"),
numbered("Set the button size, the gaps, and where the keyboard sits.", "steps"),
numbered("Save all of that as a named settings profile — and re-save it every time you change something. This is what protects your setup, and it is the one habit worth building.", "steps"),
numbered("If you are on an iPad, do an Export and keep the file somewhere safe.", "steps"),

heading2("5.2  Tell Your Communication Partners"),
calloutBox([
    { label: "Please do this. ", text: "It matters more than any feature." },
    { label: "", text: "The app listens to the person you are talking with and sends what they say to a transcription service to turn it into text. Their words are written down in your conversation record. They have no way of knowing that unless you tell them." },
    { label: "", text: "Say something once, at the start — “this device listens and speaks for me” — and that is usually the end of it. We will send you a small printed card for the back of the device if that is easier than explaining each time." },
]),
emptyPara(),

heading2("5.3  Learn the Buttons Before You Need Them"),
para("The row of buttons across the middle of the screen is the part testers most often forget. Spend one practice session pressing every one of them at least once, so that when you need Ask them to repeat in a real conversation, your hand already knows where it is."),
para("Open Settings and then Practice, and work through a scenario. Nobody is listening; nothing you say is spoken to a real person. Practice as many times as you like."),

// ===== 6 =====
heading1("6.  Week by Week"),
para("This is a suggestion, not homework. If your life gives you a real conversation in week one, take it."),
table([1200, 8160],
    ["Week", "What to try"],
    [
        ["1", "Setup and practice. Do not have a real conversation yet. Get the buttons into your hands."],
        ["2", "Make it yours. Fill in About Me. Add the people you talk to, the places you go, and how you feel. Edit the Express Panel so the phrases are your phrases. This is not optional setup — it is what makes the suggestions sound like you."],
        ["3", "First real conversations, at home, with someone patient who knows what you are doing."],
        ["4", "Widen it. A different person. A different room."],
        ["5", "Take it out — a shop, an appointment, somewhere with noise and strangers."],
        ["6", "Just use it. No tasks. This is the week that tells us whether it has earned a place in your life."],
    ]),
emptyPara(),
para("Keep editing your phrases, people, and places throughout. Testers who keep tuning the app tend to be the ones it ends up working for, and we would like to understand why."),

// ===== 7 =====
heading1("7.  When Something Goes Wrong"),
boldPara("Tap “Report a problem.” ", "You will find it in Settings under Troubleshooting, and also on the opening screen next to the version number, in case the app is too stuck to reach Settings."),
para("Write one line about what happened in your own words — “I pressed Listen and nothing happened” is a perfect report. The app attaches everything technical by itself: what version you are on, what device, what settings, and what the app was doing in the seconds before."),
boldPara("You do not have to catch every problem. ", "If something felt wrong and you were mid-conversation, carry on. Report it afterwards if you remember."),
para("Two things to watch for and always report:"),
bulletBold("The conversation panel turns faintly red. ", "That means the app hit an error. It is a nudge, not an emergency — finish your conversation, then report it."),
bulletBold("Nothing happens when it should. ", "No cards, no speech, a dead button. These are the failures we are worst at detecting on our own, because the app does not know it has failed. Your report is the only way we find out."),

// ===== 8 =====
heading1("8.  The Weekly Note"),
para("Three questions, once a week. Two minutes."),
numbered("Roughly how many real conversations did you have with it this week?"),
numbered("Was there a moment it let you down? What happened?"),
numbered("Was there a moment it worked? What happened?"),
emptyPara(),
para("Question 3 is not a courtesy. Knowing what already works tells us what not to break."),

// ===== 9 =====
heading1("9.  Privacy — Read This Once"),
boldPara("What stays on your device: ", "everything you enter. About Me, your people, your places, your phrases, and the full text of your conversations live in your data folder, on your device. They are not uploaded, and there is no account and no server holding your information."),
para("What leaves your device, and why:"),
bulletBold("What the other person says ", "goes to a transcription service to be turned into text. This is how every speech recognition system works, and it is why telling your partners matters."),
bulletBold("What you might say ", "— the conversation so far, plus what you have told the app about yourself — goes to the AI so it can suggest responses. You pick what is spoken; nothing is said out loud unless you choose it."),
bulletBold("During this beta only: ", "the app sends back usage information and error reports so we can see how it is holding up. This is counts and timings only — how many conversations, how long you waited, which buttons you pressed, what error occurred. It never includes what you or the other person said. A transcript is only ever sent if you choose to attach one, and you see it first."),
emptyPara(),
boldPara("These reports are not anonymous, and you should know that before you agree to them. ", "Each one carries the tester name we gave you at setup, so we can tell whose report is whose and follow up with the right person. We already know who you are — you volunteered — so the name tells us nothing new. But it does mean the reports are a record with your name on it, held by us, and that is worth saying out loud rather than leaving you to work out. They also carry a code identifying the device, so reports from your tablet stay separate from reports from anything else you use."),
para("You can read exactly what a report contains at any time in Settings under Troubleshooting, under “What is in a weekly report”, along with a list of every report already sent."),
para("You can turn automatic reporting off in the same place. We would rather you left it on, because it means you never have to remember to send us anything — but it is your choice and turning it off will not affect the app."),
calloutBox([
    { label: "Any single conversation can be kept out of the record entirely. ", text: "Tap Don't save this conversation before you begin, and nothing from it is written down. Use it whenever you want to; you do not need a reason." },
], "E2EFDA", "548235"),
emptyPara(),

// ===== 10 =====
heading1("10.  What We Already Know Is Wrong"),
para("See the Known Issues document that came with your kit. It is worth five minutes before you start — several things that look like faults are known and already understood, and reading it saves you reporting them."),
para("If something is in there and it is causing you real trouble, tell us anyway. Knowing which known problems actually hurt is how we decide what to fix first."),

// ===== 11 =====
heading1("11.  Getting Help"),
para("Contact Ken directly — you have his details in your welcome pack. Always include your version number, which is on the opening screen and in Settings under About."),
para("There is no wrong question and no bad report. If you are unsure whether something is a fault or just how the app works, that uncertainty is itself worth telling us about."),

// ===== APPENDIX A =====
heading1("Appendix A.  Glossary"),
table([2900, 6460],
    ["Term", "What it means"],
    [
        ["Response cards", "The suggestions the AI offers you. Four of them, or eight if you have chosen two per category."],
        ["Category", "The kind of reply a card is. Agreeing, declining, changing direction, or asking them to repeat. They are always in the same place so your hand can learn them."],
        ["Command Bar", "The row of buttons between your conversation and your cards."],
        ["Express Panel", "Your own phrases, and the buttons for who you are with, where you are, and how you feel."],
        ["In my own words", "Type something the AI did not suggest and have it spoken."],
        ["Reframe", "Type what you want to get across, and the AI rewrites the cards around it."],
        ["Practice", "Rehearse with the AI playing the other person. Nothing is spoken to a real person."],
        ["Data folder", "Where everything you enter is stored on your device."],
    ]),

        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("Conversant AAC Beta Test Plan.docx", buffer);
    console.log("Wrote Conversant AAC Beta Test Plan.docx");
});
