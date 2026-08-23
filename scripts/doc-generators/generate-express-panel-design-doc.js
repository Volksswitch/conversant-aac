/* Generates docPath("Conversant AAC Express Panel Design.docx") - how the Express
 * Panel varies with who the user is talking to and where they are, and why it has
 * no folders.
 *
 * WHY THIS EXISTS. Two questions arrived together on August 22 2026. Ken asked for a
 * design and plan for Express Panel content that is a function of partner, place, or
 * both. Somebody else asked whether the panel should support pages or folders. They
 * are the same question seen from two sides: both are answers to "there are more
 * things I want to say than there are buttons." One answers it by making the user
 * navigate; the other answers it by using what the app already knows. This document
 * settles which, and records the design.
 *
 * CHECKED AGAINST SHIPPED BEHAVIOR, August 22 2026:
 *   - The panel is one ordered list of typed items mapped 1:1 onto the cells of the
 *     paired keyboard layout. Position N in the list is cell N of the grid.
 *   - The partner, place and feeling toggles are items IN that list, so they occupy
 *     panel cells like any phrase.
 *   - Choice chips already claim the LEADING cells while a closed set is on offer,
 *     pushing the phrases along and dropping the last few off the end.
 *   - An item past the last cell of the layout is unreachable, not stored-for-later.
 *   - Tapping an undefined cell opens the editor for that cell, but not during a
 *     conversation.
 *
 * Run: node generate-express-panel-design-doc.js
 */
const { docPath } = require('./doc-paths');
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
            // ===== TITLE =====
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Express Panel Design", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "How the panel changes with the partner and the place — and why it has no folders", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  August 2026  |  Last updated August 23, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("Two questions arrived on the same day, and they turn out to be the same question. The first was ours: the panel of quick phrases should be able to change depending on who the user is talking to and where they are. The second came from a speech and language therapist: should the panel have pages or folders, so that some buttons open other buttons instead of speaking?"),
            para("Both are answers to one complaint — there are more things to say than there are buttons to say them with. The difference is where the work lands. Folders ask the user to build a filing system, remember it, and spend taps walking through it. Context asks the app to use what it already knows about the situation and put the right words on the panel before the user reaches for them."),
            para("This document takes a position on the second question, sets out the design for the first, and records what follows from both. It is a design, not a description: apart from one fix released on August 22 2026, none of it is built."),
            heading2("1.1 Words used here"),
            simpleTable(
                ["Term", "Means"],
                [
                    ["User", "The person using the app — the one who cannot speak"],
                    ["Partner", "The person on the other side of this conversation. Always that, never anybody else"],
                    ["People I Know", "The list of people the app holds. Some of them will be partners; some are only ever subjects of conversation"],
                    ["Button position", "One button-shaped space in the panel grid. How many there are, and how big, comes from the keyboard layout the user has chosen"],
                    ["Band", "A group of button positions that share a rule about when their contents change. Bands are a way of grouping positions, not a change to the grid"],
                ], W2),

            // ===== 2 =====
            heading1("2. What the Panel Is, and What It Is Not"),
            para("The app gives the user three ways to say something, and they are deliberately different from each other."),
            simpleTable(
                ["Route", "What it is good at", "What it costs"],
                [
                    ["Suggested response cards", "Almost anything, phrased for this moment, in the user's own voice. This is the product", "A pause while the AI answers, and the words are the machine's suggestion rather than the user's own"],
                    ["The Express Panel", "A small number of things said constantly, instantly, with no waiting and no reading", "It only holds what fits, and every phrase in it had to be put there by hand"],
                    ["In my own words", "Exactly what the user means, whatever it is", "It is the slowest thing in the app by a wide margin"],
                ], W3),
            emptyPara(),
            lead("The panel is the fast lane, not the vocabulary. ",
                "In a traditional AAC app the grid of buttons is the whole communication channel, so it has to hold everything a person might ever say, and folders are the only way to fit that on a screen. Here the grid is one of three routes and the narrowest of them. It exists for the handful of things that must be instant: yes, no, wait, help, thank you, the thing this user always asks for here. Breadth is the response cards' job."),
            para("That distinction is the reason the answer below comes out the way it does. If the panel is ever carrying enough vocabulary to need a filing system, something upstream has failed — either the response cards are not good enough, or the app is being used as a small traditional AAC device rather than as a conversation tool."),

            // ===== 3 =====
            heading1("3. Pages and Folders"),
            heading2("3.1 The decision"),
            lead("No folders, no pages, and no button whose job is to reveal other buttons. ",
                "The first reaction on being asked was that it sounded like a traditional AAC app and that the Express Panel is not trying to be one. That is right, but as phrased it reads as a matter of taste, and the next person to ask will simply disagree about taste. The grounds below are not taste."),
            heading2("3.2 Why not"),
            numBold("It puts a decision in front of the fastest thing in the app. ", "The panel's entire value is that a phrase is one tap away with nothing to think about. A folder makes the common case two taps, and the first of them is a choice: which folder is it in? For a user with limited motor control, a tap is not free — it costs effort and carries a real chance of hitting the wrong button.", "why"),
            numBold("It creates a mode, and modes strand people. ", "A panel that can be on page two can be left on page two. The user reaches for the button that has been in the same place for six months, and it is not there — mid-conversation, with somebody waiting. Note the qualifier, because it matters: this is an objection to a page that STAYS. A page that returns to the base panel by itself after one tap does not have this problem, which is exactly where section 3.4 ends up.", "why"),
            numBold("Nothing on the device says which page is showing. ", "The user has to look and read to find out, which is the cost the panel exists to avoid. Putting an indicator on screen, or a way back, spends button positions that could have held words.", "why"),
            numBold("A mis-hit on a folder button is a different kind of accident. ", "A stray tap on a phrase says one wrong word, which is recoverable and often not even noticed. A stray tap on a folder replaces the whole panel. This is the same reasoning that keeps the tap-to-define behavior out of conversations: a button whose consequence is structural does not belong next to buttons whose consequence is a word.", "why"),
            numBold("It gets much worse under scanning and eye gaze. ", "Direct select is today's access method, not the last one. Under scanning, every level of hierarchy multiplies the time to reach a phrase. Traditional AAC accepts that cost because it has no alternative; designing it in now means paying it hardest in the access methods we have not built yet.", "why"),
            numBold("Somebody has to build and maintain the filing system, and the partner-and-place work multiplies it. ", "This is the strongest of the objections. Editing the panel is already the least popular part of setting the app up. Folders add categories, names, and the question of where a phrase belongs. Then the design in section 5 arrives, and every folder is potentially a different folder for a different partner or place — so the filing system is not merely larger, there is a new one per situation, and the work already done may have to be redone.", "why"),
            numBold("The two mistakes are not equally reversible. ", "Refusing folders and being wrong costs a later feature. Shipping folders and being wrong costs taking something away from people who have already built their vocabulary inside it. When one direction is recoverable and the other is not, start with the recoverable one.", "why"),
            emptyPara(),
            lead("One ground that was claimed and is WRONG, recorded so it is not repeated: that folders break the keyguard. ",
                "They do not. A keyguard is a sheet of plastic with holes in it — a physical barrier, carrying no labels of its own — so as long as the grid keeps its shape it goes on working whatever the buttons underneath say. Paging changes what is behind the holes, not where the holes are. The objection is about the user knowing which page they are on and paying taps to get there, and it has to be argued on those grounds alone."),
            heading2("3.3 What the request is actually asking for"),
            para("The complaint behind it is not that a user's own phrases will not fit. It comes from experience with traditional AAC users in a largely transactional world. The partner asks what the user would like to eat, and the user needs access to every sweet or fruit or pudding they might name — which can be twenty items. The traditional device answers with a Food button that opens a page of twenty."),
            lead("The Conversant answer to that exchange is a different move: ask. ",
                "“What have you got?” hands the enumeration back to the partner, who lists what is actually available, and the app already turns a list the partner offers into buttons. Nobody had to author twenty foods, nothing goes stale when the menu changes, and the user is never offered something that is not there. The list arrives from the room rather than from a filing cabinet."),
            lead("The gap is the other direction, and it is real. ",
                "When the USER opens — “I need something to eat” — the partner's natural reply is “what would you like?”, and the user is back to needing the words. The answer is the same asking move one turn later: “what have you got?”, or better, a card that names the user's own preferences in the order they prefer them — “Have you got crackers, or a banana?” The About Me profile holds those preferences, so the response cards can carry them and the regenerate button can page through more. What none of that matches is the immediacy of a page of twenty for a user who already knows exactly which one they want. That residual is genuine, and it is an argument for making composition faster rather than for adding navigation to the panel."),
            simpleTable(
                ["What is wanted", "What it really is", "The answer"],
                [
                    ["Twenty foods when I am asked what I want", "A category the partner can already enumerate", "Ask them; their list becomes buttons (section 6)"],
                    ["Twenty foods when I raise it myself", "The same, one turn later, plus a preference list the app already holds", "Cards built from the user's own preferences, in preference order. Residual: less immediate than a page"],
                    ["More phrases than positions", "An overflow problem", "The Flex band, plus an honest cap (section 9)"],
                    ["A set I rarely use but must reach deliberately", "Not a folder. A named set that is summoned and leaves again", "Section 3.4, if it is ever needed at all"],
                ], W3),
            heading2("3.4 The one concession, if we ever need it"),
            para("There is a shape that serves the last row of that table without any of the costs above, and the app already uses it for something else. The rule for infrequent functions is that they become overlays rather than permanent fixtures, and the rule for an overlay is that it lines up with the same grid as the screen underneath, so one keyguard works for both. That is exactly what the on-screen keyboard does."),
            lead("So the concession would be a summoned overlay, not a folder. ",
                "One deliberate action brings up a full-screen set of phrases on the same grid; it leaves after one selection or on any dismissal; it never appears on its own, and no position in the base panel changes its meaning. Being an overlay in the ordinary sense of the word, it can be built once and staged rather than assembled each time it is shown. It is reached the way Settings is reached, not the way a folder is reached. This is not proposed for building — it is recorded so that if the need turns out to be real, we build the version that costs nothing rather than the version that costs the panel."),
            heading2("3.5 What would change the decision"),
            para("Stated in advance, so it is evidence that reopens this and not enthusiasm. If testers with a full panel and their Flex band in use are still routinely reaching for the composer to say things they say often, the panel is genuinely too small and the question is open again. If instead they are using a handful of positions and leaving the rest, then the shortage was never real."),

            // ===== 4 =====
            heading1("4. The Better Answer: Context Instead of Navigation"),
            para("The app already changes what is on the panel without anybody navigating anywhere. When the partner offers a choice — mild, moderate, or severe — those alternatives appear as buttons and then go away when the turn ends. Nobody had to file them, find them, or go back afterwards."),
            lead("That is the good version of a folder, and the difference is the trigger. ",
                "A folder is a place the user has to go. Context is a fact the app already has. Both put different words behind the same holes; only one of them asks the user to remember where anything is, to spend a tap, or to find their way back."),
            para("The app is about to know a great deal more about the situation. Today the user taps who the partner is and where they are, mainly so the AI can suggest better replies. Later the same facts will arrive on their own from voice and face recognition, from location, and from what the calendar says should be happening. Once those facts exist, using them to put the right phrases on the panel costs the user nothing at all — and unlike a filing system, the work goes down over time rather than up."),
            para("One more thing follows, and it matters for how the two are explained together. A folder is the user's own taxonomy: they build it, maintain it, and are the only one who understands it. Context is shared — the same signal that changes the panel also tells the AI who the partner is and what the setting is, so one act of setup improves both routes at once."),

            // ===== 5 =====
            heading1("5. The Design"),
            heading2("5.1 Three bands"),
            para("The grid does not change. Same number of button positions, same sizes, same places, so a keyguard cut today still fits. What changes is that the positions are grouped into three bands with different rules."),
            lead("What is happening to the panel, stated plainly: today's panel is SPLIT into always and occasionally, and a new band is INSERTED between the two halves. ",
                "That is worth saying because it makes the setup question for somebody already using the app a good one — which of these do you want everywhere, and which only with certain people or in certain places? The 32 items already on their panel are the starting material rather than something to be redone."),
            ...figure('ep-fig1.png', 820, 395, "Figure 1 — The three bands. Illustrative, at a 9x4 layout; the real grid comes from the keyboard layout the user has chosen."),
            simpleTable(
                ["Band", "What is in it", "Does it change?"],
                [
                    ["1. Always", "The words that must never move: yes, no, please, thank you, wait, help, the device notice", "Never"],
                    ["2. Context", "The buttons that never speak: partner, place, feeling, and whatever the partner has just put on the table", "Only while a choice or a number is on the table"],
                    ["3. Flex", "Phrases suited to the partner and the place currently selected. Takes whatever is left over", "Whenever a selection changes, and whenever either band above it is resized"],
                ], W3),
            emptyPara(),
            lead("The dividing line is speaking against influencing, and it is what makes the whole thing learnable. ",
                "A button in the Context band never says anything out loud — it tells the app who the partner is, where the user is, how they feel, or which alternative to focus on. Every other button on the panel speaks. That single sentence explains the layout to a supporter, and it is a safety property as well: a mis-hit in the Context band can never say something that cannot be taken back. It also explains something already true in the code that nobody had reasoned out — the offered choices ignore the double-tap safeguard, because that safeguard exists to guard speaking."),
            para("Feeling sits in the Context band because it never speaks, but it does not fill the Flex band. Only the partner and the place do that."),
            heading2("5.2 The order, which is by which band must not move"),
            para("The three are stacked in that order down the panel, and the reason is not that they are ranked by importance — it is that they are ranked by how badly each one needs to stay put."),
            bullet("ALWAYS is first, so nothing above it can ever shift it. Its whole value is that a fallback phrase is in the same place every single time, which is exactly what motor planning needs."),
            bullet("CONTEXT is next, so making it bigger or smaller leaves the Always band untouched. It is the band that most deserves the protection of being adjustable without side effects, because it is what steers the AI — the core of what the app is for — and what fills the band below it."),
            bullet("FLEX is last and takes the remainder, so it absorbs every change the other two make. That costs least there: its contents already change with the partner and the place, so a few positions arriving or leaving is the same kind of movement it lives with anyway."),
            emptyPara(),
            lead("The order has a third payoff that nobody planned, and it is worth recording because it would have bitten the other way round. ",
                "The compose key is in the LAST ROW of all 21 keyboard layouts — checked, not assumed. So putting the Flex band last makes the band that tolerates a ragged edge the one that has to flow around the compose key. Under any other order the Context band would have had to wrap it, and the Context band is the one with a hard floor of four positions and transient buttons at its front."),
            lead("The cost, accepted with the reasoning: on a bottom dock the easiest reach is the row nearest the hand, which under this order is the Flex band — the least essential of the three. ",
                "Ken's judgment is that bottom docks are squat enough that the distance from the bottom row to the top is small, and that the real travel problem on a bottom dock is side to side rather than top to bottom. That is the honest trade: the arrangement optimizes for nothing moving rather than for the shortest reach."),
            lead("Whether the Always band earns its space is an open question, and the bands are switchable. ",
                "It may turn out that the positions it holds are worth more to the Flex band. Turning a band off does NOT re-cut the keyguard — bands are a way of grouping positions, not a change to the grid, so the buttons stay exactly where and what size they were; only how many positions each band is allotted changes. That makes this an ordinary setting rather than a Setup-tier one."),
            heading2("5.3 What the partner puts on the table goes at the FRONT of the Context band"),
            para("When the partner offers a menu, those alternatives appear as buttons and leave again when the turn ends. They belong in the Context band by the test above: tapping one does not speak, it re-asks the AI about that alternative."),
            lead("The number button belongs there too, at the same place, for the same reason. ",
                "When the partner asks for a rating or a count rather than a choice between named things, one button appears that opens the number pad. It does not speak either — so it sits at the front of the Context band beside where the choices would go, rather than covering a phrase in the Flex band. A non-speaking transient must never displace a button that speaks."),
            ...figure('ep-fig2.png', 820, 296, "Figure 2 — A three-way choice arriving. Nothing that speaks has moved."),
            bullet("They take the FRONT of the band, not the end, and in solid color rather than a tint. The point is prominence: this is where the conversation is right now, and these buttons are both immediate and temporary. Everything else in that band is a standing selection that is not going anywhere."),
            bullet("Nothing is reserved for them. At rest those positions hold the partner and place toggles as usual; the choices cover them for one turn. The toggles should therefore be ordered so that the ones a user might want mid-conversation — feeling, most likely — sit last and stay uncovered."),
            bullet("The band cannot be narrower than four positions, because four is the most alternatives that will ever be shown. Below that, a four-way menu would have to drop one of the partner's own alternatives, and the standing rule is that those outrank anything the app added."),
            emptyPara(),
            lead("This corrected a fault that was already shipped, and it was released on August 22 2026 ahead of everything else here. ",
                "The choices used to take the leading positions of the WHOLE panel and push every phrase along, so a three-way menu moved every button two or three places for the duration of the turn and dropped the last few off the end. Confining them to one band fixes it. Measured in the running app: with three alternatives showing, no button position changed its size, shape or place."),
            heading2("5.4 How the Flex band is filled"),
            para("The obvious way to build the Flex band is a whole set per situation: one for Mom, one for the clinic, one for Mom at the clinic. It should not be built that way. Whole sets make the cost of every new situation the whole band, and they make the number of situations multiply — every partner against every place."),
            lead("Instead the user lists phrases in the order they are likely to want them, and the band is filled in that order. ",
                "A partner's phrases go in first, then the place's, then the general set, until the band runs out of room. Partner outranks place, and both outrank the general set, so the most specific thing the user has said about this situation is also the first thing they see."),
            ...figure('ep-fig3.png', 820, 428, "Figure 3 — Three ordered lists, filled in until the band is full."),
            para("Three things follow, and they are the whole argument for it."),
            bullet("Combinations mostly do not need to be made. The pharmacist the user happens to know needs no set of their own: the pharmacy supplies the transactional phrases, the partner supplies the personal ones, and the two run together in that order. A combined set becomes a rare deliberate exception rather than the unit of work."),
            bullet("No button can go blank. The general set always has more phrases than the room left over, so whatever is not claimed by the partner or the place is filled from it. A blank button is something the user cannot say, which is the same reason a response card is never allowed to come up empty."),
            bullet("Both kinds of nothing behave the same on the panel. Whether the partner is unset because it does not matter or because the user has not got round to it, the band fills from the general set and works. The difference matters only to the setup screens, which should prompt somebody who has never made a set and leave alone somebody who deliberately works without one. It makes no difference at all to the AI, which knows nothing about the partner either way."),
            heading2("5.5 The one ordering promise, and the idea that was dropped"),
            lead("What the user is promised is that the most likely phrase for this situation comes first. ",
                "That is all, and it is enough. It is a promise the user controls directly, by ordering their own lists, and it needs no vocabulary to explain: the phrase you reach for most goes at the top."),
            lead("An earlier draft of this document proposed something more elaborate and it was wrong. ",
                "The idea was that each position in the band would carry a fixed ROLE — position one is always the greeting, position two always their subject — so that the kind of thing at each position stayed constant while the words changed. It was over-engineered on two counts. It would have been hard for a user to specify, since it asks them to think in categories somebody else invented rather than about what they say. And it would have RESTRICTED them: a partner they have four things to say to and no fourth-role phrase for would have had a hole where a useful phrase could have gone. It also produced a tidy interleaving in the diagram that real use would not produce. Ordering by likelihood asks the user for something they already know and constrains them not at all."),
            para("What is given up is worth naming: positions are no longer stable across situations. A partner with three phrases and a partner with five push the general phrases to different places. That is a real cost against motor learning, and it is the weaker of the two spatial-stability requirements — the grid never moves, which is what a keyguard needs — so it is the right one to trade for phrases the user can actually reach."),
            heading2("5.6 What a band is made of: whole rows, or a number of buttons"),
            para("A band has so far been described as whole rows, which makes it a rectangle running the full width of the panel. That is tidy, and it is worth asking whether it is right, because it turns out to restrict what can go in a band far more than it looks — and unevenly."),
            para("A row is not a consistent quantity. Measured across the 21 layouts:"),
            simpleTable(
                ["Layout", "Button positions per row", "What that means for a one-row band"],
                [
                    ["Bottom Layout 3", "13, 13, 6", "The smallest band available is 6, the next size up is 13"],
                    ["Bottom Layout 2", "10, 10, 10, 2", "A Context band of one row is 2 positions — below the floor of four"],
                    ["Bottom Layout 1", "9, 9, 9, 5", "Sizes of 5 or 9, nothing between"],
                    ["Side Layout 6", "3, 3, 3 … 3, 2", "Fine granularity, but a band of any size needs many rows"],
                    ["Side Layout 2", "4 × 8, then 0", "The last row has no positions at all; a band there would be empty"],
                ], W3),
            emptyPara(),
            lead("So the same setting means 2 buttons on one layout and 13 on another, and the size somebody actually wants is often not expressible at all. ",
                "The compose key is what makes the last row erratic, and the last row is where the Flex band now sits."),
            lead("The alternative is to give a band a NUMBER of buttons rather than a number of rows, taken in reading order. ",
                "It is still contiguous, still one number per band, and it says the same thing on every layout — but a band may begin or end part-way along a row, so one row can show two bands. What is lost is the straight edge; what is gained is that the size asked for is the size received, that the compose key stops distorting anything, and that changing keyboard layout no longer silently resizes the bands."),
            para("Either way the Flex band is the remainder, so only two numbers are ever set. The prototype offers both, which is the way to settle it: the question is whether a band boundary falling mid-row looks wrong, and that is not answerable from a page."),
            heading2("5.7 Where the bands sit"),
            para("Each band has to be described in terms that survive the user changing their keyboard layout. Under whole rows that means a number of rows; under a count of buttons the number travels between layouts unchanged, which is one of the arguments for it. Section 10 explains why that distinction is load-bearing.")
,

            // ===== 6 =====
            heading1("6. Two Kinds of Choice, and How Each Is Answered"),
            para("The partner can put options on the table in two quite different ways, and they need different machinery. Writing both down here because the operational steps differ and neither is obvious from the other."),
            simpleTable(
                ["", "A short list of named options", "A range"],
                [
                    ["What it sounds like", "“Mild, moderate, or severe?”  “Tea, coffee, or juice?”  “Poor, fair, good, or excellent?”", "“On a scale of one to ten.”  “How many would you like?”"],
                    ["How many", "Two to four, almost always. Not because the partner cannot manage more — a doctor or a server says the same list a dozen times a day — but because the USER is hearing it for the first time and has to hold all of it at once to compare", "Any size. Nobody remembers a hundred values, and nobody has to: a scale is understood by its shape, and the user only has to place themselves on it"],
                    ["What the app does", "Each option becomes a button at the front of the Context band, and a card that answers with it appears in the response palette", "The composer opens on its number page. The user builds the number, sees it as they build it, and presses Enter to speak it"],
                    ["Where the user looks", "The conversation screen — cards and buttons", "The keyboard, which covers the panel while it is up"],
                    ["Still to build", "Nothing", "Nothing. Built August 22 2026"],
                ], W3),
            emptyPara(),
            lead("The display for a range already existed, which is why this was small. ",
                "“In my own words” has a text box and a Speak button, and the keyboard has a number page, so nothing new had to be designed — the composer simply opens in the right place. What was added is noticing that a number was asked for, one non-speaking button to open the pad, and Enter speaking the number while that surface is up. The suggested replies still appear as usual: most people answer a scale in words, and the pad is there for the user who wants to be exact."),
            para("Two small exceptions worth knowing. A scale whose points are words rather than numbers is a short list, not a range, and is already handled as one. And people do answer with halves — seven and a half out of ten — which the number page can produce but a set of buttons cannot."),

            // ===== 7 =====
            heading1("7. Setting It Up"),
            para("The panel is already edited by tapping a button in the live panel while Settings is open, which is the right shape and should carry over unchanged. Three things have to be added."),
            ...figure('ep-fig4.png', 820, 457, "Figure 4 - The editing surface. The bands are tinted so a button's band is obvious, and the line above says exactly what is being edited."),
            numBold("The scope being edited is stated, unmistakably. ", "Tapping a button in the Always band edits it for every situation; tapping one in the Flex band edits it for the partner and place currently selected. Somebody who believes they are editing their clinic phrases and is in fact editing everybody's has been misled — and the opposite mistake is worse, because it is silent: they add a phrase, then wonder for weeks why it is missing everywhere else.", "principles"),
            numBold("A new set starts as a copy, and ordering is the edit. ", "Make a set for this partner, starting from what is on screen now, offered at the moment the user thinks of it. The copy is small — only the Flex band — which is precisely why this makes setup workable where whole sets would not. Moving a phrase up or down its list is what decides how likely it is, and therefore where it lands.", "principles"),
            numBold("Nothing is required. ", "A user who never makes a single set has the panel they have today, working exactly as it does today. That is the out-of-the-box requirement, and it is met by making the unset situation the ordinary one rather than a special case.", "principles"),

            // ===== 8 =====
            heading1("8. When the App Works It Out for Itself"),
            para("Voice and face recognition, location, and calendar expectations will eventually supply the partner and the place without anybody tapping anything. Designing for that now costs almost nothing and prevents a rebuild, because what it needs are rules rather than machinery."),
            numBold("Recognition proposes; it does not command. ", "An automatic result sets the situation the same way a tap does, but the user's tap always wins and is always available.", "principles"),
            numBold("A recognized partner appears as a button whether or not one was ever made. ", "A partner the user has a button for simply lights up, and a wrong guess is corrected with the tap they already know. But most recognized partners will have no button — there is not room for everybody — so a recognized partner ARRIVES in the Context band the same way an offered choice does: a temporary button, already lit, that leaves when the conversation ends. That costs no setup, needs no new gesture, and makes the confirmation surface exist in the one case where it otherwise would not.", "principles"),
            numBold("The panel needs a higher bar than the AI does. ", "Getting the situation slightly wrong makes a suggested reply slightly off. Getting the panel wrong changes what is under somebody's fingers. Same signal, two different levels of confidence before acting on it.", "principles"),
            numBold("It must not chase a flickering answer, and clearing must stick. ", "Recognition will change its mind — two people in the room, the partner stepping away, a face half in frame. The panel must be slow to follow, must never follow it mid-conversation, and when the user deliberately clears a selection it must stay cleared for a while rather than being re-recognized on the spot.", "principles"),
            emptyPara(),
            lead("How long a selection lasts, today. ",
                "The partner and the feeling are cleared when the conversation ends. The place is not, and that is deliberate: a partner is a property of the conversation, but where you are is a property of the room, and ending a conversation does not move you. A cafe visit or a waiting room is several conversations in one place. The cost is that a place left selected after the user has moved goes on filtering the panel — which is visible, because the button stays lit, and is cleared by tapping it again.")
,

            // ===== 9 =====
            heading1("9. Overflow, Honestly"),
            para("A busy place will have more candidate phrases than the Flex band has positions. That is certain, and it is the situation that produced the folders question in the first place, so it needs a stated answer rather than a mechanism that hides it."),
            lead("The rule: the band holds what it holds. ",
                "The user orders the phrases, the band shows as many as it has positions for, and the editor says plainly that the rest are not reachable. This is the same answer already given for the panel as a whole, where an item past the last position is unreachable rather than stored for later, and it has the same virtue: the user is told the truth at the moment they can do something about it."),
            para("Paging within the band is the tempting alternative, and it is the wrong one for the same reasons as folders — a page turn puts a different word behind the same hole with nothing to say so. The honest cap is better than a hidden shelf."),
            lead("The Context band has this worse, and it is the one place the summoned overlay earns its keep. ",
                "A user with a dozen people and eight places cannot have a button for each, and unlike phrases there is no general set to fall back on — a partner with no button cannot be selected at all. Two things answer it together. Recognition brings a partner in as a temporary button, so the common ones need no permanent home. And picking from a long list is exactly the case section 3.4 describes: a deliberate action, used rarely, on a full-screen list that leaves again. It carries none of the objections to folders, because nothing in it speaks and no position on the base panel changes meaning."),

            // ===== 10 =====
            heading1("10. What Else This Touches"),
            para("These are the consequences that are easy to miss and expensive to discover late."),
            simpleTable(
                ["Area", "What happens", "What is needed"],
                [
                    ["Keyboard layout changes", "The panel maps onto the positions of whichever keyboard layout the user has chosen, and they can change it. A set remembered by position number scatters when the grid changes shape", "Describe each band by rows relative to the current layout, and decide what happens to a set made under a different one"],
                    ["Button colors", "Phrase colors today are chosen per phrase by the user and mean nothing shared, while taking seven swatches per row in the editor", "Decide whether to drop them in favor of one color per band. That would give color a meaning it does not currently carry and take a large piece of clutter out of setup. See section 12"],
                    ["Deleting a partner or a place", "Their phrases go with them, silently", "Nothing may remove a partner or place as a side effect of something else, and a deliberate deletion has to say what else is going. This has already gone wrong once, when clearing a relationship type destroyed the record it was attached to"],
                    ["Sounds like me", "The user's own phrases are evidence of how they talk, and are also the list of phrases the AI must never produce unprompted. Both are built from the panel", "Read every set, not just the one showing. A phrase used only with one partner is exactly the kind of thing that must not come out of the machine on its own"],
                    ["Practice Mode", "A rehearsal scenario has a partner and a setting by definition", "Set the situation from the scenario, or the user rehearses with the wrong buttons"],
                    ["Backup and transfer", "The panel is one file today", "More than one set has to survive export, import, and a folder copied between machines, and an old backup has to load without its sets"],
                    ["Measurement", "Nothing currently records which band a spoken phrase came from", "Record the band and the situation. It is a few characters a turn, and it is the only way to learn whether the flexible phrases get used or whether people fall back to the general set every time"],
                    ["The prototype", "prototypes/express-bands.html carries all 21 real layouts and both band shapes, and is not part of the app", "Re-run prototypes/refresh-layouts.mjs after any change to the real layouts. It takes the roles from the app's own panelRoles(), so it cannot hold a second opinion about which cell is which"],
                ], W3),

            // ===== 11 =====
            heading1("11. Build Order"),
            numBold("Confine the partner's offered choices — DONE, released August 22 2026. ", "A fault in what was already shipped rather than a piece of this design, and it depended on none of the rest. The choices used to claim the leading positions of the whole panel and push every phrase along, so a three-way menu moved every button three places and dropped the last few off the end. They now appear at the end of the panel; when the Context band exists they move again, to the front of it. Measured in the running app: no position changed size, shape or place.", "build"),
            numBold("A prototype of the bands — BUILT, August 23 2026. ", "prototypes/express-bands.html, outside app/ so it never deploys. It carries the app's real grid (all 21 keyboard layouts, geometry taken from the app itself), the real compose key, both band shapes, and a count of how many buttons that SPEAK changed when the situation did — which is the honest measure, since the Context band churns constantly by design and none of that costs anything. It has already answered two questions and raised one: a row is not a usable unit of band size, the Context band overflows at three people, and how big each band should be still wants a real panel in front of a real user.", "build"),
            numBold("Bands, filtering, and the escape. ", "The Flex band still driven only by the taps that exist today. This is the entire feature for a manual user, it is testable immediately, and it can ship before any set has been made because the unset case is the ordinary one.", "build"),
            numBold("Sets for partners and places, with copy-to-start. ", "The editing surface and the scope indicator, plus the rules about deletion.", "build"),
            numBold("Ranges — DONE, August 22 2026. ", "A scale or a count now produces one non-speaking button that opens the composer with the number keys showing, and Enter speaks the number. Independent of the bands, so it was built when it was asked for; when the Context band exists the button moves into it beside the offered choices.", "build"),
            numBold("Combined sets. ", "Only if real use shows that the partner-then-place fill order is not enough. It may never be needed.", "build"),
            numBold("Recognition. ", "Wired into the same proposal channel with the confidence and boundary rules from section 8. Nothing about the panel changes when this lands, which is the point of doing the rest in this order.", "build"),

            // ===== 12 =====
            heading1("12. What Remains Open"),
            numBold("Whether a band that reorders itself is tolerable at all. ", "The grid never moves, but a phrase can sit in a different place with a different partner. That is the weaker of the two stability requirements and the right one to trade, but only a real panel in front of a real user will say how it feels. Prototype first.", "open"),
            numBold("Whether phrase colors should become band colors. ", "Today's colors are picked per phrase by the user and carry no shared meaning, and the swatches are a large part of what makes the editor cluttered. Replacing them with one color per band would make color say something true and take a large piece of clutter out of setup. What is lost is a user who had been using color privately, and the fact that the same phrase would then look different depending on which band it sat in.", "open"),
            numBold("Whether a band is whole rows or a number of buttons. ", "Section 5.6. The measurements favor counts; what they cannot say is whether a band boundary falling part-way along a row looks wrong. Both are in the prototype.", "open"),
            numBold("How big each band should be. ", "The Context band has a floor of four positions and fills up at about three people. The Always band's size is an empirical question, and the best evidence will be what users add to the shipped set and what they never once tap. Band ORDER is settled — see section 5.2.", "open"),
            numBold("The third dimension. ", "What the calendar knows is neither a partner nor a place — it is an activity. Two dimensions are enough to build, but the way a situation is described should be able to take a third without being redone.", "open"),
            numBold("Whether a place should ever suggest phrases on its own. ", "The app knows facts about a place. Turning those into buttons would save setup and would also put words the user never chose onto the surface reserved for words the user did choose. The presumption is against it.", "open"),
            numBold("The residual on user-initiated requests. ", "Section 3.3 leaves one case genuinely less well served than a traditional Food page. Watch for it in real use; the fix is faster composition, not navigation.", "open"),
            numBold("Whether the general set should be user-ordered too. ", "It is filled last, so only its first few phrases are ever seen when a partner and a place are both selected. That may be fine, or it may mean the general list needs its own ordering pass in setup.", "open"),

            // ===== 13 =====
            heading1("13. The One-Paragraph Version"),
            para("The Express Panel is the fast lane, not the vocabulary — breadth is what the suggested response cards are for — so it does not need folders, and folders would cost it the three things it is good at: one tap, no thinking, and the same word in the same place every time. The real complaint underneath the folders question is that there are more things to say than there are buttons, and the better answer is to let the app use what it already knows. The grid never changes shape. The top band of it never changes at all. Below that sit the buttons that never speak — the partner, the place, the feeling, and whatever the partner has just put on the table — arranged so that resizing them cannot disturb the band above. The rest of the panel fills with phrases that suit the partner and the place, most likely first, and the general set backfills whatever is left so no button is ever blank. Within that band the user orders their own phrases by how likely they are to want them, so the first thing they see is the first thing they would reach for. Today the user says who and where by tapping; tomorrow the app will often know, and when it does it proposes rather than decides, never rearranges anything mid-conversation, and always leaves the user a tap back to the panel they know."),
        ]
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Express Panel Design.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
