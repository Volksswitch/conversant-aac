# Question-session test

**Wait for a full set of four answers: median 7.6 s, range 4.3 to 9.5 s. Total cost 52¢ for 24 sets.**

Run 2026-10-11T22:03:21.438Z, model claude-sonnet-5-5. Documents: atob.txt (10553 words), overview.txt (12159 words).

"Copied" is the longest run of words in an answer that appears word for word in the documents. Under about 6 is ordinary; 10 or more means it is reusing the documents' wording.

## You said words per minute is the wrong thing to focus on. Can you say more about that? Most of us were trained to measure rate.

*(answered by the documents)*

### Audience: SLPs and OTs  (9.3 s, 845 output tokens, 12.27¢)

**Silence, not speed** (angle, 124 words, copied 5)

I'm not saying rate is meaningless. The numbers are real. People using eye gaze often land somewhere between ten and twenty words per minute, and comfortable conversation needs something closer to eighty. But I think the rate is a symptom. The deeper problem is that people get uncomfortable with silence very quickly. Research puts that discomfort at somewhere between one and four seconds. When the pauses run that long, partners interrupt, finish the sentence for the user, or drift away. So even a capable client with a lot to say can't hold the floor long enough to be heard. That's why I'd ask you to look at the gap between the partner's turn and the user's response, not just the speed of each word.

**What clients actually lose** (angle, 127 words, copied 0)

If we only measure rate, we only see a speed deficit. What I see is a loss of things that depend on timing. A correction has to land the moment the misunderstanding starts. A joke has to arrive when it's funny. A small comment like "me too" is only worth saying right then. When those come late, they're socially invisible. So the client gets pushed into answering questions instead of taking turns, and people come to know them mostly through their needs rather than as someone funny or thoughtful. For therapy, that suggests asking whether the client can initiate, redirect, interrupt appropriately, and repair, not just how fast they select words. I'd also say rate still matters for planning and documentation. It just doesn't capture the participation.

**Shortening the silence instead** (angle, 121 words, copied 4)

If speed isn't the whole story, then the question becomes how to keep the gap from feeling awkward. In what I'm building, the system offers a few response options within seconds of the partner finishing. A short spoken placeholder like "I'm thinking about that" holds the floor while the user chooses. The user picks with one tap, so selection is quick, but the point is that the silence is filled with something the user chose. Notice that this doesn't raise the user's words per minute much. It changes how the pause is experienced. That's the shift I'd encourage when you evaluate systems with clients: how does the partner experience the wait, and what does the client get to do within it.

**Short answer** (short, 51 words, copied 4)

Rate is real, and I'm not dismissing it. But I think the bigger barrier is that conversation partners get uncomfortable with silence after one to four seconds and start interrupting or disengaging. So even a fast-enough client can lose the floor. I'd look at timing and participation, not rate alone.

### Audience: academics  (4.3 s, 308 output tokens, 1.25¢)

**Silence aversion, not speed** (angle, 140 words, copied 5)

I'm not saying rate is irrelevant. The published numbers are real. Koester and Arthanat found about 1.7 wpm for switch scanning, and eye gaze letter selection gets people to 8 to 10, which Waller reports. Morris puts eye gaze users at 10 to 20. Comfortable conversation needs at least 80. But I think the rate gap hides what actually breaks conversation, which is how people react to silence. Koudenburg and colleagues found people in the U.S. get uncomfortable after about four seconds of silence, and Jefferson's work suggests it can be as little as one. When delays repeat, partners interrupt, finish the AAC user's sentences, or talk about them instead of to them. So a user who is fast by AAC standards can still lose the floor. To be clear, this is my argument. I haven't measured it.

## How does the device know what to suggest? Where does that come from?

*(answered by the documents)*

### Audience: SLPs and OTs  (7.6 s, 786 output tokens, 1.72¢)

**The profile I build myself** (angle, 123 words, copied 6)

A lot of it comes from a profile that the user builds over time. There's a questionnaire called About Me where you answer questions at your own pace about who you are, what you care about, how you like to come across, and what subjects you know well. No question is required, and the device works fine with a completely empty profile. There's also a record of the people in your life, with the nickname you actually use for each one, and a record of places you go. When the AI writes options, it uses those facts, so it says Mom, not Mary. For your clients, that means the people and topics in the suggestions are theirs, and nothing is guessed about them.

**What it hears right now** (angle, 121 words, copied 5)

The most immediate source is the conversation itself. The device listens to the communication partner, shows a transcript, and sends what was said to the AI whenever the partner pauses. Then it builds options around what that person actually said. It also tracks what kind of response the moment calls for. If someone asks a question, an answer is owed. If they invite you somewhere, they're expecting a yes or a graceful no. So the four options are different kinds of response: an agreeable answer, a way to decline, a new direction, and a way to ask for clarification. That comes from how real conversation is structured. Clinically, that's useful, because it models different conversational moves rather than just different words.

**Context I tell it, and goals** (angle, 131 words, copied 10 - "carry topics the user likes to talk about with them")

The user can also tell the device the situation. They tap who they're with and where they are, and the options lean toward that person and place. A person's record can carry topics the user likes to talk about with them, topics to avoid, and what the user wants from the relationship, like staying close to a sister. Those goals shape the wording, but they're never spoken out loud. Review matters too. Afterwards, the user can go back over a saved conversation and rewrite a reply the way they would have said it. The device keeps those rewrites, and uses them as examples of how that person talks, especially with that specific partner. One limit: it won't supply general knowledge on the user's behalf, only what they've told it or know.

**Short version** (short, 54 words, copied 4)

It comes from three places. The first is a profile the user builds about themselves, including their people, places, and goals. The second is what the communication partner just said. The third is the context the user taps in, plus their own rewrites from reviewing past conversations. The user always picks what gets spoken.

### Audience: academics  (6.9 s, 725 output tokens, 1.66¢)

**What the AI is given** (angle, 103 words, copied 6)

Each time the partner pauses, the app sends the AI a bundle of context and asks for response options. That bundle includes what the partner has said so far, the conversational state, meaning what kind of response the moment calls for, and my profile. The profile comes from the About Me questionnaire, the people and relationships record, and my places. The language model then generates the options fresh for that moment. Nothing is picked from a stored list. I should be precise here: this is a design I'm describing. I haven't measured how well the suggestions match what any user would actually say.

**Conversation analysis structure** (angle, 96 words, copied 5)

Part of the answer is structural rather than personal. The design draws on Conversation Analysis, the Sacks, Schegloff and Jefferson tradition. A question creates an obligation to answer, and an invitation creates an obligation to accept or decline. The app tracks those open obligations as a stack, and the AI classifies each turn. So the four options aren't four random replies. They're four kinds of move: the preferred answer, a graceful decline with an account, an initiative that takes a new direction, and a repair. The AI fills each slot with wording shaped by my profile.

**How it learns over time** (angle, 122 words, copied 5)

Personalization has a few sources. Some of it is what I tell the app directly, like my sense of humor, how I handle disagreement, and nicknames for the people in my life. Some of it is goals I set for a person, a place, or one conversation. And some of it is review. I can go back over a saved conversation and rewrite a reply the way I'd have said it. Those rewrites become examples of how I talk, kept for the person I was talking with. The app also logs facts it needed and didn't have, so I can answer them later. I should say I'm describing mechanisms, not reporting an evaluation of how closely the output matches my own voice.

**Short answer** (short, 54 words, copied 0)

It comes from the AI generating options in real time, using what the partner just said, the kind of response the moment calls for, and a profile I've built about myself, my people, and my places. I can also review conversations and rewrite replies. That's how the device learns to sound more like me.

## If the AI writes the sentences, how is that still the person's own voice?

*(answered by the documents)*

### Audience: SLPs and OTs  (7.6 s, 718 output tokens, 1.66¢)

**Speak as, not for** (angle, 114 words, copied 4)

The distinction I care about is speaking as the person versus speaking for them. The system isn't meant to hand out generic replies anyone might give. It keeps a private profile of this specific person: their interests, opinions, the people in their life, and what they want out of particular conversations. The AI shapes its wording around that, so the options sound more like them. It won't always land on their exact words, and I'd be misleading you if I said it would. That's why the person always has a way to type their own sentence instead. The profile also builds up over time, from the questionnaire and from the replies they actually pick.

**The person decides** (angle, 119 words, copied 0)

Think of it the way you'd think of a client choosing from a word prediction list or a set of carrier phrases. The AI proposes, and the person disposes. Nothing is spoken unless they select it. They also see the full text of each option before choosing, so they can reject all of them and ask for new ones, or open the typing box and say it in their own words. Even then, the AI can reword what they typed without speaking it, so the final sentence is still theirs. Every option is something they read, weighed, and chose. A spoken person does something similar when they settle for the nearest phrase to their thought in a fast conversation.

**It learns from their choices** (angle, 109 words, copied 5)

Voice also means consistency over time, and that's where review matters. After a conversation, the person can go back through it at their leisure and rewrite any reply that didn't sound like them. Those rewrites are kept, and the system reads them, along with the replies the person picked, as examples of how they talk. If they rewrite replies with a particular person, that learning applies when they're talking with that person. So a clinician could help a client build this up in therapy sessions. The person can also rehearse in a practice mode first. Over time the first option should be the one they would have chosen anyway.

**Short answer** (short, 46 words, copied 4)

The AI drafts, but the person chooses every sentence, can type their own instead, and can correct anything afterward. The system also learns their opinions, people, and way of talking, so the drafts get closer to them. It's not perfect, but the control stays with them.

### Audience: academics  (7.7 s, 758 output tokens, 1.69¢)

**Speaking as, not for** (angle, 117 words, copied 9)

The design goal is to speak as the user rather than for them. That's a claim about the architecture, and I'll be careful to say it hasn't been measured yet. The model is shaped by a profile the user builds: personality, opinions, the people in their life, and their goals in a given conversation. When a response names someone, it uses the nickname the user actually uses. Waller's concern about AAC supporting transactional rather than interactional talk is the gap I'm aiming at. I'd say the voice is the user's to the extent the profile and the feedback loop make it so. The options will not always be their exact words, and I won't pretend they are.

**The user is final arbiter** (angle, 124 words, copied 4)

Authorship here sits in selection and control, and I think that's the honest place to locate it. Nothing is spoken unless the user taps it. There are four structurally different options, including a way to decline, a way to change direction, and a way to ask for clarification, so the user isn't just choosing among variations of yes. And there's always a free-composition path, where they type their own words and the device speaks them. The AI can also be asked to reconsider around something the user typed. It treats that as true. I'd compare this to how any of us sometimes grab the nearest adequate phrase, like suggested replies when texting. The difference is that the user can tune the system afterward.

**Review, limits, open questions** (angle, 102 words, copied 6)

The tuning happens offline. The user can review a saved conversation turn by turn and rewrite what they would have said, and those rewrites become examples of how they talk, kept per partner. I'll be plain about the limits. A profile is self-reported and the system takes it at face value. It does not supply facts the user doesn't have; asked something it hasn't been told, it says it doesn't know. And I haven't measured whether users or their partners experience the output as authentically theirs. That's an empirical question, and I'd welcome researchers testing it rather than my asserting it.

**Short answer** (short, 50 words, copied 6)

The user chooses every word that's spoken, can always type their own instead, and tunes the system over time so the options sound more like them. I'd call that shaped authorship, and the claim hasn't been tested yet. Whether it's experienced as their own voice is an open research question.

## Couldn't a user just keep picking the first option to save time? Doesn't that take away their autonomy?

*(answered by the documents)*

### Audience: SLPs and OTs  (8.0 s, 879 output tokens, 1.82¢)

**Why the first pick isn't autonomy lost** (angle, 137 words, copied 4)

It's a fair worry, and I'd start by saying the temptation is real, but it isn't new. Everyone does this. When you can't quite find the word you want and the conversation is about to stall, you go with the thing that came to mind, even if it's imperfect. Texting apps already offer tap-to-send replies, and most of us use them now and then. The important point is that the user is still the one choosing. Nothing is spoken until they tap. And a quick, reasonable reply is a normal and useful part of conversation, especially with strangers and acquaintances. The difference for an AAC user is that this option now exists at all. Before, the alternative to a fast generic reply was often a long silence, or someone else finishing the sentence for them.

**Tuning so the first option fits** (angle, 139 words, copied 6)

The design goal is that the first option should be the one the user would most likely pick anyway. That's what the review loop is for. After a conversation, when there's no one waiting, the user can go back over it turn by turn and write what they would rather have said. The system uses those rewrites as examples of how this person actually talks, and keeps them for the specific person they were talking with. So over time the top suggestion drifts toward their real voice. There's also an About Me questionnaire, a record of the people in their life, and conversation goals, all shaping the wording. I'd add that the system aims to speak as the user, not for them. So picking the first option should become less of a compromise and more of an accurate shortcut.

**Safeguards that keep the user in charge** (angle, 136 words, copied 8)

There are several built-in protections. First, the four options aren't four versions of the same answer. They're structurally different: one agrees, one declines gracefully, one takes the conversation somewhere new, and one asks for clarification. The user always has a real choice of direction, not just wording. Second, those positions never move, so the user learns where each kind of response lives. Third, if none of them fits, there's a free-composition box where they can type anything and have it spoken, and a Reframe button that lets them tell the AI which way to lean. Fourth, the user can ask for new options at any time. Clinically, this is worth watching, though. I'd treat a pattern of always taking the first option as something to explore with the client, not assume it's a problem.

**Short answer** (short, 57 words, copied 0)

It's possible, and it's something worth watching with a client, but I don't think it removes autonomy. The user still chooses every word that's spoken, and they can type their own response whenever none of the options fits. The review loop also tunes the system so the first option increasingly sounds like what they'd have said anyway.

### Audience: academics  (7.9 s, 784 output tokens, 1.72¢)

**Control stays with the user** (angle, 121 words, copied 5)

It's a fair concern, and I'd separate two things. The user is the final arbiter of what gets spoken. Nothing goes out without a selection. They can ask for new options if none fit, and there's always a fallback where they type their own words. So the system can't speak for them. What it can't prevent is a user choosing a good-enough option under time pressure. But that's not unique to this design. Spoken communicators do it all the time when they grab the first workable phrase to keep a conversation from stalling. Smartphone suggested replies work the same way. The question is whether the first option is usually a good one, and that's where the shaping work comes in.

**Making the first option good** (angle, 124 words, copied 8)

The design response to that risk is to make the first option worth picking. The goal is to speak as the user, not for them. That depends on a worldview model built from the About Me questionnaire, the people and places records, and conversation goals, plus review sessions. After a conversation, the user can go back turn by turn and write what they would have said instead. Those rewrites become examples of how they talk, kept for the specific partner. So the ordering and wording get closer to the user over time. I'd be clear that this is a design claim. I haven't measured how often users accept the first option, or whether that rate changes with tuning. That would be a good study.

**Autonomy beyond option one** (angle, 109 words, copied 6)

I'd also say autonomy here is more than whether someone overrides the first option. The four categories are structurally different: an agreeing answer, a graceful decline, a new direction, and a repair. They sit in fixed positions. So the user isn't choosing among four paraphrases of the same reply. They can disagree, change the subject, or ask for clarification with one tap, and those are exactly the moves that are hardest with traditional AAC. The alternative isn't unconstrained autonomy. Waller's work and the Judge and Townend survey describe users who are mostly confined to transactional exchanges because of speed. Whether the trade is worth it is an empirical question.

**Short answer** (short, 56 words, copied 0)

It's possible, and I won't pretend otherwise. But the user still chooses every word that's spoken, can request new options, and can type their own. The design tries to make the first option more like them over time through review and rewrites. I haven't measured how often first options get picked, so that's an open question.

## What about the communication partner's privacy? The device is recording what they say.

*(answered by the documents)*

### Audience: SLPs and OTs  (6.8 s, 753 output tokens, 1.69¢)

**Where the data lives** (angle, 116 words, copied 5)

It's a fair concern, and I'd separate two things. First, where the information goes. Everything stays on the user's own device, in a folder they choose. There's no company server holding conversations. The one exception is the AI service, which receives the text of what was said at the moment it generates response options, over an encrypted connection. No cloud account holds a profile of the partner. Second, the user can tap a Don't save control, so a conversation never gets stored at all. Pressed partway through, it deletes what was already saved from that conversation. It can also be the default. That matters in a clinical setting, where partners may be talking about something sensitive.

**Telling the partner it's listening** (angle, 116 words, copied 8)

The device plays a brief, friendly sound whenever it starts listening. That's deliberate. A tablet screen faces the user, not the person across from them, so without a cue the partner might not realize a microphone is on. The sound gives them that notice without anyone having to stop and explain. I'd also say honestly that this is an area where I haven't settled every question. A saved transcript is a more durable record than a spoken person's ordinary memory of a conversation. I think that deserves further thought, and possibly clear norms, especially for staff, teachers, and clinicians who are partners. The sound and the Don't save control are the safeguards I've built so far.

**What stays out of reports** (angle, 109 words, copied 11 - "never contains anything that was said no transcripts no partner speech")

There's also the question of whether anything leaves the device for the developer. The app can send a short report about once a week, but it contains only counts and timings of how the app is being used, plus any errors. It never contains anything that was said. No transcripts, no partner speech. A transcript goes out only in a problem report that the user has read and chosen to send. The names of the people and places in the user's records are replaced with placeholders like person 1 before anything leaves the device. Reporting can be switched off entirely, and the app shows exactly what a report contains.

**Short answer on privacy** (short, 59 words, copied 7)

Conversations are stored only on the user's own device, and the user can choose not to save any conversation. The device plays a sound when it starts listening, so the partner knows the microphone is on. The text of what's said does go to the AI service to generate response options, but nothing goes to any server I run.

### Audience: academics  (6.7 s, 771 output tokens, 1.71¢)

**The consent question itself** (angle, 113 words, copied 7)

I wrote about this in the ATOB article, and I don't think it's settled. In ordinary conversation, nobody asks permission before remembering a face, a voice, or what was said. That intuition is hard to apply here, because the system would keep a durable record of the voice and face characteristics that make recognition possible, plus a very accurate record of the conversation. And that record may pass through cloud processing. I think that's different in kind from human memory. I said then that these issues deserve further thought and, if necessary, legislation. I'm not claiming the app resolves them. I'd rather say that plainly than pretend the ordinary-conversation analogy covers it.

**What the app actually does** (angle, 121 words, copied 4)

A few concrete things. Everything is stored on the user's own device, in a folder they choose. The only thing that leaves the device is the text sent to the AI provider, over an encrypted connection, when options are generated. There's a one-tap Don't Save control, so a conversation can stay off the record entirely, and if it's pressed midway, it deletes what was already saved. It can also be the default. When the microphone opens, the device plays a short sound so the partner knows it's listening, since the screen faces the user. Optional usage reports never contain what was said, and any names are replaced with placeholders. I haven't measured how partners actually react to any of this.

**Limits and open problems** (angle, 110 words, copied 7)

There are real limits. Speech recognition itself is a cloud service in the browser, so the partner's words do leave the device for transcription, and that's outside my control. If the user's data folder is synced by OneDrive or iCloud, saved conversations go there too, and the app tells the user so when the folder is chosen. Partners aren't asked for consent in the moment. And the user's own records are different from the partner's: the app keeps no stored face or voice profile of partners at this stage. Recognition is a Phase 2 idea, and that's exactly where the harder questions I raised in the article would come back.

**Short answer** (short, 47 words, copied 4)

It's a real concern and I don't think it's resolved. The app keeps data on the user's device, offers a one-tap Don't Save, and plays a sound when it listens. But speech recognition is a cloud service, and I haven't studied how partners feel about it.

## Does this only work for people who can read?

*(answered by the documents)*

### Audience: SLPs and OTs  (7.1 s, 753 output tokens, 1.69¢)

**Yes, literacy is required now** (angle, 113 words, copied 6)

Right now, yes. The first version is built for people who can read, because the response options show up as written text and the user has to read them and judge which one fits. I'd rather be plain about that than oversell it. So for a client who isn't yet literate, this version isn't the right fit. The design isn't locked to reading, though. The same four-category structure, the fixed screen positions, and the one-tap selection could be carried by other kinds of output. Nothing about the conversation logic itself depends on reading. It's just where I started, because that's where a working proof of concept helps the most people soonest.

**Ways it could reach non-readers** (angle, 129 words, copied 4)

There are a few routes I can see, though none of them are built yet. One is auditory. The options could be read aloud to the user, similar to auditory scanning, so they listen and then choose. Another is reading level. Language models are good at restating the same idea at a simpler grade level, so a user with limited reading could get shorter, easier wording. And a third is pictures. The options could be shown as symbols from a standard or personal graphic set, which would open this up to pre-literate users. I'd want to be careful, though. These are directions the system was designed to allow, not features a clinician could set up today. They'd also need testing with real users before I'd say they work.

**Why literacy matters for control** (angle, 112 words, copied 7)

There's a reason reading matters beyond convenience. The whole idea is that the user stays in charge of every word spoken. They read the options, decide which one sounds like them, and tap it. If a client can't evaluate the options, that safeguard gets weaker, and I don't want the device speaking things they haven't really chosen. That's why the first version asks for literacy along with the other criteria: adult age, legal capacity, and direct selection by finger, stylus, or an eye gaze or head-tracking pointer. Widening it to other literacy levels is a goal, but I'd rather do it in a way that keeps the user's real control intact.

**Short answer** (short, 43 words, copied 5)

Right now, yes. The first version shows its response options as written text, so the user needs to be able to read them. It's designed so that spoken options, simpler wording, or picture symbols could be added later, but those aren't built yet.

### Audience: academics  (7.7 s, 816 output tokens, 1.75¢)

**Literacy is required now** (angle, 123 words, copied 5)

Yes, right now it does depend on literacy, and I'd rather say that plainly. The first version is designed for adults who can read the response options on screen and judge them. The system shows the partner's transcript and the choices as text, so a user who can't read can't evaluate what the device is about to say in their name. That matters to me because the user is the final arbiter of every word. So literacy isn't incidental to the design. It's a stated criterion for the initial profile, along with being a non-speaking adult with legal capacity who can use direct selection. I'd call it a limit of the current build rather than a claim about who could ever benefit.

**Beyond text: auditory and pictographic** (angle, 130 words, copied 6)

The architecture isn't tied to text, though, and I think that's the more interesting research question. In the 2024 ATOB paper I suggested two extensions. One is auditory presentation, where the options are spoken to the user in order of likelihood, much like auditory scanning. The other is having a large language model render the partner's speech and the suggested responses into pictographic form, using a standard or personal symbol set, which could reach preliterate users. Current models also restate concepts at a different grade or Lexile level, which could match output to reading ability. I want to be careful here. These are proposals, not features, and none of them has been built or tested. Symbol and pictographic support is on the longer-term roadmap, not in the current system.

**What literacy enables, and its limits** (angle, 122 words, copied 0)

It's worth separating two things that literacy does here. Reading the options lets the user evaluate them, and the keyboard fallback gives access to the whole language, though at the slow rates the literature documents. Koester and Arthanat found about 1.7 words per minute for switch scanning, and eye gaze letter selection reaches roughly 8 to 10. The design tries to take most of that effort out of real time. The user mostly picks among a few generated options and does the effortful shaping offline, afterward. For a preliterate user, the open question is whether symbol-based options can carry the same conversational moves, like declining, redirecting, or repairing. I don't have evidence on that yet, and I wouldn't claim to.

**Short answer** (short, 35 words, copied 0)

Currently, yes. The first version assumes an adult who can read the options and choose among them. Spoken options and symbol-based options are feasible extensions I've proposed, but they haven't been built or tested.

## How would I start a client on this? What does a first session look like?

*(partly covered)*

### Audience: SLPs and OTs  (8.7 s, 970 output tokens, 1.91¢)

**Start with Practice Mode** (angle, 156 words, copied 10 - "separates problems with the app from problems with the room")

I'd begin in Practice Mode, because it takes the other person out of the room. The AI plays the communication partner, so there's no microphone, no one waiting, and no pressure on your client. They can learn the flow the way they'll use it later: the partner speaks, a placeholder phrase holds the floor, four options appear, they tap one, and the device speaks it. There's a guided tour scenario that walks through each control. I'd stay with that for a while, because the screen is built so nothing ever moves. The four response positions stay fixed, and that only pays off through repetition. Practice is where repetition is free. It also separates problems with the app from problems with the room, since no microphone is involved. Once that feels automatic, you can rehearse a real upcoming situation, like a doctor visit or ordering coffee, and make a copy of a scenario to fit your client.

**Setup and access check** (angle, 149 words, copied 4)

Before the first session, I'd check a few practical things. Your client needs to be literate, an adult with legal capacity, and able to direct a pointer. A finger, stylus, trackball, or eye gaze set to mouse mode all work. The app runs in a browser on a Windows tablet, Chromebook, Mac, or iPad using Safari, so nothing gets installed. Your client or family creates their own AI account and key, and the app has a connection test to confirm it was entered correctly. I'd also set the touch target and text sizes to what your client needs, and choose a color scheme. If they use a keyguard, the layout is designed to line up with one. I'd mention that the app doesn't have switch scanning yet, so it won't suit someone who can't drive a pointer. Everything is stored on the device, so privacy is also worth explaining.

**Build the About Me profile** (angle, 150 words, copied 12 - "what they care about how they like to express themselves and what")

The About Me questionnaire is a good thing to start across sessions, and you can do it together. It's self-paced, no question is required, and the app works with a completely empty profile, so there's no pressure to finish. It asks who the person is, what they care about, how they like to express themselves, and what subjects they know well. That last answer matters, because it's what lets the app give real detail on those topics. I'd also add the people in their life, with the nicknames they actually use, like Mom rather than Mary. Then add a few places and a couple of Express Panel phrases. This is also good clinical information for you, since you learn what the client wants to say and who matters to them. Over time the app also flags questions real conversations turned out to need, so the profile grows from use.

**Short version** (short, 56 words, copied 4)

I'd start in Practice Mode, where the AI plays the conversation partner. There's no microphone and no pressure, so the client can learn where things are and build the habit of tapping. Once that feels easy, add a few details to the About Me profile, then rehearse a real upcoming situation before trying a live conversation.

### Audience: academics  (7.3 s, 916 output tokens, 1.85¢)

**Start with Practice Mode** (angle, 137 words, copied 10 - "separates problems with the app from problems with the room")

I'd start with Practice Mode, not a live conversation. In practice, the AI plays the other person, so there's no microphone involved and nobody's patience is being tested. The first real conversation matters a lot, because it's when someone decides whether this will work for them, and it shouldn't also be when they're learning where the buttons are. The app ships with six scenarios, and the first is a guided tour of the controls. I'd run that first. Practice Mode uses the same controls as a real conversation, so what gets learned transfers directly. It also separates problems with the app from problems with the room or the connection. I should say I'm describing how the design intends it to be used. I haven't measured outcomes from first sessions, so this is a design rationale, not evidence.

**Setup and About Me** (angle, 149 words, copied 10 - "a format check and a one tap connection test to")

Before any practice, there's setup. The client needs their own account with an AI provider, and a key, since the app has no server. The app has a format check and a one-tap connection test to confirm the key was entered right. Then I'd open the About Me questionnaire, but I wouldn't try to finish it. No question is required, and the app works with a completely empty profile. It fills in over time, and later it surfaces the questions real conversations turned out to need. I'd add a few people the client talks to most, with the nicknames they actually use. Then I'd do one thing that's easy to skip: confirm what subjects they say they know a lot about, because that list controls what the app will answer in depth. I'd also set the text and touch target sizes, and check how they access the screen.

**Fit, access, and limits** (angle, 135 words, copied 12 - "dwell time is set on the tracker not in the app and")

A first session is also where I'd check fit against the criteria the app was built for. The client should be literate, an adult with legal capacity, and using direct select. That can be a finger, a stylus, a trackball, or an eye gaze or head-tracking device in mouse emulation mode with dwell. Dwell time is set on the tracker, not in the app, and an eye-gaze user should leave the one-tap-or-two setting off. The app has no switch scanning yet, so someone who can't drive a pointer isn't a fit today. On iPad it has to be Safari. Hearing the partner needs internet either way. I'd also watch whether gaze-driven use pulls attention off the partner's face. That's a concern I'd want observed, and I haven't measured it.

**Short version** (short, 61 words, copied 4)

Set up their AI account and key, fill in a few people and facts in About Me without trying to finish it, then run the guided tour in Practice Mode. No microphone, no real partner, same controls as a live conversation. Move to a real, low-stakes conversation once the layout feels automatic. That's the design rationale, not a measured protocol.

## What happens when there's no internet, like in a school with restricted Wi-Fi?

*(partly covered)*

### Audience: SLPs and OTs  (6.4 s, 706 output tokens, 1.65¢)

**What still works offline** (angle, 121 words, copied 7)

The part that fails is the AI that writes the response options, and that's the only part. If the connection drops, a client can still see what their partner said on screen. They can still use the Express Panel of quick phrases and the on-screen keyboard to type anything and have it spoken. Everything they say is recorded exactly as it normally would be. So the device doesn't go dead. It falls back to being a capable manual communication tool, and the fast path comes back as soon as the connection does. The device also signals the problem quietly, with a faint color cue on the transcript, rather than throwing up an error message in the middle of a conversation.

**The speech recognition caveat** (angle, 96 words, copied 7)

There's one limit I should be honest about. Hearing the other person also depends on the internet, because the speech recognition itself is a cloud service. That comes from the browser technology the app runs on, not from the AI feature. So in a school that blocks the connection, the app can't listen to the partner either. A client could still type or tap what they want to say. For a therapist, this means testing the actual classroom before you count on it, rather than assuming it will behave like a clinic with open Wi-Fi.

**Planning for restricted networks** (angle, 103 words, copied 4)

Restricted school Wi-Fi is a real concern. The app needs to reach the AI provider over the internet to generate response options, and a locked-down network can block that. I've noted that school settings, where access is more controlled, may be a problem. It's worth talking with the school's IT staff early, and the Express Panel is worth setting up carefully as the fallback. Phrases for that client's usual classroom exchanges can be one tap away, so they're never left with nothing. Practice Mode could also help for rehearsing situations, though it still needs the AI connection to play the partner.

**Short answer** (short, 50 words, copied 7)

Without internet, the AI response options go away, but the device doesn't stop working. The client can still use the Express Panel of quick phrases and type anything to be spoken. Hearing the partner also needs the internet, so it's worth testing in the actual school before relying on it.

### Audience: academics  (8.1 s, 839 output tokens, 1.77¢)

**What still works offline** (angle, 145 words, copied 10 - "down the user can still see what the partner said")

The design treats the AI as a layer on top of a manual core, not as a lifeline. If the connection drops, the key is missing, or the provider is down, the user can still see what the partner said, with the transcript styled differently so it's clear the AI isn't responding. They can still speak from the Express Panel of quick phrases, and they can still type anything into the composition box and have it spoken. Whatever they say is recorded just as it would be if the AI had written it. What disappears is only the AI-generated response options, and only until the connection comes back. So the device degrades to a capable manual AAC tool rather than failing outright. I'd be careful, though. That is how the system is built. I haven't measured how users actually fare in that degraded state.

**The speech recognition caveat** (angle, 100 words, copied 7)

I want to be precise about one limit. Recognizing what the partner said still needs the internet, because the browser's speech recognition is itself a cloud service. That's a constraint of the underlying browser technology, not of the AI feature. So with no connection, the app can't hear the partner at all, which matters more than losing the response options. The user falls back on the Express Panel and typed composition, which is a real loss for the core goal of real-time conversation. I'd call that an open limitation, and I haven't tested how it plays out in practice.

**School networks and where this goes** (angle, 138 words, copied 6)

In my 2024 ATOB article I flagged this directly. Architectures that depend on the cloud need internet access, and a school setting, where access is more tightly controlled, may be a problem. I also noted that mobile broadband like 5G would probably give enough capacity, which could route around a restricted school network, though that's my expectation, not something I've tested. The current build is a browser app that sends requests to the AI provider, and a school filter could block that. On local models, I think running them on the device is a longer-term possibility as hardware improves and models get smaller. I don't expect local models to match cloud quality soon, and that isn't part of the near-term plan. I haven't written about a specific school deployment, so I'd rather not guess at one.

**Short answer** (short, 65 words, copied 4)

The AI response options need a connection, but the core doesn't fail completely. The user can still type and speak, and use the Express Panel quick phrases. One real caveat: recognizing the partner's speech is also a cloud service, so offline the device can't hear them. I flagged school internet restrictions as a concern in my article, but I haven't tested a specific school setup.

## You mentioned eye gaze. Would this work for my clients who use switch scanning?

*(partly covered)*

### Audience: SLPs and OTs  (7.2 s, 741 output tokens, 1.68¢)

**Not yet, plainly** (angle, 124 words, copied 12 - "has no switch scanning yet nothing in it steps through the choices")

Honestly, no, not today. The app is built for direct select, meaning the person points straight at what they want, whether that's a finger, a stylus, a mouse, or an eye gaze or head-tracking system that moves the pointer and selects by dwelling. It has no switch scanning yet. Nothing in it steps through the choices automatically for a client who activates a switch at the right moment. So for your clients whose primary access is scanning, it isn't usable as it stands. I'd rather tell you that clearly than have you set a client up and watch it fail. The design leaves room for scanning to be added without rebuilding the system, and it's on the roadmap, but it doesn't exist today.

**Who it does suit now** (angle, 116 words, copied 7)

The dividing line is whether a client can drive a pointer by any means. If someone can reach a screen with a finger, or use a trackball, head tracker, or eye gaze system set to mouse emulation, the app works with them without special configuration. That likely includes some of your clients who use scanning now only because it's what they were given, so it may be worth revisiting their access options. For a client who truly can't direct a pointer and depends on a single switch, it isn't a fit yet. The first version is also aimed at adults who are literate and can read the response options, so that's a second thing to check.

**What scanning would involve** (angle, 96 words, copied 4)

The conversation loop gives a sense of why scanning is harder here than it sounds. The whole point is to fill the silence within a few seconds, because research suggests partners get uncomfortable after one to four seconds. Scanning through four, or eight, options takes time, and that works against the goal. The fixed screen positions, where nothing ever moves, are a good foundation for scanning later. But I haven't designed or tested a scanning method, so I can't say how well it would hold up at conversational speed. I'd be guessing, and I'd rather not.

**Short answer** (short, 46 words, copied 4)

Not yet. The app needs the person to point at the screen by some means, including eye gaze or a head tracker acting as a mouse, but it has no switch scanning today. It's planned and the design allows for it, but it doesn't exist yet.

### Audience: academics  (7.7 s, 799 output tokens, 1.74¢)

**Not yet: no scanning built** (angle, 113 words, copied 10 - "set up to move the pointer and click by dwelling")

Not today. The app is built for direct selection, and that includes eye gaze or head tracking when the device is set up to move the pointer and click by dwelling. It sees those as ordinary pointer input. Switch scanning is a different thing. Nothing in the app steps through the choices automatically, so a client who can't direct a pointer at all can't use it yet. I'd rather say that plainly than overstate it. Scanning is on the roadmap, and the design was set up so it can be added without rebuilding the system. But it isn't built. For clients on scanning, it's a future possibility and not something to trial now.

**Why scanning is hard here** (angle, 143 words, copied 4)

There's a design reason I haven't just bolted it on, and I want to be careful about what I claim. The whole interface rests on spatial stability. Four response categories sit in fixed positions, the controls never move, and the idea is that users build motor planning over time. Scanning changes that picture. A scanned interface has to step through items in sequence, and the cost of each step adds up fast against the timing problem I described. Silence over a few seconds is where partners disengage. I haven't measured how scanning would perform in that window, so I can't say whether it works. In my paper I cite scanning rates for a switch with an on-screen keyboard at around 1.7 words per minute. Choosing among a few options is much lighter than that, but I don't have data for it.

**What a scanning user might gain** (angle, 115 words, copied 4)

The reason I care about it is that this is the group with the most to gain. The paper's argument is that the user's real-time load drops from constructing words to choosing among three to five options. For someone on scanning, that's a very large reduction in effort per turn. So I do expect the approach to be relevant to your clients in principle. But that's my expectation, and nobody has tested it. I'd like to see how it holds up. It would need research with scanning users, and I'd welcome people who work with these clients helping shape how a scanning mode should behave, since I'm not a clinician or AAC researcher myself.

**Short answer** (short, 48 words, copied 5)

Not yet. The app works with eye gaze or head tracking when it's moving the pointer, because it's built for direct selection. Switch scanning isn't built. It's on the roadmap and the design allows for it, but I can't tell you today that it works for your clients.

## Is there any research yet showing this improves outcomes for AAC users?

*(not covered)*

### Audience: SLPs and OTs  (7.0 s, 741 output tokens, 1.68¢)

**No outcome studies yet** (angle, 108 words, copied 0)

No, not that I know of. I haven't written about any study showing that this improves outcomes, and I won't claim one exists. What I have is a design argument, not evidence from clients. The argument rests on existing research: AAC users tend to stay in transactional communication, and long silences make partners uncomfortable, so they interrupt, finish sentences, or disengage. The idea is that offering response options within a few seconds closes that gap. That is a hypothesis, and it needs to be tested. I'd welcome clinicians and researchers who want to do that, especially with measures like participation in conversation, turn-taking, and how partners respond.

**What the argument rests on** (angle, 105 words, copied 4)

What I can point to is the research behind the problem, not research on the solution. The literature describes how AAC users rarely move beyond expressing needs and wants into real interactional conversation, how typical selection rates run far below conversational speech, and how people become uncomfortable after only a few seconds of silence. The system was built around those findings, including the placeholder phrases that hold the floor while the user chooses. So the design is grounded in evidence about why conversation breaks down. But grounding a design in research is not the same as showing it works. That second step hasn't happened yet.

**How you could test it** (angle, 107 words, copied 4)

If someone wanted to study this, the app saves conversations with timing, the options offered, and what the user chose, so there is data to work from. It's free and open source, and the person needs no training beyond learning the screen. Practice Mode lets a user rehearse without a live partner, which could help with a baseline or a pilot. I'd think about outcomes that matter clinically: how often the user initiates, how long they wait before responding, whether partners interrupt less, and whether the user feels more like themselves in the conversation. I'm not a researcher, so I'd want an SLP involved in designing it.

**Short answer** (short, 49 words, copied 0)

No, there isn't any outcome research yet, and I won't pretend otherwise. What exists is research on why conversation breaks down for AAC users, which the design is built around. Testing whether it actually helps is the next step, and I'd welcome clinicians who want to take it on.

### Audience: academics  (9.5 s, 1006 output tokens, 1.94¢)

**No outcome data yet** (angle, 146 words, copied 4)

Not that I've written about. What I have is a design argument built on the existing literature, not a measured result. The piece draws on Waller's work showing AAC users rarely move from transactional to interactional communication, on Judge and Townend's survey of abandonment factors, and on the rate figures from Koester and Arthanat and from Morris. I've also cited Noy and Zhang, and Bowles and Kruger, for productivity gains from generative AI in other professions. I'd call that supporting context, not evidence for AAC users. I haven't reported a trial, a comparison against existing devices, or any user-outcome measurement. So the claim is a prediction, and I'd want it read as one.

What's testable is fairly clear. Conversation rate and turn-taking, partner behavior like interruption and sentence completion, and whether users move toward interactional exchange are all measurable. I haven't done that work.

**What the cited research supports** (angle, 135 words, copied 5)

The part I can point to is the problem description, not the solution. Koudenburg and colleagues found discomfort setting in after about four seconds of silence, and Jefferson put the standard maximum nearer one second. Waller's 2006 and 2019 papers document the transactional limit. Koester and Arthanat report around 1.7 words per minute for switch scanning, and eye gaze is typically 10 to 20, so well below conversational rates. Those are measured findings, and they motivate the design.

What I haven't got is a measurement showing that offering AI-generated response options changes any of those outcomes for users. The mechanism is plausible and the early demonstration was a simulation in ChatGPT 3.5, not a study. I'd separate the documented barrier, which is solid, from the proposed remedy, which is untested by me.

**What a study would need** (angle, 138 words, copied 4)

If someone wanted to test this, I'd suggest a few things. First, measure the outcomes the literature already cares about: words per minute, response latency, how often partners interrupt or finish the user's sentences, and the shift from transactional to interactional talk using Waller's distinction. Second, compare against the participant's existing system, not against nothing.

There are real confounds to watch. The response options are written by a model, so a user choosing among them is a different task from composing, and a faster rate might hide a loss in how closely the speech matches what they'd have said. That's the autonomy question I raise in the piece, and it needs measuring, not assuming. I'd also want the reliability of the AI options reported openly. I haven't run any of this, and I'd welcome researchers who want to.

**Short answer** (short, 55 words, copied 0)

No, not from me. I haven't run a study or collected outcome data. What I've done is argue from the existing literature, like Waller, Koudenburg, and Koester and Arthanat, that the barrier is real, and I'm proposing a design to address it. Whether it improves outcomes is an open question I'd like to see tested.

## What does it cost a family per month?

*(not covered)*

### Audience: SLPs and OTs  (6.7 s, 777 output tokens, 1.71¢)

**Free app, pay-as-you-go AI** (angle, 121 words, copied 8)

The app itself is free. There's no subscription, no license, and no waiting list, and the code is open source. What a family pays for is the AI, and only for the conversations the person actually has. Each user sets up their own account with the AI provider and enters their own key, so the bill goes straight to them from the provider. I'd describe it as a small fraction of a cent per exchange. I haven't written down a firm monthly dollar figure, because it depends entirely on how much someone talks. Someone using it a few times a day will spend very little, and a heavy user will spend more. If the family isn't using it, they aren't paying.

**Optional paid voice and hearing** (angle, 120 words, copied 12 - "a more natural sounding voice than the ones built into the device")

There are two optional extras, and neither is needed to start. The first is a more natural-sounding voice than the ones built into the device. That's billed by the amount spoken, at a few cents per hour of conversation. The second matters on Android, and on an iPad running from the Home Screen. In those cases the device's own speech recognition can't be used, so hearing the communication partner requires a paid transcription service, billed by the minute of speech. That works out to roughly 36 cents to a dollar per hour of speech, depending on the company. On an iPad opened in Safari, hearing the partner is free. Both extras are off unless the family turns them on.

**Why there's no ongoing fee** (angle, 118 words, copied 5)

This was a deliberate design decision. Earlier attempts at AI-driven AAC have been shelved when the funding ran out, because the project was paying for computing on behalf of every user. This app has no server behind it. It runs as a web application, and each user brings their own AI account. That means the project has no running costs, so there's nothing that can be defunded and nothing that forces a subscription later. For a family, the practical effect is that the cost tracks actual use. It also means someone has to help them set up the account and key at the start, which is a good job for the clinician or a tech-comfortable relative.

**Short answer on cost** (short, 51 words, copied 8)

The app is free and open source, with no subscription. The family pays the AI provider only for the conversations actually held, which is a small fraction of a cent per exchange. A nicer voice, or paid transcription on Android and a Home Screen iPad, are optional extras billed by usage.

### Audience: academics  (7.2 s, 817 output tokens, 1.75¢)

**No subscription, pay per use** (angle, 129 words, copied 8)

There's no subscription and no fee for the app itself. It's free and open source, and it runs in a web browser with no server behind it. The user sets up their own account with an AI provider, starting with Anthropic's Claude, and pays that provider directly for the conversations they actually have. I've written that this works out to a small fraction of a cent per exchange. But I haven't measured a typical monthly bill, so I won't give you a dollar figure for a month. It depends on how many exchanges a person has. What I can say with confidence is that the project has no ongoing cost to pass along, and that's deliberate, because server-funded AAC projects have been shelved when the money ran out.

**Optional paid voice and transcription** (angle, 130 words, copied 19 - "is available on any device billed by the amount spoken at a few cents an hour of conversation on")

The optional add-ons are where cost can grow. A more natural-sounding voice is available on any device, billed by the amount spoken, at a few cents an hour of conversation. On an Android device, or an iPad running from the Home Screen, the device's own speech recognition can't be used, so hearing the communication partner needs a paid transcription service. That's roughly 36 cents to a dollar per hour of speech, depending on the company, and only while someone is talking. Five companies can supply either service. Both capabilities are off by default, and the app works without them. On an iPad in Safari, recognition is free. So the monthly cost depends a lot on which device the family uses and whether they pay for a better voice.

**Hardware and what I can't price** (angle, 105 words, copied 4)

The running cost is separate from the hardware. The app needs a Windows tablet or laptop, a Chromebook, a Mac, an iPad, or an Android device, and I haven't priced any of that. I've recommended the Microsoft Surface for portability, but I'm not making a cost claim there. There's also no licence, subscription or waiting list for the software. One caveat for this audience: the per-exchange and per-hour figures are the ones I've written down for the services. They aren't from a field study of real families' bills. A monthly figure from actual use is something I'd want to collect before stating one.

**Short answer on cost** (short, 56 words, copied 8)

The app is free, with no subscription. A family pays their AI provider directly, and I've written that it's a small fraction of a cent per exchange. A better voice or paid transcription are optional extras, billed by usage. I don't have a measured monthly total from real use, so I won't give you a figure.

## Is this covered by Medicaid or insurance?

*(not covered)*

### Audience: SLPs and OTs  (5.8 s, 654 output tokens, 1.59¢)

**Not something I've researched** (angle, 98 words, copied 0)

I haven't written about Medicaid or insurance coverage, so I don't want to guess at it. I know funding is a huge part of your day-to-day work, and I'd rather tell you I don't know than give you something you might repeat to a client and later find out was wrong. What I can say is that this is a different kind of thing than a dedicated speech-generating device, so I wouldn't assume the usual device funding pathways apply. If you're looking at it for a specific client, I'd check with your funding contacts directly.

**What it costs to run** (angle, 98 words, copied 17 - "pays only for the conversations they actually have typically a small fraction of a cent per exchange")

What I can tell you is how it's set up, because that's relevant to the funding question. The app itself is free and open source. There's no license and no subscription. The user creates their own account with an AI provider and pays only for the conversations they actually have, typically a small fraction of a cent per exchange. There are two optional paid add-ons, a more natural voice and paid speech recognition, both billed by usage. So the ongoing cost is small and tied to use, but whether any payer would cover it, I don't know.

**Hardware and who it's for** (angle, 90 words, copied 5)

The other piece is the hardware. It runs in a web browser on a Windows tablet or laptop, a Chromebook, a Mac, an iPad using Safari, or an Android device. I recommend a Microsoft Surface for portability, but an iPad works too. So a client might already own a device that runs it. It's also designed for adults who are literate, who use direct select, and who have legal capacity. I haven't looked at how any of that would fit payer rules, so that's a question for your funding specialists.

**Short answer** (short, 49 words, copied 4)

I don't know. I haven't written about Medicaid or insurance coverage. What I can say is that the app is free and open source, and the user only pays a small usage fee to their AI provider. Whether any payer would cover that, I'd leave to your funding contacts.

### Audience: academics  (7.9 s, 836 output tokens, 1.77¢)

**Cost model, no funding** (angle, 137 words, copied 9)

I haven't written about Medicaid or insurance coverage, so I don't want to guess at what any payer would do. What I can speak to is how the app is built to be paid for. The application itself is free and open source, with no license and no subscription. There's no server for me to fund, so nobody has to subsidize it for the rest of the users. The person supplies their own AI provider account and API key, and they're billed directly for the conversations they actually have. I describe that as typically a small fraction of a cent per exchange, though I haven't published a measured cost study. So the funding question is different from a dedicated device. There's nothing to prescribe or reimburse. The recurring cost is a usage fee to the AI provider.


**Hardware and optional extras** (angle, 130 words, copied 11 - "on android and on an ipad running from the home screen")

The software side is free, but there are two other cost pieces, and I'd rather be clear about both. First, hardware. The app runs in a browser on a Windows tablet or laptop, a Chromebook, a Mac, an iPad, or an Android device. I recommend a Microsoft Surface for portability, but I haven't looked at whether any of that hardware could be funded, and I haven't researched how a payer would classify it. Second, there are two optional paid services: a more natural voice, and cloud speech recognition. Speech recognition is needed on Android and on an iPad running from the Home Screen. Both are billed by usage, and both are off unless the user turns them on. Whether any of that is reimbursable is a question I haven't studied.


**Where I can't speak** (angle, 111 words, copied 4)

I'll be plain about the limits of what I know. I haven't written about reimbursement, and I haven't looked into how Medicaid, Medicare, or private insurers treat this kind of software. A dedicated speech-generating device usually goes through a formal evaluation and a funding process, but that's a different pathway, and I can't tell you how a free browser-based app with a user-supplied AI key would fit into it. I also haven't published outcome data that a funder would want to see. I'd suggest asking an SLP who does funding evaluations, and I'd be glad to hear what a payer would need to see from research like ours.


**Short answer** (short, 52 words, copied 4)

I don't know, and I haven't written about it. The app is free and open source, so there's no purchase to cover. The user pays only a small usage fee to their own AI provider, plus hardware they may already own. How a payer would treat that is something I haven't researched.
