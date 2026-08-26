/* Generates docPath("Conversant AAC Settings Defaults Review.docx").
 *
 * WHO THIS IS FOR (Ken, August 21 2026): the SLP team, so they can review every
 * setting the app ships with and propose the best out-of-the-box values. It is a
 * WORKSHEET, not an explainer — every table carries an empty column for them to
 * write in, and the job of the prose is only to say enough that the empty column
 * can be filled in sensibly.
 *
 * THREE RULES THIS DOCUMENT FOLLOWS, all of which shaped its layout:
 *
 *   1. NO ENGINEERING VOCABULARY. The readers are clinicians. No "storage",
 *      "prompt", "token", "backend", "provider", "grid cell", "index".
 *   2. EVERY DEFAULT IS STATED, and stated as the app actually behaves — every
 *      value below was read out of app/js/storage.js, app/index.html,
 *      app/js/express-items.js, app/js/control-phrases.js,
 *      app/js/placeholder-phrases.js and app/data/worldview-questions.json on
 *      August 21 2026, not recalled.
 *   3. WHAT IS NOT UP FOR REVIEW IS SAID PLAINLY AND ONCE. A worksheet that asks
 *      for an opinion on something individual (this person's phone number, their
 *      people, their places) wastes the reviewer's time and reads as though we
 *      did not think about it.
 *
 * The Settings tab structure mirrored here is the one after the August 21 2026
 * regrouping (tightly related settings share one expanding section). If the panel
 * is regrouped again, this document's Part 1 headings must move with it, or the
 * reviewers will be looking for sections that are not there.
 *
 * Run: node generate-settings-defaults-doc.js
 */
const { docPath } = require('./doc-paths');
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

// A write-in cell is shaded a very pale yellow so the reviewer can see at a glance
// which column is theirs, on screen and on paper alike.
const WRITE_IN = "FFFDE7";

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function para(text, after = 160) {
    return new Paragraph({ spacing: { before: 0, after }, children: [new TextRun(text)] });
}
function boldPara(label, text, after = 140) {
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
function cellPara(text, bold = false, italics = false) {
    return new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, bold, italics, font: "Arial", size: 20 })]
    });
}

/**
 * A worksheet table. `writeIn` is the list of column indexes the reviewer fills in;
 * those cells are shaded and left empty however many blank lines `blankLines` asks
 * for, so there is somewhere to write on a printed copy.
 */
function sheet(widths, headerRow, rows, writeIn = [], blankLines = 1) {
    const mk = (cells, isHeader) => new TableRow({
        tableHeader: isHeader,
        children: cells.map((text, i) => {
            const isWriteIn = !isHeader && writeIn.includes(i);
            const body = isWriteIn
                ? Array.from({ length: blankLines }, () => cellPara(''))
                : String(text).split('\n').map(line => cellPara(line, isHeader));
            return new TableCell({
                width: { size: widths[i], type: WidthType.DXA },
                margins: cellMargins,
                shading: isHeader ? { type: ShadingType.CLEAR, fill: "DCE6F1" }
                       : isWriteIn ? { type: ShadingType.CLEAR, fill: WRITE_IN }
                       : undefined,
                children: body
            });
        })
    });
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        borders,
        rows: [mk(headerRow, true), ...rows.map(r => mk(r, false))]
    });
}

function calloutBox(lines, fill = "E2EFDA", edge = "548235") {
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: edge },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: edge },
            left: { style: BorderStyle.SINGLE, size: 8, color: edge },
            right: { style: BorderStyle.SINGLE, size: 8, color: edge },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        rows: [new TableRow({ children: [new TableCell({
            width: { size: TABLE_W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill },
            margins: { top: 160, bottom: 160, left: 180, right: 180 },
            children: lines.map(({ label, text }, i) => new Paragraph({
                spacing: { before: 0, after: i === lines.length - 1 ? 0 : 120 },
                children: [
                    ...(label ? [new TextRun({ text: label, bold: true, font: "Arial", size: 22 })] : []),
                    new TextRun({ text, font: "Arial", size: 22 })
                ]
            }))
        })] })]
    });
}
function spacer(after = 160) { return new Paragraph({ spacing: { after }, children: [] }); }
function pageBreak() { return new Paragraph({ children: [], pageBreakBefore: true }); }

// ── column layouts ───────────────────────────────────────────────────────────
const W_SETTING = [1900, 2300, 1500, 1660, 2000];   // setting / choices / default / yours / why
const W_QUESTION = [4200, 1200, 900, 3060];         // question / answer / keep / notes
const W_CELL = [700, 3200, 1200, 4260];             // cell / current / kind / your suggestion
const W_PHRASE = [700, 4300, 4360];                 // # / current / your suggestion
const W_COUNT = [3400, 1400, 2000, 2560];           // what / now / how many / where

// ── Part 1 data (read from source, August 21 2026) ───────────────────────────
const YESNO = 'On / Off';
const FONT_CHOICES = 'Smaller / Default / Larger / Largest';

const TEXT_SIZE = [
    ['Response cards', FONT_CHOICES, 'Default'],
    ['Conversation', FONT_CHOICES, 'Default'],
    ['"In my own words"', FONT_CHOICES, 'Default'],
    ['Express Panel', FONT_CHOICES, 'Default'],
];

const SPEECH = [
    ['Hearing the other person', 'This browser\'s own (free)\nDeepgram (paid)', 'This browser\'s own'],
    ['Your speaking voice', 'This device\'s voices (free)\nDeepgram voice (paid)', 'This device\'s voices'],
    ['Which voice', 'Whatever voices the device has', 'Browser default'],
    ['Show this device\'s joke voices', YESNO, 'Off'],
    ['Practice partner voice', 'Auto, or a named voice', 'Auto (a voice that is not yours)'],
];

const BUTTONS = [
    ['Button size', 'A slider, 0 to 100', '50 (the middle)'],
    ['Button spacing', 'A slider, 0 to 100', '0 (buttons touch)'],
    ['Minimum spacing', 'A slider, 0 to 100', '0'],
    ['Keyboard for typing', 'My physical keyboard\nOn-screen keyboard', 'My physical keyboard'],
    ['Where the Express Panel and keyboard sit', 'Bottom of the screen\nSide of the screen', 'Bottom of the screen'],
    ['Which side (side only)', 'Left / Right', 'Right'],
    ['Layout', 'Eleven bottom layouts,\nten side layouts', 'Bottom Layout 1\n(Side Layout 1 if on a side)'],
];

const CONVERSATION = [
    ['Do not save my conversations', YESNO, 'Off (conversations are saved)'],
    ['Suggestions per category', '1 (four cards)\n2 (eight cards)', '1 (four cards)'],
    ['What a response card shows', 'The full response\nThe short version\nBoth, full larger\nBoth, short larger', 'Both, full response larger'],
    ['Most choice buttons in the Express Panel', '0 (off) / 2 / 3 / 4', '4'],
    ['Silence period', '0 to 3 seconds,\nin half seconds', '0.5 seconds'],
    ['Resume listening automatically after speaking', YESNO, 'Off'],
    ['Play a chime when listening starts', YESNO, 'On'],
    ['Placeholders: initial delay', '2 / 3 / 4 / 5 / 6 seconds', '2 seconds'],
    ['Placeholders: subsequent delay', '6 / 8 / 10 / 12 / 15 seconds', '10 seconds'],
    ['Placeholders: maximum per turn', '0 (none) / 1 / 2 / 3 / 4 /\nno limit', '2'],
    ['Speaking an Express Panel phrase', 'Single tap speaks it\nRequire a double tap', 'Single tap speaks it'],
    ['Double-tap interval', '0.3 / 0.4 / 0.6 / 0.8 /\n1 second', '0.4 seconds'],
];

const OTHER = [
    ['Use the whole screen', YESNO, 'Off'],
    ['Screen edge margin', 'A slider, 0 to 100', '0 (app reaches the screen edges)'],
    ['Keyboard separation', 'A slider, 0 to 100', '0'],
    ['Transcript separation', 'A slider, 0 to 100', '0'],
];

// ── Part 2 data: the About Me question bank ──────────────────────────────────
const REGISTRY = JSON.parse(fs.readFileSync(
    require('path').join(__dirname, '..', '..', 'app', 'data', 'worldview-questions.json'), 'utf8'));

// How an answer is given, said in words a clinician reads rather than a type name.
const ANSWER_KIND = {
    text: 'Typed',
    number: 'A number',
    choice: 'Pick one',
    multi: 'A list',
    repeat: 'A list of rows',
};

// Modules the SLP team is NOT being asked about, and why. Kept here rather than in
// prose so a module added later is either reviewed or deliberately excluded.
const SKIP_NOTE = 'The people in someone\'s life and the places they go are recorded elsewhere in About Me, one entry at a time. There is no "best" set of people or places to ship, so they are not part of this review.';

function moduleRows(mod) {
    return (mod.fields || []).map(f => [
        f.q,
        ANSWER_KIND[f.type] || f.type,
        '',
        ''
    ]);
}

// ── Part 3 data: the Express Panel starting layout ───────────────────────────
// Read from app/js/express-items.js. The list maps one-for-one onto the buttons of
// the chosen layout, so position 1 is the first button, and every layout but two
// offers 32 buttons.
const EXPRESS_CELLS = 32;
const EXPRESS_DEFAULTS = [
    ['Happy', 'Feeling'], ['Sad', 'Feeling'], ['Stressed', 'Feeling'],
    ['Curious', 'Feeling'], ['Tired', 'Feeling'], ['Excited', 'Feeling'],
    ['Yes', 'Phrase'], ['No', 'Phrase'], ['Okay', 'Phrase'],
    ['Please', 'Phrase'], ['Thank you', 'Phrase'], ['Sorry', 'Phrase'],
    ['Hi', 'Phrase'], ['Bye', 'Phrase'], ['Wait', 'Phrase'], ['Help', 'Phrase'],
    ['This device listens and speaks for me', 'Phrase'],
];

// ── Part 4 data: the words the app speaks ────────────────────────────────────
const OPENERS = [
    'Hi {name}, got a minute?',
    'Can I ask you something, {name}?',
    'Guess what, {name}.',
    'Hey {name}, how are you doing?',
    'Good to see you, {name}.',
    'How have you been, {name}?',
    'What\'s new with you, {name}?',
    'I was just thinking about you, {name}.',
    'Got a story for you, {name}.',
];
const WIND_DOWNS = [
    'I should get going.',
    'I need to head out.',
    'This was really nice, thanks.',
    'Great catching up with you.',
    'Anyway, I should let you go.',
    'It\'s been good seeing you.',
    'I should probably wrap up.',
    'I\'ve got to run soon.',
];
const CLOSINGS = [
    'Bye!', 'Take care!', 'See you later!', 'Let\'s talk again soon.',
    'Have a good day!', 'Talk soon!', 'Goodbye!', 'Catch you later.',
];
const SINGLE_PHRASES = [
    ['Hold on', 'Let me think about that.'],
    ['Ask them to repeat', 'Sorry, I didn\'t catch that. Could you say it again?'],
    ['Not yet, before you go', 'Actually, before you go —'],
];
const PLACEHOLDERS_FIRST = [
    'I\'m thinking about that.', 'Thinking that over.', 'I\'m thinking.', 'Working that out.',
];
const PLACEHOLDERS_LATER = [
    'Still thinking it through.', 'I\'m working out what I want to say.',
    'Putting my thoughts together.', 'Still mulling that over.', 'Just gathering my thoughts.',
];

function numbered(list, extraBlanks) {
    const rows = list.map((t, i) => [String(i + 1), t, '']);
    for (let i = 0; i < extraBlanks; i++) rows.push([String(list.length + i + 1), '', '']);
    return rows;
}

// ── the document ─────────────────────────────────────────────────────────────
const children = [];

// TITLE
children.push(new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: "Settings Defaults Review", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
}));
children.push(new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "A worksheet for the SLP team: what Conversant AAC should ship set to", color: "808080", size: 24, font: "Arial" })]
}));
children.push(new Paragraph({
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Last updated August 21, 2026", color: "808080", size: 20, font: "Arial", italics: true })]
}));

children.push(para("Conversant AAC arrives with every setting already set to something. Those starting values matter more than they look: most people change very few of them, and a new user meets the app entirely through the choices we made for them before they arrived. This worksheet lists every one of those choices so you can tell us which are right and which are not."));

children.push(calloutBox([
    { label: "How to use it. ", text: "Each table has a shaded column on the right for your recommendation. Leave it blank where you agree with what the app does now. Fill it in only where you would change something, and use the last column to say briefly why — the reason is worth as much to us as the value, because it tells us whether the setting is right for everyone or only for some people." },
]));
children.push(spacer());

children.push(heading1("What this worksheet does not ask you about"));
children.push(para("Some things in Settings have no best value, because the right answer is different for every person. They are listed here so it is clear they were considered rather than forgotten:"));
children.push(bulletBold("Anything personal to one user. ", "The AI key, where their information is kept, the people in their life, the places they go, their own name and details. These are entered once, per person."));
children.push(bulletBold("Anything set by the hardware. ", "The three spacing sliders on the Keyguard Design tab and the button size exist so a physical keyguard can be made to fit a particular tablet in a particular case. We have still listed them, in case you think the starting point is wrong, but expect them to be set per device."));
children.push(bulletBold("Anything only used to report a fault. ", "The Troubleshooting tab, and the version and cost information on the About tab."));
children.push(spacer());
children.push(para("Everything else is in scope, and there is a lot of it. If you only have time for part of this, Part 2 (which questions the app should ask) and Part 3 (the Express Panel it starts with) are where your judgment is hardest for us to substitute."));

// ── PART 1 ───────────────────────────────────────────────────────────────────
children.push(pageBreak());
children.push(heading1("Part 1 — The settings"));
children.push(para("These follow the tabs in the app, in order. Where a group of settings is only meaningful together, they are shown together."));

children.push(heading2("Text size"));
children.push(para("Four separate sizes, one for each part of the screen, so one area can be enlarged without the others. \"Default\" is the size the layout was designed around; the other three are roughly 15 percent smaller, 20 percent larger, and 45 percent larger."));
children.push(sheet(W_SETTING, ['Setting', 'Choices', 'Now set to', 'You would set', 'Why'], TEXT_SIZE, [3, 4], 2));
children.push(spacer());

children.push(heading2("Speech"));
children.push(para("How the app hears the other person, and the voice it speaks in. The free options use whatever the device itself provides and cost nothing. The paid options are a separate account the user opens themselves; they are better, and on an iPad the paid voice is the only good one available."));
children.push(sheet(W_SETTING, ['Setting', 'Choices', 'Now set to', 'You would set', 'Why'], SPEECH, [3, 4], 2));
children.push(spacer());
children.push(boldPara("A question worth your view: ", "should a new user be pointed at the paid voice from the start, or should they meet the app on the free one and be told later that a better voice exists?"));
children.push(spacer());

children.push(pageBreak());
children.push(heading2("Buttons and keyboard"));
children.push(para("Button size and spacing are sliders with no units — the user drags them until the buttons look right on their own screen. The middle of the button-size slider is the layout the app was designed around; dragging right makes every button bigger and takes the room from the conversation area above."));
children.push(para("The layout choice decides how the Express Panel and the typing keyboard are divided up: how many buttons in a row, and how many rows. There are eleven arrangements for the bottom of the screen and ten for the side. Layout 1 in each case puts the letters in plain alphabetical order."));
children.push(sheet(W_SETTING, ['Setting', 'Choices', 'Now set to', 'You would set', 'Why'], BUTTONS, [3, 4], 2));
children.push(spacer());
children.push(boldPara("A question worth your view: ", "the on-screen keyboard is currently off by default, so a user with no physical keyboard sees nothing to type on until someone turns it on. Should the app start with the on-screen keyboard instead?"));
children.push(spacer());

children.push(pageBreak());
children.push(heading2("Conversation"));
children.push(para("This is the tab that most changes what a conversation feels like. Four things are worth explaining before the table, because the values will not mean much otherwise."));
children.push(bulletBold("Silence period. ", "How long the other person has to stop talking before the app decides they have paused and asks the AI for suggestions. Shorter means suggestions arrive sooner; it also means the app asks more often while someone is still mid-sentence, which costs a little more but is not otherwise harmful."));
children.push(bulletBold("Suggestions per category. ", "The app always offers the same four kinds of response, in the same four places on the screen, so the user can learn where each kind sits. Setting this to 2 gives two of each kind — eight cards — rather than one."));
children.push(bulletBold("What a response card shows. ", "Every suggestion comes in two forms: the full sentence the app will speak, and a short label that is quicker to read. The card can show either or both."));
children.push(bulletBold("Placeholders. ", "Short holding phrases the app speaks while the user is choosing — \"I'm thinking about that\" — so the other person is not left in silence. The first one comes after the initial delay, then another after the subsequent delay, up to the maximum."));
children.push(spacer());
children.push(sheet(W_SETTING, ['Setting', 'Choices', 'Now set to', 'You would set', 'Why'], CONVERSATION, [3, 4], 2));
children.push(spacer());
children.push(boldPara("Two questions worth your view: ", "first, \"resume listening automatically\" is off, so the user presses Listen after every single exchange. Should it be on? Second, single tap speaks an Express Panel phrase immediately — for someone with unsteady hands, should the double tap be the starting point instead?"));
children.push(spacer());

children.push(heading2("Everything else"));
children.push(para("Two of these move the whole app around on the screen. If a physical keyguard is being made, changing either of them afterwards means cutting a new one, so they are set once at the start."));
children.push(sheet(W_SETTING, ['Setting', 'Choices', 'Now set to', 'You would set', 'Why'], OTHER, [3, 4], 2));

// ── PART 2 ───────────────────────────────────────────────────────────────────
children.push(pageBreak());
children.push(heading1("Part 2 — Which questions the app should ask"));
children.push(para("About Me is a getting-to-know-you questionnaire. Nothing in it is required, the user answers at their own pace, and the app works with none of it answered. But answering is physically tiring for the people this app is for, so every question we ask has to earn its place — and a question that is never worth asking is worse than no question at all."));
children.push(calloutBox([
    { label: "What we are asking you. ", text: "For each question: should it be there at all, and is it worded well? Mark the Keep column with a tick, a cross, or a question mark, and use the notes column for a better wording or for a question you think is missing. If a whole section should go, say so at its heading and skip the rows." },
], "FFF2CC", "BF8F00"));
children.push(spacer());
children.push(para(SKIP_NOTE));
children.push(spacer());
children.push(boldPara("How answers are given. ", "\"Typed\" means a free text box. \"Pick one\" offers a short list of set answers. \"A list\" lets the user name as many things as they like. Every question can also be answered \"prefer not to say\", which is permanent — the app never asks again and never guesses."));

for (const mod of REGISTRY.modules) {
    children.push(heading2(`${mod.title}`));
    if (mod.note) children.push(new Paragraph({
        spacing: { before: 0, after: 140 },
        children: [new TextRun({ text: mod.note, italics: true, color: "555555" })]
    }));
    children.push(sheet(W_QUESTION, ['Question, as the app asks it', 'Answer', 'Keep?', 'Better wording, or notes'],
                        moduleRows(mod), [2, 3], 2));
    // A full-width write-in row per section, so a missing question can be added where
    // it belongs rather than in a lump at the end.
    children.push(sheet([TABLE_W], ['A question you would add to this section'],
                        [['']], [0], 2));
    children.push(spacer());
}

// ── PART 3 ───────────────────────────────────────────────────────────────────
children.push(pageBreak());
children.push(heading1("Part 3 — The Express Panel it starts with"));
children.push(para("The Express Panel is the grid of buttons along the bottom of the screen (or down one side). It is the part of the app the user reaches for without thinking, and it is entirely theirs to change — but what it holds on day one is ours to choose, and most people will keep a good deal of it."));
children.push(para(`With the layout the app starts on there are ${EXPRESS_CELLS} buttons, plus a fixed "In my own words" button that is always in the same place and cannot be changed. Seventeen of the ${EXPRESS_CELLS} come filled in. The rest are deliberately left empty: a full grid looks finished and invites nobody to make it their own, while an empty grid looks broken. Half-filled is the compromise, and a blank button is an invitation — tapping one opens the editor at that exact position.`));
children.push(spacer());

children.push(heading2("The four kinds of button"));
children.push(bulletBold("Phrase. ", "Speaks aloud when tapped. Most buttons are these."));
children.push(bulletBold("Feeling. ", "Does not speak. It tells the AI what mood the user is in, so the suggestions lean that way. One at a time; tapping it again turns it off."));
children.push(bulletBold("Partner. ", "Does not speak. It says who the user is talking with, which personalizes the conversation starters and tells the AI who is there."));
children.push(bulletBold("Place. ", "Does not speak. It says where the user is, so the AI knows the setting — a coffee shop, a clinic — without needing location tracking."));
children.push(spacer());
children.push(para("Feeling, Partner and Place are the three that shape what the AI suggests rather than saying anything themselves. How many of each should be on the panel to begin with, and where they should sit, is one of the main things we want your view on."));
children.push(spacer());

children.push(sheet(W_COUNT,
    ['Buttons that shape the suggestions', 'On the panel now', 'How many should there be', 'Where should they sit'],
    [
        ['Feeling', '6', '', ''],
        ['Partner', '0', '', ''],
        ['Place', '0', '', ''],
    ], [2, 3], 2));
children.push(spacer());
children.push(boldPara("Why Partner and Place start empty: ", "there is nothing general to put in them — a Partner button carries a real person's name and a Place button a real place. If you think the app should still reserve room for them so the user can see the idea exists, say how many and where."));
children.push(spacer());
children.push(boldPara("Why Feeling comes first: ", "the six feelings lead the panel so the idea of a button that shapes suggestions rather than speaking is visible straight away. If you would rather the everyday phrases came first, say so."));

children.push(pageBreak());
children.push(heading2("The starting grid, button by button"));
children.push(para("Buttons are numbered in the order they appear: on the bottom layout the app starts with, buttons 1 to 9 are the top row, 10 to 18 the second, 19 to 27 the third, and 28 to 32 the bottom row around the \"In my own words\" button. Write your suggestion beside any you would change, and fill in as many of the empty ones as you think are worth filling."));
children.push(spacer());

const gridRows = [];
for (let i = 0; i < EXPRESS_CELLS; i++) {
    const d = EXPRESS_DEFAULTS[i];
    gridRows.push([String(i + 1), d ? d[0] : '— empty —', d ? d[1] : '', '']);
}
children.push(sheet(W_CELL, ['Button', 'What it says now', 'Kind', 'Your suggestion (and which kind)'],
                    gridRows, [3], 1));
children.push(spacer());
children.push(boldPara("One thing to know before you fill in the empty ones: ", "the buttons run in a straight sequence, so adding one pushes every later button along by one place. If you care about a particular phrase sitting in a particular spot, say so — the positions people learn by touch are worth protecting."));

// ── PART 4 ───────────────────────────────────────────────────────────────────
children.push(pageBreak());
children.push(heading1("Part 4 — The words the app puts in someone's mouth"));
children.push(para("These are the fixed phrases the app ships with. Unlike the AI's suggestions, which are written fresh each time, these are the same words every day, spoken in the user's own voice to real people. Wording matters more here than anywhere else in the app, and this is squarely your expertise rather than ours."));
children.push(para("All of them can be edited by the user, and the app offers more of each than fit on screen at once — it shows the first four and pages through the rest — so the order is worth your attention as well as the wording."));
children.push(spacer());

children.push(heading2("Single phrases"));
children.push(para("Each of these belongs to one button, so there is exactly one wording."));
children.push(sheet(W_PHRASE, ['Button', 'What it says now', 'Your suggestion'],
                    SINGLE_PHRASES.map(([a, b]) => [a, b, '']), [2], 2));
children.push(spacer());

children.push(heading2("Conversation starters"));
children.push(para("Offered when the user starts a conversation rather than answering one. Where a starter says {name} the app puts in the name of whoever is on the Partner button, and drops it neatly when nobody is set."));
children.push(sheet(W_PHRASE, ['#', 'What it says now', 'Your suggestion'], numbered(OPENERS, 3), [2], 1));
children.push(spacer());

children.push(pageBreak());
children.push(heading2("Winding down"));
children.push(para("Offered when the user taps Wind down. These signal that they are ready to finish without actually saying goodbye — the goodbyes come after, as a separate step, which is how conversations end when two people can speak."));
children.push(sheet(W_PHRASE, ['#', 'What it says now', 'Your suggestion'], numbered(WIND_DOWNS, 3), [2], 1));
children.push(spacer());

children.push(heading2("Goodbyes"));
children.push(para("Offered after a winding-down phrase has been spoken, and also when the other person is the one starting to end the conversation."));
children.push(sheet(W_PHRASE, ['#', 'What it says now', 'Your suggestion'], numbered(CLOSINGS, 3), [2], 1));
children.push(spacer());

children.push(pageBreak());
children.push(heading2("Placeholders"));
children.push(para("Spoken while the user is choosing a response, so the other person is not left in silence. The app picks one at random. Three rules already govern these, and any replacement has to meet them too:"));
children.push(bulletBold("They must fit after anything. ", "The app does not know whether the other person asked a question, told a story or said hello, so a phrase like \"Good question\" cannot be used."));
children.push(bulletBold("They must not sound like an answer. ", "\"Okay\" was removed because the other person heard it as the actual reply to a greeting rather than as a pause."));
children.push(bulletBold("They must not instruct the other person. ", "\"Hold on\" and \"Give me a second\" read as curt through a flat synthetic voice. Everything here says what the user is doing, not what the other person should do."));
children.push(spacer());
children.push(para("The first one spoken after a pause:"));
children.push(sheet(W_PHRASE, ['#', 'What it says now', 'Your suggestion'], numbered(PLACEHOLDERS_FIRST, 2), [2], 1));
children.push(spacer());
children.push(para("Later ones, if the user is still choosing:"));
children.push(sheet(W_PHRASE, ['#', 'What it says now', 'Your suggestion'], numbered(PLACEHOLDERS_LATER, 2), [2], 1));

// ── closing ──────────────────────────────────────────────────────────────────
children.push(pageBreak());
children.push(heading1("Anything we did not ask"));
children.push(para("If something about the way the app arrives struck you and there was no row for it, this is the place. A setting that should exist and does not counts, as does a setting that should not be a setting at all because there is only one sensible answer."));
children.push(spacer());
children.push(sheet([9360], ['Your notes'],
    [[''], [''], [''], [''], ['']], [0], 3));

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
            children: [new TextRun({ text: "Conversant AAC — Settings Defaults Review", italics: true, color: "808080", size: 18, font: "Arial" })]
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
        children
    }]
});

Packer.toBuffer(doc).then((buf) => {
    const out = docPath("Conversant AAC Settings Defaults Review.docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out + " (" + Math.round(buf.length / 1024) + " KB)");
    const questions = REGISTRY.modules.reduce((n, m) => n + (m.fields || []).length, 0);
    console.log("  About Me modules: " + REGISTRY.modules.length + ", questions: " + questions);
    console.log("  Express Panel: " + EXPRESS_DEFAULTS.length + " filled of " + EXPRESS_CELLS);
});
