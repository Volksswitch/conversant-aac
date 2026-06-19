// Conversant AAC — Product Overview generator.
// Reproduces "AI-Driven AAC Product Overview.docx" under the Conversant AAC name.
// Styled to match the other design docs (Arial, blue headings, centered footer
// with "Page m of n"). American English spelling throughout.
'use strict';
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, PageNumber } = require('docx');

const PAGE_W = 12240;
const MARGIN  = 1440;

// ── helpers ──────────────────────────────────────────────────────────────────

function heading1(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function heading2(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function heading3(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
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

            // ── The Gap ───────────────────────────────────────────────────────
            heading1("The Gap"),
            para("For decades, AAC devices have given non-speaking individuals a way to express needs, make choices, and share information. That is real progress. But there is a gap that rarely gets named directly:"),
            para("AAC devices support communication. Very few support conversation."),
            para("These are not the same thing."),
            para("Communication is the transfer of meaning from one person to another. A stop sign communicates. A fire alarm communicates. An AAC user selecting “I need help” communicates. The message goes out; the purpose is served."),
            para("Conversation is something different. It is a joint activity — two or more people co-constructing meaning together, turn by turn, in real time. It is interactive, reciprocal, and time-sensitive. In conversation, each contribution responds to what came before and shapes what comes next."),
            para("All conversation is communication. But not all communication is conversation."),
            para("Most AAC systems are designed for communication. It’s in the name! The result is that the people who use them are largely excluded from conversation — and from everything conversation makes possible. Real-world conversation happens with strangers, colleagues, and acquaintances — people who are not trained to be patient and are not prepared to wait."),

            // ── What AAC Users Actually Lose ──────────────────────────────────
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
            para("Much of conversation consists of small, unplanned, opportunistic moves: “That reminds me…” “Actually…” “Me too.” “That’s hilarious.” “I had the same problem.” These are not major messages. They are the small things that make conversations feel alive."),
            para("Many AAC systems require deliberate message construction. That means the user may eventually be able to say something important, but cannot easily say the small things. They lose the ability to be casually present."),

            heading2("Humor"),
            para("Humor depends on timing, surprise, shared background, and risk. An AAC user may be able to select “That’s funny” — but that is not the same as being able to make the joke. Humor is not ornamental. It is a major way people display intelligence, build intimacy, resist pity, and claim social equality. When a person cannot joke easily, others may treat them more solemnly, clinically, or childishly."),

            heading2("Identity"),
            para("People are known through conversation. We become “the funny one,” “the thoughtful one,” “the skeptical one,” “the one who asks great questions.” When AAC only supports minimal functional communication, the person may instead be known mainly through needs: what they want, what they refuse, what hurts, what they can answer."),
            para("That distorts identity. The person’s expressed self becomes smaller than the person’s actual self."),

            // ── The Summary ───────────────────────────────────────────────────
            heading1("The Summary"),
            para("When AAC supports communication but not conversation, users may lose: timing, agency, the ability to be known as complex and adult, the small exchanges that create friendship, the ability to explain and process emotions, the ability to intervene quickly in care decisions, access to private and confidential exchange, and the chance to develop thoughts with others rather than delivering finished messages."),
            para("As one research synthesis puts it: the loss is not simply linguistic. It is dignity."),

            // ── The Root Cause ────────────────────────────────────────────────
            heading1("The Root Cause — The Four-Second Problem"),
            para("Understanding why conversation has been out of reach for AAC users requires looking past the obvious answer."),
            para("The obvious answer is speed. AAC users with significant motor limitations typically communicate at 10 to 20 words per minute. Comfortable conversation requires at least 80 words per minute. The gap is real."),
            para("But speed alone is not the deepest barrier. The deepest barrier is the human aversion to awkward silence."),
            para("Research shows that people become uncomfortable after as little as one to four seconds of silence in conversation. Repeated multi-second delays cause communication partners to interrupt, finish sentences for the AAC user, or disengage entirely."),
            para("The result is that even a capable, articulate AAC user — one who has things to say and the device to say them — cannot hold a conversation partner’s attention long enough to be heard. They are confined to transactional exchanges: expressing needs and wants. The richer, interactional communication — the jokes, the debates, the small talk, the friendship-building — remains out of reach."),
            para("This is not a matter of the AAC user’s capability. It is a technology gap."),

            // ── The Solution ──────────────────────────────────────────────────
            heading1("The Solution — AI-Generated Response Options"),
            para("Generative AI makes it possible to close that gap."),
            para("Within seconds of a communication partner finishing a sentence or a thought, an AI system can generate several contextually appropriate, naturally worded response options for the AAC user to choose from. The user selects one with a single tap. The device speaks it immediately. The conversation continues at or near natural speed."),
            para("The silence that used to strand the AAC user — and drive potential partners away — is filled. Not with a generic placeholder, but with an actual response, selected by the user."),
            para("The system is designed to generate initial response options after as little as one second of silence — fast enough to beat the discomfort threshold that research identifies as the point where communication partners begin to disengage."),
            para("This is the core idea. Everything else is refinement."),

            // ── Speaking As the User ──────────────────────────────────────────
            heading1("Speaking As the User, Not For the User"),
            para("A critical distinction: the goal is not to speak for the AAC user. It is to speak as the AAC user."),
            para("The AI does not generate generic responses that any person might give. It generates responses shaped by this specific person’s personality, opinions, relationships, and conversational goals. Over time, as the system learns who the user is, the responses sound more and more like them."),
            para("The user retains final control over every word spoken. They select; the device speaks. Nothing is said without their intervention."),

            // ── Partner Needs Nothing ─────────────────────────────────────────
            heading1("The User’s Communication Partner Needs Nothing"),
            para("The communication partner requires no device, no app, no training, and no special knowledge of or relationship with the user. From their perspective, they are simply having a conversation with someone who uses a device to communicate. The technology is entirely on the AAC user’s side."),

            // ── How It Works ──────────────────────────────────────────────────
            heading1("How It Works"),
            para("The core conversation loop has five steps."),
            para("1. The communication partner speaks. The system listens continuously — not in discrete chunks, but as a flowing stream. Each time the partner pauses, the system sends what has been said so far for processing. If the partner continues speaking after a pause, the response options update to reflect the fuller utterance. Recording stops when the user makes a selection."),
            para("2. A text transcript of what the partner said appears on screen. The transcript is designed to pass through three clearly marked states — amber (unconfirmed), blue (confirmed, generating), and green (options ready) — so the user always knows exactly where in the loop they are. By default, the system waits for the user to confirm the transcript before generating response options. The user, however, decides what level of confidence to require: auto-confirm thresholds are configurable. Low-confidence words are underlined for easy spotting."),
            para("3. A brief, natural filler phrase is spoken automatically within about one second. “Hmm, let me think…” The filler holds the conversational floor while options are being generated, keeping silence within the one-to-four-second threshold that research shows makes communication partners uncomfortable. Every filler is displayed on screen as it plays — the system never speaks on the user’s behalf invisibly."),
            para("4. The AI generates four structurally distinct response options, organized into fixed screen positions:"),
            bullet("Preferred — the most natural, affiliative answer to what was said"),
            bullet("Dispreferred — a graceful way to decline, hedge, or push back, with a brief account rather than a blunt refusal"),
            bullet("Initiative — a new direction the user wants to take: a follow-up question, a counter-offer, a related topic"),
            bullet("Repair — for moments when something needs clarification: “Wait — where?” or “Did you mean next Friday?”"),
            para("Each option appears as a large, tappable card showing a short, glanceable hint — just a few words naming the move — alongside the full text that will be spoken aloud. The four positions are fixed on screen. With a little practice, users develop motor automaticity: knowing instinctively where to look for each type of move — though the full option text is always visible and readable."),
            para("5. The user selects a response with a single tap. The device speaks the selected response aloud. The conversation continues."),
            para("An optional auto-resume setting restarts listening automatically after each exchange, so the user never has to tap Start Listening between turns."),

            // ── Conversation Engine ───────────────────────────────────────────
            heading1("A Conversation Engine Built on How Talk Actually Works"),
            para("The system is grounded in Conversation Analysis, the empirical study of how real conversation is structured. This means it understands more than turn-taking."),
            para("Conversations have structure. A question creates an obligation for an answer. An invitation creates an obligation for acceptance or decline. A complaint expects acknowledgment. The conversation engine is designed to track these open obligations as a running stack, so it always knows what type of response the current moment calls for. This is a joint effort between AI and application: the AI classifies each conversational move; the application maintains the state. When a repair sequence opens — something needed clarification — the original obligation is restored automatically when the repair resolves."),
            para("The system operates in five distinct modes: Listening, Responding, Repair-of-Self, Initiating, and Pre-Closing/Closing. It infers which mode applies from the partner’s behavior, displays the inference to the user at a glance, and provides persistent override controls that are always on screen, in the same position, in every mode. The user can redirect the engine at any moment without searching the screen."),
            para("One of the highest-value capabilities is Repair-of-Self: when the partner signals they did not hear or understand — “What?” or “Sorry, say that again” — the system generates options to re-speak, rephrase, or expand what was said on the user’s behalf. This is the kind of conversational recovery that spoken users perform automatically, and that AAC users have historically had no efficient path to."),
            para("The AI generates response options that represent the four structurally distinct move types described above, always in the same screen positions. The result is a system that does not merely suggest words — it suggests the right kind of conversational move for this specific moment in this specific exchange."),

            // ── What Makes This Different ─────────────────────────────────────
            heading1("What Makes This Different"),

            heading2("AI-Driven, Not Merely AI-Enabled"),
            para("Many AAC systems include AI-enabled features — word prediction, symbol suggestions, pattern-based communication modeling. These are valuable additions to an AAC device. This system is different: generative AI is not a feature added on top. Generative AI — the kind that creates language from scratch in response to a prompt — is the system. Every response option the user sees was created in real time, shaped by this specific conversation and this specific person’s profile. That is what “AI-driven” means."),

            heading2("Designed for Conversation, Not Just Communication"),
            para("This system was built from the ground up around the goal of real-time conversational participation. The conversation loop, the response option design, the filler ladder — a tiered sequence of floor-holding phrases (see Glossary), the timing — every decision was made in service of keeping a real conversation going."),

            heading2("The System Learns Who You Are"),
            para("The system maintains a structured model of the user’s personality, interests, opinions, relationships, and communication goals. This is called the worldview model. Over time, as the model fills in, responses sound more like the user — their sense of humor, their way of expressing disagreement, their vocabulary, their characteristic concerns."),

            heading3("The “About Me” Questionnaire"),
            para("A self-paced questionnaire lets the user build their profile one question at a time: who they are, where they live, what they care about, how they like to express themselves, and what they want others to know. Questions are organized into modules that can be answered in any order, in any sitting, at any pace. No question is required. The system is fully functional with a completely empty profile, and the questionnaire fills itself over time — the system takes note of which facts it needed but did not have during real conversations and brings those to the surface as suggestions."),

            heading3("People and Relationships"),
            para("The system maintains a private, on-device record of the people in the user’s life — family, friends, caregivers, colleagues, and others — each with a name, relationship type, and description. Any person can be marked private, ensuring they will never appear or be named in AI-generated responses. The AI draws on this model to generate more contextually appropriate responses when the user is speaking about or with specific people."),

            heading3("Conversation Goals"),
            para("People have goals in every conversation, consciously or not: “stay close to my sister,” “I need to ask Dad for help today.” Standing relationship goals and per-conversation goals shape which response options are surfaced and how they are ranked. A goal-setting control integrated with the people editor and conversation interface is planned for an upcoming release."),

            heading2("In Your Own Words"),
            para("The AI does not always generate the perfect response. That is expected — no system knows the user as well as the user knows themselves. The free-composition control, labeled “In your own words,” lets the user type any utterance and have the device speak it immediately in the selected voice. It is always available, always one selection away."),
            para("When the user opens the composer, the system speaks a brief floor-holding filler automatically, since typing takes more time than tapping a card."),
            para("For users on a Windows tablet, the system includes a built-in on-screen keyboard designed for direct-select use: alphabetically arranged, with large keys sized for users with motor differences, in a panel that docks beside the screen during questionnaire work and at the bottom during conversation. Physical keyboard users can type directly without it."),

            heading2("Private by Design"),
            para("All user data — the worldview profile, people and relationships, conversation history, settings — stays on the user’s device. Nothing is sent to any external server except the AI API at the moment of generating response options — sent over an encrypted HTTPS connection. There is no cloud account holding the user’s personal information. The device is a Windows tablet; the data is a local folder that the user controls."),

            heading2("No Subscription. No Server Costs."),
            para("Previous attempts to build AI-driven AAC systems have been shelved when funding ran out. A server-based architecture — where the project pays for computing on behalf of all users — is inherently fragile. This system avoids that failure mode entirely. It runs as a free web application with no backend server. Users create their own AI provider account and supply their own API key. The project incurs no ongoing costs."),
            para("The user pays only for the conversations they actually have — typically a small fraction of a cent per exchange. This model scales to any number of users at near-zero cost to the project. It cannot be defunded."),

            heading2("Free and Open Source"),
            para("The application is free to use. The source code is open source. No license, no subscription, no waiting list."),

            // ── Who It's For ──────────────────────────────────────────────────
            heading1("Who It’s For Right Now"),
            para("The initial version is designed for:"),
            bullet("Non-speaking individuals — the initial focus is on cerebral palsy, but the system is appropriate for any non-speaking individual who meets the other criteria listed here"),
            bullet("Literate (able to read response options on screen and evaluate them)"),
            bullet("Age 16 or older (the lower age limit reflects both the current availability of suitable text-to-speech voices and the age-appropriateness of AI-generated conversational content; expansion to younger users is a future goal)"),
            bullet("Using direct select (touch or pointer/stylus) as the primary access method"),
            bullet("Running a Windows tablet (Microsoft Surface is the recommended hardware), with either a physical keyboard or the app’s built-in on-screen keyboard. A Windows laptop, Chromebook, or MacBook can also be used, though they would be somewhat less portable."),
            para("The architecture is designed from the start to expand beyond this initial profile — to switch scanning, eye gaze, different literacy levels, and a broader age range. But the first version focuses on where a working proof of concept delivers the most immediate value."),

            // ── What's Coming ─────────────────────────────────────────────────
            heading1("What’s Coming"),

            heading2("Phase 1 — Core Conversation Loop"),
            para("The core Phase 1 conversation loop is built and working. This is the breakthrough: real-time conversational participation that was not possible with previous AAC devices. Available features include:"),
            bullet("The five-step conversation loop: listen continuously, confirm transcript, speak filler, generate four-slot response options, select and speak"),
            bullet("Continuous partner capture: listening continues through pauses and resumes until the user selects, so options can begin appearing even while the partner is still talking"),
            bullet("Transcript display: every transcript is visible to the user before responding; options are generated upon the partner’s first pause and update automatically if the partner continues speaking"),
            bullet("The “About Me” worldview questionnaire: self-paced, no question required, profile fills itself from real conversations"),
            bullet("People and relationships: private on-device graph of the people in the user’s life"),
            bullet("Free composition: “In your own words” lets the user type and speak anything the AI did not generate"),
            bullet("Auto-resume listening: an optional setting to restart listening automatically after each exchange"),
            bullet("Built-in on-screen keyboard for Windows tablet use"),
            bullet("User-supplied AI key (Claude by Anthropic is the initial provider; additional AI providers are planned)"),
            bullet("All data stored locally on the user’s device; no backend server"),

            heading2("Phase 2 — Situational Awareness"),
            para("The system will add awareness of where the user is (via GPS), who they are speaking with (via face and voice recognition), and what’s on their calendar. Response options and conversation starters will become contextually appropriate to the specific setting and partner. Multi-vendor AI support — enabling users to choose among Anthropic, OpenAI, Google, local models, and others — will also be introduced."),

            heading2("Phase 3 — Full Worldview Shaping"),
            para("The complete worldview model — shaped by the user’s personality, values, relationships, and communication goals — will be integrated into every response generated. Phase 3 is where the system begins to speak truly as the user, not merely for them. Conversation history across sessions and a review loop allow the system to continuously improve its understanding of this specific person over time."),

            // ── Try It ────────────────────────────────────────────────────────
            heading1("Try It"),
            para("The core Phase 1 system is available now as a free, open-source web application. If you work with or care for a non-speaking individual who has the literacy and cognitive capacity to participate in conversation — and who is currently limited to transactional AAC use — this system was designed for them."),
            para("It does not replace existing AAC vocabulary systems. It adds what those systems have been unable to provide: real-time conversational participation — the ability to respond, to initiate, to joke, to disagree, and to be present in a conversation as themselves."),
            para("For more information or to get started, visit Volksswitch.org."),

            // ── Glossary ──────────────────────────────────────────────────────
            heading1("Glossary"),

            heading2("AAC (Augmentative and Alternative Communication)"),
            para("A broad category of strategies, devices, and systems that supplement or replace natural speech for individuals who cannot speak or whose speech is difficult to understand. AAC ranges from low-tech picture boards and letter boards to high-tech speech-generating devices. This system is a high-tech AAC approach."),

            heading2("Adjacency Pair"),
            para("In Conversation Analysis: a two-part sequence in which one utterance (a question, greeting, invitation, or complaint) creates a structural expectation for a specific type of response. When someone asks a question, conversation norms make an answer expected — not silence. The conversation engine tracks open adjacency pairs to understand what kind of response is called for at any moment."),

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
            para("An access method in which the user directly touches or points to an item on a screen to select it, as opposed to indirect methods such as switch scanning (where a cursor moves through items automatically and the user activates a switch at the right moment) or eye-gaze systems (where gaze direction controls selection). The initial version of this system targets direct-select users."),

            heading2("Filler / Filler Phrase"),
            para("A brief spoken utterance (for example, “Hmm, let me think…” or “Just a second”) spoken automatically by the device to hold the conversational floor while AI response options are being generated. Fillers prevent the multi-second silence that causes communication partners to disengage. The system uses a tiered filler ladder: a short acknowledgment token within one second, followed by a longer projection phrase at two to three seconds if needed. Every filler is displayed on screen as it plays."),

            heading2("Generative AI"),
            para("A category of artificial intelligence that produces new content — text, audio, images, or other output — in response to a prompt. This system uses a generative AI language model to create contextually appropriate, naturally worded response options for the AAC user within seconds of the communication partner speaking."),

            heading2("In Your Own Words (Free Composition)"),
            para("A control that lets the user type any utterance — or expand a few words into a full sentence — and have the device speak it in the selected voice. Always available, always one selection away. Designed for the moments when none of the AI-generated options is quite right. When the user opens the composer, the system speaks a floor-holding filler automatically, since free composition takes more time than tapping a card."),

            heading2("LLM (Large Language Model)"),
            para("The type of AI model that generates response options. Large language models are trained on vast bodies of human text and can produce natural-sounding, contextually appropriate language in response to a prompt. Claude (developed by Anthropic) is the initial LLM used in this system, with support for additional providers planned."),

            heading2("Move Palette"),
            para("The set of four AI-generated response cards presented to the AAC user after the partner speaks. Each card occupies a fixed screen position and represents a structurally distinct conversational move: Preferred (the most natural, affiliative answer), Dispreferred (a graceful decline or hedge), Initiative (a new direction or follow-up), and Repair (a request for clarification or a recovery when something went wrong). Fixed positions allow motor automaticity — the user reaches for the same spot for the same type of move without reading the card."),

            heading2("People and Relationships"),
            para("A structured, private, on-device record of the people in the user’s life — family members, friends, caregivers, colleagues, and others — each with a name, relationship type, description, and a privacy flag. Private individuals are never named or described in AI-generated responses; the system phrases around them instead. The AI draws on this model to generate more contextually appropriate responses when the user is speaking about specific people."),

            heading2("Response Options"),
            para("The set of AI-generated conversational moves presented to the AAC user after the communication partner speaks. Organized into four structurally distinct slots — Preferred, Dispreferred, Initiative, and Repair — each in a fixed screen position. The user selects one with a single tap; the device speaks it aloud. Nothing is spoken without the user’s selection."),

            heading2("STT (Speech-to-Text)"),
            para("Automatic conversion of spoken audio into written text, also called transcription. The system uses STT to capture what the communication partner says and display it as a text transcript for the AAC user to confirm before response options are generated. By default, the system waits for user confirmation of the transcript before generating response options; auto-confirm thresholds are configurable. The user must always be able to verify the system heard correctly."),

            heading2("TTS (Text-to-Speech)"),
            para("Software that converts written text into spoken audio. The system uses TTS to speak the AAC user’s selected response aloud and to deliver filler phrases while options are being generated. The initial version uses the browser’s built-in TTS; voice banking (a personalized or cloned voice) is a planned future feature."),

            heading2("Turn-Taking"),
            para("The conversational mechanism by which participants alternate between speaking roles. Turn-taking involves claiming the floor, holding it, yielding it, and redirecting it — and doing so within narrow timing windows that most communication partners unconsciously enforce. AAC users are chronically disadvantaged by turn-taking timing requirements, which is the central problem this system is designed to solve."),

            heading2("Worldview Model"),
            para("A structured, private profile of the AAC user built from three sources: the “About Me” questionnaire (facts, interests, values, and communication style, answered at the user’s own pace), the people-and-relationships graph (the people in the user’s life, their relationship types, and notes), and conversation goals (what the user wants from specific relationships and specific exchanges). The worldview model is used to personalize AI-generated response options so they reflect who the user actually is. The profile is entirely optional — no question is required, and the system is functional with a completely empty profile."),

            emptyPara(),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("Conversant AAC Product Overview.docx", buffer);
    console.log("Conversant AAC Product Overview.docx generated.");
});
