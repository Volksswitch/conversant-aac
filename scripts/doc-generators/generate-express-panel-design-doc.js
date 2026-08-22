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
        PageNumber } = require('docx');

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
                children: [new TextRun({ text: "How the panel changes with who the user is talking to and where they are — and why it has no folders", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  August 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("Two questions arrived on the same day, and they turn out to be the same question. The first was ours: the panel of quick phrases should be able to change depending on who the user is talking to and where they are. The second came from outside: should the panel have pages or folders, so that some buttons open other buttons instead of speaking?"),
            para("Both are answers to one complaint, and it is a real complaint that will be heard from every tester eventually — there are more things I want to say than there are buttons to say them with. The difference is where the work lands. Folders ask the user to build a filing system, remember it, and spend taps walking through it. Context asks the app to use what it already knows about the situation and put the right words on the panel before the user reaches for them."),
            para("This document takes a position on the second question, sets out the design for the first, and records what follows from both. It is a design, not a description: none of it is built yet."),

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
                "In a traditional AAC app the grid of buttons is the whole communication channel, so it has to hold everything a person might ever say, and folders are the only way to fit that on a screen. Here the grid is one of three routes and the narrowest of them. It exists for the handful of things that must be instant: yes, no, wait, help, thank you, the greeting for the person in front of you. Breadth is the response cards' job."),
            para("That distinction is the reason the answer below comes out the way it does. If the panel is ever carrying enough vocabulary to need a filing system, something upstream has failed — either the response cards are not good enough, or the app is being used as a small traditional AAC device rather than as a conversation tool."),

            // ===== 3 =====
            heading1("3. Pages and Folders"),
            heading2("3.1 The decision"),
            lead("No folders, no pages, and no button whose job is to reveal other buttons. ",
                "Ken's instinct on being asked was that it sounded like a traditional AAC app and that the Express Panel is not trying to be one. That is right, but the phrasing gives away more ground than it needs to, because it reads as a matter of taste. It is not: folders conflict with three of this product's stated rules at once, and they land hardest on exactly the users the product is for."),
            heading2("3.2 Why not"),
            numBold("It puts a decision in front of the fastest thing in the app. ", "The panel's entire value is that a phrase is one tap away with nothing to think about. A folder makes the common case two taps, and the first of them is a choice: which folder is it in? For a user with limited motor control, a tap is not free — it costs effort and carries a real chance of hitting the wrong cell.", "why"),
            numBold("It breaks spatial stability at its weakest point. ", "The rule is that geometry never moves, and that what sits behind a given hole should stay put wherever it reasonably can. A folder is a machine for making the same hole mean different things at different times, with no signal on the plastic and none on the screen unless cells are spent on one.", "why"),
            numBold("It creates a mode, and modes strand people. ", "A panel that can be on page two can be left on page two. The user reaches for the button that has been in the same place for six months, and it is not there — mid-conversation, with somebody waiting. Every other part of this app has been designed to avoid exactly that, which is why editing is barred during a conversation and why the response cards are never emptied without being replaced.", "why"),
            numBold("A mis-hit on a folder button is a different kind of accident. ", "A stray tap on a phrase says one wrong word, which is recoverable and often not even noticed. A stray tap on a folder replaces the whole panel. This is the same reasoning that keeps the tap-to-define behavior out of conversations: a cell whose consequence is structural does not belong next to cells whose consequence is a word.", "why"),
            numBold("It gets much worse under scanning and eye gaze. ", "Direct select is today's access method, not the last one. Under scanning, every level of hierarchy multiplies the time to reach a phrase. Traditional AAC accepts that cost because it has no alternative; designing it in now means paying it hardest in the access methods we have not built yet.", "why"),
            numBold("Somebody has to build and maintain the filing system. ", "Editing the panel is already the least popular part of setting the app up. Folders add categories, names, and the question of where a phrase belongs — work that grows with the vocabulary and never finishes.", "why"),
            numBold("The two mistakes are not equally reversible. ", "Refusing folders and being wrong costs a later feature. Shipping folders and being wrong costs taking something away from people who have already built their vocabulary inside it. When one direction is recoverable and the other is not, start with the recoverable one.", "why"),
            heading2("3.3 What the request is actually asking for"),
            para("Turning down the mechanism must not turn down the need, and there are two needs inside this one request. Separating them is what makes the answer constructive rather than a refusal."),
            simpleTable(
                ["The underlying need", "What it really is", "Our answer"],
                [
                    ["I have more phrases than cells", "An overflow problem, and the person asking said so — they suggested folders could hold the overflow", "Context bands (section 5) plus an honest overflow rule (section 9). The right words are already on the panel, so there is nothing to page to"],
                    ["I need a set I rarely use but must reach deliberately", "Not a folder. A named set the user summons, like an emergency card or a specific order at a specific counter", "A summoned overlay (section 3.4), if it is ever needed at all"],
                ], W3),
            emptyPara(),
            para("Almost every instance of the request is the first row. It is worth asking which one is meant before answering, because the answers are different and only one of them is a refusal."),
            heading2("3.4 The one concession, if we ever need it"),
            para("There is a shape that gives the second need what it wants without any of the costs above, and the app already uses it for something else. The rule for infrequent functions is that they become overlays rather than permanent fixtures, and the rule for an overlay is that it lines up with the same holes as the screen underneath, which is how one physical keyguard works for both. That is exactly what the on-screen keyboard does."),
            lead("So the concession would be an overlay, not a folder. ",
                "One deliberate action brings up a full-screen set of phrases on the same grid; anything dismisses it; it never appears on its own, and no cell of the base panel changes its meaning. It is reached the way Settings is reached, not the way a folder is reached. This is not proposed for building — it is recorded so that if the need turns out to be real, we build the version that costs nothing rather than the version that costs the panel."),
            heading2("3.5 What would change the decision"),
            para("Stated in advance, so it is evidence that reopens this and not enthusiasm. If testers with a full panel and their context bands in use are still routinely reaching for the composer to say things they say often, the panel is genuinely too small and the question is open again. If instead they are using a handful of cells and leaving the rest, then the shortage was never real."),

            // ===== 4 =====
            heading1("4. The Better Answer: Context Instead of Navigation"),
            para("The app already changes what is on the panel without anybody navigating anywhere. When the other person offers a choice — mild, moderate, or severe — those alternatives appear as buttons and then go away when the turn ends. Nobody had to file them, find them, or go back afterwards."),
            lead("That is the good version of a folder, and the difference is the trigger. ",
                "A folder is a place the user has to go. Context is a fact the app already has. Both put different words behind the same holes; only one of them asks the user to remember where anything is, to spend a tap, or to find their way back."),
            para("The app is about to know a great deal more about the situation. Today the user taps who they are with and where they are, mainly so the AI can suggest better replies. Later the same facts will arrive on their own from voice and face recognition, from location, and from what the calendar says should be happening. Once those facts exist, using them to put the right phrases on the panel costs the user nothing at all — and unlike a filing system, the work goes down over time rather than up."),
            para("One more thing follows from this, and it matters for how the two are explained together. A folder is the user's taxonomy: they build it, they maintain it, and they are the only one who understands it. Context is shared: the same signal that changes the panel also tells the AI who is being spoken to and what the setting is, so one act of setup improves both routes at once."),

            // ===== 5 =====
            heading1("5. The Design"),
            heading2("5.1 Three bands"),
            para("The grid does not change. Same number of cells, same sizes, same positions, so a keyguard cut today still fits. What changes is that the cells are grouped into three bands with different rules."),
            simpleTable(
                ["Band", "What is in it", "Does it change?"],
                [
                    ["Controls", "The partner, place and feeling toggles, and In my own words", "Never"],
                    ["Always", "The plumbing: yes, no, please, thank you, wait, help, the device notice", "Never"],
                    ["Context", "The phrases that suit this person, this place, or both", "Only this band, and only on a deliberate act"],
                ], W3),
            emptyPara(),
            lead("The controls band is fixed for a reason that is not aesthetic. ",
                "The toggles that set the partner and the place are themselves buttons on this panel. If they could be swapped away by a context, the user could choose a context that hides the only way out of it. Any design where selecting a place can remove the place buttons is a trap, and it is an easy one to build by accident."),
            para("The always band is the answer to the worst thing a swapping panel can do. Wherever the user is and whoever they are with, yes is in the same hole. Those are the words that get used dozens of times a day and are the most costly to hunt for."),
            heading2("5.2 Layering, not replacement"),
            para("The obvious way to build this is a whole panel per situation: one for Mum, one for the clinic, one for Mum at the clinic. It should not be built that way. Whole panels make the cost of every new situation the whole panel, and they make the number of situations multiply — every person against every place."),
            para("Instead the context band is filled by stacking. The default fills it. If the place is known, that place's phrases go on top. If the person is known, theirs go on top of that. A set defined for a particular person in a particular place, if one exists at all, goes on last. Cell by cell, the most specific definition wins."),
            simpleTable(
                ["Situation", "What fills the context band"],
                [
                    ["Nothing set", "The default phrases. This is what a new user sees, and it is what the panel does today"],
                    ["Place only", "Default, with the place's phrases over the top"],
                    ["Person only", "Default, with the person's phrases over the top"],
                    ["Both", "Default, then the place, then the person, then a combined set if one has been made"],
                ], W2),
            emptyPara(),
            para("Three things follow from stacking, and they are the whole argument for it."),
            bullet("Combinations mostly do not need to be made. The pharmacist you happen to know needs no set of their own: the pharmacy supplies the transactional phrases, the person supplies the personal ones, and the two compose. A combined set becomes a rare deliberate exception rather than the unit of work."),
            bullet("No cell can go blank. If a person's set defines three of the six context cells, the other three keep what was underneath. This is not tidiness — a blank button is something the user cannot say, which is the same reason a response card is never allowed to come up empty."),
            bullet("Both kinds of nothing behave the same on the panel. Whether a dimension is unset because it does not matter or because the user has not got round to it, the panel falls back to the default and works. The difference still matters to the AI and to the setup screens, but never to the person reaching for a button."),
            heading2("5.3 The partner's own options are the top layer, not a fourth band"),
            para("When the other person offers a menu — mild, moderate, or severe — those alternatives already appear as buttons on the panel and leave again when the turn ends. They are not a separate region and should not become one. They are simply the most specific layer of the same stack: what the partner said a moment ago is more specific than what is usually said with this person, in this place, or in general. One mechanism, five layers, and only the last of them transient."),
            para("They were deliberately given no standing reservation — cells set aside and sitting blank when no menu is on the table are cells wasted for the whole of the rest of the day. Nothing here changes that. At rest the band holds the context phrases; the alternatives lie on top of them for one turn."),
            para("Three things follow, and the first is a correction to how the app behaves today rather than a new requirement."),
            bullet("Today the alternatives claim the leading cells of the WHOLE panel and push everything along, so a three-way menu moves every phrase on the panel three places and drops the last few off the end. For that turn, everything the user has learned about where things are is void. Confined to the band, everything outside it stays exactly where it is — including yes, no, and help. This was fixed on its own account and ahead of the rest, on August 22 2026 (section 11), because it was a fault in what people were already using."),
            bullet("The band cannot be smaller than the most alternatives we will ever show, which is four. Below that, a four-way menu would have to drop one of the partner's own alternatives, and the standing rule is that the partner's alternatives outrank anything the app added. So four cells is a floor on the band, not a target."),
            bullet("There is a conflict with standing roles that needs settling in front of a real panel. If the alternatives claim the front of the band they displace the first roles — the opener and the usual subject — which are the most learned cells in it. Claiming from the far end instead would put the transient thing over the least established roles. Neither can be argued to a conclusion from a chair."),
            heading2("5.4 Standing roles, which is what makes swapping survivable"),
            para("This is the part that decides whether the feature works or gets switched off. Each cell in the context band should carry a standing role, not just a phrase: the first is always the opener for this person or place, the second is always their usual subject, and so on. The words change; the kind of thing at that position does not."),
            para("It is the same principle already settled for the response cards, where position tells you what kind of reply it is and never how good it is. Without it, a swapping band is a band whose meaning cannot be learned, and a keyguard user is left reading every cell every time — which is precisely the cost the panel exists to avoid. With it, the user is not learning that a particular hole says one particular sentence; they are learning that it is the thing they usually open with here."),
            heading2("5.5 Where the bands sit"),
            para("The context band should be one contiguous block, and the natural place is the row or rows furthest from the plumbing. It has to be described in terms that survive the user changing their keyboard layout — the last row of whatever grid is in use, rather than a fixed list of cell numbers. Section 10 explains why that distinction is load-bearing."),

            // ===== 6 =====
            heading1("6. How It Behaves"),
            simpleTable(
                ["When", "What happens"],
                [
                    ["Before a conversation", "The panel shows whatever the current situation resolves to. Tapping a person or a place swaps the context band at once — the user did it on purpose and is watching the screen"],
                    ["During a conversation", "A deliberate tap still swaps it. Nothing else does. In particular, a person or place worked out automatically must not rearrange the panel while a conversation is running"],
                    ["Choice chips arrive", "They take the front of the context band rather than the front of the whole panel, so the plumbing never disappears while a menu is on the table"],
                    ["The user wants out", "A way to show the default panel regardless of the situation, and get back again"],
                    ["Anything swaps", "The panel says what it now is — the person and the place, briefly and visibly"],
                ], W2),
            emptyPara(),
            lead("The escape route is not optional. ",
                "When the situation is wrong — recognized wrongly, or simply left over from earlier — the user needs a phrase that lives in the default set, and they need it without first correcting the machine. Saying what the panel has become matters for the same reason: the user is usually looking at the other person, not at the screen."),
            // ===== 7 =====
            heading1("7. Setting It Up"),
            para("The panel is already edited by tapping a button in the live panel while Settings is open, which is the right shape and should carry over unchanged: the user picks the position by tapping it, rather than typing into a list and then shuffling rows until it lands where they wanted. Three things have to be added."),
            numBold("The scope being edited is stated, unmistakably. ", "Tapping a cell in the always band edits it for every situation; tapping one in the context band edits it for the person or place currently showing. Somebody who believes they are editing their clinic phrases and is in fact editing everybody's has been misled — and the opposite mistake is worse, because it is silent: they add a phrase, then wonder for weeks why it is missing everywhere else.", "principles"),
            numBold("A new set starts as a copy. ", "Make a set for this person, starting from what is on screen now, offered at the moment the user thinks of it. With stacking the copy is small — only the context band — which is precisely why stacking makes setup workable where whole panels would not.", "principles"),
            numBold("Nothing is required. ", "A user who never makes a single set has the panel they have today, working exactly as it does today. That is the out-of-the-box requirement, and it is met by making the unset situation the ordinary one rather than a special case.", "principles"),

            // ===== 8 =====
            heading1("8. When the App Works It Out for Itself"),
            para("Voice and face recognition, location, and calendar expectations will eventually supply the person and the place without anybody tapping anything. Designing for that now costs almost nothing and prevents a rebuild, because the rules it needs are rules rather than machinery."),
            numBold("Recognition proposes; it does not command. ", "An automatic result sets the situation the same way a tap does, but the user's tap always wins and is always available.", "principles"),
            numBold("The buttons that are already there are the correction. ", "A recognized person lights up their own button on the panel. A wrong guess is corrected with the tap the user already knows. No new gesture, no new screen, and the existing partner button becomes what it was always described as — the place where recognition gets confirmed.", "principles"),
            numBold("The panel needs a higher bar than the AI does. ", "Getting the situation slightly wrong makes a suggested reply slightly off. Getting the panel wrong moves buttons under somebody's fingers. Same signal, two different levels of confidence required before acting on it.", "principles"),
            numBold("It must not chase a flickering answer. ", "Two people in the room, the partner stepping away, a face half in frame — recognition will change its mind. The panel must be slow to follow it, and must never follow it in the middle of a conversation.", "principles"),

            // ===== 9 =====
            heading1("9. Overflow, Honestly"),
            para("A busy place will have more candidate phrases than the context band has cells. That is certain, and it is the situation that produced the folders question in the first place, so it needs a stated answer rather than a mechanism that hides it."),
            lead("The rule: the band holds what it holds. ",
                "The user orders the phrases, the band shows as many as it has cells for, and the editor says plainly that the rest are not reachable. This is the same answer already given for the panel as a whole, where an item past the last cell is unreachable rather than stored for later, and it has the same virtue: the user is told the truth at the moment they can do something about it."),
            para("Paging within the band is the tempting alternative and it is the wrong one for the same reason folders are — a page turn puts a different word behind the same hole with nothing on the plastic to say so. The honest cap is better than a hidden shelf."),

            // ===== 10 =====
            heading1("10. What Else This Touches"),
            para("These are the consequences that are easy to miss and expensive to discover late."),
            simpleTable(
                ["Area", "What happens", "What is needed"],
                [
                    ["Keyboard layout changes", "The panel maps onto the cells of whichever keyboard layout the user has chosen, and they can change it. A set remembered by cell number scatters when the grid changes shape", "Describe the band by rows relative to the current layout, and decide what happens to a set made under a different one"],
                    ["Choice chips", "They used to take the leading cells of the whole panel and push everything along, so the plumbing was what got displaced. Fixed August 22 2026", "Done ahead of the band work — they now take the last cells, so nothing moves. When the band exists they move again, to sit at its far end as its top and only transient layer (§5.3)"],
                    ["Deleting a person or a place", "Their phrases go with them, silently", "Nothing may remove a person or place as a side effect of something else, and a deliberate deletion has to say what else is being deleted. This has already gone wrong once, when clearing a relationship type destroyed the record it was attached to"],
                    ["Sounds like me", "The user's own phrases are evidence of how they talk, and they are also the list of phrases the AI must never produce unprompted. Both are built from the panel", "Read every set, not just the one showing. A phrase used only with one person is exactly the kind of thing that must not come out of the machine on its own"],
                    ["Practice Mode", "A rehearsal scenario has a person and a setting by definition", "Set the situation from the scenario, or the user rehearses with the wrong buttons"],
                    ["Backup and transfer", "The panel is one file today", "More than one set has to survive export, import, and a folder copied between machines, and an old backup has to load without its sets"],
                    ["Measurement", "Nothing currently records which band a spoken phrase came from", "Record the band and the situation. It is a few characters a turn and it is the only way to learn whether scoped phrases get used or whether people fall back to the default every time"],
                ], W3),

            // ===== 11 =====
            heading1("11. Build Order"),
            numBold("Confine the partner's offered alternatives — DONE, August 22 2026. ", "This was a fault in what was shipped rather than a piece of the design, and it depended on none of the rest, so it was fixed on its own. The alternatives used to claim the leading cells of the whole panel and push everything along, so a three-way menu moved every phrase three places and dropped the last few off the end — for one turn, nothing was where the user had learned it. They now appear at the bottom, in Ken's words, so that they push nobody around and at most cover the last few buttons until the turn ends. Measured in the running app: with three alternatives showing, not one cell changed position, size or shape, and exactly three changed what they held. They flow around the compose key the same way the phrases do, since a three-way set cannot be contiguous at the end of every layout and treating that key as an obstacle is what keeps everything else still.", "build"),
            numBold("Bands, stacking, and the escape route. ", "The context band still driven only by the taps that exist today. This is the entire feature for a manual user, it is testable immediately, and it can ship before any set has been made because the unset case is the ordinary one.", "build"),
            numBold("Sets for people and places, with copy-to-start. ", "The editing surface and the scope indicator, plus the rules about deletion.", "build"),
            numBold("Combined sets. ", "Only if real use shows that stacking a person over a place is not enough. It may never be needed.", "build"),
            numBold("Recognition. ", "Wired into the same proposal channel with the confidence and boundary rules from section 8. Nothing about the panel changes when this lands, which is the point of doing the first three in this order.", "build"),

            // ===== 12 =====
            heading1("12. What Remains Open"),
            numBold("How big the context band should be. ", "There is a floor — four cells, so a four-way menu never costs the partner one of their own alternatives (§5.3). Above that it is a judgment call: too small and the feature is a novelty, too large and the plumbing gets squeezed. Wants a real panel in front of a real tester rather than a number chosen here.", "open"),
            numBold("Whether the standing roles are named or merely conventional. ", "Naming them makes setup clearer and makes copying between sets easier; it also makes the editor more elaborate, and an unnamed convention may be enough.", "open"),
            numBold("The third dimension. ", "What the calendar knows is neither a person nor a place — it is an activity. Two dimensions are enough to build, but the way a situation is described should be able to take a third without being redone.", "open"),
            numBold("Whether a place should ever suggest phrases on its own. ", "The app knows facts about a place. Turning those into suggested buttons would save setup and would also put words the user never chose onto the surface reserved for words the user did choose. The presumption is against it.", "open"),
            numBold("Whether the panel and the AI should ever disagree. ", "One signal drives both, which is right. But a user might want to tell the AI they are at the clinic without their buttons changing. If that turns out to be a real want, it is a second control, and second controls are expensive here.", "open"),

            // ===== 13 =====
            heading1("13. The One-Paragraph Version"),
            para("The Express Panel is the fast lane, not the vocabulary — breadth is what the suggested response cards are for — so it does not need folders, and folders would cost it the three things it is good at: one tap, no thinking, and the same word in the same place every time. The real complaint underneath the folders question is that there are more things to say than there are buttons, and the better answer is to let the app use what it already knows. The grid never changes shape. Most of it never changes at all. One contiguous band of it fills with phrases that suit the person in front of the user and the place they are in, stacked so that the general case fills the gaps in the specific one, so no button is ever blank and no combination has to be built by hand. Each cell in that band keeps a standing role, so what moves is the wording and not the meaning. Today the user tells the app who and where by tapping; tomorrow the app will often know, and when it does it proposes rather than decides, never rearranges anything mid-conversation, and always leaves the user a tap back to the panel they know."),
        ]
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Express Panel Design.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
