# Question-session test

**Wait for a full set of four answers: median 7.2 s, range 2.3 to 9.3 s. Total cost 53¢ for 24 sets.**

Run 2026-11-09T01:21:15.765Z, model claude-sonnet-5-5. Documents: atob.txt (10548 words), overview.txt (12517 words).

"Copied" is the longest run of words in an answer that appears word for word in the documents. Under about 6 is ordinary; 10 or more means it is reusing the documents' wording.

## You said words per minute is the wrong thing to focus on. Can you say more about that? Most of us were trained to measure rate.

*(answered by the documents)*

### Audience: SLPs and OTs  (8.4 s, 772 output tokens, 11.94¢)

**Silence is the real barrier** (short, 68 words, copied 5)

I'm not saying rate is meaningless. Clients who type ten to twenty words a minute are far below what conversation needs, and that gap is real. But I think the deeper problem is the silence. Most people get uncomfortable after one to four seconds of quiet, so partners interrupt, finish the sentence, or drift away. Faster output doesn't fix that, so I tried to fill the gap instead.

**What the numbers do show** (angle, 96 words, copied 0)

I'd keep the measurement. Typical conversation runs around a hundred twenty to a hundred fifty words a minute, and I'd call about eighty the floor for comfortable exchange. Someone using eye gaze usually averages ten to twenty, so the shortfall is large. Even a fifty to a hundred percent improvement from prediction or abbreviation only gets a person to fifteen or twenty. That's why I don't think rate work alone will close the gap. The measure is accurate. What I question is whether it captures what actually breaks down when your client talks with a stranger.

**Why silence breaks conversations** (angle, 102 words, copied 9)

Research on turn-taking finds that normal pauses between speakers last a fraction of a second, and people start to feel uneasy after as little as one to four seconds of quiet. When a client needs ten seconds to build a reply, the partner isn't being unkind, they're reacting to that discomfort. They finish the sentence, answer for the person, or turn to someone else. The client ends up answering questions rather than taking part. Notice that this happens even when the client is articulate and has plenty to say. Rate doesn't explain it. Timing and the partner's tolerance for waiting do.

**What I did about it** (angle, 100 words, copied 6)

Rather than trying to make typing faster, I tried to shorten the silence. When the partner stops talking, the system generates four kinds of reply within a few seconds, and the user taps one. While that happens, the device says a short neutral phrase, something like I'm thinking about that, so the floor is held. The user controls the timing and can turn those phrases off. For your clients, the aim is that a stranger at a counter never hits that four-second wall. I should say I haven't tested this with clients, so I can't give you outcome data.

### Audience: academics  (9.3 s, 890 output tokens, 1.81¢)

**Silence matters more than rate** (short, 68 words, copied 4)

I'm not saying rate is irrelevant. The numbers are real: eye gaze users average ten to twenty words per minute, and comfortable conversation needs something like eighty. But I think the deeper problem is how people react to silence. If a partner gets uncomfortable after a second or a few seconds of quiet, then even a faster device doesn't fix the conversation unless the gap itself is handled.

**The silence research** (angle, 125 words, copied 4)

The work I lean on is conversation research. Jefferson in 1989 proposed that the standard maximum silence in conversation is about one second. Koudenburg and colleagues in 2011 found people in the United States report discomfort after around four seconds. Typical turn-taking gaps are a quarter to half a second. So the tolerance window is tiny, and an AAC user who needs eight or ten seconds is outside it no matter how that time is spent. When delays repeat, partners start to interrupt, finish the user's sentences, or talk about the user instead of to them. That's the pattern I'm pointing at. I'll say plainly that I'm an engineer, not a conversation analyst, and I'm building on their findings rather than adding my own.

**Why rate alone falls short** (angle, 119 words, copied 5)

Look at what the rate numbers show. Koester and Arthanat reviewed switch scanning and found about 1.7 words per minute. Eye gaze letter selection gets around eight to ten, according to Waller. Prediction and abbreviation expansion can improve that, but a fifty to one hundred percent gain on a base of ten still lands at fifteen to twenty. That's still far below conversation. So even strong rate improvements leave the gap. And words per minute is a measure of production, not of whether the exchange feels like conversation to the partner. A rough calculation I use is that holding eighty words a minute leaves about a quarter second to choose each word. That's the scale of the mismatch.

**What I did about it** (angle, 119 words, copied 5)

The design goal changed from typing faster to filling the silence with something real. When the partner pauses, the system generates a few response options within seconds and the user taps one. In the meantime a short placeholder like "I'm thinking about that" holds the floor, so the gap stays inside that one-to-four-second window. I should be clear about the status of this. That's a design rationale built on the silence research, and I haven't measured it. What I can say is that the approach moves the work from constructing words to choosing among options. Whether it produces better conversational outcomes, and how you'd measure that beyond rate, is something I'd welcome this room's help on.

## How does the device know what to suggest? Where does that come from?

*(answered by the documents)*

### Audience: SLPs and OTs  (6.4 s, 718 output tokens, 1.67¢)

**Short answer** (short, 55 words, copied 5)

The suggestions come from a generative AI language model. It writes the response options fresh, in a few seconds, from three things: what the partner just said, what the user has told the device about themselves, and the situation they're in. The user always makes the final choice, and nothing is spoken until they tap.


**What it hears** (angle, 129 words, copied 6)

The first source is the conversation itself. The device listens to the communication partner, turns the speech into text, and shows that text on screen so the user can see what was heard. Each time the partner pauses, it sends what's been said so far to the AI. If the partner keeps talking, the options update. It also keeps track of what kind of reply the moment calls for. A question expects an answer. An invitation expects an accept or a decline. So the four options are four different kinds of reply: a natural agreeable answer, a graceful way to decline or push back, a new direction the user could take, and a way to ask for clarification. Each kind always sits in the same spot on the screen.

**What it knows about the user** (angle, 121 words, copied 6)

The second source is the user's own profile. There's a self-paced questionnaire called About Me, where they answer questions about who they are, what they care about, and how they like to come across. No question is required, and the device works with an empty profile. There's also a private record of the people in their life, with the nicknames they actually use, and a record of places they go. They can also set goals, like staying close to a sister. All of it stays on their device. It only goes to the AI at the moment options are generated. When the AI needs a fact it doesn't have, that gets logged as a question the user can answer later.

**Where it stops, and learning** (angle, 95 words, copied 6)

The device doesn't invent facts about the user or supply general knowledge on their behalf. If it hasn't been told something, the option says so rather than guessing. If the AI misses, the user can type their own words and have the device speak those instead. They can also review saved conversations afterward and rewrite replies the way they would have said them. The device uses those rewrites as examples of how this person talks, kept for the specific person they were talking with. The goal is to speak as the user, not for them.

### Audience: academics  (8.2 s, 865 output tokens, 1.82¢)

**Short answer** (short, 67 words, copied 5)

A generative AI language model writes the suggestions fresh each time. It's given what the partner just said, plus what the user has told the system about themselves, their relationships, and what they want from the conversation. The user picks one, and nothing gets spoken without that tap.

The AI knows a lot about language. It knows about this particular person only what the user has supplied.

**What goes into each prompt** (angle, 118 words, copied 8)

Each time the partner pauses, the system sends the transcript of what was said to the AI, along with context. The context includes the user's profile, the people and places they've recorded, and any goals they've set. It can also include where the user is and who they're with, if they've tapped those.

I'll be careful here, because this is a design description, not something I've measured. I haven't evaluated how well the suggestions match what users would actually say. The architecture is that a large language model, which is the same kind of system as ChatGPT, generates the options from that context. It isn't picking from stored phrases. It's the prompt shaping that makes the output personal.

**Four kinds of response** (angle, 113 words, copied 9)

The system doesn't just ask for four similar answers. It asks for four structurally different kinds, which comes from conversation analysis. One is the preferred, agreeable response. One is a graceful decline or hedge, with a brief reason attached. One is a new direction the user could take, like a follow-up question. And one is a repair, for when something needs clarifying.

Each kind always appears in the same screen position, so the user learns where to look. The point is that a person in conversation needs to be able to disagree, redirect, and ask for clarification, not just say yes. Those are the moves that are hardest with a traditional device.

**Where the personal content comes from** (angle, 152 words, copied 8)

The personal part comes from the user, in three places. First, a questionnaire called About Me, which is self-paced and has no required questions. Second, a private record of the people in their life, with nicknames, relationships, and topics to favor or avoid. Third, a record of places they go. Goals can be added at three levels: a general style, a standing goal for a relationship, and a goal for the conversation happening right now.

After a conversation, the user can also review it and write what they would rather have said. Those rewrites become examples of how they talk. All of this stays on the user's device. Nothing goes out except the request to the AI provider when options are generated.

One limit matters. The system won't supply facts about the world in the user's voice, and if the profile lacks something, the option says so rather than inventing it.

## If the AI writes the sentences, how is that still the person's own voice?

*(answered by the documents)*

### Audience: SLPs and OTs  (8.6 s, 885 output tokens, 1.87¢)

**Short answer** (short, 72 words, copied 5)

The goal is to speak as the person, not for them. The AI drafts options shaped by what the user has told the device about themselves, but nothing is spoken until they choose it, and they can always type their own words instead. I'd say the voice stays theirs because the decisions stay theirs.

The next answers cover the user's control, how the device learns the person, and the limits of that.

**The user decides everything** (angle, 146 words, copied 4)

Think about where the control sits. The device offers four kinds of reply: an agreeable answer, a graceful decline, a new direction, and a request for clarification. The person reads them and taps one. Nothing is spoken until they do. If none of the options fits, there's a free-text control, which I call "In your own words," so they can type exactly what they mean and have it spoken at once. They can also type a rough idea and ask the device to reword the options around it. So the AI works more like a fast drafting partner than a ghostwriter. For clients, that matters. Choosing among options, rejecting some, and overriding all of them is an act of authorship. Many people who use AAC today are known mostly through their needs. Being able to pick the joke or the disagreement is what changes that.

**How it learns the person** (angle, 149 words, copied 6)

The options are shaped by a profile the user builds, not by generic chatbot habits. There's a questionnaire they can answer at their own pace, covering who they are, what they care about, how they handle disagreement, and what their humor is like. No question is required. The device also keeps a private record of the people in their life, using the nickname they actually use, such as Mom rather than Mary, and the places they go. And after a conversation, the user can go back through it a turn at a time and write what they would have said instead. The device then uses those rewrites as examples of how this person talks, and keeps the ones about a particular person for that person. In therapy terms, that review is a natural place for a clinician to sit alongside a client and help them refine their own voice.

**Where it falls short** (angle, 139 words, copied 4)

I don't want to overstate this. The options won't always be the user's exact words. The device is working from what it's been told and from what the person has picked before, so early on it will sound less like them than it will later. Also, someone could be tempted to tap the first option just to keep up with the conversation. We all do something similar when we grab the first phrase that comes to mind. The design tries to reduce that. Each kind of reply always appears in the same screen position, so the person learns where to look, and the first option is meant to be the most natural one for them. The honest summary is that it's the user's voice to the degree they shape it, and the tools for shaping it are built in.

### Audience: academics  (9.2 s, 809 output tokens, 1.79¢)

**Short answer: they choose** (short, 65 words, copied 5)

I'd say the voice is theirs because the choosing is theirs. The AI offers options, but nothing gets spoken until the user picks one, and they can always type their own words instead. The goal is to speak as the person, not for them. I can't claim the options will always match what they'd have said, which is why the system keeps learning from them.

**Where the control sits** (angle, 125 words, copied 4)

Think about where the decisions happen. The AI never speaks on its own. It writes four kinds of options: an agreeable answer, a graceful decline, a new direction, and a clarification. The user reads them and taps one, or ignores them all and uses the free typing box. That typing box is always one selection away, so the user is never confined to what the AI generated. There's also a button that lets them type a rough idea and have the options rebuilt around it. So the person decides whether to agree, decline, change the subject, or say something the AI never thought of. The words may come from the AI, but the stance, the timing, and the final say all come from the user.

**What shapes the wording** (angle, 126 words, copied 7)

The options aren't generic. The AI is given what the user has told the system: their opinions, their sense of humor, how they handle disagreement, who the people in their life are and what they call them, and what they want from a particular conversation. The user also reviews conversations afterward and rewrites replies the way they'd actually have said them, and those rewrites become examples of how they talk. I haven't measured how well this works. It's a design claim, not a result. I'd also say the system stays honest about the limit. It treats what the user types as true, and when it hasn't been told a fact about the person, it says it doesn't know instead of making something up in their voice.

**Honest limits of this claim** (angle, 131 words, copied 0)

I think your question points at something real, so I won't oversell it. An AI-written sentence is not the same as a sentence the person built word by word, and there's a risk someone just taps the first option to keep up with the pace. I don't have evidence yet on how often that happens or how it affects someone's sense of ownership. What I'd point to is what the alternative has meant. People with these devices have mostly been reduced to needs and short answers, while others finish their sentences or talk over them. That loses their voice too. In my view the open research question is how to measure whether selected, AI-drafted speech feels like the user's own, and I'd welcome people in this room studying that.

## Couldn't a user just keep picking the first option to save time? Doesn't that take away their autonomy?

*(answered by the documents)*

### Audience: SLPs and OTs  (7.8 s, 771 output tokens, 1.78¢)

**Yes, it's a real risk** (short, 69 words, copied 5)

Yes, a user could fall into tapping the first option just to keep up, and that's a fair worry. The design tries to protect against it in a few ways: the person can always type their own words, ask for new options, and tell the device afterward what it got wrong. The goal is that the first option becomes the right one more often, not that choosing stops mattering.

**We already do this** (angle, 120 words, copied 0)

I'd start by pointing out that speaking people do something similar all day. When we can't find the right word and the conversation is moving, we say the first thing that comes to mind, even if it's imperfect. Phones do it too, with suggested replies you tap instead of typing. So picking a good-enough reply for speed isn't new, and it isn't automatically a loss of autonomy. In casual exchanges with strangers or acquaintances, a quick, reasonable reply is often exactly what the moment calls for. The worry is real when it becomes the only way someone can speak. That's why the design never makes it the only path, and why the person decides each time what to say.

**Ways to stay in control** (angle, 102 words, copied 6)

The device keeps several other routes open, and they sit on screen in the same place every time. The person can type anything in their own words and have it spoken. They can ask the device to generate a fresh set if none of the options fit. The four kinds of reply are also different on purpose: one agrees, one declines or pushes back gracefully, one takes the conversation in a new direction, and one asks for clarification. So the user isn't choosing among four slightly different versions of yes. Declining and redirecting are always one tap away, which matters for autonomy.

**Making the first option better** (angle, 125 words, copied 5)

The other part of the answer is that the device is meant to improve with use. Later, when the person has time and no one is waiting, they can go back over a saved conversation turn by turn. Where a reply didn't sound like them, they type what they would have said. The device learns from those rewrites, including how long their replies tend to be and how they talk with particular people. They can also fill in a profile of their interests, opinions, and humor. The aim is that the option on top is more and more often the one they would have chosen anyway. I can't promise that fully works yet, and I haven't studied whether users over-rely on the first option.

### Audience: academics  (2.3 s, 156 output tokens, 1.17¢)

**Yes, it's a real risk** (short, 78 words, copied 5)

It's a fair worry, and I don't think it goes away completely. Everyone takes the easy phrase sometimes when time is short, and the system can't stop a user from doing that. What I can say is how the design tries to keep control with the person: they can always type their own words, the first option is meant to be a good fit and not a default, and the user keeps training the system after the fact.

## What about the communication partner's privacy? The device is recording what they say.

*(answered by the documents)*

### Audience: SLPs and OTs  (6.8 s, 811 output tokens, 1.85¢)

**Short answer** (short, 82 words, copied 4)

It's a fair concern. Most of what the device keeps is on the user's own tablet, nothing goes to a server of mine, and the user can mark any conversation as not to be saved. But the material also says plainly that the partner's voice and face being recorded is an open question that deserves more thought and possibly legislation. I haven't settled it.

So my answer is that there are real protections around the data, and a real question left over.

**Where the data goes** (angle, 112 words, copied 4)

Let me describe what actually happens to what the partner says. The device listens, turns the speech into a written transcript, and shows it to the user. Everything the user saves stays on their own device, in a folder they choose. There's no account of mine holding it, and I don't run a server that collects it.

The one place the words leave the device is when the text goes to the AI provider to generate response options, and that travels over an encrypted connection. The speech recognition itself can also be a cloud service on some devices. Nothing else is sent, and the user supplies their own account with that provider.

**Control and visibility** (angle, 117 words, copied 9)

There are a few controls built in that bear on this. First, the device plays a short, friendly sound when it starts listening. That matters because the tablet screen faces the user, not the partner, so the sound tells the other person that the microphone is on.

Second, there's a one-tap "Don't save" control. It keeps the current conversation out of the data folder, and if it's pressed partway through, it deletes what was already saved from that conversation. People often realize a talk is private only after it's started. The user can also make that the default, so every conversation begins unsaved. The user decides what is kept; the partner has no say in that.

**What I haven't resolved** (angle, 113 words, copied 8)

Here's the part I can't tidy up. When we talk with someone, our brains remember their face and voice, and nobody asks permission for that. But this system could keep a record of the voice and facial characteristics that made recognition possible, along with a very accurate record of the conversation, and use it to inform later conversations. That's different from ordinary memory, and some of that information might need to be stored and processed in the cloud.

I think that deserves further thought and, if necessary, legislation. I don't have a finished answer, and I haven't thought about the legal side very much. I'd rather leave that open than pretend it's solved.

### Audience: academics  (5.9 s, 616 output tokens, 1.65¢)

**Short answer on partner privacy** (short, 50 words, copied 0)

It's a real concern, and I haven't settled it. The system has to keep the partner's voice and face details and a record of what they said, and some of that may go to a cloud service. In the paper I say that deserves more thought and, if needed, legislation.

**Why it feels different** (angle, 86 words, copied 7)

Everyday conversation already involves this. Our brains remember faces and voices, and nobody asks permission to remember what someone looked like or said. But the paper points out that this system would store the specific facial and voice characteristics that make recognition work, plus a highly accurate record of the conversation, so it can inform later conversations. That's different from a person's memory, and it can challenge those intuitions. I'm not claiming the everyday comparison settles it. It's the reason I think the question deserves attention.

**Where the data would go** (angle, 91 words, copied 9)

It depends on the architecture. In the version where everything runs on the device, less protected data flows in and out, which cuts down the security concerns. In the versions where heavy processing moves to the cloud, there's a bigger need for data security and privacy, both around each component and in the communication between them. The paper also notes that this information may have to be sent to the cloud for storage and processing by the AI components. So where the processing happens changes how exposed a partner's information is.

**What I can and can't say** (angle, 89 words, copied 8)

The paper says every part of the system should be wrapped in a data security and privacy strategy, mainly because it holds the user's thoughts and opinions. It doesn't work out how the communication partner's consent should be handled, or what legislation would need to say. I don't know the answer to that, and I haven't thought about it very much. All I can tell you is that I see it as an open issue the field needs to take on, not one I can claim to have solved.

## Does this only work for people who can read?

*(answered by the documents)*

### Audience: SLPs and OTs  (7.3 s, 723 output tokens, 1.79¢)

**Reading helps most, today** (short, 58 words, copied 0)

The version I've built today does assume the person can read, because the response options appear as text on the screen. But reading is not an essential part of the idea. The same approach could speak the options aloud, simplify the wording, or show pictures instead of words. Those extensions are possible, but I haven't built them yet.


**What reading means here** (angle, 116 words, copied 6)

Let me be specific about what the current version asks of the user. Four response options appear on the screen, and the person reads them and taps one. They also read a transcript of what the partner said, so they can check the device heard correctly. So today, reading is part of the job. That's why I describe the first users as literate adults who can point at the screen by touch, mouse, trackball, or an eye gaze device that moves the pointer. I chose that group because it's where a working version can help soonest. It was a starting point for the first version, not a claim that this is who AAC conversation is for.


**Options spoken aloud** (angle, 105 words, copied 0)

One way past the reading requirement is to let the person hear their options instead of reading them. The device would speak each option privately, in order, much as auditory scanning works for some of your clients now. The article raises that possibility. I haven't built it, and I haven't tested it. A person would have to hold several spoken options in memory while choosing, which is a real load, and the delay would be longer than reading. So I'd call it a promising direction rather than a solved problem. It would be a good question for clinicians who know which clients can manage it.


**Simpler wording or pictures** (angle, 112 words, copied 0)

There are two other directions. The first is matching the level of the language. The AI can restate the same idea at a different grade or reading level, so the options could be shorter and simpler for someone who reads a little. The second is pictures. The AI could translate what the partner says, and the suggested replies, into symbols from a standard or personal picture set. That could reach people who aren't yet reading. Neither is built yet. And I can't tell you how well they'd work with your clients, because I haven't tested that. For now, if a client can't read the options reliably, this version isn't the right tool.


### Audience: academics  (6.6 s, 690 output tokens, 1.75¢)

**Short answer** (short, 62 words, copied 0)

The system I've built right now is for people who can read, because the response options show up as text on the screen. But the underlying idea doesn't depend on reading. I've described ways it could reach people who can't read yet, and those aren't built.

So today, yes, literacy is required. That's a limit of this version, not of the approach.

**Why reading is needed now** (angle, 112 words, copied 6)

In the current version, the user sees what the partner said as a transcript and sees the response options as written text, then taps one. So being able to read, and to judge which option fits, is part of how it works. I've set it up for adults who are literate and who point at the screen directly, whether with a finger, a mouse, or an eye gaze or head tracker that moves the pointer. I'd rather say plainly that someone who can't read the options can't use this version, than suggest it works for everyone. I haven't tested it with people at other literacy levels, so I won't make claims there.

**Options read aloud instead** (angle, 100 words, copied 4)

The first way around reading is to have the device speak the options to the user, one after another, much like auditory scanning. The user hears them and chooses without needing the text. That's an idea I describe in the paper, not something I can say has been built or tested. I'd also flag a cost I haven't worked out: hearing options one at a time takes longer than glancing at them, and time is the very thing this approach is trying to protect. So I can't tell you yet how well it would hold up in a live conversation.

**Simpler wording or pictures** (angle, 104 words, copied 5)

Two other possibilities are in the paper. One is that these language models are good at restating something at a different reading level, so the options could be written to match what a particular user can read. The other is turning the partner's speech and the suggested replies into pictures, using a standard symbol set or the user's own, which could extend this to people who don't read at all. Again, those are ideas, not working features. I'd also say the first version focuses on literate adults, and widening it to other literacy levels and to younger users is on the roadmap, not done.

## How would I start a client on this? What does a first session look like?

*(partly covered)*

### Audience: SLPs and OTs  (8.1 s, 902 output tokens, 2.00¢)

**Short answer** (short, 66 words, copied 4)

Start in Practice Mode, where the AI plays the other person, so nobody is waiting on your client. Have them set up an account, add a few things about themselves, and run a scenario or two. The first real conversation comes later, with someone patient.

This is for adults who can read, who can point at a screen by any means, and who hold legal capacity.

**Who it fits first** (angle, 126 words, copied 14 - "or head tracking device set up to move the pointer and click by dwelling")

Before any session, check the fit. The version I've built is for adults who can read the response options on screen and judge them, and who hold legal capacity, because the app speaks aloud in their name and runs on an AI account billed to them. They need to use direct select. That can be a finger, stylus, mouse, trackball, or an eye gaze or head-tracking device set up to move the pointer and click by dwelling. I haven't built switch scanning yet, so someone who can't drive a pointer isn't a match today. It runs in a web browser, on a Windows tablet, laptop, Chromebook, Mac, or an iPad using Safari. An iPad has some extra setup choices, which the user manual walks through.

**Setup and About Me** (angle, 119 words, copied 7)

The first sitting is mostly setup. The person creates their own AI account and supplies their own key, so there's no subscription to my project. The app can check that the key was entered correctly with a one-tap connection test. Then they begin the About Me questionnaire. No question is required, and the app works with a completely empty profile, so nobody has to finish it in one visit. I'd focus on a few things: who the important people are, what they like to talk about, and especially what subjects they know a lot about. They can also record how names should be pronounced. The profile grows from use, so it never needs to be complete in advance.

**Practice Mode first** (angle, 160 words, copied 17 - "with the app a guided tour of the buttons plus practical social medical personal and professional situations")

Then I'd move straight to Practice Mode, found under Settings. The AI plays the communication partner, speaking its lines aloud, and no microphone is involved. Your client uses the same controls as in a real conversation, so what they learn transfers. Six scenarios come with the app: a guided tour of the buttons, plus practical, social, medical, personal, and professional situations. Because nothing on the screen ever moves, repetition builds motor planning, and practice is the only place repetition is free. It also lets you try settings changes, like text size, button size, or two options per category, before a real conversation depends on them. If a keyguard is used, it lines up across screens. When a specific situation is coming up, like an appointment, you can copy a scenario and make it theirs, or write a new one. After sessions, Conversation Review lets the person go back through a practiced conversation and write what they would rather have said.

### Audience: academics  (8.4 s, 906 output tokens, 1.99¢)

**Short answer: start with practice** (short, 73 words, copied 4)

I'd start with Practice Mode, where the AI plays the other person, so there's no one waiting and no microphone involved. Pair that with the About Me questionnaire, which can be answered a bit at a time. The app is free, runs in a browser, and the person needs their own AI account key.' I haven't tested a first session formally, so this is how the pieces are built to fit together.

**Check fit and set up** (angle, 146 words, copied 12 - "on an ipad it must be safari because chrome and edge there")

First, check fit. The current version is for adults with legal capacity who can read the options on screen and who can point to a target, whether with a finger, a stylus, a mouse, or an eye gaze or head tracker running in pointer mode. There's no switch scanning yet, so someone who can't drive a pointer isn't served today. Then the setup. It runs in Chrome or Edge on Windows, a Chromebook, or a Mac, or in Safari on an iPad. On an iPad it must be Safari, because Chrome and Edge there can't hear the partner. The person creates an account with the AI provider and enters their own key. The app can check the key and test the connection with one tap. After that you can adjust text size, button size, and color scheme so the screen is easy to see and hit.

**Practice Mode as the first session** (angle, 126 words, copied 6)

For the session itself, I'd run Practice Mode. The AI speaks the partner's side aloud, and the person responds with the same controls they'd use in a real conversation. Start Listening just cues the AI partner's next line, so the habit transfers. That separates learning the buttons from the pressure of a real person waiting. The interface is built so nothing on the screen moves, and that only pays off with repetition, which practice makes free. One of the six scenarios is a guided tour of the controls, which is a natural place to begin. Scenarios can be copied and reworded, or new ones written for something coming up, like an appointment. I haven't measured how long learning takes, so I won't give you a number.

**Building the profile over time** (angle, 129 words, copied 6)

The profile doesn't need to be finished before the first conversation. The About Me questionnaire is self-paced, no question is required, and the app works with it completely empty. It fills in over time, and the app lists the questions that real conversations turned out to need. One question matters most: what subjects the person knows a lot about, because that's what lets the app give detailed replies on those subjects. I'd add the people in their life, with the nicknames they actually use, and a few places. For privacy, the data stays on the device, and the person can tap Don't save to keep any conversation off the record. Later, Conversation Review lets them go back over a saved conversation and write what they'd have rather said.

## What happens when there's no internet, like in a school with restricted Wi-Fi?

*(partly covered)*

### Audience: SLPs and OTs  (6.3 s, 662 output tokens, 1.78¢)

**Short answer** (short, 54 words, copied 4)

Without internet, the AI stops writing response options, but the device doesn't go dead. The person can still type anything and have it spoken, and use a panel of quick phrases. The catch is that hearing the partner also needs internet, so with no connection at all, the device can't show what was said.

**What still works offline** (angle, 110 words, copied 7)

If the AI can't be reached, the person still has two ways to speak. One is a panel of quick phrases they've set up ahead of time, each one a single tap. The other is a free typing box, where they can write anything and have the device say it aloud. Whatever they say is saved the same way it would be if the AI had written it. The device also signals quietly that something went wrong, with a faint color change, not an intrusive error message. So it becomes a capable manual communication tool until the connection returns. It's the fastest path that goes away, not the only path.

**The listening limit** (angle, 89 words, copied 12 - "can't show what the partner said because it can't hear them the")

There's one part I can't fully protect, and it matters for your question. Hearing the communication partner depends on speech recognition, and that's a cloud service. It's a limit of the browser technology underneath, not something I chose. So with no internet at all, the device can't show what the partner said, because it can't hear them. The person can still speak with the quick phrases and the typing box. But a school network that blocks the internet entirely would take away the partner's side of the conversation too.

**Restricted school Wi-Fi** (angle, 105 words, copied 5)

Here I have to say what I don't know, and I haven't thought about it very much. The material I've written does say that school internet access is more controlled and could be an issue. But it doesn't say which sites a given school blocks, or what a school's network would do to this app. What I can tell you is what the app needs: a connection to the AI service, and a connection for hearing the partner. For a particular client, I'd run it on the school's network before relying on it, and have the quick phrases and typing box ready as the backup.

### Audience: academics  (6.0 s, 664 output tokens, 1.78¢)

**Short answer** (short, 66 words, copied 9)

Without internet, the AI can't write response options, and the app can't hear the partner either, because speech recognition is a cloud service. The user can still speak with the Express Panel of quick phrases and by typing in their own words. Restricted school Wi-Fi is a real concern I've only touched on, so I don't know how it plays out in any particular school.

**What still works offline** (angle, 103 words, copied 4)

The app is built so that the AI is a layer on top and not a lifeline. If the AI can't be reached, the user can still tap quick phrases from the Express Panel, and they can type anything in the free composition box and have it spoken. Whatever they say gets recorded just as if the AI had written it. What disappears is only the generated response options. The user's profile, people, and places all stay on the device, so nothing is lost. A faint colored cue tells them something went wrong, and the app keeps working as a manual communication tool.

**The hearing problem** (angle, 85 words, copied 16 - "connection at all the app can't show what the partner said because it can't hear them")

The part that doesn't survive is hearing the other person. Speech recognition is a cloud service, so with no connection at all, the app can't show what the partner said, because it can't hear them. That's a limit of the underlying browser technology, not of the AI feature. So in a fully offline room, the user is speaking, but not getting a transcript of the conversation. I'd count that as a real gap, and I don't have a workaround for it in the current version.

**Restricted school Wi-Fi** (angle, 101 words, copied 5)

The paper does mention schools. The architectures that lean on the cloud need internet access, and it says there may be an issue in a school setting where access is more controlled. Beyond that, I don't know, and I haven't thought about it very much. I can't tell you which school networks would block the AI provider or the speech service, or whether a school could allow just those. What I can say is that an app depending on the AI provider and speech service means someone would need to check with the school's IT staff before relying on it there.

## You mentioned eye gaze. Would this work for my clients who use switch scanning?

*(partly covered)*

### Audience: SLPs and OTs  (7.3 s, 763 output tokens, 1.91¢)

**Not yet for switch scanning** (short, 57 words, copied 7)

Not yet. The app works with eye gaze when the equipment moves the pointer and selects by dwelling, but it has no switch scanning today. Nothing in it steps through the choices automatically. I designed it so scanning can be added without rebuilding it, and it's on my list, but I don't want to promise a date.

**Why eye gaze works today** (angle, 119 words, copied 12 - "the dwell time is set on the tracker not in the app")

The app picks things by direct selection, meaning the person points straight at what they want. A finger, a stylus, a mouse, a trackball, or an eye gaze or head-tracking system all reach the app as the same thing, a pointer clicking. So if your client's eye gaze equipment is set to the mode that moves the pointer and selects by dwelling, usually called computer control or mouse emulation, it should work with no special setup in the app. The dwell time is set on the tracker, not in the app. I'd also suggest leaving the setting that asks for a second tap turned off for gaze users, because two full dwells in a row would be hard.

**What scanning would need** (angle, 111 words, copied 7)

Scanning is a different kind of access. Instead of pointing, the person waits while a cursor moves through the choices and then hits a switch at the right moment. The app has nothing like that yet. I do think the screen layout will help when it's added. Nothing on the screen ever moves, so the response options always sit in the same four places, and that is the kind of predictable layout scanning depends on. But that's my expectation, not something I've built or tested. I also haven't thought much about the timing problem. Scanning adds seconds to every selection, and the whole point of this work is shortening the silence.

**Who it suits right now** (angle, 102 words, copied 7)

Right now it suits adults who can read, hold legal capacity, and can drive a pointer by any means. That includes many people who use eye gaze, such as people with ALS. It doesn't yet suit someone who has moved beyond being able to direct a pointer at all, and your clients who rely on switch scanning fall into that group today. One more thing for eye gaze clients: the app asks them to read the transcript and the response options, and that is attention not spent on the partner's face. It rules nothing out, but it's worth watching in early sessions.

### Audience: academics  (7.6 s, 815 output tokens, 1.96¢)

**Not yet, for switch scanning** (short, 61 words, copied 13 - "has no switch scanning yet nothing in it steps through the choices for")

Not today. The app is built for direct selection, which includes eye gaze when the tracker is set up to move the pointer and click by dwelling. It has no switch scanning yet. Nothing in it steps through the choices for someone who can't point. It's on the roadmap, and the design was made so it can be added without rebuilding.

**Why eye gaze works but not scanning** (angle, 140 words, copied 12 - "in the mode where it moves the pointer and selects by dwelling")

The reason eye gaze works is that the app doesn't care what is doing the pointing. A finger, a mouse, a trackball, or a gaze or head tracker all arrive the same way, as a pointer choosing something on the screen. So eye gaze works as long as the tracker is in the mode where it moves the pointer and selects by dwelling, usually called mouse emulation. The app never needs a drag, a right click, a pinch, or anything revealed by hovering. Switch scanning is a different kind of access. The cursor moves through items on its own and the user hits a switch at the right moment. The app has nothing that does that stepping. So a client who can drive a pointer by any means can use it today, and a client who relies on scanning can't.

**What this means for your clients** (angle, 116 words, copied 0)

For your clients who use switch scanning, the app can't be used by them in its current form, and I don't want that to look like a small gap. Scanning is how many people with the most limited movement get access at all. There's also a timing question I haven't tested. The whole design is about keeping the pause short enough that a partner doesn't drift away. Scanning adds its own delay on top of reading the options, and I don't know how that plays out in a live conversation. So I'd say this version is a fit for people who can direct a pointer, and I can't say yet whether scanning would work well here.

**What's planned and what isn't known** (angle, 112 words, copied 5)

Switch scanning is on the roadmap. It doesn't exist today, and I don't have a date for it. What I can say is that the system was designed so scanning can be added later without rebuilding it. The four kinds of response sit in fixed positions on the screen, and that stability should help any scanning layout, because the user can learn where each kind of reply lives. I don't know yet how scanning would handle the placeholder timing, or how many options a scanning user would want to step through. Those are open questions I haven't thought about very much, and I'd welcome input from people who work with scanning users.

## Is there any research yet showing this improves outcomes for AAC users?

*(not covered)*

### Audience: SLPs and OTs  (7.2 s, 698 output tokens, 1.87¢)

*Clarifying buttons: "What do you mean by 'outcomes'?"*

**Short answer: no evidence yet** (short, 59 words, copied 0)

I don't know of any research showing this improves outcomes, and I haven't thought about it very much. What I can tell you is why I think it should help, and that the idea rests on earlier research about conversation, silence, and why AAC users get left out. Whether it actually improves anyone's life still has to be tested.}

**What my claims rest on** (angle, 104 words, copied 6)

The case I make is built on earlier work, not on a study of this system. People get uncomfortable after one to four seconds of silence, and AAC users with limited movement often type ten to twenty words a minute. Researchers have also described for years how AAC users stay stuck in transactional talk, meaning needs and wants, and rarely reach interactional talk like jokes, shared stories, and friendship. Those findings are why I built the device around filling the silence. But they describe the problem. They don't show that my solution fixes it. I'd call this a reasoned design, not a proven one.

**What testing would need to show** (angle, 93 words, copied 0)

I haven't designed a study, so I don't want to invent one for you. What I can say is what I'd want to know, using the problems I described. Do partners interrupt and finish sentences less? Do users take more turns, start more topics, and make more jokes? Do they feel more like themselves? Those are conversation outcomes, which are different from words per minute. I'd also want clinicians who know these clients to help judge whether the response options sound like the person. That's where your training matters, and I'd welcome it.

**What I can say today** (angle, 98 words, copied 6)

The system is built and working in its first version. It's free and open source, so it can be tried without a purchase or a subscription. The user pays only for the AI conversations they actually have. That's partly why I'm sharing it now. It's meant for adults who can read, can point at a screen by any means, and hold legal capacity, and a client like that could use Practice Mode first, where nobody is waiting on them. Careful observation of how clients actually do is the only way any of us will learn whether this helps.

### Audience: academics  (4.0 s, 334 output tokens, 1.50¢)

*Clarifying buttons: "What do you mean by 'outcomes'?"*

**Short answer: not yet** (short, 54 words, copied 0)

No, not from me. I don't have outcome data showing this improves things for AAC users, and I haven't thought about it very much beyond that. What I have is a design built on published research about conversation and silence, and a working system. Whether it changes real outcomes is still an open question.}

**What the paper actually claims** (angle, 108 words, copied 0)

I want to separate what's argued from what's measured. The paper is a design argument. It describes an architecture, shows a ChatGPT 3.5 simulation of the coffee shop exchange, and says the needed technology exists or is in development. That simulation shows the language model can write plausible response options in under a second. It doesn't show that a real AAC user converses better, feels more included, or is understood differently. The word outcomes in the title of the journal is not something I can claim to have measured. I haven't run a study with users, so any benefit I describe is a prediction, not a finding.

## What does it cost a family per month?

*(not covered)*

### Audience: SLPs and OTs  (6.3 s, 746 output tokens, 1.94¢)

**Pay only for what's used** (short, 62 words, copied 9)

There's no subscription and no fee to me. The app is free and open source. The family sets up their own account with the AI company and pays only for the conversations the person actually has, typically a small fraction of a cent per exchange. I don't have a monthly total to give you, because it depends on how much they talk.


**Why there's no subscription** (angle, 106 words, copied 5)

The app runs in a web browser with no server of mine behind it. Each user creates their own account with the AI provider and gives the app their own key, and the provider bills them directly. That means I'm not paying for anyone's conversations, so there's nothing for me to charge for. I chose this on purpose, because earlier AI-driven AAC projects were shelved when their funding ran out, and a project that pays everyone's computing costs is fragile. This one can't be defunded. I don't know what that works out to in dollars each month, and I haven't thought about it very much.

**Optional paid voice and hearing** (angle, 118 words, copied 10 - "device billed by the amount spoken at a few cents")

Two extras can cost money, and neither is needed to start. One is a more natural voice than the ones built into the device, billed by the amount spoken, at a few cents per hour of conversation. The other is paid transcription, which is how the app hears the other person. On Android, and on an iPad where the app is added to the Home Screen, the device's own speech recognition can't be used, so hearing costs roughly twenty-two cents to a dollar per hour of speech, depending on the company. Both are off unless the family turns them on. I'd suggest hearing a paid voice before deciding, since the iPad's built-in voices are rather mechanical.

**Device and getting started** (angle, 101 words, copied 7)

The app itself needs nothing installed from an app store. It runs in a browser on a Windows tablet or laptop, a Chromebook, a Mac, an iPad, or an Android device, so a family can use hardware they already own. I haven't priced out devices, and I can't say what a family would need to buy if they don't have one. For a first step, Practice Mode lets someone rehearse conversations with the AI playing the other person, so a family can try it out before anything depends on it. The only account they truly need is the AI provider account.

### Audience: academics  (7.0 s, 756 output tokens, 1.95¢)

**Free app, pay per use** (short, 66 words, copied 9)

The app itself is free and open source, with no subscription. The family pays their own AI provider directly, only for the conversations the user actually has, and the material says that's typically a small fraction of a cent per exchange. I don't have a monthly figure, because it depends on how much the person talks, and I haven't thought about it very much beyond that.

**Why there's no subscription** (angle, 107 words, copied 5)

The reason there's no monthly fee is how it's built. It's a web app with no server of mine behind it, so I'm not paying for anyone's computing. Each user makes an account with an AI provider, Claude from Anthropic to start, and puts in their own key. That's what the family is billed for. Earlier AI-driven AAC projects were shelved when the funding ran out, because the project was paying for everyone's usage. This design avoids that, since the cost sits with each user and scales with how much they actually converse. There's also no license and no waiting list, and I can't defund it.

**Optional paid extras** (angle, 108 words, copied 12 - "a more natural sounding voice than the ones built into the device")

There are two optional paid pieces, and the app works without either. One is a more natural-sounding voice than the ones built into the device, billed by the amount spoken, at a few cents per hour of conversation. The other is paid speech recognition, billed by the minute of speech, which is needed on Android and on an iPad running from the Home Screen, because the device's own recognition isn't available there. On an iPad opened in Safari, hearing the partner is free. Depending on the company, transcription runs roughly twenty-two cents to a dollar per hour of speech, and only while someone is actually talking.

**What I can't give you** (angle, 104 words, copied 0)

I can't hand you a real monthly number, and I'd be guessing if I tried. The material gives per-exchange and per-hour rates, but it doesn't tell me how many exchanges a typical person has in a month, or what a family's mix of services would add up to. That depends on how much the person converses, which voice they choose, and which device they use. Hardware is separate too. The material recommends a Microsoft Surface or an iPad, but I have no prices for those. I also haven't tested cost over real months of use, so I'd treat any total as unmeasured.

## Is this covered by Medicaid or insurance?

*(not covered)*

### Audience: SLPs and OTs  (6.3 s, 716 output tokens, 1.94¢)

*Clarifying buttons: "What do you mean by 'covered'?"*

**Short answer** (short, 51 words, copied 6)

I don't know, and I haven't thought about it very much. What I can tell you is what it costs, because that's what my material covers. The app is free and open source, and the person pays only a small amount to an AI company for the conversations they actually have.}

**What the app costs** (angle, 116 words, copied 17 - "pays only for the conversations they actually have typically a small fraction of a cent per exchange")

Here is what I can say about money. The app itself is free. There's no license, no subscription, and no waiting list, and I don't charge anything. The person sets up their own account with an AI company and pays only for the conversations they actually have, typically a small fraction of a cent per exchange. I don't have a monthly total, because it depends on how much they talk. There are also two optional paid extras. One is a more natural-sounding voice, and the other is paid speech recognition, which is needed on an iPad running from the Home Screen and on Android. Both are billed by use, and the app works without either.

**What I can't answer** (angle, 96 words, copied 0)

The material I have says nothing about Medicaid, private insurance, or any funding source, so I can't tell you whether any of them pays for this. I also don't know how a funding body would classify it, or what documentation it might ask for. I would rather not guess, because a wrong answer could send a family down the wrong path. Whoever handles funding for your clients would be the right person to ask. If you can tell me which kind of coverage you mean, I can at least describe what the person would be buying.

**Why no one pays me** (angle, 128 words, copied 5)

One thing in the design bears on your question. Earlier attempts at AI-driven communication devices were shelved when their funding ran out, because a server-based system means someone has to keep paying for the computing on behalf of every user. I avoided that on purpose. The app runs in a web browser with no server of mine behind it, so there's no ongoing cost to the project and it can't be defunded. The person's own account pays for their own use. It also means there's no product sold to a family or billed to a payer for me to point you to. The device itself is whatever tablet or laptop the person already uses, such as a Windows tablet, a Mac, a Chromebook, or an iPad.

### Audience: academics  (5.8 s, 693 output tokens, 1.91¢)

*Clarifying buttons: "What do you mean by 'covered'?"*

**Short answer** (short, 45 words, copied 4)

I don't know, and I haven't thought about it very much. Nothing I've worked out addresses Medicaid or insurance. What I can tell you is that the app itself is free and open source, and the only cost is the family's own AI account.'

**What the app costs** (angle, 104 words, copied 9)

The app is free to use, and the source code is open. There's no license, no subscription and no waiting list. It runs in a web browser, so there's nothing to buy from an app store. The person sets up their own account with an AI provider and pays that provider directly, only for the conversations they actually have. I've said that's typically a small fraction of a cent per exchange, but I don't have a monthly figure, since it depends on how much someone talks. So there's no device purchase for anyone to reimburse, which may or may not matter to your question.

**Optional paid extras** (angle, 109 words, copied 14 - "device billed by the amount spoken at a few cents an hour of conversation")

Two extras can cost money, and neither is needed to start. One is a more natural voice than the ones built into the device, billed by the amount spoken, at a few cents an hour of conversation. The other is paid speech recognition for hearing the communication partner. That's needed on Android, and on an iPad running from the Home Screen, because the device's own recognition isn't available there. It's billed by the minute of speech, roughly twenty-two cents to a dollar per hour of speech depending on the company. Both are off unless the user turns them on. These are the only recurring costs I know of.

**Hardware and what I can't say** (angle, 89 words, copied 5)

The app runs on a Windows tablet or laptop, a Chromebook, a Mac, an iPad, or an Android phone or tablet. I recommend a Microsoft Surface or an iPad for carrying around and mounting, but the person needs to have one. I don't know whether any funder would pay for that hardware, or whether a free browser app could be billed to anyone at all. I haven't looked into coverage rules, so I can't tell you how Medicaid or private insurance would treat it, and I'd rather not guess.
