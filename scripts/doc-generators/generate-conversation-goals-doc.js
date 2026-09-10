/* Conversant AAC — Conversation Goals (September 10 2026)
 *
 * Written because Ken went looking for a document on how conversational goals are
 * specified and handled and found only a CLAUDE.md section plus Section 7 of
 * Reframe-Concepts-for-AAC-Architecture.docx. This is that document: what the app
 * does, what it deliberately does NOT do, and where both depart from the published
 * literature on conversational goals.
 *
 * Every claim about the literature here was checked against a source in the writing
 * (see Section 10) rather than recalled — the project's own 50%-research-error
 * finding applies to this kind of writing more than to anything else.
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

// keepNext on the PARAGRAPH, not only on the style: the document checker reads each
// paragraph's own properties, so a heading that inherits the setting from its style
// still reports as able to be stranded at the foot of a page (rule S3).
function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(text)] });
}
function para(text, opts = {}) {
    return new Paragraph({
        spacing: { before: 0, after: opts.after ?? 160 },
        children: [new TextRun({ text, ...opts.run })]
    });
}
function boldPara(label, text, after = 160) {
    return new Paragraph({
        spacing: { before: 0, after },
        children: [new TextRun({ text: label, bold: true }), new TextRun(text)]
    });
}
function bullet(text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function bulletBold(label, text, ref = "bullets") {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 80 },
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
            children: [new TextRun({ text, bold: true, size: 22 })] })]
    });
    const bodyCell = (cell, w) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const text = isObj ? cell.text : cell;
        const run = isObj
            ? new TextRun({ text, size: 22, italics: !!cell.italics, bold: !!cell.bold })
            : new TextRun({ text, size: 22 });
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
            { reference: "layers",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "sources",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "notdoing",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "open",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Conversation Goals", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  September 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children: [
            // ===== TITLE =====
            new Paragraph({
                spacing: { before: 240, after: 80 },
                children: [new TextRun({ text: "Conversation Goals", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "How the App Lets Someone Say What They Want From a Conversation, What It Deliberately Does Not Ask Them To Do, and Where Both Depart From the Literature", italics: true, color: "595959", size: 24, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  September 2026  |  Last updated September 10, 2026", color: "808080", size: 20, font: "Arial" })]
            }),

            // ===== 1 =====
            heading1("1.  Why This Document Exists"),
            para("Ken went looking for a document describing how conversational goals are specified and handled, and there was not one. What existed was a section of the project's own working notes, plus Section 7 of \"Reframe: Academic Foundations\", which grounded the three-layer model in two published theories and then stopped. In the meantime the feature has been built, and several decisions were taken along the way that depart from what those theories recommend. Decisions like that are worth writing down once, with their reasoning, rather than leaving them to be rediscovered as though they were oversights."),
            para("So this document has three jobs. It states the premise the whole feature rests on, and says honestly how well that premise is supported. It describes what the app now does. And it sets out, in one place, what the app deliberately does not do and why — including one case where the published account is almost certainly right about how people work and was still the wrong thing to build."),
            boldPara("What it replaces: ", "this supersedes Section 7 of \"Reframe: Academic Foundations\" as the current account. That section is still accurate about the two theories it summarizes; it is out of date about what was built, and its central recommendation — organize the controls by primary and secondary goals — was considered and rejected. Section 6.1 explains why."),
            emptyPara(),

            // ===== 2 =====
            heading1("2.  The Premise, and Whether It Holds"),
            para("Ken's position, in his words: every human being has goals for their interactions with other human beings — both short-term and long-term — and that is why this aspect of communication deserves to be made visible rather than left implicit."),
            boldPara("The short answer: the premise holds, and it is better supported than most of the assumptions this project runs on. ", "Two qualifications are worth carrying, and neither weakens the case for building the feature. One of them is in fact an argument for the particular shape it took."),

            heading2("2.1  What supports it"),
            para("The standard account of message production in interpersonal communication research does not argue that people have goals — it begins there. Dillard's Goals-Plans-Action model treats a goal as the thing that sets the whole process in motion: goals motivate plans, plans produce action. The model's entire subject matter is what happens after a goal exists."),
            para("The long-term half of Ken's claim has its own separate literature. Canary and Stafford's work on relational maintenance catalogs what people actually do to keep a relationship going over time — staying positive, talking openly about the relationship, offering assurances about the future, drawing on shared networks of friends and family, and sharing tasks. Those are long-horizon goals by construction: none of them is about the conversation you are having now."),
            boldPara("Worth noticing: the two horizons Ken named turn out to be two different research literatures. ", "Short-term, episode-level goals are Dillard's territory; long-term, relationship-level goals are Canary and Stafford's. Ken's own division of the problem reproduced the division the field already fell into, before either theory was consulted."),
            para("The strongest support, though, comes from inside AAC rather than from communication theory. Light's account of what communication is for — the framework the whole field has organized itself around since 1988 — is stated as four goals: to express needs and wants, to transfer information, to build social closeness, and to satisfy social etiquette. It is not a taxonomy of message types that happens to mention goals; each category is defined by what the speaker is trying to achieve."),
            boldPara("And the specific instinct — raise the visibility of this — has already been asked for in print. ", "Kane and colleagues interviewed seven people with ALS and their partners about self-expression through their devices, and among the research directions the paper proposes are better support for relational maintenance strategies and for the social purposes of communication. That is this feature, named in advance, in a venue that had no reason to expect anybody to build it. So Ken is not merely not wrong; he is asking for something the field has explicitly identified as missing."),
            emptyPara(),

            heading2("2.2  The first qualification: having a goal is not the same as being able to state one"),
            para("There is substantial evidence that people frequently pursue goals they are not aware of having. In Bargh's account, a situation can activate a goal that has been associated with it in the past, and the goal then shapes behavior with no conscious step anywhere in the sequence. The person acts on the goal and could not report it if asked."),
            boldPara("This does not dent the premise — it sharpens the design. ", "If goals were reliably available to introspection, the obvious control would be a box that asks \"what do you want from this conversation?\" at the start of every one. The evidence says that question would often get either silence or a plausible-sounding answer invented on the spot. A short list the user has authored in advance, in a quiet moment, and can then pick from with one tap is a better instrument for the same reason a menu beats an open question everywhere else in this app: it asks for recognition rather than production."),
            para("This is the same finding the voice work ran into from the other direction, where people turned out to be poor judges of how they sound. Both times the answer was to stop asking the user to describe themselves and give them something to choose instead."),
            emptyPara(),

            heading2("2.3  The second qualification: the discipline grounding the engine declines to talk about goals at all"),
            para("Conversation Analysis is the tradition behind most of the conversation engine — the sequence stack, adjacency pairs, repair, the closing sequence. It is also, by design, the one discipline here that will not attribute a goal to anybody. Its method deliberately avoids ascribing mental states to participants; what counts as evidence is what can be shown in the talk itself. The field's own summary of how an action is identified is \"position plus composition\" — where a turn falls and how it is built, not what the speaker can be supposed to have wanted."),
            boldPara("That is a rule about what an analyst may claim, not a claim that people have no goals. ", "And it does not bind this app, for a reason worth stating plainly: we are not inferring anybody's goal. The user tells us. A goal reaches the system because a person selected it, which is exactly the kind of evidence Conversation Analysis has no objection to. The place where the two would genuinely collide is a system that guessed at the user's goal from their circumstances — which is Section 6.2, and is not built."),
            emptyPara(),

            heading2("2.4  One refinement to the wording"),
            para("\"Every human has goals for their interactions\" is safest read as \"all conversation is goal-directed\", including conversation whose goal is purely relational. Talk with no agenda is not the absence of a goal; social closeness is one of Light's four, and it is the one AAC users most often say matters most while their equipment serves it worst. This matters practically, because it is the justification for keeping \"Just chatting\" in the list of goals the app offers. A user who picks it has not declined to set a goal. They have set one, and it is arguably the most important one in the app."),
            emptyPara(),

            // ===== 3 =====
            heading1("3.  Why Goals Carry More Weight in AAC Than in Ordinary Talk"),
            para("In unaided conversation a goal costs nothing to pursue. A speaker who wants to repair a rift and stay warm while doing it adjusts their wording continuously, unconsciously, at no cost. None of that is available here. Every sentence the user says arrives through a device, several seconds late, chosen from a handful of options somebody else drafted."),
            para("That has one consequence that shapes this whole feature. If the app does not know what the user is trying to achieve, it writes suggestions for somebody with no particular aim — and the user's only way to correct that is to reject four cards and type instead, which is the slowest path in the app and the one the product exists to avoid. A goal is therefore not a refinement here. It is the difference between four options the user can use and four they have to work around."),
            boldPara("It also cuts the other way, which is why the guard in Section 8.3 matters so much. ", "A goal that shapes the wording is useful. The same goal spoken aloud, because the app decided to raise it, is a disclosure the user never authorized — and in the case of something like repairing a rift, a potentially serious one."),
            emptyPara(),

            // ===== 4 =====
            heading1("4.  The Three Layers"),
            para("Goals in this app are three different things on three time horizons. Lumping them together is what made the problem look hard for as long as it did; separating them is most of the design."),
            simpleTable(
                ["Layer", "What it is", "Where it lives", "Status"],
                [
                    ["Disposition", "How the user generally is with people, whoever they are talking to.", "The About Me questionnaire's personality, values, humor and conflict-style questions.", "Built, as part of the worldview work."],
                    ["Standing relationship goal", "What the user wants from knowing one particular person, over months and years.", "On the link between the user and that person, edited in About Me under People.", "Built."],
                    ["Conversation goal", "What the user is trying to achieve in the exchange happening right now.", "Held for the length of one conversation and then discarded.", "Built."]
                ],
                [2000, 2900, 2660, 1800]
            ),
            emptyPara(),
            para("The layers resolve most-specific-wins, exactly as the other personalization does: what the user is like in general, then what they want from this person, then what they want right now."),
            boldPara("The disposition layer is deliberately not called a goal in the app. ", "It is a description of a person, and the questionnaire already collects it. Naming it a goal would invite the user to set it twice."),
            emptyPara(),

            // ===== 5 =====
            heading1("5.  How a Goal Is Specified"),
            heading2("5.1  A menu of twelve, plus the user's own words"),
            para("A goal is picked from a list of twelve, or typed. The twelve are not invented: they are the two published lists merged and reworded into something a person would recognize. Dillard's primary-goal categories supply the reasons an exchange happens — finding something out, asking for help, telling somebody something, making plans, making peace. Canary and Stafford's five maintenance strategies supply the long-horizon ones — being upbeat, talking about the relationship, reassuring somebody, doing things together, supporting their other relationships."),
            para("The menu exists because picking is far cheaper than composing, and cost is the governing constraint for this user. Typing is always available for the goal none of the twelve covers, and a typed goal can carry a short label of its own so it fits on a button."),
            emptyPara(),

            heading2("5.2  Three sources, most specific first"),
            para("A conversation goal can come from three places, and the app offers all three at once, in this order:"),
            bulletBold("This person — ", "the standing goals recorded for whoever the user has said they are talking to."),
            bulletBold("This place — ", "what the user comes to this place to do, recorded against the place in My Places."),
            bulletBold("Anyone, anywhere — ", "a general list, which is what the user came to this particular conversation to do."),
            para("A goal appearing in two of the three lists is offered once, and keeps the more specific source."),
            boldPara("The person and the place supply different goals rather than competing, and this is the part that took the longest to get right. ", "Talking to your sister, the goal comes from her and the setting is incidental — the same goal at her house or in a coffee shop. At a pharmacy counter the other person is frequently a stranger you will never see again, and the goal comes from what the place is for. The place decides the goal precisely when it decides the other person's role rather than their identity, which is the transactional-versus-interactional distinction this project was founded on. The pharmacist you happen to know contributes both."),
            boldPara("A rule of \"the person outranks the place\" is the obvious first answer and is wrong for exactly that case. ", "It was proposed, tested against the pharmacist, and dropped."),
            boldPara("The general list is the one that makes the feature reach most of a user's life. ", "Without it, a goal button could only ever appear for somebody already entered in About Me — which leaves out nearly every counter, clinic, and stranger, meaning it leaves out the transactional half of communication that this product exists to widen."),
            emptyPara(),

            heading2("5.3  Ordering is the only weighting"),
            para("The user puts their goals in order of importance, and that order is the whole of what the app knows about relative weight. There are no numbers, no percentages, and no separate label marking one goal as the main one. The order is shown as a numbered list so that it reads as an order rather than a coincidence of how the list was typed."),
            para("What reaches the AI says so explicitly: the goals in the user's own order, most important first, and an instruction that the earlier ones win where two of them pull in different directions."),
            emptyPara(),

            heading2("5.4  Several goals at once"),
            para("More than one goal can be in force at the same time, and that was a deliberate decision rather than a convenience. \"Talk about the argument last night\" and \"do not damage this relationship\" is an entirely normal pair, and a control that held one value could not express it. Each goal switches on and off independently."),
            emptyPara(),

            // ===== 6 =====
            heading1("6.  What the App Deliberately Does Not Do"),
            heading2("6.1  It does not ask the user to separate primary goals from constraining goals"),
            para("This is the significant divergence from the literature, and the literature is probably right about how people work. It was still the wrong thing to build."),
            para("Dillard's model draws a sharp line. A primary goal is the reason the exchange is happening — it defines the situation. Secondary goals arise while pursuing it and shape how far one is willing to go: protecting how one is seen, protecting the relationship, protecting one's own time or energy or composure, keeping the interaction itself running smoothly. The evidence behind the distinction is real: secondary goals measurably change how direct a message is."),
            para("Section 7 of \"Reframe: Academic Foundations\" recommended organizing the goal controls along that line — one list for what the exchange is for, another for the constraints on it. Ken rejected it: overengineered, and difficult for users to set up."),
            boldPara("The reasoning is worth keeping, because it applies well beyond goals. ", "Dillard's distinction is a researcher's instrument. Asking the user to sort their own goals into \"the reason I am talking to you\" and \"the thing I must not damage while I do\" asks them to perform the theory's classification before they can say what they want — and to be confident they have classified it correctly. That is the same fault that killed a fixed role per Express Panel position: it asks somebody to think in categories another person invented. And the bill is paid by the slowest interaction path in the app, by the user least able to afford it."),
            boldPara("What is lost, stated plainly. ", "A system that knew \"keep it brief, I am tired\" was a constraint rather than the point of the exchange could treat it differently from the reason for the conversation. We give that up."),
            boldPara("What recovers most of it: the ordering. ", "A constraint is almost always ranked below the reason for the exchange, because that is what it feels like to the person ranking them. So \"repair things\" first and \"stay calm\" second carries nearly the same information as labeling one primary and the other secondary, and it costs the user nothing but a sense of what matters more — which is a judgment they can actually make. The content of both of Dillard's categories survives in the twelve; only the requirement that the user label which is which is gone."),
            emptyPara(),

            heading2("6.2  It does not infer a goal"),
            para("Every goal in the app is one the user set. Nothing is guessed from the person, the place, the time of day, or the history. The literature would support inference — Bargh's whole point is that situations activate goals — and it is still not being done."),
            para("The reason is the risk this project calls the Cyrano problem: a user coming to defer to the device because they believe it communicates better than they do. A device that decides what the user is trying to achieve, and then writes their words to suit, is that failure in its purest form. It would also be the one place where the app genuinely contradicted the Conversation Analysis stance in Section 2.3, by treating an attributed goal as though it were a fact."),
            para("This remains open rather than closed. If it is ever revisited, the safe shape is suggesting a goal the user must accept, never applying one."),
            emptyPara(),

            heading2("6.3  It does not attach goals to a kind of relationship"),
            para("\"With authority figures I want to seem competent\" is a goal about a category of person, not about one person. The app has no place to put that today: standing goals attach to a named individual. The general list absorbs some of the need, since a goal that applies to everyone can live there, but a goal that applies to bosses and not to friends has no home. Left open."),
            emptyPara(),

            heading2("6.4  It does not ask for a goal at the start of a conversation"),
            para("An earlier design put a goal picker into the flow of starting a conversation, plus a small indicator in the transcript header. It was not built, and the reason is that its premise was later reversed: it argued goals should not take up Express Panel space, and the Express Panel is now where they live. Its own notes anticipated this outcome — that once the panel could offer goals for the current person and place, a separate picker would be needed only for the third source, which the general list now covers."),
            boldPara("What would reopen it: ", "a tester who cannot find where to set a goal. That is the failure a picker in the start flow would fix and a panel button might not."),
            emptyPara(),

            heading2("6.5  It does not keep a goal typed in the moment"),
            para("A goal the user types on the spot — \"I need to tell them what the consultant said\" — can be conveyed today by typing it and asking the AI to take it into account, but it applies to one set of suggestions and is then discarded. Making it persist for the rest of the conversation is the one clearly missing piece. It needs a fourth control on the composer, which changes the shape of something that shares the physical keyguard, so it is a decision about the conversation screen rather than a small addition."),
            emptyPara(),

            // ===== 7 =====
            heading1("7.  Where This Departs From the Literature, Collected"),
            simpleTable(
                ["Point", "What the literature says", "What this app does, and why"],
                [
                    ["Primary versus secondary goals",
                     "Dillard: primary goals define the situation, secondary goals constrain it; the distinction predicts message directness.",
                     "One flat list, ordered by the user. The distinction is a researcher's instrument; asking the user to apply it costs more than it returns. Ordering recovers most of the effect."],
                    ["Where goals come from",
                     "Both main theories are about people — influence goals toward somebody, maintenance of a relationship with somebody.",
                     "A PLACE is a first-class source of goals as well. Neither theory covers it, and the transactional half of a user's life needs it. This is the app's own contribution, not a citation."],
                    ["Awareness of goals",
                     "Much goal pursuit is automatic; people often cannot report the goal driving them.",
                     "Agreed, and designed around: the user authors a short list in advance and picks from it, rather than being asked in the moment."],
                    ["Attributing goals",
                     "Conversation Analysis declines to attribute goals to participants at all.",
                     "No conflict: the user states their goal, so nothing is being attributed. The app never infers one."],
                    ["Goals in the talk itself",
                     "Nothing in these frameworks forbids a speaker from naming their own goal out loud; people do it constantly.",
                     "A goal here must NEVER be said aloud or raised as a topic. The app is speaking as the user, and choosing to disclose a goal is the user's decision, not the device's."],
                    ["Weighting",
                     "Research treats goal importance as a measurable quantity that varies continuously.",
                     "Rank order only. A number would be precision the user cannot supply and we could not act on honestly."]
                ],
                [2100, 3400, 3860]
            ),
            emptyPara(),

            // ===== 8 =====
            heading1("8.  How a Goal Is Handled Once It Is Set"),
            heading2("8.1  Standing context or a menu — the two are not the same"),
            para("A person's standing goals reach the AI whether or not the user has switched anything on, because what somebody wants from knowing their mother is true all the time. A place's goals and the general list do not: they reach the AI only when tapped."),
            boldPara("The reason is that those two are alternatives rather than commitments. ", "Picking up a prescription and asking about a bill are two things a person might be at the pharmacy to do, not two things they want at once. Sending the whole list would tell the AI to pursue every one of them simultaneously, which is worse than sending none."),
            emptyPara(),

            heading2("8.2  Each source expires with the thing it belonged to"),
            bulletBold("Change who you are talking with — ", "that person's goals switch off. A goal set for one person should not go on steering the words while somebody else is in front of you."),
            bulletBold("Say you are somewhere else — ", "that place's goals switch off, for the same reason."),
            bulletBold("A general goal survives both, ", "and lasts until the conversation ends. It was never about who you were with or where you were; it is what you came to this conversation to do."),
            bulletBold("Ending the conversation clears everything. ", "A conversation goal cannot outlive its conversation by definition."),
            emptyPara(),

            heading2("8.3  A goal is never spoken, and the guard is stated twice on purpose"),
            para("This is the strictest rule in the feature. A goal shapes which of several possible responses the app suggests, and how they are worded. It is never a topic. The instruction that reaches the AI says so before the goals are listed and again after them, and both are load-bearing — they guard different mistakes. \"Repair things between us\" is a reason to choose warmer wording, and a small catastrophe if it is read as an instruction to bring the subject up."),
            para("Because the user always chooses which suggestion is spoken, nothing can be said without their tap. The rule above is about what the app may put in front of them in the first place."),
            emptyPara(),

            heading2("8.4  A goal costs one request when switched on and nothing when switched off"),
            para("Switching a goal on asks the AI to reconsider with that goal in mind, so the suggestions on screen catch up immediately rather than at the next pause in the other person's speech. Switching one off does not: \"stop taking this into account\" is not a request for new suggestions, and it is the one case where a tap would spend money on something the user did not ask for."),
            emptyPara(),

            heading2("8.5  Where a goal appears on screen"),
            para("Goals appear as buttons in the Express Panel's Flex band — the part of the panel whose contents depend on who and where the user has said they are. They take the leading positions there, ahead of situational phrases, because a goal that will not fit cannot steer anything while a phrase that will not fit can still be typed."),
            boldPara("They are in that band because of how their content is decided, not because of what they do when tapped. ", "The obvious reading is that a goal button never speaks, so it belongs with the other non-speaking buttons; that mistakes a property of those buttons for the rule that groups them. Which goals exist at all depends on which person was chosen, which makes goals a function of that choice rather than part of it."),
            para("A goal button is marked so it can be told apart from the phrases beside it, using the same setting the user has already chosen for telling the other kinds of button apart. A second, separate marker would be one more thing to learn for no gain."),
            boldPara("One consequence to know about: with the panel as it ships, the Flex band has no room, so no goal button appears until the user gives it one. ", "That is deliberate — nothing grows on its own, and the Express Panel settings say how many goal buttons are waiting for space."),
            emptyPara(),

            // ===== 9 =====
            heading1("9.  Still Open"),
            bullet("A goal typed for one conversation only, kept for the rest of it (Section 6.5). The clearest gap.", "open"),
            bullet("Goals attached to a kind of relationship rather than a named person (Section 6.3).", "open"),
            bullet("Stamping the goals that were in force onto each saved turn, so that reviewing a past conversation can show what the user was aiming for at the time.", "open"),
            bullet("A limit on how many Flex positions goals may take before situational phrases start dropping off the end.", "open"),
            bullet("Whether any of this is discoverable. Nothing in the app tells a user that goals exist; they find the list in About Me or they do not. This is the question most worth putting to the speech and language therapists.", "open"),
            emptyPara(),

            // ===== 10 =====
            heading1("10.  Sources"),
            para("Each of these was checked while this document was written rather than recalled. Where a claim here is weaker than its source, it is marked in the text."),
            bullet("Dillard, J. P., Segrin, C., & Harden, J. M. (1989). “Primary and Secondary Goals in the Production of Interpersonal Influence Messages.” Communication Monographs, 56(1), 19–38. The primary/secondary distinction and the five secondary goals.", "sources"),
            bullet("Dillard, J. P. “Goals-Plan-Action Theory.” In The International Encyclopedia of Interpersonal Communication. Wiley. The model in summary: goals motivate plans, plans produce action.", "sources"),
            bullet("Stafford, L., & Canary, D. J. (1991). “Maintenance Strategies and Romantic Relationship Type, Gender and Relational Characteristics.” Journal of Social and Personal Relationships, 8(2), 217–242. The five maintenance strategies: positivity, openness, assurances, social networks, sharing tasks.", "sources"),
            bullet("Light, J. (1988). “Interaction Involving Individuals Using Augmentative and Alternative Communication Systems: State of the Art and Future Directions.” Augmentative and Alternative Communication, 4(2), 66–82. The four purposes of communication, each defined by its goal.", "sources"),
            bullet("Kane, S. K., Morris, M. R., Paradiso, A., & Campbell, J. (2017). “At times avuncular and cantankerous, with the reflexes of a mongoose: Understanding Self-Expression through Augmentative and Alternative Communication Devices.” CSCW '17. Proposes better support for relational maintenance strategies and the social purposes of communication as AAC research directions.", "sources"),
            bullet("Bargh, J. A., Gollwitzer, P. M., Lee-Chai, A., Barndollar, K., & Trötschel, R. (2001). “The Automated Will: Nonconscious Activation and Pursuit of Behavioral Goals.” Journal of Personality and Social Psychology, 81(6), 1014–1027. Goals activated and pursued outside awareness.", "sources"),
            bullet("Schegloff, E. A. (2007). Sequence Organization in Interaction: A Primer in Conversation Analysis, Volume 1. Cambridge University Press. The method's reticence about participants' mental states.", "sources"),
            emptyPara(),
            para("The two theories in Sections 2 and 5 were first summarized for this project in “Reframe: Academic Foundations”, Section 7. That section remains a fuller treatment of the theories themselves; this document is the current account of what was built.", { run: { italics: true, color: "595959" } }),
            emptyPara(),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    const out = docPath('Conversant AAC Conversation Goals.docx');
    fs.writeFileSync(out, buffer);
    console.log('Wrote ' + out + ' (' + buffer.length + ' bytes)');
});
