/* Generates docPath("Conversant AAC Switch Access Design.docx") - how switch access is
 * built into the app and how its settings are organized.
 *
 * WHY THIS EXISTS. Ken, November 12 2026: "We aren't advertising switch access for beta
 * testers yet so it's safe to add the functionality. Write up a design (docx). Include
 * any open issues and especially describe how the settings tab will be organized to
 * clearly indicate which settings are global and which are specific to a particular UI."
 *
 * RELATION TO THE PROPOSAL. "Conversant AAC Switch Access Proposal.docx" says WHAT the
 * scanning does and why, and is the record of Ken's review decisions. This document says
 * HOW it goes into the app and how it is set up. Where the two overlap, the proposal's
 * behavior is quoted, not redesigned, so the two cannot drift: change the behavior there.
 *
 * Run: node generate-switch-access-design-doc.js
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber } = require('docx');

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
// The recommendation under an open issue, indented so it reads as part of the item.
const rec = (text) => new Paragraph({
    spacing: { before: 0, after: 140 }, indent: { left: 720 },
    children: [new TextRun({ text: "Recommended: ", italics: true }), new TextRun(text)],
});
// What Ken decided in review (November 12 2026), set out the same way as a recommendation.
const dec = (text) => new Paragraph({
    spacing: { before: 0, after: 140 }, indent: { left: 720 },
    children: [new TextRun({ text: "Decided: ", italics: true }), new TextRun(text)],
});
// A point inside an issue, indented under it.
const sub = (text) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 0, after: 60 }, indent: { left: 1080, hanging: 360 },
    children: [new TextRun(text)],
});

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
    },
    numbering: {
        config: [
            { reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            numbered("tabsteps"), numbered("issues"), numbered("checks"),
        ],
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Switch Access Design", italics: true, color: "808080", size: 18, font: "Arial" })],
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
                children: [new TextRun({ text: "Switch Access Design", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated November 12, 2026", size: 20, color: "808080" })] }),

            para("This document says how switch access goes into Conversant and how its settings are laid out. The Switch Access Proposal says what scanning does and why, and it records the decisions made in review. This document doesn’t change any of that behavior. Where the two overlap, the proposal is the one to change."),
            para("Switch access isn’t being offered to beta testers yet, so it can be built into the app now. It stays out of the way: “Number of switches” starts at “None”, and with “None” the app behaves exactly as it does today. In this document, “you” means the reader and “the user” means the person using the switches."),
            para("Section 3 covers the Switch Access tab in Settings, and how it shows which settings apply everywhere and which apply to one screen. Section 6 lists the issues: most were decided in review, and the rest each have a recommendation."),

            h1("1. What the First Build Includes"),
            para("The three prototypes on the website already work, and the first build follows them closely. The table says what goes in now, what comes later and why."),
            table(["Part", "When", "Why"], [
                ["Number of switches (none to three) and the keys for each switch", "First build", "Everything else depends on it"],
                ["Automatic, step, inverse and hold to move, with racing and a back switch", "First build", "The prototypes have all of them; drop any the therapists reject (issue 4)"],
                ["By region and one line, no groups", "First build", "Decided in review"],
                ["The conversation screen and “In my own words”", "First build", "The core of the app"],
                ["The start screen, its notices and the red confirmation cards", "First build", "A user can’t get past them otherwise"],
                ["Settings, including About Me", "First build", "Some testers will set up the app without a supporter, and the Settings prototype is the most tested of the three (issue 7)"],
                ["The suggestion key in the Enter key’s place", "First build", "It helps tapping too (issue 8)"],
                ["A keyboard with the most-used letters first", "First build", "A new keyboard layout anyone can choose. It has QWERTY’s shape, so it adds no new Express Panel shape"],
                ["“Pause” at the end of the Command Bar", "Later", "Left out until the therapists ask for it (issue 18)"],
                ["Reframe buttons, a separate switch layout, spoken cues", "Later", "Each is still a question in the proposal (issue 14)"],
                ["Conversation Review", "Later", "Mostly works as it is; the concerns are in issue 16"],
            ], [3800, 1700, 3860]),
            gap(),

            h1("2. How It Fits Into the App"),
            h2("2.1 One scanner for every screen"),
            para("One part of the app does all the scanning. Each screen marks its regions and rows with a label on the page, and the scanner reads the screen each time the highlight moves. A button added later is then scanned without anyone remembering to add it."),
            para("The scanner skips any button the user couldn’t usefully tap. A hidden button is one not on screen at the moment, such as a band’s “More” button when the band fits, or “End practice” outside Practice. A switched-off button is on screen but does nothing, such as “Delete” on an empty Express Panel position in Settings, or the faded response options in Conversation Review. A blank button holds nothing yet, such as a response option position before any options arrive, an empty Express Panel position, or the suggestion key when there is no suggestion."),
            para("The order on each screen is the one the prototypes use and the proposal describes. The rules that decide the next stop live apart from the screen, so the tests can check them without a browser."),
            h2("2.2 Pressing a button for the user"),
            para("When the user chooses, the scanner gives the button a complete touch, start and end. Some buttons act at the start of a touch, such as the keyboard keys, so a click alone wouldn’t work. The rest of the app then does what it does for a tap today."),
            para("There is no separate “two presses” setting for switches. “One tap or two” already asks for a second tap on anything that speaks or changes the screen, and it covers switch presses too. When it’s set to two, the scanner counts the two switch presses itself and then gives the button one touch that the app treats as already confirmed. Otherwise the app would ask again after the scanner’s two presses, and every choice would take four. Choosing switches sets it to one tap to start with (section 2.7)."),
            h2("2.3 Where switch presses come from"),
            bullet("Keys. ", "A switch interface usually sends a key press. Each switch has starting keys (Space or 1, Enter or 2, and 3), and the user can set another key for each switch."),
            bullet("Mouse buttons. ", "Left, right and middle act as switches 1, 2 and 3. Setting a key turns this off, because both at once is wrong, and a checkbox turns it back on. Whether it starts on is issue 19."),
            bullet("A tap anywhere. ", "This is a setting, for a switch that works like a touch on the screen. It’s off to start with, and may be left out of the first build (issue 18)."),
            para("While switch access is on, a switch key goes only to the scanner. It never types into a text box or presses a focused button, or one press would do two things."),
            h2("2.4 Sound on an iPad"),
            para("A browser lets a page start sound only straight after a press, and a key going down counts while a key coming up doesn’t. The scanner acts during the press itself, with nothing waiting first. “Act on release” may not be able to start sound on an iPad, which is one of the device checks in section 5."),
            h2("2.5 The highlight"),
            para("The highlight is drawn on top of the button and changes nothing about its size or place. A keyguard still fits, and the layout is the one a direct-select user sees. The “Leave” outline is drawn around a region the same way."),
            para("Each of the seven color schemes gets its own highlight color, checked for contrast like every other color in the app. The test that checks button positions would also check them with the highlight showing."),
            h2("2.6 When the screen changes"),
            para("The proposal’s section 3.4 says where the highlight goes when options arrive, change or fail, and those rules go in unchanged. The scanner also follows what “More” shows, a switched-on button moving to the front of its band, and the partner’s offered choices covering the end of the Context band. It reads these from the screen rather than being told."),
            h2("2.7 Choosing switches or touch"),
            para("Whether the user selects by touch or by switches is the most basic choice in the app, so it goes at the top of the General tab rather than inside the Switch Access tab. It is “Number of switches”: “None” means touch, or a mouse or eye-gaze system that acts like one, and one to three means switches. The rest of the switch settings stay on the Switch Access tab."),
            para("It isn’t on the start screen. That screen shows at every launch, and a choice there would be one more thing to get past each time. Setting up switches the first time always needs a hand anyway, to plug in the interface and choose its keys, and the default of “None” leaves everyone else untouched."),
            para("Choosing one, two or three switches applies a set of starting values for switches. One part is the scan values in section 4. The other part is a few app settings that suit switches:"),
            bullet("Keyboard for typing. ", "The on-screen keyboard, because a switch user can’t use a device keyboard."),
            bullet("Lists in Settings. ", "“Move up”, “Move down” and “Delete” move into each item’s row, as decided in review."),
            bullet("One tap or two. ", "One tap, because two presses doubles the work of every choice (section 2.2)."),
            bullet("Response options and listening. ", "One response option per category, and listening that resumes after speaking, since each saves the user presses."),
            para("The app remembers what those app settings were before. Choosing “None” puts them back as the user had them, so moving between touch and switches never loses a touch setting."),
            h2("2.8 Saving and moving the settings"),
            para("Switch settings are saved with the other settings, so they go into settings profiles and backups. They split in two. How the user wants scanning to behave, such as the method, speeds and timing, travels to a new device. The switch keys and the mouse choice describe the interface plugged into this device, so they stay with it, as the screen layout already does (issue 9)."),

            h1("3. The Switch Access Tab"),
            para("Apart from “Number of switches”, which is on the General tab (section 2.7), every switch setting goes on a new tab after Screen Layout. While switch access is still being built and tried, the tab is labeled “Switch Access (in progress)”, so nobody takes it for a finished feature. Like every tab, its sections start closed and only one is open at a time."),
            h2("3.1 Every screen or one screen"),
            para("A switch setting either applies on every screen or applies on one screen only. The tab makes this visible in three ways."),
            num("tabsteps", "The sections show it. ", "“Your switches” comes first. Next is “On every screen”, with sub-sections indented under it. Then there is one section for each screen: “Conversation screen”, “In my own words” and “Settings”."),
            num("tabsteps", "The names say which screen. ", "A setting in a section named for a screen does nothing anywhere else."),
            num("tabsteps", "The spoken help starts with it. ", "Under the “?”, each setting’s help begins with where it applies, such as “On every screen, …” or “In In my own words only, …”."),
            para("Each setting lives in one place only. No setting is repeated for each screen, and no screen can override a setting from “On every screen” in the first build (issue 10)."),
            h2("3.2 Section by section"),
            table(["Section", "Applies to", "Settings"], [
                ["Your switches", "Every screen", "The key for each switch. Mouse buttons also act as switches. A tap anywhere counts as a press. A line that lights up when a switch is pressed, to test the switches."],
                ["On every screen > Scan method and speed", "Every screen", "Scan method. Seconds per stop."],
                ["On every screen > Holding a switch", "Every screen", "Tap or hold. Top speed while held. Speeding up while held."],
                ["On every screen > Groups", "Every screen", "By group, or one line with no groups. Leaving a group: after a pass, or a “Leave” stop."],
                ["On every screen > Stray and mistimed presses", "Every screen", "Act on press or release. Ignore short presses. Ignore quick repeats. Act on the previous stop."],
                ["Conversation screen", "Conversation screen", "Reading time for new options. New options during a scan: hold or show. The partner’s and place’s row first. “More” scanned first or last."],
                ["In my own words", "“In my own words”", "Word suggestion: how the scan reaches the suggested word. It can be the key in the Enter key’s place (the starting value), a stop before the rows of keys, a stop after them, or not at all. After a key: whether the highlight stays on the key just typed for one more stop, so another press types the same letter again, as in “tt”."],
                ["Settings", "Settings, including About Me", "Drop-down lists: each press moves to the next choice, or a press opens the list."],
            ], [2700, 1800, 4860]),
            gap(),
            para("Two settings in “On every screen” behave a little differently on some screens, and the spoken help says so. “By group, or one line” has no meaning in Settings, where choosing a tab or opening a section is moving around rather than grouping. In “In my own words”, the keyboard is left only through “Leave keyboard”, and the other rows leave after a pass, so “Leaving a group” doesn’t apply there. It does apply on the conversation screen and to the rows of the lists in Settings."),
            para("A “Leave” stop is never a button, on any screen. It is the dashed outline with a label described in section 2.5, the same on the conversation screen, in “In my own words” and in Settings. A button would add a row that a touch user doesn’t see, and the layout must stay the one a touch user and their keyguard rely on. The Settings prototype still uses “Leave” buttons and would change to match."),
            para("Where a setting doesn’t apply, it is grayed out rather than hidden, as the prototypes do. With “Number of switches” at “None”, the whole Switch Access tab is grayed out."),
            h2("3.3 Settings that stay on other tabs"),
            bullet("Number of switches (General). ", "The choice between touch and switches (section 2.7)."),
            bullet("One tap or two (General). ", "Tapping and switches share it, because it decides what needs a second press. Its “Time allowed between the two taps” gains longer choices (2, 3 and 4 seconds), since a switch user needs more time."),
            bullet("Keyboard for typing (Express Panel and Keyboard). ", "Set automatically when switches are chosen (section 2.7). Its layouts gain one with the most-used letters first, in QWERTY’s shape, for anyone to choose."),
            bullet("Tapping More shows the rest (Express Panel and Keyboard). ", "It decides what “More” shows, for tapping and scanning alike."),
            para("The Switch Access tab’s description names these tabs, so nobody has to hunt for them. Per-control help text stays off the screen, as for every other tab."),
            h2("3.4 Changing the number of switches"),
            para("Each number of switches has its own starting values (section 4). Choosing a different number puts them back and replaces any changes. If the user or supporter has changed any of them, the red confirmation card asks first, because the changes may have taken a session of trial and error to find (issue 12)."),
            h2("3.5 Reaching Settings with a switch"),
            para("Settings is part of the scan from the first build, and it is scanned the way the Settings prototype does (issue 7). A stray press that opens it is undone by scanning to its close button. A supporter can still open it by touch."),

            h1("4. Starting Values"),
            para("These are the proposal’s starting values, unchanged. They’re our judgment, not published guidance, and no therapist has reviewed them yet. Because switch access is marked as in progress, they can be changed in the app as feedback comes in (issue 13)."),
            table(["", "One switch", "Two switches", "Three switches"], [
                ["Scan method", "Automatic", "Step", "Step, the third moves back"],
                ["Seconds per stop", "1.5", "No timer", "No timer"],
                ["Leaving a region", "After a pass with no press", "Stepping past the last stop", "Stepping past, or moving back from the first"],
                ["Late press forgiven within", "0.3 seconds", "Off", "Off"],
                ["Repeats ignored within", "0.3 seconds", "0.3 seconds", "0.3 seconds"],
                ["Holding a switch", "Tap under 0.4 s; speeds up to 0.5 s per stop over 4 stops", "Racing after 0.4 s; speeds up to 0.3 s per stop over 2 stops", "As two switches"],
            ], [2400, 2320, 2320, 2320]),
            gap(),
            para("For all three, “One tap or two” is set to one tap (section 2.7), the scan goes by region, new options wait until the highlight leaves the old ones, and the reading time for new options is 4 seconds."),

            h1("5. How It Will Be Checked"),
            num("checks", "The order rules. ", "Tests feed the rules a screen and check every stop, for each number of switches and each scan method. This is the same arrangement the conversation rules already use."),
            num("checks", "The real app, end to end. ", "A browser check opens the app, presses switch keys and checks what was said and what happened, in the same way the question-session check already does. Pressing a key must reach the button, not only the rules."),
            num("checks", "Nothing moves. ", "The button-position test runs with switch access on and the highlight showing, and the positions must match those with it off."),
            num("checks", "The highlight shows. ", "Its color is checked for contrast in all seven schemes."),
            num("checks", "Real devices. ", "An iPad in Safari and installed on the Home Screen, Android, a Surface and a Chromebook, each with a real switch interface. These answer issues 2 and 3, and no test on this computer can. A device test plan will list, for each device, the questions in section 6 that it has to answer, so none is missed."),
            num("checks", "In the field. ", "Each tester’s weekly report already carries their settings whenever they change, with keys left out. The report reader will be taught to list which settings each tester has changed from their starting values, so we can see which switch settings are actually used (issues 4 and 6)."),

            h1("6. Issues"),
            para("Most issues were decided in review on November 12, 2026. The rest each have a recommendation."),
            num("issues", "Conversant’s scanner or the device’s. ", "The proposal left open whether to rely on iPad Switch Control and Android Switch Access instead. Windows has nothing equivalent, so Conversant needs its own scanner either way."),
            dec("build Conversant’s own, and still try the device’s, since some users will already use it."),
            num("issues", "Do switch presses reach the page? ", "With iPad Switch Control or Android Switch Access turned on, the device may take the presses before Conversant sees them. Nobody has checked."),
            dec("check on real devices before telling any user how to set up."),
            num("issues", "“Act on release” and sound on an iPad. ", "A key coming up may not count as a press for starting sound (section 2.4)."),
            dec("check it; if it fails, gray out “Act on release” on an iPad and say why in the spoken help."),
            num("issues", "Which ways of holding a switch to keep. ", "Hold to move, racing, speeding up while held and a third switch each add settings to learn."),
            dec("build them all, since the prototypes prove they work, and drop any the therapists and testers don’t use. The weekly reports will show which are used (section 5)."),
            num("issues", "New options during a scan. ", "Hold the newer set until the highlight leaves the options, or show it at once."),
            dec("hold it, as the proposal recommends, and keep “show at once” as the other choice."),
            num("issues", "Leaving a region. ", "After a pass with no press, or a “Leave” stop."),
            dec("keep both as settings, as the proposal recommends. The weekly reports will show which testers choose (section 5)."),
            num("issues", "Settings in the first build. ", "Without it, a switch-only user can’t change a setting alone, and some beta testers will set up the app without a supporter."),
            dec("first build. The Settings prototype has had the most testing and refinement of the three."),
            num("issues", "The suggestion key. ", "The same keyboard is used in Settings and About Me, where Enter saves a one-line box."),
            dec("check whether those boxes need Enter. If they do, show the suggestion key only in “In my own words”."),
            num("issues", "Switch settings on a new device. ", "How the user wants scanning to behave belongs to the user, while the keys belong to the interface plugged into this device."),
            dec("split them, as section 2.8 says. The method, speeds, holding, groups and timing travel in backups and profiles. The keys and the mouse choice stay with the device. A user who moves to a new device with the same interface sets the keys again, which takes a minute. Revisit if a user asks."),
            num("issues", "A different speed on one screen. ", "A user might want a slower scan on the keyboard than on the conversation screen. Allowing that blurs the line between every screen and one screen."),
            dec("not in the first build. Add it later as a setting under that screen only, if a tester asks."),
            num("issues", "Where the tab sits. ", "After Screen Layout keeps it with the other settings about how the screen is reached."),
            dec("after Screen Layout. It could move once the tab list is reviewed."),
            num("issues", "Asking before resetting the starting values. ", "Changing the number of switches replaces tweaks."),
            dec("ask with the red confirmation card, but only when something was changed from the starting values."),
            num("issues", "The starting values. ", "Nobody with clinical experience has reviewed them, and the therapists have been slow to answer on the prototypes."),
            dec("don’t wait for them. Switch access is marked as in progress (section 3), and the values are changed in the app as feedback comes in, from therapists or testers."),
            num("issues", "Reframe buttons, a separate switch layout and spoken cues. ", "Each is a question in the proposal, not part of the design:"),
            sub("Reframe buttons. A button that holds a word or short phrase saved in advance, such as “Tyler”, “therapy” or “my shoulder”. Pressing it does what typing those words and pressing “Reframe” does today: the AI rewrites the four response options around them, and nothing is spoken. It lasts for one turn, and two of them add together. They would sit in the Flex band, with a list for each person and place. They save a switch user from typing."),
            sub("A separate switch layout. The rest of the design keeps the screen exactly as a touch user sees it, because of the keyguard. A switch user doesn’t use a keyguard, so their screen could differ, such as a smaller Express Panel with fewer, larger buttons, or “More” placed where the scan reaches it first. A user who touches when rested and uses a switch when tired would keep a layout for each."),
            sub("Spoken cues. The app would say each stop aloud as the highlight reaches it, for a user who can’t read the screen well. The partner and the microphone hear the cues unless they go to an earpiece, and an iPad can’t reliably send sound to one separately."),
            rec("decide each when a therapist or tester asks for it. None of them blocks the first build."),
            num("issues", "Highlight size. ", "A user with low vision may need a thicker highlight than the default."),
            dec("one thickness for now, checked in every scheme; add a size setting if a tester needs it."),
            num("issues", "Practice and Conversation Review. ", "Practice uses the conversation screen, so it’s scanned like a real conversation. Conversation Review mostly works through what already exists: the user moves through the turns with “Previous”, “Next” and “Jump” on its Command Bar, and opens a rewrite with “In my own words”. The concerns are these:"),
            sub("Its Command Bar has different buttons, and two blank positions, so it needs its own scan order."),
            sub("Only “In my own words” works on its Express Panel; the other buttons are drawn for shape. They must be marked as switched off, or the scan stops on thirty buttons that do nothing."),
            sub("Of the response options, only the one that was spoken opens a rewrite. The faded ones must be skipped."),
            sub("A touch user can tap a turn in the conversation pane to rewrite it. The pane isn’t scanned, so a switch user goes through “In my own words” instead. It works, but it’s a step a touch user doesn’t need."),
            sub("Review has its own part of the app that catches taps before the rest. The scanner’s touch has to reach it the same way a real tap does, and that must be checked, not assumed."),
            sub("The list of conversations is a table in Settings that can be sorted by column. Its rows and column headings need a scan order."),
            dec("Practice works in the first build; Conversation Review comes later."),
            num("issues", "Documentation. ", "The User Manuals say nothing about switches yet."),
            dec("write the manual sections when switch access is offered to users, not before, since the details may still change."),
            num("issues", "“Pause” and “A tap anywhere”. ", "“Pause” is left out until the therapists ask for it. Its other job was letting a supporter touch the screen while “A tap anywhere counts as a press” is on. Without “Pause”, every touch is then a switch press, and the supporter can’t reach Settings by touch to turn it off."),
            rec("leave “A tap anywhere” out of the first build too, and add both back together if they’re asked for."),
            num("issues", "A supporter’s mouse. ", "While mouse buttons act as switches, a supporter clicking with a mouse is pressing a switch, on every screen including Settings. A touch screen isn’t affected."),
            rec("in the app, mouse buttons start off as switches, since most switch interfaces send key presses, and a user whose interface sends clicks turns them on. The prototypes start with them on only so they can be tried with a mouse."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Switch Access Design.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
