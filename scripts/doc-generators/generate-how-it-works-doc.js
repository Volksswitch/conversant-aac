/* Conversant AAC — How Conversant Works (November 9 2026)
 *
 * A short, plain account of what is inside the app, for a non-technical or
 * technical-adjacent reader: the parts, what happens when someone speaks, how it knows
 * the user, where information goes, who pays, what happens when something fails. Ken
 * asked for it as a level above the Architecture Overview, and as better source material
 * for a question session than that 23,000-word engineering record. The reader is not
 * the user, so "you" is the reader and "the user" is the person using the app.
 *
 * Figure 1 is drawn by generate-how-it-works-figure.py (run it first if it changes).
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const path = require('path');
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

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(text)] });
}
function para(text) {
    return new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(text)] });
}
function boldPara(label, text) {
    return new Paragraph({ spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)] });
}
function itemBold(label, text, ref) {
    return new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)] });
}
function emptyPara() { return new Paragraph({ children: [] }); }

function figure(file, w, h, caption) {
    const k = 624 / w;
    return [
        new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER, keepNext: true,
            children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(__dirname, file)),
                transformation: { width: Math.round(w * k), height: Math.round(h * k) } })] }),
        new Paragraph({ spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: caption, italics: true, size: 18, color: '666666' })] }),
    ];
}

function simpleTable(headers, rows, widths) {
    const cell = (text, w, head) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: head ? { type: ShadingType.CLEAR, fill: "D5E8F0" } : undefined,
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, keepNext: !!head,
            children: [new TextRun({ text, bold: !!head, size: 22 })] })]
    });
    return new Table({
        width: { size: 9360, type: WidthType.DXA },
        borders,
        rows: [
            new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
            ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) }))
        ]
    });
}

const bulletList = (ref) => ({ reference: ref,
    levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 0 } },
        ]
    },
    numbering: { config: [bulletList("kinds"), bulletList("knows"), bulletList("leaves"),
                          bulletList("fails"), bulletList("next")] },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — How Conversant Works", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  November 2026  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            new Paragraph({ spacing: { before: 240, after: 80 },
                children: [new TextRun({ text: "How Conversant Works", bold: true, color: "1F4E79", size: 40, font: "Arial" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "What’s inside Conversant AAC, in plain terms", italics: true, color: "595959", size: 24, font: "Arial" })] }),
            new Paragraph({ spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  November 2026  |  Last updated November 9, 2026", color: "808080", size: 20, font: "Arial" })] }),

            heading1("1.  What This Document Covers"),
            para("Conversant AAC helps a person who doesn’t speak take part in live conversation. It listens to the other person, and within a few seconds it offers the user several things they could say back. The user picks one, and the device says it in their voice."),
            para("This document is for anyone who wants to know what’s inside: what the parts are, where information goes, who pays, and what happens when something breaks. It assumes no programming knowledge. The Product Overview says what Conversant does and why it matters, and the Architecture Overview has the full engineering detail."),
            emptyPara(),

            heading1("2.  What Are the Parts?"),
            para("Conversant is a web app: it runs in the device’s web browser, so there’s nothing to install from an app store. The screen, the decisions about what to show, and everything the user has entered all live on the device. Three jobs need help from services on the internet, and Figure 1 shows where each one fits."),
            ...figure('hiw-fig1.png', 1600, 950, 'Figure 1. From the other person speaking to the device speaking. Blue steps happen on the device; orange steps use an outside service.'),
            simpleTable(["Job", "Who does it", "What it costs"], [
                ["Hearing the other person (speech-to-text)", "The browser’s own speech recognition, or a paid service from Microsoft Azure, Google Cloud, Deepgram or ElevenLabs.", "Free with the browser. A paid service costs roughly 22 cents to a dollar per hour of speech."],
                ["Writing the response options", "Claude, an AI model made by Anthropic, used through the user’s own account.", "Paid per use. A set of options typically costs about half a cent."],
                ["Saying the chosen reply (text-to-speech)", "The device’s own voices, or a more natural paid voice from the same four companies.", "Free with the device. A paid voice costs a few cents per hour of conversation."],
            ], [2400, 4160, 2800]),
            emptyPara(),

            heading1("3.  What Happens When Someone Speaks?"),
            para("The app listens continuously while the other person talks. Each time they pause, for half a second by default, it sends what they’ve said so far to the AI and asks for response options. If they carry on talking, it asks again with the fuller version, so the options keep up with what was actually said."),
            para("The options take a few seconds to arrive. In the meantime the app says a short holding phrase in the user’s voice, such as “I’m thinking about that”. Silences of a few seconds are a main reason conversations with communication devices are so hard. The holding phrase fills them, and the user decides how soon it comes and how many there are, including none."),
            para("The options always cover four different kinds of reply, each in its own fixed place on the screen:"),
            itemBold("An answer that goes along with what was said. ", "The most natural reply, such as agreeing or answering a question.", "kinds"),
            itemBold("A polite way to decline or disagree. ", "Most devices make saying no much harder than saying yes.", "kinds"),
            itemBold("A new direction. ", "A question back, a related topic, or a change of subject.", "kinds"),
            itemBold("A request to clarify. ", "For when something wasn’t clear, such as “Did you mean next Friday?”", "kinds"),
            para("These four come from conversation analysis, the study of how real conversations work. The positions never change, so the user learns where each kind of reply sits. They aren’t ranked, because each is a different kind of reply rather than a better or worse one."),
            boldPara("Nothing the AI writes is said until the user picks it. ", "The holding phrase is the only thing the device says on its own. The user can also tap one of their own ready-made phrases, or type their own words at any time. Typed words can be said as they are, or handed to the AI to have the options rebuilt around them."),
            emptyPara(),

            heading1("4.  How Does It Know the User?"),
            para("The AI isn’t trained on the user and doesn’t change over time. Instead, every request for options carries a briefing, put together on the device at that moment. It includes:"),
            itemBold("Standing instructions. ", "How to write each kind of reply, and the rules in section 5.", "knows"),
            itemBold("What the user has told the app. ", "Their answers to a self-paced questionnaire called About Me, the people in their life, the places they go, how they talk with each person, and their goals.", "knows"),
            itemBold("What’s going on now. ", "Who they’re talking with, where they are and how they feel, if they’ve said, and the conversation so far.", "knows"),
            para("The standing part of the briefing is the same from one request to the next, so the AI service keeps it for a few minutes and charges a tenth of the price to reuse it. That’s a large part of why a set of options costs so little."),
            para("The app also learns from use in two ways. When a conversation needed a fact the user hadn’t given, such as a pet’s name, the app suggests it as a question to answer later. And when the user looks back at a conversation and rewrites what they said, the rewrite becomes an example of how they talk with that person."),
            emptyPara(),

            heading1("5.  What Won’t It Do?"),
            para("The app speaks as the user, not for them, and a few rules follow from that. It never makes up facts about the user. Asked about allergies with nothing on file, it offers “I don’t know” rather than an invented “no allergies” that a clinician would write down."),
            para("It also won’t answer general-knowledge questions on the user’s behalf, such as a date in history or how something works. That would turn the user into a search engine and put words in their mouth that they may never have known. The options offer what a person would say instead, such as not knowing or turning the question back. The exceptions are subjects the user says they know well, a topic they’ve given the app documents for (section 10), and anything the user types for the AI to work in."),
            para("It doesn’t offer swearing. The AI company’s own safety rules apply as well, and the app can’t turn them off."),
            emptyPara(),

            heading1("6.  Where Does the Information Go?"),
            para("Everything the user enters stays on their device: About Me, people, places, phrases, settings and saved conversations. On a computer or an Android device it lives in a folder the user picks. On an iPad it lives in storage the browser keeps for the app. The user can make a backup file and copy it to another device."),
            para("Information leaves the device only for these reasons:"),
            itemBold("To the AI company, ", "when it writes options: the conversation so far and the briefing described in section 4.", "leaves"),
            itemBold("To the hearing service, ", "while the other person is speaking.", "leaves"),
            itemBold("To a paid voice service, ", "if the user has one: the words it’s asked to say.", "leaves"),
            itemBold("To Volksswitch, ", "only what the user sends: a weekly usage report of counts and timings, which never includes anything that was said and can be turned off, and any problem report the user chooses to send.", "leaves"),
            para("The other person’s voice isn’t recorded. Only the text of what they said is kept, and only if the conversation is saved. The keys that let the app use those services are stored on the device and are never put into a backup. A “Don’t save” control keeps any conversation off the record. There’s no Volksswitch server holding anyone’s information, because there’s no Volksswitch server."),
            emptyPara(),

            heading1("7.  Who Pays for What?"),
            para("The app is free and open source, under the Apache 2.0 license. Its files are published on GitHub’s free website hosting, so there’s nothing for Volksswitch to run or pay for as more people use it."),
            para("The user sets up their own account with the AI company and pays only for what they use. If they want a paid voice or a paid hearing service, they set that up the same way. There’s no subscription, and nobody in the middle. Earlier AI communication projects shut down when their funding ran out; with no server and no per-user cost, this one can’t be defunded."),
            emptyPara(),

            heading1("8.  What If Something Fails?"),
            itemBold("The AI can’t be reached, or there’s no AI key. ", "The suggestions stop, but the user still sees what the other person said, and can still talk with their ready-made phrases and their own typed words. The AI adds suggestions on top; the rest of the app doesn’t depend on it.", "fails"),
            itemBold("No internet connection. ", "The app still opens, from a copy stored on the device. It can’t hear the other person or write options, because both are online services, but the ready-made phrases and typed words still work with the device’s own voice.", "fails"),
            itemBold("A paid voice fails. ", "That sentence is said in the device’s own voice instead, so a tap never goes unanswered.", "fails"),
            itemBold("A new version comes out. ", "The app updates itself, waits until no conversation is under way, and then shows a short, plain summary of what changed.", "fails"),
            emptyPara(),

            heading1("9.  What Devices Does It Run On?"),
            para("A Windows tablet or laptop, a Chromebook or a Mac using Chrome or Edge; an iPad using Safari; and an Android phone or tablet using Chrome. The features are the same on all of them."),
            para("The user points directly at the screen. Eye-gaze equipment that moves the pointer like a mouse has also been used, on a computer. Switch scanning, for someone who can’t point, isn’t built yet."),
            para("The main difference is hearing. A computer and an iPad in Safari can use the browser’s free speech recognition. On Android the device’s own recognition is good enough to try the app, but it drops words, so real conversations need a paid hearing service. An iPad with the app installed on its Home Screen needs one too. The iPad’s own choice of voices is also limited, so a paid voice is worth considering there."),
            emptyPara(),

            heading1("10.  Can It Answer Questions After a Talk?"),
            para("Yes. The user sets up a topic, such as the subject of a talk, and gives the app the documents their answers should come from. With the topic switched on, each question gets four answers drawn only from those documents: a short one, and three that go deeper. A question the documents don’t cover gets an answer saying the user doesn’t know. A separate guide, “Taking Questions After a Talk”, covers getting ready."),
            emptyPara(),

            heading1("11.  What’s Built and What’s Next?"),
            para("Everything described above is built and in use. These are the main things planned:"),
            itemBold("Knowing the situation without being told. ", "Today the user taps who they’re talking with and where they are. Later the app could work this out from location and by recognizing the other person.", "next"),
            itemBold("A choice of AI company. ", "The app is built so another AI company can be added without rewriting it.", "next"),
            itemBold("AI on the device itself. ", "Free and private, but today’s tablets are far too slow for it. Laptops are the likely first step.", "next"),
            itemBold("Drawing on the user’s own writing. ", "Letting the AI use the user’s essays, messages and other writing in everyday conversation.", "next"),
            itemBold("Switch scanning. ", "For someone who can’t point at the screen, the options and buttons would be highlighted in turn and chosen with a switch.", "next"),
            itemBold("A voice that is the user’s own. ", "A voice built from recordings of the user, rather than a stock voice.", "next"),
            emptyPara(),

            heading1("12.  Terms Used Here"),
            simpleTable(["Term", "Meaning"], [
                ["AI model", "A computer program trained on a large amount of writing, which can write new text in response to instructions. Conversant uses Claude, made by Anthropic."],
                ["API key", "A private code that lets the app use an online service on the user’s account, so the service knows whom to bill."],
                ["Speech-to-text", "Turning spoken words into written text. Conversant uses it to hear the other person."],
                ["Text-to-speech", "Turning written text into spoken words. Conversant uses it to say the user’s reply."],
                ["Web app", "A program that runs inside a web browser rather than being installed from an app store."],
            ], [2400, 6960]),
            emptyPara(),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    const out = docPath('Conversant AAC How Conversant Works.docx');
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out + ' (' + buffer.length + ' bytes)');
});
