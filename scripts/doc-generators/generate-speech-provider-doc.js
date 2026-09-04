/* Generates docPath("Conversant AAC Speech Provider Guide.docx") - how to sign up for
 * each speech service, what each one costs, and how to compare them with the bench at
 * prototypes/speech-providers.html.
 *
 * WHY THIS EXISTS. On September 2 2026 Ken could not create a Deepgram account for the
 * first beta tester, and asked what makes Deepgram compatible when other providers are
 * not. Measuring rather than trusting the record showed the recorded answer was half
 * wrong: OpenAI, ElevenLabs, Cartesia, Google and Azure all accept a browser request
 * with the user's own key. So the question stopped being "is there an alternative" and
 * became "which one, and what does it cost".
 *
 * ⚠ COST IS THE POINT OF THIS DOCUMENT, not sign-up mechanics. Ken pays during the
 * beta, but at public release every user pays their own bill - so the relative cost is
 * a product decision, not an expense line. That is why the money section comes before
 * the sign-up steps.
 *
 * ⚠ EVERY PRICE HERE IS A LIST PRICE READ ON SEPTEMBER 2 2026 AND WILL GO STALE.
 * Sources are named in the document itself so a reader can re-check rather than
 * trust it. Where a price is an estimate rather than a published per-character rate
 * (OpenAI bills speech by token), it says so.
 *
 * ⚠ SIGN-UP STEPS ARE DESCRIBED BY SHAPE, NOT BY BUTTON LABEL. Nobody here can walk
 * these flows - creating accounts is not something this project's assistant does - so
 * the steps name pages and destinations, which are stable, rather than inventing exact
 * wording, which is not. The standing rule about verifying UI details before asserting
 * them cuts both ways: where it cannot be verified, do not assert it.
 *
 * Run: node generate-speech-provider-doc.js
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

// keepNext goes on the PARAGRAPH, not on the paragraph style: setting it in the style
// definition was silently ignored, and the checker went on reporting every heading as
// able to be stranded at the foot of a page (rule S3).
function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true,
        children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true,
        children: [new TextRun(text)] });
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
function step(text, ref) {
    return new Paragraph({
        numbering: { reference: ref, level: 0 },
        spacing: { before: 0, after: 100 },
        children: [new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

function simpleTable(headers, rows, widths) {
    const headerCell = (text, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "D5E8F0" },
        margins: cellMargins,
        children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, bold: true })] })]
    });
    const bodyCell = (cell, w) => {
        const isObj = typeof cell === 'object' && cell !== null;
        const text = isObj ? cell.text : cell;
        // No size here on purpose: the house table style carries it, and a size on
        // the run would beat the style and stop it governing (checker rule S11).
        const run = isObj
            ? new TextRun({ text, italics: !!cell.italics, bold: !!cell.bold })
            : new TextRun({ text });
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

const W2 = [3200, 6160];
const W3 = [2600, 3380, 3380];
const W4 = [2400, 2320, 2320, 2320];

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, outlineLevel: 0, keepNext: true } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 26, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 220, after: 140 }, outlineLevel: 1, keepNext: true } },
        ]
    },
    numbering: {
        config: [
            { reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "dg", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "az", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "oa", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "el", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "ca", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "go", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: "use", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Speech Provider Guide", italics: true, color: "808080", size: 18, font: "Arial" })]
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
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Speech Provider Guide", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: "What each speech service costs, how to sign up for it, and how to compare them for yourself", italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  September 2026  |  Last updated September 4, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("Conversant AAC can use an online service to speak in a better voice than the device provides, and on one setup it needs an online service to hear the other person at all. Until September 2026 we believed only one company, Deepgram, would allow that from inside a web page. That turned out to be wrong: five other services will too."),
            para("So there is now a choice to make, and this document exists to make it makeable. It covers what each service costs, how to get a key for it, and how to hear and read the results side by side rather than arguing about them."),
            lead("Read the cost section first. ",
                "During the beta Ken pays the bills, so it is tempting to treat cost as a detail. It is not. When the app goes public every user pays their own, and a service that is pleasant at Ken's volume and painful at a user's has chosen itself badly. The money section is therefore section 3, ahead of the sign-up steps."),

            // ===== 2 =====
            heading1("2. Before You Start"),
            heading2("What a key is, and why the app needs one"),
            para("A key is a long password that identifies your account to a company's computers. You paste it into Conversant once, it is stored on your own device, and from then on the app talks to that company directly using it. Nothing goes through Volksswitch, and Volksswitch never sees the key or the bill."),
            para("That is the whole reason the project can keep running with no money of its own, and it is also the reason it survives if Volksswitch disappears. It does mean each user has their own account with whichever company they choose."),

            heading2("Two things are being bought, and they are separate"),
            simpleTable(
                ["", "What it does", "Who needs it"],
                [
                    ["Speaking", "The voice that says the user's words out loud", "Anyone who finds the voices built into their device disappointing. On an iPad the built-in choice is one ordinary voice or a joke voice, so this is most of the value"],
                    ["Hearing", "Turning the other person's speech into text", "Only people whose device cannot do it for free. Windows, Chromebook, Android and an iPad in the Safari browser all hear for nothing"],
                ], W3),
            emptyPara(),
            lead("The AI company cannot supply either of these. ",
                "Anthropic, whose service writes the suggested replies, takes text and pictures in and gives text back. It has no voice and no ears - there is no speech service to buy from them at any price. So a speech account is necessarily a second account alongside the AI one, rather than something that could be folded into it."),
            lead("Some services sell only one of the two. ",
                "ElevenLabs and Cartesia speak but do not hear. Deepgram, Azure, Google and OpenAI do both, and Azure and Deepgram do both from a single key."),
            lead("Only one setup truly depends on a paid service for hearing: ",
                "an iPad running Conversant as an installed app from the Home Screen. Everywhere else, the device hears for free and a paid service only changes the voice. A tester who cannot get a key is therefore not stuck; they have a plainer voice."),

            heading2("Keeping keys safe"),
            bullet("A key is a password. Anyone who has it can spend money on your account."),
            bullet("Do not send one by email or put one in a document. Type it straight into the app or the bench."),
            bullet("Every service lets you delete a key and issue a new one. If you think one has leaked, do that immediately - it costs nothing."),
            bullet("Set a spending limit where the service offers one. Every service in this document except Deepgram and Cartesia offers one, and it is the single best protection against a surprise."),

            heading2("A note on the beta arrangement"),
            para("For the beta, Ken creates an account per tester against his own card and hands over the key, and the accounts are closed when the beta ends. Two practical consequences are worth knowing before setting them up."),
            lead("Separate accounts get separate free allowances. ",
                "Several services give a monthly allowance that renews - Azure and Google especially. One account shared across several testers gets one allowance between them; an account each gets an allowance each. Azure states this as a rule rather than leaving it to arithmetic: only one free Speech resource per account, per region. For a small beta, an account per tester is both tidier to close down and materially cheaper."),
            lead("What is free during the beta may not be free afterwards. ",
                "Judge a service by what a user will pay in a year, not by what the trial credit covers. A one-time credit flatters a service that is expensive to keep."),

            // ===== 3 =====
            heading1("3. What They Cost"),
            para("These are list prices read on September 2 2026. They change, so re-check before relying on them; the sources are named at the end of this section."),

            heading2("Speaking, by price"),
            para("Charged per character of text spoken. A typical spoken sentence in this app is about 55 characters."),
            simpleTable(
                ["Service", "Per 1 million characters", "Free every month", "Notes"],
                [
                    [{ text: "OpenAI", bold: true }, "about $15 (estimated)", "none", "Billed by token rather than by character, so the per-character figure is an estimate"],
                    [{ text: "Azure Speech", bold: true }, "$16", "500,000 characters", "The free allowance renews every month and does not expire"],
                    [{ text: "Google Cloud", bold: true }, "$16 (Neural2), $30 (Chirp 3 HD)", "1 million characters (WaveNet), 4 million (standard)", "The largest recurring free allowance of any of them"],
                    [{ text: "Deepgram Aura-2", bold: true }, "$30", "none, but $200 once at sign-up", "What the app uses today"],
                    [{ text: "Cartesia", bold: true }, "roughly $5 to $37 depending on plan", "20,000 credits", "Plan-based, so the effective rate depends on how much you commit to"],
                    [{ text: "ElevenLabs", bold: true }, "$50 (Flash) to $100 (Multilingual)", "10,000 credits", "By far the most expensive per character, and sold as a monthly subscription"],
                ], W4),

            emptyPara(),
            heading2("Hearing, by price"),
            para("Charged per hour of audio sent. Conversant only sends audio while somebody is actually speaking, so an hour of conversation costs far less than an hour of billing."),
            simpleTable(
                ["Service", "Per hour of audio", "Free every month", "Notes"],
                [
                    [{ text: "OpenAI", bold: true }, "$0.36", "none", "Sends a finished recording rather than a live stream"],
                    [{ text: "Deepgram Nova-3", bold: true }, "$0.46", "none, but $200 once at sign-up", "What the app uses today, and built for live streaming"],
                    [{ text: "Google Cloud", bold: true }, "$0.96", "60 minutes", ""],
                    [{ text: "Azure Speech", bold: true }, "$1.00", "5 hours", "The free allowance renews every month and does not expire"],
                ], W4),

            emptyPara(),
            heading2("What that means in a month"),
            para("Two made-up but plausible users. A light user has about one conversation a day; a moderate user has about five. The speaking figure assumes the app keeps reusing phrases it has already fetched, which it does."),
            simpleTable(
                ["", "Light user (about 25,000 characters, 4 hours of listening)", "Moderate user (about 125,000 characters, 20 hours of listening)"],
                [
                    [{ text: "Azure Speech", bold: true }, { text: "free", bold: true }, "about $15"],
                    [{ text: "OpenAI", bold: true }, "about $2", "about $9"],
                    [{ text: "Deepgram", bold: true }, "about $3", "about $13"],
                    [{ text: "Google Cloud", bold: true }, "about $3", "about $18"],
                ], W3),

            emptyPara(),
            lead("The finding worth carrying away: Azure is free for a light user, permanently. ",
                "Its monthly allowance renews and does not expire, and a light user's whole month fits inside it. That is a different kind of offer from a one-time credit, which runs out and leaves the user facing the full rate. For a product whose users pay their own way and many of whom will be light users, a recurring free allowance is worth more than a large opening gift."),
            lead("And the trade to notice: nobody wins both halves. ",
                "Azure speaks at about half Deepgram's price and hears at about twice it. Which matters more depends on the user's device - and on most devices hearing is free anyway, which quietly settles it in Azure's favor for the majority."),
            lead("Keep this in proportion. ",
                "The AI that suggests the responses is billed separately and is likely to be the larger number for an active user. A speech service is not the whole bill and should not be chosen as though it were."),

            heading2("Where these prices came from"),
            bullet("Deepgram: their published pay-as-you-go rates for Aura-2 and Nova-3 streaming."),
            bullet("Azure: the Azure AI Speech pricing page, standard neural voice and real-time transcription, plus the free (F0) tier limits."),
            bullet("OpenAI: the API pricing page. The speaking figure is converted from their token pricing, so treat it as approximate."),
            bullet("Google Cloud: the Text-to-Speech and Speech-to-Text pricing pages, including the recurring free allowances."),
            bullet("ElevenLabs and Cartesia: their published plan pages. Both sell monthly plans rather than pure pay-as-you-go, so the per-character rate depends on the plan."),

            // ===== 4 =====
            heading1("4. What They Do With Your Words"),
            para("The prices decide what a service costs. This decides what it costs the person on the other side of the conversation, and it is the second question rather than an afterthought."),
            lead("Why this weighs more here than in most products. ",
                "What gets sent is the COMMUNICATION PARTNER'S speech. They did not choose this device, were not asked, and in most conversations there is no moment at which asking would be anything but strange. What they say is also disproportionately medical, family, or private, because that is who a person using this app talks to. Choosing a service is therefore choosing who receives those words, and it is not a decision that can be made on price alone."),
            lead("The pattern to watch for, because it is exactly where a cheap option hides its cost. ",
                "Terms often differ by PLAN, and the cheaper the plan the weaker they tend to be. Anyone evaluating on a free tier, and any tester left on one, is the most exposed - which is the opposite of what people assume."),

            emptyPara(),
            para("Read on September 3 2026, from each company's own documentation. Terms change; re-check before a real conversation is sent through any of them."),
            simpleTable(
                ["Service", "Is what you send kept?", "Used to train their models?", "What you have to do"],
                [
                    [{ text: "Azure Speech", bold: true },
                     "No. Live speech is processed in memory and not stored, provided logging is off and no custom voice is in use",
                     "No. Microsoft states customer speech is not used to improve its speech models",
                     "Nothing. This is the default"],
                    [{ text: "Deepgram", bold: true },
                     "No retention by default",
                     "Only through their Model Improvement Partnership Program",
                     "Send mip_opt_out=true with requests to be certain - see the note below"],
                    [{ text: "Cartesia", bold: true },
                     "Their data terms say customer content is not retained or used beyond providing the service",
                     "No, per those terms",
                     "Nothing, though the formal zero-retention option is enterprise only"],
                    [{ text: "OpenAI", bold: true },
                     "Yes - up to 30 days, for abuse monitoring, then deleted",
                     "No. API data is not used for training by default",
                     "Nothing, unless the 30 days is itself a problem for you"],
                    [{ text: "Google Cloud", bold: true },
                     "No, unless you switch on data logging",
                     "Only if you switch on data logging",
                     "Leave data logging OFF - see the note below"],
                    [{ text: "ElevenLabs", bold: true },
                     "Yes. Retention is ON by default, and the zero-retention option is enterprise only",
                     "Their documentation is clear that third-party providers may not train on your content; it does not plainly state their own position for ordinary plans",
                     "Nothing available on a normal plan"],
                ], [1800, 2700, 2700, 2160]),

            emptyPara(),
            lead("Deepgram: there is a switch, and it costs nothing to throw. ",
                "Their documentation says training data comes only from contractual participation in a partnership program - and also documents a per-request opt-out, mip_opt_out=true. Those two statements sit oddly together, and the sensible reading is to send the parameter rather than rely on not having signed anything. It is one word on the end of a web address."),
            lead("\u26a0 Google: the cheaper rate is paid for with the partner's words. ",
                "Google offers a substantial discount on transcription - roughly a quarter of the standard rate - in exchange for letting them keep and learn from your audio. That is a fair trade for somebody transcribing their own podcast and the wrong one here, because the audio is not yours to trade. The price quoted in the cost section above is the ordinary one, with logging off. If a figure ever looks too good against the table, this is why."),
            lead("ElevenLabs is the weakest of the six on this, and it is not close. ",
                "Retention is on by default and cannot be turned off except on an enterprise agreement. Set against being three to six times the price of the nearest good alternative, that is a second reason to want them to be clearly better before choosing them."),
            lead("What this cannot tell you. ",
                "These are published terms read on one day, not audits, and none of it is a legal opinion. The point is narrower and still worth having: on the two questions that matter - is it kept, is it learned from - four of these six are safe by default and two need something done about them."),

            // ===== 5 =====
            heading1("5. Getting Names Right"),
            para("Conversant has a \u201cHow to say it\u201d box beside every person, every place, and every Express Panel phrase. You type a respelling - \u201cShiv-awn\u201d for Siobhan - and the app swaps that spelling in at the last moment, as the words are handed to the voice. It never reaches the screen, the saved conversation, or the AI."),
            lead("The headline, and it is the one that decides how much weight to give this: the box works with every service here, including the device's own voices and the on-device option. ",
                "That is by construction rather than by luck. The app changes the TEXT, so the service is not being asked to do anything special and cannot fail to support it. Nobody choosing between these services is choosing whether the box works."),
            lead("What differs is the ceiling. ",
                "Respelling is a blunt instrument. You are guessing at spellings until one sounds right, an unusual name sometimes never quite comes out, and a spelling that works for one voice may not for another. Several of these services offer a precise alternative: you give the exact sounds of a word rather than a guessed spelling, and some keep a list of names that gets applied to everything they say. Conversant uses none of that today, and it would be separate work for each service - so this column matters only if respelling turns out not to be good enough in real use."),

            emptyPara(),
            para("Read from each company's own documentation on September 4 2026, except where a row says it was heard."),
            simpleTable(
                ["Service", "The \u201cHow to say it\u201d box", "Something more precise, if respelling is not enough"],
                [
                    [{ text: "Azure Speech", bold: true },
                     "Works",
                     "The most complete of the six: the exact sounds of a word can be given, and a list of names can be uploaded once and applied to everything that service says"],
                    [{ text: "Google Cloud", bold: true },
                     "Works",
                     "Yes - exact sounds, and a list of custom pronunciations. American English first, and still marked preview on their newest voices"],
                    [{ text: "Cartesia", bold: true },
                     "Works",
                     "Yes - exact sounds written into the sentence itself, and name lists on their newest model"],
                    [{ text: "ElevenLabs", bold: true },
                     "Works",
                     "A name list, yes. Exact sounds only on some of their models; on the rest the list does a spelling swap, which is what the box already does"],
                    [{ text: "Deepgram", bold: true },
                     "Works - heard, not assumed (August 8 2026)",
                     "Nothing. They have no markup at all and say the omission is deliberate. Their own advice is to respell, which is what the box does"],
                    [{ text: "OpenAI", bold: true },
                     "Works",
                     "No control over sounds. You can describe the delivery in a sentence - speak slowly, sound warm - which is a different thing"],
                    [{ text: "The device's own voices", bold: true },
                     "Works - heard (June 2026)",
                     "Nothing. There is no way to supply sounds or a name list through a browser, so respelling is all there is"],
                    [{ text: "On this device", bold: true },
                     "Works - measured (September 4 2026)",
                     "Nothing. The speaking model the bench uses takes a sentence and a voice and accepts nothing else"],
                ], [1800, 2300, 5260]),

            emptyPara(),
            lead("What has actually been measured, and what has only been read. ",
                "Three rows. Respelling demonstrably changes what Deepgram says - “Volksswitch” written as “Folks-switch” moved the first sound from a V to an F - and it works on the device's own voices, where a separate finding also stands: punctuation does NOT buy pauses or intonation on those voices, however much the general advice says it should. The on-device voice was settled in the bench on September 4 2026, and by a firmer method than listening: that model can be asked for the exact sounds it is about to say, so the two spellings could be compared directly rather than judged by ear. “Volksswitch” to “Folks-switch” moved the V to an F there too, and “rendezvous” to “rahn-day-voo” changed the middle vowel as intended. Everything else in the table above is documentation."),
            lead("⚠ And a practical lesson from that test, worth more than the result: one of the three names did not need respelling at all. ",
                "The on-device voice already said Siobhan correctly, so “Shiv-awn” bought nothing - the sounds came out all but identical. A respelling is a repair, and repairing what is not broken can only make it worse. Hear the real spelling first, and reach for the box only if the voice actually gets it wrong."),
            lead("Testing one is a minute's work. ",
                "Type the respelling straight into the bench's sentence box and hear it in every voice at once. That is the fastest way to find out whether a difficult name needs more than a respelling before deciding it does."),
            lead("The related thing this is NOT about. ",
                "The box is about SPEAKING. Names being misheard on the way in is the other half of the problem, most services have their own way of being told which names to expect, and the app does not use that either. Keep the two apart when judging a service."),
            lead("So what to do with this section. ",
                "If you are choosing today, do not weigh pronunciation heavily - the box works everywhere, and the difference is a ceiling nobody has hit yet. Weigh it if a name that matters cannot be got right by spelling: Azure and Google have the most room left to fix that one, and Deepgram and OpenAI have none."),

            // ===== 6 =====
            heading1("6. Signing Up"),
            para("Each of these ends the same way: you reach a page listing your keys, create one, and copy it. The steps below name the destination rather than the exact wording of each button, because the wording changes and the destination does not."),

            heading2("Deepgram"),
            para("Free credit of $200 at sign-up, and the only one of these that asks for no card at all. This is what the app uses today."),
            step("Go to console.deepgram.com and choose to create an account.", "dg"),
            step("Sign in with Google, GitHub or Microsoft rather than filling in the email form. This is worth doing deliberately - on September 2 2026 the email form would not complete, while the three sign-in buttons worked.", "dg"),
            step("Once inside, find the API Keys page for your project and create a key.", "dg"),
            step("Copy it immediately. Most services show a key once and never again.", "dg"),
            lead("If the email form will not let you continue: ",
                "the password rule is shown as faint helper text rather than as an error, and a password without a number in it leaves the button dead with nothing on screen explaining why. Use one of the sign-in buttons instead."),

            heading2("Azure Speech"),
            para("The most involved sign-up of the six, and the one with the best long-term offer: an allowance that renews every month rather than a credit that runs out."),
            lead("One key covers both speaking and hearing. ",
                "Azure sells these as two capabilities of a single Speech resource rather than as two products, so you create one thing, and its key and region are used for both. There is no second key to find. That is why the bench asks for one Azure key and one region and not two of each."),
            step("Go to azure.microsoft.com and create a free account. A card is required to prove you are a real person; there is a temporary hold of about a dollar and no charge.", "az"),
            step("In the Azure portal, create a resource of type Speech.", "az"),
            step("When asked for a pricing tier, choose the free tier, named F0. This is the step that matters - it is what keeps the account free, and it survives after the introductory credit expires.", "az"),
            step("Note the region you chose, and choose a near one. It is part of the address the app talks to, the bench asks for it separately, and it is a speed decision rather than paperwork: measured from a machine in the United States, the round trip to an eastern-US region was 108 ms and to a western-European one 266 ms. That is paid on every turn of every conversation.", "az"),
            step("Open the Keys and Endpoint page for that resource and copy one of the two keys.", "az"),
            lead("Two keys, on purpose. ", "Azure gives every resource a pair so you can replace one while the other keeps working. Either will do, and either covers both speaking and hearing."),
            lead("⚠ The free tier is one per account, per region - and this decides how to set up testers. ",
                "Azure allows only one free Speech resource in a subscription for a given region. So one account shared across several people gets one allowance between them, and when it runs out everybody is on paid rates for the rest of the month; an account each gets a full allowance each, renewing monthly. For a small group that difference is the difference between most people costing nothing and everybody costing something."),
            lead("A wrinkle worth knowing before you meet it. ",
                "Deleting a free resource leaves it in a half-deleted state for a while, and Azure will refuse to create another free one in that region until it clears. It looks like a fault and is not. Wait it out, or use a different region."),
            lead("What this means at public release. ",
                "Every user signs up for themselves, so every user gets their own monthly allowance. That makes a renewing allowance worth considerably more across many people than a one-time credit, which each user spends once and never sees again."),

            heading2("OpenAI"),
            para("The cheapest of the six overall on these figures, with no free allowance."),
            step("Go to platform.openai.com and create an account, or sign in with one you already have.", "oa"),
            step("Add a payment method and put a small amount of credit on the account. Nothing works until there is credit. The minimum is five dollars, and that is enough to test with.", "oa"),
            step("Set a monthly spending limit while you are there. This is the most useful minute you will spend on any of these services.", "oa"),
            step("Go to the API keys page and create a key. You are not asked what it is for - an OpenAI key works for everything the account can reach, unlike an Azure key, which belongs to one service.", "oa"),
            lead("⚠ A free ChatGPT plan does not pay for this, and the error says something else. ",
                "The chat website and the developer service are billed separately, so an account that has never paid has no credit here however much free use the website allows. What makes it hard to place is the answer you get: OpenAI reports having no credit with the same code it uses for too many requests, so it reads as a traffic problem when it is a billing one. Confirmed on September 3 2026 - adding the five dollar minimum turned it on and the voices worked immediately."),

            heading2("Google Cloud"),
            para("The largest recurring free allowance for speaking, and the fiddliest sign-up, because speaking and hearing are two separate services that each have to be switched on."),
            step("Go to console.cloud.google.com and create an account. A card is required; new accounts also receive a substantial one-time credit.", "go"),
            step("Create a project.", "go"),
            step("Switch on the Cloud Text-to-Speech API, and separately the Cloud Speech-to-Text API. Leaving one off is the usual reason a key appears not to work.", "go"),
            step("Go to the Credentials page and create an API key. That page also offers OAuth client IDs and service accounts; neither is wanted here.", "go"),
            lead("⚠ Ignore OAuth client IDs and service accounts, whatever the documentation suggests. ",
                "An OAuth client is for acting on behalf of somebody's Google account - reading their files, with a consent screen - which is not what this does. A service account is for one computer proving itself to another, and needs a private key file and a signature step that only a server can perform. Google's own guidance leans toward service accounts because it assumes there is a server; there is not, and an API key is what a browser can actually present. Measured on September 3 2026: both the speaking and the hearing services accept a plain API key, reporting a wrong one as an invalid key rather than refusing the method."),
            step("Restrict the key to those two services - in the API restrictions section, not the Application restrictions one above it. Google will warn you about an unrestricted key, and it is right to.", "go"),
            lead("⚠ Three different things are easy to run together here, and only the first is required. ",
                "Switching a service ON makes it available to the project at all. API RESTRICTIONS say which of the switched-on services a particular key may call - that is where Text-to-Speech and Speech-to-Text appear as choices. APPLICATION RESTRICTIONS are a separate list higher up the page offering None, Websites, IP addresses, Android apps and iOS apps, and they say where a key may be used FROM rather than what it may do. Looking for the services in that list is the natural mistake, and they are not in it."),
            lead("The Websites option is worth knowing about for later. ",
                "It ties a key to one web address, so a copied key is useless anywhere else - a protection none of the other services here offer, and a real advantage for an app that runs in a browser. Leave it on None while testing, though: the bench runs from a file on your own machine, and a website restriction would refuse it."),

            heading2("ElevenLabs"),
            para("The best-regarded voices of the six and much the most expensive. Worth hearing before ruling out on price."),
            step("Go to elevenlabs.io and create an account. The free tier needs no card.", "el"),
            step("Open your profile settings and find the API key.", "el"),
            step("Give the key the permissions it needs. A key can be issued with only some abilities switched on, and one that can speak may still be unable to LIST the voices - which fails separately and reads like a bad key when it is not. Text to speech and reading voices are the two that matter here. An existing key can be edited afterwards, so a key issued too narrowly is a correction rather than a fresh start.", "el"),
            lead("⚠ The plan and the key's permissions are separate, and fixing one does not fix the other. ",
                "Upgrading to a paid plan unlocks which VOICES may be used; it grants the key no new abilities. A key issued without permission to read voices still cannot list them on a paid plan, and the error is unchanged - which reads as though the upgrade did not work. Both have to be right."),
            step("Note that the free allowance is small - roughly ten thousand characters a month, which is a few days of ordinary use.", "el"),
            lead("⚠ A free plan cannot use their library voices through the API, only your own. ",
                "Most of the voices people know ElevenLabs for are library voices, and asking for one on a free plan is refused outright with a message about upgrading. It reads like a broken key and is not. In the bench, press Load voices to fetch the voices your own account actually has and pick from those; on a free plan that is a shorter list than the website suggests. Worth knowing before judging them on the free tier, since it is not their best voices you are hearing."),

            heading2("Cartesia"),
            para("Fast and inexpensive, and less well known than the others."),
            step("Go to cartesia.ai and create an account.", "ca"),
            step("Find the API keys page in the console and create a key.", "ca"),
            step("Copy a voice identifier from their voice library as well. Cartesia will not speak without one, and the bench has a box for it.", "ca"),

            // ===== 7 =====
            heading1("7. Trying Them Out"),
            para("The comparison tool is prototypes/speech-providers.html in the project folder. Open it in a browser; there is nothing to install."),
            step("Read section 1 first. It reports itself as the page opens: whether the browser will let this machine use its graphics hardware, which decides how fast the on-device engines can possibly be, and how big their one-time download would be here. A button beside it measures the round trip to each service - the travel time paid on every turn of every conversation - and another copies the lot for sending on.", "use"),
            step("Paste in keys for the services you want to compare. Blank ones are simply skipped.", "use"),
            step("Press Check reachability. This confirms a browser can talk to each service at all, and needs no key of your own.", "use"),
            step("For speaking: edit the sentence if you like, then press the button to speak it with every voice. The first is played automatically; press Play on any row to hear it again.", "use"),
            step("For hearing: record yourself once, then send that same recording to every service. Recording separately for each would compare the rooms rather than the services.", "use"),
            step("To try it with no service at all, tick \u201cOn this device\u201d - it starts switched off, and the first use downloads a model of a few hundred megabytes before anything is spoken or heard. See section 8.", "use"),
            step("Press Forget all keys before showing the file to anybody.", "use"),

            heading2("What to listen and look for"),
            lead("For speaking, judge it as the user's own voice, not as a demonstration. ",
                "The question is not which is most impressive but which one a person would be willing to be heard as, every day, by people who know them. Try a question, something short and blunt, and something with a name in it."),
            lead("For hearing, the differences show up on the hard words. ",
                "Every one of these will transcribe a clear sentence correctly. Include a name, a place, or a word said quickly, because that is where they diverge and that is what a real conversation is full of."),
            lead("Treat the timings as a ranking, not a measurement. ",
                "The bench waits for the whole clip before it plays anything, whereas the app starts speaking as soon as the first part arrives. So the numbers are useful against each other and are not what a user would experience."),
            lead("⚠ The one timing on the page that IS a measurement is the round trip in section 1. ",
                "It is travel time alone - the services refuse those requests and do no work for them - so it separates the two halves of a wait that otherwise arrive as one number. A slow total with a fast round trip is the service being slow; a slow round trip is the network, and no choice of service will fix it. It also belongs to the CONNECTION rather than to the machine, so it is worth taking again on each one somebody will really use: a wired network, Wi-Fi and cellular give three different answers, and cellular is usually much the worst."),

            // ===== 8 =====
            heading1("8. What We Already Know"),
            lead("A browser can reach all six. ",
                "Measured on September 2 2026 by asking each service a question with a deliberately wrong key: a plain refusal means the door is open and only the key was bad. All six refused politely. AssemblyAI, included deliberately as a service that should fail, refused to answer at all - which is what proves the test could tell the difference."),
            lead("The obstacle was never technical. ",
                "Most of these companies advise against putting a key in a web page, which is correct advice for an ordinary website holding one key for all its customers. It does not describe this app, where the key belongs to the user and stays on their device."),
            lead("What has not been tested. ",
                "Only that the door opens. Not how good the voices sound, how accurate the transcripts are, or how quickly either arrives. That is exactly what the bench is for, and it is why this document ends here rather than recommending one."),

            // ===== 9 =====
            heading1("9. Future Considerations"),
            para("Conversant starts with a literate adult using touch, and is meant to reach further than that over time - younger users, other languages, other cultures. The service chosen for speech is one of the few decisions taken now that either helps or hinders that later, which is why it belongs in a document about choosing one."),

            heading2("Why the choice made now matters later"),
            lead("A service is not only a price and a voice; it is a catalog. ",
                "Standardizing on one that speaks good American English and little else works perfectly until the first user who is eleven, or Deaf and signing in another language, or living in a household that speaks Spanish at home. At that point a narrow service has to be replaced rather than adjusted - and replacing it means redoing the work rather than changing a setting. A broad catalog is a hedge bought cheaply now."),

            heading2("Younger voices, which is the nearest and most concrete need"),
            lead("This is a real and long-standing gap in AAC rather than a hypothetical one. ",
                "For years children using these devices had only adult voices to speak with, and the first genuine children's synthetic voices were made specifically for AAC because the mainstream industry had not produced any. A child who sounds like a middle-aged man to everyone they meet is being misrepresented by their own device, every time they speak."),
            para("Where the six stand, as of September 2026. This is about what each company offers, not about what has been listened to - and see the caution below."),
            simpleTable(
                ["Service", "Breadth of catalog", "Younger voices"],
                [
                    [{ text: "Azure Speech", bold: true },
                     "The widest by a distance - over 600 voices across more than 150 languages and locales",
                     "Documented child voices exist in the catalog, and the range of ages and accents per language is far larger than anyone else's"],
                    [{ text: "Google Cloud", bold: true },
                     "Large, several hundred voices across dozens of languages",
                     "Several voices per language, though ages are not labeled as such"],
                    [{ text: "ElevenLabs", bold: true },
                     "A library of many voices, plus the ability to design or clone one",
                     "The most flexible in principle: a voice of any age can be made rather than chosen. Cloning carries its own consent questions - see below"],
                    [{ text: "Cartesia", bold: true },
                     "A library plus cloning, smaller than ElevenLabs",
                     "Same shape as ElevenLabs, from a smaller starting catalog"],
                    [{ text: "Deepgram", bold: true },
                     "Narrow - a few dozen voices, overwhelmingly English",
                     "Adult voices. This is its weakest point for where the product is going"],
                    [{ text: "OpenAI", bold: true },
                     "Eleven voices, one set, no per-language variants",
                     "Adult voices, and no mechanism to get anything else"],
                ], [1800, 3780, 3780]),

            emptyPara(),
            lead("\u26a0 Take the table as a direction, not an inventory. ",
                "Nobody here has listened to a child voice from any of these, and none of these companies labels age in a way you can filter on reliably. The definitive answer is one press of Load voices in the bench with a real key, which fetches what that account can actually use - and then listening. Treat the row for a service as a reason to go and check it, not as a finding."),

            heading2("A voice of your own, which is now far easier than it was"),
            lead("This has already been tried at scale for exactly this population, and it is worth knowing how it went. ",
                "VocaliD, founded in 2014 by a speech scientist at Northeastern University, ran a Human Voicebank that collected recordings from about twenty thousand donors in a hundred and ten countries. Donors were matched to recipients by AGE, sex and region, and their recordings were blended with whatever sounds the recipient could still make - so a child got a child's voice, and it was recognizably theirs rather than a stock one. It is the clearest precedent there is for the age problem being solved from the supply side. The company was bought in 2022 by a firm whose interest was commercial voice work for brands and broadcasters."),
            lead("What changed since is the amount of recording required, and the change is enormous. ",
                "That effort needed six to ten hours from a donor. Today several services will build a usable voice from a minute or two of speech, and the quality is good. The expensive part of the old model - collecting and processing hours of audio per voice - has largely gone away, which is probably why a voicebank became a commercial product rather than growing."),
            lead("The consequence to expect, rather than to worry about. ",
                "Because the cost has collapsed, this is now well within reach of a charity or a school rather than requiring a funded company. It is reasonable to expect organizations to appear that record children with their parents' agreement so that other children have age-appropriate voices to use - the same idea as the voicebank, at a fraction of the effort."),
            lead("The consent question is real but narrower than it first appears. ",
                "A recorded voice can be used to make that person appear to say things they did not. For a child donor the window is small and closes on its own: a voice captured at five cannot pass for the same child at ten, because the voice has changed more than any imitation would need to. What genuinely needs answering is simpler and more practical - who agreed to the recording, and where the resulting voice is kept afterwards, which is the retention question from section 4 again. A voice built from a child's recordings, held by a company whose default is to keep what it is sent, is a different proposition from one picked off a list."),
            lead("\u26a0 The constraint that actually bites is lock-in, and it is worse than ordinary lock-in. ",
                "A made voice lives inside one company's account and cannot be moved to another. That is inconvenient for a stock voice and serious for a personal one, because what is locked in is the user's IDENTITY: changing service later on price or quality would mean giving up the voice people know them by. So voice-making is a LATE decision, taken once a service has proved itself over a long stretch, rather than an early one taken while comparing. Nothing about it needs settling now, and choosing a service on the strength of its cloning would be the wrong way round."),

            heading2("Doing it on the device instead"),
            lead("The whole of this document assumes the speaking and the hearing happen somewhere else. That assumption is weakening. ",
                "Speech recognition and speech synthesis both now run acceptably inside a browser on ordinary hardware, with no service behind them. A well-known recognizer has a browser build of a couple of hundred megabytes; there are synthesis models small enough to run on a plain processor, under licenses that permit anyone to use them. The models download once and are kept, after which the machine needs no internet at all for speech."),
            para("If that path matured, it would answer several of this document's questions by removing them:"),
            bullet("No bill. The per-character and per-hour tables above would not apply, which changes the product's economics for every user rather than a few."),
            bullet("Nothing to disclose. Section 4 exists because the partner's words are sent to a company; words that never leave the device raise none of it."),
            bullet("No account, no key, no sign-up. Most of section 5 would go, and with it most of what makes setting a tester up difficult."),
            bullet("No lock-in, including for a personal voice, since the voice would live on the device with everything else."),
            lead("It is in the bench, so this can be listened to rather than argued about. ",
                "Both halves now have an entry called \u201cOn this device\u201d - one for speaking, one for hearing. They need no key and no account, and nothing said to them leaves the machine."),
            lead("\u26a0 They are the only two entries that start switched OFF, and that is deliberate. ",
                "The first use downloads the model, which is a few hundred megabytes. Nobody should set that going by pressing a button about voices, so the bench asks first and only once. Afterwards the browser keeps it and there is no further download - which is why the SECOND run is the one to judge, never the first."),
            lead("\u26a0 Whether the machine's graphics hardware is used is the first thing to check, not a detail. ",
                "The bench now reports which path it took as the page opens, before anything is downloaded, along with the size of the download this particular machine would face - which is more than three times larger on the fast path, because that path uses fuller weights. Where the graphics hardware is available the work is far quicker than on the processor alone; on the processor-only path, in a deliberately unrepresentative test setup, a single short sentence took long enough that it would be useless in a conversation. That number is not worth quoting and is not a measure of any real tablet - but it does say where the risk lies. If a local voice seems impossibly slow, look at which path it reported before concluding anything about the idea."),
            lead("What is still not known, and it is the part that decides it. ",
                "Whether the speed is good enough on a tablet rather than a desktop; whether a first-run download of that size is acceptable to somebody who just wants to talk; and how a local voice sounds beside a paid one. Those are now questions of pressing the button on real hardware rather than questions of principle."),
            lead("Why it is worth writing down now rather than later. ",
                "It does not change today's choice - a service is still needed, and the comparison above still has to be made. What it changes is how much weight to put on a long-term bet. If the destination is the device, then today's provider is a stepping stone rather than a permanent foundation, and the argument for keeping the app able to swap providers easily is stronger still - a local engine would be one more provider behind the same seam."),

            heading2("Languages and cultures"),
            para("The same split runs through language support. Azure and Google carry most of the world's widely spoken languages; ElevenLabs and Cartesia cover many; Deepgram and OpenAI are narrower, and Deepgram narrowest of all. Nothing needs deciding about this now, and it is worth knowing which way each door opens before walking through one."),
            lead("A caution about the app rather than the services. ",
                "Supporting another language is not only a matter of a voice and a recognizer: the phrases the app ships with, the questions it asks about the user, the words on its own buttons and the assumptions in its prompts are all in English today. A service that speaks fifty languages does not by itself make the product speak any of them. What the service choice decides is whether that work is possible when somebody wants it, or blocked before it starts."),

            emptyPara(),
            para("Nothing needs to change today. Deepgram works, is paid for, and has been confirmed on the actual devices. What has changed is that relying on one company is now a choice rather than a constraint - and that is a much better position to be in the next time one of them will not let a tester sign up.",
                { run: { italics: true } }),
        ]
    }]
});

Packer.toBuffer(doc).then((buf) => {
    const out = docPath("Conversant AAC Speech Provider Guide.docx");
    fs.writeFileSync(out, buf);
    console.log("Wrote " + out);
});
