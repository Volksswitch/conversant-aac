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
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  September 2026  |  Last updated September 3, 2026", size: 20, color: "808080" })] }),

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
            heading1("4. Signing Up"),
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
            step("Note the region you chose. It is part of the address the app talks to, and the bench asks for it separately.", "az"),
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

            // ===== 5 =====
            heading1("5. Trying Them Out"),
            para("The comparison tool is prototypes/speech-providers.html in the project folder. Open it in a browser; there is nothing to install."),
            step("Paste in keys for the services you want to compare. Blank ones are simply skipped.", "use"),
            step("Press Check reachability. This confirms a browser can talk to each service at all, and needs no key of your own.", "use"),
            step("For speaking: edit the sentence if you like, then press the button to speak it with every voice. The first is played automatically; press Play on any row to hear it again.", "use"),
            step("For hearing: record yourself once, then send that same recording to every service. Recording separately for each would compare the rooms rather than the services.", "use"),
            step("Press Forget all keys before showing the file to anybody.", "use"),

            heading2("What to listen and look for"),
            lead("For speaking, judge it as the user's own voice, not as a demonstration. ",
                "The question is not which is most impressive but which one a person would be willing to be heard as, every day, by people who know them. Try a question, something short and blunt, and something with a name in it."),
            lead("For hearing, the differences show up on the hard words. ",
                "Every one of these will transcribe a clear sentence correctly. Include a name, a place, or a word said quickly, because that is where they diverge and that is what a real conversation is full of."),
            lead("Treat the timings as a ranking, not a measurement. ",
                "The bench waits for the whole clip before it plays anything, whereas the app starts speaking as soon as the first part arrives. So the numbers are useful against each other and are not what a user would experience."),

            // ===== 6 =====
            heading1("6. What We Already Know"),
            lead("A browser can reach all six. ",
                "Measured on September 2 2026 by asking each service a question with a deliberately wrong key: a plain refusal means the door is open and only the key was bad. All six refused politely. AssemblyAI, included deliberately as a service that should fail, refused to answer at all - which is what proves the test could tell the difference."),
            lead("The obstacle was never technical. ",
                "Most of these companies advise against putting a key in a web page, which is correct advice for an ordinary website holding one key for all its customers. It does not describe this app, where the key belongs to the user and stays on their device."),
            lead("What has not been tested. ",
                "Only that the door opens. Not how good the voices sound, how accurate the transcripts are, or how quickly either arrives. That is exactly what the bench is for, and it is why this document ends here rather than recommending one."),

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
