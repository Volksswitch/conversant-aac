/* Generates docPath("Conversant AAC Website Home Page.docx") — a draft of the
 * Conversant AAC home page on volksswitch.org, for Ken to review before it is
 * built in WordPress.
 *
 * The page is shared only with beta testers (through the welcome email) and is not
 * linked from anywhere else on the site, so it can give the app's address and talk
 * to the reader as a tester.
 *
 * Part 1 is notes for the reviewer; part 2 is the page text as a visitor would
 * read it. Every reference to a web resource is a real link. Buttons are drawn as
 * shaded boxes and pictures as bracketed notes; a table at the end lists every link.
 *
 * Facts checked against the Product Overview (October 11 2026), the beta sign-up
 * page, scripts/video/course.json and the live page list, October 25 2026.
 *
 * Run: node generate-home-page-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, Table, TableRow,
        TableCell, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
        WidthType, ShadingType, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;
const GRAY = "808080";
const BETA = "B45309";
const LINK = "0563C1";

const SITE = "https://volksswitch.org/index.php/";
const URL = {
    app: "https://conversant.volksswitch.org/",
    beta: SITE + "conversant-beta/",
    videos: SITE + "conversant-videos/",
    v11: SITE + "conversant-videos/video-1-1/",
    v13: SITE + "conversant-videos/video-1-3/",
    v15: SITE + "conversant-videos/video-1-5/",
    v51: SITE + "conversant-videos/video-5-1/",
    docs: SITE + "conversant-documents/",
    issues: SITE + "conversant-aac-known-issues/",
    code: "https://github.com/Volksswitch/conversant-aac",
    contact: SITE + "contact-us/",
};

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// A paragraph's content is a list of parts: a string, { link, text }, { bold }, or a run.
function runs(parts, base = {}) {
    return parts.map(p => {
        if (typeof p === 'string') return new TextRun({ text: p, ...base });
        if (p.link) return new ExternalHyperlink({ link: p.link,
            children: [new TextRun({ text: p.text, color: LINK, underline: {}, ...base, ...(p.bold ? { bold: true } : {}) })] });
        if (p.bold) return new TextRun({ text: p.bold, bold: true, ...base });
        return p;
    });
}
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(t)] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(t)] });
const para = (...parts) => new Paragraph({ spacing: { before: 0, after: 160 }, children: runs(parts) });
const betaTag = () => new TextRun({ text: "  [Beta: remove at public release]", italics: true, color: BETA });
const bullet = (...parts) => new Paragraph({
    numbering: { reference: "bullets", level: 0 }, spacing: { before: 0, after: 80 }, children: runs(parts) });
const numbered = (ref, ...parts) => new Paragraph({
    numbering: { reference: ref, level: 0 }, spacing: { before: 0, after: 100 }, children: runs(parts) });
const button = (text, link) => new Paragraph({
    spacing: { before: 80, after: 160 },
    shading: { type: ShadingType.CLEAR, fill: "DCE6F0" },
    border: { top: border, bottom: border, left: border, right: border },
    children: [new TextRun({ text: "Button:  ", color: GRAY }), ...runs([{ link, text, bold: true }])] });
const picture = t => new Paragraph({ spacing: { before: 80, after: 200 },
    children: [new TextRun({ text: `[Picture: ${t}]`, italics: true, color: GRAY })] });

function table(headers, rows, widths) {
    const cell = (parts, w, bold, fill) => new TableCell({
        width: { size: w, type: WidthType.DXA }, margins: cellMargins,
        shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, keepNext: !!bold,
            children: runs(parts, bold ? { bold: true } : {}) })] });
    return new Table({
        width: { size: 9360, type: WidthType.DXA }, borders,
        rows: [new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell([h], widths[i], true, "D5E8F0")) }),
               ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) }))] });
}
const linkRow = (label, url) => [[label], [{ link: url, text: url.replace(/^https:\/\//, '') }]];

const children = [
    new Paragraph({ spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
    new Paragraph({ spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: "Website Home Page", bold: true, size: 32, color: "444444" })] }),
    new Paragraph({ spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "A draft of the page for review", italics: true, size: 24, color: "555555" })] }),
    new Paragraph({ spacing: { before: 0, after: 320 },
        children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated October 25, 2026", size: 20, color: GRAY })] }),

    // ===== Part 1 =====
    h1("Notes for Your Review"),
    para("This is the text for one page, shared only with beta testers through the welcome email. No other page on the site links to it. It gives testers the app’s address, the videos that get them started, and the other pages they’ll want: the documents, the known issues and how to tell us about a problem."),
    para("A tester may read it alone or with a helper, a family member or a speech therapist. The page is written in plain words for all of them, and “you” means whoever is reading."),
    para("In the page below, a shaded box is a button and a note in brackets marks a picture. Every link in the text works, and the table at the end lists them all. Lines marked in orange describe the beta and come out at public release. The suggested address is volksswitch.org/index.php/conversant/."),
    para("The picture near the top will be the conversation screen from the how-to videos, made at the size the page needs."),

    // ===== Part 2 =====
    h1("The Page"),
    new Paragraph({ spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: "Conversant AAC", bold: true, size: 40, color: "1F4E79" })] }),
    new Paragraph({ spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: "From communication to conversation", italics: true, size: 28, color: "444444" })] }),
    para("Conversant AAC is a free app that helps people who use AAC keep up in a real conversation. It listens to the other person, offers four ways to reply within a few seconds, and says the one the user taps."),
    button("Open Conversant", URL.app),
    button("Watch: What Conversant Is For (1 minute)", URL.v11),
    picture("the conversation screen with four response options showing"),

    h2("Thank You for Testing It"),
    para("Conversant is in beta, and you’re one of a small group of people trying it before anyone else. What you tell us decides what we fix and what we build next.", betaTag()),
    bullet({ bold: "Start with the videos. " }, "The ", { link: URL.videos, text: "how-to videos" }, " walk you through setting up and your first conversations, a few minutes at a time."),
    bullet({ bold: "Tell us when something goes wrong. " }, "Conversant can send us a problem report in a couple of taps. The video ", { link: URL.v51, text: "“Telling Us About a Problem”" }, " shows how."),
    bullet({ bold: "Check the known issues. " }, "The ", { link: URL.issues, text: "known issues" }, " page lists problems we already know about and how to work around them."),
    bullet({ bold: "Know someone who might like to try it? " }, { link: URL.beta, text: "Tell us about them" }, ", and we’ll write to them."),

    h2("How It Works"),
    numbered("steps", "The other person talks. Conversant listens and shows what it heard, so the user can check it."),
    numbered("steps", "A few seconds later, four response options appear: a friendly answer, a polite way to say no, a way to take the conversation somewhere new, and a way to ask what they meant."),
    numbered("steps", "The user taps one, and Conversant says it out loud in the voice they’ve chosen."),
    para("If none of the four fit, the user can type their own words or tap a phrase they’ve saved. While they read the options, Conversant can say a short phrase like “I’m thinking about that,” so the other person knows a reply is coming."),
    para("The other person doesn’t need anything: no app, no training and no special knowledge."),

    h2("The Problem It Solves"),
    para("Most AAC devices are built to get a message across: a need, a choice, a piece of information. Conversation asks for more than that. A reply has to come while it still fits."),
    para("People start to feel uncomfortable after one to four seconds of silence. After that they finish the sentence for the AAC user, change the subject or move on. Building a full reply on most devices takes much longer, so many AAC users end up answering questions instead of taking part. Conversant puts a reply in front of the user within that window."),

    h2("What Makes It Different"),
    bullet({ bold: "It speaks as the user. " }, "Conversant shapes its options around what the user has told it about themselves, the people in their life and the places they go. Nothing is said until the user taps it."),
    bullet({ bold: "It doesn’t put words in the user’s mouth. " }, "It won’t answer for the user with facts they never gave it, such as a date in history or an allergy that isn’t on file. It offers what a person would say instead: that they don’t know, or a question back."),
    bullet({ bold: "Nothing on the screen moves. " }, "Every button stays where it is, so the user can learn where things are, and one keyguard fits every screen."),
    bullet({ bold: "It works with many ways of pointing. " }, "A finger, a stylus, a mouse or a trackball all work, and so do eye gaze and head tracking set up to move the pointer."),
    bullet({ bold: "It keeps working without the AI. " }, "If the AI can’t be reached, saved phrases and typing still work, and the user can still see what the other person said."),
    bullet({ bold: "There’s a practice mode. " }, "The AI plays the other person, so the user can rehearse before a conversation that matters, like a doctor’s appointment."),
    bullet({ bold: "It’s private. " }, "The user’s information stays on their own device. Only what’s needed to suggest replies goes to the AI company."),
    bullet({ bold: "It’s free and open source. " }, "There’s no subscription and no license, and the ", { link: URL.code, text: "source code is on GitHub" }, ". Users pay the AI company directly for what they use, usually a fraction of a cent per reply."),

    h2("Who It’s For Right Now"),
    para("The first version is designed for someone who:"),
    bullet("is 18 or older and makes their own decisions"),
    bullet("can read the options on the screen"),
    bullet("points at the screen directly, in any of the ways listed above"),
    bullet("has an iPad, an Android phone or tablet, or a Windows computer or tablet, Chromebook or Mac"),
    para("Switch scanning, younger users and people at other reading levels are part of the plan for later versions."),

    h2("What You Need"),
    bullet("A supported device with a current web browser. There’s nothing to download from an app store."),
    bullet("An internet connection."),
    bullet("An AI key, which lets Conversant ask an AI company for response options. The video ", { link: URL.v13, text: "“Adding Your AI Key”" }, " shows where it goes."),
    bullet("During the beta, we give you the AI key and cover its cost.", betaTag()),
    bullet("On an Android device, or an iPad with Conversant on the Home Screen, a paid speech service so the app can hear the other person. The video ", { link: URL.v15, text: "“Do You Need a Speech Service?”" }, " helps you find out whether you need one."),

    h2("Learn More"),
    bullet({ link: URL.videos, text: "How-to videos", bold: true }, ". Short videos, from installing Conversant to your first conversation and beyond."),
    bullet({ link: URL.docs, text: "Documents", bold: true }, ". The Product Overview, a user manual for each kind of device, and guides to privacy, costs and speech services."),
    bullet({ link: URL.issues, text: "Known issues", bold: true }, ". Problems we know about, and how to work around them."),
    bullet({ link: URL.code, text: "Source code", bold: true }, ". Conversant is open source, and its code is on GitHub."),
    bullet({ link: URL.contact, text: "Contact us", bold: true }, ". Questions, ideas or anything else."),
    para("Conversant AAC is a Volksswitch project."),

    // ===== Links =====
    h1("Every Link on the Page"),
    table(["Link", "Goes to"], [
        linkRow("Open Conversant", URL.app),
        linkRow("What Conversant Is For", URL.v11),
        linkRow("How-to videos", URL.videos),
        linkRow("Telling Us About a Problem", URL.v51),
        linkRow("Known issues", URL.issues),
        linkRow("Tell us about them", URL.beta),
        linkRow("Adding Your AI Key", URL.v13),
        linkRow("Do You Need a Speech Service?", URL.v15),
        linkRow("Documents", URL.docs),
        linkRow("Source code", URL.code),
        linkRow("Contact us", URL.contact),
    ], [3600, 5760]),
];

const list = (reference, format, text) => ({ reference, levels: [{ level: 0, format, text,
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 0, keepNext: true } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 26, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 220, after: 140 }, outlineLevel: 1, keepNext: true } },
        ]
    },
    numbering: { config: [
        list("bullets", LevelFormat.BULLET, "•"),
        list("steps", LevelFormat.DECIMAL, "%1."),
    ] },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  October 2026  |  For internal use  |  Page ", size: 18, color: GRAY }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY }),
                new TextRun({ text: " of ", size: 18, color: GRAY }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: GRAY }),
            ] })] }) },
        children,
    }],
});

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(docPath("Conversant AAC Website Home Page.docx"), buf);
    console.log("Wrote Conversant AAC Website Home Page.docx");
});
