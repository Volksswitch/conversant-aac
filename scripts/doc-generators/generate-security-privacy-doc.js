/* Generates docPath("Conversant AAC Your Security and Privacy.docx") - what the app
 * protects for the USER, and where that protection stops.
 *
 * WHY THIS EXISTS. Ken, review comment 323: "We need to create a document that clarifies
 * how the app protects their security and privacy and also how it may fall short of
 * complete coverage." The manual had a placeholder pointing at a document that did not
 * exist; the placeholder was removed rather than shipped, and this is the document.
 *
 * ⚠ IT IS ABOUT THE USER. The communication partner has their own version of this
 * question and their own document (Conversant AAC Partner Privacy). Where the two touch,
 * this one points there rather than restating it.
 *
 * ⚠ THE SECOND HALF IS THE POINT AND MUST NOT BE SOFTENED. Ken asked for the shortfalls
 * as explicitly as the protections. Section 4 is therefore written to be uncomfortable
 * where the truth is uncomfortable: the data folder is not encrypted, Settings are not
 * locked, a "private" fact IS still sent to the AI, and a private conversation is still
 * sent to the AI to produce suggestions - it governs what is written down, not what is
 * sent. Anyone editing this must keep those four stated in plain terms.
 *
 * ⚠ CHECKED AGAINST SHIPPED CODE, August 27 2026, not against the security backlog -
 * the backlog describes intent and several items in it are unbuilt:
 *   - PROFILE_EXCLUDE really does exclude both keys from profiles, and
 *     reportableSettings replaces them with a presence marker (storage.js)
 *   - Export carries the five user files plus conversations, and no keys
 *     (data-transfer.js)
 *   - the weekly report defaults to ON and its contents are a fixed field list
 *     (weekly-send.js); the reversal for public release is a recorded decision
 *   - encryption, the settings PIN, the single-instance guard and the send
 *     restriction are all SPECIFIED AND NOT BUILT, and are described that way
 *
 * Nothing here is a legal claim. It says what the software does.
 *
 * Run: node generate-security-privacy-doc.js
 */const { docPath } = require('./doc-paths');
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

// Figures are produced by capture-express-panel-figures.js from
// "Express Panel Figures.html" (re-run it after editing that file). Scaled to the
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
            { reference: "prot",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "adv",
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
                children: [new TextRun({ text: "Your Security and Privacy", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "What the app protects, how it protects it, and — just as plainly — where that protection stops.", italics: true, size: 22, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 260 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  August 2026  |  Last updated August 27, 2026", size: 18, color: "777777" })] }),

            heading1("1.  What This Is For"),
            para("This app holds an unusually complete picture of a person: what they think, who is in their life, where they go, how they feel, and a record of their conversations. That is not incidental to it — the app cannot suggest anything worth saying without knowing those things. So the question of what happens to all of it deserves a straight answer rather than a reassuring one."),
            para("This document gives both halves. What is protected and how. And where the protection stops, which is the half that usually goes unwritten."),
            lead("It is about YOU. ", "The person on the other side of the conversation has their own version of this question, and their own document: Conversant AAC Partner Privacy. Where the two touch, this one points there rather than repeating it."),
            lead("Nothing here is a legal opinion. ", "It describes what the software does. Whether that satisfies any particular law, in any particular place, is a question for someone qualified to answer it."),

            heading1("2.  Where Everything Lives"),
            para("The app has no server of its own. There is no account to sign up for, no database anywhere holding your conversations, and nothing for anyone to breach. That is a deliberate design choice, and it is the single largest thing protecting you."),
            para("What that leaves is a short and knowable list: things that stay on your device, and things that go to a company you have an account with."),
            simpleTable(["What", "Where it lives", "What leaves the device"], [
                ["Your About Me answers, your people, your places, your phrases", "A folder you choose on your machine. On an iPad, private storage inside the browser.", "Copies are sent to the AI with every request for suggestions, so it can sound like you."],
                ["Your saved conversations", "The same folder, one file per conversation.", "The conversation so far is sent to the AI on each turn, so a reply makes sense in context. The saved files themselves are never uploaded."],
                ["What the other person said", "The same files.", "Their speech is sent to a recognition service to be turned into text. See section 6."],
                ["Your settings, and your API keys", "Browser storage on that one machine.", "Nothing. Keys are excluded from every export, backup, settings profile and report."],
                ["Your spoken words, if you use the paid voice", "Nothing is kept.", "The text is sent to the voice service, which sends audio back."],
            ], W3),
            emptyPara(),
            lead("So the honest one-line summary is not “nothing leaves your device”. ", "It is: nothing is stored anywhere but your device, and what leaves goes only to the companies whose accounts you set up, in order to do the thing you asked for."),

            heading1("3.  What Protects You"),
            numBold("No account and no server. ", "There is nothing to sign into and nothing central to steal. Most privacy failures happen to a company's database; this app does not have one.", "prot"),
            numBold("The app has its own web address. ", "Since August 2026 it is served from conversant.volksswitch.org rather than sharing an address with other Volksswitch projects. Browsers keep data separate per address, so nothing on another Volksswitch page can reach this app's stored data. The connection is encrypted and that is enforced.", "prot"),
            numBold("Your keys never travel. ", "The API keys are excluded by name from saved settings profiles, from Export, from backups, and from every problem report and weekly report. A report says whether a key is set and nothing more.", "prot"),
            numBold("A conversation can be marked private before it starts. ", "“Don't save this conversation” means nothing either of you says is written down. A technical error may still be noted, with none of the words.", "prot"),
            numBold("Facts can be marked private, or withheld entirely. ", "Three levels, described in section 5.", "prot"),
            numBold("Nothing is ever said without you tapping it. ", "The app generates suggestions; it does not speak them. That is a permanent rule, not a setting, and it is what stops a wrong suggestion from becoming a wrong statement.", "prot"),
            numBold("Reports carry counts, never words. ", "The weekly report contains numbers and timings. It cannot contain anything either of you said. The list of what it contains is generated from the report itself, so it cannot drift from the truth.", "prot"),
            numBold("Sending a transcript is always a deliberate act. ", "If you attach a conversation to a problem report, you do it on purpose, having seen what you are sending.", "prot"),

            heading1("4.  Where It Falls Short"),
            para("Every item here is a real limit, stated as plainly as we can manage. Some are consequences of choices that buy something else worth having; some are simply not built yet."),

            heading2("4.1  Your data folder is not encrypted"),
            lead("What it means. ", "Your conversations, your About Me answers, the people in your life and the places you go are ordinary files. Anyone who can open your device, or who can reach those files any other way, can read all of it."),
            lead("What actually protects it today. ", "Your device does. A Windows account password with disk encryption turned on, or an iPad passcode, is the real boundary — not anything in the app."),
            lead("Worth knowing. ", "If you put the folder inside OneDrive, iCloud or Google Drive, every conversation is copied to that company as well, and to every other machine signed into the same account. That may be exactly what you want for backup. It should be a decision rather than a surprise."),
            lead("Will it be fixed? ", "Optional encryption with a passphrase has been designed and not built. It trades away the ability to simply copy the folder to another machine, which is currently how people move their data."),

            heading2("4.2  Anyone holding the device can change anything"),
            lead("What it means. ", "Settings are not locked. Whoever has the device can read the profile, change how the app behaves, export everything, or see that a key is present."),
            lead("Why it is that way. ", "This app is used by people who often depend on others for physical help. A lock that shuts a supporter out at the wrong moment is its own harm. The choice was made in favor of access, and it has a cost."),
            lead("Will it be fixed? ", "A supporter-held PIN over the setup-level settings is planned. It is not there now."),

            heading2("4.3  Private facts are protected by instruction, not by walls"),
            lead("What it means. ", "A fact marked private is still sent to the AI. What changes is that the AI is told not to raise it on its own — only when the other person asks about it, or when you steer toward it yourself."),
            lead("Why it is that way. ", "Withholding a fact entirely also withholds it from the answers you want. If the app does not know your phone number it cannot offer it when someone asks for it. The private setting is for facts you want available but not volunteered."),
            lead("The honest limit. ", "An instruction is not a wall. It is followed reliably in practice and it is not a guarantee. Only one level actually withholds a fact from the AI: “Prefer not to say”. If a fact must never leave your device, that is the level to use — or do not enter it."),

            heading2("4.4  The AI company sees your conversations"),
            lead("What it means. ", "To suggest what you might say, the AI must be given what was said, plus enough about you to make the suggestion sound like you. That request goes to Anthropic under your own account."),
            lead("What that does and does not imply. ", "It is your account and your relationship with them, on their terms, which you can read. We never see any of it, and there is no copy on any machine of ours. But the words do leave your device, and “private” in this app has never meant “the AI does not see it”."),
            lead("What you can do. ", "A conversation marked private is still sent to the AI in order to produce suggestions — that setting governs what is written down, not what is sent. To keep something from the AI entirely, do not have that part of the conversation through the app."),

            heading2("4.5  Speech recognition happens online"),
            lead("What it means. ", "The microphone audio is sent to a recognition service, on every configuration the app supports. There is no on-device option, and the free one built into the browser is a cloud service too."),
            lead("Consequences. ", "The app cannot hear anything without an internet connection. And the audio it sends includes the other person's voice, which is their business as much as yours — the Partner Privacy document covers that side."),

            heading2("4.6  Browser storage can vanish"),
            lead("What it means. ", "Your settings and, on an iPad, everything else live in storage the browser controls. Clearing site data erases it. On an iPad, the system can reclaim it if the app goes unused for a long stretch."),
            lead("What protects you. ", "On a computer, your data folder is a real folder and survives all of this; only settings are at risk, and a saved settings profile in that folder restores them. On an iPad the answer is Export, and to do it regularly rather than when you remember."),

            heading2("4.7  Two copies of the app open at once can trip over each other"),
            lead("What it means. ", "Two windows both writing to the same files can lose something. Each also hears the other's speech."),
            lead("Where it stands. ", "The fix is designed and not built. In the meantime: one window."),

            heading2("4.8  Some hardening is still on the list"),
            para("A page-level restriction on where the app may send data has been specified and not yet turned on. It is a second line of defense behind careful handling of text, not the first."),

            heading1("5.  The Three Levels for a Fact"),
            simpleTable(["Level", "What happens to it"], [
                ["Shareable (the default)", "Sent to the AI, and it may use the fact naturally in a suggestion."],
                ["Private", "Sent to the AI, which is told not to raise it on its own. It can appear when the other person asks, or when you steer toward it. Nothing is ever said until you tap it."],
                ["Prefer not to say", "Not sent at all. The AI is told only to phrase around the gap. This is the only level that withholds."],
            ], W2),
            emptyPara(),
            lead("The same three levels apply to people and to places. ", "A person marked private is never named on the AI's own initiative; a person you never enter is simply not there."),

            heading1("6.  Your Keys"),
            para("You create your own account with the AI company, and with the voice or transcription service if you use one, and you pay them directly for what you use. Nobody at Volksswitch handles your keys, sees your bill, or can spend your money."),
            para("A key is stored on the one machine you entered it on. It is not in any export, backup, settings profile or report. It is masked on screen. Moving to a new machine means entering it again, which is a small inconvenience bought with a real protection."),
            lead("The residual risk. ", "The key sits in browser storage on that machine in a form the machine can read. Anyone who fully controls the device could recover it. If you think that has happened, revoke the key with the provider — that is instant, and it is the only remedy that matters."),

            heading1("7.  During the Beta"),
            para("While the app is in beta testing there is one deliberate exception to everything above, and it ends when the beta does."),
            para("The app sends a weekly report to the project: counts, timings, which errors happened, and details of your device and settings. It is turned on by default, and it can be turned off. It contains no transcripts and no keys, and it cannot — the report is built from a fixed list of countable things."),
            lead("What it does carry that is personal. ", "A name assigned to you at setup, so we know whose report it is. With a handful of testers, that identifies you within the group. The reports land in a private spreadsheet the project controls."),
            lead("When it ends. ", "For the public release the default reverses: reporting will be off unless someone turns it on. That is a commitment already recorded, not an aspiration."),

            heading1("8.  Practical Advice"),
            numBold("Turn on device encryption and use a passcode. ", "This is the single most effective thing available, and it is not in the app's hands.", "adv"),
            numBold("Decide deliberately where the data folder goes. ", "Inside a cloud-sync folder means automatic backup and a copy at that company. Outside it means neither.", "adv"),
            numBold("Use “Don't save this conversation” before a sensitive one, not after. ", "It governs what gets written down, and it cannot un-write anything.", "adv"),
            numBold("Use “Prefer not to say” for anything that must never leave the device. ", "Private is not the same thing, and section 4.3 explains why.", "adv"),
            numBold("Export regularly on an iPad. ", "That is the only backup there is.", "adv"),
            numBold("If a device is lost, revoke your API keys first. ", "Before anything else. It costs nothing and it stops the only ongoing expense a stranger could run up.", "adv"),

            heading1("9.  The One-Paragraph Version"),
            para("Your data lives on your device and nowhere else, because the project has no server to put it on. What leaves goes only to the AI and speech companies whose accounts you set up, to do the work you asked for, and your conversations are sent to the AI in order to suggest replies. What is stored on your device is not encrypted by the app, so your device passcode is the real lock. Settings are not locked, so anyone holding the device can see and change things. A fact marked private is still sent to the AI, with an instruction not to volunteer it; only “Prefer not to say” actually holds it back. Nothing is ever spoken unless you tap it. During the beta a weekly report of counts and timings is sent to the project, carrying no words either of you said, and after the beta that becomes something you switch on rather than off."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Your Security and Privacy.docx");
    fs.writeFileSync(out, buffer);
    console.log("Your Security and Privacy.docx generated ->", out);
});
