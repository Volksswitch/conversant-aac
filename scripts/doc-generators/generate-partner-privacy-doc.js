/* Generates docPath("Conversant AAC Partner Privacy.docx") — everything the project has
 * decided about the ONE participant who never chose this device: the communication
 * partner.
 *
 * WHY THIS EXISTS. The partner-privacy thinking is real and settled, but it is spread
 * across a dozen places — the security backlog (SEC-7, SEC-2, SEC-6), the recording
 * indicator work, the removal of the diagnostic trace, the weekly-report rules, the
 * Beta Test Plan, the printed card generator, and the relationship-graph privacy
 * levels. Nobody can read a decision out of that spread, and the same questions were
 * being re-argued. This is the single place they live.
 *
 * ⚠ EVERY FACTUAL CLAIM HERE IS ABOUT A THIRD PARTY'S WORDS, so it may not overstate
 * or understate. Checked against shipped behavior, August 17 2026:
 *   - The audio IS sent to an online service on every configuration. There is no
 *     on-device recognition option.
 *   - The audio is NOT stored. The text is, on the device, in the conversation record.
 *   - Nothing is spoken unless the user picks it. Permanent invariant.
 *   - Nothing here claims to satisfy any recording-consent law. That is a matter for
 *     counsel. Say what happens; make no legal claim about it.
 *
 * Run: node generate-partner-privacy-doc.js
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
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "principles",
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
            children: [new TextRun({ text: "Conversant AAC — Partner Privacy", italics: true, color: "808080", size: 18, font: "Arial" })]
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
                children: [new TextRun({ text: "Partner Privacy", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "What happens to the words of the one person in the conversation who never chose this device — the decisions taken, the reasoning behind them, and what is still open", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Prepared by Claude at Ken Hackbarth's request  |  August 17, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("Everyone else in this product chose to be here. The user bought the device, set it up, and decided what it knows about them. The person they are talking with chose none of it. They walked up to someone, started a conversation, and their words are now being written down and sent to a company they have never heard of."),
            para("That is the whole of the problem, and it is a real one rather than a formality. This app is used disproportionately with clinicians, carers, family and shop staff, and what gets said is disproportionately medical, personal, or both. The partner cannot agree to any of it through the app, because the app has no way to ask them, and in most conversations there is no moment at which asking would be anything but strange."),
            para("The project has made a set of decisions about this over about six weeks, scattered across the security backlog, the recording-indicator work, the removal of a diagnostic tool, the rules for the beta's weekly reports, and the printed card that now goes on the back of the device. This document is the single place they live, so they stop being re-argued and so anyone asking “what did we decide about the other person?” has one thing to read."),
            para("It covers two related things that are easy to run together. The first is the person in the room right now, whose speech is being captured. The second is the record the app keeps about the people the user talks with — names, relationships, and how the user speaks with each of them. The rules differ, and both are here."),

            // ===== 2 =====
            heading1("2. What Actually Happens to a Partner's Words"),
            para("Stated plainly, because every disclosure the product makes has to be measured against it and none of it may be softened."),
            simpleTable(
                ["Stage", "What happens", "What that means for the partner"],
                [
                    ["They speak", "The microphone is open and the audio is streamed to an online transcription service — the browser's own on the free path, or the paid service if the user has chosen it", "Their voice leaves the room. There is no configuration in which the recognition happens on the device, so this is true for every user"],
                    ["The audio", "Discarded once it has been turned into text. Nothing keeps a recording", "There is no recording of them anywhere, and this is worth saying out loud because it is what most people assume there is"],
                    ["The text", "Written into the conversation record on the user's device — the data folder they chose, or the app's own private storage on an iPad", "Their words are kept, as text, indefinitely, on somebody else's device"],
                    ["The text again", "Sent to the AI as the context it needs to suggest replies", "What they said is read by a second company, alongside what the user has told the app about themselves"],
                    ["The reply", "Suggested only. Nothing is ever spoken unless the user taps it", "Nothing is said to them that the user did not choose. This is a permanent invariant, not a setting"],
                ], W3),
            emptyPara(),
            lead("Two things quietly make it worse, and both were deliberate choices made for other reasons. ",
                "The microphone stays on while the app is speaking, so that a partner talking over it is still heard — which also means bystanders are heard. And if the user's data folder happens to sit inside a cloud-synced folder, every conversation record is replicated to that cloud service, the partner's words included. Neither is a defect; both are consequences somebody has to know about."),

            // ===== 3 =====
            heading1("3. The Principles We Settled On"),
            para("These are the load-bearing ones. Everything built or refused below follows from them, and where a later decision looked like a close call, one of these settled it."),
            numBold("Disclosure, not agreement. ", "The app can tell somebody what it is doing. It cannot obtain their agreement, and it must never be described as though it had. A printed card, a chime and a spoken notice all disclose; none of them is consent, and nothing the product says may claim to satisfy anybody's recording law. That is a matter for counsel, and it is a question about where the user lives rather than about the code.", "principles"),
            numBold("The user discloses; the app equips them. ", "The person who can tell a partner what is happening is the person in the conversation. The product's job is to make that a one-tap job rather than a speech, and to make it possible at all for somebody who cannot speak. Every partner-facing feature is a tool for the user to use, never the app addressing the partner over the user's head.", "principles"),
            numBold("Awareness is mostly a one-time disclosure, not a continuous beacon. ", "You tell somebody once, at the start, and that is usually the end of it. Designing as though the partner needs a constant reminder produces something that nags without informing — which is exactly what the listening chime became before it was fixed.", "principles"),
            numBold("Capture is deliberate and visible. ", "The app never starts listening because it launched. The user must turn listening on by hand at least once each session before anything automatic can happen, and turning it off resets that. So a device sitting on a table is not quietly recording the room, and the user always knows whether it is.", "principles"),
            numBold("Counts, never words. ", "Anything the app sends us — usage reports, error reports, diagnostics — carries numbers and timings and never speech. A transcript leaves the device only when the user deliberately attaches one, having seen it first. This is the firmest line in the product, because the partner agreed to nothing and cannot be asked after the fact.", "principles"),
            numBold("The user's own privacy choice covers the partner too. ", "When the user marks a conversation “don't save this one,” that choice has to hold everywhere — including in the places nobody thinks about, like an error log. It has been broken twice, in exactly those places.", "principles"),

            // ===== 4 =====
            heading1("4. Reaching the Partner: the Geometry Problem"),
            para("The most useful finding in this whole area is a physical one, and it ruled out the obvious answer. The screen faces the user. The partner faces the user, which means they are looking at the back of the device. So an on-screen recording indicator — the answer every other product reaches for — reaches the partner only if they happen to lean over and glance at it."),
            para("Once that is said out loud, the available channels sort themselves by whether they physically arrive:"),
            simpleTable(
                ["Channel", "Does it reach the partner?", "What we do with it"],
                [
                    ["On screen", "Only on a glance. It faces the wrong way", "Kept, because it is the right answer for the user, who does need to know the microphone is live. The Listen button pulses red while capturing"],
                    ["Audible", "Yes — sound goes everywhere. The one channel that genuinely arrives", "A short chime when listening starts. This is the main partner-reachable signal"],
                    ["Printed, on the device", "Yes, and permanently. It sits on the surface they are already looking at", "A printed card for the back of the device or its stand. The strongest of the four, because it needs nobody to do anything"],
                    ["Spoken by the user", "Yes, and it is the most natural of them all", "A one-tap phrase in the Express Panel, so a non-speaking user can say it as easily as anybody else"],
                    ["A hardware light", "It would — the rear camera light points at them", "Deferred. See section 7"],
                ], W3),

            // ===== 5 =====
            heading1("5. What Is Built"),
            para("All of it is shipped and in testers' hands."),
            heading2("5.1 Telling the partner"),
            simpleTable(
                ["What", "How it behaves", "Why it is shaped that way"],
                [
                    ["The Listen button", "Pulses red while the microphone is live", "The user's own indicator. Deliberately not a screen-wide frame — screen space is scarce and it would not reach the partner anyway"],
                    ["The listening chime", "A short tone when listening starts. On by default; can be turned off in Settings", "Sound is the only signal that reaches somebody who is not looking at the screen"],
                    ["When the chime fires", "Once per conversation when listening resumes automatically; on every manual start when it does not", "With automatic resume on, the microphone restarts after every single exchange, so a chime each time turned a one-time disclosure into a metronome"],
                    ["The Notice button", "An Express Panel phrase reading “This device listens and speaks for me”, in a new amber color reserved for things said about the device rather than as part of the conversation", "One tap replaces an explanation. The color exists so it never reads as the user's own conversational turn"],
                    ["The printed card", "3.5 by 2.5 inches, eight to a sheet. Headline word-for-word identical to the Notice button, two sentences of detail, and a web address", "The spoken and the printed disclosure must say the same thing. Short, because a partner reads it in two seconds while deciding whether they mind"],
                    ["Tester instructions", "The Beta Test Plan asks testers to tell their partners, and says it matters more than any feature", "None of the above works if nobody uses it"],
                ], W3),
            emptyPara(),
            heading2("5.2 Protecting what was captured"),
            simpleTable(
                ["What", "How it behaves", "Why it is shaped that way"],
                [
                    ["Listening is deliberate", "Never starts on launch. Must be turned on by hand at least once a session before anything automatic can happen; turning it off resets that", "A device that has just been switched on is not recording the room"],
                    ["Don't save this conversation", "A per-conversation choice. Nothing about that conversation is written to disk", "The user's judgment about what is too sensitive to keep is better than any rule we could write"],
                    ["That choice reaches the error log", "When a conversation is private, partner speech is removed from anything logged about an error, and from any report the user copies out", "It was not always so. The error log kept a copy of exactly what the conversation record had refused to keep"],
                    ["Weekly reports", "Carry counts, timings and error descriptions. Every attachment that could hold speech is removed outright rather than filtered", "Removing the whole thing means no future change to the app can quietly start including speech again"],
                    ["Problem reports", "Attach the technical picture automatically. A transcript is included only if the user chooses to attach one", "Sending a third party's words automatically is a different act in kind from sending counts about them"],
                    ["Practice Mode", "The partner is played by the AI. No microphone is opened at all", "Rehearsal, and all our own testing, capture nobody"],
                    ["The app's own address", "The app now runs on its own web address rather than sharing one with other Volksswitch tools", "Stored conversations are reachable only by the app that wrote them, not by anything else published alongside it"],
                ], W3),

            // ===== 6 =====
            heading1("6. The Diagnostic Tool We Removed"),
            para("This is the clearest thing in the record, and it is kept because the lesson transfers rather than because the tool mattered."),
            para("In August a diagnostic recorder was built to settle a stubborn bug with the Listen button. It worked — it answered in one pass what had taken several rounds of trying to remember what had happened. It also wrote down every word the partner said, in full, and it did not honor “don't save this conversation.” Six lines apart in the same sequence, the conversation record refused to store a private conversation and the diagnostic wrote it out anyway. It was also a setting that stayed on until somebody turned it off, so it could have run for weeks unnoticed."),
            lead("The insight that resolves it: we never needed the words. ", "The entire diagnosis rests on counts. “Heard five words, then discarded five words, then heard five words again” proves the bug exactly as well as the sentence does, and reads the same whether the conversation was about the weather or a diagnosis. A redacted diagnostic is not a weakened diagnostic for this kind of problem — which is what makes the safe version practical rather than a compromise."),
            para("The tool was removed entirely and never reached a release. It will be rebuilt before the beta widens, because a complex app in the field needs one, and the rebuild carries three conditions: it records counts and structure by default, it honors the private-conversation choice from its first line, and it does not stay switched on indefinitely. A mode that does record speech may exist, but only as a per-session choice, with a plain warning that the other person's words are being written down and that they have not been asked."),

            // ===== 7 =====
            heading1("7. What We Decided Against"),
            heading2("7.1 Muting the microphone while the app speaks"),
            para("The app's own speech is picked up by its own microphone, and the fix that suggests itself is to close the microphone while it talks. It was rejected: a partner who cuts in mid-sentence would then not be heard at all, and being interrupted is a normal part of conversation rather than an error. The app filters out its own voice by recognizing what it just said instead. The cost is that a bystander speaking at that moment is also captured, which is one of the reasons section 9 matters."),
            heading2("7.2 Flashing the rear camera light at the partner"),
            para("The rear camera light is the one signal that physically points at the partner, and slowly flashing it would be the strongest continuous indicator available. It is deferred rather than rejected. Controlling that light from a web page is essentially an Android-only capability and almost certainly unavailable on the Surface tablets in use; it would add a camera permission prompt on top of the microphone one, and hold the camera open all session at a cost in battery and heat. If it is ever built it is an optional extra, off by default, and only after being tried on real hardware."),
            heading2("7.3 Claiming any legal position"),
            para("Recording law varies by jurisdiction — some places need one participant's agreement, some need everybody's. Nothing in the app, the card, or the manuals asserts that the product satisfies any of it, and no wording anywhere should drift toward implying it. The card discloses; it cannot obtain agreement, and saying otherwise would be worse than saying nothing. The question belongs to counsel, and it is a question for the user about where they live, not a claim the product can make on their behalf."),
            heading2("7.4 Sending anything a partner said, automatically"),
            para("The beta sends usage and error information without asking each time, which is a deliberate and disclosed arrangement. It has one absolute exception: no speech, ever, on any automatic path. The line is drawn there rather than at some threshold of sensitivity, because a threshold means judging the content of somebody else's words, which is precisely what we have no standing to do."),

            // ===== 8 =====
            heading1("8. A General Orientation to Recording Law"),
            para("Section 7.3 says the product makes no legal claim, and that stands. This section is the other half of it: a rough map of the territory, so that the decisions above can be read against something rather than against nothing. It is background, not advice."),
            lead("Three caveats, and they are not boilerplate. ", "None of this is legal advice and none of it has been checked by a lawyer. Recording law changes, and several of the rules below turn on court decisions rather than on the wording of a statute, so two people can read the same state's law differently and both be reasonable. And it varies by where the user is standing at the time, not by where they live or where we are — a user who travels crosses between regimes without noticing."),
            heading2("8.1 The distinction almost everything turns on"),
            para("In the United States, the federal wiretap statute and most state laws permit a recording made by somebody who is part of the conversation. That is usually called one-party consent, and it is the ordinary case: the user is a participant, so their own device recording their own conversation is the situation the law already contemplates."),
            para("A minority of states instead require every participant to agree. The states usually named in that group are California, Connecticut, Delaware, Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, Nevada, New Hampshire, Oregon, Pennsylvania and Washington — though the exact membership is genuinely disputed, several of those states treat a face-to-face conversation differently from a phone call, and the count moves as courts rule. Treat that list as a signal to ask a lawyer, never as an answer."),
            lead("What follows for this product is that the user is on the ordinary side of the line in most of the country, and on the stricter side in a handful of populous states. ", "Which means the safe design is the one that satisfies both, and that is what has been built."),
            heading2("8.2 Why notice does more legal work than it looks like"),
            para("In the stricter states, agreement generally does not have to be a signature or a spoken yes. Being told plainly that recording is happening, and then carrying on talking, is widely treated as agreeing by conduct. That is why the chime, the card and the Notice button are not merely courtesies: they are the mechanism by which a partner can be said to have known and continued anyway."),
            para("Two conditions come with it, and both are already the design. The notice has to come before or at the start, not afterwards — a disclosure made once the conversation is over is not agreement to anything. And it has to actually reach them, which is the geometry problem in section 4 restated as a legal point rather than an ethical one."),
            heading2("8.3 Four generalizations that bear directly on decisions we have taken"),
            simpleTable(
                ["Generalization", "What it means here"],
                [
                    ["Most laws protect a conversation the parties reasonably expected to be private", "A clinic room or a kitchen sits squarely inside that. A shop counter or a crowded waiting room sits much further outside it. The same app is doing different things in the two places"],
                    ["The laws generally cover the CONTENTS of a communication, not just an audio file", "Do not assume that discarding the audio and keeping only the text puts the product outside them. It is a real reduction in what is held and worth saying, but it is not an exemption"],
                    ["Participant recording protects the user only for conversations they are part of", "A bystander at the next table is not talking to the user, so nothing about the user being a participant helps there. This is the strongest reason section 9 is not just tidiness"],
                    ["Sending the words to a company to be transcribed is a separate question from recording them", "In the United States it is mostly folded into the same analysis. In Europe it is its own question, with the transcription and AI companies as processors handling somebody else's words"],
                ], W2),
            heading2("8.4 Outside the United States, in one paragraph each"),
            para("In the United Kingdom and the European Union, a private individual recording their own conversations for their own purposes is generally treated as a personal or household activity and falls outside the main data-protection regime — an exemption that has been read narrowly where recording spills over onto other people or into public space. The direction of travel is that a purely personal communication aid is fine and something that systematically captures the public is not."),
            para("In Canada, the criminal code takes the one-party position: a participant may record. In Australia the rules are set state by state and several states require every party to a private conversation to agree, so it resembles the American patchwork more than a single national rule."),
            heading2("8.5 Two things people expect to apply here, which do not"),
            para("Medical privacy law in the United States binds hospitals, clinics and their staff. It does not restrict a patient recording their own appointment. What can restrict it is the facility's own policy, which is a different thing from law and is often stricter — the same is true of schools and workplaces. So a partner objecting on those grounds may be right about their employer's rules and wrong about the law, and the honest answer is that the user should respect the objection either way."),
            para("There is a plausible argument that a device somebody uses in order to speak at all is different in kind from surveillance, and that a communication aid should not be judged as a recorder. It is an argument, not a settled rule anywhere we are aware of, and nothing in this product should be built on the assumption that it would succeed."),
            heading2("8.6 Where all of this lands"),
            para("The generalizations converge on the same posture from several directions: the user is a participant, the partner is told before anything is captured, the audio is not kept, the text stays on the user's own device, and the user can decline to keep a conversation at all. That is the design already in section 5, and it was arrived at on ethical grounds rather than legal ones — which is the good news, because it means the law is not being relied on to excuse anything."),
            lead("The one place the reasoning genuinely runs out is bystanders. ", "Every protection above rests on the user being a participant and the partner having been told. A stranger at the next table is neither, and no amount of disclosure to the person in front of the user reaches them."),

            // ===== 9 =====
            heading1("9. Bystanders, and More Than One Partner"),
            para("Everything above assumes one partner speaking to the device. Two situations break that assumption and neither is solved."),
            lead("Bystanders. ", "The microphone hears whoever is nearby. In a waiting room or a shop, people who are not part of the conversation are transcribed into the record alongside the person the user is actually talking to. They have been told nothing, and there is no card on the back of the device pointed at them."),
            lead("More than one partner. ", "The app assumes a single partner. Several people in a conversation — knowing who said what, and who a reply is aimed at — is a future capability, and the privacy question arrives with it: several people, none of them told, all in one record."),
            para("Both have the same eventual answer, and it is already on the roadmap for a different reason. Recognizing the partner's voice — planned as part of situational awareness — lets the app keep what the recognized partner says and drop everything else. That was conceived as the robust fix for the app hearing its own voice; it is at least as valuable as a privacy measure, because it turns “we record the room” into “we record the person you are talking to.” Worth remembering when it is prioritized: it pays for itself twice."),

            // ===== 10 =====
            heading1("10. The Other Sense: Data About People"),
            para("The app also holds a record of the people the user talks with — who they are, how they are related, and increasingly how the user speaks with each of them. That is information about a third party too, and it is governed by a different set of rules."),
            simpleTable(
                ["Rule", "What it means in practice"],
                [
                    ["The user decides who exists", "Nobody is added automatically. A person the user chooses not to record is simply absent"],
                    ["A person can be marked private", "Their details reach the AI so that it does not guess wrong, but it is told never to raise them on its own initiative. Their name is never volunteered"],
                    ["Nothing is disclosed by the app", "As with everything else, a fact reaches the partner only if the user taps a card carrying it. The guarantee is the tap, not the storage"],
                    ["How the user talks with a person shapes wording only", "The record can say that the user is more relaxed with their mother, or that they want to repair things with a brother. None of it is a topic the AI may raise — stated twice in the instructions, because “repair things between us” read as an instruction to bring it up would be a catastrophe"],
                    ["A partner may be invited to describe the relationship, never approached", "The user invites; the app never contacts anybody. The user sees every answer and can discard any of it, it is marked as second-hand, and it never outranks what the user said about themselves"],
                    ["Partner answers stay with the user", "Unless the user chooses to share them back. A mother answering about her son is answering about their relationship, and it is not ours to circulate"],
                ], W2),

            // ===== 11 =====
            heading1("11. The Beta's Exception, and When It Ends"),
            para("The product's promise is that nothing leaves the device except what has to — the partner's words to be transcribed, and the conversation to the AI for suggestions. During the beta there is a third thing: usage and error information sent back automatically about once a week."),
            para("It carries counts and timings only and never speech, so no partner's words are in it. But it is still an exception to a promise the documents make in plain terms, and it has to be stated as one in the Product Overview and in tester onboarding rather than buried. Testers are told, in the plan they agree to, exactly what is in a report, and the app itself lists everything it has ever sent."),
            lead("This arrangement ends with the beta, and that is a scheduled change rather than a preference. ", "Automatic sending is on by default now because participants are told it is part of taking part, and because opt-in would lose exactly the tester who quits in week two — the one most worth hearing from. Neither reason survives contact with somebody who simply downloaded the app. A public release that still defaults to sending would break a promise made in writing."),

            // ===== 12 =====
            heading1("12. What Remains Open"),
            numBold("The legal question. ", "Whether, and where, any of this needs the partner's agreement rather than merely their awareness. Section 8 is an orientation, not an answer; the answer needs a lawyer. Nothing in the product waits on it — the design was reached on other grounds and happens to sit on the safe side of every regime described there — but the wording of the card and the manuals would change if the answer were surprising, and a user who travels crosses between regimes without being told.", "open"),
            numBold("The web address on the card. ", "The card points a curious partner at the app's website. There is nothing there written for them — a short page addressed to the person being recorded, rather than to the person buying the device, is the missing piece.", "open"),
            numBold("The diagnostic rebuild. ", "Needed before the beta widens, on the three conditions in section 6.", "open"),
            numBold("The camera light. ", "Only worth revisiting after somebody has tried it on the actual hardware.", "open"),
            numBold("Bystanders and multiple partners. ", "Waiting on partner voice recognition, which is worth prioritizing partly for this.", "open"),
            numBold("Encryption of the stored conversations. ", "Today the protection is the device's own login and disk encryption. A passphrase over the conversation files is a real feature, and it costs the simplicity of being able to copy a file between machines. Warranted before any clinic or shared-device deployment.", "open"),
            numBold("Flagging a card that carries a private detail. ", "The app knows which private facts it handed the AI, so it could mark any suggestion containing one before the user taps it. That would make an accidental disclosure visible at the moment it matters.", "open"),
            numBold("One residual in the automatic reports. ", "Error descriptions are the app's own wording, but a failure to make sense of an AI response could in principle quote part of it, and that response is about the conversation. Descriptions are capped short. If that is ever judged too loose, the fallback is to send only what kind of error occurred and how often, and take the wording from a report the user chose to send.", "open"),

            // ===== 13 =====
            heading1("13. The One-Paragraph Version"),
            para("The communication partner is the only person in this system who did not choose to be in it. We cannot ask their permission through a device they are not holding, so we do the next thing: we make it quick and easy for the user to tell them, through a chime they can hear, a card they can read, and a button that says it out loud in one tap. We keep their words as text on the user's device and nowhere else, we never send those words to ourselves automatically, and we honor the user's decision that a particular conversation should not be kept — everywhere, including the places nobody looks. We claim no legal position, and we make no promise we have not checked against what the app actually does."),
        ]
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Partner Privacy.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
