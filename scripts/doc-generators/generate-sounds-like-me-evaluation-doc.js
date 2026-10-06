/* Conversant AAC - Can the Suggestions Sound Like Me? (October 6 2026)
 *
 * The house-style Word version of the "sounds like me" evaluation. The evaluation measured
 * version 0.13.6; Section 2 lists the changes made to the app the same day in response,
 * which nothing has measured yet. The evidence appendix keeps the file and line
 * references the evaluation recorded.
 *
 * Content is written with two inline marks, read by md():
 *   **bold**    a bold run
 *   `code`      a Consolas run (file names, line references, code identifiers)
 *
 * AFTER GENERATING, run the post-processing chain or the document checker fails:
 *   python scripts/doc-generators/apply-table-style.py "<doc>" --from "Documents/Conversant AAC User Manual (Windows Chromebook Mac).docx"
 *   python scripts/doc-generators/apply-doc-style.py   "<doc>"
 *   python scripts/doc-generators/fix-docx-lists.py    "<doc>"
 *   python scripts/doc-tests/check-docs.py             "Sounds Like Me Evaluation"
 * Those rewrite the file, so the manifest hash no longer matches and a later run of this
 * generator will REFUSE. That refusal is correct - check first that the document holds no
 * hand edits, then FORCE_DOC_WRITE=1 and run the chain again.
 */
const { docPath } = require('./doc-paths');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN = 1440;
const TABLE_W = 9360;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border,
                  insideHorizontal: border, insideVertical: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// Inline marks -> runs. Bold and code do not nest.
function md(text, base = {}) {
    const out = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
        if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
        const t = m[0];
        if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), ...base, bold: true }));
        else out.push(new TextRun({ text: t.slice(1, -1), ...base, font: "Consolas" }));
        last = m.index + t.length;
    }
    if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
    return out;
}

// keepNext on the PARAGRAPH, not only on the style: the document checker reads each
// paragraph's own properties.
function h1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun(text)] });
}
function h2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(text)] });
}
// The Evidence Appendix is reference material, so it is set a point smaller (10pt), the
// same size as the Sources list. Set to true just before its heading, in document order.
let APPX = false;
const bodyRun = () => (APPX ? { size: 20 } : {});

function p(text) {
    return new Paragraph({ spacing: { before: 0, after: 160 }, children: md(text, bodyRun()) });
}
function note(text) {
    return new Paragraph({ spacing: { before: 0, after: 160 },
        children: md(text, { italics: true, color: "595959", size: 20 }) });
}
function quote(text) {
    return new Paragraph({ spacing: { before: 0, after: 160 }, indent: { left: 720, right: 720 },
        children: md(text, { italics: true }) });
}
function li(text, level, ref) {
    return new Paragraph({ numbering: { reference: ref, level },
        spacing: { before: 0, after: 80 }, children: md(text, bodyRun()) });
}
// items: strings, or [string, [children]] for a nested list.
function ul(items, level = 0, out = []) {
    for (const it of items) {
        if (Array.isArray(it)) { out.push(li(it[0], level, "bullets")); ul(it[1], level + 1, out); }
        else out.push(li(it, level, "bullets"));
    }
    return out;
}
// Numbered list; a nested list under an item is bulleted. The bullets sit at level 1 of
// the SAME numbering, so fix-docx-lists.py sees one decimal run and the count carries on
// past them. Under a separate bullet numbering it splits the run and item 2 restarts at 1.
function ol(ref, items) {
    const out = [];
    for (const it of items) {
        if (Array.isArray(it)) { out.push(li(it[0], 0, ref)); for (const c of it[1]) out.push(li(c, 1, ref)); }
        else out.push(li(it, 0, ref));
    }
    return out;
}
function reference(text) {
    return new Paragraph({ spacing: { before: 0, after: 120 }, indent: { left: 480, hanging: 480 },
        children: md(text, { size: 20 }) });
}

// Rows never split across a page, and the header row stays with the rows under it.
function table(widths, headers, rows) {
    const cell = (text, w, isHeader) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: cellMargins,
        shading: isHeader ? { type: ShadingType.CLEAR, fill: "D5E8F0" } : undefined,
        children: String(text).split('\n').map(line => new Paragraph({
            spacing: { before: 0, after: 0 }, keepNext: isHeader,
            children: md(line, isHeader ? { bold: true } : {}) }))
    });
    return new Table({
        width: { size: TABLE_W, type: WidthType.DXA },
        borders,
        rows: [
            new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
            ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) }))
        ]
    });
}
function gap() { return new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }); }

const children = [

// ===== TITLE =====
new Paragraph({ spacing: { before: 240, after: 80 },
    children: [new TextRun({ text: "Can the Suggestions Sound Like Me?", bold: true, color: "1F4E79", size: 40, font: "Arial" })] }),
new Paragraph({ spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "An evaluation of Conversant AAC’s voice layer, version 0.13.6", italics: true, color: "595959", size: 24, font: "Arial" })] }),
new Paragraph({ spacing: { before: 0, after: 240 },
    children: [new TextRun({ text: "Kenneth R. Hackbarth  |  Volksswitch.org  |  October 2026  |  Last updated October 6, 2026", color: "808080", size: 20, font: "Arial" })] }),
note("Sections 1 to 11 follow the project’s plain-language rules. They use only claims that held up when checked, some of them after correction. The Evidence Appendix at the end holds the file and line references and the checking status of every claim. It’s the only place refuted claims appear."),
p("**Terms used throughout.**"),
...ul([
    "**Response options** are the four suggestions on screen. Each is a different kind of reply: a best guess, a decline, a change of direction, and a request to clarify. In the code they’re called cards, which is why that word appears in some file names and labels in the Evidence Appendix.",
    "**Example sentences** are sentences the user typed. The app shows them to the AI as samples of how the user talks.",
    "**Reading past conversations** is the step that collects example sentences, and one length measure, from saved conversations. The code calls it the harvest.",
    "**AI judge** means a second AI call that rates or compares suggestions. Its 1-to-5 rating of how much an option sounds like a persona’s own lines is the **fidelity score**.",
    "**Reliable** means a difference that holds up after allowing for the number of comparisons. Otherwise it **could be chance**.",
    "**Marc** (17, terse, slangy) and **Grace** (34, gentle, polite) are test personas the evaluation wrote. They aren’t real people, and their lines aren’t real speech.",
]),

// ===== 1 =====
h1("1.  Bottom Line"),
p("About Me is likely to make the suggestions fit the user’s life, people and opinions. For a user who already talks like the app’s polite default, it brought the wording close as well. For a terse or slangy user it changed the wording very little and made the options longer."),
p("Conversation Review, as wired in version 0.13.6, is likely to return less than it costs, if voice is the return that counts. At realistic amounts of reviewing, the tests detected no change in the best-guess option, and most review answers feed nothing. For a user whose past conversations the app has never read, leaving the first review also switches on a length instruction that can make options longer. That verdict is an expectation, not a measurement. A lesson applies to every later turn, so the bar is low, and these tests couldn’t detect a small gain."),
p("Reframe and typing your own words are the user’s most direct way to change the wording. In version 0.13.6 the app kept a Reframe instruction only for the current turn, unless the user typed exactly the same words again later."),
p("The project should explore other avenues, and the first few cost the user nothing. They are to measure whether any of this works, remove the signals the app currently gets wrong, keep the user’s Reframe instructions, and let the user’s own words outrank the fixed style rules."),
p("The literal goal is the user’s own slang and turns of phrase, close enough that nobody could tell the difference. It’s out of reach with prompting and this little of the user’s own text, and the app rules out part of it on purpose. A narrower goal looks achievable, and the beta can measure it: options the user picks over a generic assistant’s in a blind comparison, and more turns answered from the first set offered."),
p("Section 2 lists the changes made to the app after this evaluation."),

// ===== 2 =====
h1("2.  What Changed After This Evaluation"),
p("The evaluation measured version 0.13.6. The changes below came after it, on October 6 2026, and nobody has measured them yet. Sections 3 to 10 describe version 0.13.6 as the tests found it. Each change still needs the measurement in Section 9.1 before anyone can say it helps."),
...ul([
    "**Length.** The length preference now compares each pick only with options of the same kind, a best guess against other best guesses and a decline against other declines, across the user’s history. It ignores picks from the fixed openers, wrap-up statements and goodbyes. The app checks it against the user’s How I Sound brevity answers. When the two point opposite ways, the app uses only the How I Sound answers. Those answers now produce their own length instruction when they agree with each other. A length reading saved by an earlier version isn’t used until the conversations are read again. (Sections 4.3, 5.3 and 9.2.)",
    "**Joke permission.** Picking “No idea, sorry.” in How I Sound no longer counts as permission to joke. (Section 4.3.)",
    "**Practice conversations.** The app no longer reads practice conversations for example sentences, length or repeated instructions. It doesn’t save Reframe instructions typed during practice. (Sections 3, 5.1 and 6.1.)",
    "**“Real conversations.”** The app no longer tells the AI that sentences written in review came from “real conversations.” (Sections 5.1 and 9.2.)",
    "**Repeated requests.** The app groups Reframe instructions with the same meaning. “Shorter” and “keep it to five words” count as two requests for shorter replies, so asking twice in different words now makes a standing instruction. Only an instruction that is about style and nothing else counts this way. One that also says what to say, or that the app can’t read for certain, still needs the same words twice. A request made only with one person stands only for that person. (Section 6.1.)",
    "**Short typed replies.** The app keeps typed replies under 4 words as “short replies” the AI sees, instead of dropping them. (Section 5.1.)",
    "**Example places.** Removing an example sentence lets the next one take its place. Review sentences and sentences typed live now share the 12 places, instead of review sentences always taking them first. (Section 5.2.)",
    "**Which evidence wins.** Where the user’s own typed sentences and their How I Sound picks differ, the app tells the AI to follow the user’s own sentences. (Section 3.)",
    "**Typing effort.** The app tells the AI that the length of typed sentences may partly reflect how slow typing is. (Section 6.2.)",
    "**Keeping an instruction with one tap.** About Me’s “What the app has picked up” now lists the Reframe instructions the user typed recently, in conversations and in review. Each has “Keep for everyone” and, when a partner was set, “Keep for” followed by that person’s name. A kept instruction goes to the AI on every request, or only while that person’s partner button is on. Each instruction now records who the user was talking with. (Sections 6.1 and 9.3.)",
    "**Review instructions count.** Reframe instructions typed in review now appear in that list and count toward repeats. (Sections 5.1 and 6.1.)",
    "**Personality note.** The note in the personality section now says these answers shape attitude, not wording. (Section 4.4.)",
    "**App wording.** The Review tab introduction and the How I Sound introduction now promise less. Both had promised results nobody has measured. (Section 10.7.)",
    "**What About Me shows.** About Me now lists the same example sentences the AI is given. (Section 5.2.)",
    "**The current partner.** Each request to the AI now describes the partner who is switched on at that moment. Before, switching a partner off could leave the previous person’s name, their “how I talk with them” settings and any instruction kept for them in the next request. This problem was older than the evaluation.",
]),
p("A code review of these changes found two faults in the first version. It read some instructions the wrong way round, such as “too informal” as a request for casual wording. It also sent a request made to one person to everyone. Both were fixed before the changes were saved."),
p("**Where the Keep choice lives.** The choice to keep an instruction is in About Me, between conversations, and not on the conversation screen. That way nothing new appears on the screen a keyguard covers, and nothing slows a live exchange. Section 9.3 proposed the tap right after a Reframe. The version built puts it in About Me instead, so the user reaches it by opening About Me between conversations."),

// ===== 3 =====
h1("3.  What Reaches the AI"),
p("Every time the app asks for suggestions, it sends the AI one block of instructions. For Marc talking with his mom, that block is about 44,400 characters long."),
p("**About two-thirds of it is the same for every user.** The first 28,800 characters come before anything about Marc. About 18,200 of those are rules: don’t invent facts, don’t supply outside knowledge, how to read the partner’s turn, the four kinds of reply. The rest covers the reply format and how to classify the partner’s turn. The outside-knowledge rule alone is about 9,600 characters, more than everything that describes how Marc talks (about 6,700)."),
p("**About a third is about Marc.** It splits roughly like this:"),
table([3400, 1500, 4460], ["What it is", "Characters", "What it does"], [
    ["Facts and topics: who he is, his people, places, interests, beliefs, topics to avoid", "about 8,200", "Tells the AI what he knows and cares about"],
    ["Personality, values, outlook, “what I want people to understand”", "about 1,650", "The instructions tell the AI to use these for attitude only, never wording"],
    ["Humor, how he handles disagreement, how he talks with different groups", "about 1,600", "Aimed at wording"],
    ["The voice section: his How I Sound picks, his own Express Panel phrases, his “never say” list", "about 2,760", "Aimed at wording. About a third is his data; the rest is instructions about it"],
    ["How he talks with Mom: the per-person menu and note", "about 690", "Aimed at wording. The app sends it only while a partner button linked to Mom is on"],
]),
gap(),
p("A little over half of the part about Marc is about what he knows. The rest is about how he talks, and some of that is about attitude rather than wording."),
p("**Very little of it is Marc’s own words.**"),
...ul([
    "**How I Sound picks** are lines the project wrote and Marc chose.",
    "**His Express Panel phrases** go to the AI with three instructions: use them only to judge his vocabulary, never reuse them, and don’t read their shortness as a wish for short replies. The last one throws away one of the few brevity signals a terse user’s own buttons carry.",
    "**His typed sentences** never reach the AI until the app reads his past conversations. On the test data, that reading yields 2 such sentences.",
]),
p("**The fixed part contains roughly 40 to 50 example phrasings written as if the user said them.** They’re the same for everyone. Examples: “I’d love to, but…” and “I’m pretty wiped today.”"),
p("**It also contains firm style rules:**"),
...ul([
    "**The decline option** must contain a softener, the decline and a reason, and never a bare “No.”",
    "**No reply may open with** “Oh,” “Well,” “So” or similar.",
    "**An answer to an either/or question** must be a full sentence.",
    "**Ordinary questions** get a warm answer.",
]),
p("**The instructions don’t say which wins when those rules and the user’s own examples disagree.** The voice section calls the How I Sound picks “the single most important guide to wording.” It calls the typed example sentences “the best evidence you have.” The fixed rules are absolute. The instructions don’t rank the three."),
p("Three narrower rules do let the user’s input win:"),
...ul([
    "**A typed Reframe** overrides two content rules, but must keep the four-option structure.",
    "**A per-person note** “overrides the general guidance above.”",
    "**Declining humor** overrides the style examples.",
]),
p("**In the live tests, the fixed decline rule usually won.**"),
...ul([
    "Marc’s decline to a dinner invitation contained “I’d love to (or like to), but…” in 12 of 12 runs, whatever the profile said. Only 1 of his 96 decline options used his own decline style. His three decline lines in the examples (“Nah, I’m good, but thanks.” and two others) didn’t change that.",
    "“Wiped,” a word that appears in the instructions only in the decline rule’s example, turned up in 8 of Marc’s options across 6 of 9 test setups, and never in Grace’s.",
    "The rule isn’t absolute in practice. Grace’s invitation decline moved off the template in 7 of 8 personalized runs (“That’s kind of you to ask, but…”), because her own style already fits a softened decline.",
]),
p("**Practice conversations go in too.** When the app reads past conversations, it includes practice conversations with the AI partner. It then tells the AI those sentences and choices came from “real conversations.”"),

// ===== 4 =====
h1("4.  About Me"),
h2("4.1  What It Does Well"),
p("**It’s the only lasting source of true personal content.** The fixed rules forbid the AI from inventing events or facts about the user. With no profile, the reply to “what do you like to do for fun?” was “Mostly just hanging out and doing things I enjoy” in 4 of 4 runs. With About Me filled in, the replies named the persona’s real interests: Mario Kart and Minecraft for Marc, knitting and birds for Grace."),
p("**Facts show up where the question invites them.** Options carrying a fact from the profile:"),
table([2160, 2700, 2500, 2000], ["Persona", "“Tell me about you” turns", "Ordinary turns", "No profile"], [
    ["Marc", "7 of 24", "1 of 40", "0"],
    ["Grace", "8 of 24", "3 of 40", "0"],
]),
gap(),
p("**It replaces invented excuses with true reasons.** That’s a change of stance the fact count misses. With no profile, one decline said “I’m about to head out.” With About Me, Grace declined a big dinner because big nights out are a lot for her. Both personas gave physical limits as the reason they couldn’t watch a bag. A hand count puts this at about 10 of 40 ordinary-turn options for Grace and 3 or 4 for Marc."),
p("**It shifts everyday register words a little.** Grace’s options said “thank you” 0 times without the profile and 7 times with it. Marc’s best-guess options moved from “Yes, I’d love to come” to “Yeah, I’d love to come.”"),
p("**Judges told to ignore content gave mixed results:**"),
...ul([
    "**Grace’s fidelity score** closed 74% of the gap to her own lines, a reliable change.",
    "**Marc’s** closed 26%, which could be chance.",
    "**On ordinary turns,** one judge (Haiku) reliably picked out the right persona more often when shown all four options (9 of 20 rising to 19 of 20). The other measures showed no reliable change.",
]),
p("The effect on manner is coarse."),

h2("4.2  What It Can’t Do for Voice"),
p("**It makes options longer.** Facts add words, and About Me has no field for brevity."),
...ul([
    "**Marc’s best guess** on “tell me about you” turns grew from 11.7 to 13.5 words. His own lines average 4 words.",
    "**Across all his options** except the clarifying one, the average went from 11.0 to 12.6 words. Grace’s went from 11.5 to 15.2.",
    "**On ordinary turns,** Marc’s best guess stayed at 8.7 words.",
]),
p("Longer options aren’t free. The user reads four of them on every turn, and the partner hears more words."),
p("**It doesn’t bring out the user’s slang.** Marc’s signature words (nah, dude, lowkey, ugh and others) appeared 0 times. That’s by design. About Me has no field for them, and catchphrases belong on Express Panel buttons."),
p("**How close it gets depends on the user.** With no profile, the default voice is nearest to a polite, mid-length adult like Grace. That shows in length, in a simple measure of style, and in the fidelity score. A user near that register gets much of the way with About Me alone. A terse or slangy user starts further away, and About Me moves him little. Part of Grace’s result is built in. Her test lines came from the same description About Me carries."),
p("**One small sign to watch.** With About Me alone, Grace’s options used “lovely” twice and “proper” once in 64, against none in 128 options with no profile. That could be chance. Those words break the project’s American-English rule, so they’re worth watching in real use."),

h2("4.3  The Voice Parts Inside About Me"),
p("The About Me tab also holds **How I Sound**: 20 quick choices of “which of these sounds most like something you’d say.”"),
p("**For Marc, these taps moved his options toward his style.** His fidelity score went from 3.00 with no profile, to 3.44 with About Me, to 4.13 with How I Sound added. The change from no profile to About Me plus How I Sound is reliable. Most of what moved was length: his best guess shortened from 10.5 to 7.8 words. For Grace, How I Sound changed nothing."),
p("How I Sound has limits:"),
...ul([
    "**It’s narrow.** Its 60 candidate lines contain no slang, no exclamation marks and one “yeah.” It can express terseness and directness: Marc’s picks average under 4 words. It can’t express slang, dialect, or talking differently with different people.",
    "**The AI under-applied the terseness.** At that stage Marc’s options still averaged 7.8 words, although his picks were the shortest on offer and the instructions say “Match the length.”",
    "**A plain answer counts as permission to joke.** In one item, picking “No idea, sorry.” counts as choosing the lighter reply. That tells the AI a light, joking response suits this user. 3 of the 10 test personas picked it. For a terse user who never answered the humor questions, the app would offer jokes in their voice based on the answer that marks them as plain.",
    "**The app throws away the two escape answers.** These are “They all sound like me” and “I wouldn’t say any of these.” The plan calls the second one at least as informative as a pick.",
    "**An earlier wording change rewrote what users had chosen.** When the project reworded 11 candidate lines in 8 items to remove British phrasing, the app switched saved answers to the new wording. The AI now gets a sentence the user never saw.",
    "**The app never retires it.** The plan says live choices replace it once enough of them build up.",
    "**Its length signal goes unused.** How I Sound holds the cleanest length evidence the app has, because the content stays the same across each item’s three choices. The app never uses it for length. Only its 4 brevity items isolate length. Across all 20 items, length moves with formality, warmth, and how the user hands the turn back. For 3 of the 10 personas, the full set points the wrong way.",
]),
p("**The per-person “how I talk with them” settings** are the About Me feature most directly aimed at manner. They’re a five-part menu plus a free note, and the app sends them only while a partner button linked to that person is on. No controlled test has measured them. In the review experiment, the decline rule’s own wording mostly survived:"),
...ul([
    "**Sofia’s note** says “Nothing here should sound careful or nice.” 12 of 18 decline options to Sofia still used the rule’s softeners.",
    "**To Devon,** all 18 decline options contained “wiped.”",
]),
p("**The app doesn’t record who typed an answer.** A parent or therapist might fill in About Me, or write the note on how Marc talks with Mom. The app sends it to the AI as Marc’s own word, stated with full confidence. That clashes with the project’s decided rule that partner input is second-hand and never outranks the user. It’s also a path to a tidier, “well-behaved” version of the user."),

h2("4.4  Cost to the User"),
p("The questionnaire has 74 fields:"),
...ul([
    "**The user types 38 of them,** and all but 3 of those are facts.",
    "**The 9 fields aimed at wording** are all taps.",
    "**The per-person notes** are typed prose aimed at wording: about a fifth of everything typed.",
]),
p("For the fully answered test persona, the counted typing comes to about 860 words. That’s roughly 3 hours at 5 words a minute and 7 hours at 2. Openers and goodbyes for people, goal text and the never-say list add about 800 more characters. A supporter can type the facts. The voice parts are cheap taps."),
p("**One mismatch to fix.** The personality section tells the user these answers change how the app words things. The instructions tell the AI to use them only for attitude."),

// ===== 5 =====
h1("5.  Conversation Review"),
h2("5.1  What Each Review Answer Does"),
p("Review answers reach the AI through two channels only:"),
...ul([
    "a shared list of up to 12 example sentences, each at least 4 words long",
    "one sentence about length, built from comparing the option the user picked with the others offered",
]),
table([3600, 5760], ["What the user does in review", "Effect on later suggestions"], [
    ["Marks a different option as closer, words unchanged", "Changes a count behind the length sentence. Usually nothing the AI sees changes. Ten closer marks left the instructions identical, character for character, because their effects canceled out."],
    ["Rewords an option, then confirms it", "Becomes an example sentence if 4 or more words long. The app saves the original wording, which shows what the AI got wrong, and never uses it."],
    ["Types their own words", "Becomes an example sentence if 4 or more words long. Under 4 words it adds nothing, yet it still removes the live answer it replaced from the record."],
    ["Picks an Express Panel phrase", "Counts toward the length sentence only"],
    ["Picks a sound, or asks for a different set", "Removes the live answer from the record, nothing more"],
    ["Marks “should have known” (partner, place, feeling, goal)", "Nothing. The app saves it and shows it on the review screen."],
    ["Types a Reframe instruction in review", "Nothing. The app saves it and shows it again, but never uses it. It can never become a standing instruction."],
    ["Flags “it misheard” and types what the partner said", "Nothing. The design document promises “a report to us”; nobody has built one."],
    ["Taps the option spoken at the time, or opens it and changes nothing", "Nothing"],
    ["Does any of the above on a practice conversation", "The same as for a real one, and the app tells the AI it came from real conversations"],
]),
gap(),
p("**Every lesson applies to every partner.** A correction made for Mom applies equally to a store clerk. In the experiment, a warmer correction aimed at Mom showed no reliable change, for Mom or for a stranger."),
p("**The app reads past conversations only when the user leaves a review or presses “Read my conversations.”** The first time a user leaves any review, the app reads every saved conversation, practice ones included. That brings in typed sentences and the length sentence, whatever the review contained."),
p("**The user never learns what a particular review changed.** About Me’s “What the app has picked up” list shows the combined result. It doesn’t mark which items came from a review."),

h2("5.2  The Effort Ledger"),
p("These figures are assumptions, not measurements: 2 seconds per deliberate tap, 5 words a minute typing (range 2 to 10), and 15 to 30 seconds to read each turn."),
p("**A modest review:**"),
table([2400, 6960], ["Measure", "A modest review"], [
    ["Work done", "Walks 10 turns, makes 2 closer marks, rewords 1 option, types 1 eight-word sentence"],
    ["Taps", "About 23, or about 40 with “One tap or two” set to two"],
    ["Typing", "About 60 characters. The typed sentence goes through “In my own words,” which has word completion. The review word editor used for rewording has none."],
    ["Time", "About 6 to 8½ minutes at 5 words a minute; 4½ to 13 minutes across the full range"],
    ["What it buys", "Up to 2 example sentences that apply to every partner. The 2 closer marks usually change nothing. No feedback."],
]),
gap(),
p("**Reviewing 10 conversations** in the experiment took 691 typed characters and about 840 taps. The typing alone comes to about 28 minutes at 5 words a minute: 14 at 10 words a minute, 70 at 2. Of its 18 own-words answers, 12 reached the AI. The 12-sentence limit dropped the other 6, all from the three oldest conversations."),
p("**Lessons don’t last as long as it seems.** The 12 slots go to review sentences first, ranked by the date of the conversation reviewed, ahead of anything typed live. As a result:"),
...ul([
    "**A review’s sentences drop out** after about six more modest reviews of newer conversations.",
    "**Reviewing an old conversation adds nothing** once newer ones have filled the 12 slots.",
]),
p("**Costs the ledger doesn’t count:** the physical and emotional effort of reliving a conversation, and one small charge each time a review changes the instructions the app sends."),

h2("5.3  What the Experiment Measured"),
p("The first scoring script misread the judge’s answers. The figures below come from the corrected re-scoring. A score of 0.5 means “no better than the comparison.”"),
table([4160, 2600, 2600], ["Amount reviewed", "Best-guess option against no review", "All four options against no review"], [
    ["Two runs with no review, compared with each other (noise)", "0.42", "0.52"],
    ["1 conversation", "0.50", "0.65"],
    ["3 conversations", "0.44", "0.58"],
    ["10 conversations", "0.48", "0.58"],
    ["50 closer marks on the shortest option, in all 17 conversations", "**0.79**", "**0.83**"],
]),
gap(),
p("**On the best-guess option, the tests couldn’t tell realistic reviewing apart from noise.** On all four options together, the three realistic amounts lean slightly positive, but that lean could be chance. The three comparisons share the same no-review runs, and most of the wins come from two turns."),
p("**Against a user whose conversations the app has never read, reviewing trends worse.** One conversation scored 0.42 and ten scored 0.33, and this too could be chance. The likely cause is the length sentence. On the test data it says Marc “picks the fuller one… Do not clip responses down to the minimum,” for a persona written as short and snappy."),
p("That sentence comes from a measure that mostly records which kind of option the user picked. The clarify option is almost always the shortest, and users rarely pick it. Decline and change-of-direction options are long by design. A user who rarely picks the clarify option tends to read as preferring fuller replies. On the test data, the mix of kinds alone predicts “fuller” 58% of the time; the app’s bar is 60%. Within best-guess options, Marc’s picks showed no length preference (7 longer, 8 shorter). The effect can run the other way. Always picking the best guess would read as “shorter.”"),
p("A separate live run isolated that sentence. On its own it lengthened the best-guess option by about 1.3 words, and the effect was reliable. The two example sentences on their own changed nothing."),
p("**The one clear review result came from the test’s own design.** The 50 marks always chose the shortest option, and the evaluation wrote the comparison lines short. Those marks changed two things at once. They reversed the length sentence, and they removed the two typed example sentences. Reversing the length sentence alone explained about two-thirds of the shortening and about half of the gain. This result holds up after allowing for the number of comparisons."),
p("**The simulated review answers cut both ways.** Their author knew Marc’s target style, which should have helped. They were also longer than his own lines: typed answers averaged 9 words against his lines’ 6. The test doesn’t settle what a terse user’s own answers would do."),

h2("5.4  The Verdict on Return"),
p("**On voice, the expected return is below one for a typical user.** That isn’t proven."),
p("The case for below one:"),
...ul([
    "**No measurable effect** at realistic amounts of reviewing.",
    "**Most review answers feed nothing.** Three things a user can record (the Reframe instruction, the “should have known” marks and the misheard note) return nothing beyond showing up again on the review screen. For a user whose typing is slow and tiring, that effort can’t pay off as the app is wired.",
    "**Every lesson applies to all partners.**",
    "**The 12-slot limit** pushes older lessons out.",
    "**The user gets no feedback.**",
    "**The first review can switch on a wrong length sentence.**",
    "**More examples didn’t help.** The dose experiment found no gain from 4 example sentences to 12.",
]),
p("The case against calling it proven:"),
...ul([
    "**A lesson applies to every later turn.** If each slow repair (New 4, Reframe, or typing a reply) takes 30 to 90 seconds, a modest review breaks even by saving the user roughly 4 to 22 repairs over its whole life.",
    "**The test could miss a real gain.** It couldn’t rule out a gain of up to about 10 points on the best-guess option, or about 25 on all four options together.",
]),
p("**Voice isn’t the only return the design document lists, but it’s the one the document gives for keeping review.** The document’s paragraph on how often people would review says review stays “because it is the app’s main answer to ‘it doesn’t sound like me.’” The other purposes, and where they stand:"),
...ul([
    "**Reliving a conversation from the record:** built.",
    "**Coaching after practice:** not built. The plan has it waiting on the real-speed playback screen, which the plan ranks last.",
    "**Clinician use:** partly built. A therapist can write practice scenarios on the device, but the app has no way to hand one to a client’s device or get the results back. Backup import replaces the whole data set, so it doesn’t work for this.",
    "**Turning a repeated phrase into a button, or a fact into About Me:** not built.",
    "**The “is that true about you?” question for facts from practice:** not built.",
    "**Counts of how often people use review:** not built. Nobody can yet measure how often testers review.",
]),

h2("5.5  What Would Change the Verdict"),
...ol("verdict", [
    ["**Use what review already collects.**", [
        "Keep a Reframe instruction typed in review as a standing instruction, tied to the partner.",
        "Keep the before-and-after pair from a reworded option. It shows what the AI got wrong.",
        "Use the misheard flag and the “should have known” marks.",
    ]],
    "**Tag every lesson with the partner and place**, and send the ones that match.",
    "**Replace typing with recognition.** When the user picks an option in review, offer two or three versions of the same content in different styles (shorter, more casual, warmer) and let them tap one. Add a one-tap reason for the miss: too long, too formal, too polite, wrong idea, missing fact.",
    "**Fix the length measure.** Compare like with like, check it against How I Sound’s brevity items, and stop counting picks from the fixed lists (openers, goodbyes).",
    "**Leave practice conversations out**, or tell the AI they were practice.",
    "**Show what the review changed** when the user leaves.",
    "**Offer a “turns worth a look” walk** that skips turns with no sign of trouble.",
    "**Use review answers as a yardstick** for whether the voice layer works (Section 10). They aren’t free ground truth: they stay on the device, and the app already feeds typed answers back to the AI.",
]),

// ===== 6 =====
h1("6.  Reframe and Typing Your Own Words"),
h2("6.1  Reframe"),
p("**How long an instruction lasts.** A Reframe instruction holds for the rest of the current partner turn, through New 4, choice buttons and context buttons. The app clears it when the partner speaks again, when the user replies, or when the conversation ends."),
p("**How the app keeps it.** The app saves the instruction, but it becomes a standing instruction only when the user types the same words twice, ignoring case and punctuation."),
...ul([
    "**“Shorter” and “keep it to five words” count as different instructions.** None of the 6 test instructions qualify.",
    "**The saved copy doesn’t record the partner.**",
    "**Marc’s test data shows the cost.** Three separate signals ask for shorter replies: his How I Sound picks, a typed “shorter,” and a typed “keep it to five words.” None of them produces a length instruction. The only length sentence the app sends says the opposite.",
    "**Practice counts too.** An instruction typed in two practice runs of the same scenario becomes a standing instruction for real conversations.",
    "**The app never uses an instruction typed during review.**",
]),
p("**What the experiment showed.** In one run, the instruction “shorter and more casual. talk like a 17 year old” went on every turn for Marc."),
table([3600, 2880, 2880], ["Measure", "12 example sentences", "Same, plus the instruction on every turn"], [
    ["Fidelity score (Marc’s own lines score 4.67)", "4.06", "4.75"],
    ["Best-guess length", "8.8 words", "5.9 words"],
    ["Decline length", "12.4 words", "9.1 words"],
    ["Options using “nah” or “ugh”", "0", "2 of 32"],
]),
gap(),
p("**Read that result narrowly:**"),
...ul([
    "**The options being shorter explains the extra score,** along with common casual words such as “yeah,” “kinda” and “pretty chill.” Allowing for those two things removes the lead. After allowing for the number of comparisons, the difference could be chance.",
    "**No rated option contained “nah” or “ugh.”** Those words appeared only in two decline options, which the judge didn’t rate.",
    "**The score sits above Marc’s own lines’ score,** a sign the judge had run out of room.",
    "**The same person wrote** the instruction, Marc’s sample lines, and the lines used to judge him.",
    "**It was one run of 8 turns,** and it used a standing instruction, not a single tap.",
]),
p("It does show that the AI makes options shorter and more casual when asked plainly. For a terse user, that’s a large part of what’s wanted. In version 0.13.6 the app kept that request only briefly."),

h2("6.2  Typing Your Own Words"),
p("**Typed sentences are the only source of the user’s own wording.** They’re rare. In the test data, the user typed 2 of 60 turns. One tester’s problem report shows 30 turns and none typed, although her own note says she typed."),
p("**No sentence from a live conversation reached the AI** before the fix in 0.13.5 (October 6 2026)."),
...ul([
    "From August 7 on, the app saved typed and Express Panel turns under the wrong label.",
    "Conversations saved before August 7 have no label.",
    "Neither group can become example sentences.",
    "In the real data folders on the project’s own devices, the app has never read past conversations.",
    "Sentences typed in review could become examples from 0.13.3 (October 3). No report shows whether any tester has done that.",
]),
p("**The instructions tell the AI to “follow their phrasing, rhythm and level of detail.”** The plan itself warns that the effort of typing shortens typed AAC text. Its own table says the length of typed text “may reflect effort rather than preference.” The instruction carries no such caution."),
p("**Within a conversation, the AI sees its own suggestions as the user’s speech.** The app sends the user’s earlier replies as the user’s own past turns, and the AI wrote most of those. In the test data, 47 of 60 were picked options; that data is authored, but the design aims for a high share. This stops at the end of each conversation, and reading past conversations never uses picked options as examples. Nobody has tested whether this pulls the suggestions toward the AI’s own style within a conversation."),
p("**During a live conversation, a response option is all or nothing.** The user speaks it as written, asks for others, or types from scratch. The app has no way to edit an option before speaking it. The review word editor is the only way to correct an option’s wording, and only after the conversation."),

h2("6.3  What These Signals Can’t Tell Apart"),
p("A rising share of options picked could mean the app sounds more like the user. It could equally mean the user is deferring to the app. Every passive count moves the same way in both cases. The user’s own rating isn’t reliable either (Section 8). Telling the two apart needs a comparison against a generic control."),

// ===== 7 =====
h1("7.  What the Live Experiments Showed"),
h2("7.1  Limitations"),
p("These limits apply to every result in this section."),
...ul([
    "**Authored material.** The evaluating agent wrote both personas, their sample lines and the reference lines used to judge them, from the persona descriptions. None of it is real speech.",
    "**Shared vocabulary.** The judged lines, the example lines and the Reframe instruction share casual words (“nah,” “honestly,” “kinda”). Results can partly reflect matching those words.",
    "**Same model.** The same AI model (Sonnet 5.5) wrote the suggestions and was the main judge.",
    "**Small samples.** Most cells hold 8 to 16 options, and many repeat each other. Marc’s 96 rated options contain only 65 different texts.",
    "**One partner turn.** Every test was a single partner turn with no earlier conversation.",
    "**Missing parts of the real setup.** The dose experiment had no partner selected. It also left out the Express Panel section, so no tested setup matches what a user with their own buttons sends.",
    "**A scoring defect, since fixed.** The review experiment’s first scoring misread the judge’s answers; this document uses the corrected re-scoring.",
    "**An easier task.** Telling Marc from Grace is much easier than answering “is this me?”",
]),

h2("7.2  What the Fidelity Score Measures"),
p("For Marc, the score mostly measures how short and casual an option is. Allowing for the turn, the option’s length and whether it contains a shared casual word accounts for 84% of the differences between setups. The rest could be chance. The “gap closed” percentages are therefore mostly a length scale: Marc’s own lines average about 5 words, Grace’s about 11."),
p("For Grace, the setup differences hold up after the same adjustment. The score carries more than length for her."),

h2("7.3  The Dose Experiment"),
p("The dose experiment added one layer at a time. Marc’s own lines average 4.0 words and score 4.67. Grace’s average 8.9 words and score 4.89. “Reliable” in the table means reliably different from no profile."),
table([2560, 1250, 1150, 1000, 1250, 1150, 1000],
    ["Setup", "Marc score (gap closed)", "Reliable?", "Marc best-guess words", "Grace score (gap closed)", "Reliable?", "Grace best-guess words"], [
    ["No profile", "3.00 (0%)", "—", "9.8", "3.63 (0%)", "—", "9.6"],
    ["About Me", "3.44 (26%)", "no", "10.5", "4.56 (74%)", "yes", "12.1"],
    ["+ How I Sound", "4.13 (68%)", "yes", "7.8", "4.50 (69%)", "borderline, no", "11.1"],
    ["+ 4 example sentences", "4.13 (68%)", "yes", "8.6", "4.75 (89%)", "borderline, no", "13.6"],
    ["+ 12 example sentences (the app’s limit)", "4.06 (64%)", "yes", "8.8", "4.75 (89%)", "yes", "11.6"],
    ["About Me + 12 sentences, no How I Sound", "4.38 (82%)", "yes", "8.5", "5.00 (109%)", "yes", "13.5"],
    ["+ 30 sentences (beyond the app’s limit)", "4.25 (75%)", "borderline, no", "7.6", "5.00 (109%)", "yes", "12.8"],
    ["12 sentences + Reframe on every turn (Marc only)", "4.75 (105%)", "yes", "5.9", "—", "—", "—"],
    ["12 sentences + a “shorter” length sentence (Marc only)", "4.13 (68%)", "yes", "7.8", "—", "—", "—"],
]),
gap(),
p("What the table supports:"),
...ul([
    "**Any personalization moved the options away from the generic default.** For Marc, that movement is mostly shorter options and common casual words.",
    "**The table can’t rank the layers against each other.** No difference between two personalized setups is reliable. That includes removing How I Sound (4.38 against 4.06 for Marc, 5.00 against 4.75 for Grace) and adding the Reframe instruction.",
    "**More example sentences didn’t help beyond the first few.** Going to 30 raised near-copying to 5 of 64 options, mostly one clarify line reused.",
    "**Marc’s slang appeared in 0 of 320 options across the first seven setups.** Milder casual words did come through from his sentences: “kinda” appeared 0 times without example sentences and 9 times with them. Two whole sentences came back almost word for word.",
]),

h2("7.4  The Review Experiment"),
p("Section 5.3 has the table. After allowing for the number of comparisons, only the 50-closer-mark result holds up."),

h2("7.5  The Length Sentence on Its Own"),
p("A separate live run, with 48 options per setup:"),
table([6360, 3000], ["Instructions to the AI", "Best-guess words"], [
    ["No past conversations read", "8.5"],
    ["Length sentence only (“picks the fuller one”)", "9.8"],
    ["Typed example sentences only", "8.5"],
    ["Both, which is what a first review produces", "9.9"],
]),
gap(),
p("The length sentence’s effect is reliable."),

h2("7.6  Two Options per Category"),
p("A live run of 10 calls each:"),
table([3360, 3000, 3000], ["Measure", "One per category", "Two per category"], [
    ["Typical wait", "3.0 s", "4.5 s"],
    ["Cost per set", "0.66¢", "0.88¢"],
]),
gap(),
p("The instructions ask for the two options in a category to differ in content, so a pick between them doesn’t isolate style. About 15 of 40 pairs happened to keep the content and vary the style. The second option of a pair was longer in 24 of 40."),

h2("7.7  Cost of Running These Experiments"),
p("The two main experiments cost about $3 each, and checking runs cost about $4 more. One set of suggestions costs the app about two-thirds of a cent once the fixed instructions sit in the cache."),

// ===== 8 =====
h1("8.  What the Research Says"),
p("**Showing beats describing, but showing doesn’t reach casual talk.**"),
...ul([
    ["**Wang et al. (Findings of EMNLP 2025)** prompted three AI models (GPT-4o, Gemini 2.0 Flash, Llama 4 Maverick) with each author’s own writing samples.", [
        "With five samples, blog imitations matched the author’s style 17–21% of the time and forum posts 50–66%, against 88–91% for the authors’ own writing.",
        "Going from 2 to 10 samples changed results very little in every kind of writing: forum posts went from 67% to 70%, blogs from 19% to 20%.",
    ]],
    "**Jemama & Kumar (2025, academic essays):** continuing an author’s own text kept the author’s style, and sample paragraphs beat a statistical description.",
]),
p("**Imitating a specific person by prompting fell well short in 2024–25.**"),
...ul([
    ["**IMPersona (April 2025 preprint)** ran three-minute text chats with people who knew the person being imitated.", [
        "**The real person:** chat partners judged them real 71% of the time.",
        "**Prompting, best case** (Claude 3.5 Sonnet, given a short chat sample): 25%.",
        "**A small open model fine-tuned on about 13,000 of the person’s messages:** 44%. Fine-tuned on 500, it did no better than prompting.",
    ]],
    "The study tested one prompt setup on models two generations older than the one Conversant uses. It shows prompting was weak then, not that it has a fixed limit.",
]),
p("**The closest AAC case.** Weinberg (CHI 2026) fine-tuned a model on about 19,500 of one long-term AAC user’s own messages."),
...ul([
    "**It reproduced his Argentine slang.** Fine-tuning can reach literal idiolect.",
    "**He used its suggestions in 2.3% of messages.** That interface was inline completion as he typed, with no conversation context. The figure measures how often he took a suggestion, not whether it sounded like him.",
    "**Knowing his messages went into a log made him hold back** jokes and venting at first. A later filtering step, and his choice not to let it swear, left a “well-behaved” model.",
]),
p("**AAC users notice style.**"),
...ul([
    "**Valencia et al. (CHI 2023, 12 AAC users):** participants said they wouldn’t use suggested phrases that lacked their personal style. One said choosing a generated phrase means something different in front of a close friend than typing it.",
    "**SPICA (a master’s report based on an IUI 2026 paper):** a profile card gave only surface-level gains (small open models, synthetic conversations). The authors recommend short examples, turn by turn.",
]),
p("**Structured questions predict attitudes.** Park et al. (2024) predicted people’s attitudes from interviews or surveys at 82–86% of their own consistency, against 74% from demographics alone. That supports About Me as a channel for stance."),
p("**How much personal data buys.** Tomanek et al. (2023) studied one AAC user with ALS and 630 of his sentences, on expanding abbreviations:"),
...ul([
    "**Randomly chosen samples gave no gain.**",
    "**Samples matched to the current situation** gave +8 points.",
    "**Deeper tuning** gave +16.",
]),
p("Conversant shows its newest 12 examples, not ones matched to the situation."),
p("**Learning from contrasts and situations works in tests.**"),
...ul([
    "**TICL (2025):** showing the model its own drafts beside the author’s real text, with the model’s own explanation of the difference, supplied up to 77% of the gain. It used archived text from 20 real authors, rated by an AI.",
    "**CIPHER (NeurIPS 2024):** preferences tied to similar past situations cut editing by 31–73%, with simulated users. One shared preference for everything did worse than none on summaries.",
]),
p("**People’s own judgment of “sounds like me” runs high.**"),
...ul([
    ["**Baumler et al. (2026, 81 people)** found:", [
        "editing AI drafts moved them toward the person’s own style",
        "the result stayed closer to the AI’s style",
        "people still rated it as representative of themselves as their own writing",
        "perceived and measured style agreed only weakly",
    ]],
    "**Choice-blindness studies point the same way.** In Hall et al. (2013), 92% accepted an altered summary of their own answers. In Lind et al. (2014), only about a third noticed when someone swapped a spoken word.",
    "**People claim authorship they don’t feel.** In Draxler et al. (2024), people didn’t feel they owned AI-written text, yet declared themselves its authors.",
]),
p("**Suggestions pull writing toward the machine.**"),
...ul([
    "**Arnold et al. (2020):** predictive text made image captions shorter and more predictable.",
    "**Jakesch et al. (2023):** people using a biased writing assistant were about twice as likely to argue its side.",
]),
p("**AAC shapes the baseline.** Kane et al. (2017) studied 7 people with ALS. They wrote tersely to save effort, and partners sometimes read the brevity as rudeness. This group lost speech as adults, so it isn’t a CP population."),
p("**In service exchanges, unfamiliar partners care most about relevance.** In the Bedrosian, Hoag and McCoy studies, partners rated fast but only partly relevant messages lowest, and tolerated a stylistic flaw like repetition. The studies never varied personal wording."),
p("**AI judges aren’t a reliable measure of voice on their own.** In Sawant (2026), an authorship model didn’t confirm an AI judge’s winners; the measures barely agreed."),

// ===== 9 =====
h1("9.  Other Avenues, Ranked"),
p("The ranking is by expected value for the cost. Measurement comes first, because without it nobody can show that anything below works. Items 2 to 5 cost the user nothing."),

h2("9.1  Measure Whether Suggestions Sound Like the User"),
...ul([
    ["**What it is.**", [
        "**A blind check each month, offered and never required.** The app shows about 12 of the user’s own past partner turns. Under each, in random order: today’s best guess, and one made with About Me’s facts but without the voice parts. Leaving the facts in keeps the generic option from being easy to spot. The user’s own typed answer can be a third choice, as long as that conversation stays out of the examples. The question is “which would you say?” Two or three items repeat later to show how consistent the user is with themselves.",
        "**A weekly count from data already on the device:** the share of turns answered from the first set offered, with no New 4, Reframe or typing.",
        "**A fix to the “chosen from a card” figure.** That figure now counts picks made after New 4 or Reframe, picks from the fixed openers and goodbyes, and repeats of the user’s last line. The beta evaluator still labels it “a suggestion was good enough.”",
        "**A persona test before any model or prompt change,** using the dose-experiment method, for about $2 a run. It can also test settings nobody has tried, such as the model’s thinking setting; the app sets no randomness level. Checks on model changes have so far covered speed, cost and usable options, but not voice.",
    ]],
    "**Cost to the user.** About 5 minutes a month for the blind check. Nothing for the counts.",
    "**Cost to build.** Small to medium. The blind check can reuse the How I Sound screen.",
    "**Evidence.** Self-ratings run high, so only a comparison against a control separates “sounds like me” from “I’ve gotten used to it.”",
    ["**Risks.**", [
        "**Five testers give a weak answer across people** (Section 10).",
        "**The first-set count rises with deference as well as success.**",
        "**Generation must run on the device,** because conversations never leave it.",
    ]],
]),

h2("9.2  Remove the Signals the App Gets Wrong"),
...ul([
    ["**What it is.** A bundle of small fixes:", [
        "Check the length sentence against How I Sound’s brevity items before sending it, or compare length only within one kind of reply. Either removes Marc’s wrong “fuller” sentence.",
        "Stop counting picks from the fixed openers, wrap-up statements and goodbyes as length choices.",
        "Fix the item where “No idea, sorry.” counts as permission to joke.",
        "Leave practice conversations out of the reading, or tell the AI they were practice.",
        "Stop describing review answers to the AI as said “in real conversations.”",
        "Treat instructions with the same meaning as one (“shorter,” “keep it to five words”).",
        "Keep typed review answers under 4 words as “short replies they use” instead of dropping them.",
        "Let a removed example free its slot, and don’t let review sentences crowd out live ones for good.",
        "Settle which of the two “most important” labels wins.",
    ]],
    "**Cost to the user.** None.",
    "**Cost to build.** Small.",
    ["**Evidence.**", [
        "**The length sentence alone** lengthened the best-guess option by about 1.3 words, reliably, in the wrong direction for a terse user.",
        "**Practice skews the length count.** Running one shipped practice scenario three times removes the length instruction from the test data; ten runs reverse it.",
    ]],
    "**Risks.** A length measure within one kind of reply has less data and will speak up less often.",
]),
p("Section 2 lists the changes that followed this item."),

h2("9.3  Keep Reframe Instructions with One Tap"),
...ul([
    ["**What it is.**", [
        "After a Reframe the user accepts, a one-tap “Keep this — for this person, or for everyone?”",
        "Save the partner with each instruction.",
        "Use instructions typed in review as well.",
        "Optionally, a few one-tap presets: “shorter,” “more casual,” “blunter.”",
    ]],
    "**Cost to the user.** One tap. The typing is already done.",
    "**Cost to build.** Small.",
    "**Evidence.** Asked plainly on every turn, the AI made a terse persona’s options much shorter and more casual. In version 0.13.6 none of the 6 test instructions lasts.",
    ["**Risks.**", [
        "An instruction kept by mistake shapes every later turn, so it must be visible and removable in About Me.",
        "A preset worded around age (“talk like a 17 year old”) invites a stereotype; presets should describe register, not age.",
        "It never overrides the safety rules.",
    ]],
]),
p("Section 2 describes the version built after this evaluation, which places the choice in About Me."),

h2("9.4  Let the User’s Evidence Outrank Style Rules"),
...ul([
    ["**What it is.**", [
        "**One line in the instructions:** where this user’s own sentences, kept instructions or per-person note conflict with a style rule, follow the user. The style rules covered are no “Oh/Well” openers, the softened decline, full-sentence choice answers, and the warmth default. Safety rules stay absolute: no invented facts, no outside knowledge, no vulgarity, speakable text.",
        "**Show the user’s own declines beside the decline instruction,** and their own clarifications beside the clarify instruction. The general examples didn’t move the decline template.",
        "**Give a number for length** (“about 4 words”), worked out on the device, instead of “shorter” or “fuller.”",
        "**Remove or neutralize the fixed example phrasings** written in a user’s voice.",
    ]],
    "**Cost to the user.** None.",
    "**Cost to build.** Small, plus a re-test of the standing rules.",
    "**Evidence.** The decline template held in 12 of 12 runs, whatever the profile said. Three of Marc’s own How I Sound picks break the opener rule.",
    ["**Risks.**", [
        "These rules reflect earlier decisions (the empty-opener rule, v0.3.9; the requirement that a decline give a reason), so this is a decision for the project.",
        "A bare “No” can read as rude to a stranger, so relaxing the decline rule may belong per person.",
    ]],
]),

h2("9.5  Add a Speakable Short Version"),
...ul([
    "**What it is.** Each option already carries a 1-to-3-word label. In “short version only” mode, the user sees that label while the device speaks the full sentence, about 9 words. A third field, a short version of the same reply that the device can actually speak (about 3 to 5 words), would let a terse user speak tersely. Each pick would also record a clean style choice, same content and different length.",
    "**Cost to the user.** None.",
    "**Cost to build.** Small to medium. The same call generates it. The app’s reply format and the instructions that describe it must change together.",
    "**Evidence.** It removes a mismatch that exists in version 0.13.6. It gives a comparison with the content held constant, which the plan says the app needs to learn about voice.",
    "**Risks.** A small cost in output, and a little more to read if the screen shows both.",
]),

h2("9.6  Feed the AI Before-and-After Pairs"),
...ul([
    ["**What it is.**", [
        "**The pairs already exist.** The app saves a set of options the user turned away from, the user’s Reframe instruction or typed words, the reply they finally used, and who the partner was. Review rewords add more pairs of the same kind.",
        "**Send the two to four most recent pairs** for the current partner with each request.",
        "**Optionally,** have an occasional extra call turn them into a short style note.",
    ]],
    "**Cost to the user.** None.",
    "**Cost to build.** Medium.",
    ["**Evidence.**", [
        "**TICL and CIPHER** (Section 8) support learning from such contrasts.",
        "**The test data has about 0.35 such episodes per conversation.**",
        "**The app uses only the end of each one:** typed replies become examples with no context, and the rejected sets and the partner go unused.",
    ]],
    ["**Risks.**", [
        "Rejected wording can leak back into the options.",
        "Studies have shown the benefit with archived text and simulated users, not live users.",
    ]],
]),

h2("9.7  Redesign Review Around Recognition"),
...ul([
    "**What it is.** Restyled versions to tap instead of typing. A one-tap “why it missed.” A “turns worth a look” walk. A summary of what the review changed.",
    "**Cost to the user.** A few taps per turn instead of about 30 keystrokes.",
    "**Cost to build.** Medium.",
    "**Evidence.** Typing is most of review’s cost.",
    "**Risks.** The restyled versions come from the AI, so they stay within its range.",
]),

h2("9.8  Edit an Option Before Speaking It"),
...ul([
    "**What it is.** A control in “In my own words” that loads the last option shown, for editing word by word. The app saves each edit as an AI-wrote, user-said pair.",
    "**Cost to the user.** Low to medium. It’s optional, but it adds time during the silence the app exists to shorten.",
    "**Cost to build.** Medium. The project hasn’t decided the gesture yet (TODO.md, “I, Robot” item 3).",
    ["**Evidence.**", [
        "Editing moves text toward a person’s own style (Baumler).",
        "Weinberg called partial acceptance essential to authorship.",
    ]],
    "**Risks.** Edited text stays closer to the AI’s style than writing from scratch, so it’s weaker evidence of style. Its value is in the before-and-after pair.",
]),

h2("9.9  Make Register per Person and Measure It"),
...ul([
    ["**What it is.**", [
        "A test of the per-person menu and note: Marc with Mom, Sofia and his doctor, note on and off. About $2.",
        "Show the AI only the examples said to the current partner, falling back to everyone.",
        "Record who entered each About Me answer and note: the user or a supporter.",
        "Make it easy to pick the partner at Start conversation.",
    ]],
    "**Cost to the user.** Possibly one tap at the start of a conversation.",
    "**Cost to build.** Small for the test, medium for the rest.",
    ["**Evidence.**", [
        "**Version 0.13.6 shares every example across partners.** While Marc talks to Mom, the AI sees a line he said to his sister (“Prepare to lose, small child”) presented as the best evidence of how he talks.",
        "**Nobody has measured the per-person channel.**",
    ]],
    "**Risks.** The wrong partner applies the wrong register. The tap has to stay optional.",
]),

h2("9.10  Include the Voice and Placeholder Phrases"),
...ul([
    ["**What it is.**", [
        "**Help the user pick a voice** whose age and manner fit them.",
        "**Offer floor-holding phrases that fit the user’s register.** These are the placeholders the app speaks on its own, in the user’s voice, without a tap.",
        "**Count the user’s edits** to the placeholders and the Commands phrases as evidence of how they talk. In version 0.13.6 the reading of past conversations treats all of them as the app’s words.",
    ]],
    "**Cost to the user.** None, or a one-time choice.",
    "**Cost to build.** Small.",
    ["**Evidence.**", [
        "**Placeholders are the sentences most often spoken in the user’s voice,** and by default the app wrote them.",
        "**The built-in voices don’t offer younger voices.**",
    ]],
    "**Risks.** Low.",
]),

h2("9.11  Mark Earlier Picked Options for the AI"),
...ul([
    "**What it is.** Mark earlier turns that came from a picked option, or move them out of the place the AI reads as the user’s own past replies.",
    "**Cost to the user.** None.",
    "**Cost to build.** Small.",
    "**Evidence.** Untested. The research shows that continuing a text keeps that text’s style.",
    "**Risks.** It could affect how well the conversation hangs together. Test it first.",
]),

h2("9.12  Practice Mode for the User’s Own Words"),
...ul([
    ["**What it is.**", [
        "**Scenarios written to draw out the user’s own typed replies.** Practice is private, low-stakes and repeatable, and therapists have asked for written scenarios.",
        "**The app would mark the output as practice** and say so to the AI.",
        "**Facts from practice would go through the “is that true about you?” question** the design document promises.",
    ]],
    "**Cost to the user.** Optional sessions.",
    "**Cost to build.** Small to medium. Scenario writing exists on the device already.",
    "**Evidence.** Untested.",
    "**Risks.** The scenario sets the register (a job interview, an angry partner), and invented content can leak in.",
]),

h2("9.13  Optional Import of Existing AAC History"),
...ul([
    "**What it is.** Read history the user already has: Grid 3 chat history, TD Snap data tracking, text messages. Preview every line, remove other people’s names, use it to seed examples, and keep it only on the device.",
    "**Cost to the user.** Medium; the export probably needs a supporter.",
    "**Cost to build.** Large.",
    ["**Evidence.**", [
        "**It’s the fastest pool of the user’s own conversational sentences.**",
        "**Volume only pays if the app picks examples to match the situation.** The AI sees at most the newest 12, and Tomanek found randomly chosen samples gave no gain.",
    ]],
    ["**Risks.**", [
        "**Typing effort and word prediction shape device history.**",
        "**Private details can come out of context.** Weinberg saw his own family and religious details come up out of place.",
        "**History may not exist.** Many devices have it off by default or make it hard to export.",
        "**Texts and email are writing, not speech.**",
    ]],
]),

h2("9.14  Two Options per Category as a Comparison"),
...ul([
    "**What it is.** Ask for the second option in a category to keep the content and change the style, and record which one the user picks.",
    "**Cost to the user.** More to read and about 1.5 seconds more wait.",
    "**Cost to build.** Small.",
    "**Evidence.** The current setting asks for different content. It costs about a third more per set. Item 5 gets the same comparison more cheaply.",
    "**Risks.** Fatigue from choosing among eight options. The second option of a pair tends to be longer.",
]),

h2("9.15  Deferred, with a Trigger to Revisit"),
...ul([
    ["**Fine-tuning a model on the user’s own text.**", [
        ["**Where it stands:**", [
            "closed to new accounts at OpenAI’s own service since May 7 2026",
            "not offered by Anthropic, the Gemini API or Mistral, and closed on Amazon for Claude models",
            "still offered by Microsoft’s and Google’s enterprise clouds, which need a cloud subscription, sign-in setup and, at Microsoft, an hourly hosting fee",
        ]],
        "**Training on chosen-versus-rejected pairs** (offered on Microsoft’s cloud) would use data the app already saves on every turn.",
        "**Plain fine-tuning needs thousands of the user’s own sentences.** At this app’s composing rates, that’s months to years.",
        "**Revisit** if a user has several thousand of their own sentences, or if preference training becomes reachable without a server.",
    ]],
    "**A second AI pass to rewrite options in the user’s style.** It would roughly double the wait. A plain request in the first pass already shortens and loosens the options.",
    "**Partners describing how the user talks**, as input to the AI. Start with it only inside the measurement in item 1.",
]),

// ===== 10 =====
h1("10.  Is “Sounds Like Me” Impossible?"),
h2("10.1  The Literal Version Is Out of Reach"),
p("“Literal” here means the user’s own slang, catchphrases and turns of phrase, so close that nobody could tell. It’s out of reach with this design, not impossible in principle. The reasons:"),
...ul([
    "**Prompting with a few examples has imitated specific people poorly in casual writing.** Wang found blog and forum imitations far below the authors’ own writing, and more samples didn’t help. IMPersona found prompting passed as the person 25% of the time against the person’s own 71%. Both used 2024–25 models.",
    "**The individual signal in short messages lies where nobody has shown prompting can reach.** Schwartz et al. (2013) picked the author of a single 14-word tweet out of 50 candidates 51–71% of the time, against 2% by chance. That signal sat in function-word patterns and small character habits such as “^ ^” and “..”, and the character habits don’t survive speaking aloud.",
    "**Fine-tuning can reach it, but not from here.** Weinberg’s model, trained on about 19,500 of one user’s messages, reproduced his slang. Section 9 covers why that route is closed or costly for Conversant.",
    ["**The app’s own rules exclude part of it on purpose.**", [
        "catchphrases live on Express Panel buttons",
        "the rules exclude vulgarity",
        "the rules ban openings like “Well,” “So” and “Oh”",
        "In recorded phone conversations, how a person opens a turn (“sure,” “yeah”) and their set phrases carry some information about who is speaking (Doddington 2001). Common ones like “you know” carry little.",
    ]],
    "**There may be no clean “true voice” to copy.** AAC users who have typed since childhood formed their written voice under the device’s effort and the partner’s pace. The plan calls the user’s own AAC output both the best evidence of how they sound and shaped by the effort of producing it.",
]),

h2("10.2  What “Sounds Like Me” Includes Beyond Wording"),
p("This evaluation measured wording. A partner hears more than that:"),
...ul([
    "**The synthesized voice:** its age, gender and accent.",
    "**The phrases the app speaks on its own** in the user’s voice: placeholders such as “I’m thinking about that,” and by default the app wrote them.",
    "**In “short version only” mode,** the label on screen differs from the sentence spoken.",
]),
p("A 17-year-old’s terse lines in an adult voice, after “Working that out,” won’t sound like him whatever the wording."),

h2("10.3  The Answer Differs by User"),
...ul([
    "**Users who type often** fill the 12 example slots within days. The examples are then simply their last 12 typed sentences, shortened by effort, and the instructions tell the AI to follow their “level of detail.”",
    "**Users who never type and never review** get How I Sound and About Me only. The app never makes a length sentence for them.",
    "**Supporter-assisted users** may have About Me, How I Sound and the per-person notes entered by a parent or therapist. The app sends all of it as the user’s own word. That’s a route to a tidier version of the user that nobody can see happening.",
]),

h2("10.4  A Narrower Version Looks Achievable"),
p("A definition the project can meet and measure:"),
quote("Each user chooses the app’s response options over a generic assistant’s in a blind comparison more often than chance, and the share of turns answered from the first set of options grows over time."),
p("The only support so far is authored personas judged by the same model that wrote the options. This is a goal to test, not a result."),

h2("10.5  Measuring It in a Five-Tester Beta"),
...ul([
    "**First-set fit, weekly.** Counted from data already saved, at no effort to testers.",
    ["**The blind comparison, monthly.** About 5 minutes, offered (Section 9.1).", [
        "One tester needs 18 wins out of 24 to show a preference on their own. If their true preference is 60%, they’ll show it only about 1 time in 5.",
        "Pooled across 5 testers, 180 items detects a 60-versus-50 preference about 75% of the time, if the testers are alike. If they differ, the pooled test raises a false alarm about 16% of the time, and a test of whether the result holds across testers has about an 18% chance of succeeding.",
        "Repeated items show how consistent each user is with themselves, which is their personal ceiling.",
    ]],
    "**Interviews at weeks 2 and 6.** “Show me one that sounded like you and one that didn’t. What was wrong with the one that didn’t?” Sort each miss: length, formality, wrong kind of reply, missing fact, humor, or the AI’s own habits.",
    "**A persona test before any model or prompt change,** using the dose-experiment method.",
]),

h2("10.6  What Not to Use"),
...ul([
    "**An absolute “does this sound like me, 1 to 7” rating, or the raw share of options picked, as proof.** Both run high regardless of real fit.",
    "**A live test that switches the voice section off for half of real conversations.** It needs about 390 sets per arm to detect a 60-versus-50 difference. The only estimate of beta volume, about 630 user turns, comes from authored data, and real volume could be several times higher or lower. One alternative degrades no turn: show one option made with the profile and one made without it in each category, in random order. It needs about 194 picks, but it doubles the reading and adds a second call.",
]),

h2("10.7  What the Documents Promise"),
p("The user-facing documents should promise the narrower version. For example: “Conversant uses what you tell it, and the replies you pick, to word its suggestions more the way you would. They won’t always be your exact words, and your own words are always one step away.”"),
p("These passages state, as fact, outcomes nobody has measured:"),
...ul([
    "**Product Overview ¶47** (“more and more like them”). It also implies learning happens on its own; it happens only when the user leaves a review or presses a button.",
    "**Product Overview ¶103.**",
    "**Beta Test Plan, week 2:** “that’s what makes the response options sound like you.” It credits About Me, people and places, and never mentions How I Sound or Review.",
    "**The Review tab’s introduction:** “What you write teaches the app how you talk.” This is the claim the review experiment found no support for.",
    "**How I Sound’s introduction, one questionnaire note, and the Windows manual’s glossary.**",
]),
p("Two passages are out of date in the other direction. Product Overview ¶125 and ¶206 say the app doesn’t use review answers yet and that it will ask first. The app already uses them, without asking."),
p("The Conversation Review document also promises two things nobody has built: “a report to us” for misheard words, and asking whether a fact from practice is true."),
p("The app wording in the Review tab and How I Sound introductions has since changed (Section 2)."),

// ===== 11 =====
h1("11.  Sources"),
note("The research this document cites, with the details the evaluation recorded. Two further sources the evaluation couldn’t locate or check appear in the Evidence Appendix under C28."),
reference("Arnold, K. C., Chauncey, K., & Gajos, K. Z. (2020). Predictive Text Encourages Predictable Writing."),
reference("Baumler et al. (2026). A post-editing study with 81 participants. arXiv 2604.24444."),
reference("Bedrosian, J., Hoag, L., & McCoy, K. F. Studies of utterance-based AAC messages in service exchanges, summarized in McCoy, K. F., Bedrosian, J., & Hoag, L. (2010). Implications of Pragmatic and Cognitive Theories on the Design of Utterance-Based AAC Systems. NAACL HLT 2010 Workshop on Speech and Language Processing for Assistive Technologies."),
reference("Braun et al. (2023). Disfluency profiles as speaker-specific (Evidence Appendix, N10)."),
reference("Cho, H., Sharma, K., Jedema, N., Ribeiro, L. F. R., Moschitti, A., Krishnan, R., & May, J. (2025). Tuning-Free Personalized Alignment via Trial-Error-Explain In-Context Learning (TICL)."),
reference("Doddington, G. (2001). Speaker Recognition based on Idiolectal Differences between Speakers. Eurospeech 2001."),
reference("Draxler et al. (2024). ACM Transactions on Computer-Human Interaction (TOCHI)."),
reference("Gao, G., Taymanov, A., Salinas, E., Mineiro, P., & Misra, D. (2024). Aligning LLM Agents by Learning Latent Preference from User Edits (CIPHER). NeurIPS 2024."),
reference("Hall et al. (2013). PLoS ONE 8: e60554."),
reference("Jakesch, M., Bhat, A., Buschek, D., Zalmanson, L., & Naaman, M. (2023). Co-Writing with Opinionated Language Models Affects Users’ Views. CHI ’23."),
reference("Jemama, R., & Kumar, R. (2025). How Well Do LLMs Imitate Human Writing Style?"),
reference("Kane, S. K., Morris, M. R., Paradiso, A., & Campbell, J. (2017). “At times avuncular and cantankerous, with the reflexes of a mongoose”: Understanding Self-Expression through Augmentative and Alternative Communication Devices. CSCW ’17."),
reference("Lind et al. (2014). A study of whether speakers notice a swapped word."),
reference("McDougall & Duckworth (2018). Disfluency profiles as speaker-specific (Evidence Appendix, N10)."),
reference("Murali, N. (2026). SPICA: Scalable and Personalized Conversational Agent for AAC Users. Master’s project report, University at Buffalo. Based on Pal et al., IUI ’26."),
reference("Park, J. S., et al. (2024). LLM Agents Grounded in Self-Reports Enable General-Purpose Simulation of Individuals."),
reference("Sawant (2026). arXiv 2608.19746."),
reference("Schwartz, R., Tsur, O., Rappoport, A., & Koppel, M. (2013). Authorship Attribution of Micro-Messages. EMNLP 2013."),
reference("Shi, Q., Jimenez, C. E., Dong, S., Seo, B., Yao, C., Kelch, A., & Narasimhan, K. (2025). IMPersona: Evaluating Individual Level LM Impersonation. Preprint, arXiv 2504.04332."),
reference("Tomanek et al. (2023). Abbreviation expansion for one AAC user with ALS, using 630 of his sentences."),
reference("Valencia, S., Cave, R., Kallarackal, K., Seaver, K., Terry, M., & Kane, S. K. (2023). “The less I type, the better”: How AI Language Models can Enhance or Impede Communication for AAC Users. CHI ’23."),
reference("Wang, Z., Tripto, N. I., Park, S., Li, Z., & Zhou, J. (2025). Catch Me If You Can? Not Yet: LLMs Still Struggle to Imitate the Implicit Writing Styles of Everyday Authors. Findings of EMNLP 2025. arXiv 2509.14543."),
reference("Weinberg (2026). I, Robot? Exploring Ultra-Personalized AI-Powered AAC; an Autoethnographic Account. CHI ’26. arXiv 2509.13671."),

// ===== APPENDIX =====
(APPX = true, h1("Evidence Appendix")),
p("**Status key.**"),
...ul([
    "**Confirmed:** holds as stated.",
    "**Qualified:** holds with the correction given. All of C1–C29 came back qualified.",
    "**Refuted part:** a sub-claim found false. These appear only here.",
    "**Unverifiable:** the material available couldn’t settle it.",
]),
p("**Names used in the code and the experiments.**"),
...ul([
    "**Kinds of reply.** PREFERRED is the best guess, DISPREFERRED the decline, INITIATIVE the change of direction and REPAIR the clarify option. CHOICE_OTHER is an answer outside the choices the partner offered.",
    ["**Dose experiment setups (Section 7.3).**", [
        "C0: no profile",
        "C1: About Me",
        "C2: About Me plus How I Sound",
        "C3: C2 plus 4 example sentences",
        "C4: C2 plus 12 example sentences",
        "C5: About Me and 12 example sentences, without How I Sound",
        "C6: C2 plus 30 example sentences",
        "C7: C4 plus the Reframe instruction on every turn (Marc only)",
        "C8: C4 plus a “shorter” length sentence (Marc only)",
    ]],
    ["**Review experiment setups (Section 5.3).**", [
        "NULLH: past conversations never read",
        "K0: past conversations read, none reviewed",
        "K1, K3 and K10: 1, 3 and 10 conversations reviewed",
        "K3C: a review made only of closer marks",
        "CLOSER50: 50 closer marks on the shortest option, in all 17 conversations",
        "LEANONLY and EXONLY, in the isolation run of Section 7.5: the length sentence only, and the example sentences only",
    ]],
]),
p("Paths are relative to the project root unless they start with `scratch/`, which means the evaluation’s working folder, `C:\\Users\\ken\\AppData\\Local\\Temp\\claude\\C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC\\e1f5cd26-5878-4764-aab4-ca5a3f9226d1\\scratchpad\\slm\\`. The evaluation examined code version ec3de37 with no local changes, and it modified no project files."),

h2("Which Results Survive the Holm Correction"),
p("Holm’s method adjusts for the number of comparisons within each experiment. Source: `scratch/dose-validity/holm-out.txt`."),
table([2200, 3580, 3580], ["Experiment", "Survives", "Fails (raw p < .05)"], [
    ["adv-c8 (18 tests)", "Haiku all-four, neutral turns, pooled (.001 → .018)", "Haiku single-option, pooled (.022); Haiku single-option, Marc (.023); Haiku all-four, Grace (.033); Grace content-turn splits (.006, .011)"],
    ["verify-c4 rejudge", "CLOSER50 best guess (.0013 → about .02–.03); CLOSER50 whole set (.0004 → about .01)", "Pooled K1+K3+K10 whole set (.024); K1 whole set (.118)"],
    ["verify-c4 ablate (5)", "none", "none raw significant"],
    ["verifier-c6 (17)", "Best guess K0 against no harvest (.0009); LEANONLY against no harvest (.0011); REPAIR K0 against no harvest (.0001)", "REPAIR LEANONLY (.0076 → .106); INITIATIVE K0 (.030)"],
    ["Dose fidelity, Marc (13)", "C2, C3, C4, C5, C7, C8 against C0", "C6 against C0 (.0077 → .054); C7 against C4 (.030 → .18); C1 against C0 (.080); C5 against C4 (.37)"],
    ["Dose fidelity, Grace (9)", "C1, C4, C5, C6 against C0", "C2, C3 against C0 (.0105 → .053); C5 against C4 (.49)"],
]),
gap(),
p("Every permutation p-value treats each option as independent. Marc has 65 distinct texts among 96 rated options and Grace 62 among 80, so these p-values are optimistic."),

h2("C1. Literal Idiolect Is Out of Reach"),
p("**Claim tested.** Literal idiolect is out of reach. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "Under the current instructions the app reaches register and some exact wording, but not reliably slang markers. By design, it never produces catchphrases.",
    "It works by prompting only. At most 12 harvested sentences of 4 or more words reach the prompt (`app/js/voice-harvest.js:38-39, 118, 123`; `app/js/voice.js:388`). `setSample` has no caller, so the app has no writing-sample screen.",
    "Signature markers appeared in 0 of 320 options (C0–C6), 0 of 32 (C8) and 2 of 32 (C7). Both C7 hits are decline options, which the judge never rated.",
    "“kinda”: 0/160 in C0–C2 and 9/160 in C3–C6.",
    "Some example sentences came back nearly word for word, for example “Yeah, I’m down. What time?” in C6.",
    "C4’s mean option length is 9.27 words against a 4.0-word reference, and 4 of the 10 reference lines are under 4 words.",
]),
p("**Refuted parts.**"),
...ul([
    "“Never appeared even when exemplars contained them” omits C7 and holds only for 11 hand-picked words.",
    "“A few dozen user-written sentences” is too high.",
    "Weinberg’s 2.3% comes from an inline completer and doesn’t measure voice; that paper’s model did reproduce slang.",
    "No test checked whether anyone could tell the two apart.",
    "**Correction to the earlier refutation:** an earlier verifier marked Wang’s “very little” finding as an all-domain average. The citation audit read Figure 5, which has one line per dataset: Reddit 66.9→69.8, Blog 19.3→19.6. The finding holds for informal domains specifically. It averages across three models, not across domains (`scratch/audit-cites/fig5_values.txt`).",
]),
p("**Evidence.**"),
...ul([
    "`scratch/exp-dose/gen-raw.jsonl`, `blocks.json`, `corpus.mjs`",
    "`app/js/llm.js:235`",
    "`voice-harvest.js:52-80`",
    "`voice.js:405-407`",
    "arXiv 2504.04332 Table 1; arXiv 2509.13671",
]),

h2("C2. Fixed Style Rules Override User Evidence"),
p("**Claim tested.** Fixed house-style rules override the user’s evidence. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**No tie-break exists between the voice block’s precedence claims and the absolute rules.** The voice block says it governs wording (`voice.js:340`, `:425`). The absolute rules are `llm.js:235`, `:588`, `:602` and `:568`.",
    "**Scoped overrides do exist:** steer `llm.js:482`, which keeps the four-slot structure; partner note `relationships.js:536`; humor decline `worldview.js:629`.",
    "**Where the voice block sits.** It starts at character 28,801 of 44,389 (64.9%). About 18.2K of the fixed text is constraint rules. NO_OUTSIDE_KNOWLEDGE is 9,574 characters, against 6,698 for the part about how Marc talks.",
    ["**The decline template in the tests.**", [
        "Marc’s invitation decline contains “I’d love/like to, but” in 12 of 12 generations. Only 1 of his 96 decline options uses his own style.",
        "“wiped” appears in 8 Marc options across 6 of 9 conditions, and in 0 Grace options.",
        "Grace’s invitation decline moved off the template in 7 of 8 runs of C1–C6.",
    ]],
]),
p("**Refuted parts.**"),
...ul([
    "“No rule lets the user’s words win.”",
    "“10 of 10” (the count is 12 of 12).",
    "“12–15 words.”",
    "“‘Dinner where?’ verbatim 3×.” It appears in no generated option; “Sorry, dinner where?” appears 3× as a natural clarify reply.",
    "“British ‘fancy’ as user-voice examples.” It appears in partner-turn examples only, at lines 568 and 579.",
    "“‘Honestly,’ as override evidence.” It’s flat at about 9%, and Marc’s own corpus contains it.",
]),
p("**Evidence.** `scratch/prompt-assembly/sizes-marc-prompt.txt`, `marc-prompt.txt`, `fixed-quotes.txt`; `app/js/sound-check-items.js:161, 191, 294`."),

h2("C3. The Reframe Instruction as a Lever"),
p("**Claim tested.** The Reframe instruction moves the options more than anything else, and the app throws it away. **Status.** Qualified, with a major correction."),
p("**Corrected.**"),
...ul([
    "**C7 put the steer on every turn** for Marc only (n=8, 1 run). Fidelity 4.75 against C4’s 4.06; 6 of 8 turns better, 2 tied.",
    "**After adjustment, the lead disappears.** With turn fixed effects plus word count and a shared-marker indicator, C7−C4 goes from +0.69 to −0.03 (`scratch/dose-validity/ols-out.txt`). C7−C4 fails Holm (.18).",
    "**No rated C7 option contains “nah” or “ugh.”**",
    "**C7 options are closer to the unseen reference than to the example sentences shown.** Mean best edit similarity is .33 against .18, and 38% share a two-word sequence with the reference. That points to a prior shared by the reference author and the generator.",
    "**C7 overlaps C5** (4.38): 3 better, 0 worse, 5 ties.",
    ["**In the app, a typed steer lasts the whole partner turn.**", [
        "Set at `app/js/app.js:4007`.",
        "Reused at `:3809`, `:3909` and `:5099`.",
        "Cleared by `clearTurnSteering` at `:3840`.",
    ]],
    ["**How the app stores and promotes steers.**", [
        "Stored in `voice.json` (`voice.js:194-198`) and as a reframe event with no partner field (`storage.js:2424-2434`).",
        "Promoted only on 2 normalized-identical repeats (`voice.js:186-224`). None of the 6 test steers qualify, and the app doesn’t group “shorter” with “keep it to five words.”",
        "A promoted steer goes into the cached block (`voice.js:412-417`), not the per-turn tail.",
    ]],
    "**Review steers never reach the AI.** The app saves them (`review-model.js:404-406`) and never passes them to `recordSteer`, whose only caller is `app.js:3982`.",
    "**Practice steers count.** They pass the same gate (`app.js:3982`), and the app saves practice conversations.",
]),
p("**Refuted parts.**"),
...ul([
    "“Applies to one regeneration only.”",
    "“Log copy carries a partner.”",
    "“Never recorded during review.”",
    "“Closed Marc’s whole gap” (judge saturation).",
    "“Strongest in either experiment.”",
    "The draft’s bottom-line wording, that one typed instruction moved a terse persona further than anything else tested.",
]),

h2("C4. No Measurable Gain from Realistic Reviewing"),
p("**Claim tested.** Review shows no measurable improvement at realistic amounts. **Status.** Qualified, with a major correction."),
p("**The original scoring script misread answers.** `scratch/exp-review/judge.mjs:37` took the first A/B/T letter anywhere in the reply."),
p("**Corrected re-judge** (`scratch/verify-c4/rejudge.json`):"),
table([3360, 3000, 3000], ["Comparison", "Best guess", "Whole set"], [
    ["Noise floor", "0.417", "0.521"],
    ["K1", "0.500", "0.646"],
    ["K3", "0.438", "0.583"],
    ["K10", "0.479", "0.583"],
    ["CLOSER50", "0.792", "0.833"],
]),
gap(),
...ul([
    "**Pooled whole-set result for K1–K10** was 27–12. Raw p .024, which fails Holm; the pairs also share baselines.",
    "**Turn-clustered 95% upper bounds:** best guess 0.56–0.60, whole set 0.73–0.79.",
    "**Against no harvest** (`ablate.json`): K0 0.438, K1 0.417, K10 0.333. Not significant.",
    ["**Ablations.**", [
        "Flipping the length sentence alone gave 7.96 words and 0.583 against K0, not significant.",
        "CLOSER50 against flip-only: 0.563.",
        "CLOSER50 also removed the two composed example sentences (`conditions.mjs:142`).",
    ]],
    "**Simulated answers.** Typed answers averaged 9.09 words and rewords 7.29, against a 5.67-word reference (`stats.mjs`).",
    "**Judge.** Parsed correctly, it decided 176 of 257 pairs (68%), with “A” in 57% of A/B verdicts.",
    "**Mom test:** n=4 per cell, no effect either way.",
]),
p("**Refuted parts.**"),
...ul([
    "“The judge was weak, 30% decided, 61% first-position.” That came from the parser fault.",
    "The claim that the test couldn’t rule out effects below about 20 points. The real bounds are about 10 points on the best guess and 25 on the whole set.",
    "“Mostly by reversing the length sentence.” Reversing it explained about two-thirds of the length change and about half the gain.",
]),

h2("C5. Review Reaches the AI Two Ways"),
p("**Claim tested.** Review reaches the prompt through only two channels. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Channel 1, example sentences:** at most 12, at least 4 words, with review answers placed last so the newest-first walk reaches them first.",
    "**Channel 2, the length sentence,** which can appear, disappear or flip.",
    "**Answers the app never reads.** `reviewedTurns` never reads steers, reframers or misheard notes (`voice-harvest.js:237-253`), and they don’t withdraw the live choice. Only `more` and `sound` withdraw.",
    "**K3C’s 10 closer marks left the prompt byte-identical by cancellation** (`scratch/verify-c5/netout.mjs`).",
    "`reviewContributions` (`voice-harvest.js:267`) has had no caller since 4b2613f. About Me’s list (`worldview-ui.js:622-679`) shows the combined result, unlabeled.",
    "**Leaving any review triggers** `refreshVoiceHarvest` (`review-ui.js:186`, and `worldview-ui.js:673`).",
    "**Both prompt sentences describe review material as “in real conversations”** (`voice.js:387`, `399-400`).",
]),
p("**Refuted parts.** The draft’s “change nothing beyond withdrawing” grouping; “never shown” is overstated."),
p("**Documentation finding.** The Conversation Review document promises “a report to us” for misheard words (¶156, ¶227, ¶260). No path exists in `weekly-send.js`, `usage-summary.js` or `diagnostics.js`, and nothing outside `review-ui.js` reads `.misheard`. The manuals already carry the correction (iPad ¶461, Android ¶448, Windows ¶447)."),

h2("C6. The Length Lean Tracks Reply Kind"),
p("**Claim tested.** The length lean mixes length with the kind of reply. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**How it measures.** `measureLengthLean` (`voice-harvest.js:140-170`) compares the pick with the median of all options offered, including static palettes.",
    "**Where the clarify option sits.** It falls below the median in 40 of 47 test sets and 340 of 356 live sets. That makes it a plurality of below-median options (40 of 96), not a majority.",
    ["**Marc’s picks.**", [
        "0 clarify picks.",
        "18 of his 28 “longer” picks are change-of-direction, decline or CHOICE_OTHER options.",
        "His best-guess picks split 7 longer, 8 shorter, 5 level.",
    ]],
    "**What category alone predicts:** 58% longer, against 68% observed.",
    "**The confound runs both ways:** always picking the best guess reads “shorter.”",
    "**The isolation run** (`scratch/verifier-c6/RESULTS.txt`), best-guess words:",
]),
table([3360, 3000, 3000], ["Condition", "Words", "Change"], [
    ["NULLH", "8.48", "—"],
    ["LEANONLY", "9.81", "+1.33, survives Holm"],
    ["EXONLY", "8.52", "+0.04"],
    ["K0", "9.92", "—"],
]),
gap(),
...ul([
    "**Static picks count as option picks.** The app logs opener, wrap-up and closing picks as source 'card' (`app.js:2346`, `2632`), and the lean counts them.",
]),
p("**Refuted parts.**"),
...ul([
    "“Shorter options are mostly the clarify option.”",
    "“The first reading of past conversations lengthened the best guess (8.58→9.92).” That compared unequal samples, and the isolation run supersedes it.",
    "“C8 showed no effect.”",
]),
p("**Caveat.** The test-data picks are authored."),

h2("C7. Voice Evidence Accumulates Slowly"),
p("**Claim tested.** Voice evidence accumulates slowly, and not in the field. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Mislabeled turns.** From b3219e6 (August 7, first released in 0.7.0) to 6579a46, the app saved typed and Express turns as `control`. `classifyTurn` returns the stored source (`voice-harvest.js:95`). Logs from before August 7 fall back to `unknown`, never `composed` (`:96-102`).",
    "**The fix shipped in 0.13.5** (ae5614c, October 6, 09:32).",
    "**Reading past conversations on leaving a review started in 0.13.3** (1cb7e80).",
    ["**Field data.**", [
        "The project’s real data folders all have `harvest: null`.",
        "One field report (v0.10.4): source counts card 20, control 10, composed 0 among 30 turns.",
    ]],
    "**The 0.74 a week figure** comes from the authored demo. The model’s range is 0.36–18 a week.",
    "**The plan describes Phase 2 as automatic.** The Sounds Like Me plan’s Table 4 lists its user effort as “None — self-populating.”",
]),
p("**Refuted parts.**"),
...ul([
    "“Fixed only in 0.13.6.”",
    "“Well under one a week in normal use” (inferred from authored data).",
    "“Not accumulated at all in the field” (checked only for the project’s own folders).",
]),

h2("C8. About Me Works Mainly on Content"),
p("**Claim tested.** About Me works mainly on content. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Fact options.** Marc 7 of 24 content turns and 1 of 40 neutral; Grace 8 of 24 and 3 of 40; C0 0 everywhere (`scratch/assess-aboutme/content.mjs`).",
    "**True reasons on neutral turns.** Hand-coded stance and reason changes: Grace about 10 of 40, Marc about 3–4 of 40 (inferred).",
    "**Register words.** Grace “thank you” 0→7. Marc “yeah” 2→4 and “yes” 4→2 as best-guess openers.",
    "**Fidelity.** Grace 3.63→4.56, which survives Holm. Marc 3.00→3.44, which fails (.080).",
    ["**Identification on neutral turns.**", [
        "Haiku all-four: 9/20→19/20, survives.",
        "Haiku single option: 8/20→16/20, fails Holm.",
        "Sonnet: not significant.",
    ]],
    "**Lengthening.** Best guess: Marc 9.81→10.50 and Grace 9.56→12.06. Options other than clarify: Marc 10.98→12.56 and Grace 11.50→15.21. Marc’s neutral best guess stays at 8.7.",
    "**Style distance on neutral turns improves** (Marc 2.42→2.11, Grace 1.35→0.73). Length drives the pooled rise.",
    "**The template held for Marc, not Grace.**",
    "**Code.** `llm.js:564` forbids invented specifics; Reframe can carry per-turn content (`llm.js:482`). How I Sound sits inside the About Me home (`worldview-ui.js:463-479`).",
]),
p("**Refuted parts.** “Leaves length unchanged”; “openers unchanged”; “the template held” for Grace; “style distance worsened,” which holds only pooled and within noise."),

h2("C9. Nothing Measures “Sounds Like Me”"),
p("**Claim tested.** Nothing measures “sounds like me.” **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**No direct measure exists.** The Sounds Like Me plan’s §8.1 names only the “does this sound like you?” mark as primary, and nobody has built it. The Practice A/B test and the How I Sound-against-live check are unbuilt too.",
    ["**What does exist.**", [
        "Reframe counts ship weekly (`app.js:3930`, `metrics.js`), with no trend analysis.",
        "Offer outcomes (`storage.js:2554`, `:2567`, since b1d0403) feed only the per-conversation flagged count in review (`review-model.js:179-187, 239`; `review-ui.js:1012`).",
        "`metrics.js:43-93` tallies the related events.",
    ]],
    "**The “from card” figure.** `usage-summary.js:38` defines `FROM_CARD = selectedIndex >= 0`. That counts picks after New N or Reframe, picks from static palettes (`app.js:2216-2346`) and repair-of-self picks (`app.js:2545`). The beta evaluator labels it “sufficiency” (`scripts/beta-eval/aggregate.mjs:207`, `render.mjs:67`). On test data, fromCard is 47 of 60 (78%) and the strict figure 36 of 60 (60%).",
]),
p("**Refuted parts.** “The instruments the plan calls primary”; “nothing totals them.”"),

h2("C10. Closeness Depends on the User"),
p("**Claim tested.** How close the app gets depends on the user. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**The default is closer to Grace** by length (9.8 and 9.6 words against references of 8.9 and 4.0), by style distance and by fidelity.",
    "**Identification is mixed.** Sonnet all-four: 27 of 32 Grace. Sonnet single option: 16 of 32. Haiku leaned Marc.",
    "**Marc’s gap does close with the full stack** (64–82%). His absolute gain C0→C4 (+1.06) roughly equals Grace’s (+1.12).",
    "**Marc stays far off on length and slang.** His options run 7.6–10.5 words against 4.0.",
    "**The How I Sound bank** expresses terseness (Marc’s picks average 3.85 words) but not slang.",
]),
p("**Refuted parts.** “Terse users stay far away” on fidelity; “the bank cannot express their register” for terse users; “longest candidate 14 words” (it’s 13)."),
p("**Evidence.** `app/js/sound-check-items.js:105-309`; `scratch/exp-dose/judge-raw.jsonl`, `rate-raw.jsonl`."),

h2("C11. Example Volume Isn’t the Bottleneck"),
p("**Claim tested.** Example volume isn’t the bottleneck. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**No detectable effect above a few examples.** The cells are underpowered, and Grace is at ceiling.",
    "**The real ladder** is 20→24→32→50 lines, because C2 already carries 20 How I Sound lines.",
    "**C5 against C4 is noise:** p=.37 for Marc, .49 for Grace.",
    "**Copies at 30 examples:** 5 of 64 options (against 0 of 128 at 12), and 3 of Marc’s 4 reuse “Wait, say that again?”",
    "**Example sentences are global with no partner** (`voice-harvest.js:109-126`; `voice.js:382-390`). Dismissal and redaction run after the cap (`voice.js:240-245, 382-384`).",
]),
p("**Refuted part.** The evaluation hasn’t shown that the effect “plateaus within a handful.”"),

h2("C12. Fine-Tuning Routes Are Closing"),
p("**Claim tested.** Fine-tuning through the user’s own key is closing. **Status.** Qualified."),
...ul([
    ["**Closed:**", [
        "OpenAI: since May 7 2026 for organizations that have never fine-tuned; new jobs end for everyone on January 6 2027.",
        "Gemini API and AI Studio.",
        "Anthropic API.",
        "Mistral (deprecated).",
        "Bedrock Claude 3 Haiku: Legacy March 10 2026, end of life September 10 2026.",
    ]],
    ["**Generally available:**", [
        "Microsoft Foundry: the gpt-4.1 family with SFT and DPO. It needs Entra/RBAC and charges hourly hosting.",
        "Vertex: Gemini 3.5 Flash, 3.1 Flash-Lite and the 2.5 family, SFT. It needs a GCP project and OAuth.",
    ]],
    "**Browser preflight.** Fireworks returns an allow-any-origin header (ACAO *). Together’s fine-tune endpoints refuse browser requests.",
    "**IMPersona dose:** 500 ≈ prompting (25.4% against 25.0%); 4K 35.1%; about 13K 42.1–44.4%.",
]),
p("**Refuted parts.** “Closing” understates OpenAI, which is already closed to new organizations; “Bedrock requires IAM” (the route is closed); “at the mainstream providers” ignores Azure and Vertex."),

h2("C13. Review Effort and Break-Even"),
p("**Claim tested.** Review effort and break-even. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Taps:** about 23 single-tap (the default, `storage.js:1791-1793`), about 40 two-tap (`app.js:882-900`).",
    "**Typing:** about 60 characters. The typed sentence uses `#composerInput`, which has prediction (`index.html:169`; `keyboard.js:41`). Only `#reviewWordInput` has `data-no-predict` (`review-ui.js:126`; `keyboard.js:305-309, 355-357`).",
    "**Time:** 5.7–8.5 minutes at 5 words a minute.",
    "**Displacement:** review example sentences drop out after about 6 later modest reviews of newer conversations.",
    "**Break-even:** about 4–22 avoided repairs.",
    "**Ten-conversation typing:** 691 characters is about 14 minutes at 10 words a minute, about 28 at 5 and about 69 at 2.",
]),
p("**Refuted parts.** “No word prediction”; “7–11 minutes”; “persists for every later turn”; “2–8% reduction”; “23–69 minutes of typing” (the low end used the wrong rate)."),

h2("C14. Review Examples Crowd Out Live Ones"),
p("**Claim tested.** Review example sentences crowd out live ones and work against terse users. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Review sentences come first.** They take the first min(R, 12) slots ahead of live ones (`voice-harvest.js:300-302`).",
    "**Ordering is by conversation date** (`storage.js:1125`). In K10 the 6 dropped answers came from the 3 oldest conversations.",
    "**Short typed answers vanish.** The app drops a typed review answer under 4 words and counts it nowhere, but the answer still withdraws the live turn (`voice-harvest.js:142-143, 248`).",
    "**This contradicts the documents.** The user-facing document says “the app keeps it anyway” (§14.7).",
]),
p("**Refuted parts.** “Run 3: with 12 review sentences no live one reaches” (that case is K10); “later reviews push out earlier ones” (the order is by conversation date)."),

h2("C15. Research Supports Contrastive, Situated Data"),
p("**Claim tested.** Contrastive, situated data is what the research supports. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Reading past conversations uses only the end of each episode.** The two “In my own words” replies are its two example sentences.",
    "**Picks after a steer feed only the lean.** Rejected sets, canceled text from “In my own words” (`app.js:4336`), generation-requested events (`app.js:601`) and the partner go unused (`voice-harvest.js:294`).",
    "**Review does store contrast.** It keeps `original` against `text` (`review-model.js:334-346`), `steer` and `reframers`. None reaches the reading of past conversations.",
    "**Episode count:** 6 in 17 authored conversations.",
    "**TICL:** up to 77%, with model-written explanations, archived real authors and an AI judge.",
    "**CIPHER:** 31% and 73%, with simulated GPT-4 users.",
]),
p("**Refuted parts.** “Review stores no contrast”; “the harvest uses none of it”; “both used simulated users”; “no AAC precedent for review” (Language Activity Monitoring and Better Conversations with Aphasia both exist; neither trains an AI)."),

h2("C16. Corrections Are Expensive to Produce"),
p("**Claim tested.** Corrections are expensive to produce. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Live options are all-or-nothing.** The only pre-filled “In my own words” path is the repeat-retry option (`app.js:2483-2491`).",
    "**Nobody has built edit-before-speak** (TODO.md “I, Robot” item 3).",
    "**Review rewording keeps both versions** (`review-model.js:335-345`). Reading past conversations uses the reworded sentence but not the difference (`voice-harvest.js:113-116, 200-206`).",
    "**Baumler:** g=0.55 toward own style; g=−1.43 still closer to the AI.",
]),
p("**Refuted parts.** “Cannot produce corrections”; the claim that composing is the only fix for an almost-right option; “at a fraction of the cost” (unmeasured)."),

h2("C17. Passive Signals Ignore the Partner"),
p("**Claim tested.** Nothing in the passive layer is per-partner. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**The voice block takes no partner.** `voice.buildBlock(idiom)` (`voice.js:298`; `app.js:4881-4885`).",
    "**Example sentences said to other partners appear unlabeled** while Marc talks to Mom (`scratch/exp-review/prompt-K10-H1.txt:161-174`).",
    ["**Per-partner channels:**", [
        "The per-person block, emitted only when the active partner has a `personId` (`app.js:4907-4916`). End conversation clears it (`app.js:4117`), and so does entering Practice (`:2857`), but the Start-conversation opener path doesn’t (`app.js:2305-2307`).",
        "The B6 per-category register (`worldview.js:897-898`).",
    ]],
    "**Review experiment:** Sofia got 12 of 18 template softeners; Devon got “wiped” in 18 of 18.",
]),
p("**Refuted parts.** “The only per-partner channel”; “cleared at the end of every conversation”; “never measured” (one B6 anecdote exists in CLAUDE.md)."),

h2("C18. About Me Versus a Terse Style"),
p("**Claim tested.** About Me moves a terse user away from his style. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**About Me lengthens options** while moving register toward Marc: informal markers 0.25→0.56, fidelity 3.00→3.44.",
    "**Volunteered facts on neutral turns** are rare: 4 of 80, all change-of-direction options, which allow topic expansion (`llm.js:603`).",
    "**Grace’s British-leaning words.** C1 has 2 “lovely” and 1 “proper” in 64 options, against 0 in 128 C0 options (p≈0.11). The other 8 forms appear where the How I Sound lines themselves lean British (`sound-check-items.js:141, 183`). This conflicts with `llm.js:217`.",
]),
p("**Refuted parts.** “Moves away from his style” overall; “suits me fine” as a British form."),

h2("C19. AI Judges Alone Can’t Measure Voice"),
p("**Claim tested.** AI-judge ratings aren’t a valid voice measure on their own. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Judge and style statistics agree on neutral turns.** They disagree only on content turns, where the short, content-neutral reference confounds both.",
    "**The evaluation told the judge to ignore content** (`scratch/exp-dose/rate.mjs:28`).",
    "**The general conclusion stands** on Sawant 2026 (arXiv 2608.19746) and on position bias.",
]),
p("**Refuted parts.** “Style statistics worsened” (within noise); “the judge rewards content”; the 30% and 61% review-experiment figures (the parser fault)."),
p("**See also N7:** for Marc, the fidelity score is largely length plus casual markers."),

h2("C20. About Me’s Typing Falls on Facts"),
p("**Claim tested.** About Me’s typing falls on facts. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Fields.** 74 fields; 38 typed, all facts except `b5_faith_tradition`, `b5_politics_lean` and `b7_understand`. The 9 wording fields are taps. Tier B has 35 fields, 32 of them taps.",
    "**Per-partner notes:** 1,043 characters, about 22% of typed text (`relationships.js:508`, `:536`).",
    "**Totals:** about 863 typed words, plus about 780 characters of openers, goals and the never-say list.",
    "**Wording content:** about 1,600 characters of About Me’s 3,252 aim at wording; the rest is stance.",
    "**The B1 note** tells the user these answers shape how the app words things, while `worldview.js:821-826` tells the AI attitude only.",
]),
p("**Refuted parts.** “About 97% facts”; “Tier B 36 items, 31 taps”; “B2/B7 ‘WORDING only’” (B6 only, line 898)."),

h2("C21. How I Sound Is Never Superseded"),
p("**Claim tested.** How I Sound endorses other people’s sentences, and nothing ever supersedes it. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**The bank.** 20 hand-written items; only 5 of 60 candidates carry even a mild informal marker.",
    "**Two competing labels.** “Single most important guide” (`voice.js:340`) against “best evidence you have” (`:387`).",
    "**The app sends every pick on every call** (`voice.js:335`), and nothing retires them.",
    "**The app drops the escape answers** (`voice.js:147`, `319-320`).",
    "**The app stores picks as text,** and the CR-191 map (`voice.js:78-89`) rewrites 11 candidates in 8 items.",
    "**C5 against C4 is noise.**",
]),
p("**Refuted part.** The claim that the app stores picks as indexes (true only of the persona sheets)."),
p("**See also N1** (the joke-permission bug) and **N6** (the length signal)."),

h2("C22. Passive Signals and the AI’s Picks"),
p("**Claim tested.** Passive signals can’t separate success from deference, and the AI sees its own past picks. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Acceptance signals move together** under success and deference.",
    "**Prior turns go to the AI as its own.** `generateResponses` sends every prior committed user turn in the current conversation with role `assistant` (`llm.js:652-655`). The lead-statement and repair calls also send history (`llm.js:797-799, 868-870, 901-903`).",
    "**History clears at the end of a conversation** (`app.js:3167`). Reading past conversations excludes option picks (`voice-harvest.js:12-20`).",
    "**No style measurement with history exists.**",
]),
p("**Refuted part.** Reading “every prior user turn” as crossing conversations."),
p("**Documentation error.** The Valencia 2023 citation in the Sounds Like Me plan (“felt the system had made the choice”) has no support in the paper. Its §5.4.2 is about other people attributing words to the device."),

h2("C23. Two Options per Category as Comparison"),
p("**Claim tested.** Two options per category would give a free style comparison. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**The mode is off by default** (`storage.js:1672-1673`), and its prompt asks for different content (`llm.js:487-489`).",
    "**Measured cost** (`scratch/verify-c23/percat.json`): output tokens +73%, cost +34%, wait 2.98→4.50 s, `maxTokens` 1000 against 700 (`llm.js:660`).",
    "**Only about 15 of 40 pairs held content constant;** the second option was longer in 24 of 40.",
]),
p("**Refuted part.** “At no extra API cost.”"),

h2("C24. AAC History as a Fast Source"),
p("**Claim tested.** Importing AAC history is the only fast data source. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**It’s the fastest pool of own sentences,** but not the only fast avenue.",
    "**Volume pays only with situation-matched retrieval.** Tomanek 2023: random 4-shot 22.0% against base 22.5%.",
    "**No importer exists.** The prompt side does: `voice.buildBlock` renders `samples`, and backups carry `voice.json`.",
]),
p("**Refuted part.** “The only avenue.”"),

h2("C25. Live Test Power and Forced Choice"),
p("**Claim tested.** A live A/B test can’t reach enough power, and a forced choice can. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Live A/B sample size.** 387 sets per arm two-sided, and 315 per arm gives 71% power. The 630-turn volume is authored and uncertain by about 4×.",
    "**Interleaved alternative:** about 194 paired picks.",
    "**Single tester:** 18 of 24 for two-sided p<.05. At a true 60%, power is about 19%.",
    "**Pooled 5×36:** 75% power if the testers are alike. With differences between testers, about 16% false positives and about 18% power across testers.",
    "**Review answers aren’t zero-cost ground truth.**",
]),
p("**Refuted parts.** “17 of 24” as the two-sided threshold; “zero-cost ground truth already on disk.”"),

h2("C26. The Framing and Inflated Endorsement"),
p("**Claim tested.** The framing is well-posed, and endorsement is inflated. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**The Sounds Like Me plan’s §5.3 says one thing and asks another.** It labels the question “authorization,” but the stem asks about resemblance (¶168; `sound-check-items.js:336-339`). It also calls it a preference (¶177) and still quotes the rejected “which would you rather say?” (¶179, ¶334).",
    "**Endorsement is weak and prone to ceiling effects.** Use a difference from a control plus a reference that isn’t self-report.",
    "**§8.1 is about something else.** Its “removes the signal” (¶353) concerns Cyrano friction.",
    ["**Citation corrections.**", [
        "The 92% figure is Hall et al. 2013 (PLoS ONE 8:e60554), not 2012.",
        "Lind 2014: about one third detected.",
        "Draxler TOCHI 2024: a gap between felt ownership and declared authorship.",
    ]],
]),

h2("C27. No Clean “True Voice”"),
p("**Claim tested.** There’s no clean “true voice.” **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Kane 2017:** 7 people with ALS; terseness from effort.",
    "**Weinberg:** a neuro-motor condition since his teens, not CP. The paper credits the “well-behaved” model mainly to curation.",
    "**The plan’s caution doesn’t reach the prompt.** Its Table 5 says composed length “may reflect effort.” `voice.js:387-389` carries no such caveat, and one exists only for Express labels (`voice.js:406`).",
    "**The tension is inside the plan itself** (§3 against §5.3).",
]),
p("**Refuted parts.** “Years of AAC use make output terse”; the Weinberg causal attribution."),

h2("C28. An Honest System-Level Form"),
p("**Claim tested.** An honest system-level form exists. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**The user chooses every substantive utterance.** Placeholders are the exception: the app speaks them automatically in the user’s own voice (`placeholders.js:211-223, 290`), from defaults the app wrote (`placeholder-phrases.js:41-69`).",
    "**Only an instruction enforces the catchphrase rule** (`voice.js:383`, idiom section).",
    "**The Express Panel ships with no user-written items** (`express-items.js:173-211`).",
    "**The transactional studies never varied personal wording.**",
]),
p("**Unverifiable.** Fan, Liu & Pan CHI 2026 (not located); Todman et al. 2008 (not checked)."),
p("**Refuted part.** “The user authorizes every spoken word.”"),

h2("C29. User-Facing Claims Lack Support"),
p("**Claim tested.** User-facing claims lack support. **Status.** Qualified."),
p("**Corrected.**"),
...ul([
    "**Over-claims.** Product Overview ¶47 and ¶103.",
    "**Stale under-claims.** ¶125 and ¶206 (`voice-harvest.js:191-261`; `review-ui.js:179-186`).",
    "**Beta Test Plan ¶60** never mentions How I Sound or Review.",
    "**Hedged.** `settings-help.js:19` (“helps”).",
    ["**Further unsupported claims:**", [
        "`index.html:946`",
        "`worldview-ui.js:520-521`",
        "`app/data/worldview-questions.json:850`",
        "Windows manual glossary ¶642",
    ]],
]),
p("**Refuted parts.** Citing ¶125 as an over-claim; “nothing supports” (mechanisms exist)."),

h2("Findings from Later Checks"),
p("These came from the critic’s review and the gap investigations."),
p("**N1. A plain How I Sound pick grants joke permission.** Confirmed."),
...ul([
    "`levity-dontknow` offers three candidates, with `leads:'flat'` (`sound-check-items.js:280-287`).",
    "`isLighterChoice` returns `i !== 0` (`:317-323`), so the terse index-1 answer “No idea, sorry.” counts as lighter.",
    "`voice.js:332-334` moves it into the levity list. `voice.js:362` then says one light response is welcome unless the user declined humor.",
    "3 of 10 personas pick index 1 (`scripts/doc-generators/persona-data.js` lines 249, 320, 659). Marc picks 2, so the dose experiment never exercised it.",
]),
p("**N2. The never-say list leak, corrected count.** Confirmed."),
...ul([
    "10 of 72 options on turn H8-stranger-inspiration contain “inspiration” (`scratch/exp-review/gen.json`). The earlier “10 of 21” used the wrong denominator.",
    "All 10 quote or reject the partner’s own word. One change-of-direction option jokes on a disability-labeling turn.",
    "The rule reads “Respect this without exception” (`prompt-K0-H1.txt:171`).",
]),
p("**N3. The dose experiment never sent the Express idiom section.** Confirmed."),
...ul([
    "`scratch/exp-dose/build.mjs:86` and `gen2.mjs:26` call `voice.buildBlock([])`.",
    "The app passes user-written Express phrases (`app.js:4881-4885`).",
    "The missing section includes the instruction not to read short labels as a brevity preference (`voice.js:403-407`).",
    "Catchphrase redaction was also inactive in the experiment.",
]),
p("**N4. An option’s short label isn’t a speakable reply.** Confirmed."),
...ul([
    "The best-guess label averages 1.5–2.6 words per condition (`scratch/exp-dose/gen-raw.jsonl`).",
    "In “short version only” mode the label shows while the device speaks the full text (CLAUDE.md, Response Option Display).",
]),
p("**N5. Practice conversations feed the reading of past conversations unfiltered.** Confirmed."),
...ul([
    "`storage.listConversationLogs` (`storage.js:1100-1128`) has no practice filter.",
    "`voice-refresh.js:35-36` passes every log through.",
    "`harvest()` and `reviewedTurns()` never call `isPractice()` (`review-model.js:34-47`); its only use is `review-ui.js:156`.",
    "Practice turns carry the same `source` values (`app.js:2632`, `4163`, `5791`).",
    "Steers from practice pass `app.js:3982`.",
    "Projection on test data (`scratch/practice-harvest/`): running the shipped coffee scenario 3 times removes the fuller-lean sentence; 10 times reverses it.",
    "**Documentation mismatch:** Conversation Review ¶180-181 promises an “is that true about you?” question. No code implements it (manual ¶449 says “later versions”).",
]),
p("**N6. How I Sound is a cleaner length signal, used only implicitly.** Confirmed."),
...ul([
    "**No numeric use.** No code computes a length lean from How I Sound (a search of `voice.js`, `voice-harvest.js`, `app.js`); `voice.js:340` only says “Match the length.”",
    ["**Marc’s two readings disagree.**", [
        "Run through `measureLengthLean`, Marc’s How I Sound answers read `shorter` in 14 of 16 decided items.",
        "His live lean reads `longer` in 27 of 41 (`scratch/soundcheck-length/RESULTS.txt`).",
    ]],
    "**Only the 4 economy items isolate length.** In 13 of 16 other items, the marked end of the dimension is also the longest candidate. The 20-item composite disagrees with the persona’s stated brevity for Diego, Hannah and Noah, and is unclear for Sofia.",
    ["**The economy items have small problems of their own.**", [
        "The median rule can’t record one direction in 4 items.",
        "`economy-weekend` adds “quiet” to two candidates, against the bank’s own stipulation rule (`sound-check-items.js:47-48, 108`).",
    ]],
    "**Stale header.** `sound-check-items.js:4` and `:9-17` say “Twelve items… every item is RESPONSIVE”; the bank has 20 items, including initiating ones.",
]),
p("**N7. Fidelity-score validity.** Confirmed by reanalysis (`scratch/dose-validity/`)."),
...ul([
    "**The judge is consistent.** Identical texts got the same score in 54 of 56 pairs (Marc) and 26 of 28 (Grace).",
    "**For Marc, the setup overlaps length and casual words.** With turn fixed effects, word count and a shared-marker indicator share 84% of what the setup explains, and the setup after covariates isn’t significant (p=.125).",
    "**For Grace, setup effects survive** (p=.011).",
    ["**The same model prior shaped the reference lines.**", [
        "The anchors’ lengths make “gap closed” mostly a length scale. The top of Marc’s scale is his own lines, at 5.2 words; the bottom is Grace’s lines, at 10.9.",
        "C0, with no persona, produced a sentence that matches a reference line.",
    ]],
]),
p("**N8. Holm correction.** See the table at the top of this appendix."),
p("**N9. Conversation Review’s non-voice purposes.** Confirmed (`scratch/review-purpose/`)."),
...ul([
    "**Reliving the record: built.** `review-ui.js:274-322`.",
    "**Coaching debrief: not built.** `endPractice()` at `app.js:2898-2900` only ends the conversation. TODO.md:953-972 has it blocked on the playback screen.",
    "**Clinician scenario writing: built on the device** (09c7ccc). Nobody has built the handoff to a client and back; backup import replaces files wholesale (`data-transfer.js:402-420`).",
    ["**Not built:**", [
        "phrase-to-button",
        "fact-to-About Me",
        "the timing complaint becoming a setting",
        "the misheard report",
        "the beta counts (Conversation Review ¶233; TODO.md:561-562)",
    ]],
    "**The project’s reason.** ¶209 and TODO.md:513-518 record voice as the reason to keep review.",
]),
p("**N10. Citation audit.** Mixed (`scratch/audit-cites/`)."),
...ul([
    "**Wang et al. 2025:** supported per domain. Going from 2 to 10 examples changed blog AV 19.3→19.6 and Reddit 66.9→69.8. The models were GPT-4o, Gemini-2.0-Flash and Llama-4-Maverick, with samples of about 320–330 words.",
    ["**IMPersona (arXiv 2504.04332, preprint, April 2025):**", [
        "prompted models were Claude-3.5-Sonnet-1022, GPT-4o-2024-08-06 and o1-2024-12-17",
        "the fine-tuned model was Llama-3.1-8B",
        "70.5% is the real person’s pass rate",
        "this doesn’t establish a ceiling for 2026 models",
    ]],
    ["“Openers and fillers are among the strongest markers of an individual speaker”: **unsupported as worded.**", [
        "Doddington 2001 (Eurospeech, Switchboard) supports a weaker claim: turn-initial tokens and set phrases carry speaker information, and “you know” carries little.",
        "McDougall & Duckworth 2018 and Braun et al. 2023 support disfluency profiles as speaker-specific.",
        "No source says “strongest.”",
    ]],
    ["**Schwartz, Tsur, Rappoport & Koppel, EMNLP 2013: the draft misread it** (`scratch/lit/schwartz2013.txt:86-95, 197`).", [
        "With 50 authors, 50 training tweets gave 50.7% and 1,000 tweets gave 71.2%, against 2% chance; tweets average 14.2 words.",
        "The paper concludes that single tweets can go to their author “with good accuracy.”",
    ]],
    "**Left out of the main sections as unverified:** PROSE 2025; Jain et al. CHI 2026; Qin et al. CHI 2026; Valencia’s “most common complaint” framing; “a pasted biography produced invented facts”; Jemama & Kumar’s specific percentages; the “400+ authors” figure for Wang.",
]),
p("**N11. No record of who entered an answer.** Confirmed. A search of `worldview.js`, `voice.js`, `relationships.js`, `places.js` and `partner-profile.js` finds no field for who entered an answer. The only “provenance” is Express item origin (`voice.js:281`). The code states the partner note as authoritative (`relationships.js:536`)."),
p("**N12. No randomness setting; a thinking setting is in use.** Confirmed. A search of `app/js` finds no `temperature`. `suggest-anthropic.js:43` sets `thinking: { type: 'between_tools' }` for claude-sonnet-5-5. No voice test has varied either."),
p("**N13. Edited command phrases and placeholders count as the app’s words.** Confirmed."),
...ul([
    "`voice-refresh.js:37-44` passes all control and placeholder phrases as “OUR words” to classify unlabeled turns.",
    "The app saves current command turns with source `control`, which never becomes an example sentence.",
    "Placeholders aren’t user turns.",
    "The user’s edits to either therefore never count as voice evidence.",
]),
p("**N14. The app doesn’t group steers with the same meaning.** Confirmed. Marc’s `test-data-folder/voice.json` has “shorter” (09-15) and “keep it to five words” (10-01). `repeatedSteers()` returns `[]` (`voice.js:189-224`)."),

h2("Refuted Claims, Kept Here Only"),
p("Section numbers in this list refer to the evaluation’s draft, not to this document."),
...ul([
    "“One typed Reframe instruction moved a terse persona further than anything else tested” (draft §1 and §5).",
    "The draft said removing How I Sound scored higher for both personas, suggesting the bland lines hold back the user’s real sentences (draft §6). The difference is noise (p=.37, .49), and length explains about half or more of it.",
    "“One 14-word message identifies its author among 50 candidates only about half the time, even with plenty of training data” (draft §9).",
    "“Research finds openers and fillers among the strongest markers of an individual speaker” (draft §9).",
    "The refutation of Wang’s “2 to 10 samples changed results very little.” That refutation was itself wrong; the finding holds per domain.",
    "“Leaving the first review switches on a length instruction that pushes a terse user’s options longer,” as a general rule. It can, depending on the user’s mix of picks.",
    "“A narrower goal is achievable,” as a demonstrated result. It’s plausible and measurable.",
    "All refuted sub-parts listed under C1–C29.",
]),

h2("Observations Not Separately Verified"),
p("The main sections don’t use these."),
...ul([
    "The cached prefix measures about 10,700–16,400 tokens, against “~3,400” in code comments (`llm.js:362, 512`) and about 3,570 in CLAUDE.md.",
    "Literal user-written or user-picked text is about 1,019 characters (2.3%) of Marc’s prompt. This is consistent with the verified segment sizes.",
    "Each reading of past conversations that changes the voice block rewrites the cached prefix at 1.25× the input price (inferred from CLAUDE.md’s caching notes; not measured here).",
]),

h2("Scratch Files Used"),
...ul([
    "`scratch/exp-dose/`: gen-raw, judge-raw, rate-raw, deep-out, analyze-out, blocks, build.mjs, corpus.mjs",
    "`scratch/exp-review/`: original runs, plus spec.mjs, conditions.json, gen.json",
    "`scratch/verify-c4/`: rejudge.json, ablate.json, ci.mjs (corrected review scoring)",
    "`scratch/verifier-c6/RESULTS.txt`: length-sentence isolation",
    "`scratch/verify-c23/percat.json`: two-per-category cost",
    "`scratch/verify-c5/netout.mjs`: closer-mark cancellation",
    "`scratch/prompt-assembly/`: prompt sizes",
    "`scratch/dose-validity/`: fidelity validity reanalysis and Holm correction",
    "`scratch/soundcheck-length/`: How I Sound length analysis",
    "`scratch/practice-harvest/`: practice contamination",
    "`scratch/review-purpose/`: non-voice purposes of review",
    "`scratch/audit-cites/`: citation audit",
]),
];

const bulletLevels = [0, 1, 2].map(level => ({
    level, format: LevelFormat.BULLET, text: level === 1 ? "–" : "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 + 360 * level, hanging: 360 } } }
}));

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
            { reference: "bullets", levels: bulletLevels },
            { reference: "verdict",
                levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                    { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: 15840 },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Sounds Like Me Evaluation", italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  October 2026  |  For internal use  |  Page ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},
        children
    }]
});

// Override with OUT_DOCX=... when the real file is open in Word (EBUSY).
const OUT = process.env.OUT_DOCX || docPath("Conversant AAC Sounds Like Me Evaluation.docx");
Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(OUT, buf);
    console.log("Wrote " + OUT + " (" + buf.length + " bytes)");
}).catch(err => { console.error(err); process.exit(1); });
