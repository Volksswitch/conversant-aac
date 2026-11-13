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
            para("Section 3 covers the Switch Access tab in Settings, and how it shows which settings apply everywhere and which apply to one screen. Section 6 lists the open issues, each with a recommendation."),

            h1("1. What the First Build Includes"),
            para("The three prototypes on the website already work, and the first build follows them closely. The table says what goes in now, what comes later and why."),
            table(["Part", "When", "Why"], [
                ["Number of switches (none to three) and the keys for each switch", "First build", "Everything else depends on it"],
                ["Automatic, step, inverse and hold to move, with racing and a back switch", "First build", "The prototypes have all of them; drop any the therapists reject (issue 4)"],
                ["By region and one line, no groups", "First build", "Decided in review"],
                ["The conversation screen and “In my own words”", "First build", "The core of the app"],
                ["The start screen, its notices and the red confirmation cards", "First build", "A user can’t get past them otherwise"],
                ["“Pause” at the end of the Command Bar", "First build", "Rest, and a supporter can use the screen"],
                ["Settings and About Me", "Second build", "A supporter sets them up at first (issue 7)"],
                ["The suggestion key in the Enter key’s place", "Separate decision", "It helps tapping too (issue 8)"],
                ["Reframe buttons, a separate switch layout, spoken cues", "Later", "Each is still a decision in the proposal"],
                ["Conversation Review", "Later", "Rarely used, and a supporter can help"],
                ["A keyboard with the most-used letters first", "Not planned", "Only in the prototype, to compare"],
            ], [3800, 1700, 3860]),
            gap(),

            h1("2. How It Fits Into the App"),
            h2("2.1 One scanner for every screen"),
            para("One part of the app does all the scanning. Each screen marks its regions and rows with a label on the page, and the scanner reads the screen each time the highlight moves. A button added later is then scanned without anyone remembering to add it, and a hidden, switched-off or blank button is skipped."),
            para("The order on each screen is the one the prototypes use and the proposal describes. The rules that decide the next stop live apart from the screen, so the tests can check them without a browser."),
            h2("2.2 Pressing a button for the user"),
            para("When the user chooses, the scanner gives the button a complete touch, start and end. Some buttons act at the start of a touch, such as the keyboard keys, so a click alone wouldn’t work. The rest of the app then does what it does for a tap today."),
            para("“One tap or two” already asks for a second tap on anything that speaks or changes the screen. The scanner handles that second press itself, using the same setting, and tells the app the press is already confirmed. Without that, every choice would need four presses."),
            h2("2.3 Where switch presses come from"),
            bullet("Keys. ", "A switch interface usually sends a key press. Each switch has starting keys (Space or 1, Enter or 2, and 3), and the user can set another key for each switch."),
            bullet("Mouse buttons. ", "Left, right and middle act as switches 1, 2 and 3. Setting a key turns this off, because both at once is wrong, and a checkbox turns it back on."),
            bullet("A tap anywhere. ", "This is a setting, for a switch that works like a touch on the screen. It’s off to start with."),
            para("While switch access is on, a switch key goes only to the scanner. It never types into a text box or presses a focused button, or one press would do two things."),
            h2("2.4 Sound on an iPad"),
            para("A browser lets a page start sound only straight after a press, and a key going down counts while a key coming up doesn’t. The scanner acts during the press itself, with nothing waiting first. “Act on release” may not be able to start sound on an iPad, which is one of the device checks in section 5."),
            h2("2.5 The highlight"),
            para("The highlight is drawn on top of the button and changes nothing about its size or place. A keyguard still fits, and the layout is the one a direct-select user sees. The “Leave” outline is drawn around a region the same way."),
            para("Each of the seven color schemes gets its own highlight color, checked for contrast like every other color in the app. The test that checks button positions would also check them with the highlight showing."),
            h2("2.6 When the screen changes"),
            para("The proposal’s section 3.4 says where the highlight goes when options arrive, change or fail, and those rules go in unchanged. The scanner also follows what “More” shows, a switched-on button moving to the front of its band, and the partner’s offered choices covering the end of the Context band. It reads these from the screen rather than being told."),
            h2("2.7 Turning switch access on"),
            bullet("Keyboard for typing. ", "Set to the on-screen keyboard, because a switch user can’t use a device keyboard. The tab says it did this."),
            bullet("Lists in Settings. ", "“Move up”, “Move down” and “Delete” move into each item’s row, as decided in review."),
            bullet("Recommended but not changed. ", "One response option per category, and resuming listening after speaking. The tab names them, and the user or supporter decides."),
            para("Turning switch access back to “None” puts the lists back. It leaves the keyboard choice alone, because the user may want to keep it."),
            h2("2.8 Saving and moving the settings"),
            para("Switch settings are saved with the other settings, so they go into settings profiles and backups. The switch keys and the mouse choice describe the hardware plugged into this device, so a backup from another device leaves them alone, as it already does for the screen layout (issue 9)."),

            h1("3. The Switch Access Tab"),
            para("All switch settings go on a new Switch Access tab, after Screen Layout. Like every tab, its sections start closed and only one is open at a time."),
            h2("3.1 Every screen or one screen"),
            para("A switch setting either applies on every screen or applies on one screen only. The tab makes this visible in three ways."),
            num("tabsteps", "The sections are grouped. ", "After “Your switches”, which comes first, there are two parent sections: “On every screen” and “On one screen only”. Each holds sub-sections, indented under it, so the grouping shows on the page."),
            num("tabsteps", "The names say which screen. ", "Each sub-section under “On one screen only” is named for its screen: “Conversation screen”, “In my own words” and “Settings and About Me”. A setting there does nothing anywhere else."),
            num("tabsteps", "The spoken help starts with it. ", "Under the “?”, each setting’s help begins with where it applies, such as “On every screen, …” or “In In my own words only, …”."),
            para("Each setting lives in one place only. No setting is repeated for each screen, and no screen can override a setting from “On every screen” in the first build (issue 10)."),
            h2("3.2 Section by section"),
            table(["Section", "Applies to", "Settings"], [
                ["Your switches", "Every screen", "Number of switches. The key for each switch. Mouse buttons also act as switches. A tap anywhere counts as a press. A line that lights up when a switch is pressed, to test the switches."],
                ["On every screen > Scan method and speed", "Every screen", "Scan method. Seconds per stop."],
                ["On every screen > Holding a switch", "Every screen", "Tap or hold. Top speed while held. Speeding up while held."],
                ["On every screen > Groups", "Every screen", "By group, or one line with no groups. Leaving a group: after a pass, or a “Leave” stop."],
                ["On every screen > Stray and mistimed presses", "Every screen", "Act on press or release. Ignore short presses. Ignore quick repeats. Act on the previous stop."],
                ["On one screen only > Conversation screen", "Conversation screen", "Reading time for new options. New options during a scan: hold or show. The partner’s and place’s row first. “More” scanned first or last."],
                ["On one screen only > In my own words", "“In my own words”", "Where the word suggestion is a stop: first, last or none. Stay on a key for one more stop."],
                ["On one screen only > Settings and About Me", "Settings and About Me", "Drop-down lists: each press moves to the next choice, or a press opens a list. (Second build.)"],
            ], [2700, 1800, 4860]),
            gap(),
            para("Two global settings behave a little differently on some screens, and the spoken help says so. “Groups” has no meaning in Settings and About Me, where choosing a tab or opening a section is moving around rather than grouping. In “In my own words”, the keyboard is left only through “Leave keyboard”, and the other rows leave after a pass, so “Leaving a group” doesn’t apply there."),
            para("Where a setting doesn’t apply, it is grayed out rather than hidden, as the prototypes do. With “Number of switches” at “None”, everything below it is grayed out."),
            h2("3.3 Settings that stay on other tabs"),
            bullet("One tap or two (General). ", "Tapping and switches share it, because it decides what needs a second press. Its “Time allowed between the two taps” gains longer choices (2, 3 and 4 seconds), since a switch user needs more time."),
            bullet("Keyboard for typing (Express Panel and Keyboard). ", "Set automatically when switch access is turned on (section 2.7)."),
            bullet("Tapping More shows the rest (Express Panel and Keyboard). ", "It decides what “More” shows, for tapping and scanning alike."),
            para("The Switch Access tab’s description names these three tabs, so nobody has to hunt for them. Per-control help text stays off the screen, as for every other tab."),
            h2("3.4 Changing the number of switches"),
            para("Each number of switches has its own starting values (section 4). Choosing a different number puts them back and replaces any changes. If the user or supporter has changed any of them, the red confirmation card asks first, because the changes may have taken a session of trial and error to find (issue 12)."),
            h2("3.5 Reaching the tab with a switch"),
            para("In the first build, Settings is left out of the scan, so a stray press can’t open a panel the user can’t leave. A supporter opens it by touch. With “A tap anywhere counts as a press” on, the supporter presses “Pause” first. The second build scans Settings the way the Settings prototype does."),

            h1("4. Starting Values"),
            para("These are the proposal’s starting values, unchanged. They’re our judgment, not published guidance, and the therapists still need to review them (issue 13)."),
            table(["", "One switch", "Two switches", "Three switches"], [
                ["Scan method", "Automatic", "Step", "Step, the third moves back"],
                ["Seconds per stop", "1.5", "No timer", "No timer"],
                ["Leaving a region", "After a pass with no press", "Stepping past the last stop", "Stepping past, or moving back from the first"],
                ["Late press forgiven within", "0.3 seconds", "Off", "Off"],
                ["Repeats ignored within", "0.3 seconds", "0.3 seconds", "0.3 seconds"],
                ["Holding a switch", "Tap under 0.4 s; speeds up to 0.5 s per stop over 4 stops", "Racing after 0.4 s; speeds up to 0.3 s per stop over 2 stops", "As two switches"],
            ], [2400, 2320, 2320, 2320]),
            gap(),
            para("For all three, two presses to act is off, the scan goes by region, new options wait until the highlight leaves the old ones, and the reading time for new options is 4 seconds."),

            h1("5. How It Will Be Checked"),
            num("checks", "The order rules. ", "Tests feed the rules a screen and check every stop, for each number of switches and each scan method. This is the same arrangement the conversation rules already use."),
            num("checks", "The real app, end to end. ", "A browser check opens the app, presses switch keys and checks what was said and what happened, in the same way the question-session check already does. Pressing a key must reach the button, not only the rules."),
            num("checks", "Nothing moves. ", "The button-position test runs with switch access on and the highlight showing, and the positions must match those with it off."),
            num("checks", "The highlight shows. ", "Its color is checked for contrast in all seven schemes."),
            num("checks", "Real devices. ", "An iPad in Safari and installed on the Home Screen, Android, a Surface and a Chromebook, each with a real switch interface. These answer issues 2 and 3, and no test on this computer can."),

            h1("6. Open Issues"),
            para("Each issue has a recommendation. Several depend on the device checks or on the therapists trying the prototypes."),
            num("issues", "Conversant’s scanner or the device’s. ", "The proposal left open whether to rely on iPad Switch Control and Android Switch Access instead. Windows has nothing equivalent, so Conversant needs its own scanner either way."),
            rec("build Conversant’s own, and still try the device’s, since some users will already use it."),
            num("issues", "Do switch presses reach the page? ", "With iPad Switch Control or Android Switch Access turned on, the device may take the presses before Conversant sees them. Nobody has checked."),
            rec("check on real devices before telling any user how to set up."),
            num("issues", "“Act on release” and sound on an iPad. ", "A key coming up may not count as a press for starting sound (section 2.4)."),
            rec("check it; if it fails, gray out “Act on release” on an iPad and say why in the spoken help."),
            num("issues", "Which ways of holding a switch to keep. ", "Hold to move, racing, speeding up while held and a third switch each add settings to learn."),
            rec("build them all, since the prototypes prove they work, and drop any the therapists and testers don’t use."),
            num("issues", "New options during a scan. ", "Hold the newer set until the highlight leaves the options, or show it at once."),
            rec("hold it, as the proposal recommends, and keep “show at once” as the other choice."),
            num("issues", "Leaving a region. ", "After a pass with no press, or a “Leave” stop."),
            rec("keep both as settings, as the proposal recommends."),
            num("issues", "Settings and About Me in the first build. ", "Without them, a switch-only user can’t change a setting alone. With them, the first build takes longer."),
            rec("second build, with a supporter doing setup until then. The Settings prototype has already settled most of the design."),
            num("issues", "The suggestion key. ", "The same keyboard is used in Settings and About Me, where Enter saves a one-line box."),
            rec("check whether those boxes need Enter. If they do, show the suggestion key only in “In my own words”."),
            num("issues", "Switch keys in a backup. ", "Keys describe the hardware on this device, but a user who moves to a new device with the same interface would want them."),
            rec("keep them with the device, like the screen layout, and revisit if a user asks."),
            num("issues", "A different speed on one screen. ", "A user might want a slower scan on the keyboard than on the conversation screen. Allowing that blurs the line between every screen and one screen."),
            rec("not in the first build. Add it later as a setting under that screen only, if a tester asks."),
            num("issues", "Where the tab sits. ", "After Screen Layout keeps it with the other settings about how the screen is reached."),
            rec("after Screen Layout. It could move once the tab list is reviewed."),
            num("issues", "Asking before resetting the starting values. ", "Changing the number of switches replaces tweaks."),
            rec("ask with the red confirmation card, but only when something was changed from the starting values."),
            num("issues", "The starting values. ", "Nobody with clinical experience has reviewed them."),
            rec("send the therapists the prototype links and section 4 before any user tries switch access."),
            num("issues", "Reframe buttons and a separate switch layout. ", "Both are still decisions in the proposal."),
            rec("decide after the therapists try the prototypes. Neither blocks the first build."),
            num("issues", "Highlight size. ", "A user with low vision may need a thicker highlight than the default."),
            rec("one thickness for now, checked in every scheme; add a size setting if a tester needs it."),
            num("issues", "Practice and Conversation Review. ", "Practice uses the conversation screen, so it’s scanned like a real conversation. Conversation Review has its own Command Bar buttons."),
            rec("Practice works in the first build; Conversation Review comes later."),
            num("issues", "Documentation. ", "The User Manuals say nothing about switches yet."),
            rec("write the manual sections when switch access is offered to users, not before, since the details may still change."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Switch Access Design.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
