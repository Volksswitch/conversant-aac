/* Generates docPath("Conversant AAC Switch Access Proposal.docx") - a proposal for
 * letting someone who can't direct a pointer use Conversant with one or two switches,
 * and for keeping that fast.
 *
 * WHY THIS EXISTS. Ken, November 3 2026: asked for research into switch access and a
 * proposal, then asked for it as a document: "I normally think of switch scanning
 * access as very slow. Please include your thoughts on how we can speed up the process
 * including trimming access to functionality (maybe in my own words access) and focus
 * more on making the express panel more powerful."
 *
 * WHERE THE NUMBERS COME FROM. The steps-per-letter figures were calculated from the
 * real layouts in app/js/keyboard-layouts.js with English letter frequencies. The
 * first-letters and key-words results came from a one-off run against claude-sonnet-5-5,
 * twelve turns, one made-up person, judged by reading the replies. Neither is a
 * measurement with a real switch user, and the document says so.
 *
 * Run: node generate-switch-access-doc.js
 * Figure: node capture-switch-access-figures.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, ImageRun, ExternalHyperlink } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(text)] });
const para = (text) => new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(text)] });
const bullet = (label, text) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: label, bold: true }), new TextRun(text)],
});
const num = (ref, label, text) => new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: label, bold: true }), new TextRun(text)],
});
const source = (label, url) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 0, after: 80 },
    children: [new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, style: "Hyperlink" })] })],
});

function figure(file, w, h, caption) {
    const k = 624 / w;
    return [
        new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER, keepNext: true,
            children: [new ImageRun({ type: 'png', data: fs.readFileSync(file),
                transformation: { width: Math.round(w * k), height: Math.round(h * k) } })] }),
        new Paragraph({ spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: caption, italics: true, size: 18, color: '666666' })] }),
    ];
}

function table(headers, rows, widths) {
    const cell = (text, w, head) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: cellMargins,
        ...(head ? { shading: { type: ShadingType.CLEAR, fill: "D5E8F0" } } : {}),
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, keepNext: !!head,
            children: [new TextRun({ text, bold: !!head })] })],
    });
    return new Table({
        width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        columnWidths: widths,
        borders,
        rows: [
            new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((t, i) => cell(t, widths[i], true)) }),
            ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, widths[i], false)) })),
        ],
    });
}
const gap = () => new Paragraph({ spacing: { before: 0, after: 160 }, children: [] });

const numbered = (reference) => ({ reference,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 24 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, keepNext: true, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 26, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 220, after: 140 }, keepNext: true, outlineLevel: 1 } },
        ],
        characterStyles: [
            { id: "Hyperlink", name: "Hyperlink", run: { color: "0563C1", underline: {} } },
        ],
    },
    numbering: {
        config: [
            { reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            numbered("checks"), numbered("build"), numbered("decisions"),
        ],
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Switch Access Proposal", italics: true, color: "808080", size: 18, font: "Arial" })],
        })] }) },
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  November 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" }),
            ],
        })] }) },
        children: [
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "Switch Access Proposal", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  November 2026  |  Last updated November 3, 2026", size: 20, color: "808080" })] }),

            para("This proposal covers how someone who can’t direct a pointer could use Conversant with one or two switches. The app would highlight its buttons in turn, and the user would press a switch to choose. In this document, “you” means the reader and “the user” means the person using the switch."),
            para("Scanning has a reputation for being slow, and for typing that reputation is earned. Choosing from what’s already on the screen is a different matter. A response option takes about 3 seconds to reach at one second per stop, and a typed five-word sentence takes 2 to 3 minutes."),
            para("The proposal follows from that gap. The user reaches response options and a small, well-chosen Express Panel on nearly every turn, and typing moves out of the way. New Express Panel buttons do much of the work typing does today, by telling the AI what the user wants to get across."),
            para("None of this has been tried with a real switch or a real switch user. The times below are arithmetic, and the evidence on scanning comes mostly from small studies."),

            h1("1. Where the Time Goes"),
            para("This table shows what each action costs a one-switch user with automatic scanning. It uses the design in section 3 and assumes no missed presses. Clinicians commonly set between 0.6 and 1.2 seconds per stop, so the table shows both ends of a likely range."),
            table(["Action", "Stops", "Presses", "At 1 second", "At 0.6 seconds"], [
                ["Response option", "2.5", "1", "3 seconds", "2 seconds"],
                ["Express Panel button, no options showing", "5", "2", "5 seconds", "3 seconds"],
                ["Express Panel button, options showing", "9", "2", "9 seconds", "5 seconds"],
                ["Topic button, then a response option", "11.5", "3", "15 seconds", "10 seconds"],
                ["A few typed words, “Reframe”, then a response option", "58", "25", "1 minute", "40 seconds"],
                ["Five-word sentence, keyboard arranged by letter use", "123", "54", "2 minutes", "75 seconds"],
                ["Five-word sentence, default QWERTY keyboard", "200", "54", "3 minutes 20 seconds", "2 minutes"],
            ], [3760, 1000, 1100, 1700, 1800]),
            gap(),
            para("The rows with an AI step include about 3 seconds for the AI to reply. The typing rows leave out word suggestions, which would lower them, and corrections, which would raise them. The sentence figures fit published results. Scanning on an on-screen keyboard averages about 1.7 words per minute across studies, and a very fast user may reach 6."),
            para("Presses matter as well as seconds. Each letter takes two presses, one for its row and one for the letter, and many switch users tire with repeated pressing."),
            h2("1.1 Reading takes time too"),
            para("The table leaves out reading. At an ordinary reading speed, four full sentences take about 12 seconds and four short labels take about 4. Conversant already offers short labels, through the setting “What a response option shows”. A switch user who reads more slowly would save more. On most turns this may save more time than any change to the scan, and it needs no new feature."),
            h2("1.2 Why a shorter silence helps the user"),
            para("Faster replies change how people judge the user. One study found a strong link between pause length and how competent the partner rated the AAC user. Conversant’s holding phrases already cover the gap. With the default settings the first one plays 2 seconds after the partner pauses and the second about 10 seconds later. The setting \u201CWait longer each exchange\u201D delays the first phrase further as the conversation goes on, and a switch user may want it set to 0."),

            h1("2. The Variations"),
            table(["Method", "What the user does", "What it costs"], [
                ["Automatic scan", "The highlight moves by itself. Press to choose.", "Needs well-timed presses."],
                ["Step scan", "One switch moves the highlight. A second switch chooses.", "Many presses, so it can be tiring."],
                ["Inverse scan", "Hold to move the highlight. Release to choose.", "Needs a steady hold."],
                ["Directed scan", "A joystick or several switches move the highlight in any direction.", "Needs several reliable movements. Four could map straight to the four options."],
                ["Morse code", "Press patterns spell letters.", "Must learn a code. Helps typing only. Two-switch Morse averages about 12 words per minute."],
                ["Spoken scan", "The app says each item as it’s highlighted.", "The partner hears it unless it goes to an earpiece."],
                ["Device’s own switch control", "The iPad, Android or Chromebook scans everything on the screen.", "No control over order, and nothing equivalent found for Windows."],
            ], [2160, 3800, 3400]),
            gap(),
            h2("2.1 What the evidence says"),
            bullet("No single method suits everyone with CP. ", "In a small 1992 study of six people, those with spastic CP had the most trouble with automatic scanning and those with athetoid CP had the most trouble with step scanning. Conversant should offer automatic, step and inverse scanning together."),
            bullet("Timing settings make a large difference. ", "Tuning the settings for each person raised typing speed by an average of 120% in a study of nine users, and by 71% in a later study."),
            bullet("Stored phrases support faster conversation. ", "Reviews of whole-phrase approaches report faster conversation with no loss of coherence. Their known costs are remembering what’s stored and finding that a stored phrase doesn’t quite fit."),
            bullet("Letting the AI expand short input can help. ", "In a study of two eye-gaze users with ALS, a system that expanded first letters raised typing speed by 29% to 60%. That system was trained specially for the job."),
            h2("2.2 Switch hardware"),
            para("Most switch interfaces present themselves to a device as a keyboard or mouse. The AbleNet Blue2 FT can send Space, Enter or a number key, and the Origin Instruments Tapio can act as a mouse, keyboard or joystick. Conversant would treat a key press, a mouse click and a tap anywhere on the screen as the same signal. Tap-anywhere needs no special hardware and suits someone who can touch a screen but can’t aim."),

            h1("3. How Scanning Would Work"),
            para("Conversant would have its own scanner, which works the same way on every device. It presses the same buttons a finger would, so the rest of the app behaves as it does today. Nothing on the screen moves, and the highlight changes only how a button looks. It has to show clearly in all seven color schemes."),
            ...figure('sa-fig1.png', 820, 506, "Figure 1. The order of the stops when response options are showing. The screen is simplified and the buttons are examples."),
            para("The highlight visits the four response options one at a time, then the Express Panel’s filled rows, then “New 4”, the Context band and the Command Bar. With no options showing, it starts at the first Express Panel row. A press on a row moves along that row one button at a time, and blank positions are skipped."),
            bullet("Time to read. ", "When new options arrive, the highlight rests on the first one for a set reading time. A press during that rest chooses it."),
            bullet("Rest after two passes. ", "If the user presses nothing for two full passes, the highlight stops on the first stop and waits for a press, so the screen doesn’t keep flashing."),
            bullet("Stray presses. ", "The user can ignore very short presses and quick repeats, and can choose whether the app acts on press or on release. Grid 3 offers similar choices."),
            bullet("One press or two. ", "With two presses set under “One tap or two”, the first press holds the option and the second speaks it. With no second press, the scan resumes. A switch user will need longer choices under “Time allowed between the two taps”."),
            bullet("Listening. ", "The setting “Resume listening automatically after speaking a response” would be on, so the user rarely needs “Listen”."),

            h1("4. Trimming What Gets Scanned"),
            para("Every extra stop costs time on every pass, including passes where the user wants something else. The proposal puts things in the loop according to how often they’re used."),
            table(["Where it sits", "What goes there"], [
                ["Early in every pass", "Response options, and Express Panel rows the user has filled"],
                ["Later in every pass", "“New 4”, the Context band with “In my own words”, and the Command Bar"],
                ["Not scanned at first", "The conversation pane, Settings, About Me and Conversation Review"],
                ["Skipped", "Blank positions, and anything switched off"],
            ], [3000, 6360]),
            gap(),
            para("The Command Bar has nine buttons, and most are rare in a conversation. “Ask them to repeat” and “Hold on” are the likely exceptions, so the user could place those two on the Express Panel’s first row. Partner, place and feeling are usually set once, so the Context band can sit late in the pass."),
            h2("4.1 “In my own words”"),
            para("Three placements are possible. This document recommends the first."),
            bullet("Late in the pass, one press deep. ", "It stays available and costs about 9 stops to open with options showing, or 4 without. Inside, the user types a few words and uses “Reframe”, and “Speak” remains for whole sentences."),
            bullet("Available only between conversations. ", "This removes it from the loop and suits writing phrases ahead of time. The user couldn’t say anything unanticipated during a conversation, which breaks the project’s rule that free composition is always available."),
            bullet("Early in the pass. ", "It would be quicker to open, but it adds a second to every pass for something a switch user may rarely use during a conversation."),
            para("A further trim is available. The Express Panel’s layouts have 32 or more positions because they share their shape with the keyboard, and a switch user doesn’t need to fill them. A panel of 12 buttons on the default layout needs no new layout, and it keeps each row to about 6 stops."),

            h1("5. A More Powerful Express Panel"),
            para("Today a user who doesn’t like the response options can press “New 4” for a different set, or type to tell the AI what they want. A switch user can’t afford much typing, so the panel needs to carry more of what typing does. Topic and direction buttons are new kinds of button. They use the path goal buttons and choice buttons already use, where a tap asks the AI again and speaks nothing."),
            bullet("Topic buttons. ", "A button holds a word or short phrase, such as “Tyler”, “therapy” or “my shoulder”. Tapping it rewrites the four response options around that topic. With nobody talking, it offers statements to open with, as “Reframe” does now."),
            bullet("Combining topics. ", "Two topic buttons pressed in one turn add together, so “Tyler” and “fight” give options about a fight with Tyler. Each press costs a few seconds and an AI request of about half a cent."),
            bullet("Direction buttons. ", "These work the same way and say how to reply rather than what about, such as “Shorter”, “Say no” or “Tell them more”. The Reframe research lists the common kinds of redirection, and that list is a starting set."),
            bullet("Keep what was typed. ", "After the user speaks a typed sentence, the app offers one press to keep it as a button for this partner, this place or everywhere. The user should only have to type a 2-minute sentence once. The app offers and the user decides."),
            bullet("Write ahead. ", "Between conversations nothing is waiting on the user, so typing costs less and a supporter can help. The AI could also draft phrases for a person or place from About Me, and the user would keep the ones that sound right."),
            bullet("Commands on the panel. ", "A panel button could press a Command Bar button, so “Ask them to repeat” can sit in the first row."),
            bullet("Situation first. ", "When the partner or place has its own Flex list, the scan could visit those rows before the Always rows."),
            bullet("Use counts. ", "Between conversations the app could show which buttons get used and how far along the scan they sit. The user decides whether to move them, and the app never moves them on its own."),
            para("Topic buttons aren’t folders. A folder opens another set of buttons, and a topic button changes the response options in their usual place, so the project’s decision against folders still stands. With the AI unavailable, topic and direction buttons do nothing, while stored phrases and typing keep working."),

            h1("6. Typing When It’s Needed"),
            para("Two kinds of short typing could replace whole sentences. A rough check tried both against the AI model the app uses now, with one made-up person and twelve conversation turns. It used a simple test prompt rather than the app’s full one, and the “same meaning” count is one reader’s judgment."),
            table(["What the user types", "Average characters", "Intended meaning among the four replies"], [
                ["First letter of each word", "5.6", "7 of 12, and some replies were nonsense"],
                ["A few key words", "9.9", "11 of 12"],
            ], [3360, 2000, 4000]),
            gap(),
            para("First letters gave replies such as “Whatever, any old oranges, Mom.” for “We are out of milk.” This proposal doesn’t include them for now. Key words were reliable even when short: “therapy” produced “I can’t Friday, I have therapy.” That result is also the case for topic buttons, because a topic button is a key word the user doesn’t have to type."),
            bullet("A keyboard arranged by letter use. ", "A letter costs 7.6 stops on the default QWERTY layout and 6.0 on the best current layout. A new layout with the most-used letters first would cost about 4.5."),
            bullet("Word suggestions. ", "The suggestion already shown in the text box becomes a stop whenever one is showing, so it needs no new button. One secondhand report gives 2.7 words per minute with word prediction against 1.5 without it."),

            h1("7. Where This Meets Current Behavior"),
            bullet("Response options changing mid-scan. ", "With continuous listening, a new set can replace the options while the user is choosing, and one tester saw 47% of sets replaced before touching anything. A switch user could press and speak a different sentence from the one they meant. This proposal holds the newer set while the highlight is in the options and shows it after a full pass with no press. This applies to switch users only."),
            bullet("Spoken scanning. ", "Spoken cues would reach the partner and the microphone unless they went to an earpiece. A page can probably send sound to a second device in Chrome or Edge on a computer, but not reliably on an iPad. The first version would be visual only, which fits the current literate target user. Widening to less literate users depends on hearing options privately, so this limit matters for that direction."),
            bullet("The AI’s words and the user’s own. ", "A user who rarely types will speak more of the AI’s wording, and a small study found AAC users will trade control for speed when timing is critical. Stored phrases are the user’s own words, and topic buttons keep the user deciding the content. Measuring how often the user changes or rejects options would show whether this is becoming a problem."),
            bullet("Next-word prediction. ", "The project decided against it because it saves one keystroke per word, while a letter here costs about 5 to 8 seconds. Keeping that decision or revisiting it would be a question for when typing is built."),
            bullet("The keyguard. ", "A switch user doesn’t need one. The screen layout stays the same, so a person who uses both a keyguard and a switch loses nothing."),

            h1("8. What to Check First"),
            para("The first three checks need real devices and switches. Any of the four answers could change the design."),
            num("checks", "Does a switch press reach the page? ", "Try an iPad in Safari and installed on the Home Screen, Android, and a Surface, in keyboard mode and mouse mode. No source confirmed this for the iPad. When Switch Control is on, it may take the presses before the page sees them."),
            num("checks", "Does the device’s own switch control already work? ", "Try Conversant with iPad Switch Control, Android Switch Access and Chromebook Switch Access. Conversant may already be usable this way, as it is with eye gaze."),
            num("checks", "Does a pointer plus a switch already work? ", "Eye gaze or a head pointer with a switch that sends a mouse click should work today. This hasn’t been tested."),
            num("checks", "Do people get faster with these buttons? ", "A simple paper or clickable mock-up of topic buttons, shown to the therapists, could test the idea before anything is built."),

            h1("9. Build Order"),
            num("build", "Device checks. ", "The checks in section 8."),
            num("build", "Conversation screen. ", "All three scan methods, stray-press filtering, the highlight, the order of stops, holding new options during a scan, and “In my own words”."),
            num("build", "Express Panel power. ", "Topic and direction buttons, commands on the panel, and keeping what was typed."),
            num("build", "Refinements. ", "A helper for finding good timing, the keyboard arranged by letter use, and use counts."),
            num("build", "Later. ", "Spoken cues, directed scanning, and scanning in Settings and About Me."),
            para("Three ideas are left out. Morse code helps only typing and takes learning. Scan speed that adjusts itself changes behavior unasked, and about 30% of users in one study didn’t fit its model. Highlighting driven by language prediction makes the highlight jump around, and its authors couldn’t conclude it was faster."),

            h1("10. Decisions Needed"),
            num("decisions", "Where scanning lives. ", "Building it into the app works on Windows and can put response options first, at the cost of building and maintaining it. Relying on each device’s own control is nearly free but leaves out Windows and gives a poorer experience. Recommended: build it into the app, after the checks."),
            num("decisions", "New options during a scan. ", "Holding them keeps the highlighted sentence steady, but the user may answer from a slightly older set. Replacing them at once and restarting the scan keeps today’s rule, but the user could lose their place repeatedly. Recommended: hold them."),
            num("decisions", "“In my own words”. ", "Section 4.1 gives the three placements. Recommended: late in the pass, one press deep."),
            num("decisions", "Topic and direction buttons. ", "These add two new kinds of button and an AI request per press. Without them, a switch user can only press “New 4” and hope, or type. Recommended: build them, and try them with direct-select users too."),
            num("decisions", "Settings and About Me. ", "Leaving them to a supporter at first brings the conversation screen sooner, but a switch-only user can’t change settings alone until later. Recommended: a supporter at first."),
            num("decisions", "Timing against the beta. ", "Running the checks now settles the unknowns at small cost. Building now would compete with beta work, and waiting means switch users wait longer. Recommended: checks now, and build once face-to-face conversation is reliable."),

            h1("11. Sources"),
            source("Angelo 1992, comparison of three scanning modes in CP", "https://data.zhenzhi.com/details/1/1005860153"),
            source("Koester and Simpson 2014, enhancing single-switch scanning, and related papers", "https://kpronline.com/pubs"),
            source("Scanning Wizard evaluation", "https://pmc.ncbi.nlm.nih.gov/articles/PMC5967995"),
            source("Text entry rates across access methods", "https://kpronline.com/blog/evidence-on-computer-text-entry-by-people-with-disabilities"),
            source("Single-switch scanning model, with typical rates and the word prediction figures", "https://arxiv.org/pdf/1712.10073"),
            source("Adaptive scan timing study", "https://a11y-paradise.onrender.com/reviews/69ce6148c233c928e86aa6f7"),
            source("Roark et al. 2015, scanning driven by language prediction", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4617344"),
            source("Todman et al. 2008, whole utterance approaches in AAC", "https://discovery.dundee.ac.uk/en/publications/whole-utterance-approaches-in-aac/"),
            source("Cai et al. 2023, SpeakFaster", "https://arxiv.org/abs/2312.01532v1"),
            source("Agency and timing in AI-powered AAC, CHI 2025", "https://arxiv.org/html/2410.16634"),
            source("Valencia et al. 2023, “The less I type, the better”", "https://discovery.ucl.ac.uk/10185220/1/3544548.3581560.pdf"),
            source("Grid 3 switch scanning settings", "https://hub.thinksmartbox.com/knowledgebase/using-switch-scanning-with-grid-3/"),
            source("Grid 3 private auditory cue", "https://us.tobiidynavox.com/blogs/support-articles/how-do-i-setup-grid-3-with-switch-scanning-to-provide-a-private-auditory-cue"),
            source("iOS Switch Control overview", "https://www.levelaccess.com/blog/assistive-technology-users-mobility-disabilities-ios-switch-control/"),
            source("Android Switch Access", "https://support.google.com/accessibility/android/answer/6122836?hl=en"),
            source("Chromebook Switch Access", "https://support.google.com/chromebook/answer/10274137"),
            source("Windows On-Screen Keyboard", "https://support.microsoft.com/en-us/help/10762/windows-use-on-screen-keyboard"),
            source("AbleNet Blue2 FT", "https://www.inclusive.com/uk/blue2-ft.html"),
            source("Origin Instruments Tapio specifications", "https://cdn.shopify.com/s/files/1/0753/1197/2628/files/Tapio-Specifications.pdf"),
            source("Sending audio to a second device, browser support", "https://caniuse.com/mdn-api_htmlmediaelement_setsinkid"),
            source("WebKit report on iPad and iPhone audio routing", "https://bugs.webkit.org/show_bug.cgi?id=320087"),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Switch Access Proposal.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
