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
// A finding in section 12: the numbered problem, then what would fix it, indented
// under it so it reads as part of the same item.
const fixp = (text) => new Paragraph({
    spacing: { before: 0, after: 120 }, indent: { left: 720 },
    children: [new TextRun({ text: "What would fix it: ", italics: true }), new TextRun(text)],
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
            para("Scanning has a reputation for being slow, and for typing that reputation is earned. Choosing from what’s already on the screen is a different matter. A response option takes about 3 seconds to reach at one second per stop, and a typed five-word sentence takes 2 to 3 minutes."),
            para("The proposal follows from that gap. The user reaches response options and a small, well-chosen Express Panel on nearly every turn, and typing moves out of the way. Express Panel buttons holding words saved in advance do much of the work typing does today, by telling the AI what the user wants to get across."),
            para("None of this has been tried with a real switch or a real switch user. The times below are arithmetic, and the evidence on scanning comes mostly from small studies. A web page prototype lets the therapists and the project try the ideas before anything is built (section 8). Numbers in square brackets, such as [3], refer to the numbered sources in section 11."),

            h1("1. Where the Time Goes"),
            para("This table shows what each action costs a one-switch user with automatic scanning. It uses the regions described in section 3 and assumes no missed presses. A stop is one move of the highlight. The table shows two speeds, 1 second and 0.6 seconds per stop, as examples, because the right speed varies widely from person to person [2]."),
            table(["Action", "Stops", "Presses", "At 1 second", "At 0.6 seconds"], [
                ["A response option", "2.5", "2", "3 seconds", "2 seconds"],
                ["An Express Panel button", "6", "3", "6 seconds", "4 seconds"],
                ["A second Express Panel button straight after the first", "5", "2", "5 seconds", "3 seconds"],
                ["A Reframe button, then a response option", "8.5", "5", "12 seconds", "8 seconds"],
                ["A few typed words, “Reframe”, then a response option", "51", "25", "55 seconds", "35 seconds"],
                ["Five-word sentence, keyboard arranged by letter use", "123", "54", "2 minutes", "75 seconds"],
                ["Five-word sentence, default QWERTY keyboard", "200", "54", "3 minutes 20 seconds", "2 minutes"],
            ], [3760, 1000, 1100, 1700, 1800]),
            gap(),
            para("The response option row starts counting when the reading time ends, because the press that enters the response options can come during it. The rows with an AI step include about 3 seconds for the AI to reply. The typing rows leave out word suggestions, which would lower them, and corrections, which would raise them."),
            para("The two sentence rows count the keyboard only, and they fit published results. Scanning on an on-screen keyboard averages about 1.7 words per minute [1]. The nine users in one study typed between about 1 and 6.5 words per minute once their settings were tuned [2]."),
            para("Presses matter as well as seconds. Regions add a press, because the user first chooses the region and then the button inside it. Visiting every button one at a time, as the first draft of this proposal did, saves that press but costs more stops: an Express Panel button took 9 stops with options showing. Each typed letter takes two presses, one for its row and one for the letter, and many switch users tire with repeated pressing."),
            h2("1.1 Reading takes time too"),
            para("The table leaves out reading. At an ordinary reading speed, four full sentences take about 12 seconds and four short labels take about 4. Conversant already offers short labels, through the setting “What a response option shows”. A switch user who reads more slowly would save more. On most turns this may save more time than any change to the scan, and it needs no new feature."),
            h2("1.2 Why a shorter silence helps the user"),
            para("Faster replies change how people judge the user. Todman and Rzepecka shortened the pauses in recorded AAC conversations to 2, 6 or 10 seconds, and 28 listeners rated the AAC user as more competent the shorter the pauses were [3]. Conversant’s holding phrases already cover the gap. With the default settings the first one plays 2 seconds after the partner pauses and the second about 10 seconds later."),
            para("Two settings suit a switch user. “Wait longer each exchange” delays the first phrase further as the conversation goes on, and a switch user may want it set to 0. “Maximum per turn” set to “No limit” keeps holding phrases playing for as long as a choice takes, which does the job of “Hold on” without a press."),

            h1("2. The Variations"),
            table(["Method", "What the user does", "What it costs"], [
                ["Automatic scan", "The highlight moves by itself. Press to choose.", "Needs well-timed presses."],
                ["Step scan", "One switch moves the highlight. A second switch chooses.", "Many presses, so it can be tiring."],
                ["Inverse scan", "Hold to move the highlight. Release to choose.", "Needs a steady hold."],
                ["Directed scan", "A joystick or several switches move the highlight in any direction.", "Needs several reliable movements. Four could map straight to the four options."],
                ["Morse code", "Press patterns spell letters.", "Must learn a code. Helps typing only. Two-switch Morse averages about 12 words per minute [1]."],
                ["Auditory scan", "The app says each item as it’s highlighted.", "The partner hears it unless it goes to an earpiece. Grid 3 calls the earpiece version a private auditory cue [4]."],
                ["Device’s own switch control", "The iPad, Android or Chromebook scans everything on the screen [5, 6, 7].", "The device decides the order, so it can’t rest on new options or skip blank positions. On Windows a switch works as a key or a mouse button, but Windows scans only its own on-screen keyboard [8]."],
            ], [2160, 3800, 3400]),
            gap(),
            h2("2.1 What the evidence says"),
            bullet("No single method suits everyone with CP. ", "In Angelo’s 1992 study of six people, those with spastic CP had the most trouble with automatic scanning and those with athetoid CP had the most trouble with step scanning [9]. Conversant should offer automatic, step and inverse scanning together."),
            bullet("Timing settings make a large difference. ", "Tuning the settings for each person raised typing speed by an average of 120% for nine users [2], and by 71% for the five users who finished a later study [10]."),
            bullet("Stored phrases support faster conversation. ", "A review of whole-utterance approaches reports faster conversation with no loss of coherence [11]. Their known costs are remembering what’s stored and finding that a stored phrase doesn’t quite fit."),
            bullet("Letting the AI expand short input can help. ", "In a study of two eye-gaze users with ALS, a system that expanded first letters raised typing speed by 29% to 60% [12]. That system was trained specially for the job."),
            h2("2.2 Switch hardware"),
            para("Most switch interfaces present themselves to a device as a keyboard or mouse. The AbleNet Blue2 FT can send Space, Enter or a number key [13], and the Origin Instruments Tapio can act as a mouse, keyboard or joystick [14]. Conversant would treat a key press, a mouse click and a tap anywhere on the screen as the same signal. Tap-anywhere needs no special hardware and suits someone who can touch a screen but can’t aim."),

            h1("3. How Scanning Would Work"),
            para("Conversant would have its own scanner, which works the same way on every device. It presses the same buttons a finger would, so the rest of the app behaves as it does today. Nothing on the screen moves, and the highlight changes only how a button looks. It has to show clearly in all seven color schemes."),
            h2("3.1 Regions"),
            para("The scan moves between four regions, in this order, and then starts again:"),
            step("regions", "The response options, with “New 4”."),
            step("regions", "The Express Panel, without “In my own words”."),
            step("regions", "“In my own words”."),
            step("regions", "The Command Bar."),
            ...figure('sa-fig1.png', 820, 468, "Figure 1. The four regions and their order. Yellow buttons are Reframe buttons and green ones are goals. The screen is simplified and the buttons are examples."),
            para("Moving between four regions is quicker than moving between dozens of buttons, and it keeps “New 4” next to the options it replaces. A press on a region enters it, and the highlight then moves through what’s inside. In the response options it visits each option and then “New 4”."),
            para("In the Express Panel the highlight visits rows, and a press on a row moves along that row one button at a time. Blank positions are skipped. “In my own words” has nothing inside, so a press opens it."),
            para("The highlight stays in a region after a choice, so a second button there costs less (see the table in section 1). It leaves the region on a signal the user picks in settings: a full pass with no press, a “Leave” stop at the end of the region, or a press of a second switch."),
            h2("3.2 Who each choice suits"),
            para("The scanner involves three choices: the scan method, how the stops are grouped, and how the highlight leaves a group. Each suits different users. The descriptions below are general clinical guidance from small studies, and preferences vary a lot from person to person, which is what the prototype is for (section 8)."),
            para("The scan method is how the highlight moves and how the user chooses."),
            bullet("Automatic scanning. ", "The highlight moves by itself, and one press chooses. It suits someone with one reliable movement and good timing. It takes the fewest presses, so it tires the user least. It’s hardest for someone who is slow or inconsistent at pressing at the right moment, and in Angelo’s study people with spastic CP had the most trouble with it [9]."),
            bullet("Step scanning. ", "One switch moves the highlight and a second switch chooses, so the user sets the pace. It suits someone who can’t keep up with a moving highlight or needs time to read and decide, and it’s a common way to learn scanning. It takes many presses, which tires some users. Involuntary movements send the highlight too far, and in the same study people with athetoid CP had the most trouble with it [9]."),
            bullet("Inverse scanning. ", "The highlight moves only while the switch is held, and letting go chooses. It suits someone who can hold a switch steadily but has trouble starting a press at an exact moment, because for them letting go is the easier action."),
            para("Grouping is whether the highlight visits groups of buttons or single buttons."),
            bullet("By region. ", "The highlight picks a region first, then a button inside it. Each choice takes one more press but far fewer stops, and the saving grows as the screen fills. It suits a user who is comfortable with a two-step choice, especially with a full Express Panel."),
            bullet("One button at a time. ", "Every button is its own stop, with one press per choice. It’s the simplest to understand but gets slow when there are many buttons. It may suit a beginner, or someone for whom choosing a group first is confusing."),
            para("Leaving a region is how the highlight gets out of a region the user has entered."),
            bullet("After a pass with no press. ", "There’s nothing extra to learn or press, but a user who entered the wrong region has to wait while the highlight goes through it."),
            bullet("A “Leave” stop. ", "It’s easy to teach and always visible, but it adds a stop to every pass."),
            bullet("The second switch. ", "It’s the quickest way out, but it needs a second reliable movement. It suits someone who uses two switches and wants speed."),
            h2("3.3 The details"),
            bullet("Time to read. ", "When new options arrive, the highlight rests on the whole response options region for a set reading time. A press during that rest enters the region. With no press, the scan moves on to the Express Panel. With no options showing, the scan starts at the Express Panel."),
            bullet("Rest after two passes. ", "If the user presses nothing for two full passes, the highlight stops on the first region and waits for a press, so the screen doesn’t keep flashing."),
            bullet("Stray presses. ", "The user can ignore very short presses and quick repeats, and can choose whether the app acts on press or on release. Grid 3 offers similar choices [15]."),
            bullet("One press or two. ", "Every scan method can use the double press set under “One tap or two”. The first press holds the highlighted option and the second speaks it. With automatic scanning both presses use the same switch, with step scanning the second press is on the choosing switch, and with inverse scanning the second is a short press. With no second press, the scan resumes. A switch user will need more time between the two presses than the longest choice today, 1 second."),
            bullet("Listening. ", "The setting “Resume listening automatically after speaking a response” would be on, so the user rarely needs “Listen”."),
            h2("3.4 A Switch Access tab in Settings"),
            para("The settings would sit on a new Switch Access tab. The prototype in section 8 has a working version of each one."),
            bullet("Turning it on. ", "Switch access on or off, and the scan method."),
            bullet("Speed. ", "The time per stop, and the reading time for new options."),
            bullet("Leaving a region. ", "After a pass with no press, a “Leave” stop, or a second switch."),
            bullet("Resting. ", "How many passes with no press before the highlight stops."),
            bullet("Stray presses. ", "Ignore short presses and quick repeats, and act on press or on release."),
            bullet("Order inside the Express Panel. ", "Whether the partner’s or place’s own rows come first, and whether a “More” button is scanned first or last in its band."),
            bullet("New options during a scan. ", "Hold them or show them at once (section 10)."),
            h2("3.5 Typing needs the on-screen keyboard"),
            para("A switch user can’t use a device’s own keyboard, so “Keyboard for typing” would be set to the on-screen keyboard, and the scanner would cover it wherever there’s a text box. That includes Settings and About Me, where names, phrases and API keys are typed. Until scanning reaches those screens, a supporter does that typing (section 10)."),

            h1("4. Trimming What Gets Scanned"),
            para("Every extra stop costs time on every pass, including passes where the user wants something else. The proposal puts things in the loop according to how often they’re used."),
            table(["Where it sits", "What goes there"], [
                ["Regions 1 and 2", "Response options with “New 4”, then the Express Panel rows the user has filled"],
                ["Regions 3 and 4", "“In my own words”, then the Command Bar"],
                ["Not scanned at first", "The conversation pane, Settings, About Me and Conversation Review"],
                ["Skipped", "Blank positions, and anything switched off"],
            ], [3000, 6360]),
            gap(),
            para("The Command Bar has nine buttons, and most are rare in a conversation. “Ask them to repeat” is seldom needed there, because one of the four response options is nearly always a request to repeat or clarify, written for what the partner just said. The button stays as the way to ask when no options are showing. “Hold on” is seldom needed when holding phrases are set to “No limit” (section 1.2)."),
            para("Partner, place and feeling sit in the Express Panel’s Context band, at the end of region 2. A place usually stays set from one conversation to the next, so it can be chosen before the conversation starts. A partner is cleared at the end of each conversation (section 7)."),
            h2("4.1 “In my own words”"),
            para("“In my own words” is region 3, straight after the Express Panel. With options showing it takes 2 stops and one press to open, or 1 stop with none showing. Inside, the user types a few words and uses “Reframe”, and “Speak” remains for whole sentences."),
            para("Two other placements were set aside. Offering it only between conversations would break the project’s rule that free composition is always available. Leaving it among the Express Panel’s buttons would make it slower to reach."),
            para("A further trim is available. The Express Panel’s layouts have 32 or more positions because they share their shape with the keyboard, and a switch user doesn’t need to fill them. A panel with about 6 buttons in each row needs no new layout and keeps every row short. The prototype shows a small panel next to a full one."),

            h1("5. A More Powerful Express Panel"),
            para("Today a user who doesn’t like the response options can press “New 4” for a different set, or type a few words and press “Reframe” to tell the AI what they want. A switch user can’t afford much typing, so the panel needs to carry more of what typing does."),
            bullet("Reframe buttons. ", "A Reframe button holds a word or short phrase saved in advance, such as “Tyler”, “therapy” or “my shoulder”. Pressing it does what typing those words and pressing “Reframe” does today: the AI rewrites the four response options around them, and nothing is spoken. With nobody talking, it offers statements to open with. It lasts for the current turn only."),
            bullet("They’re a new kind of button. ", "Context band buttons say who the user is talking with, where they are and how they feel, and they stay on. A Reframe button says what the next reply should be about, once. It would live in the Flex band, with its own list for each person and place, like phrases."),
            bullet("Combining. ", "Two Reframe buttons pressed in one turn add together, so “Tyler” and “fight” give options about a fight with Tyler. Each press costs a few seconds and an AI request of about half a cent."),
            bullet("How to reply is a goal. ", "Words such as “Keep it short”, “Say no” or “Tell them more” say how to reply rather than what about. The app already handles these as goals. The user types them under About Me, “Goals For Any Conversation”, and they appear as goal buttons in the Flex band. A goal stays on until it’s switched off, so using one for a single turn costs a second press later."),
            bullet("Write ahead. ", "Between conversations nothing is waiting on the user, so typing costs less and a supporter can help. Phrases and Reframe buttons can be written any time before they’re needed, because each person and place keeps its own list. Words about one event, such as test results, are best written the day before or the same day. The AI could also draft phrases from About Me, and the user would keep the ones that sound right."),
            bullet("Situation first. ", "When the partner or place has its own Flex list, the scan could visit those rows before the Always rows."),
            bullet("Where “More” is scanned. ", "A band’s “More” button sits in its last position, and the scan could still visit it first. Visited last, it costs nothing until the first page fails, and the first page holds the user’s most likely choices. Visited first, it adds a stop to every pass but reaches the next page sooner. Both are settings in the prototype."),
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
            bullet("Word suggestions. ", "The suggestion already shown in the text box becomes a stop whenever one is showing, so it needs no new button. Koester and Simpson’s users averaged 2.7 words per minute with word prediction against 1.5 without it, as reported by Nel and colleagues [2, 16]."),

            h1("7. Where This Meets Current Behavior"),
            bullet("Response options changing mid-scan. ", "The partner may keep talking while the user waits for the highlight, and a newer set of options can arrive. One tester saw 47% of sets replaced before touching anything. If the screen changed under a switch user, they could press and speak a sentence they never meant. This proposal keeps the set on screen while the highlight is in the response options. It shows the newer set once the highlight leaves them or a full pass goes by with no press. This applies to switch users only."),
            bullet("Auditory scanning. ", "Spoken cues would reach the partner and the microphone unless they went to an earpiece. A page can probably send sound to a second device in Chrome or Edge on a computer [17], but not reliably on an iPad [18]. The first version would be visual only, which fits the current literate target user. Widening to less literate users depends on hearing options privately, so this limit matters for that direction."),
            bullet("The AI’s words and the user’s own. ", "A user who rarely types will speak more of the AI’s wording. AAC users have described weighing speed against control over what they say [19], and in a small study they would trade control for speed when timing was critical [20]. Stored phrases are the user’s own words, and Reframe buttons keep the user deciding the content. Measuring how often the user changes or rejects options would show whether this is becoming a problem."),
            bullet("Setting the partner. ", "The partner is cleared at the end of each conversation, so a switch user scans to the partner button every time. Recognizing the partner’s voice, planned for a later phase, would remove that cost, which is a reason to build it sooner for switch users."),
            bullet("Next-word prediction. ", "The project decided against it because it saves one keystroke per word, while a letter here costs about 5 to 8 seconds. Keeping that decision or revisiting it would be a question for when typing is built."),
            bullet("The keyguard. ", "A switch user doesn’t need one. The screen layout stays the same, so a person who uses both a keyguard and a switch loses nothing."),

            h1("8. What to Check First"),
            para("The first three checks need real devices and switches. The fourth uses the prototype. Any of the answers could change the design."),
            num("checks", "Does a switch press reach the page? ", "Try an iPad in Safari and installed on the Home Screen, Android, and a Surface, in keyboard mode and mouse mode. No source confirmed this for the iPad. When Switch Control is on, it may take the presses before the page sees them."),
            num("checks", "Does the device’s own switch control already work? ", "Try Conversant with iPad Switch Control, Android Switch Access and Chromebook Switch Access. Conversant may already be usable this way, as it is with eye gaze."),
            num("checks", "Does a pointer plus a switch already work? ", "A head pointer or eye gaze moves the pointer, and a switch does the click. This is an established way to use a computer for people who can aim but can’t click or dwell reliably. It should work with Conversant today, but it hasn’t been tested."),
            num("checks", "What do people find quickest? ", "A web page prototype shows a simplified conversation screen, at volksswitch.org/index.php/conversant-switch-access-prototype and in the project’s prototypes folder as “switch-access.html”. Anywhere outside its settings panel, the left mouse button is switch 1 and the right mouse button is switch 2. Its eight examples combine the choices in section 3.2, and two of them also show a full Express Panel and a partner who keeps talking while the user chooses. Its settings also cover speeds, Reframe buttons, goals and new options during a scan. It counts the stops, presses and seconds for each choice."),

            h1("9. Build Order"),
            num("build", "Device checks and the prototype. ", "The checks in section 8."),
            num("build", "Conversation screen. ", "The regions, all three scan methods, stray-press filtering, the highlight, holding new options during a scan, “In my own words” with the on-screen keyboard, and the Switch Access tab."),
            num("build", "Express Panel power. ", "Reframe buttons."),
            num("build", "Refinements. ", "A helper for finding good timing, the keyboard arranged by letter use, and use counts."),
            num("build", "Later. ", "Auditory cues, directed scanning, scanning in Settings and About Me, and recognizing the partner’s voice."),
            para("Three ideas are left out. Morse code helps only typing and takes learning. Scan speed that adjusts itself changes behavior unasked, and a published summary of Ghedira and colleagues’ study says about 30% of their users didn’t fit its model [21, 22]. Highlighting driven by language prediction makes the highlight jump around, and its authors couldn’t conclude it was faster [23]."),

            h1("10. Decisions Needed"),
            num("decisions", "Conversant’s scanner or the device’s. ", "Conversant could do its own scanning. It would highlight its own buttons in the order this proposal describes, the same way on every device including Windows, and the project would build and maintain it. Or the device could do it, through iPad Switch Control, Android Switch Access or Chromebook Switch Access, at no cost to the project. Then the device decides the order, so it can’t keep new response options first or skip blank positions, and Windows has nothing equivalent. Recommended: Conversant does its own scanning, after the checks in section 8."),
            num("decisions", "New options during a scan. ", "The partner may keep talking while the user waits for the highlight to reach the sentence they want, and a newer set of options arrives. Holding the newer set keeps that sentence in place, but the reply may miss what the partner added. Showing it at once covers what the partner added, but the scan starts over each time, so with a talkative partner the user may never reach a choice. Recommended: hold it."),
            num("decisions", "Leaving a region. ", "A pass with no press needs no extra stop or switch, but the user waits out the pass. A “Leave” stop is easy to learn but adds a stop to every pass. A second switch is quickest but needs a second reliable movement. Recommended: decide after the therapists try the prototype, and keep all three as settings."),
            num("decisions", "Reframe buttons. ", "These add a new kind of button and an AI request per press. Without them, a switch user who doesn’t like the options can only press “New 4” and hope, or type. Recommended: build them, and try them with direct-select users too."),
            num("decisions", "Settings and About Me. ", "Leaving them to a supporter at first brings the conversation screen sooner, but a switch-only user can’t change settings alone until later. Recommended: a supporter at first."),
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

            h1("12. Problems Found in Review"),
            para("On November 9, 2026, a separate review looked only for holes in this proposal, checking it against the app’s code and the prototype. Its findings are listed here, most serious first, and haven’t been acted on yet. The claims about the app were spot-checked against the code and hold up. The claims about published sources couldn’t be checked, because the journal pages were closed or wouldn’t load."),
            num("review", "The scan reaches more than the conversation screen (serious). ", "The Settings button is in the Command Bar, which is region 4, so one press can open Settings, which isn’t scanned and has no scanned way out. The screens before Start, the red confirmation cards and the cover shown when Conversant is open twice aren’t covered either, so a switch-only user can’t get past Start. Speed and the on/off switch are in Settings, so a tired user can’t slow the scan or stop it. Treating a tap anywhere as a switch press also stops a supporter from using the screen normally."),
            fixp("List every screen and box a switch user can reach and give each a scanned way in and out. Until Settings is scanned, keep it out of the scan, and give a supporter a way to touch the screen normally."),
            num("review", "New options and AI waits can pull the user away (serious). ", "Section 7 holds a newer set only while the highlight is in the response options. In the prototype, options arriving while the user is in the Express Panel pull the highlight back to the options, and during each AI wait the highlight stops on the empty options region. With a talkative partner the user could keep losing their place, and couldn’t reach “Hold on” or “Ask them to repeat” while waiting. Nothing says what happens when the AI never answers."),
            fixp("Say where the highlight goes when options arrive, are held or fail, wherever it is. Never pull it out of a region the user has entered, and never park it on an empty region."),
            num("review", "Nothing covers a mis-press (serious). ", "The table assumes no missed presses, and the only safeguard is “One press or two”. A badly timed press is the usual failure of automatic scanning, and a wrong option is spoken and can’t be taken back. In the Command Bar, one late press can end the conversation or open Settings. A miss also costs a full extra pass, which no timing includes."),
            fixp("Add a section on mistakes, with the cost of a miss in each region, which buttons need confirming under scanning, and times with a realistic miss rate."),
            num("review", "The Express Panel isn’t laid out as the proposal says (moderate). ", "The bands run Always, Context, Flex, so the Flex band, where goals and Reframe buttons live, comes last and costs the most stops; section 4 puts the Context band last. The timings assume two rows of about six buttons, but every layout has at least 32 positions and the therapists’ set fills 26 Always positions. The Flex band ships with no rows, so goal buttons don’t show until the bands are resized. Switched-on buttons move to the front of their band, the partner’s choices cover the end of the Context band, and “More” changes what a band shows, so what sits in a position can change even though the positions don’t."),
            fixp("Correct the band order, say which layout and band sizes the timings assume, add figures for the panel as shipped, and cover topics, the newest kind of Context button."),
            num("review", "“No limit” holding phrases have costs (moderate). ", "“Wait longer each exchange” exists because a phrase on every turn sounded overbearing, and at a 10-second interval a 30-to-40-second switch turn plays three or four phrases in the user’s own voice. A phrase already playing always finishes, so the user’s chosen sentence can wait up to about 4.5 seconds. “The first one plays 2 seconds after the partner pauses” is true only on the first exchange with default settings."),
            fixp("Present these settings as a trade-off, and consider a separate holding-phrase interval for switch users."),
            num("review", "“Ask them to repeat” isn’t the same as the repair option (moderate). ", "The button keeps the partner’s earlier words as their own turn and treats what they say next as the repeat, while choosing a repair option counts as an ordinary reply. There’s no repair option when the partner offers choices, among openers, wrap-ups or goodbyes, or at a talk. When speech recognition garbled the partner’s words, the AI’s clarifying question is built on the garbled words."),
            fixp("Drop “seldom needed”, or say what is lost, and keep the button easy to reach."),
            num("review", "The scanner can’t simply press buttons like a finger (moderate). ", "The on-screen keyboard keys, the “Insert” buttons and accepting a word suggestion react to the start of a touch, not to a completed tap, and section 3.5 depends on the keyboard. A switch that sends Space or Enter would also type a space or press whatever button has the keyboard focus, so one press would do two things."),
            fixp("Say that the scanner must act like a full touch and must keep switch keys away from text boxes and buttons, and test the composer early."),
            num("review", "Choosing on release may block sound on an iPad (moderate). ", "Browsers let a page start sound or ask for permission only shortly after a press, and letting go may not count, especially after a long hold. Inverse scanning and “act on release” choose on letting go, and Start and the Sound buttons depend on that window. This hasn’t been checked on a device."),
            fixp("Add it to the checks in section 8."),
            num("review", "The case against the device’s own switch control is overstated (moderate). ", "iPad Switch Control and Android Switch Access follow the page’s structure and skip anything the page marks hidden, which Conversant controls. So they may be able to skip blanks and treat the regions as groups. This hasn’t been checked on a device, and it is the main argument in the first decision of section 10."),
            fixp("Test what the device’s own switch control can be made to do before deciding."),
            num("review", "Combining Reframe buttons is new (moderate). ", "Today a second Reframe replaces the first rather than adding to it. The prototype also uses only the last one, though its message line shows both."),
            fixp("Mark combining as new, say how a combination is cleared, and make the prototype combine."),
            num("review", "Some choices don’t fit together, and the prototype differs from section 3.2 (moderate). ", "Leaving a region with the second switch can’t work with step scanning, which already uses both switches. Under step scanning, “a full pass with no press” also means something different, because the highlight doesn’t move by itself. The prototype’s one-button-at-a-time example still treats each Express Panel row and the Command Bar as groups needing an extra press, though section 3.2 says one press per choice."),
            fixp("List which ways of leaving work with which method, and make the prototype match section 3.2."),
            num("review", "Talks break the listening assumption (moderate). ", "Automatic listening is off whenever a topic is switched on, so at a talk the user needs “Listen” for every question, and “Listen” is in the last region. At a talk all four options are answers, so there is no repair option. Automatic listening also needs one press of “Listen” each session."),
            fixp("Cover question sessions explicitly, for example with a quicker way to the next question."),
            num("review", "The headline times leave out the biggest costs (moderate). ", "The “about 3 seconds” for a response option leaves out reading, about 12 seconds for four full sentences (section 1.1), and missed presses. The “few typed words” row assumes the keyboard arranged by letter use, which isn’t built. With today’s best layout that row is about 66 stops, or 69 seconds at one second per stop, and with QWERTY about 82 stops, or 85 seconds."),
            fixp("Include reading time in the comparison, and say which keyboard each typing row assumes."),
            num("review", "Smaller arithmetic slips (minor). ", "By the table’s own counting, “In my own words” takes 2 stops whether or not options are showing. The first draft’s “9 stops” doesn’t follow from the stated layout, which gives about 11.5. The two sentence rows assume slightly different sentence lengths. The keyboard figures, 7.6 and 6.0 stops per letter, check out."),
            fixp("Use one counting rule and one sentence length throughout."),
            num("review", "Two settings aren’t covered (minor). ", "With “Suggestions per category” set to two, the user sees eight options, which roughly doubles the stops inside the options region. “One press or two” also covers “New 4” and the Command Bar, not only the response options."),
            fixp("Recommend one suggestion per category for switch users, or count the eight-option case."),
            num("review", "Some sources are weaker than the text suggests (minor). ", "The 30% figure rests on a review site [22], and the word prediction figures are secondhand [16]. Source [20] is a paper about humor in AAC, cited for a general claim. The advice to offer all three scan methods rests on six people in one 1992 study [9]."),
            fixp("Cite the primary papers where possible, or soften the wording to “one small study suggests”."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Switch Access Proposal.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
