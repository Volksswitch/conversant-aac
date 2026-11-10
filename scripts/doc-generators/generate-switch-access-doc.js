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
 * REVISED November 9 2026 from Ken's 28 review comments. The ones that changed the
 * design: scanning by REGIONS in his order (response options with New 4, Express Panel,
 * In my own words, Command Bar), the whole response options region highlighted during
 * the reading time, "topic buttons" renamed Reframe buttons (Topic is now a reserved
 * word in the app), "direction buttons" folded into goals, "keep what was typed"
 * dropped, every "one study" replaced by a numbered source, and a web page prototype
 * (prototypes/switch-access.html) for the therapists to try.
 *
 * REVISED AGAIN November 9 2026: a separate review found sixteen problems (section 12)
 * and Ken asked for all of them fixed. The timings now assume a small panel of three
 * rows (Always, Context, Flex) of about six buttons, and add the panel as shipped.
 *
 * WHERE THE NUMBERS COME FROM. The steps-per-letter figures were calculated from the
 * real layouts in app/js/keyboard-layouts.js with English letter frequencies. The
 * region figures in section 1 assume an Express Panel of two rows of about six buttons
 * (1.5 row stops plus 3.5 button stops on average) and that the press entering the
 * response options comes during the reading time. The first-letters and key-words
 * results came from a one-off run against claude-sonnet-5-5, twelve turns, one made-up
 * person, judged by reading the replies. None of it is a measurement with a real switch
 * user, and the document says so.
 *
 * SOURCES. The "about 30% didn't fit the model" figure comes from a published summary
 * of Ghedira et al. 2009, not the paper itself, and the document says so.
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
const step = (ref, text) => new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 0, after: 80 },
    children: [new TextRun(text)],
});
// A numbered source: the citation as plain text, then the link. The number is the one
// the body quotes in square brackets, so the order of this list is the order of first
// mention in the body and must not be re-sorted.
// A finding in section 12: the numbered problem, then what changed in response, indented
// under it so it reads as part of the same item.
const fixp = (text) => new Paragraph({
    spacing: { before: 0, after: 120 }, indent: { left: 720 },
    children: [new TextRun({ text: "What changed: ", italics: true }), new TextRun(text)],
});
const source = (citation, url) => new Paragraph({
    numbering: { reference: "sources", level: 0 },
    spacing: { before: 0, after: 80 },
    children: [new TextRun(citation + " "),
        new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, style: "Hyperlink" })] })],
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
            numbered("regions"), numbered("checks"), numbered("build"), numbered("decisions"), numbered("review"),
            { reference: "sources",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "[%1]", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 540 } } } }] },
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
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  November 2026  |  Last updated November 9, 2026", size: 20, color: "808080" })] }),

            para("This proposal covers how someone who can’t direct a pointer could use Conversant with one or two switches. The app would highlight parts of the screen in turn, and the user would press a switch to choose. In this document, “you” means the reader and “the user” means the person using the switch."),
            para("Scanning has a reputation for being slow, and for typing that reputation is earned. Choosing from what’s already on the screen is a different matter. At one second per stop, a response option takes about 3 seconds to reach once the user has read the options, which takes about 4 seconds for short labels and 12 for full sentences. A typed five-word sentence takes 2 to 3 and a half minutes."),
            para("The proposal follows from that gap. The user reaches response options and a small, well-chosen Express Panel on nearly every turn, and typing moves out of the way. Express Panel buttons holding words saved in advance do much of the work typing does today, by telling the AI what the user wants to get across."),
            para("None of this has been tried with a real switch or a real switch user. The times below are arithmetic, and the evidence on scanning comes mostly from small studies. A web page prototype lets the therapists and the project try the ideas before anything is built (section 8). Numbers in square brackets, such as [3], refer to the numbered sources in section 11."),

            h1("1. Where the Time Goes"),
            para("This table shows what each action costs a one-switch user with automatic scanning. It uses the regions described in section 3 and assumes no missed presses; section 3.6 gives the cost of a miss. A stop is one move of the highlight. The table shows two speeds, 1 second and 0.6 seconds per stop, as examples, because the right speed varies widely from person to person [2]."),
            para("Unless a row says otherwise, it assumes a small Express Panel set up for switch use: an Always row, a Context row and a Flex row, each with about six buttons, on the default layout. A row of six costs 3.5 stops on average, and choosing among three rows costs 2."),
            table(["Action", "Stops", "Presses", "At 1 second", "At 0.6 seconds"], [
                ["A response option", "2.5", "2", "3 seconds", "2 seconds"],
                ["An Express Panel button", "6.5", "3", "7 seconds", "4 seconds"],
                ["An Express Panel button, the panel as shipped", "10", "3", "10 seconds", "6 seconds"],
                ["A second Express Panel button straight after the first", "5.5", "2", "6 seconds", "3 seconds"],
                ["A Reframe button, then a response option", "10", "5", "13 seconds", "9 seconds"],
                ["A few typed words, “Reframe”, then a response option, on today’s best keyboard layout", "66", "25", "70 seconds", "45 seconds"],
                ["The same, on a keyboard arranged by letter use (not built)", "51", "25", "55 seconds", "35 seconds"],
                ["Five-word sentence, default QWERTY keyboard", "205", "54", "3 minutes 25 seconds", "2 minutes"],
                ["Five-word sentence, keyboard arranged by letter use (not built)", "122", "54", "2 minutes", "75 seconds"],
            ], [3760, 1000, 1100, 1700, 1800]),
            gap(),
            para("Every row leaves out reading (section 1.1). The response option row starts counting when the reading time ends, because the press that enters the response options can come during it. The rows with an AI step include about 3 seconds for the AI to reply. The typing rows leave out word suggestions, which would lower them, and corrections, which would raise them."),
            para("The panel as shipped has three rows of Always phrases and a Context row, each up to 12 buttons wide on the default layout, and no Flex row. Side layouts are only 3 buttons wide but up to 11 rows deep, so choosing a row costs more there and choosing within a row costs less."),
            para("The two sentence rows assume a 27-character sentence and count the keyboard only. They fit published results. Scanning on an on-screen keyboard averages about 1.7 words per minute [1]. The nine users in one study typed between about 1 and 6.5 words per minute once their settings were tuned [2]."),
            para("Presses matter as well as seconds. Regions add a press, because the user first chooses the region and then the button inside it. Visiting every button one at a time saves that press but costs more stops: an Express Panel button takes about 11.5 stops with options showing. Each typed letter takes two presses, one for its row and one for the letter, and many switch users tire with repeated pressing."),
            h2("1.1 Reading takes time too"),
            para("At an ordinary reading speed, four full sentences take about 12 seconds and four short labels take about 4. Conversant already offers short labels, through the setting “What a response option shows”. A switch user who reads more slowly would save more. On most turns this may save more time than any change to the scan, and it needs no new feature."),
            h2("1.2 Why a shorter silence helps the user"),
            para("Faster replies change how people judge the user. Todman and Rzepecka shortened the pauses in recorded AAC conversations to 2, 6 or 10 seconds, and 28 listeners rated the AAC user as more competent the shorter the pauses were [3]. Conversant’s holding phrases already cover the gap. With the default settings, on the first exchange of a conversation, the first one plays 2 seconds after the partner pauses and the second about 10 seconds later."),
            para("A switch user’s turn often takes 10 to 40 seconds, so the holding phrase settings are a trade-off. Setting “Wait longer each exchange” to “Never” and “Maximum per turn” to more phrases keeps the gap covered. But every phrase is spoken in the user’s own voice, and the setting that delays them exists because a phrase on every turn grew tiresome."),
            para("A phrase that has started always finishes, so the user’s chosen sentence can wait up to about 4.5 seconds behind it. A separate, longer gap between holding phrases for switch users would cover a long turn with fewer of them. It would be a new setting."),

            h1("2. The Variations"),
            table(["Method", "What the user does", "What it costs"], [
                ["Automatic scan", "The highlight moves by itself. Press to choose.", "Needs well-timed presses."],
                ["Step scan", "One switch moves the highlight. A second switch chooses.", "Many presses, so it can be tiring."],
                ["Inverse scan", "Hold to move the highlight. Release to choose.", "Needs a steady hold."],
                ["Directed scan", "A joystick or several switches move the highlight in any direction.", "Needs several reliable movements. Four could map straight to the four options."],
                ["Morse code", "Press patterns spell letters.", "Must learn a code. Helps typing only. Two-switch Morse averages about 12 words per minute [1]."],
                ["Auditory scan", "The app says each item as it’s highlighted.", "The partner hears it unless it goes to an earpiece. Grid 3 calls the earpiece version a private auditory cue [4]."],
                ["Device’s own switch control", "The iPad, Android or Chromebook scans everything on the screen [5, 6, 7].", "The device sets the order from how the page is built. Conversant can shape that, but probably can’t add a reading time or hold new options. On Windows a switch works as a key or mouse button, but Windows scans only its own on-screen keyboard [8]."],
            ], [2160, 3800, 3400]),
            gap(),
            h2("2.1 What the evidence says"),
            bullet("No single method suits everyone with CP. ", "One small 1992 study of six people suggests that people with spastic CP have the most trouble with automatic scanning and people with athetoid CP the most trouble with step scanning [9]. Conversant should let each user try automatic, step and inverse scanning."),
            bullet("Timing settings make a large difference. ", "Tuning the settings for each person raised typing speed by an average of 120% for nine users [2], and by 71% for the five users who finished a later study [10]."),
            bullet("Stored phrases support faster conversation. ", "A review of whole-utterance approaches reports faster conversation with no loss of coherence [11]. Their known costs are remembering what’s stored and finding that a stored phrase doesn’t quite fit."),
            bullet("Letting the AI expand short input can help. ", "In a study of two eye-gaze users with ALS, a system that expanded first letters raised typing speed by 29% to 60% [12]. That system was trained specially for the job."),
            h2("2.2 Switch hardware"),
            para("Most switch interfaces present themselves to a device as a keyboard or mouse. The AbleNet Blue2 FT can send Space, Enter or a number key [13], and the Origin Instruments Tapio can act as a mouse, keyboard or joystick [14]. Conversant would treat a key press and a mouse click as the same signal."),
            para("A tap anywhere on the screen could count too, which suits someone who can touch a screen but can’t aim. It would be its own setting, off unless the user needs it, because while it’s on a supporter can’t use the screen normally (section 3.7)."),

            h1("3. How Scanning Would Work"),
            para("Conversant would have its own scanner, which works the same way on every device. It would send each button a complete touch, start and end, because some buttons act at the start of a touch: the on-screen keyboard keys, the “Insert” buttons and accepting a word suggestion. The rest of the app would then behave as it does today."),
            para("While scanning is on, switch keys such as Space and Enter go only to the scanner, never to a text box or a button, or one press would do two things. Buttons keep their places, and the highlight changes only how a button looks. It has to show clearly in all seven color schemes."),
            para("What sits in a place can change. A switched-on partner, place, feeling or topic moves to the front of its band, the partner’s offered choices cover the end of the Context band, and “More” changes what a band shows. The scanner always follows what is on the screen at that moment."),
            h2("3.1 Regions"),
            para("The scan moves between four regions, in this order, and then starts again:"),
            step("regions", "The response options, with “New 4”."),
            step("regions", "The Express Panel, without “In my own words”: the Always, Context and Flex bands, in that order."),
            step("regions", "“In my own words”."),
            step("regions", "The Command Bar."),
            ...figure('sa-fig1.png', 820, 468, "Figure 1. The four regions and their order. Yellow buttons are Reframe buttons and green ones are goals. The screen is simplified and the buttons are examples."),
            para("Moving between four regions is quicker than moving between dozens of buttons, and it keeps “New 4” next to the options it replaces. A press on a region enters it, and the highlight then moves through what’s inside. In the response options it visits each option and then “New 4”."),
            para("In the Express Panel the highlight visits rows, and a press on a row moves along that row one button at a time. Blank positions are skipped. “In my own words” has nothing inside, so a press opens it."),
            para("In the Command Bar the highlight visits “Ask them to repeat”, “Listen” and “Hold on” first, then the other buttons, and skips “Settings” (section 3.7). A “Pause” stop comes last."),
            para("The highlight stays in a region after a choice, so a second button there costs less (see the table in section 1). It leaves the region on a signal the user picks in settings: a full pass with no press, a “Leave” stop at the end of the region, or a press of a second switch."),
            h2("3.2 Who each choice suits"),
            para("The scanner involves three choices: the scan method, how the stops are grouped, and how the highlight leaves a group. Each suits different users. The descriptions below are general clinical guidance from small studies, and preferences vary a lot from person to person, which is what the prototype is for (section 8)."),
            para("The scan method is how the highlight moves and how the user chooses."),
            bullet("Automatic scanning. ", "The highlight moves by itself, and one press chooses. It suits someone with one reliable movement and good timing. It takes the fewest presses, so it tires the user least. It’s hardest for someone who is slow or inconsistent at pressing at the right moment, and in Angelo’s small study people with spastic CP had the most trouble with it [9]."),
            bullet("Step scanning. ", "One switch moves the highlight and a second switch chooses, so the user sets the pace. It suits someone who can’t keep up with a moving highlight or needs time to read and decide, and it’s a common way to learn scanning. It takes many presses, which tires some users. Involuntary movements send the highlight too far, and in the same study people with athetoid CP had the most trouble with it [9]."),
            bullet("Inverse scanning. ", "The highlight moves only while the switch is held, and letting go chooses. It suits someone who can hold a switch steadily but has trouble starting a press at an exact moment, because for them letting go is the easier action."),
            para("Grouping is whether the highlight visits groups of buttons or single buttons."),
            bullet("By region. ", "The highlight picks a region first, then a button inside it. Each choice takes one more press but far fewer stops, and the saving grows as the screen fills. It suits a user who is comfortable with a two-step choice, especially with a full Express Panel."),
            bullet("One button at a time. ", "Every button is its own stop, in the same order as the regions, with one press per choice. It’s the simplest to understand but gets slow when there are many buttons. It may suit a beginner, or someone for whom choosing a group first is confusing."),
            para("Leaving a region is how the highlight gets out of a region the user has entered."),
            bullet("After a pass with no press. ", "There’s nothing extra to learn or press, but a user who entered the wrong region has to wait while the highlight goes through it. With step scanning, the highlight leaves when the user steps past the region’s last stop."),
            bullet("A “Leave” stop. ", "It’s easy to teach and always visible, but it adds a stop to every pass. It works with every scan method."),
            bullet("The second switch. ", "It’s the quickest way out, but it needs a second reliable movement. It works only with automatic and inverse scanning, because step scanning already uses the second switch to choose."),
            h2("3.3 The details"),
            bullet("Time to read. ", "When new options arrive, the highlight rests on the whole response options region for a set reading time. A press during that rest enters the region. With no press, the scan moves on to the Express Panel. With no options showing, the scan starts at the Express Panel."),
            bullet("Rest after two passes. ", "If the user presses nothing for two full passes, the highlight stops on the first region and waits for a press, so the screen doesn’t keep flashing."),
            bullet("Stray presses. ", "The user can ignore very short presses and quick repeats, and can choose whether the app acts on press or on release. Grid 3 offers similar choices [15]."),
            bullet("One press or two. ", "Every scan method can use the double press set under “One tap or two”. The first press holds the highlighted button and the second acts on it. With automatic scanning both presses use the same switch, with step scanning the second press is on the choosing switch, and with inverse scanning the second is a short press."),
            bullet("What two presses cover. ", "In the app, “One tap or two” covers everything that speaks or changes the screen, including “New 4” and the Command Bar, so each of those would take two presses too. With no second press, the scan resumes. A switch user will need more time between the two presses than the longest choice today, 1 second."),
            bullet("One suggestion per category. ", "“Suggestions per category” set to two shows eight response options, which roughly doubles the stops in the response options. A switch user would keep it at one."),
            bullet("Listening. ", "The setting “Resume listening automatically after speaking a response” would be on, so the user needs “Listen” once per session to start it. At a talk, listening doesn’t resume by itself (section 7)."),
            h2("3.4 When the options change"),
            bullet("While the AI is working. ", "The response options region is skipped, so the rest of the screen stays within reach, including “Hold on” and “Ask them to repeat”."),
            bullet("When options arrive. ", "If the highlight is between regions, it moves to the response options and rests for the reading time. If the user is inside another region, the highlight stays there, and the rest comes the next time the scan reaches the response options."),
            bullet("When a newer set arrives. ", "Inside the response options, a newer set waits until the highlight leaves them or a full pass goes by with no press (section 7). Anywhere else, it replaces the old set on screen without moving the highlight."),
            bullet("When the AI fails. ", "If no options arrive within 15 seconds, or the request fails, the response options region holds only “New 4”, so the user can ask again."),
            h2("3.5 A Switch Access tab in Settings"),
            para("The settings would sit on a new Switch Access tab. The prototype in section 8 has a working version of each one, apart from tap-anywhere."),
            bullet("Turning it on. ", "Switch access on or off, the scan method, and whether a tap anywhere on the screen counts as a press."),
            bullet("Speed. ", "The time per stop, and the reading time for new options."),
            bullet("Leaving a region. ", "After a pass with no press, a “Leave” stop, or a second switch."),
            bullet("Resting. ", "How many passes with no press before the highlight stops."),
            bullet("Stray presses and mistimed presses. ", "Ignore short presses and quick repeats, act on press or on release, and forgive a late press (section 3.6)."),
            bullet("Order inside the Express Panel. ", "Whether the Flex rows come first, and whether a “More” button is scanned first or last in its band. With a separate switch layout (section 4.3), the same settings would also move them on screen."),
            bullet("New options during a scan. ", "Hold them or show them at once (section 10)."),
            h2("3.6 When a press is mistimed"),
            para("A late press usually chooses the stop after the one the user wanted, and an early press the one before. A mistimed press on a region or row costs a full pass of it: about 5 stops in the response options and about 6 in an Express Panel row. If one press in five is mistimed, a response option or an Express Panel button costs about one stop more on average."),
            bullet("Forgiving a late press. ", "A setting would treat a press that comes just after the highlight moves, within a set fraction of a second, as a press on the stop before. Some users press a little late consistently. This hasn’t been tried with switch users, and the prototype has it as a setting."),
            bullet("Two presses for what can’t be taken back. ", "“One press or two” is the main safeguard for a user who often mistimes, at the cost of a press per choice. Under scanning, “End conversation” and “Don’t save” would ask for a second press even when “One press or two” is set to one."),
            bullet("After a wrong option is spoken. ", "Spoken words can’t be taken back. A stored phrase such as “Sorry, that’s not what I meant.” in the Always band is the quickest correction."),
            h2("3.7 Screens beyond the conversation"),
            bullet("Before Start. ", "The start screen’s buttons, and the notices that can follow it (what’s new, the listening notice, the API key notice and “Reconnect my folder”), would each be scanned as one row of their buttons."),
            bullet("Confirmation cards. ", "The red cards that ask before something is deleted would be scanned too, with “Cancel” first, as it already is the default."),
            bullet("Conversant open twice. ", "The cover shown when Conversant is already open elsewhere has no buttons, so there is nothing to scan. Closing the other copy clears it."),
            bullet("Settings. ", "Settings would be left out of the scan until scanning reaches it (section 10), so a stray press can’t open a panel the user can’t leave. A supporter opens it by touch."),
            bullet("Pausing. ", "The “Pause” stop at the end of the Command Bar stops the scan, so a tired user can rest and a supporter can use the screen normally even with tap-anywhere on. Holding the switch for 2 seconds starts the scan again. Changing the speed still needs a supporter until Settings is scanned."),
            h2("3.8 Typing needs the on-screen keyboard"),
            para("A switch user can’t use a device’s own keyboard, so “Keyboard for typing” would be set to the on-screen keyboard, and the scanner would cover it wherever there’s a text box. That includes Settings and About Me, where names, phrases and API keys are typed. Until scanning reaches those screens, a supporter does that typing (section 10)."),

            h1("4. Trimming What Gets Scanned"),
            para("Every extra stop costs time on every pass, including passes where the user wants something else. The proposal puts things in the loop according to how often they’re used."),
            table(["Where it sits", "What goes there"], [
                ["Regions 1 and 2", "Response options with “New 4”, then the Express Panel rows the user has filled"],
                ["Regions 3 and 4", "“In my own words”, then the Command Bar without “Settings”"],
                ["Not scanned at first", "The conversation pane, Settings, About Me and Conversation Review"],
                ["Skipped", "Blank positions, and anything switched off"],
            ], [3000, 6360]),
            gap(),
            para("The Command Bar has nine buttons, and most are rare in a conversation. “Ask them to repeat” isn’t one of the rare ones. One of the four response options is often a request to repeat or clarify, but choosing it counts as an ordinary reply."),
            para("The button does more: it keeps what the partner said as their own turn and treats what they say next as the repeat. There’s also no repair option when the partner offers choices, among openers, wrap-ups and goodbyes, or at a talk. When speech recognition garbled the partner’s words, the AI’s clarifying question is built on the garbled words. That’s why “Ask them to repeat” comes first in the Command Bar."),
            para("The Express Panel’s bands run Always, Context, Flex. Partner, place, feeling and topic sit in the Context band, in the middle of region 2. A place usually stays set from one conversation to the next, so it can be chosen before the conversation starts. A partner is cleared at the end of each conversation (section 7)."),
            h2("4.1 “In my own words”"),
            para("“In my own words” is region 3, straight after the Express Panel. It takes 2 stops and one press to open, whether or not options are showing. Inside, the user types a few words and uses “Reframe”, and “Speak” remains for whole sentences."),
            para("Two other placements were set aside. Offering it only between conversations would break the project’s rule that free composition is always available. Leaving it among the Express Panel’s buttons would make it slower to reach."),
            h2("4.2 A small panel for switch use"),
            para("The Express Panel’s layouts have 32 or more positions because they share their shape with the keyboard, and a switch user doesn’t need to fill them. The panel as shipped has 26 Always phrases, a Context row and no Flex row, which costs about 10 stops a button."),
            para("A supporter would set up the smaller panel the table in section 1 assumes. That means trimming the Always band to the user’s most used phrases, keeping about six buttons in each row, and giving the Flex band a row so goal and Reframe buttons can show. It needs no new layout. The prototype shows a small panel next to a full one."),

            h2("4.3 A separate switch layout"),
            para("This is a question to decide, not part of the design yet. The rest of this proposal keeps the screen the same as for direct selection and changes only the order of the scan, and a switch user doesn’t need that. Someone uses either switches or direct selection, not both at once, and a switch user doesn’t need a keyguard, so the switch layout could differ from the direct-select one. Section 10 asks whether it should."),
            para("The idea is to draw the screen in the order it is scanned, so the user can see where the highlight goes next instead of remembering a hidden order. Each mode would keep its own layout, so changing one wouldn’t disturb the other."),
            bullet("Where “More” sits. ", "In a band that runs over, “More” could sit in the first position and be the first stop, or stay last. Its position would be a setting."),
            bullet("No blanks. ", "Blank positions would be closed up, so nothing is drawn that the scan skips."),
            bullet("Flex rows first, if wanted. ", "The partner’s and place’s rows could sit above the Always rows."),
            bullet("The Command Bar in scan order. ", "“Ask them to repeat”, “Listen” and “Hold on” would come first, “Pause” would be shown, and “Settings” would be hidden rather than drawn and skipped."),
            bullet("“In my own words” after the Express Panel. ", "It would sit where the scan reaches it, as region 3."),
            bullet("The small panel as the layout. ", "The panel in section 4.2 would be the switch layout itself, rather than something a supporter carves out of the direct-select setup."),
            para("Some movement is acceptable without a keyguard, but it has a cost. A switch user gets faster by knowing how many stops away something is and timing the press, and if stops change order while the highlight is moving, mistimed presses go up. Changes between turns, such as a switched-on button moving to the front or a page turning, would be fine, but reordering the stops in the middle of a pass wouldn’t."),
            para("Some people use direct selection when rested and a switch when tired. Separate layouts suit them, as long as each mode keeps its own layout and switching back restores it."),

            h1("5. A More Powerful Express Panel"),
            para("Today a user who doesn’t like the response options can press “New 4” for a different set, or type a few words and press “Reframe” to tell the AI what they want. A switch user can’t afford much typing, so the panel needs to carry more of what typing does."),
            bullet("Reframe buttons. ", "A Reframe button holds a word or short phrase saved in advance, such as “Tyler”, “therapy” or “my shoulder”. Pressing it does what typing those words and pressing “Reframe” does today: the AI rewrites the four response options around them, and nothing is spoken. With nobody talking, it offers statements to open with. It lasts for the current turn only."),
            bullet("They’re a new kind of button. ", "Context band buttons say who the user is talking with, where they are and how they feel, and they stay on. A Reframe button says what the next reply should be about, once. It would live in the Flex band, with its own list for each person and place, like phrases."),
            bullet("Combining is also new. ", "Today a second Reframe replaces the first. Reframe buttons would instead add together within a turn, so “Tyler” and “fight” give options about a fight with Tyler. A pressed button stays lit, pressing it again takes it out, and the combination clears when the user speaks or the turn ends. Each press costs a few seconds and an AI request of about half a cent."),
            bullet("How to reply is a goal. ", "Words such as “Keep it short”, “Say no” or “Tell them more” say how to reply rather than what about. The app already handles these as goals. The user types them under About Me, “Goals For Any Conversation”, and they appear as goal buttons in the Flex band once it has a row (section 4.2). A goal stays on until it’s switched off, so using one for a single turn costs a second press later."),
            bullet("Write ahead. ", "Between conversations nothing is waiting on the user, so typing costs less and a supporter can help. Phrases and Reframe buttons can be written any time before they’re needed, because each person and place keeps its own list. Words about one event, such as test results, are best written the day before or the same day. The AI could also draft phrases from About Me, and the user would keep the ones that sound right."),
            bullet("Situation first. ", "The Flex band comes last in the panel, so the scan could visit its rows before the Always rows."),
            bullet("Where “More” is scanned. ", "A band’s “More” button sits in its last position, and the scan could still visit it first. Visited last, it costs nothing until the first page fails, and the first page holds the user’s most likely choices. Visited first, it adds a stop to every pass but reaches the next page sooner. Both are settings in the prototype. With a separate switch layout (section 4.3), where “More” sits on screen would be a setting too."),
            bullet("Use counts. ", "Between conversations the app could show which buttons get used and how far along the scan they sit. The user decides whether to move them, and the app never moves them on its own."),
            para("Reframe buttons aren’t folders. A folder opens another set of buttons, and a Reframe button changes the response options in their usual place, so the project’s decision against folders still stands. With the AI unavailable, Reframe and goal buttons do nothing, while stored phrases and typing keep working."),

            h1("6. Typing When It’s Needed"),
            para("Two kinds of short typing could replace whole sentences. A rough check tried both against the AI model the app uses now, with one made-up person and twelve conversation turns. It used a simple test prompt rather than the app’s full one, and the “same meaning” count is one reader’s judgment."),
            table(["What the user types", "Average characters", "Intended meaning among the four replies"], [
                ["First letter of each word", "5.6", "7 of 12, and some replies were nonsense"],
                ["A few key words", "9.9", "11 of 12"],
            ], [3360, 2000, 4000]),
            gap(),
            para("First letters gave replies such as “Whatever, any old oranges, Mom.” for “We are out of milk.” This proposal doesn’t include them for now. Key words were reliable even when short: “therapy” produced “I can’t Friday, I have therapy.” That result also supports Reframe buttons, because a Reframe button is a key word the user doesn’t have to type."),
            bullet("A keyboard arranged by letter use. ", "A letter costs 7.6 stops on the default QWERTY layout and 6.0 on the best current layout. A new layout with the most-used letters first would cost about 4.5."),
            bullet("Word suggestions. ", "The suggestion already shown in the text box becomes a stop whenever one is showing, so it needs no new button. Koester and Simpson’s users averaged 2.7 words per minute with word prediction against 1.5 without it, as reported secondhand by Nel and colleagues [2, 16]."),

            h1("7. Where This Meets Current Behavior"),
            bullet("Response options changing mid-scan. ", "The partner may keep talking while the user waits for the highlight, and a newer set of options can arrive. One tester saw 47% of sets replaced before touching anything. If the screen changed under a switch user, they could press and speak a sentence they never meant. Section 3.4 says how the newer set is held. This applies to switch users only."),
            bullet("Talks. ", "Automatic listening is off while a topic is switched on, so each question needs “Listen”. After an answer is spoken at a talk, the highlight would go straight to “Listen”, so the next question costs one press. All four options are answers, so the user asks someone to repeat or explain with “Ask them to repeat” or the clarifying buttons at the end of the Flex band."),
            bullet("Auditory scanning. ", "Spoken cues would reach the partner and the microphone unless they went to an earpiece. A page can probably send sound to a second device in Chrome or Edge on a computer [17], but not reliably on an iPad [18]. The first version would be visual only, which fits the current literate target user. Widening to less literate users depends on hearing options privately, so this limit matters for that direction."),
            bullet("The AI’s words and the user’s own. ", "A user who rarely types will speak more of the AI’s wording. AAC users have described weighing speed against control over what they say [19]. In a small study of AI suggestions for timely humor, five AAC users said they would trade control for speed when timing mattered [20]. Stored phrases are the user’s own words, and Reframe buttons keep the user deciding the content."),
            bullet("Measuring it. ", "Counting how often the user changes or rejects options would show whether relying on the AI’s wording is becoming a problem."),
            bullet("Setting the partner. ", "The partner is cleared at the end of each conversation, so a switch user scans to the partner button every time. Recognizing the partner’s voice, planned for a later phase, would remove that cost, which is a reason to build it sooner for switch users."),
            bullet("Next-word prediction. ", "The project decided against it because it saves one keystroke per word, while a letter here costs about 5 to 8 seconds. Keeping that decision or revisiting it would be a question for when typing is built."),
            bullet("The keyguard. ", "A switch user doesn’t need one. The screen layout stays the same, so a person who uses both a keyguard and a switch loses nothing."),

            h1("8. What to Check First"),
            para("The first four checks need real devices and switches. The last uses the prototype. Any of the answers could change the design."),
            num("checks", "Does a switch press reach the page? ", "Try an iPad in Safari and installed on the Home Screen, Android, and a Surface, in keyboard mode and mouse mode. No source confirmed this for the iPad. When Switch Control is on, it may take the presses before the page sees them."),
            num("checks", "How far can the device’s own switch control be shaped? ", "Try Conversant with iPad Switch Control, Android Switch Access and Chromebook Switch Access. Then check whether Conversant can make them skip blank positions and treat the four regions as groups. Conversant may already be usable this way, as it is with eye gaze, and the answer decides the first question in section 10."),
            num("checks", "Does choosing on release keep sound working? ", "Browsers let a page start sound or ask for permission only shortly after a press, and letting go may not count, especially after a long hold. Try inverse scanning and “act on release” on an iPad with Start, a spoken option and a Sound button."),
            num("checks", "Does a pointer plus a switch already work? ", "A head pointer or eye gaze moves the pointer, and a switch does the click. This is an established way to use a computer for people who can aim but can’t click or dwell reliably. It should work with Conversant today, but it hasn’t been tested."),
            num("checks", "What do people find quickest? ", "A web page prototype shows a simplified conversation screen, at volksswitch.org/index.php/conversant-switch-access-prototype and in the project’s prototypes folder as “switch-access.html”. Anywhere outside its settings panel, the left mouse button is switch 1 and the right mouse button is switch 2. It counts the stops, presses and seconds for each choice."),
            para("The prototype’s eight examples combine the choices in section 3.2. Two of them also show a full Express Panel and a partner who keeps talking while the user chooses. Its settings also cover speeds, Reframe buttons, goals, mistimed presses, pausing and new options during a scan."),

            h1("9. Build Order"),
            num("build", "Device checks and the prototype. ", "The checks in section 8."),
            num("build", "Conversation screen. ", "The regions, all three scan methods, stray and mistimed presses, the highlight, where it goes when options change, the start screens and confirmation cards, “Pause”, “In my own words” with the on-screen keyboard, and the Switch Access tab."),
            num("build", "Express Panel power. ", "Reframe buttons, including combining them."),
            num("build", "Refinements. ", "A helper for finding good timing, the keyboard arranged by letter use, a separate gap between holding phrases, and use counts."),
            num("build", "Later. ", "Auditory cues, directed scanning, scanning in Settings and About Me, and recognizing the partner’s voice."),
            para("Three ideas are left out. Morse code helps only typing and takes learning. Scan speed that adjusts itself changes behavior unasked, and a published summary of one study says about 30% of its users didn’t fit its model [21, 22]. Highlighting driven by language prediction makes the highlight jump around, and its authors couldn’t conclude it was faster [23]."),

            h1("10. Decisions Needed"),
            num("decisions", "Conversant’s scanner or the device’s. ", "Conversant could do its own scanning, the same way on every device including Windows, and the project would build and maintain it. Or the device could do it, through iPad Switch Control, Android Switch Access or Chromebook Switch Access, at no cost to the project."),
            para("The device sets the order from how the page is built, so Conversant can shape it but probably can’t add a reading time or hold new options, and Windows has nothing equivalent. Recommended: decide after the second check in section 8. Windows users need Conversant’s own scanner either way."),
            num("decisions", "New options during a scan. ", "The partner may keep talking while the user waits for the highlight to reach the sentence they want, and a newer set of options arrives. Holding the newer set keeps that sentence in place, but the reply may miss what the partner added. Showing it at once covers what the partner added, but the scan starts over each time, so with a talkative partner the user may never reach a choice. Recommended: hold it."),
            num("decisions", "Leaving a region. ", "A pass with no press needs no extra stop or switch, but the user waits out the pass. A “Leave” stop is easy to learn but adds a stop to every pass. A second switch is quickest but needs a second reliable movement, and it doesn’t work with step scanning. Recommended: decide after the therapists try the prototype, and keep all three as settings."),
            num("decisions", "Reframe buttons. ", "These add a new kind of button, a new way of combining them, and an AI request per press. Without them, a switch user who doesn’t like the options can only press “New 4” and hope, or type. Recommended: build them, and try them with direct-select users too."),
            num("decisions", "A separate switch layout. ", "Switch access could keep the direct-select layout and change only the scan order, or have a layout of its own drawn in scan order (section 4.3). A separate layout is easier to follow and needs no keyguard, but it is a second layout to build, keep up to date and set up. Recommended: decide after the therapists try the prototype."),
            num("decisions", "Settings and About Me. ", "Leaving them to a supporter at first brings the conversation screen sooner, but a switch-only user can’t change settings alone until later. Recommended: a supporter at first, with Settings left out of the scan until then."),
            num("decisions", "Timing against the beta. ", "Running the checks and trying the prototype now settles the unknowns at small cost. Building now would compete with beta work, and waiting means switch users wait longer. Recommended: checks and prototype now, and build once face-to-face conversation is reliable."),

            h1("11. Sources"),
            source("Koester, H. H. (2017, updated 2019). Evidence on computer text entry by people with disabilities. KPR blog.", "https://kpronline.com/blog/evidence-on-computer-text-entry-by-people-with-disabilities"),
            source("Koester, H. H., and Simpson, R. C. (2014). Method for enhancing text entry rate with single-switch scanning. Journal of Rehabilitation Research and Development, 51(6), 995–1012.", "https://doi.org/10.1682/JRRD.2013.09.0201"),
            source("Todman, J., and Rzepecka, H. (2003). Effect of pre-utterance pause length on perceptions of communicative competence in AAC-aided social conversations. Augmentative and Alternative Communication, 19(4).", "https://doi.org/10.1080/07434610310001605810"),
            source("Tobii Dynavox. How do I set up Grid 3 with switch scanning to provide a private auditory cue?", "https://us.tobiidynavox.com/blogs/support-articles/how-do-i-setup-grid-3-with-switch-scanning-to-provide-a-private-auditory-cue"),
            source("Level Access. Assistive technology users with mobility disabilities: iOS Switch Control.", "https://www.levelaccess.com/blog/assistive-technology-users-mobility-disabilities-ios-switch-control/"),
            source("Google. Android Accessibility Help: Switch Access.", "https://support.google.com/accessibility/android/answer/6122836?hl=en"),
            source("Google. Chromebook Help: Use Switch Access.", "https://support.google.com/chromebook/answer/10274137"),
            source("Microsoft. Use the On-Screen Keyboard to type.", "https://support.microsoft.com/en-us/help/10762/windows-use-on-screen-keyboard"),
            source("Angelo, J. (1992). Comparison of three computer scanning modes as an interface method for persons with cerebral palsy. American Journal of Occupational Therapy, 46(3), 217–222.", "https://doi.org/10.5014/ajot.46.3.217"),
            source("Koester, H. H., and Simpson, R. C. (2019). Effectiveness and usability of Scanning Wizard software: a tool for enhancing switch scanning. Disability and Rehabilitation: Assistive Technology.", "https://doi.org/10.1080/17483107.2017.1406998"),
            source("Todman, J., Alm, N., Higginbotham, D. J., and File, P. (2008). Whole utterance approaches in AAC. Augmentative and Alternative Communication, 24(3), 235–254.", "https://discovery.dundee.ac.uk/en/publications/whole-utterance-approaches-in-aac/"),
            source("Cai, S., Venugopalan, S., and others (2024). Using large language models to accelerate communication for eye gaze typing users with ALS. Nature Communications, 15, 9449.", "https://doi.org/10.1038/s41467-024-53873-3"),
            source("AbleNet. Blue2 FT switch.", "https://www.inclusive.com/uk/blue2-ft.html"),
            source("Origin Instruments. Tapio specifications.", "https://cdn.shopify.com/s/files/1/0753/1197/2628/files/Tapio-Specifications.pdf"),
            source("Smartbox. Using switch scanning with Grid 3.", "https://hub.thinksmartbox.com/knowledgebase/using-switch-scanning-with-grid-3/"),
            source("Nel, E.-M., Kristensson, P. O., and MacKay, D. J. C. (2017). Modelling noise-resilient single-switch scanning systems. arXiv:1712.10073.", "https://arxiv.org/abs/1712.10073"),
            source("Can I use: HTMLMediaElement.setSinkId (sending audio to a chosen output device).", "https://caniuse.com/mdn-api_htmlmediaelement_setsinkid"),
            source("WebKit Bugzilla. Bug 320087, audio output routing on iPad and iPhone.", "https://bugs.webkit.org/show_bug.cgi?id=320087"),
            source("Valencia, S., Cave, R., Kallarackal, K., Seaver, K., Terry, M., and Kane, S. K. (2023). “The less I type, the better”: How AI language models can enhance or impede communication for AAC users. CHI ’23.", "https://doi.org/10.1145/3544548.3581560"),
            source("Weinberg, T., Kadoma, K., Gonzalez Penuela, R. E., Valencia, S., and Roumen, T. (2025). Why so serious? Exploring timely humorous comments in AAC through AI-powered interfaces. CHI ’25.", "https://doi.org/10.1145/3706598.3714102"),
            source("Ghedira, S., Pino, P., and Bourhis, G. (2009). Conception and experimentation of a communication device with adaptive scanning. ACM Transactions on Accessible Computing, 1(3).", "https://doi.org/10.1145/1497302.1497304"),
            source("A11y Paradise. Review of Ghedira and colleagues (2009).", "https://a11y-paradise.onrender.com/reviews/69ce6148c233c928e86aa6f7"),
            source("Roark, B., Fried-Oken, M., and Gibbons, C. (2015). Huffman and linear scanning methods with statistical language models. Augmentative and Alternative Communication, 31(1), 37–50.", "https://doi.org/10.3109/07434618.2014.997890"),

            h1("12. Review Findings"),
            para("On November 9, 2026, a separate review looked only for holes in this proposal, checking it against the app’s code and the prototype. Its sixteen findings are below, most serious first, each with what changed in response. The claims about the app were spot-checked against the code and held up. The claims about published sources couldn’t be checked, because the journal pages were closed or wouldn’t load."),
            num("review", "The scan reached screens it couldn’t handle (serious). ", "One press could open Settings, the screens before Start weren’t covered, and a tired user couldn’t stop the scan."),
            fixp("Section 3.7 covers the start screens and confirmation cards, leaves Settings out of the scan, and adds “Pause”. Tap-anywhere is now its own setting, off unless needed (section 2.2)."),
            num("review", "New options and AI waits could pull the user away (serious). ", "The highlight was moved back to the options when new ones arrived and stopped on an empty region while the AI worked."),
            fixp("Section 3.4 says where the highlight goes in each case and never pulls the user out of a region they’ve entered."),
            num("review", "Nothing covered a mistimed press (serious). ", "A wrong option is spoken and can’t be taken back, and no timing counted the cost of a miss."),
            fixp("Section 3.6 gives the cost of a miss, a setting to forgive a late press, two presses for “End conversation” and “Don’t save”, and a stored correction phrase."),
            num("review", "The Express Panel wasn’t laid out as the proposal said (moderate). ", "The bands run Always, Context, Flex, and the timings assumed a panel unlike the one shipped."),
            fixp("Sections 3.1, 4 and 4.2 give the real order and the setup a switch user needs, and the table in section 1 adds the panel as shipped."),
            num("review", "Holding phrases set to keep playing have costs (moderate). ", "They speak in the user’s own voice, and a phrase that has started can delay the user’s reply."),
            fixp("Section 1.2 now presents the settings as a trade-off and suggests a separate, longer gap between phrases for switch users."),
            num("review", "“Ask them to repeat” isn’t the same as the repair option (moderate). ", "The button keeps the partner’s earlier words and treats what they say next as the repeat, and some turns have no repair option."),
            fixp("Section 4 explains the difference, and the button now comes first in the Command Bar."),
            num("review", "The scanner couldn’t simply press buttons like a finger (moderate). ", "Some buttons act at the start of a touch, and switch keys could also reach a text box."),
            fixp("Section 3 says the scanner sends a complete touch and keeps switch keys away from text boxes and buttons."),
            num("review", "Choosing on release might block sound on an iPad (moderate). ", "Browsers allow sound only shortly after a press."),
            fixp("It is now the third check in section 8."),
            num("review", "The case against the device’s own switch control was overstated (moderate). ", "Conversant can shape how the device scans the page."),
            fixp("Sections 2 and 10 are softened, and the second check in section 8 now tests how far the device’s switch control can be shaped."),
            num("review", "Combining Reframe buttons was presented as existing (moderate). ", "Today a second Reframe replaces the first."),
            fixp("Section 5 marks combining as new and says how a combination is cleared. The prototype now combines them."),
            num("review", "Some choices didn’t fit together (moderate). ", "The second switch can’t leave a region under step scanning, and the prototype’s one-button-at-a-time example still used groups."),
            fixp("Section 3.2 says which ways of leaving work with which method, and the prototype now matches it."),
            num("review", "Talks broke the listening assumption (moderate). ", "Automatic listening is off at a talk, and there is no repair option there."),
            fixp("Section 7 covers talks, with the highlight going straight to “Listen” after an answer."),
            num("review", "The headline times left out the biggest costs (moderate). ", "They left out reading, and the typing row assumed a keyboard that isn’t built."),
            fixp("The opening now includes reading time, and the table shows typing on today’s best layout as well as the unbuilt one."),
            num("review", "Smaller arithmetic slips (minor). ", "“In my own words” took 2 stops either way, the first draft’s count was low, and the sentence rows used different lengths."),
            fixp("Sections 1 and 4.1 use one counting rule and one 27-character sentence."),
            num("review", "Two settings weren’t covered (minor). ", "Eight response options double the stops, and two presses cover more than the response options."),
            fixp("Section 3.3 covers both."),
            num("review", "Some sources were weaker than the text suggested (minor). ", "Several claims rest on small studies, secondhand reports or a review site."),
            fixp("Sections 2.1, 6, 7 and 9 now say so, and the humor study is described as what it is."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Switch Access Proposal.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
