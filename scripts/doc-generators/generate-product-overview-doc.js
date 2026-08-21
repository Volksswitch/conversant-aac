// Conversant AAC — Product Overview generator.
// Styled to match the other design docs (Arial, blue headings, centered footer
// with "Page m of n"). American English spelling throughout.
//
// ⚠ THIS FILE WENT STALE ONCE AND SILENTLY BECAME A REVERT BUTTON. Between June
// and August 2026 every change to the Product Overview was made in the .docx
// itself (python-docx, which is how the "sync docs" pass edits documents), and
// nobody folded them back. By August 17 running this script would have wiped the
// "Not a Smart Speaker" section, the iPad modes table, the corrected silence-period
// numbers and the Access Methods section — with no error and no warning, because a
// generator that overwrites its own output cannot tell the difference between "you
// asked for a rebuild" and "you just destroyed four months of edits". The body
// below was rebuilt FROM the document on August 17 2026 and verified to reproduce
// it exactly (223 paragraphs and table rows, zero differences).
//
// TWO RULES FOLLOW, and the second is the one that saves you:
//   1. This file is the source of truth. Prefer editing it. If a sync pass edits
//      the .docx directly — sometimes the quicker move for a one-line change —
//      fold the change back into this file in the SAME pass.
//   2. NEVER run this script straight over the document to "check" it. Generate to
//      a scratch file first and diff the two, then overwrite only if the only
//      differences are the ones you intended:
//
//        OUTPATH=/tmp/regen.docx node -e "const fs=require('fs');const o=fs.writeFileSync.bind(fs);//          fs.writeFileSync=(p,b)=>o(process.env.OUTPATH,b);require('./generate-product-overview-doc.js')"
//
// (The same hazard applies to every generator here whose document has ever been
// hand-edited. This one is merely the one that was caught.)
'use strict';
const { docPath } = require('./doc-paths');   // resolves figures + output, whatever the CWD
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, BorderStyle, WidthType,
        HeadingLevel, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN  = 1440;

// ── helpers ──────────────────────────────────────────────────────────────────

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, keepLines: true,
                           children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, keepLines: true,
                           children: [new TextRun(text)] });
}
function heading3(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, keepLines: true,
                           children: [new TextRun(text)] });
}
function para(text, after = 160) {
    return new Paragraph({
        spacing: { before: 0, after },
        children: [new TextRun(text)]
    });
}
function bullet(text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { before: 0, after: 80 },
        children: [new TextRun(text)]
    });
}
function emptyPara() { return new Paragraph({ children: [] }); }

// Three equal columns, hairline gray rules, no shading and no bold — matching
// the iPad-modes table as it was added to the document by hand.
const TBL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
function simpleTable(rows) {
    const b = TBL_BORDER;
    return new Table({
        borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
        rows: rows.map(r => new TableRow({
            children: r.map(cell => new TableCell({
                width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun(cell)] })]
            }))
        }))
    });
}

// ── document ─────────────────────────────────────────────────────────────────

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 24 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
                run:       { size: 32, bold: true, font: "Arial", color: "2E74B5" },
                paragraph: { spacing: { before: 480, after: 200 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
                run:       { size: 26, bold: true, font: "Arial", color: "2E74B5" },
                paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
            { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
                run:       { size: 24, bold: true, font: "Arial", color: "4F81BD" },
                paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
        ]
    },
    numbering: {
        config: [
            { reference: "bullets",
                levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        ]
    },
    sections: [{
        properties: {
            page: {
                size:   { width: PAGE_W, height: 15840 },
                margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
            }
        },
        headers: { default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Conversant AAC — Product Overview",
                italics: true, color: "808080", size: 18, font: "Arial" })]
        })]})},
        footers: { default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: "Volksswitch.org  |  June 2026  |  For internal use  |  Page ",
                    size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "808080" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "808080" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "808080" })
            ]
        })]})},

        children: [

            // ── Cover ─────────────────────────────────────────────────────────
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 240, after: 40 },
                children: [new TextRun({ text: "Conversant AAC", bold: true,
                    color: "1F3864", size: 52, font: "Arial" })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 160 },
                children: [new TextRun({ text: "From Communication to Conversation",
                    color: "1F3864", size: 32, font: "Arial" })]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 280 },
                children: [new TextRun({ text: "Kenneth R. Hackbarth | Volksswitch.org | June 2026",
                    color: "555555", size: 20, font: "Arial" })]
            }),

            heading1("The Gap"),
            para("For decades, AAC devices have given non-speaking individuals a way to express needs, make choices, and share information. That is real progress. But there is a gap that rarely gets named directly:"),
            para("AAC devices support communication. Very few support conversation."),
            para("These are not the same things."),
            para("Communication is the transfer of meaning from one person to another. A stop sign communicates. A fire alarm communicates. An AAC user selecting “I need help” communicates. The message goes out; the purpose is served."),
            para("Conversation is something different. It is a joint activity — two or more people co-constructing meaning together, turn by turn, in real time. It is interactive, reciprocal, and time-sensitive. In conversation, each contribution responds to what came before and shapes what comes next."),
            para("All conversation is communication. But not all communication is conversation."),
            para("Most AAC systems are designed for communication. It’s in the name! The result is that the people who use them are largely excluded from conversation — and from everything conversation makes possible. Real-world conversation happens with strangers, colleagues, and acquaintances — people who are not trained to be patient and are not prepared to wait."),
            heading1("What AAC Users Actually Lose"),
            para("The challenge of AAC participation is often framed in terms of words per minute — as though it were a speed problem. That framing misses the point entirely."),
            para("When an AAC user cannot participate fluidly in conversation, they lose far more than the ability to communicate quickly. They lose access to the primary human mechanism for building identity, relationships, agency, humor, and belonging."),
            para("Here is what the research shows non-conversational AAC users actually lose:"),
            heading2("Timing"),
            para("Conversation is deeply time-sensitive. Meaning is not carried only by words — it is carried by when something is said. A person who speaks can say “Wait — that’s not what I meant” at the exact moment a misunderstanding begins. An AAC user may need many seconds to produce the same correction. By that time, the moment has passed."),
            para("This affects jokes, corrections, emotional responses, quick questions, agreements, disagreements — any contribution that has to land at a specific moment to have its intended force. In conversation, late is often not merely late. Late can mean socially invisible."),
            heading2("Turn-Taking Power"),
            para("Conversation depends on turn-taking — claiming the floor, holding it, yielding it, and redirecting it. AAC users are often forced into a passive structure: the partner asks, the AAC user answers. The partner guesses; the AAC user confirms or rejects. This turns conversation into interrogation."),
            para("The AAC user loses the ability to initiate, to interrupt appropriately, to redirect a topic, and to participate in a rapid back-and-forth exchange. Others control the structure of the interaction. The AAC user becomes a respondent rather than a co-participant."),
            heading2("Spontaneity"),
            para("Much of conversation consists of small, unplanned, opportunistic contributions: “That reminds me…” “Actually…” “Me too.” “That’s hilarious.” “I had the same problem.” These are not major messages. They are the small things that make conversations feel alive."),
            para("Many AAC systems require deliberate message construction. That means the user may eventually be able to say something important, but cannot easily say the small things. They lose the ability to be casually present."),
            heading2("Humor"),
            para("Humor depends on timing, surprise, shared background, and risk. An AAC user may be able to select “That’s funny” — but that is not the same as being able to make the joke. Humor is not ornamental. It is a major way people display intelligence, build intimacy, resist pity, and claim social equality. When a person cannot joke easily, others may treat them more solemnly, clinically, or childishly."),
            heading2("Identity"),
            para("People are known through conversation. We become “the funny one,” “the thoughtful one,” “the skeptical one,” “the one who asks great questions.” When AAC only supports minimal functional communication, the person may instead be known mainly through needs: what they want, what they refuse, what hurts, what they can answer."),
            para("That distorts identity. The person’s expressed self becomes smaller than the person’s actual self."),
            heading1("The Summary"),
            para("When AAC supports communication but not conversation, users may lose: timing, agency, the ability to be known as complex and adult, the small exchanges that create friendship, the ability to explain and process emotions, the ability to intervene quickly in care decisions, access to private and confidential exchange, and the chance to develop thoughts with others rather than delivering finished messages."),
            para("As one research synthesis puts it: the loss is not simply linguistic. It is dignity."),
            heading1("The Root Cause — The Four-Second Problem"),
            para("Understanding why conversation has been out of reach for AAC users requires looking past the obvious answer."),
            para("The obvious answer is speed. AAC users with significant motor limitations typically communicate at 10 to 20 words per minute. Comfortable conversation requires at least 80 words per minute. The gap is real."),
            para("But speed alone is not the deepest barrier. The deepest barrier is the human aversion to awkward silence."),
            para("Research shows that people become uncomfortable after as little as one to four seconds of silence in conversation. Repeated multi-second delays cause communication partners to interrupt, finish sentences for the AAC user, or disengage entirely."),
            para("The result is that even a capable, articulate AAC user — one who has things to say and the device to say them — cannot hold a conversation partner’s attention long enough to be heard. They are confined to transactional exchanges: expressing needs and wants. The richer, interactional communication — the jokes, the debates, the small talk, the friendship-building — remains out of reach."),
            para("This is not a matter of the AAC user’s capability. It is a technology gap."),
            heading1("The Solution — AI-Generated Response Options"),
            para("Generative AI makes it possible to close that gap."),
            para("Within seconds of a communication partner finishing a sentence or a thought, an AI system can generate several contextually appropriate, naturally worded response options for the AAC user to choose from. The user selects one with a single tap. The device speaks it immediately. The conversation continues at or near natural speed."),
            para("The silence that used to strand the AAC user — and drive potential partners away — is filled. Not with a generic placeholder, but with an actual response, selected by the user."),
            para("When the speech recognition reports that the partner has stopped talking, the system waits a brief, adjustable moment — half a second by default, and anywhere from none at all up to three seconds — and then asks the AI for response options. Those options take a few seconds to come back. What keeps the silence from stretching in the meantime is a short spoken placeholder: two seconds after the pause, by default, the device says something like “I’m thinking about that.” That is what holds the gap inside the one-to-four-second window research identifies as the point where communication partners begin to disengage. The user controls both timings, and how many placeholders a single turn may use — including none."),
            para("This is the core idea. Everything else is refinement."),
            heading1("Speaking As the User, Not For the User"),
            para("A critical distinction: the goal is not to speak for the AAC user. It is to speak as the AAC user."),
            para("The AI does not generate generic responses that any person might give. It generates responses shaped by this specific person’s personality, opinions, relationships, and conversational goals. Over time, as the system learns who the user is, the responses sound more and more like them."),
            para("The user retains final control over every word spoken. They select; the device speaks. Nothing is said without their intervention."),
            heading2("Not a Smart Speaker"),
            para("One consequence of speaking as the user is worth stating plainly, because it was a deliberate decision rather than a shortcoming: the app will not answer general-knowledge questions on the user’s behalf. If a communication partner asks what year something happened, what a technical term means, how something works, or what a calculation works out to, the app does not look the answer up in the AI’s own knowledge and offer it in the user’s voice. It offers what a person offers instead — saying they do not know, turning the question back, or giving what they actually have."),
            para("The reasoning is straightforward. The AI behind the app knows an enormous amount; the user is one person. An app that hands over everything the AI knows stops the user being a participant in the conversation and turns them into something the people around them can look things up in — with words appearing in their mouth that they may never have known. There is a second point that settles it: if the answer were common knowledge, the partner would already have it and would not be asking. The question being asked is itself a sign that the fact is not shared ground, which is precisely when supplying it misrepresents who the user is."),
            para("None of this stops the user saying something they do know. Typing it into In Your Own Words and tapping Reframe supplies the fact directly, and the app shapes its suggestions around it. What the user types is always treated as true. The difference is who put the fact there."),
            para("The system takes the user at their word about what they know. The “About Me” questionnaire asks what subjects they know a lot about, and anything listed there is answered properly and in depth during a conversation — a user who says they know quantum mechanics will be offered detailed quantum mechanics responses. That list is the user’s own claim about themselves, and the system neither second-guesses it nor quietly stretches it: it covers the subjects named, and not neighboring ones."),
            heading1("The User’s Communication Partner Needs Nothing"),
            para("The communication partner requires no device, no app, no training, and no special knowledge of or relationship with the user. From their perspective, they are simply having a conversation with someone who uses a device to communicate. The technology is entirely on the AAC user’s side."),
            heading1("How It Works"),
            para("The core conversation loop has five steps."),
            para("1. The communication partner speaks. The system listens continuously — not in discrete chunks, but as a flowing stream. Each time the partner pauses, the system sends what has been said so far for processing. If the partner continues speaking after a pause, the response options update to reflect the fuller utterance. Recording stops when the user makes a selection."),
            para("2. A text transcript of what the partner said appears on screen, so the user can always see what was heard. By default the transcript does not have to be confirmed before options are generated — generation begins as soon as the partner pauses, to keep the user’s response time short. If a capture is garbled, the Ask them to repeat control discards it and asks the partner to repeat. (An optional require-confirmation-first mode — generating only after the user confirms the transcript — is planned for users who prefer it; it is not part of the current build.)"),
            para("3. A brief, natural placeholder phrase is spoken automatically while the user reads and chooses among the options — “I’m thinking about that.” The wording is deliberately neutral, and that is a decision rather than a limitation: the placeholder is spoken before the app knows what kind of turn the partner took, so it must never presume. Nothing like “Good question,” which would be wrong every time no question had been asked. A placeholder follows any completed partner turn, with one exception — when the partner is asking the user to repeat themselves, the app goes straight to helping them do that. The placeholder holds the conversational floor during the choosing window, keeping silence within the one-to-four-second threshold that research shows makes communication partners uncomfortable. If the user picks quickly, no placeholder is needed and none is spoken. Every placeholder is displayed on screen as it plays — the system never speaks on the user’s behalf invisibly."),
            para("4. The AI generates response options in four structurally distinct categories, each shown in a fixed screen position (by default a two-by-two grid):"),
            bullet("Preferred (upper-left) — the most natural, affiliative answer to what was said"),
            bullet("Dispreferred (upper-right) — a graceful way to decline, hedge, or push back, with a brief account rather than a blunt refusal"),
            bullet("Initiative (lower-left) — a new direction the user wants to take: a follow-up question, a counter-offer, a related topic"),
            bullet("Repair (lower-right) — for moments when something needs clarification: “Wait — where?” or “Did you mean next Friday?”"),
            para("Each option appears as a large, tappable card showing the full text that will be spoken aloud — large and easy to read, and color-coded by category. The four positions never change. The user can also choose, in Settings, to receive two options in each category — eight cards instead of four, in the same screen footprint. With a little practice, users learn where each kind of option appears, though reading the card before selecting is still encouraged. A response card is chosen with a single tap. When the partner offers a menu of choices — “mild, moderate, or severe?”, or “we've got muffins, croissants, or a few different pastries” — the cards adapt: instead of four general-purpose responses, they show the actual choices the partner named, so answering is a single tap rather than typing to catch up."),
            para("5. The user selects a response with a single tap. The device speaks the selected response aloud. The conversation continues."),
            para("An optional auto-resume setting restarts listening automatically after each exchange, so the user never has to tap Start Listening between turns."),
            heading1("A Conversation Engine Built on How Talk Actually Works"),
            para("The system is grounded in Conversation Analysis, the empirical study of how real conversation is structured. This means it understands more than turn-taking."),
            para("Conversations have structure. A question creates an obligation for an answer. An invitation creates an obligation for acceptance or decline. A complaint expects acknowledgment. The conversation engine is designed to track these open obligations as a running stack, so it always knows what type of response the current moment calls for. This is a joint effort between AI and application: the AI classifies each conversational response; the application maintains the state. When a repair sequence opens — something needed clarification — the original obligation is restored automatically when the repair resolves."),
            para("The system operates in five distinct modes: Listening, Responding, Repair-of-Self, Initiating, and Pre-Closing/Closing. It infers which mode applies from the partner’s behavior and provides persistent override controls — Repeat what I said, Hold on, Ask them to repeat, and Wind down — always on screen, in the same position, in every mode. The user can redirect the engine at any moment without searching the screen. Wind down first offers ways to signal you're ready to end the conversation without yet saying goodbye, and once you say one, the actual goodbyes appear automatically, so signing off never requires typing anything."),
            para("One of the highest-value capabilities is Repair-of-Self: when the partner signals they did not hear or understand — “What?” or “Sorry, say that again” — the system generates options to re-speak, rephrase, or expand what was said on the user’s behalf. This is the kind of conversational recovery that spoken users perform automatically, and that AAC users have historically had no efficient path to."),
            para("The AI generates response options that represent the four structurally distinct kinds of conversational response described above, always in the same screen positions. The result is a system that does not merely suggest words — it suggests the right kind of conversational response for this specific moment in this specific exchange."),
            heading1("What Makes This Different"),
            heading2("AI-Driven, Not Merely AI-Enabled"),
            para("Many AAC systems include AI-enabled features — word prediction, symbol suggestions, pattern-based communication modeling. These are valuable additions to an AAC device. This system is different: generative AI is not a feature added on top. Generative AI — the kind that creates language from scratch in response to a prompt — is the system. Every response option the user sees was created in real time, shaped by this specific conversation and this specific person’s profile. That is what “AI-driven” means."),
            heading2("Designed for Conversation, Not Just Communication"),
            para("This system was built from the ground up around the goal of real-time conversational participation. The conversation loop, the response option design, the floor-holding placeholders (see Glossary), the timing — every decision was made in service of keeping a real conversation going."),
            heading2("Nothing on the Screen Moves"),
            para("A guiding principle of the design is spatial stability: once the screen is laid out, nothing moves. The response palette keeps its four fixed positions; the persistent controls stay put; and the Express Panel is laid out on the very same grid as the on-screen keyboard, so the keyboard appears in exactly the same place when the user composes. Two benefits follow. First, the user builds motor planning — reaching for a familiar location rather than hunting for a control. Second, because positions never shift, a single physical keyguard (an overlay with holes over the touch targets, which many users with motor differences rely on) lines up across the conversation screen, the Express Panel, and the keyboard alike."),
            heading2("The System Learns Who You Are"),
            para("The system maintains a structured model of the user’s personality, interests, opinions, relationships, and communication goals. This is called the worldview model. Over time, as the model fills in, responses sound more like the user — their sense of humor, their way of expressing disagreement, their vocabulary, their characteristic concerns."),
            heading3("The “About Me” Questionnaire"),
            para("A self-paced questionnaire lets the user build their profile one question at a time: who they are, where they live, what they care about, how they like to express themselves, and what they want others to know. Questions are organized into modules that can be answered in any order, in any sitting, at any pace. No question is required. The system is fully functional with a completely empty profile, and the questionnaire fills itself over time — each time it generates responses, the AI also reports which facts about the user it needed and did not have. Those are logged, and the ones that have come up most often appear at the top of the About Me screen under “Questions worth answering,” each noting how many times it came up. Answering one there takes the user straight to that question. One question carries more weight than the others: what subjects the user knows a lot about. That answer is what lets the app give real, detailed replies on those subjects instead of declining them."),
            heading3("People and Relationships"),
            para("The system maintains a private, on-device record of the people in the user’s life — family, friends, caregivers, colleagues, and others — each with a name, a nickname or term of address, a relationship type, and a description. When a response refers to a person, the system uses the nickname the user actually uses for them (“Mom,” not “Mary”). Any person can be marked private: the AI still knows them for context but never brings them up on its own — it offers them only if the other person asks, or if the user asks for them in “In your own words.” The AI draws on this model to generate more contextually appropriate responses when the user is speaking about or with specific people."),
            heading3("My Places"),
            para("The system also keeps a private, on-device record of the places the user goes — school, the pool, a favorite shop, a relative’s house — each with a name and as many named facts as the user cares to record. There is deliberately no fixed set of fields: what is worth knowing about a coffee shop, a clinic and a cousin’s house have almost nothing in common, so the user decides what matters for each place. During a conversation the user taps a place to say “I’m here right now,” and the AI shapes its suggestions around that setting and what it knows about it. A place can be marked private on the same terms as a person. This is situational awareness the user supplies directly — it needs no location hardware, no permissions, and works indoors, where location sensing is least reliable."),
            heading3("Conversation Goals"),
            para("People have goals in every conversation, consciously or not. The system organizes them in three layers by scope — which is also, in effect, by time horizon: a general disposition (how the user likes to come across, across all conversations), standing relationship goals (what the user wants from a specific person, stable across many conversations — “stay close to my sister”), and a goal for the conversation happening right now (“I need to ask Dad for help today”). Each layer shapes which responses are offered and how they are worded, with the most specific layer taking precedence. The middle layer is built: a standing goal for a particular person is set in the people editor, alongside the other things the user records about how they talk with that person, and it is either picked from a short list or written in their own words. The general disposition and the goal for the conversation happening right now are designed but not yet built, and neither is a way to set a goal from the conversation screen."),
            heading2("In Your Own Words"),
            para("The AI does not always generate the perfect response. That is expected — no system knows the user as well as the user knows themselves. The free-composition control, labeled “In your own words,” lets the user type any utterance and have the device speak it immediately in the selected voice. It is always available, always one selection away."),
            para("When the user opens the composer, the system speaks a brief floor-holding placeholder automatically, since typing takes more time than tapping a card."),
            para("On a Windows tablet, an iPad, or a touchscreen laptop whose keyboard folds back out of the way, the system includes a built-in on-screen keyboard designed for direct-select use: alphabetically arranged (a QWERTY option is also available), with large keys sized for users with motor differences, in a panel whose position (bottom, or one side) the user chooses in Settings. During conversation, that same dock area shows the user’s Express Panel at rest and the keyboard when composing, so a single layout serves both. Physical-keyboard users can type directly without it."),
            heading2("You Can Practice Before It Counts"),
            para("Every other feature described here assumes a real conversation is already under way, with a real person waiting. That is a demanding place to learn anything. Practice Mode removes the other person: the AI plays the communication partner, speaking their side of a scenario aloud while the user responds exactly as they normally would. No microphone is involved and nobody's patience is being tested."),
            para("This matters more than a rehearsal feature usually would, for three reasons. The first is that the first real conversation is disproportionately important — it is the moment a person decides whether this device is going to work for them, and it should not also be the moment they are learning where the buttons are. The second is that the interface is built on the premise that nothing on the screen ever moves, so that reaching for a response becomes automatic; that payoff only arrives with repetition, and practice is the only place repetition is free. The third is diagnostic: because Practice Mode uses no microphone, it cleanly separates problems with the app from problems with the room, the background noise, or the connection."),
            para("It is also the natural place to rehearse a specific situation that is coming — a medical appointment, a job interview, meeting someone new — and to hear the effect of a settings change before a real conversation depends on it. Six scenarios ship with the app: a guided tour of the buttons, plus practical, social, medical, personal, and professional situations. Any of them can be run as many times as the user likes."),
            para("Practice Mode deliberately uses the same controls as a real conversation rather than a simplified training version, so what is learned transfers directly. Start Listening, for instance, cues the AI partner's next line instead of opening the microphone — the same button, the same habit, the same rhythm. Practiced conversations are saved alongside real ones but flagged as practice, so they can be reviewed later without being mistaken for something that actually happened."),
            heading2("The AI Is a Layer, Not a Lifeline"),
            para("Every part of this system that matters most — hearing the partner accurately, showing what was heard, and letting the user say something in their own voice — works whether or not the AI is reachable. If the connection drops, the API key is missing, or the AI provider is temporarily down, the user can still see what the partner said (shown in a different color and style if it couldn't be tidied up automatically), still speak using the Express Panel of quick phrases, and still compose and speak anything in “In your own words.” Everything the user says is recorded exactly as it would be if the AI had generated it. What goes away, temporarily, is only the AI's suggested-response cards — the fastest path, not the only path. The device quietly signals when something went wrong (a faint colored cue on the transcript, never an intrusive error message) and keeps working as a capable manual communication tool in the meantime."),
            para("One caveat: recognizing what the partner said still requires an internet connection, since speech recognition itself is a cloud service — a limitation of the underlying browser technology, not of this specific AI feature."),
            heading2("Private by Design"),
            para("All user data — the worldview profile, people and relationships, conversation history, settings — stays on the user’s device. Nothing is sent to any external server except the AI API at the moment of generating response options, over an encrypted HTTPS connection. There is no cloud account holding the user’s personal information. The device can be a Windows tablet, a Chromebook, a Mac, or an iPad — whichever the user prefers. On Windows, a Chromebook, or a Mac, the data lives in an ordinary folder the user picks and can back up or copy like any other folder. An iPad does not let an app reach into folders, so there it lives in storage that belongs to the app alone, and the user moves or backs it up with the built-in Export and Import."),
            para("The device also plays a brief, friendly sound when it starts listening, so the person the user is talking with knows the microphone is on — useful since a tablet screen faces the user, not the communication partner."),
            para("Individual conversations can be kept off the record entirely. A one-tap “Don’t save” control keeps the current conversation from being written to the data folder at all — nothing from it, neither the partner’s words nor the user’s responses, is stored — for a private moment, sensitive news, or a personal matter. It can also be set as the default so every conversation starts private."),
            para("There is one exception, and the user controls it. The app can send a short report back about once a week — counts and timings describing how it is being used, together with any errors it recorded — so that problems can be found and fixed without the user having to notice and describe them. A report never contains anything that was said: no transcripts, no partner speech, and none of the keys. A transcript is sent only if the user deliberately attaches one to a problem report, having read it first. What a report contains, every report already sent, and a switch to turn reporting off are all in the app. During the current beta this reporting is on by default for the small group of testers, who are told so; in the public release it is off unless the user turns it on."),
            heading2("No Subscription. No Server Costs."),
            para("Previous attempts to build AI-driven AAC systems have been shelved when funding ran out. A server-based architecture — where the project pays for computing on behalf of all users — is inherently fragile. This system avoids that failure mode entirely. It runs as a free web application with no backend server. Users create their own AI provider account and supply their own API key. The project incurs no ongoing costs."),
            para("The user pays only for the conversations they actually have — typically a small fraction of a cent per exchange. This model scales to any number of users at near-zero cost to the project. It cannot be defunded."),
            para("Two optional paid services can be added, and neither is needed to start. A more natural-sounding voice than the ones built into the device is available on any device, billed by the amount spoken — a few cents an hour of conversation. And on an iPad running from the Home Screen, where Apple does not let the app use the iPad’s own speech recognition, hearing the other person uses the same paid service, billed by the minute of speech. Both draw on a single account and a single key, both are off unless the user turns them on, and the system is fully usable without either. How good the built-in voices sound does vary a great deal from one device to the next, though — on an iPad in particular the choice is narrow and rather mechanical — so anyone judging how the app will sound in real use should hear the paid voice before deciding."),
            heading2("Free and Open Source"),
            para("The application is free to use. The source code is open source. No license, no subscription, no waiting list."),
            heading1("Where It Runs"),
            para("Conversant AAC runs in a web browser, so there is nothing to install from an app store and no approval to wait for. It is supported on two families of device, with the same features on both: a Windows tablet, Windows laptop, Chromebook, or Mac running Chrome or Edge; and an iPad running Safari. A Microsoft Surface and an iPad both suit the way the app is actually used — carried, propped on a stand, and often fitted with a keyguard."),
            para("On an iPad the app must be opened in Safari. Chrome and Edge for the iPad look like different browsers, but Apple requires them to use Safari underneath, and the app is unable to hear the communication partner in either of them."),
            para("There are also two ways to run it on an iPad, and the choice is worth making deliberately. Opened as a page in Safari, it uses the iPad’s own speech recognition to hear the other person, at no cost, so nothing beyond the AI account is needed to get started. Added to the Home Screen, it runs as an app in its own right: the conversation gets the whole screen and the data is stored durably. But Apple does not allow a Home Screen app to use the iPad’s built-in speech recognition, so hearing the other person there requires the paid transcription service."),
            simpleTable([
                ["", "Opened in the Safari browser", "Installed on the Home Screen"],
                ["Hearing the other person", "Uses the iPad’s own speech recognition. Free.", "Apple blocks the built-in recognition here, so this needs the paid transcription service — roughly 46 cents per hour of speech, and only while somebody is actually talking."],
                ["Screen given to the conversation", "Slightly less: Safari’s own bars take a strip along the edge.", "Slightly more: the whole screen belongs to the app. This is the main reason most people end up preferring it."],
                ["Your data (About Me, people, saved conversations)", "Held in storage the browser manages, which the iPad may clear if the app goes unused for a long stretch — an illness or a hospital stay is exactly that. Export a backup regularly.", "Held durably once you allow it, so a long gap in use will not lose it. Exporting a backup is still worth doing."],
                ["Best suited to", "Getting started without a second paid service, and everyday use by anyone who would rather keep it that way.", "Committed, everyday use — particularly for someone already paying for the better-sounding voice, since the same account and key cover both."],
            ]),
            para("Switching between the two later does not carry anything across on its own — as far as the iPad is concerned they are separate — so export the data first and import it afterwards. The User Manual walks through it."),
            heading1("Who It’s For Right Now"),
            para("The initial version is designed for:"),
            bullet("Non-speaking individuals — the initial focus is on cerebral palsy, but the system is appropriate for any non-speaking individual who meets the other criteria listed here"),
            bullet("Literate (able to read response options on screen and evaluate them)"),
            bullet("Age 18 or older (the higher age limit reflects both the current availability of suitable text-to-speech voices and the age-appropriateness of AI-generated conversational content; expansion to younger users is a future goal)"),
            bullet("Using direct select as the primary access method — a finger, a stylus, a mouse or a trackball, and equally an eye gaze camera or head-tracking device set up to move the pointer and click by dwelling (see “Access Methods” below)"),
            bullet("Using either a Windows tablet, Windows laptop, Chromebook, or Mac with a current version of Chrome or Edge (the Microsoft Surface is the recommended hardware for portability), or an iPad with Safari — on an iPad it must be Safari, because Chrome and Edge there are unable to hear the communication partner — with either a physical keyboard or the app’s built-in on-screen keyboard"),
            para("The architecture is designed from the start to expand beyond this initial profile — to switch scanning, to different literacy levels, and to a broader age range. But the first version focuses on where a working proof of concept delivers the most value soonest."),
            heading2("Access Methods"),
            para("Direct select means the user chooses an item by pointing straight at it, rather than waiting for a cursor to arrive at it. The thing that does the pointing matters less than it might seem. A finger on the screen, a stylus, a mouse, a trackball, an eye gaze camera, or a head-tracking device all arrive at the app the same way, and the app does not ask which one it is dealing with."),
            para("That makes most eye gaze and head-tracking equipment usable with Conversant AAC today, with no special support and nothing to configure in the app. The requirement is simply that the device is running in the mode where it moves the pointer and selects by dwelling — the mode usually called computer control or mouse emulation, which on most systems is something the user turns on deliberately rather than the mode the equipment starts in. Conversant AAC never needs dragging, a right click, a second click to confirm, a pinch, or anything revealed by hovering, so there is nothing in it that this kind of pointer struggles with."),
            para("Three practical notes for anyone setting one up. The size of the buttons and the space between them are settings in the app, and they are the place to tune for a tracker that is a little imprecise. The dwell time is set on the tracker, not in the app. And a response card is chosen with a single selection — the optional confirming second tap applies only to the Express Panel phrases, and is off unless it is turned on."),
            para("The honest limit is what comes after pointing. There is no switch scanning yet: nothing in the app steps through the choices for a user who cannot direct a pointer at all. The system was designed so that this can be added without rebuilding it, and it is on the roadmap, but it does not exist today. So the app suits anyone who can drive a pointer by any means — which includes many people with conditions where eye gaze is the standard access method, such as ALS — and does not yet suit someone who has moved beyond that."),
            para("One thing worth weighing rather than assuming: driving the screen by gaze means looking at the screen, and the app already asks for eyes on the transcript and the response cards. That is attention not being spent on the other person’s face. It rules nothing out, but it is worth watching in the first sessions."),
            emptyPara(),
            heading1("What’s Coming"),
            heading2("Phase 1 — Core Conversation Loop"),
            para("The core Phase 1 conversation loop is built and working. This is the breakthrough: real-time conversational participation that was not possible with previous AAC devices. Available features include:"),
            bullet("The five-step conversation loop: listen continuously, show the transcript, speak a placeholder, generate response options (four categories — four or eight cards), select and speak"),
            bullet("Continuous partner capture: listening continues through pauses and resumes until the user selects, so options can begin appearing even while the partner is still talking"),
            bullet("Transcript display: every transcript is visible to the user before responding; options are generated upon the partner’s first pause and update automatically if the partner continues speaking"),
            bullet("The “About Me” worldview questionnaire: self-paced, no question required, and a “Questions worth answering” list built from the facts real conversations turned out to need"),
            bullet("People and relationships: private on-device graph of the people in the user’s life"),
            bullet("My Places: a private on-device record of the places the user goes, each with whatever facts matter for it, and a one-tap way to tell the AI where they are right now"),
            bullet("Free composition: “In your own words” lets the user type and speak anything the AI did not generate"),
            bullet("The Express Panel: a customizable panel of one-tap quick phrases, plus Partner, Place, and Feeling toggles that tailor openers and suggestions to where the user is, who the user is with, and how they feel"),
            bullet("Editable spoken phrases: the wording of the persistent controls (Hold on, Ask them to repeat) and of the opener and closing cards can be reworded so they sound like something the user would actually say"),
            bullet("Auto-resume listening: an optional setting to restart listening automatically after each exchange"),
            bullet("Built-in on-screen keyboard (alphabetical or QWERTY) for tablets and fold-back touchscreen laptops"),
            bullet("User-supplied AI key (Claude by Anthropic is the initial provider; additional AI providers are planned), with in-app guidance — a format check and a one-tap connection test — to help confirm the key was entered correctly"),
            bullet("Per-conversation privacy: a one-tap “Don’t save” control keeps any conversation off the record, and it can be made the default"),
            bullet("Adjustable text sizes and touch-target sizes, so the response cards, transcript, composer, and Express Panel can each be made as large and legible as the user needs"),
            bullet("Practice Mode: rehearse a conversation with the AI playing the other person — no microphone needed — so a new user can learn the flow, and anyone can rehearse a specific situation (ordering coffee, meeting someone new, a doctor visit) before it happens; found under Settings → Practice"),
            bullet("Automatic updates: the app keeps itself current and, after each update, shows a plain-language summary of what changed"),
            bullet("All data stored locally on the user’s device; no backend server"),
            heading2("Phase 2 — Situational Awareness"),
            para("Phase 1 already delivers part of this: the user can tell the system where they are and who they are with, by tapping a place or a partner. Phase 2 is about the system working the situation out for itself, so the responses and conversation starters it offers fit the moment without being told. The system will draw on the user’s location (via GPS), recognition of the communication partner (by face or voice), and the user’s calendar. With that context, the conversation starters become contextually suggested — the openers offered at home with a family member differ from those offered at a medical appointment or with a colleague — and the response options are shaped by where the user is and who they are talking with. What the system knows about a particular person from the people-and-relationships model already shapes responses today, as soon as the user taps who they are with. What recognition adds is that the user no longer has to tap."),
            para("Multi-vendor AI support — letting users choose among providers such as Anthropic, OpenAI, and Google — will also be introduced. (On-device “local” models are a longer-term possibility as hardware grows more capable and language models grow smaller; matching cloud-model quality on local hardware is not expected in Phase 2.)"),
            heading2("Phase 3 — Full Worldview Shaping"),
            para("The complete worldview model — shaped by the user’s personality, values, relationships, and communication goals — will be integrated into every response generated. Phase 3 is where the system begins to speak truly as the user, not merely for them. Conversation history across sessions and a review loop allow the system to continuously improve its understanding of this specific person over time. Phase 3 is also when the user will be able to feed in their own writing — essays, position statements, prior messages — for the system to draw on through a retrieval database (RAG); importing from outside sources such as social-media history is a later extension."),
            heading2("Further Out — Future Directions"),
            para("Beyond the three phases above, a number of capabilities are on the longer-term roadmap:"),
            bullet("Speaker-aware capture: using voice recognition to lock onto the communication partner’s voice, improving transcription in noisy rooms and filtering out bystanders and the device’s own speech"),
            bullet("Multi-party conversations: tracking who said what when more than one conversation partner takes part."),
            bullet("Conversation review: revisiting past conversations from saved transcripts to refine the worldview profile and settings"),
            bullet("Coached practice: Practice Mode today lets the user rehearse a conversation and includes a guided tour of the controls. What is still to come is coaching on the conversation itself — the system commenting on the choices the user made and suggesting alternatives, rather than only playing the other person"),
            bullet("A voice that is the user’s own: voice banking and cloned voices, so the device speaks in the user’s voice rather than a stock one. (A higher-quality neural voice is already available today as an option — see “No Subscription. No Server Costs.”)"),
            bullet("Streaming generation: forming and refining response options from partial speech while the partner is still talking, to remove almost all post-utterance delay"),
            bullet("Messaging and social connectivity: extending the same “speak as the user” help to email, texting, and other near-real-time and asynchronous channels"),
            bullet("Symbol and pictographic support: serving users who communicate via symbols rather than text, broadening who the system can serve"),
            heading1("Try It"),
            para("The core Phase 1 system is available now as a free, open-source web application. If you work with or care for a non-speaking individual who has the literacy and cognitive capacity to participate in conversation — and who is currently limited to transactional AAC use — this system was designed for them."),
            para("It does not replace existing AAC vocabulary systems. It adds what those systems have been unable to provide: real-time conversational participation — the ability to respond, to initiate, to joke, to disagree, and to be present in a conversation as themselves."),
            para("For more information or to get started, visit Volksswitch.org."),
            heading1("Glossary"),
            heading2("AAC (Augmentative and Alternative Communication)"),
            para("A broad category of strategies, devices, and systems that supplement or replace natural speech for individuals who cannot speak or whose speech is difficult to understand. AAC ranges from low-tech picture boards and letter boards to high-tech speech-generating devices. This system is a high-tech AAC approach."),
            heading2("Adjacency Pair"),
            para("In Conversation Analysis: a two-part sequence in which one utterance (a question, greeting, invitation, or complaint) creates a structural expectation for a specific type of response. When someone asks a question, conversation norms make an answer expected, and anything else — changing the subject, or answering a different question — is noticeable, and the person is expected to account for it. The conversation engine tracks open adjacency pairs to understand what kind of response is called for at any moment."),
            heading2("API Key"),
            para("A private credential that authorizes a software application to access an AI provider’s services over the internet. Users of this system create their own account with an AI provider — initially Anthropic (maker of Claude) — and supply their own API key. They are billed directly by the provider based only on the conversations they actually have. There is no subscription fee to the app itself."),
            heading2("Auto-Resume Listening"),
            para("An optional setting that restarts partner-listening mode automatically after the AAC user’s selected response is spoken, so the user does not have to tap Start between turns. Off by default; users who prefer explicit control over when listening begins leave it off."),
            heading2("Communication Partner"),
            para("The person speaking with the AAC user — the other participant in the conversation. This system places all technology on the AAC user’s side; the communication partner requires no device, no app, no training, and no special knowledge."),
            heading2("Continuous Partner Capture"),
            para("The system’s approach to listening across extended or multi-part partner utterances. Rather than recording once and stopping at the first pause, the system listens as a continuous stream. Each time the partner pauses, it generates response options from what was heard so far; if the partner continues, the options update to reflect the fuller utterance. Recording stops when the user selects a response, so the AAC user can begin choosing even while the partner is still talking."),
            heading2("Conversation Analysis (CA)"),
            para("The academic discipline that studies how talk is structured in real social interaction — how people take turns, open and close topics, repair misunderstandings, and accomplish social actions through conversation. CA research (originating with Sacks, Schegloff, and Jefferson, 1974) provides the scientific foundation for this system’s conversation engine design."),
            heading2("Direct Select"),
            para("An access method in which the user directly touches or points to an item on a screen to select it, as opposed to indirect methods such as switch scanning (where a cursor moves through items automatically and the user activates a switch at the right moment). The pointing can be done with a finger, a stylus, a mouse or trackball, or an eye gaze or head-tracking device that moves the pointer and selects by dwelling."),
            heading2("Generative AI"),
            para("A category of artificial intelligence that produces new content — text, audio, images, or other output — in response to a prompt. This system uses a generative AI language model to create contextually appropriate, naturally worded response options for the AAC user within seconds of the communication partner speaking."),
            heading2("In Your Own Words (Free Composition)"),
            para("A control that lets the user type any utterance and have the device speak it in the selected voice. The same typed text can instead be handed to the AI with the Reframe button, which leaves it unspoken and regenerates the response cards around it — useful for supplying a fact the AI does not have, or for saying which way to lean. Always available, always one selection away. Designed for the moments when none of the AI-generated options is quite right. When the user opens the composer, the system speaks a floor-holding placeholder automatically, since free composition takes more time than tapping a card."),
            heading2("LLM (Large Language Model)"),
            para("The type of AI model that generates response options. Large language models are trained on vast bodies of human text and can produce natural-sounding, contextually appropriate language in response to a prompt. Claude (developed by Anthropic) is the initial LLM used in this system, with support for additional providers planned."),
            heading2("My Places"),
            para("A structured, private, on-device record of the places the user goes. Each place has a name and any number of named facts the user chooses — there is no fixed set of fields, because what is worth recording differs completely from one place to the next. Tapping a place in the Express Panel during a conversation tells the AI the user is there now, and it shapes its suggestions accordingly. A place may be marked private, with the same meaning it has for a person: known to the AI for context, never raised on its own."),
            heading2("People and Relationships"),
            para("A structured, private, on-device record of the people in the user’s life — family members, friends, caregivers, colleagues, and others — each with a name, a nickname or term of address, a relationship type, a description, and a privacy flag. When a response names a person, the system uses the nickname the user actually uses (“Mom,” not “Mary”). A person marked private is still known to the AI for context but is never raised unprompted — offered only if the other person asks, or if the user asks for them in “In your own words.” (This is the same meaning “private” has for personal facts in the questionnaire: known to the AI, used for context, never volunteered. A stronger “prefer not to say” option withholds a fact from the AI entirely.) The AI draws on this model to generate more contextually appropriate responses when the user is speaking about specific people."),
            heading2("Placeholder"),
            para("A brief spoken utterance — for example, “I’m thinking about that.” or “Still thinking it through.” — spoken automatically by the device to hold the conversational floor while the user reads the response options and chooses. Placeholders prevent the multi-second silence that causes communication partners to disengage. The wording never presumes what kind of turn the partner took, because the placeholder is spoken before the app knows. The first comes a set interval after the partner stops talking, and any later one says the user is still working on an answer rather than repeating the same phrase. The user controls the timing and how many may be spoken in a single turn, including none at all. Every placeholder is displayed on screen as it plays."),
            heading2("Practice Mode"),
            para("A mode in which the AI plays the communication partner, so the user can rehearse a complete conversation without another person present and without a microphone. The conversation screen behaves exactly as it does in a real conversation, except that Start Listening cues the AI partner's next line rather than opening the microphone. Used to learn the system before a first real conversation, to build speed, to rehearse a specific upcoming situation, and to test a settings change safely. Apart from the guided tour of the controls, which follows a fixed script, the AI is genuinely conversing rather than reading from one — so the same scenario runs differently every time, responding to what the user actually said, and can be repeated without becoming rote."),
            heading2("Response Options"),
            para("The set of AI-generated conversational responses presented to the AAC user after the communication partner speaks. Organized into four structurally distinct slots — Preferred, Dispreferred, Initiative, and Repair — each in a fixed screen position. The user selects one with a single tap; the device speaks it aloud. Nothing is spoken without the user’s selection."),
            heading2("Response Palette"),
            para("The set of AI-generated response cards presented to the user after the partner speaks, in four structurally distinct categories — Preferred (the most natural, affiliative answer), Dispreferred (a graceful decline or hedge), Initiative (a new direction or follow-up), and Repair (a request for clarification or a recovery when something went wrong). Each category occupies a fixed screen position so the user learns where each kind of option appears (supporting motor planning); the user can opt to see two options per category, eight cards in all. Reading a card before selecting is encouraged. A card is chosen with a single tap; the optional confirming double-tap applies to the Express Panel phrases, not to response cards."),
            heading2("STT (Speech-to-Text)"),
            para("Automatic conversion of spoken audio into written text, also called transcription. The system uses STT to capture what the communication partner says and display it as a text transcript. By default the transcript is shown for the user to see but does not block generation — options are generated as soon as the partner pauses, and the user can discard a garbled capture with the Ask them to repeat control. (An optional require-confirmation-first mode is planned but is not part of the current build.) The user must always be able to verify the system heard correctly."),
            heading2("TTS (Text-to-Speech)"),
            para("Software that converts written text into spoken audio. The system uses TTS to speak the user’s selected response aloud and to deliver placeholder phrases while options are being generated. By default it uses the voices built into the device, which cost nothing. A higher-quality neural voice from a paid service can be chosen instead, on any device. Personalized voice banking — a cloned voice that sounds like the user — remains a planned future feature."),
            heading2("Turn-Taking"),
            para("The conversational mechanism by which participants alternate between speaking roles. Turn-taking involves claiming the floor, holding it, yielding it, and redirecting it — and doing so within narrow timing windows that most communication partners unconsciously enforce. AAC users are chronically disadvantaged by turn-taking timing requirements, which is the central problem this system is designed to solve."),
            heading2("Worldview Model"),
            para("A structured, private profile of the AAC user built from three sources: the “About Me” questionnaire (facts, interests, values, and communication style, answered at the user’s own pace), the people-and-relationships graph (the people in the user’s life, their relationship types, and notes), and conversation goals (what the user wants from specific relationships and specific exchanges). The worldview model is used to personalize AI-generated response options so they reflect who the user actually is. The profile is entirely optional — no question is required, and the system is functional with a completely empty profile."),
            emptyPara(),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(docPath("Conversant AAC Product Overview.docx"), buffer);
    console.log("Conversant AAC Product Overview.docx generated.");
});
