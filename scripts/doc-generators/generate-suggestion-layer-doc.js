/* Conversant AAC — The Suggestion Layer (September 30 2026)
 *
 * Ken asked for the discussion behind the suggestion-provider work to be written
 * down, on the grounds that the field moves fast and the beta has not started, so
 * bigger obstacles may still be ahead that nobody can see yet.
 *
 * Reader: Ken, and whoever next works on this. So "you" means the reader and "the
 * user" means the person using the app.
 *
 * Every measurement quoted here was taken on September 30 2026 and is marked as
 * measured. Everything read rather than measured is marked too. The project's own
 * finding that half of published platform claims turn out to be stale applies to
 * this subject more than to most.
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
        config: ["bullets", "gates", "watch", "reopen", "costs"].map((reference) => ({
            reference,
            levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
        }))
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — The Suggestion Layer", italics: true, color: "808080", size: 18, font: "Arial" })]
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
                children: [new TextRun({ text: "The Suggestion Layer", bold: true, color: "1F4E79", size: 40, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Where the App's Response Options Come From, Who Else Could Supply Them, and How the Code Was Arranged So That Answer Can Keep Changing", italics: true, color: "595959", size: 24, font: "Arial" })]
            }),
            new Paragraph({
                spacing: { before: 0, after: 240 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  September 2026  |  Last updated September 30, 2026", color: "808080", size: 20, font: "Arial" })]
            }),

            // ===== 1 =====
            heading1("1.  Why This Document Exists"),
            para("The app has a guide for choosing a service to hear with and a service to speak with. It had nothing for the third service, the one that writes the response options. That service was Anthropic's Claude, it was the only choice, and the code assumed it in seven separate places."),
            para("Ken asked four questions about it. Who else could supply this? How hard would switching be? What does each option cost, and what does it mean for privacy? And one more that turned out to reshape the answer: the app needs a narrow slice of what these services do, so are there focused options that do language well and cost less?"),
            boldPara("This document records that discussion and the work that came out of it. ", "It is written at a moment when the beta has not started, so it will be wrong about some things. The point of writing it now is that the field moves fast, and a record of why each decision was taken is what makes the next decision cheap rather than a re-derivation."),
            emptyPara(),

            // ===== 2 =====
            heading1("2.  The Third Job Now Has a Name"),
            para("The app does three things that a person could plausibly buy from somebody. It hears the other person, it speaks for the user, and it suggests what the user might say. The first two already had names in the product, and the third did not."),
            boldPara("They are now hearing, speaking and suggesting. ", "The word matters more than it looks. Naming the job is what let it become a thing the user could one day choose, a thing a document could describe, and a thing the code could put a boundary around."),
            para("A future user-facing guide to choosing among these services would sit beside the Speech Provider Guide and be called the Suggestion Provider Guide. Nobody has written it, because the measurements that would make it honest have not been taken yet. Section 11 says what those are."),
            emptyPara(),

            // ===== 3 =====
            heading1("3.  Who the Providers Are"),
            para("There are about a dozen worth naming, and they fall into four groups."),
            bulletBold("The large labs, direct. ", "Anthropic, Google, OpenAI and xAI. The best quality, the best documentation, and the highest prices."),
            bulletBold("Independents. ", "Mistral, which is French and therefore handles data under European rules, and Cohere, which sells itself specifically as the business-language company."),
            bulletBold("Hosts of open models. ", "Groq, Together and Fireworks. These companies do not make models. They run freely published ones very fast and very cheaply. Groq is built for speed, which matters more here than it does for most applications."),
            bulletBold("Resellers. ", "OpenRouter is a single account that reaches almost every model above, so a user can change model without opening a new account each time."),
            para("DeepSeek sits on its own. It is by far the cheapest and it is Chinese, which is a decision rather than a detail."),
            emptyPara(),

            // ===== 4 =====
            heading1("4.  The Gate That Decides Everything"),
            para("Conversant has no server of its own and is never going to have one. That is the decision the whole project rests on, and it is why this app can outlive the funded projects that were shelved. It has a hard consequence here: a service is usable only if a web page can talk to it directly, holding nothing but the user's own account key."),
            boldPara("That gate already ruled out a cheaper transcription service. ", "AssemblyAI costs about a third of what the app pays today and was rejected anyway, because reaching it needs a server in the middle."),
            heading2("4.1  What was measured"),
            para("Eleven services were tested from the app's own web address on September 30 2026, each with a deliberately wrong key. A readable refusal means the request left the browser and the reply came back, so a real key could work. A failure before the request leaves means the door is shut."),
            para("AssemblyAI was included on purpose as a case known to fail. Without one, a result of \"everything works\" would be equally consistent with a test that cannot detect a failure at all."),
            emptyPara(),
            simpleTable(
                ["Service", "Result", "What it means"],
                [
                    ["Anthropic", "Reached, refused the key", "Works. In use today."],
                    ["Google", "Reached, refused the key", "Works."],
                    ["Mistral", "Reached, refused the key", "Works."],
                    ["Groq", "Reached, refused the key", "Works."],
                    ["DeepSeek", "Reached, refused the key", "Works."],
                    ["OpenRouter", "Reached, refused the key", "Works."],
                    ["Together", "Reached, refused the key", "Works."],
                    ["Fireworks", "Reached, refused the key", "Works."],
                    ["Cohere", "Reached, refused the key", "Works."],
                    ["xAI", "Reached, refused the key", "Works."],
                    [{ text: "AssemblyAI (the control)", italics: true }, { text: "Blocked", italics: true }, { text: "Expected. Confirms the test can detect a failure.", italics: true }],
                ],
                [2600, 3200, 3560]
            ),
            emptyPara(),
            boldPara("Ten of the eleven are reachable, so the gate is open. ", "This is a change in the picture. The project's working assumption had been that most vendors would be closed to a browser, and that assumption came from documentation rather than from a test."),
            para("What the vendors publish is mostly a posture rather than a capability. Their advice says never put a key in a browser, which is correct advice for an ordinary web application whose operator holds one key for every user. Conversant's key belongs to the user, sits on the user's device, and never reaches the project. The objection is answered by the architecture rather than defied."),
            boldPara("One caution, and it is the same one the iPad work produced. ", "Reachability was measured with a wrong key. Nothing here tested a real conversation, real quality or real speed. Removing the believed obstacle is necessary and it is not sufficient, and anything built on this needs its own confirmation on the device."),
            emptyPara(),

            // ===== 5 =====
            heading1("5.  What It Costs"),
            para("One fact changes which number you should shop on, and it is not obvious. The app sends a long block of instructions and gets back four short sentences. That instruction block is cached, so it is billed at about a tenth of the normal rate after the first time."),
            boldPara("The result is that roughly seven-eighths of the bill is the few sentences coming back, not the long instructions going out. ", "Comparing services on their headline input price would be comparing them on the wrong number."),
            para("The figures below are for one set of four response cards. The second column assumes a twenty-exchange conversation in which the other person pauses about three times per turn, which is what the app's own records show."),
            emptyPara(),
            simpleTable(
                ["Model", "One set of cards", "Twenty exchanges"],
                [
                    [{ text: "Sonnet 4.6 (what the app used before)", italics: true }, "0.73 cents", "about 52 cents"],
                    [{ text: "Sonnet 5.5 (what it uses now)", bold: true }, { text: "0.51 cents", bold: true }, { text: "about 34 cents", bold: true }],
                    ["Haiku 4.5", "about 0.29 cents", "about 17 cents"],
                    ["Gemini Flash-Lite", "about 0.15 cents", "about 9 cents"],
                ],
                [3800, 2700, 2860]
            ),
            emptyPara(),
            para("The first two rows were measured against the live service on the app's real prompt. The other two are calculated from published prices and have not been run."),
            emptyPara(),

            // ===== 6 =====
            heading1("6.  Privacy"),
            para("What leaves the device is what the other person just said, plus whatever the user has written about themselves. That is the sensitive part and it does not change with the provider. Four things do."),
            bulletBold("Paid accounts generally do not train on it. Free ones do. ", "Google states this plainly: content on the free tier is used to improve their products and content on the paid tier is not. So offering a free tier is a privacy decision here, not a price decision, and any future guide has to say it that way."),
            bulletBold("Most providers keep a copy for about thirty days ", "to watch for abuse, and then delete it. That is the normal arrangement rather than an outlier."),
            bulletBold("Where the data lands differs. ", "Mistral is European. DeepSeek is Chinese. For some families that settles the question by itself."),
            bulletBold("The other person still has not agreed to any of it. ", "That is true of every provider and it is already on the project's list. It is the strongest argument for the direction in Section 10."),
            emptyPara(),

            // ===== 7 =====
            heading1("7.  Does Specialization Buy Anything"),
            para("Ken's fourth question was the interesting one. The app needs language and nothing else. It does not need help with code, or pictures, or protein folding. So are there focused services that do the narrow thing better and cheaper?"),
            boldPara("The first answer given was wrong, and correcting it is most of this section. ", "That answer was that no such thing exists, because the coding and reasoning skills are not separable parts that can be removed for a discount. Ken pushed back and cited Jev."),
            heading2("7.1  What Jev turned out to be"),
            para("Jev is real. TypeSafe AI released it on September 15 2026 and it is faster and cheaper than a general model by a very large factor. It is not, however, a coding model, and it writes nothing at all."),
            para("You hand Jev a messy situation and a set of questions, and it hands back decisions. A choice, a score, a yes or no with a confidence attached. Developers use it inside their programs, which is probably where the impression of a coding model comes from, but it cannot write a line of code any more than it can write a line of dialogue."),
            boldPara("Its price advantage comes from not generating text, not from being narrow. ", "Writing words one at a time is the expensive part of an AI, and Jev skips it. So Jev is evidence that not writing is cheap. It is not evidence that a writer specialized to conversation would be cheap."),
            heading2("7.2  Where the argument does hold"),
            para("Ken's point survives without Jev. Code-specialized models such as Codestral, Qwen-Coder and DeepSeek-Coder are real text-writing models, trained on one domain, and they beat general models several times their size at that domain. Specialization works, and the original answer ruled it out when it should not have."),
            boldPara("The gain is a different size, though. ", "Specializing a writer buys roughly two to three times the value per dollar. Jev's advantage is more than a hundred times, and the two numbers are not measuring the same thing."),
            boldPara("And there is no equivalent of Codestral for conversation to buy. ", "Everyday language is not a specialty. It is the base that every model is trained on, and code and math are the narrow things added on top. So there is no separate conversational skill sitting in a corner that somebody could sell on its own."),
            para("The practical version of \"buy language and skip the rest\" is the small tiers: Haiku, Flash-Lite, Ministral, and the open models. That is the same recommendation the original answer reached, for a better reason."),
            heading2("7.3  The job in this app that Jev would fit"),
            para("Every request the app makes does two things at once. It works out what kind of turn the other person just took, and it writes four sentences in the user's voice. The first of those is exactly what Jev does. The second is exactly what Jev cannot do."),
            para("Two reasons make that unattractive today. The judging rides along inside the same request as the writing, so it costs no extra round trip, and splitting it would add one on the path where waiting is the whole problem. And the judging is not what the bill is for, so moving it elsewhere saves very little."),
            boldPara("Where it could pay is the waste. ", "The app asks for fresh suggestions at every pause in the other person's speech, and a large share of those answers are thrown away unread when they keep talking. Something that costs almost nothing could tell \"they have said something new\" from \"they are mid-sentence\" before spending a full request."),
            boldPara("One boundary on that idea. ", "The nearby version, letting the app decide when a turn has finished, was considered in July 2026 and closed. Skipping a duplicate request is not the same thing as changing what appears on screen, and the two sit close enough together that the line is Ken's to draw."),
            emptyPara(),

            // ===== 8 =====
            heading1("8.  The Seam, As Built"),
            para("Ken's instruction was to draw the boundary at the suggestion level, on the reasoning that the field will keep churning and the architecture has to absorb it."),
            boldPara("The cut is at \"give me some words\", not at \"make this request\". ", "That sentence is the whole design decision and it is easy to get wrong in a way that looks like an improvement."),
            para("The obvious tidy-up is to collect the seven duplicated web requests into one shared helper. That makes adding a second cloud vendor easy, and it makes a model running on the device no easier at all, because such a model has no address, no key, no headers and no reply to read. So the boundary never mentions the web. A caller hands over a prompt and gets back text and a count of what it cost. A vendor satisfies that with a request. Something running on the machine satisfies it without a network."),
            heading2("8.1  How it is arranged"),
            bulletBold("One interface. ", "It describes a provider as something with a name, a way to complete a prompt, and optionally a way to check a key. A provider that needs no key says so, and the key checks become nothing."),
            bulletBold("One adapter today. ", "Everything specific to Anthropic lives in a single file: the address, the headers, the request shape, the model, what a key looks like, where the words sit in the reply, and what the usage fields are called."),
            bulletBold("The prompt builder knows none of it. ", "The module that assembles prompts and reads answers no longer contains the word Anthropic except in the one line that registers the adapter."),
            bulletBold("Adding a provider is a file and one line. ", "It is deliberately not a data entry, the way a speech service is. That pattern works for speech because those services are all one shape. Here there are two live request shapes plus an on-device engine, which is three shapes."),
            heading2("8.2  Two details that carry weight"),
            para("The prompt is handed over as an ordered list of parts, each marked as cacheable or not. That is how the stable half gets cached without the caller needing to know whether this provider caches at all."),
            para("Usage comes back as four separate numbers rather than one total. Cached and uncached input bill at different rates, so a single total would under-report the bill by roughly the cache hit rate, which is about ninety percent on the busy path. A cost display that reads low is worse than none in a product whose funding model is that you pay for what you use."),
            heading2("8.3  The rule that keeps it true"),
            boldPara("No caller may reach past the boundary and make its own request. ", "A function that does so still works, so nothing fails and no test goes red. It simply stops being covered by whatever provider the user chose. That is how seven copies of one request grew in the first place."),
            para("What is still vendor-shaped and outside the boundary: Settings calls the field the Claude API Key, and the pricing file holds one pair of rates rather than one per provider. A second provider has to touch both."),
            emptyPara(),

            // ===== 9 =====
            heading1("9.  The Model Change and Its Trap"),
            para("The app moved from Claude Sonnet 4.6 to Sonnet 5.5, which is newer and a third cheaper at the same tier. Changing the name of the model would have been a one-line change and would have broken the app completely."),
            heading2("9.1  What the trap is"),
            para("Leaving out the setting that controls whether the model thinks before answering means opposite things on the two models. On the old one it means do not think. On the new one it means think."),
            boldPara("Measured against the live service with the app's real prompt, three times: the model spent its entire output budget thinking and returned no usable answer on every run. ", "Not slower and pricier. No suggestions at all, reported to the user as an ordinary failure to generate, pointing at the wrong thing."),
            para("The two models also disagree about how to say no. The new one refuses the obvious spelling with an error naming the replacement, and the old one does not accept that replacement. So the setting cannot be a constant. It belongs to the model, and it now sits in a small table beside the model name, with a note saying to change both together and measure again."),
            heading2("9.2  What the change bought"),
            para("Measured like for like on the identical real prompt, three runs each, with the cache warm."),
            emptyPara(),
            simpleTable(
                ["", "Sonnet 4.6", "Sonnet 5.5"],
                [
                    ["Wait for a set of cards", "6.1 to 6.3 seconds", { text: "2.9 to 3.0 seconds", bold: true }],
                    ["Cost per set of cards", "0.73 cents", { text: "0.51 cents", bold: true }],
                    ["Four usable cards returned", "Yes", "Yes"],
                ],
                [3400, 2900, 3060]
            ),
            emptyPara(),
            boldPara("The speed is the larger prize. ", "This product exists to beat a silence of about four seconds, and the last set of tester records showed 114 waits out of 126 going over it. Halving the part of that wait the app controls is worth more than the money."),
            para("Two tests now guard the failures that would otherwise be silent: one checks that the request tells the model not to think, and one checks that the stable half of the prompt is still marked cacheable. Both were confirmed to fail when the thing they protect is removed."),
            emptyPara(),

            // ===== 10 =====
            heading1("10.  Running It on the Device"),
            para("Ken's stated destination is a suggestion engine that runs on the device itself, free and open source. That is why the boundary was drawn where it was."),
            heading2("10.1  Why it is worth wanting"),
            para("Money is the obvious argument and the weakest one. Three others are stronger."),
            bulletBold("It removes the hardest part of setup. ", "Signing up for these services is already the worst thing the app asks of a new user. An account for suggestions is a second one, with a second card and a second thing to go wrong."),
            bulletBold("It removes a consent problem that has no other solution. ", "Today the other person's words go to a company, and that person never agreed and often does not know. Running on the device makes the problem disappear rather than manage it."),
            bulletBold("It completes the founding decision. ", "No server the project has to pay for is the reason this can outlive the projects that were shelved. Running on the device removes the last outside dependency."),
            heading2("10.2  Why it is not buildable yet"),
            para("This project has already run the experiment, for speech, in September 2026. Both tablets ran out of memory until the models were made much smaller, and then the Android tablet took 64 seconds to say one sentence while the iPad never finished. Windows, a MacBook and a Chromebook all did fine."),
            para("Three things make the language version harder rather than easier. The model is ten to forty times larger. The time budget is the tightest in the app, because the whole product exists to beat a four-second silence. And a browser is the slowest way to run a model, made slower by the fact that free hosting cannot send the headers a browser needs before it will spread the work across several processor cores."),
            boldPara("None of that says no. It says the first machine this works on is a laptop, and the tablet comes later. ", "The measurement to repeat is not a model release. It is whether a small model will follow eight standing rules at once, which the app's existing live tests could answer in an afternoon."),
            heading2("10.3  The likely shape"),
            para("The app already runs this pattern twice. The device's own voice is free and works everywhere, and a paid voice sounds better and costs money. Hearing works the same way. Suggestions on the device would be a third instance of an arrangement users already understand."),
            boldPara("One warning attaches to it. ", "A worse voice still says the same words. Worse suggestions mean the user cannot say what they meant, which is the product failing at its only job. So the bar for shipping an on-device suggester as the default is higher than it was for the device voice."),
            emptyPara(),

            // ===== 11 =====
            heading1("11.  What Would Reopen Each Question"),
            para("Written down so that the next look is evidence rather than enthusiasm."),
            bulletBold("A second provider. ", "The obstacle is no longer the code. It is that nobody has checked whether a cheaper model will follow the app's standing rules, of which there are about eight running at once. That is an afternoon with the existing live tests, and it should happen before any guide is written.", "reopen"),
            bulletBold("A cheaper tier. ", "Same test. The small tiers write fine sentences and are the ones most likely to drop a rule quietly.", "reopen"),
            bulletBold("A decision model such as Jev. ", "First check whether a browser can reach it with the user's own key, the same gate as Section 4. If that fails, the question is closed before it starts.", "reopen"),
            bulletBold("Running on the device. ", "Re-run the September 2026 measurement once a year rather than tracking announcements, and watch whether users settle on laptops rather than tablets. That would change the answer years earlier than any model release.", "reopen"),
            bulletBold("The whole picture. ", "The beta has not started. Bigger obstacles than any of these may be ahead and are not visible yet, which is the reason this document exists now rather than later.", "reopen"),
            emptyPara(),

            // ===== 12 =====
            heading1("12.  What Was Measured and What Was Read"),
            para("Measured on September 30 2026, against live services, from the app's own web address or through the app's own code:"),
            bullet("Which of eleven providers a browser can reach with the user's own key, including a control known to fail.", "watch"),
            bullet("That leaving out the thinking setting on the new model returns no usable answer, three runs.", "watch"),
            bullet("Speed and cost of the old and new models on the identical real prompt, three runs each.", "watch"),
            bullet("That the app still produces four correct response cards end to end, through the six live scenario tests.", "watch"),
            para("Read rather than measured, and therefore to be treated as a starting point:"),
            bullet("Published prices for every service other than the two that were run.", "watch"),
            bullet("Data retention and training policies for every provider.", "watch"),
            bullet("What Jev is and what it costs.", "watch"),
            bullet("How much specialization buys for a code-specialized writer.", "watch"),
        ]
    }]
});

Packer.toBuffer(doc).then((buf) => {
    const out = docPath('Conversant AAC The Suggestion Layer.docx');
    fs.writeFileSync(out, buf);
    console.log('Wrote ' + out);
});
