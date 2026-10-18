/* Generates docPath("Conversant AAC Language Support Design.docx") - how Conversant
 * would support languages other than English, starting with Spanish for bilingual
 * users. Written October 18 2026 from the design conversation recorded in CLAUDE.md
 * under "Spanish and other languages". Nothing in it is built.
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// Curly apostrophes and quotes, the house style for documents.
const smart = (s) => s.replace(/'/g, "’").replace(/(^|[\s(])"/g, "$1“").replace(/"/g, "”");
const heading1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(smart(text))] });
const heading2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(smart(text))] });
const para = (text) => new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun(smart(text))] });
const lead = (label, text) => new Paragraph({ spacing: { before: 0, after: 160 },
    children: [new TextRun({ text: smart(label), bold: true }), new TextRun(smart(text))] });
const bullet = (label, text) => new Paragraph({ numbering: { reference: "bullets", level: 0 },
    spacing: { before: 0, after: 80 },
    children: text === undefined ? [new TextRun(smart(label))]
        : [new TextRun({ text: smart(label), bold: true }), new TextRun(smart(text))] });
const gap = () => new Paragraph({ spacing: { before: 0, after: 160 }, children: [] });

function simpleTable(headers, rows, widths) {
    const cell = (text, w, head) => new TableCell({
        width: { size: w, type: WidthType.DXA }, margins: cellMargins,
        shading: head ? { type: ShadingType.CLEAR, fill: "D5E8F0" } : undefined,
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, keepNext: !!head,
            children: [new TextRun({ text: smart(text), bold: !!head, size: 20 })] })],
    });
    return new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: widths, borders,
        rows: [
            new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
            ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) })),
        ],
    });
}
const W2 = [2600, 6760];
const W3 = [2200, 5060, 2100];

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 30, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 320, after: 180 }, keepNext: true, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run: { size: 26, bold: true, font: "Arial", color: "1F4E79" },
                paragraph: { spacing: { before: 220, after: 140 }, keepNext: true, outlineLevel: 1 } },
        ],
    },
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Language Support Design", italics: true, color: "808080", size: 18, font: "Arial" })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: "Volksswitch.org  |  October 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
            new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" }),
        ] })] }) },
        children: [
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Conversant AAC", bold: true, size: 44, color: "1F4E79" })] }),
            new Paragraph({ spacing: { before: 0, after: 60 },
                children: [new TextRun({ text: "Language Support Design", bold: true, size: 32, color: "444444" })] }),
            new Paragraph({ spacing: { before: 0, after: 80 },
                children: [new TextRun({ text: smart("Spanish for bilingual users first, and what any other language would need"), italics: true, size: 24, color: "555555" })] }),
            new Paragraph({ spacing: { before: 0, after: 320 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  Last updated October 18, 2026", size: 20, color: "808080" })] }),

            // ===== 1 =====
            heading1("1. What This Is For"),
            para("Conversant works only in English today. This document describes how it could work in other languages, starting with Spanish. Spanish comes first because it's by far the most common second language in the US. Many AAC users live in homes where Spanish is spoken, and very few AAC tools serve them well."),
            para("The first users we're designing for are bilingual. They speak Spanish with some people and English with others, often in the same day and sometimes in the same sentence. That turns out to be the harder case, and the more common one."),
            lead("Status. ", "Nothing here is built. One test has been run, described in section 4. Section 12 lists the open questions."),

            heading2("1.1 Decisions so far"),
            bullet("Bilingual users first. ", "A design that handles two languages handles one."),
            bullet("Mexican and US Latino Spanish. ", "That's the Spanish most US users speak. Other varieties can come later."),
            bullet("A native speaker reviews everything before it ships. ", "Nobody on the project can judge whether Spanish sounds natural. The project is finding a reviewer."),
            bullet("The screen language and the conversation language are separate. ", "Section 2 explains why."),
            bullet("The screens start in the device's language. ", "On first launch only. After that it's a setting, and the app never changes it on its own."),
            bullet("The language setting is labeled in the current language only. ", "Each choice in its list appears in its own language: \"English\", \"Español\"."),
            bullet("Gender gets more than two answers. ", "Section 5.1 explains why Spanish makes this pressing."),
            bullet("Respectful address is one setting for each person. ", "It means usted in Spanish and \"sir\" or \"ma'am\" in English."),

            heading2("1.2 Words used here"),
            simpleTable(["Term", "Means"], [
                ["User", "The person using the app, who doesn't speak"],
                ["Partner", "The person the user is talking with"],
                ["Screen language", "The language of the buttons, Settings and help"],
                ["Conversation language", "The language the suggestions are written in, the user's voice speaks, and the app listens for"],
                ["Bilingual user", "Someone who uses two languages in daily life"],
                ["Switching languages", "Moving between two languages, sometimes within one sentence. Very common among bilingual speakers"],
                ["Reviewer", "A native speaker who reads the app's Spanish and says whether it sounds right"],
            ], W2),

            // ===== 2 =====
            heading1("2. Two Languages, Not One"),
            para("It's tempting to think of language as one setting for the whole app. It's really two, and they often differ."),
            bullet("A therapist sets up the device. ", "The therapist reads English and sets up Settings and About Me in English. The user talks in Spanish."),
            bullet("Ximena reads Spanish best. ", "She wants Spanish screens, but she talks in English with her boss and her doctor."),
            bullet("Mateo reads English best. ", "He wants English screens, but he talks in Spanish with his grandparents."),
            para("The app needs a screen language and, separately, a conversation language. The conversation language has a default, and each person in About Me can have their own. Section 6 covers that."),

            // ===== 3 =====
            heading1("3. What Changes, Part by Part"),
            para("Most of the work is writing, not rebuilding. The app was built with the language-dependent parts kept separate, so each one can get a Spanish version. Here's the whole list."),
            simpleTable(["Part", "What changes", "Size"], [
                ["Suggestions", "One instruction tells the AI which language to write in. The app's rules stay in English, and the AI still follows them (section 4)", "Small"],
                ["Hearing the partner", "The built-in recognizer and every paid service are told which language to listen for. Today the app always says English", "Small, except for switching languages (section 6.2)"],
                ["The user's voice", "The user picks a voice that speaks the language", "Small, except for sounding like one person in both languages (section 6.4)"],
                ["Holding phrases, Commands phrases, Express Panel starter phrases", "Written fresh in Spanish by a native speaker. Translating them word for word would sound stiff", "Medium"],
                ["About Me questions", "About 75 questions, translated with care", "Medium"],
                ["Word prediction", "A Spanish word list in place of the 560-word English one", "Small to medium"],
                ["On-screen keyboard", "Needs á é í ó ú ü ñ ¿ ¡ without costing extra taps", "Medium"],
                ["Screen text", "Every button name and Settings label moves into a file for each language", "Large"],
                ["Spoken help in Settings", "85 short entries, in each language", "Medium"],
                ["What's new notes", "Written in each language at every release", "Ongoing"],
                ["Manuals and other documents", "Spanish versions for users and families", "Large, and last"],
                ["Quality checks", "Our English checks don't apply. A reviewer does the job instead (section 9)", "Ongoing"],
            ], W3),
            gap(),

            // ===== 4 =====
            heading1("4. The First Test"),
            para("Before building anything, we checked whether the AI's English instructions still work when it writes in Spanish. We added one line asking for spoken Mexican Spanish and ran 16 typical turns for a test user, Marisol, 24, from San Antonio. Each turn was typed in, so the test didn't involve hearing or speaking."),
            para("All 16 came back with usable options. Every rule we checked held."),
            simpleTable(["What we checked", "Result"], [
                ["The four kinds of reply", "Agreeing, declining politely, adding something and asking to clarify all came back in Spanish"],
                ["A menu (\"¿chico, mediano o grande?\")", "One option for each size, plus a spare"],
                ["The honesty rule", "Asked what year Mexico became independent, she says she doesn't remember. No date"],
                ["\"¿Mande?\" (Mexican for \"What?\")", "Recognized as the partner asking her to repeat"],
                ["Usted with a doctor and a store clerk", "Usted both times, even though only the doctor came with an instruction"],
                ["A 1-to-10 pain question", "Recognized as a number question, so the number button would appear"],
                ["A goodbye", "Recognized as the friend leaving"],
                ["She typed her point and pressed Reframe", "Every option carried it, whether she typed in Spanish or English"],
                ["A coworker mixed English in (\"el report para el meeting\")", "Handled naturally"],
            ], W2),
            gap(),
            para("The wording reads Mexican to us: \"ahorita\", \"nomás\", \"ni modo\", \"la neta\". But that's for the reviewer to confirm, not us."),
            para("The test also turned up four problems:"),
            bullet("Gender was a guess. ", "With gender left out of About Me, the AI chose \"cansada\" from the name Marisol. It was right, but by luck."),
            bullet("Language didn't follow the partner. ", "A friend who spoke English got Spanish replies."),
            bullet("The AI can't know who gets usted at home. ", "It handled the doctor and the clerk well. Family elders need a setting."),
            bullet("Declining sometimes invented a reason. ", "Twice the polite \"no\" added \"ando bien cansada\" (\"I'm really tired\"). The same turns in English gave no reason. That's only two runs, so we need to check it again."),
            para("The test found one more thing that isn't about Spanish. Asked how much it hurts, the first option says it hurts a lot, in English as well as Spanish. That states something about the user's body they never said. It's being fixed separately."),
            para("The test is repeatable: \"run spanish-eval\" produces a fresh report for the reviewer."),

            // ===== 5 =====
            heading1("5. Questions Only Spanish Raises"),
            heading2("5.1 Gender"),
            para("In English, people rarely use gendered words about themselves. In Spanish they do it all the time. \"I'm tired\" is \"estoy cansado\" or \"estoy cansada\", and so are ready, sure, happy and many more. The app has to know, or it will speak as the wrong person."),
            para("Today About Me asks only for pronouns. It needs two questions:"),
            bullet("Who you are. ", "Woman, man, nonbinary, or in your own words."),
            bullet("How to word things about you. ", "Feminine (\"cansada\"), masculine (\"cansado\"), the inclusive \"-e\" endings some nonbinary speakers use (\"cansade\"), or avoiding gendered words (\"tengo sueño\" in place of \"estoy cansada\")."),
            para("The two answers are separate because they don't always match. Some nonbinary Spanish speakers use the \"-e\" endings and others dislike them. Avoiding gendered words works but can sound roundabout. We need to test each choice in Spanish before building it."),

            heading2("5.2 Tú, usted, sir and ma'am"),
            para("Spanish has two words for \"you\". Tú is for family, friends and children. Usted is for respect: elders, doctors, strangers, and in some families even parents. Ximena, for example, says usted to her mother."),
            para("English has a cousin of this. Some American families say \"yes, sir\" and \"yes, ma'am\" to their parents. So one setting for each person, \"speak respectfully to this person\", covers both languages. In Spanish it means usted, and in English it means sir or ma'am."),
            para("The AI already picks usted well for doctors and strangers without being told. The setting is for the people it can't guess, mostly at home. About Me already has a \"More careful\" choice for each person, but it only makes wording more formal and never names a form of address."),

            heading2("5.3 Which Spanish"),
            para("Spanish varies by country more than American and British English do. Words differ, and sometimes the same word means something different. That matters for the same reason \"check the box\" matters in English. The wrong word can mislead."),
            para("We're aiming at Mexican and US Latino Spanish. That means \"¿Mande?\" for \"What?\", \"ahorita\", \"camión\" for a bus in Mexico, and never Spain's \"vosotros\". The reviewer should come from that community. Other varieties could become a choice later."),

            // ===== 6 =====
            heading1("6. Bilingual Users"),
            heading2("6.1 Language follows the person"),
            para("Mateo speaks Spanish with his grandmother and English with his best friend. If the conversation language were one setting, he'd have to change it every time he turned to someone new. Each person in About Me therefore gets a conversation language, with a default for everyone else."),
            para("The test showed why this matters: a friend who spoke English got Spanish replies. Tapping the friend's button on the Express Panel should switch the suggestions, the voice and the listening to English."),
            para("A place could carry a language too. Mateo uses Spanish at the taco truck, whoever is working. That's an open question."),

            heading2("6.2 When the partner switches languages"),
            para("This is the hardest part, and the first test didn't cover it, because the test skipped hearing."),
            para("The browser's built-in recognizer listens for one language at a time. A partner who switches mid-sentence, as many bilingual people do, will be partly misheard. The paid services are reported to do better. Deepgram is reported to handle English and Spanish mixed together, and Azure can detect which language is being spoken. None of that has been tested here yet."),
            para("Choosing the partner's language from their button gets most of the way. A partner who mostly speaks one language is heard in that language. Mixed speech is the case to measure."),

            heading2("6.3 Typing in English, speaking Spanish"),
            para("Mateo understands Spanish well but is less sure writing it, which is common for people raised in the US. He can type what he wants to say in English, press Reframe, and get options in Spanish. The test showed that works."),
            para("That's a real help, and it carries a risk. Mateo might not notice a Spanish option that says something slightly different from what he meant. He'll be choosing words he can't fully check. Being able to hear an option before speaking it helps."),

            heading2("6.4 One voice in both languages"),
            para("A user's voice is part of who they are. If Mateo sounds like one person in English and a different person in Spanish, that's a loss."),
            para("Device voices are separate for each language, so a user would sound like two people. Some paid voices speak several languages with the same sound. Azure has these \"multilingual\" voices, and one of them, Ava, is already in the app's list. How well they speak Mexican Spanish hasn't been checked."),

            heading2("6.5 Two languages at one table"),
            para("Sometimes grandma and a sister are both in the conversation, each in a different language. That's a conversation with more than one partner, which the app doesn't support in any language yet. It's left for later."),

            // ===== 7 =====
            heading1("7. Choosing the Screen Language"),
            bullet("First launch follows the device. ", "A tablet set to Spanish opens Conversant in Spanish. This happens once, the same way the app suggests a starting layout, so the app never changes language on its own afterward."),
            bullet("After that, it's a setting. ", "It goes at the top of Settings, General. Its label is in the current language, and each language in the list is written in its own language, so a reader can always find theirs."),
            bullet("A globe icon may help. ", "People recognize a globe as \"language\" whatever they read. That helps the rare user whose device is set to a language they don't read."),
            bullet("Nothing on the screen before Start. ", "The app already opens in the device's language, so a language choice there isn't needed. The user changes it in Settings if they want something else."),
            para("Changing the screen language changes only what the app's own text says. It never translates the user's words: About Me answers, phrases and saved conversations stay as the user wrote them."),

            // ===== 8 =====
            heading1("8. The Personas"),
            para("The project's test personas already include two bilingual users. Diego Fuentes is Cuban-American, in Miami. Sofía Reyes is Mexican-American, in San Antonio. Both speak the two languages equally well."),
            para("Two new personas cover the cases they don't. Mateo leans toward English and Ximena leans toward Spanish, and together they show most of what a bilingual user needs."),
            simpleTable(["", "Mateo Salinas", "Ximena Ortega Ruiz"], [
                ["Age and home", "19, Boyle Heights, Los Angeles", "29, Little Village, Chicago"],
                ["Background", "Born in LA to a Mexican-American family", "Born in Michoacán, Mexico; moved to Chicago at ten"],
                ["Strongest language", "English. Understands Spanish fully, less sure writing it", "Spanish. Fluent in English"],
                ["Spanish with", "Grandparents, uncle, the taco truck", "Mother, brother, church, cousins in Mexico"],
                ["English with", "Sister, friends, college", "Her boss, her doctor"],
                ["Mixes the two with", "His parents", "Her best friend"],
                ["Usted with", "His grandfather", "Her mother and an older friend from church"],
                ["Wording about them", "Masculine", "Feminine"],
                ["Tests especially", "Typing in English to speak Spanish; switching by partner", "Spanish screens; usted with a parent; English at work"],
            ], [2000, 3680, 3680]),
            gap(),
            para("Each persona has its own document under Other, Personas, set out like About Me. Those documents hold only what About Me can hold today. Which language they use with each person is written in that person's \"Anything worth knowing\" note. The settings planned in sections 5 and 6 appear only in this document until they're built."),

            // ===== 9 =====
            heading1("9. Checking Quality"),
            para("For English, the project has checks for spelling, for British words, and for phrasing nobody in Ohio would use. Above all it has a person who reads every sentence aloud. None of that works for Spanish, because nobody on the project speaks it natively."),
            para("That makes a native-speaking reviewer a requirement, not an extra. The best fit is a bilingual speech-language pathologist, who knows both the language and the users. The reviewer is asked one main question about each sentence: would someone from this community actually say it, out loud, to this person?"),
            para("Over time the reviewer can build a list of tells, things the AI tends to get wrong in Spanish, the way we've built one for British phrasing in English. Some can become automatic checks."),

            // ===== 10 =====
            heading1("10. Order of Work"),
            simpleTable(["Stage", "What", "Waits on"], [
                ["1", "The reviewer reads the first test", "Finding a reviewer"],
                ["2", "Conversations in Spanish, screens still in English: suggestions, hearing, voice, holding phrases, Commands phrases, Express Panel starter phrases, keyboard accents, word list, the gender questions", "Stage 1"],
                ["3", "Bilingual support: a language for each person, respectful address for each person, one voice in both languages", "Stage 2, and measuring mixed speech"],
                ["4", "Spanish screens and spoken help", "Stage 2"],
                ["5", "Spanish manuals", "Stage 4"],
            ], [900, 6160, 2300]),
            gap(),
            para("Stage 2 alone is useful. It's the setup where an English-speaking therapist prepares the device for a Spanish-speaking user. Stages 3 and 4 don't depend on each other."),

            // ===== 11 =====
            heading1("11. Other Languages Later"),
            para("Most of this design carries over to any language: the files for each language, the split between screen and conversation, and a language for each person. Some things won't:"),
            bullet("Languages written right to left, ", "such as Arabic and Hebrew, mirror the whole screen. Mirroring moves every button, so a keyguard made for the English layout wouldn't fit."),
            bullet("Languages with other alphabets ", "need new keyboards, not just extra letters."),
            bullet("The AI writes some languages better than others. ", "Each new language needs its own version of the first test."),
            bullet("Voices and recognition vary by language. ", "Some languages have few good voices on any service."),
            bullet("Each language needs its own reviewer.", undefined),
            para("The next language should be chosen by who asks for it, not planned ahead."),

            // ===== 12 =====
            heading1("12. Open Questions"),
            bullet("Should a place carry a language, ", "as the taco truck does for Mateo?"),
            bullet("Which way of hearing handles mixed speech best? ", "We need to measure it with real recordings."),
            bullet("How good are the multilingual voices in Mexican Spanish? ", "A user should sound like one person in both languages."),
            bullet("Which gender wordings work well in Spanish? ", "We need to test each one with the reviewer."),
            bullet("Should Express Panel phrases belong to a language? ", "A bilingual user may want different buttons with each partner, which the Flex band can already do."),
            bullet("Does the polite decline invent reasons more in Spanish? ", "This needs more runs."),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    const out = docPath("Conversant AAC Language Support Design.docx");
    fs.writeFileSync(out, buffer);
    console.log("Wrote " + out);
});
