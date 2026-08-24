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
 *   - Choice chips were confined to the end of the panel on August 22 2026; they no
 *     longer push the phrases along. They still carry a dashed border, and the number
 *     button still reads 1-10 when the ends are known - both corrections are recorded
 *     in section 5.3 and neither is built.
 *   - An item past the last cell of the layout is unreachable, not stored-for-later.
 *   - Tapping an undefined cell opens the editor for that cell, but not during a
 *     conversation.
 *
 * SECOND PASS, August 23 2026. Ken's administration proposal and the exchange around
 * it are folded in: how the band sizes are set and what happens when Always is squeezed,
 * the unconditional floor of four and the July decision it reverses, the offered choices
 * moving to the FAR end of the Context band, the four situational lists and the single
 * mechanism that makes them, the whole Settings tab in section 7, and the shipped
 * starting set that replaces the hand-delivered panel file.
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
            para("This document takes a position on the second question, sets out the design for the first, and records what follows from both."),
            lead("IT IS BUILT. Released in version 0.8.0 on August 24 2026, so this describes the app rather than proposing it. ",
                "The reasoning is kept in full, because the reasoning is what stops a settled decision being re-argued and is the reason anyone would read this again. Where the build settled something differently from the plan, the plan's version is retracted in place rather than deleted — a decision quietly removed is a decision somebody re-derives."),
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
            ...figure('ep-fig1.png', 820, 447, "Figure 1 — The three bands. Illustrative, at a 9x4 layout; the real grid comes from the keyboard layout the user has chosen."),
            simpleTable(
                ["Band", "What is in it", "Does it change?"],
                [
                    ["1. Always", "The words that must never move: yes, no, please, thank you, wait, help, the device notice. More may be listed than fit; the rest go to the END of the Flex band, and only if there is room left there", "Never"],
                    ["2. Context", "The buttons that never speak: partner, place, feeling, and whatever the partner has just put on the table", "Only while a choice or a number is on the table"],
                    ["3. Flex", "Phrases suited to the partner and the place currently selected. Any room still spare at the end goes to Always phrases that did not fit above", "Whenever a selection changes, and whenever either band above it is resized"],
                ], W3),
            emptyPara(),
            lead("The dividing line is speaking against influencing, and it is what makes the whole thing learnable. ",
                "A button in the Context band never says anything out loud — it tells the app who the partner is, where the user is, how they feel, or which alternative to focus on. Every other button on the panel speaks. That single sentence explains the layout to a supporter, and it is a safety property as well: a mis-hit in the Context band can never say something that cannot be taken back. It also explains something already true in the code that nobody had reasoned out — the offered choices ignore the double-tap safeguard, because that safeguard exists to guard speaking."),
            para("Feeling sits in the Context band because it never speaks, but it does not fill the Flex band. Only the partner and the place do that."),
            lead("Inside the Context band the three kinds are kept together and always in the same order: partners, then places, then feelings. ",
                "The user orders within each run and cannot interleave them. That is worth the small loss of freedom because it is what lets somebody find a partner button without reading the whole band, and because it makes the far end of the band predictable — which section 5.3 then relies on."),
            lead("One background color per band, and the band is what the color says. ",
                "Every button in a band shares its background, so the three bands are told apart at a glance without reading anything. Inside the Context band the KIND of button — partner, place, feeling — is said by a mark rather than by a different fill, because three different fills there made the feeling buttons look like the alternatives a partner had offered."),
            para("There is one exception, and it is an exception on purpose: what the partner has just put on the table breaks its band's color, because it is immediate and temporary and should be the thing the eye lands on. The offered alternatives and the number button share that treatment exactly — same solid fill, no special edge on either. They live for one exchange and they read as one kind of thing, which is what they are. The number button is labeled 123 whether or not the partner named the ends of the scale: it opens a number pad, and a label reading 1-10 promises a row of ten buttons that is deliberately not what appears."),
            lead("One thing is NOT available for any of this, and it comes from the app as it stands rather than from preference. ",
                "A ring around a button already means SELECTED and cannot be borrowed to mean something else. A dashed border used to be spoken for as well — it said the partner had just put this on the table — but that treatment is retired here in favor of the solid fill, so a dashed edge is free again."),
            heading2("5.2 The order, which is by which band must not move"),
            para("The three are stacked in that order down the panel, and the reason is not that they are ranked by importance — it is that they are ranked by how badly each one needs to stay put."),
            bullet("ALWAYS is first, so nothing above it can ever shift it. Its whole value is that a fallback phrase is in the same place every single time, which is exactly what motor planning needs."),
            bullet("CONTEXT is next, so making it bigger or smaller leaves the Always band untouched. It is the band that most deserves the protection of being adjustable without side effects, because it is what steers the AI — the core of what the app is for — and what fills the band below it."),
            bullet("FLEX is last, so it absorbs every change the other two make. That costs least there: its contents already change with the partner and the place, so a few positions arriving or leaving is the same kind of movement it lives with anyway."),
            emptyPara(),
            lead("The order has a third payoff that nobody planned, and it is worth recording because it would have bitten the other way round. ",
                "The compose key is in the LAST ROW of all 21 keyboard layouts — checked, not assumed. So putting the Flex band last makes the band that tolerates a ragged edge the one that has to flow around the compose key. Under any other order the Context band would have had to wrap it, and the Context band is the one with a hard floor of four positions and transient buttons at its far end."),
            lead("The order has a fourth payoff that matters more as the Context band grows. ",
                "Because Always is first, making the Context band bigger cannot move a single Always button — only the boundary behind them travels. The band that must not move is the one band that structurally cannot be pushed, which is the whole return on the ordering rule and is not obvious from the rule itself. Growing Context shortens the Always band from its bottom end, so the Always buttons that remain are exactly where they were — the band simply stops sooner. Nothing the user has learned changes place. Taken far enough this becomes a real cost rather than a free one, since always-phrases start dropping off; that is a problem to address if it ever arrives, and it largely disappears once the app recognizes partners and places for itself, since the buttons that would have made the band large are then supplied automatically."),
            lead("The cost, accepted with the reasoning: on a bottom dock the easiest reach is the row nearest the hand, which under this order is the Flex band — the least essential of the three. ",
                "Ken's judgment is that bottom docks are squat enough that the distance from the bottom row to the top is small, and that the real travel problem on a bottom dock is side to side rather than top to bottom. That is the honest trade: the arrangement optimizes for nothing moving rather than for the shortest reach."),
            lead("Turning a band off does NOT re-cut the keyguard. ",
                "Bands are a way of grouping positions, not a change to the grid, so the buttons stay exactly where and what size they were; only how many positions each band is allotted changes. That makes band sizing an ordinary setting rather than a Setup-tier one, which is what makes it safe to put beside the other things the user experiments with."),
            lead("The Always band's floor is ZERO, and a panel with nothing in it that speaks is a legitimate panel. ",
                "It looked at first as though Always needed a minimum — enough for yes, no and help — on the grounds that a panel with no speaking buttons is not a panel. That is wrong twice over. A panel given over entirely to steering the AI is a very important panel, and it is arguably the more advanced way to use the app. And the phrases are not lost in any case: an Always list that has no band to sit in continues into the Flex band, so yes, no and help turn up there in whatever room the partner and the place have not claimed."),
            heading2("5.3 What the partner puts on the table goes at the FAR END of the Context band"),
            para("When the partner offers a menu, those alternatives appear as buttons and leave again when the turn ends. They belong in the Context band by the test above: tapping one does not speak, it re-asks the AI about that alternative."),
            lead("The number button belongs there too, at the same place, for the same reason. ",
                "When the partner asks for a rating or a count rather than a choice between named things, one button appears that opens the number pad. It does not speak either — so it sits in the Context band beside where the choices would go, rather than covering a phrase in the Flex band. A non-speaking transient must never displace a button that speaks."),
            ...figure('ep-fig2.png', 820, 435, "Figure 2 — A three-way choice arriving at the far end of the Context band. Nothing that speaks has moved."),
            bullet("They take the FAR END of the band, and in solid color rather than a tint. Solid fill is what carries the prominence — this is where the conversation is right now, and these buttons are both immediate and temporary, where everything else in that band is a standing selection that is not going anywhere."),
            bullet("The far end rather than the front, and the fixed order inside the band is what decides it. Partners come first, places next, feelings last, so the far end IS the feelings run. Ken's expectation is that feelings will be the least used thing on the panel, because the right default set of feelings is very hard to guess at, while partners will be the most learned. So covering the far end covers the cells that matter least and never covers the ones the user knows best. An earlier draft put them at the front, which had the merit of prominence and the defect of hiding exactly the wrong buttons."),
            bullet("The band cannot be narrower than four positions, because four is the most alternatives that will ever be shown. Below that, a four-way menu would have to drop one of the partner's own alternatives, and the standing rule is that those outrank anything the app added."),
            emptyPara(),
            lead("The floor of four applies whether or not the user has put anything in the band, and the reason is the strongest argument for the floor. ",
                "If the band could collapse to nothing when there was nothing to put in it, then a menu arriving would have to conjure four positions out of nowhere and the panel would change shape in the middle of a conversation. That is the one thing that must never happen. Four reserved positions sitting empty is the price of the panel never moving, and it is a price worth paying because the alternative is paid at the worst possible moment."),
            lead("A RESERVED CELL NAMES ITSELF (Ken, August 23 2026), which is what makes the floor tolerable to look at. ",
                "Four empty outlines read as something the user forgot to fill in. The last four positions of the band therefore say “Choice button #1” and so on in muted lettering until a choice arrives — space that is spoken for rather than space that is missing. ONLY the last four are labeled: any other empty Context cell is genuinely free and must keep looking free. They stay tappable to define, since at rest they can hold a partner, place or feeling like any other cell in the band, and the accessible name says both things."),
            lead("This reverses a decision taken in July 2026, and the reversal is deliberate rather than an oversight. ",
                "That decision said the offered choices get no standing reservation — with no menu on offer the panel was to be exactly the phrase grid it had always been, because reserving cells that sit blank most of the time is a poor trade. It was right at the time and the trade has since changed: under bands those positions have a resting job, holding the partner, place and feeling buttons, so they are only blank for a user who has defined none of them. The reservation now costs almost nothing and buys a panel that cannot change shape mid-conversation."),
            emptyPara(),
            lead("This corrected a fault that was already shipped, and it was released on August 22 2026 ahead of everything else here. ",
                "The choices used to take the leading positions of the WHOLE panel and push every phrase along, so a three-way menu moved every button two or three places for the duration of the turn and dropped the last few off the end. Confining them to one band fixes it. Measured in the running app: with three alternatives showing, no button position changed its size, shape or place."),
            lead("Two smaller corrections to what is shipped, both recorded here and neither built yet. ",
                "The number button reads 1-10 when the partner named both ends of the scale, and it should read 123 in every case — the label is a promise about what the button does, and what it does is open a number pad. And both the offered choices and the number button carry a dashed border today, which was meant to say temporary; the solid fill already says that, and the two should differ from each other in nothing at all, since they are the same kind of thing and live for the same single exchange."),
            heading2("5.4 How the Flex band is filled"),
            para("The obvious way to build the Flex band is a whole set per situation: one for Mom, one for the clinic, one for Mom at the clinic. It should not be built that way. Whole sets make the cost of every new situation the whole band, and they make the number of situations multiply — every partner against every place."),
            lead("Instead the user lists phrases in the order they are likely to want them, and the band is filled in that order. ",
                "The situational lists fill the Flex band, most specific first, until it runs out of room. The Always list has nothing to do with this: it fills its own band, and if it is longer than that band the surplus waits at the BACK of the queue. It takes positions at the very end of the Flex band, and only if the situational lists have not already claimed them. An always-phrase can never push a situational phrase off the panel."),
            para("There are four situational lists, and they are ranked from most specific to least:"),
            bullet("This partner in this place — Mom at the clinic."),
            bullet("This partner anywhere — Mom."),
            bullet("Anyone in this place — the clinic."),
            bullet("Anyone, anywhere — the general list, which backfills whatever is left."),
            emptyPara(),
            lead("All four are made by the same mechanism, which is what keeps this from becoming four features. ",
                "The user picks a partner and a place from two lists, each of which offers Anyone and Anyplace as well as the people and places they have entered. Anyone plus Anyplace IS the general list; Mom plus Anyplace is the partner list; Anyone plus the clinic is the place list. There is nothing special about a combination — it is simply the case where neither list is left on its default."),
            lead("A phrase that appears in more than one list is shown once, at its best position. ",
                "Otherwise a phrase the user sensibly put in both Mom's list and the general list would occupy two positions on a panel that is already short of them."),
            ...figure('ep-fig3.png', 820, 540, "Figure 3 — Three ordered lists, filled in until the band is full."),
            para("Three things follow, and they are the whole argument for it."),
            bullet("Combinations mostly do not need to be made. The pharmacist the user happens to know needs no list of their own: the pharmacy supplies the transactional phrases, the partner supplies the personal ones, and the two run together in that order. A combination is available for the case where the two together call for something neither does alone, and it stays a rare deliberate exception rather than the unit of work."),
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
            lead("The arithmetic survives either answer, and an earlier draft overstated this. ",
                "What changes between the two is the step size of the control and nothing else. Under a count of buttons the plus and minus move one position at a time. Under whole rows they move a whole row at a time, which on a bottom dock may be the difference between nine positions and eighteen. The one rule that has to be restated is the Context band's floor: four is a count, and under whole rows it becomes at least one row, or two rows wherever a row is narrower than four."),
            lead("It should be a setting rather than a decision. ",
                "There is no best answer here — whether a boundary falling part-way along a row looks wrong is a matter of taste, and only the person looking at the panel every day can settle it. That is the same reasoning the app already applies everywhere else, where behavior is a default of the standard profile rather than a rule. So both shapes ship, the prototype's job is to say which should be the DEFAULT, and the user can change it while watching their own phrases move."),
            heading2("5.6a How the sizes are set"),
            lead("Two numbers are set and the third is what is left. ",
                "The user sets the size of the Context band, which cannot go below four, and the size of the Flex band, which starts at none. The Always band takes everything that remains after those two and the compose key. That makes the out-of-the-box panel almost exactly today's panel: no Flex band, a small Context band, and everything else given over to phrases that never move."),
            lead("⚠ A ROW MEANS A ROW OF BUTTONS, not a row of the layout — found in testing, not in the design. ",
                "Two of the side layouts end in a row holding only the compose key and no button positions at all. Counting it meant a two-row Context band spent one of its rows on nothing: Ken asked for two rows, watched one row appear, and was told two buttons did not fit. The user is counting rows of BUTTONS, because that is what a row of the panel looks like, so the arithmetic counts the same thing and an empty row belongs to no band."),
            lead("⚠ AND THE FLOOR OF FOUR IS MADE UP BY WHOLE ROWS, not by borrowing cells from the row above. ",
                "Borrowing left a row that was half Always and half Context — a ragged edge in the one mode the user chose FOR its straight edge. The band takes the whole row, from Always above and never from Flex below. Checked across all 21 shipped layouts rather than a sample: every one has at least four Context positions at a setting of one row, and no row holds two bands. A sample is how the compose-only row was missed twice."),
            lead("Growing the Context band comes out of the Always band, and the displaced phrases have somewhere to go but no claim on it. ",
                "Always is the remainder, so making Context bigger shortens it from the bottom. The phrases that no longer fit are not thrown away: they queue for whatever is still spare at the end of the Flex band. But they queue LAST, behind everything the partner and the place have supplied, so they take only genuinely unclaimed positions and a situational phrase is never displaced by one. If there is no spare room, they are simply not shown, and the editor says so."),
            lead("That gives the ordering its final shape, and it is worth stating once in full. ",
                "The Flex band is filled by the four situational lists, most specific first. Anything still spare at the end of it is filled from the Always surplus. So the general list and the Always surplus between them make a blank button very unlikely, and the phrases the user marked as needed everywhere are the last thing to be dropped rather than the first."),
            heading2("5.7 Where the bands sit"),
            para("Each band has to be described in terms that survive the user changing their keyboard layout. Under whole rows that means a number of rows; under a count of buttons the number travels between layouts unchanged, which is one of the arguments for it. Section 10 explains why that distinction is load-bearing."),
            lead("Changing the grid is NOT a one-time setup act, and the design has to assume it is not. ",
                "The expectation is that a user will rethink which keyboard layout they are on repeatedly — while they are playing with the band sizes, and again later as they add people and places to the Context band and find it wants more room. So the choice of grid belongs on the same screen as the band settings, where it can be tried against real phrases without navigating anywhere. Section 7 places it accordingly.")
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
            para("All of it lives on one Settings tab, in one order, with the live panel beside it reflecting every change as it is made. The panel is already edited by tapping a button in the live panel while Settings is open, and that stays - tapping a button selects its entry in whichever list holds it, which is how a phrase gets edited in the position the user actually wants it rather than typed into a list and then shuffled until it lands there."),
            heading2("7.1 The order of the tab, and why it is that order"),
            numBold("The grid. ", "Which keyboard layout, whether the dock sits at the side or the bottom, and which side. This moves every hole in a keyguard, so it is the most consequential control here - and it belongs here anyway, because rethinking the grid is part of the same experiment as sizing the bands. Nothing warns about the keyguard at this point: the openings file is produced by a separate deliberate action that measures the screen when it is pressed, so the plastic is cut once the user has settled and experimenting costs nothing.", "principles"),
            numBold("The Always phrases. ", "One list. Edit, delete, reorder, extend.", "principles"),
            numBold("The Flex phrases. ", "The same kind of list, one per situation, with two selection lists at the top saying which situation is being edited.", "principles"),
            numBold("The Context buttons. ", "Which partners, which places and which feelings appear, in a list that respects the fixed order of the three kinds.", "principles"),
            numBold("The look and the sizes, last. ", "The band sizes, whether a band is whole rows or a count, and what tells the three kinds of Context button apart. Last on purpose: these controls mean very little against an empty panel and a great deal once there are real phrases to watch move.", "principles"),
            emptyPara(),
            lead("Button size and spacing do NOT come here, and that is the one thing that moves the other way. ",
                "Those three sliders look like Express Panel settings and are not: every button in the app is sized from an Express Panel button, so they govern Settings, the command bar and everything else. They join the keyguard settings, on a tab renamed to cover both."),
            heading2("7.2 The lists"),
            ...figure('ep-fig4.png', 820, 553, "Figure 4 - The editing surface as built. One fixed toolbar above a list; the two dropdowns name the situation."),
            lead("A list, not one item at a time. ",
                "This reverses a change made in August 2026 that replaced the list with an editor for a single selected button. That was the right call against the list AS IT THEN WAS: every row carried seven color swatches and six tools, and at a narrow width the swatches painted over the tools. Both causes are gone here. The colors go because a button's color now comes from its band, and the tools leave the rows for a fixed set that does not move - buttons that stay put are far easier to hit than buttons that travel up and down with the item they act on."),
            bullet("Each entry has the words on the button and, beside them, how those words should be SAID, with a speaker button next to it. A respelling that cannot be heard is a guess. This is the first place in the app where that field is offered at all, though the app has been able to use it for months."),
            bullet("There is no limit on how many phrases a list may hold, but only as many as there are positions will show. The list draws a line where the panel runs out, with everything below it marked as not showing. The user finds out at the moment they add the phrase, which is not the same moment as noticing it later while changing the layout."),
            bullet("The panel beside the tab stays in step with every change. The exception is while the cursor is in the words or the pronunciation box, when the on-screen keyboard takes that space instead. The two share the same grid by design, so only one of them can be shown."),
            lead("A new list starts as a copy, and ordering is the edit. ",
                "Make a list for this partner, starting from what is on screen now, offered at the moment the user thinks of it. The copy is small - only the Flex band - which is precisely why this makes setup workable where whole panels would not. Moving a phrase up or down its list is what decides how likely it is, and therefore where it lands."),
            heading2("7.3 Saying which situation is being edited"),
            lead("Two selection lists sit at the top of the Flex section, sized to be read, and they are also the label. ",
                "One names the partner, one names the place, each offering Anyone and Anyplace alongside the people and places the user has entered. Together they read as a sentence: this is the Flex band for Mom at home. Somebody who believes they are editing their clinic phrases and is in fact editing everybody's has been misled - and the opposite mistake is worse, because it is silent: they add a phrase, then wonder for weeks why it is missing everywhere else."),
            bullet("A separate list shows the situations that have already been given phrases, sorted so it can be scanned. Without it there is no screen anywhere that says what exists, and after a month there may be fifteen."),
            bullet("A situation can be deleted. If Sue moves away her phrases should go with her, and the same holds when Sue herself is removed from the app: deleting a person takes their situations with them, behind a clear warning that says how many. Nothing may quietly destroy a list as a side effect of an unrelated edit."),
            heading2("7.4 Where the starting phrases come from"),
            lead("The defaults ship inside the app, and the release replaces every existing panel once. ",
                "The alternative considered was handing each tester a panel file to copy into their data folder. It does not work: on an iPad there is no folder anybody can see or reach, and the only route in replaces the user's About Me answers, people, places and settings along with the panel, because a backup is restored whole or not at all. Shipping the defaults costs nobody a copying instruction and behaves identically on every device."),
            bullet("It is a one-time replacement, announced in the release notes because the panel visibly changes under people. Anything the user does afterwards is theirs and is never touched again."),
            bullet("The same shipped set is what a Reset button restores, which is the reason to keep it once the replacement has happened."),
            bullet("The set is settled before the beta opens and is not revisited afterwards. Testers will have plenty to say about whether the app sounds like them, and that lands on the About Me questions rather than on panel phrases. Meanwhile they will be making the panel their own, and changing the defaults underneath somebody who has personalized them buys nothing and costs trust. Later insight goes into the documentation, not into the app."),
            para("Nothing here is required. A user who never makes a single list has the panel they were given, working exactly as it does today. That is the out-of-the-box requirement, and it is met by making the unset situation the ordinary one rather than a special case."),

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
                    ["Keyboard layout changes", "The panel maps onto the positions of whichever keyboard layout the user has chosen, and they can change it. A set remembered by position number scatters when the grid changes shape", "Let the user say whether a band is a number of rows or a number of buttons, and decide what happens to a list made under a different layout. The choice of grid sits on the same tab as the band settings, because changing it is part of the same experiment"],
                    ["Button colors", "Phrase colors today are chosen per phrase by the user and mean nothing shared, while taking seven swatches per row in the editor", "DECIDED: one background color per band instead. Color acquires a meaning it does not currently carry, and seven swatches per row leave the editor. What is lost is a user who was using color privately"],
                    ["Deleting a partner or a place", "Their phrases go with them, silently", "Nothing may remove a partner or place as a side effect of something else, and a deliberate deletion has to say what else is going. This has already gone wrong once, when clearing a relationship type destroyed the record it was attached to"],
                    ["Sounds like me", "The user's own phrases are evidence of how they talk, and are also the list of phrases the AI must never produce unprompted. Both are built from the panel", "Read every set, not just the one showing. A phrase used only with one partner is exactly the kind of thing that must not come out of the machine on its own"],
                    ["Practice Mode", "A rehearsal scenario has a partner and a setting by definition", "Set the situation from the scenario, or the user rehearses with the wrong buttons"],
                    ["Backup and transfer", "The panel is one file today", "More than one list has to survive export, import and a folder copied between machines, and an old backup has to load without any lists in it"],
                    ["Getting the starting phrases out", "There is no way to hand somebody a panel. On an iPad there is no folder to copy into, and restoring a backup replaces About Me, people, places and settings along with the panel", "Ship the starting set inside the app and replace every panel once, at that release. Same behavior on every device, and it doubles as what Reset restores"],
                    ["Measurement", "Nothing currently records which band a spoken phrase came from", "Record the band and the situation. It is a few characters a turn, and it is the only way to learn whether the flexible phrases get used or whether people fall back to the general set every time"],
                    ["The prototype", "prototypes/express-bands.html carries all 21 real layouts and both band shapes, and is not part of the app", "Re-run prototypes/refresh-layouts.mjs after any change to the real layouts. It takes the roles from the app's own panelRoles(), so it cannot hold a second opinion about which cell is which"],
                ], W3),

            // ===== 11 =====
            heading1("11. Build Order"),
            numBold("Confine the partner's offered choices — DONE, released August 22 2026. ", "A fault in what was already shipped rather than a piece of this design, and it depended on none of the rest. The choices used to claim the leading positions of the whole panel and push every phrase along, so a three-way menu moved every button three places and dropped the last few off the end. They now appear at the end of the panel; when the Context band exists they move again, into it. Measured in the running app: no position changed size, shape or place.", "build"),
            numBold("A prototype of the bands — BUILT, August 23 2026. ", "prototypes/express-bands.html, outside app/ so it never deploys. It carries the app's real grid (all 21 keyboard layouts, geometry taken from the app itself), the real compose key, both band shapes, and a count of how many buttons that SPEAK changed when the situation did — which is the honest measure, since the Context band churns constantly by design and none of that costs anything. It has already answered two questions and raised one: a row is not a usable unit of band size, the Context band overflows at three people, and how big each band should be still wants a real panel in front of a real user.", "build"),
            numBold("Bands, filtering, and the escape — DONE, released in 0.8.0. ", "express-bands.js carries the sizing arithmetic and the fill order; the renderer still receives one ordered list plus a parallel list of band names, so it never had to learn about bands to place a button. The Flex band is driven by the taps that already existed. The unset case is the ordinary one, so it shipped before anybody had made a single list.", "build"),
            numBold("Lists for partners and places — DONE, released in 0.8.0. ", "Two selection lists name the situation being edited and double as its label; a list of the situations already set up sits beside them; deleting one is confirmed and says how many phrases go with it. What was NOT built is copy-to-start: with four layered lists filling from the most specific down, a new situation needs only the phrases that are actually particular to it, so there is far less to copy than a whole panel would have needed. Revisit if real use says otherwise.", "build"),
            numBold("Ranges — DONE, August 22 2026. ", "A scale or a count now produces one non-speaking button that opens the composer with the number keys showing, and Enter speaks the number. Independent of the bands, so it was built when it was asked for; when the Context band exists the button moves into it beside the offered choices. Both corrections are made: it reads 123 in every case, and the dashed border is gone from it and from the offered choices alike, so the two are identical — they are the same kind of thing and live for the same single exchange.", "build"),
            numBold("The starting set, and the one-time replacement — DONE, released in 0.8.0. ", "A TEMPORARY full Always set ships inside the app: every phrase this project has ever shipped as a default, minus the feelings, which are Context buttons now. The therapists' set replaces it before the beta opens and is not revisited after. The release replaced every existing panel once, announced in the notes, and Reset restores the shipped set behind a warning that says it is not an undo.", "build"),
            numBold("Recognition — NOT BUILT, and deliberately last. ", "Wired into the same proposal channel with the confidence and boundary rules from section 8. Nothing about the panel changes when this lands, which is the point of doing the rest in this order.", "build"),

            // ===== 12 =====
            heading1("12. What Remains Open"),
            numBold("Whether a band that reorders itself is tolerable at all. ", "The grid never moves, but a phrase can sit in a different place with a different partner. That is the weaker of the two stability requirements and the right one to trade, but only a real panel in front of a real user will say how it feels. Prototype first.", "open"),
            numBold("Which mark should be the DEFAULT for the three kinds of Context button — the question narrowed, it did not close. ", "All four candidates ship as a setting, and the shipped default is the shape. What is still open is whether that is the right default: partner, a place and a feeling inside that shared background. The bar's color alone proved too weak — brown and olive are near neighbors at five pixels. Four candidates are in the prototype and drawn side by side: the color alone, the bar's thickness, which side it sits on, or a small shape before the label. Thickness is the weakest, because it is a comparative cue — a button on its own tells you nothing. The shape is the strongest and is the most in keeping with the app, which already marks the selected state with a check rather than with color alone; its cost is a little width, which matters most on a three-column side dock. All four ship as a setting rather than one being chosen: there is no best answer, and only the person looking at the panel every day can settle it. What is open is which should be the DEFAULT. The priority is higher than it looks, because the Context band is expected to become the largest band on the panel as a user gets comfortable - and three kinds of button in one background is a mild problem at four buttons and the main readability problem at twenty.", "open"),
            numBold("Which band shape should be the DEFAULT. ", "Section 5.6. Both ship as a setting and the shipped default is a count of buttons. The measurements favor counts; what they cannot say is whether a band boundary falling part-way along a row looks wrong, and that is a matter of taste rather than of fact. Both are in the prototype so that the default can be chosen by looking.", "open"),
            numBold("What the shipped band sizes should be. ", "How the sizes are SET is settled and built (section 5.6a): the user sets the Context and Flex bands and Always takes the rest. The shipped numbers are a Context band of six and no Flex band, so an untouched panel is almost exactly the panel that shipped before bands existed. What is open is where those two numbers should start. The Context band has a floor of four positions and fills up at about three people, so the shipped number decides whether a new user meets a band with room in it or one that is already full. The best evidence will be what users add to the shipped set and what they never once tap. Band ORDER is settled — see section 5.2.", "open"),
            numBold("The third dimension. ", "What the calendar knows is neither a partner nor a place — it is an activity. Two dimensions are enough to build, but the way a situation is described should be able to take a third without being redone.", "open"),
            numBold("Whether a place should ever suggest phrases on its own. ", "The app knows facts about a place. Turning those into buttons would save setup and would also put words the user never chose onto the surface reserved for words the user did choose. The presumption is against it.", "open"),
            numBold("The residual on user-initiated requests. ", "Section 3.3 leaves one case genuinely less well served than a traditional Food page. Watch for it in real use; the fix is faster composition, not navigation.", "open"),
            numBold("Whether the general set should be user-ordered too. ", "It is filled last, so only its first few phrases are ever seen when a partner and a place are both selected. That may be fine, or it may mean the general list needs its own ordering pass in setup.", "open"),

            // ===== 13 =====
            heading1("13. The One-Paragraph Version"),
            para("The Express Panel is the fast lane, not the vocabulary — breadth is what the suggested response cards are for — so it does not need folders, and folders would cost it the three things it is good at: one tap, no thinking, and the same word in the same place every time. The real complaint underneath the folders question is that there are more things to say than there are buttons, and the better answer is to let the app use what it already knows. The grid never changes shape. The top band of it never changes at all. Below that sit the buttons that never speak — the partner, the place, the feeling, and whatever the partner has just put on the table, which arrives at the far end where it covers least — arranged so that resizing them cannot disturb the band above. The rest of the panel fills with phrases that suit the partner and the place, most likely first, and the general set backfills whatever is left so no button is ever blank. An always-phrase with no room in its own band queues for whatever is still spare at the end of the next one, behind everything else, so it can never cost the user a phrase chosen for the situation they are actually in. Within that band the user orders their own phrases by how likely they are to want them, so the first thing they see is the first thing they would reach for. Today the user says who and where by tapping; tomorrow the app will often know, and when it does it proposes rather than decides, never rearranges anything mid-conversation, and always leaves the user a tap back to the panel they know."),
        ]
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Express Panel Design.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
