/* Generates docPath("Conversant AAC Switch Access Device Test Plan.docx") - discrete
 * steps for checking switch access on an iPad and an Android tablet with a real switch
 * interface.
 *
 * WHY THIS EXISTS. Ken, November 13 2026: "put together a docx test plan (with discrete
 * steps) for testing switch access on the non-PC devices (you decide whether Chromebook
 * and MacBook are close enough to a PC that they don't need to be tested separately)."
 * It answers the TODO item "Switch access: a device test plan" and the device questions
 * in section 6 of the Switch Access Design (issues 1, 2 and 3, and section 2.4).
 *
 * DECISION RECORDED HERE: a Chromebook and a MacBook are NOT tested separately. Both run
 * Chrome (the Mac manual says Chrome or Edge), the same browser as the PC, so key
 * presses, mouse buttons, the highlight and sound reach the app the same way.
 *
 * The .docx is the source of truth once Ken has worked in it (the results column is his).
 * Re-running this generator over a filled-in plan would discard his results; the
 * overwrite guard in doc-paths.js refuses unless forced.
 *
 * Run: node generate-switch-device-test-plan-doc.js
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
const gap = () => new Paragraph({ spacing: { before: 0, after: 160 }, children: [] });

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

// A part of the plan: a step table with a Result column left blank for the tester.
const STEP_W = [700, 3600, 3460, 1600];
const steps = (prefix, rows) => table(["Step", "Do this", "You should see", "Result"],
    rows.map((r, i) => [prefix + (i + 1), r[0], r[1], ""]), STEP_W);

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
            numbered("setup"),
        ],
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Switch Access Device Test Plan", italics: true, color: "808080", size: 18, font: "Arial" })],
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
                children: [new TextRun({ text: "Switch Access Device Test Plan", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated November 13, 2026", size: 20, color: "808080" })] }),

            para("This plan checks switch access on an iPad and an Android tablet, using a real switch interface. Each part is a short table of steps. Do the step, compare what happens with the middle column, and write the result in the last column."),
            para("You don’t need to know how the scanner works to run it. Where a step needs a setting changed, it names the tab and the setting."),

            h1("1. What This Plan Answers"),
            para("The Switch Access Design left some questions that only a real device can answer. Each is checked by the parts named here."),
            table(["Question", "Where it comes from", "Checked in"], [
                ["Does a switch work before anyone has touched the screen?", "First build", "Parts A and B"],
                ["Do switch presses still reach Conversant when the device’s own switch feature is on?", "Design issue 2", "Part E"],
                ["Does the device’s own switch feature work with Conversant set to touch?", "Design issue 1", "Part E"],
                ["Does the app still speak when a choice is made as the switch is let go (“Act on release”, inverse, hold to move)?", "Design issue 3 and section 2.4", "Part C"],
                ["Can a switch user get past the browser’s own prompts, such as the microphone permission?", "First build", "Part D"],
                ["Does a supporter’s mouse act as switches, and does Android treat the right button as Back?", "Design issue 19", "Part F"],
                ["Do the keyboard, the suggestion key and the “Leave” outline work on a tablet screen?", "Design issue 8 and section 3.2", "Part G"],
                ["Does automatic scanning keep time on a slower device?", "First build", "Part G"],
                ["When switch access is turned off, does touch come back with the old settings?", "Design section 2.7", "Part H"],
                ["Does an ordinary drop-down mark its current value when tapped open?", "TODO, switch prototypes", "Part H"],
            ], [4300, 2700, 2360]),
            gap(),

            h1("2. Which Devices"),
            table(["Device", "How the app runs", "Parts"], [
                ["iPad", "Private tab in Safari", "A"],
                ["iPad", "Safari tab, not private", "B and C"],
                ["iPad", "Installed on the Home Screen", "B to H"],
                ["Android tablet", "Incognito tab in Chrome", "A"],
                ["Android tablet", "Installed app", "B to H"],
            ], [2300, 4060, 3000]),
            gap(),
            para("The iPad gets two passes because a Safari tab and the installed app keep separate settings and handle sound separately. Part A uses a private tab because only a fresh start shows the first-launch question, and a private tab gives one without deleting anything."),
            para("A Chromebook and a MacBook don’t need their own pass. Both run Chrome, the same browser as the PC, so switch presses, mouse buttons, the highlight and sound all reach the app the same way they do on the PC. The differences are in the hardware. A Mac trackpad has no middle button, and some Chromebooks have touchscreens, where touch does nothing, just as on a Surface. Neither changes what the app does."),
            para("This plan doesn’t cover the PC itself or an Android phone. A phone runs the same Chrome as the tablet, with a smaller screen."),

            h1("3. What You Need"),
            bullet("Conversant 0.15.0 or later. ", "Settings > About shows the version. Switch access is in the public app, unannounced."),
            bullet("A switch interface that sends key presses, with two switches. ", "Set it to send Space for switch 1 and Enter for switch 2 (or 1 and 2). Many interfaces also have a mode made for iPad Switch Control; for Parts A to D and F to H use the mode that sends keys."),
            bullet("A Bluetooth keyboard. ", "This is your way out if the switches stop working (section 5). Space and 1 act as switch 1, Enter and 2 as switch 2, and 3 as switch 3."),
            bullet("A mouse with three buttons. ", "Bluetooth works on both tablets. It’s needed only for Part F."),
            bullet("An API key in the app. ", "Without one no response options appear, and several steps need them. Practice conversations are the easiest way to get options without a second person."),
            bullet("About an hour per device. ", "Part E takes the longest, because it means setting up the device’s own switch feature."),

            h1("4. Before You Start"),
            para("Do these once on each device."),
            num("setup", "Back up. ", "Settings > General > “Backup settings”. If you have to delete the app’s data to get unstuck, this is how you get it back."),
            num("setup", "Turn off the device’s own features that take key presses. ", "On the iPad: Settings > Accessibility > Switch Control, off; and Settings > Accessibility > Keyboards > Full Keyboard Access, off. On Android: Settings > Accessibility > Switch Access, off (on a Samsung it’s Universal switch, under Interaction and dexterity). Part E turns them back on deliberately."),
            num("setup", "Set up a quick way to turn the device’s switch feature off. ", "On the iPad: Settings > Accessibility > Accessibility Shortcut, choose Switch Control, so a triple-click of the top button turns it off. On Android, use the accessibility shortcut (holding both volume keys) for Switch Access."),
            num("setup", "Pair the switch interface and the keyboard. ", "Check in Notes or any text box that switch 1 types a space."),
            num("setup", "Open Conversant and check the version. ", "Settings > About."),

            h1("5. If You Get Stuck"),
            para("While switch access is on, touch does nothing, so a switch that stops working can leave you unable to do anything."),
            bullet("First, use the keyboard. ", "Space moves the highlight and Enter chooses (with two switches). Go to the Command Bar, choose “Settings”, choose the General tab, choose “Number of switches”, and pick “None: I use touch”."),
            bullet("If the keyboard doesn’t work either, ", "close the app. In a private tab, closing the tab is enough, since nothing carries over. Anywhere else the setting stays on when you reopen the app, so you have to delete the app’s data. On the iPad, use Settings > Apps > Safari > Advanced > Website Data for a Safari tab, or delete the Home Screen app and add it again. Then restore the backup from section 4."),
            bullet("Write down what you pressed and where the highlight was ", "before you do any of this. That is the part of the report I most need."),

            h1("6. Recording Results"),
            para("In the Result column write Pass, Fail, or what actually happened. A note beats a bare Fail: “the highlight skipped the second row” tells me more than “Fail”."),
            para("When a step fails, also send a problem report from inside the app: Settings > Troubleshooting > “Send”, with the device, the part and the step number in the note, such as “iPad installed, C2”. The report carries the switch settings, so I can see exactly how the app was set."),
            para("A step marked “Record” has no right answer yet. Write what happens; that is the finding."),

            h1("Part A. The First-Launch Question"),
            para("Run this in a private tab: in Safari, tap the tabs button, then “Private”; in Chrome on Android, use the menu, then “New Incognito tab”."),
            steps("A", [
                ["Open a private tab and go to conversant.volksswitch.org.", "“How will you use Conversant?” with “Touch”, “One switch”, “Two switches” and “Three switches”. A highlight moves from one to the next every 1.5 seconds."],
                ["Don’t touch the screen. When “Two switches” is highlighted, press switch 1.", "The question closes and “Start” is highlighted. If nothing happens, record it. It means a switch can’t answer until the screen has been touched."],
                ["Tap “Start” with your finger.", "Nothing happens. Touch does nothing while switch access is on."],
                ["Press switch 2.", "The app starts. If a card appears about the API key or the folder, the highlight moves to its buttons; choose “Close” or “Not now”."],
                ["On the conversation screen, press switch 1 a few times.", "A highlight goes around the screen in turn: the response options, each row of the Express Panel, “In my own words” and the Command Bar."],
                ["Close the private tab.", "Nothing carries over to your normal tab."],
            ]),
            gap(),

            h1("Part B. Switches Reach the App"),
            para("If switch access isn’t on yet, tap Settings > General > “Number of switches” and choose “Two switches”. From then on, use the switches."),
            steps("B", [
                ["Close the app completely and open it again. Don’t touch the screen. Press switch 2.", "The app starts. A switch works straight after opening, with no touch first."],
                ["Press switch 1 several times.", "The highlight moves region by region. At the Express Panel it lands straight on the first row, never on the panel as a whole."],
                ["With a row of the Express Panel highlighted, press switch 2, then choose a phrase in that row.", "The phrase is spoken."],
                ["Hold switch 1 down for about 3 seconds, then let go.", "After a moment the highlight starts moving by itself and speeds up. It stops when you let go, with no extra step after."],
                ["Press switch 1 twice, as fast as you can.", "The highlight moves once. Presses closer than 0.3 seconds count once."],
                ["Choose “Settings” on the Command Bar, then the Switch Access (in progress) tab, then open “Your switches”.", "The highlight reaches every tab and section. Settings opens and stays open."],
                ["Press and hold each switch in turn.", "The line for that switch lights while it’s held."],
                ["Choose the close button in the corner of Settings.", "Settings closes and the highlight goes back to the conversation screen."],
            ]),
            gap(),

            h1("Part C. Sound"),
            para("A browser lets a page start sound only straight after a press. A key going down counts, but a key coming up may not. Each step starts from a freshly opened app, because sound is switched on by the first choice after opening."),
            steps("C", [
                ["With the starting settings, close and reopen the app, press switch 2 to start, and choose an Express Panel phrase.", "The phrase is spoken."],
                ["In Settings > Switch Access (in progress) > “Stray and mistimed presses”, set “Act on” to “Release”. Close and reopen, start, and choose a phrase.", "Record: is the phrase spoken? This is the main question of this part."],
                ["Start a practice conversation (Settings > Practice) and let the partner speak.", "Record: does a holding phrase play, and is the listening tone heard?"],
                ["Set “Act on” back to “Press”. Set “Ignore presses shorter than” to 0.5 seconds. Close and reopen, start, and choose a phrase with a long press.", "Record: is the phrase spoken? The choice now waits half a second after the press."],
                ["Set “Ignore presses shorter than” back to “Off”. In Settings > General, set “Number of switches” to “One switch”, and confirm the red card if it appears. Set “How the highlight moves” to “Inverse”. Close and reopen, start, and choose a phrase.", "Record: is the phrase spoken? Inverse chooses when the switch is let go."],
                ["Set “How the highlight moves” to “Hold to move, tap to choose”. Close and reopen, start, and choose a phrase.", "Record: is the phrase spoken?"],
                ["Set “Number of switches” back to “Two switches”, and confirm the red card if it appears.", "The starting settings for two switches are back."],
            ]),
            gap(),
            para("If C2, C5 or C6 is silent on the iPad, the design’s answer is to gray out “Act on release” there and say why in the spoken help (issue 3). Note whether it happens in both the Safari tab and the installed app."),

            h1("Part D. The Browser’s Own Prompts"),
            para("These prompts belong to the browser or the device, not to Conversant, so the scan can’t reach them. The question is whether a switch user would be stuck."),
            steps("D", [
                ["Start a real conversation (not practice) and choose “Listen” for the first time on this device.", "Record: does a prompt ask to use the microphone? Can a switch answer it, or does it need a touch? Touch works on the prompt itself."],
                ["Android only: close and reopen the app with a data folder chosen, and press switch 2 to start.", "Record: does a prompt ask for the folder? Can a switch answer it? If “Reconnect my folder” appears, the highlight should reach it."],
                ["iPad installed only: if a paid service is set up for hearing, choose “Listen”.", "Record: any prompt, and whether a switch can answer it."],
            ]),
            gap(),

            h1("Part E. The Device’s Own Switch Feature"),
            para("Some users already use iPad Switch Control or Android Switch Access. This part checks both ways of working: the device’s feature driving Conversant, and Conversant’s own scanner with the device’s feature on. Keep the shortcut from section 4 ready."),
            steps("E", [
                ["Set Conversant’s “Number of switches” to “None: I use touch”.", "Touch works again."],
                ["Turn on the device’s feature and add the switch interface as its switch (iPad: Switch Control > Switches > Add New Switch > External; Android: Switch Access settings > assign the keys).", "The device’s own highlight appears."],
                ["Use the device’s feature to start a conversation and speak an Express Panel phrase.", "Record: does it work, and how many presses did the phrase take?"],
                ["Still using the device’s feature, set “Number of switches” to “Two switches”.", "Conversant’s highlight appears."],
                ["Press each switch.", "Record: does Conversant’s highlight move, does the device’s highlight move, or both? This is the main question of this part."],
                ["Turn the device’s feature off with the shortcut.", "Conversant’s highlight responds to the switches again."],
            ]),
            gap(),

            h1("Part F. A Supporter’s Mouse"),
            para("A supporter helps by using a mouse as switches: left is switch 1, right is switch 2 and middle is switch 3."),
            steps("F", [
                ["Pair the mouse. Click the left button a few times anywhere on the screen.", "The highlight moves, wherever the pointer is."],
                ["Click the right button.", "The highlighted item is chosen. On Android, record whether the right button instead acts as Back and leaves the app."],
                ["In “Your switches”, choose “Set a key” beside Switch 1 and press F on the keyboard. Then click the left mouse button.", "F now moves the highlight, and the left mouse button still does too."],
                ["Uncheck “Mouse buttons also act as switches”. Click the left button.", "Nothing happens. Check the box again with the switches."],
                ["Choose “Put back the starting keys”.", "F no longer acts as a switch; Space and Enter still do."],
                ["Set “Number of switches” to “Three switches”. Click the middle button.", "The highlight moves back one stop. Record whether the iPad sends the middle button."],
            ]),
            gap(),

            h1("Part G. Typing and the Screen"),
            steps("G", [
                ["Set “Number of switches” back to “Two switches”. Choose “In my own words”.", "The window opens and the highlight goes straight to the first row of keys."],
                ["Type “hel” with the switches.", "After each letter the highlight stays on that key for one stop, then goes back to the first row. The key in the Enter key’s place shows a suggested word."],
                ["Choose the suggestion key.", "The word is finished and a space added."],
                ["Move past the last row of keys.", "A dashed outline marked “Leave keyboard” surrounds the keyboard and sits exactly over it."],
                ["Leave the keyboard and choose “Speak”.", "The words are spoken and the window closes."],
                ["Open Settings, go to the Switch Access (in progress) tab, and choose the “Seconds per stop” drop-down.", "A list opens on the screen, scanned like everything else, with the current value marked."],
                ["Set “Number of switches” to “One switch”, confirming the red card if it appears. Time 10 stops with a stopwatch, with options arriving during the count if you can (a practice conversation helps).", "About 15 seconds, at 1.5 seconds per stop. Record the time and whether the highlight ever froze."],
                ["Turn the tablet to the other way up, if the app allows it.", "The highlight stays on the same button, in its new place."],
                ["In Settings > Text & Color, try “Dark” and “Yellow on black”.", "The highlight is easy to see in both."],
            ]),
            gap(),

            h1("Part H. Turning Switches Off"),
            steps("H", [
                ["Before this part, write down what “Keyboard for typing”, “One tap or two”, “Suggestions per category” and “Resume listening automatically after speaking a response” were set to before switches were turned on.", "Your notes from before Part B."],
                ["With the switches, set “Number of switches” to “None: I use touch”.", "Touch works again and the highlight disappears."],
                ["Check the four settings from H1.", "They are back to what they were before switch access was turned on."],
                ["Tap any drop-down in Settings open.", "The device’s own list marks the current value (a check mark on the iPad, a filled dot on Android). Record what you see."],
            ]),
            gap(),

            h1("When You’re Done"),
            para("Send me the filled-in plan. The failures and the steps marked “Record” decide what changes next. They settle whether “Act on release” is grayed out on the iPad and what the User Manuals say about the device’s own switch feature. They also show anything a switch user can’t get past without touch."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Switch Access Device Test Plan.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
