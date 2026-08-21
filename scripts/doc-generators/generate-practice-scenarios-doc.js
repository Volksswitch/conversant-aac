// Generates docPath("Conversant AAC Practice Scenarios.docx") — how a practice
// scenario is defined, personalized, and created.
//
// ⚠ THIS DESCRIBES A FEATURE THAT IS NOT BUILT (Ken, August 20 2026). He asked for it
// written as finished documentation, so that if the feature goes ahead this document is
// the template for how it gets documented rather than a proposal that then has to be
// rewritten. Everything said about how practice works TODAY is true as shipped; the
// details box, the behavior setting, the per-scenario voice, and all of sections 6 and 7
// do not exist yet. The status panel on the title page says so — keep it until they do.
//
// What is settled and must not be softened if this is revised:
//   - A scenario is a CHARACTER BRIEF, not a script. Nothing is pre-written.
//   - The full range of partner behavior is available, and WHICH one is encountered is
//     the user's choice, held on the scenario (Ken, August 20 2026).
//   - The partner is difficult about the SITUATION, never about the user's disability
//     or how they communicate. That line holds at every setting and is not adjustable.
//   - Practice cannot invent facts about the user's life — the details box and Reframe
//     are how real specifics get in. That is the standing honesty rule, not a limit of
//     practice mode, and section 7.3 is built to demonstrate it.
//
// ASSUMED, PENDING KEN'S CALL: that the behavior setting MOVES during a conversation in
// response to what the user says, rather than holding fixed. Section 5.2 is the part to
// rewrite if he decides otherwise.
//
// Run: node generate-practice-scenarios-doc.js
const { docPath } = require('./doc-paths');   // resolves output, whatever the CWD
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
function leadPara(label, text) {
    return new Paragraph({
        spacing: { before: 0, after: 160 },
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
function stepBold(label, text, ref) {
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

// A worked example is shown as the filled-in form, so "how a scenario is defined" is
// literally what the reader sees: the label on the left, what was typed on the right.
// Italic = came with the app, plain = what this user added. Section 7.1 leans on that
// distinction explicitly, so do not restyle one without the other.
function exampleTable(rows) {
    return simpleTable(["What the app asks", "What is filled in"], rows, [2900, 6460]);
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
            { reference: "personalize",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Practice Scenarios", italics: true, color: "808080", size: 18, font: "Arial" })]
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
                children: [new TextRun({ text: "Practice Scenarios", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "How a practice scenario is defined, how to make one your own, and how to build a new one for something coming up", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 40 },
                children: [new TextRun({ text: "Prepared by Claude at Ken Hackbarth's request  |  August 20, 2026", size: 20, color: "808080" })] }),
            new Paragraph({ spacing: { before: 0, after: 300 },
                children: [new TextRun({ text: "Last updated: August 20, 2026", size: 20, color: "808080" })] }),

            new Paragraph({
                spacing: { before: 0, after: 320 },
                shading: { type: ShadingType.CLEAR, fill: "FFF4E5" },
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: "E8A33D" },
                          bottom: { style: BorderStyle.SINGLE, size: 6, color: "E8A33D" },
                          left: { style: BorderStyle.SINGLE, size: 6, color: "E8A33D" },
                          right: { style: BorderStyle.SINGLE, size: 6, color: "E8A33D" } },
                children: [new TextRun({ text: "  Status: this describes a feature that has not been built. It is written as finished documentation on purpose, so that if the feature goes ahead this is the shape its documentation takes. What it says about how practice works today is true of the shipped app; the details box, the behavior setting, the scenario voice, and everything in sections 6 and 7 do not exist yet.  ", italics: true, size: 20, color: "7A4B00" })] }),

            // ===== 1 =====
            heading1("1. What a Practice Scenario Is"),
            para("Practice lets you rehearse a conversation with nobody else in the room. The app plays the other person: it speaks their side out loud, and you pick your replies from the same cards you would use in a real conversation. The microphone stays off the whole time, so nothing you say is being listened for and there is nothing to get wrong."),
            para("The thing worth understanding before changing any of it is what a scenario actually contains, because it is not what most people expect."),
            leadPara("A scenario is a description of a person, not a script. ", "There is no list of questions the other person will ask, no planned order, and no branching. A scenario says who they are, what they want out of the conversation, and how they behave. Everything they actually say is made up on the spot, in response to what you just said."),
            para("Two things follow from that, and they are why this document is short."),
            bulletBold("The same scenario is never the same twice. ", "You can practice the doctor visit five times and have five different conversations. Nothing is replayed."),
            bulletBold("Changing a scenario means changing a description. ", "You are not editing a flowchart or writing dialogue. You are telling the app more about who this person is, in ordinary sentences, the way you would describe them to a friend."),
            emptyPara(),
            para("The app comes with six ready to use, covering a service encounter, meeting someone new, a medical visit, catching up with a friend, a job interview, and a guided tour of the buttons. You can practice any of them without changing anything. The rest of this document is about making them yours, and about adding your own."),

            // ===== 2 =====
            heading1("2. What Defines a Scenario"),
            para("Every scenario — the ones that came with the app and the ones you make — is built from the same eight things. You will recognize the first three from the card you tap to start."),
            simpleTable(
                ["Part", "What it is", "Who it is for"],
                [
                    ["Name", "What the scenario is called", "You, on the list"],
                    ["Kind", "Social, Practical, Professional, Medical, or Personal", "You, for finding it"],
                    ["One-line summary", "A sentence under the name", "You, for telling two apart"],
                    ["Who speaks first", "Them or you", "The app"],
                    ["Who they are", "A short description of the person: who they are, what they want from this conversation, and how they normally come across", "The app. This is the heart of it"],
                    ["The kind of encounter", "A few words on the tone, such as a relaxed chat between friends, or a formal hearing", "The app, and the replies it suggests to you"],
                    ["How they are behaving", "Warm, businesslike, skeptical, hurt, angry, and so on. Section 5", "You. This is the part you change most"],
                    ["Details for this practice", "Anything specific you want them to know: names, why you are there, what happened. Section 4", "The app, and your own suggested replies"],
                ], [1900, 4700, 2760]),
            emptyPara(),
            para("A ninth setting sits alongside them, covered in section 3: the voice this person speaks in."),
            leadPara("Only two of the eight are ever required. ", "A name, and a description of who they are. Everything else has a sensible starting point, so a scenario you throw together in a minute still works."),

            // ===== 3 =====
            heading1("3. Their Voice"),
            para("Each scenario has its own voice setting, kept on the scenario. Set the doctor's voice once and the doctor sounds like that from then on, without you touching anything before each practice. The friend can sound like somebody else entirely."),
            para("If you leave a scenario's voice alone it uses the general practice voice from the Speech settings, which in turn defaults to picking any voice that is not yours — so the other person never sounds like you, even if you have never set any of this up."),
            leadPara("One thing to know before changing the general practice voice. ", "The spoken help in Settings, which reads out what a control does when you tap the question mark, uses that same general voice. It has to sound like somebody other than you, or the app explaining itself sounds like you talking to yourself. Setting a voice on an individual scenario does not affect it — only the general one does."),

            // ===== 4 =====
            heading1("4. Making a Built-In Scenario Your Own"),
            para("The six scenarios that come with the app are deliberately generic. A kind family doctor is a reasonable person to practice with, but they are not your doctor, they do not know why you are there, and they will never mention the thing you are actually worried about saying."),
            para("Every scenario has a box called Details for this practice. Whatever you write there becomes part of who that person is."),
            heading2("4.1 How to do it"),
            stepBold("Open Settings and go to the Practice tab. ", "Every scenario is listed there.", "personalize"),
            stepBold("Tap the pencil on the scenario you want to change. ", "This opens it for editing rather than starting it.", "personalize"),
            stepBold("Type into Details for this practice. ", "Plain sentences. There is an example in faint gray text showing the kind of thing that helps.", "personalize"),
            stepBold("Set how they are behaving, if you want something other than the usual. ", "Section 5.", "personalize"),
            stepBold("Tap Done. ", "What you wrote stays with that scenario, so it is there the next time and every time after. You never retype it.", "personalize"),
            emptyPara(),
            heading2("4.2 What is worth writing"),
            para("There are no set fields to fill in — no box for the doctor's name, no box for your diagnosis. That is deliberate. What matters about a visit to a rheumatologist and a visit to a physical therapist have almost nothing in common, so any list of fields would be wrong for most visits while still costing you the typing. One box, one thought."),
            para("Things people find useful to put in:"),
            bullet("Who they are exactly: their name, their job, how long you have known them."),
            bullet("Why you are there: the appointment, the complaint, the news you have to give them."),
            bullet("What happened last time, if it matters."),
            bullet("What you are hoping to get out of it."),
            bullet("What you would rather not talk about."),
            emptyPara(),
            para("You do not have to fill it in. A scenario with the box empty behaves exactly as it did before you opened it."),
            heading2("4.3 What the details change"),
            para("They shape two things. The other person knows them, so they can ask about the right knee and call you by name. And your own suggested replies know them, so the cards are about your actual situation from the very first turn, instead of waiting for the other person to raise it."),
            leadPara("This matters more than it sounds. ", "The app will not make up facts about your life. It will not invent that you have been taking the tablets for three weeks, or that the sign was hidden behind a tree. That rule is what stops the app putting words in your mouth that are not true. The details box is how you tell it what is true, so it can build on it — anything you write there is treated as fact."),

            // ===== 5 =====
            heading1("5. How They Are Behaving"),
            para("Every scenario the app comes with plays a pleasant person. That is the right place to start and the wrong place to stop. The conversations people most need to rehearse are the difficult ones, and rehearsing a difficult conversation with somebody unfailingly warm teaches you nothing about the conversation you are dreading."),
            para("So each scenario has a setting for how the other person is behaving today. The person stays the same; their mood does not. You choose it, and you can change it between one practice and the next."),
            heading2("5.1 The choices"),
            simpleTable(
                ["Setting", "What they are like"],
                [
                    ["Warm and easy", "Friendly, patient, on your side. Where the built-in scenarios start"],
                    ["Businesslike", "Polite and efficient. Not unkind, but not warm either"],
                    ["Distracted or rushed", "Short on time, half paying attention, wants to move things along"],
                    ["Skeptical", "Not convinced. Asks for reasons, pushes back on what you say"],
                    ["Brushing you off", "Dismissive. Treats what you are saying as not really the point"],
                    ["Hurt", "Upset by something, and it is about you. More wounded than angry"],
                    ["Angry with you", "Openly annoyed, and saying so"],
                    ["In my own words", "Describe how they are being, if none of the above is quite it"],
                ], [2700, 6660]),
            emptyPara(),
            para("They are listed easiest to hardest, so working down the list turns up the difficulty on the same conversation. It is worth doing it that way: have the conversation once with somebody warm, then again with somebody skeptical, then again with somebody angry."),
            para("Hurt and angry are kept apart on purpose, and so are skeptical and dismissive. They are not four strengths of the same thing. An ex-partner is hurt, a magistrate is skeptical, a bad customer service line is dismissive — and each of those needs something completely different from you. That is the whole reason to practice them separately."),
            heading2("5.2 They can be won over, and they can be lost"),
            para("Whichever setting you choose is where the conversation starts, not where it stays. The other person reacts to what you actually say. Handle a skeptical person well and they come round; be short with somebody already hurt and it gets worse."),
            para("This is the point of the whole thing. The value of rehearsing is finding out what you can say that changes the temperature — and that is exactly the experiment that is hardest to run on a real person, because a real person has to live with the result."),
            para("They do not give ground easily. If somebody folds the moment you say something reasonable, the practice is flattering you, and walking into the real conversation over-confident is worse than not having practiced at all."),
            heading2("5.3 One thing they never do"),
            para("At every setting, including the hardest, the other person is difficult about the situation — the appointment, the bill, the breakup, the ticket. They are never difficult about your disability or about the way you communicate. They do not get impatient with how long you take to answer, and they do not remark on the device."),
            para("That line is not adjustable, and it is worth saying why. Practice happens on your own, in private, with nobody there. An app that turned on the person using it, in the one place they are meant to be able to try things safely, would be repeating the experience this whole product exists to make rarer. Every other kind of difficulty stays available to you."),

            // ===== 6 =====
            heading1("6. Making a New Scenario"),
            para("The built-in six cover the ordinary kinds of conversation. They do not cover the conversation you are actually losing sleep over, which is usually a specific one, coming up, that you get one attempt at."),
            para("On the Practice tab, New scenario offers three ways in."),
            heading2("6.1 Describe it in a sentence"),
            para("The quickest, and the one to use unless you have a reason not to. Type what the conversation is, the way you would say it out loud:"),
            new Paragraph({ spacing: { before: 0, after: 160 }, indent: { left: 720 },
                children: [new TextRun({ text: "“I need to tell my girlfriend Sarah that I want to break up. We have been together two years and she has no idea this is coming.”", italics: true })] }),
            para("The app writes the scenario from that — the name, the kind, who she is, what she wants from the conversation, and the tone. Everything it writes is then in front of you to change. It is a starting point that cost you one sentence, not a finished thing you have to accept."),
            heading2("6.2 Start from one that already exists"),
            para("Pick any scenario and choose Make a copy. You get everything it had, under a new name, and change only the parts that differ. Good for a variation on something you already practice: the same doctor, but the appointment where you have to give them bad news."),
            heading2("6.3 Fill it in yourself"),
            para("An empty form with the eight parts from section 2. Complete control, most typing. Worth it when you know exactly who this person is and would rather write it than edit it."),
            heading2("6.4 Your scenarios are yours"),
            bulletBold("They are kept with your data, ", "alongside your people, your places and your saved conversations, so they travel with everything else and are not lost when the app updates."),
            bulletBold("They can be deleted. ", "Many are for one occasion — the interview happens, the hearing is over — and there is no reason to keep them on the list afterward. Deleting asks you to confirm first."),
            bulletBold("The built-in six cannot be deleted, ", "but anything you changed on them can be undone, which puts them back the way they came."),

            // ===== 7 =====
            heading1("7. Worked Examples"),
            para("Four scenarios, shown as the filled-in form. This is all there is to defining one."),
            heading2("7.1 A visit to the doctor, made personal"),
            para("The scenario that came with the app, with two boxes filled in. Nothing else was touched."),
            exampleTable([
                ["Name", { text: "A visit to the doctor", italics: true }],
                ["Kind", { text: "Medical", italics: true }],
                ["One-line summary", { text: "A doctor asks about how you have been feeling.", italics: true }],
                ["Who speaks first", { text: "They do", italics: true }],
                ["Who they are", { text: "A kind, unhurried family doctor. You are their patient at a routine visit. They ask how you have been feeling, follow up gently on what you say, and are reassuring. They ask one thing at a time and never lecture.", italics: true }],
                ["The kind of encounter", { text: "A calm, respectful medical appointment", italics: true }],
                ["How they are behaving", "Warm and easy"],
                ["Details for this practice", "Dr. Alvarez, my rheumatologist. I have been seeing her about two years. I am there about my right knee, which has been worse since March. I want to ask about changing the medication because the current one makes me tired all day, and I am worried she will think I am making a fuss."],
                ["Their voice", "Serena"],
            ]),
            emptyPara(),
            para("The rows in plain text are what was added; everything in italics came with the app. That is the whole of personalizing a scenario. The last sentence in the details box is the one that will change the conversation most, because it tells her something about you that she can respond to."),

            heading2("7.2 Breaking up with a partner"),
            para("Written from a single sentence, then edited. The behavior setting is doing most of the work here."),
            exampleTable([
                ["Name", "Telling Sarah it is over"],
                ["Kind", "Personal"],
                ["One-line summary", "The conversation I have been putting off."],
                ["Who speaks first", "I do"],
                ["Who they are", "Sarah, my girlfriend of two years. She thinks we are fine and has no idea this is coming. She loves me and wants to understand why. She will ask what she did wrong, and she will look for a way to fix it."],
                ["The kind of encounter", "A private conversation between two people who care about each other"],
                ["How they are behaving", "Hurt"],
                ["Details for this practice", "We live together. This is happening in our kitchen. I am not leaving for anyone else and I need her to believe that. Her sister is getting married in six weeks and we were both going."],
                ["Their voice", "Ava"],
            ]),
            emptyPara(),
            para("Note that this one opens with you. The app offers you ways to start rather than waiting for her to speak, which is the hard part of this particular conversation and the bit most worth rehearsing."),

            heading2("7.3 Challenging a speeding ticket"),
            para("A one-off, for a date already in the diary."),
            exampleTable([
                ["Name", "Traffic court, October 14"],
                ["Kind", "Professional"],
                ["One-line summary", "Contesting the ticket in front of a magistrate."],
                ["Who speaks first", "They do"],
                ["Who they are", "A magistrate hearing a contested traffic ticket. They have a full list and limited time. They have heard every excuse and are not impressed by any of them, but they are fair and will listen to a specific factual point. They ask direct questions and expect direct answers."],
                ["The kind of encounter", "A formal hearing"],
                ["How they are behaving", "Skeptical"],
                ["Details for this practice", "Cited at 38 in a 30 zone on Bellwood Road, June 2. The speed limit sign at the north end is hidden behind an overgrown tree and I have a photograph. I am not disputing the speed, I am disputing that the limit was posted where a driver could see it. I have no prior tickets."],
                ["Their voice", "Daniel"],
            ]),
            emptyPara(),
            para("The details box is carrying real weight here. Without it the app would decline to invent the road, the speed or the tree, and your suggested replies would stay vague — which is exactly what you must not be in front of a magistrate. Because you wrote those facts down, the cards can use them."),

            heading2("7.4 The same hearing, harder"),
            para("A copy of 7.3 with one row changed, kept beside it so you can do the conversation twice."),
            exampleTable([
                ["Name", "Traffic court — bad day"],
                ["How they are behaving", "Brushing you off"],
                ["Everything else", { text: "Unchanged from 7.3", italics: true }],
            ]),
            emptyPara(),
            para("Copying a scenario to change one line is the normal way to build a ladder for yourself. Practice it warm, practice it skeptical, practice it with somebody who is not listening. By the fourteenth you will have said it out loud a dozen times."),

            // ===== 8 =====
            heading1("8. What Practice Does Not Do"),
            para("Worth being straight about, so the rehearsal is worth what you think it is."),
            bulletBold("It is not a prediction. ", "The app does not know your doctor or your girlfriend. It plays somebody plausible, built from what you wrote. The real person will say something you did not practice."),
            bulletBold("It does not know anything you have not told it. ", "It will not invent your medical history or the details of your case, and it will not guess. If a fact matters, put it in the details box."),
            bulletBold("It cannot tell you whether you did well. ", "Practice is for rehearsal, not scoring. Nothing is graded and nothing is reported."),
            bulletBold("It is not listening. ", "The microphone is off for the whole of a practice. The only voice in the room is the app."),
            emptyPara(),
            para("Practice conversations are saved with your others and marked as practice, so you can read one back later, and telling them apart from real ones is never in doubt."),
            leadPara("Ending one takes a single tap. ", "End conversation, on the main screen, stops a practice immediately, whatever is happening in it. You never have to go into Settings to get out, and you never have to reach the end of a conversation you have stopped wanting to have."),
        ]
    }]
});

Packer.toBuffer(doc).then(buf => {
    const out = docPath("Conversant AAC Practice Scenarios.docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out);
});
