/*
 * generate-backup-compatibility-doc.js
 *
 * Produces "Conversant AAC Backup Compatibility.docx" — a short READER-FACING
 * document answering "does a backup made on my iPad work on my computer?".
 *
 * Reader-facing, so per DOC-SYNC it must never say "Chromium" or "WebKit": the
 * device families are "Windows, Chromebook and Mac" and "iPad", and the iPad's two
 * modes are "in the Safari browser" and "installed on your Home Screen".
 *
 * Every UI detail here was read from app/index.html and app/js/data-transfer.js
 * before being written down (standing rule: verify UI against source).
 *
 * Regenerate:  node generate-backup-compatibility-doc.js
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
function bullet(text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function bulletBold(label, text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
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
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Backup Compatibility", italics: true, color: "808080", size: 18, font: "Arial" })]
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
new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: "Backups on an iPad and on a Computer", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "What comes across when you move between devices, and what you set up again", italics: true, color: "595959", size: 24, font: "Arial" })]
}),
new Paragraph({
    spacing: { before: 0, after: 260 },
    children: [new TextRun({ text: "Conversant AAC  |  Volksswitch.org  |  August 2026", color: "808080", size: 20, font: "Arial" })]
}),

// ===== 1 =====
heading1("The short answer"),
para("A backup made on an iPad restores on a computer, and a backup made on a computer restores on an iPad. There is one backup format, and it does not change from one kind of device to the other. Everything you have entered comes across."),
para("Two small things are different, and neither is a problem once you know about them. A few pieces of information are deliberately left out of every backup, for your safety. And a few of your settings describe the device rather than you — those you set once on the new device and then forget about."),
emptyPara(),

// ===== 2 =====
heading1("What comes across"),
para("All of it, on either kind of device:"),
bullet("Your About Me answers"),
bullet("People and relationships"),
bullet("My Places, with the facts you recorded for each one"),
bullet("Your Express Panel buttons"),
bullet("Your conversation starters and control phrases"),
bullet("Your saved conversations"),
bullet("Almost all of your settings — how long a pause the app waits for, placeholder timing, button size and spacing, which layout you use, text sizes, single or double tap, and so on"),
emptyPara(),

// ===== 3 =====
heading1("What you set up again on the new device"),
para("Four things, once each, after you import:"),
emptyPara(),
table([2600, 6760], ["What", "Why, and what to do"], [
    ["Your API key\n(and your Deepgram key, if you use one)",
     "Keys are never written into a backup file. That is deliberate: it is what makes the file safe to keep in a synced folder, or to send to someone who is helping you.\nType the key in again under Settings → General → API Key (and Settings → Speech → Deepgram key)."],
    ["Your voice",
     "The free voices belong to the device. A voice on your computer is not installed on your iPad, and an iPad voice is not on your computer, so the app quietly falls back to the standard voice.\nChoose your voice again under Settings → Speech, along with the practice partner voice. A paid Deepgram voice is the exception — that one does come across, because it is not a device voice."],
    ["On-screen or physical keyboard",
     "This depends on whether the device you are now using has a keyboard attached. Set it under Settings → Buttons & Keyboard."],
    ["How the app hears the other person",
     "Also a per-device choice, under Settings → Speech → Hearing the other person.\nOne thing to know on an iPad: the free built-in listening does not work when Conversant is installed on your Home Screen, only in the Safari browser. If you use the Home Screen version, you need a Deepgram key for the app to hear anyone."],
]),
emptyPara(),

// ===== 4 =====
heading1("It will not look identical"),
para("Button sizes, spacing and margins are stored as a share of the screen rather than as fixed measurements, so they come across as the same proportion of whatever screen they land on. Screens differ in size and shape, so the new device will look close to the old one, but not the same. Adjust to taste under Settings → Buttons & Keyboard."),
boldPara("If you use a keyguard, expect to make a new one. ", "A keyguard is cut for one screen. The holes will not line up on a different device no matter what the settings say, so generate the openings again on the device you are actually using."),
emptyPara(),

// ===== 5 =====
heading1("Making a backup and bringing it back"),
boldPara("To make one: ", "Settings → General → Backup & transfer → Export my data. The file is named for the date and time it was made, like conversant-backup-2026-08-05-1432.json."),
para("On a computer where you have chosen a data folder, the backup is saved into a folder called backups inside it, beside the data it protects. On an iPad — and on a computer where you have not chosen a folder — your browser saves the file instead, and on an iPad it lands in the Files app."),
boldPara("To bring it back: ", "on the other device, Settings → General → Backup & transfer → Import from a file…, and pick the file. The app shows you what the backup contains and asks you to confirm before it replaces anything. On a computer, backups already sitting in your data folder also appear in a list there, so you can restore one without hunting for it."),
para("Getting the file from one device to the other is up to you: email it to yourself, put it in iCloud, OneDrive or Google Drive, or carry it on a USB stick. It is an ordinary file."),
emptyPara(),

// ===== 6 =====
heading1("Two things to watch"),
bulletBold("Restore into an app that is at least as up to date. ", "A backup made by a newer version of Conversant will not open in an older one. The app tells you so rather than importing part of it. Let the other device update itself first, then import."),
bulletBold("On a computer, choose your data folder before importing. ", "Everything else restores without one, but your saved conversations need a folder to be written into. On an iPad there is nothing to do — the app always has somewhere to put them."),
emptyPara(),
para("When an import finishes, the app reloads itself and your restored setup is in place. If something looks missing afterward, check those two points first — saved conversations need a data folder to be written into, and your key and your voice are always set fresh on each device.", { run: { italics: true, color: "595959" } }),

        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync('Conversant AAC Backup Compatibility.docx', buf);
    console.log('Wrote Conversant AAC Backup Compatibility.docx (' + buf.length + ' bytes)');
});
