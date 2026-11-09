# Question-session test

**Wait for a full set of four answers: median 8.2 s, range 7.5 to 8.7 s. Total cost 25¢ for 8 sets.**

Run 2026-11-09T15:53:35.631Z, model claude-sonnet-5-5. Documents: atob.txt (10548 words), overview.txt (12633 words).

"Copied" is the longest run of words in an answer that appears word for word in the documents. Under about 6 is ordinary; 10 or more means it is reusing the documents' wording.

## How does the device know what to suggest? Where does that come from?

*(answered by the documents)*

### Audience: SLPs and OTs  (8.3 s, 754 output tokens, 12.05¢)

**Where suggestions come from** (short, 53 words, copied 4)

A generative AI writes the suggestions fresh, right after the other person finishes speaking. It works from what the person just said, from what the user has told the device about themselves, and from the people and places they've set up. The user then picks one, and nothing is spoken until they do.

**What it hears and sees** (angle, 121 words, copied 8)

The device listens to the communication partner and turns their speech into text, which appears on screen so the user can always check what was heard. As soon as the partner pauses, that text goes to the AI. If the partner keeps talking, the suggestions update to match the fuller sentence. The AI also tracks what kind of reply the moment calls for. A question needs an answer, an invitation needs an accept or a decline. So the four kinds of options it writes are a natural answer, a graceful way to decline or push back, a new direction the user could take, and a way to ask for clarification. Each kind always sits in the same spot on the screen.

**What the user tells it** (angle, 123 words, copied 6)

This part is where the suggestions start to sound like the person. The user can fill in an About Me questionnaire at their own pace. No question is required, and the device works fine with it empty. It covers who they are, what they care about, their sense of humor, and what subjects they know well. They can also record the people in their life, using the nicknames they actually use, and places they go. They can tap who they're with and where they are, and set goals, like staying close to a sister. All of that shapes the wording of the options. The device also notices facts it needed and didn't have, and lists them as questions the user can answer later.

**Learning, and the limits** (angle, 126 words, copied 8)

The device can learn from how the user actually talks. After a conversation, the user can review it turn by turn and rewrite any reply the way they would have said it. Those rewrites become examples, kept for that particular person, so later suggestions sound more like the user. The device also won't invent things. If it hasn't been told a fact about the user, like an allergy or a date of birth, it offers to say "I don't know" or to give them time to type it. It also won't answer general-knowledge questions in the user's voice, because the goal is to speak as the person, not to put words in their mouth. And the user can always type something of their own instead.

### Audience: academics  (8.7 s, 855 output tokens, 1.78¢)

**Short answer** (short, 63 words, copied 7)

The suggestions are written fresh by a generative AI model each time the partner pauses. It works from what the partner just said, the situation, and a private profile the user builds about themselves: who they are, the people and places in their life, and what they want from a conversation. The user picks one and only then does the device speak it.

**What the AI is given** (angle, 132 words, copied 8)

Each time the partner pauses, the system sends the AI the transcript of what was said so far. It adds the context it holds: who the user is with, where they are, and any goals in force for that person or place. It also sends the user's profile, which they fill in at their own pace through a questionnaire, along with the people in their life and the places they go. The model then writes response options from scratch. They're in four structurally different kinds, a natural answer, a graceful decline, a new direction, and a clarification, always in fixed screen positions. In the 2024 ATOB paper, I described the same basic flow, with a large language model at the center, fed by situational context and a model of the user's worldview.

**Fitting it to the person** (angle, 150 words, copied 13 - "examples of how they talk kept for the person they were talking with")

The goal is to speak as the user, not for them. So the profile shapes both what the options say and how they're worded. If the user says Mom, it says Mom, not her given name. A person can be marked private, which means the AI knows about them but never raises them unprompted. The user can also record topics to favor or avoid with each person, and words they often use with them. Beyond the profile, the device learns from use. The user can go back over a saved conversation and rewrite what they would rather have said, and those rewrites become examples of how they talk, kept for the person they were talking with. I'll be clear about the limit of the evidence: this is a design description of how the system is built, and I haven't measured how closely the options match a particular user's own voice.

**What it won't supply** (angle, 148 words, copied 12 - "know turning the question back or giving what they actually have the")

The suggestions don't come from the AI's general knowledge of the world. That was a deliberate decision. If a partner asks a factual question, the device won't look the answer up and offer it in the user's voice. The model knows far more than any one person, and handing all of it over would stop the user being a participant. It offers what a person would instead: saying they don't know, turning the question back, or giving what they actually have. The same goes for facts about the user. If something isn't in the profile, the answer is that it isn't known, rather than something plausible. The exception is what the user says they know. The questionnaire asks what subjects they know a lot about, and anything listed gets real, detailed answers. The user can also type a fact in directly and have the options built around it.

## If the AI writes the sentences, how is that still the person's own voice?

*(answered by the documents)*

### Audience: SLPs and OTs  (8.4 s, 865 output tokens, 1.82¢)

**Short answer** (short, 70 words, copied 5)

The AI doesn't speak for the person. It offers choices, and nothing is said until the user selects one. The goal is to speak as them, not for them, and the person can always type their own words instead.

So the voice is the user's in three ways: what the device knows about them shapes the wording, they choose what gets said, and they can override it at any point.

**Shaped by who they are** (angle, 136 words, copied 7)

The suggestions aren't generic. The device keeps a private profile the person builds at their own pace. It covers their interests, opinions, sense of humor, how they handle disagreement, and the people and places in their life. When it writes options, it draws on all of that, so a reply refers to their sister by the nickname they actually use, and leans toward how they like to come across.

It also learns from them. If the person types sentences of their own, or rewrites a reply that didn't sound right, the device uses those examples to word later options more the way they would say it. For a client, that means the profile is worth building with them. The more of their own way of talking goes in, the more the options will sound like them.

**The user decides everything** (angle, 133 words, copied 6)

Authorship here sits with the choosing. The device lays out four different kinds of reply: a natural answer, a graceful decline, a new direction, and a request for clarification. They aren't ranked, and none is meant to be the default. The user reads them, picks one, and only then is it spoken.

If none fits, there's a free-composition space called "In your own words." They can type exactly what they want, and it's spoken in their voice. They can also type a rough thought and ask the device to reword the options around it, which lets them supply a fact or a direction the AI didn't have. The only thing the device says by itself is a short holding phrase, like "I'm thinking about that," and the user controls whether it's used.

**What it won't put in their mouth** (angle, 132 words, copied 5)

The device is also built to avoid claiming things the person never said. It won't answer general-knowledge questions on their behalf. If a partner asks what year something happened, it offers what a person would, like saying they don't know. The AI knows far more than any one person, and handing all of that over would stop the user being a participant.

The same goes for facts about the user. If something like an allergy isn't on file, it says "I don't know" rather than inventing something plausible. For pain or symptoms, it offers no answer at all, only ways to get to one, since only the user knows. It treats whatever the person types as true, and only subjects they've listed as ones they know well get answered in depth.

### Audience: academics  (8.2 s, 800 output tokens, 1.75¢)

**Short answer** (short, 52 words, copied 4)

It's the person's voice because they choose every word that gets spoken. The AI offers options, and nothing is said until the user picks one or types their own. The goal is to speak as the person, not for them, but I'd call that a design claim and not something we've measured.


**They choose, always** (angle, 146 words, copied 9)

The control sits with the user. The device only speaks what they select, and the one thing it says on its own is a short holding phrase like "I'm thinking about that," which is shown on screen as it plays. If none of the options fit, they can type anything in their own words and have it spoken. They can also type a rough version and ask the system to reword the options around it, so the AI works from their words instead of replacing them. The article raises the worry that someone might grab the first option to save time. It argues the answer depends on how much control the user keeps, and that follow-up review is what makes the first option better over time. I'd say plainly that this is an argument, and we haven't measured how often people settle for a suggestion.


**How it learns the person** (angle, 124 words, copied 13 - "examples of how they talk kept for the person they were talking with")

The options are shaped by what the user has told the system about themselves: their opinions, the people and places in their life, how they like to come across, and what they want from a particular person. The app uses their nicknames for people, and words they often use with someone. When they review a saved conversation, they can rewrite a reply the way they would have said it. Those rewrites become examples of how they talk, kept for the person they were talking with. That's the mechanism for moving the wording toward the user. I'll be careful here. The options won't always be their exact words, and I'm not claiming we've shown the system sounds like them. That would need to be tested.


**Limits on what it says** (angle, 135 words, copied 5)

Part of keeping it their voice is what the app refuses to do. It won't answer general-knowledge questions for them, because the AI knows far more than any one person and handing that over would put words in their mouth they may never have known. If it hasn't been told a fact about them, like a date of birth or an allergy, it says it doesn't know instead of inventing something. And when a clinician asks about pain, it doesn't pick a number for them. The only subjects it goes deep on are the ones the user says they know. What the user types is always treated as true. This is a deliberate choice about authorship. Whether people experience the result as their own voice is an open question I can't answer from data.


## Couldn't a user just keep picking the first option to save time? Doesn't that take away their autonomy?

*(answered by the documents)*

### Audience: SLPs and OTs  (7.7 s, 747 output tokens, 1.73¢)

**No ranked first option** (short, 59 words, copied 6)

There isn't a first option in the sense you're picturing. The four responses are different kinds of reply, always in the same screen positions, and they aren't ranked. The upper left is the most natural way to answer, but it isn't meant to be the best one, so the person is choosing what to say, not accepting a default.

**Four kinds, fixed positions** (angle, 118 words, copied 10 - "kind of reply it is not how good it is")

The four options are structurally different from each other. One is the most natural, agreeable answer. One is a graceful way to decline or push back, with a brief reason. One takes the conversation in a new direction, like a follow-up question. And one is for repair, when something needs clarifying. Each always sits in the same place on the screen, so the position tells the user what kind of reply it is, not how good it is. That means a person who wants to disagree or change the subject has to be just as easy to reach as one who agrees. Over time, users learn where each kind appears, but we still encourage reading before selecting.

**Why speed pressure is real** (angle, 106 words, copied 0)

Your concern is fair, and the pressure is real. When a communication partner is waiting, a person may tap whatever is fastest. But that's also true for people who speak. We all sometimes say the easy thing because the moment is moving. What the device does is give the person a short spoken holding phrase, like "I'm thinking about that," so the silence doesn't force a rushed choice. The user controls how soon it comes and how many are used. That buys time to read and pick deliberately. For your clients, that may be worth watching in therapy, noticing whether someone is selecting or just accepting.

**Safeguards for their own words** (angle, 106 words, copied 4)

Beyond the choices on screen, there are always other ways out. A person can type exactly what they want in a free-composition box and have it spoken. They can also type a thought and have the device regenerate the options around it, so the replies lean in the direction they meant. Afterward, they can review the conversation turn by turn and rewrite any reply that didn't sound like them. The device learns from those rewrites, so over time the options fit the person better. There's also a practice mode, where the AI plays the other person, so someone can get comfortable choosing before it counts.

### Audience: academics  (8.2 s, 790 output tokens, 1.77¢)

**Short answer** (short, 58 words, copied 4)

It's a fair worry, and the paper raises it too. But there's no first option in the sense you mean. The four kinds of reply sit in fixed positions and aren't ranked, so no single choice is the default. I'd call the autonomy argument a design claim, and we haven't measured whether users lean on any one option.}

**No ranked first option** (angle, 115 words, copied 15 - "position tells the user which kind of reply it is not how good it is")

One correction to the premise. In the current design the four responses are four different kinds of reply: a natural answer, a graceful decline, a new direction, and a clarification request. They sit in fixed screen positions, so the position tells the user which kind of reply it is, not how good it is. None is meant to be the default. That differs from the paper, where I described the likeliest choice appearing first. If someone does keep tapping the same position, they're repeating one kind of reply, like always agreeing, and not simply taking the top of a ranked list. Whether anyone actually does that over time is an empirical question we haven't tested.

**What the user keeps control of** (angle, 112 words, copied 7)

Several things stay with the user. Nothing is spoken until they select it. If none of the options fits, there's a typing box, labeled in your own words, that's always one selection away. They can also type a thought and have the options rewritten around it, which is how a fact the AI doesn't have gets in. The device only speaks on its own to hold the floor, with a short phrase like I'm thinking about that, and it shows that phrase on screen. So the user can always override the suggestions. What I can't tell you is how often people in practice take the fast path, because we haven't measured it.

**The time pressure is real** (angle, 120 words, copied 4)

The paper takes the underlying concern seriously. People do this all the time. If you can't find the right word and the conversation will stall, you say whatever comes first. Phone messaging apps offer tap-to-send replies for the same reason. So I'd expect users to sometimes pick a quick, generic answer, especially with strangers, where a fast and reasonable reply is often what's wanted. The design tries to reduce the cost in two ways. The placeholder phrase buys thinking time, and the user can review conversations afterward and rewrite replies that didn't sound like them. That review feeds back into how future options are worded. Whether that's enough to protect autonomy is something I'd want to see studied.

## You mentioned eye gaze. Would this work for my clients who use switch scanning?

*(partly covered)*

### Audience: SLPs and OTs  (7.5 s, 863 output tokens, 1.87¢)

**Not yet for switch scanning** (short, 65 words, copied 6)

Not yet. The app works for anyone who can move a pointer by any means, and that includes eye gaze set up to click by dwelling. But it has no switch scanning, so nothing steps through the choices for a client who can't direct a pointer. It was designed so scanning can be added later, and it's on the roadmap, but it doesn't exist today.

**How eye gaze works today** (angle, 138 words, copied 12 - "in the mode where it moves the pointer and selects by dwelling")

The app doesn't care what moves the pointer. A finger, a trackball, an eye gaze camera, or a head tracker all reach it the same way. So most eye gaze and head-tracking equipment works now, with nothing to configure in the app. The one requirement is that the equipment is in the mode where it moves the pointer and selects by dwelling, which is often called computer control or mouse emulation. Many systems make the user turn that on deliberately. The app never needs a drag, a right click, a pinch, or anything revealed by hovering, so a dwell-based pointer doesn't struggle with it. The dwell time is set on the tracker, not in the app. If a client's tracker is a bit imprecise, the app lets you enlarge the buttons and the spacing between them.

**Why scanning is a different problem** (angle, 108 words, copied 7)

Direct selection and scanning are really different access methods. With direct selection, the person points at what they want. With scanning, a highlight moves through the choices and the person waits and activates a switch at the right moment. This app is built around pointing, so the response options are chosen by a single selection. Nothing in it yet moves through the choices on its own. I'd also say that scanning raises a timing question I haven't worked through, because the whole design is about keeping the pause in conversation short. I don't know how scanning would fit with that, and I haven't thought about it very much.

**What to tell your clients** (angle, 133 words, copied 19 - "means looking at the screen and the app already asks for eyes on the transcript and the response options")

For a client with a switch scanning setup who can't drive a pointer, the app isn't suitable today. I wouldn't want you to try it and decide it fails them. It's built for people who can direct a pointer by some means, which includes many people for whom eye gaze is the standard access method. Scanning support is planned, and the system was designed so it can be added without rebuilding it, but I can't give you a date. One thing worth watching for your eye gaze clients: using gaze to select means looking at the screen, and the app already asks for eyes on the transcript and the response options. That's attention not spent on the other person's face. It doesn't rule it out, but it's worth noticing in the first sessions.

### Audience: academics  (7.6 s, 816 output tokens, 1.82¢)

**Not yet, switch scanning** (short, 49 words, copied 0)

No, not today. The app is built for direct select, meaning the person points straight at what they want. Eye gaze works because most trackers can drive the pointer and select by dwelling. Switch scanning isn't built, though it's on the roadmap and the design allows for adding it.

**Why eye gaze works now** (angle, 127 words, copied 14 - "is running in the mode where it moves the pointer and selects by dwelling")

Eye gaze and head tracking work today because of how they reach the app. If the equipment is running in the mode where it moves the pointer and selects by dwelling, the app sees an ordinary pointer. It doesn't ask what kind of device it is. It never needs a drag, a right click, a pinch, or anything that appears on hover. So there's nothing in it a dwell pointer struggles with. A few practical notes. Button size and spacing are settings in the app, which helps with a tracker that's a bit imprecise. Dwell time is set on the tracker, not in the app. And the two-tap confirmation setting should stay off for gaze users, since it would need two full dwells within a second.

**What scanning would require** (angle, 112 words, copied 7)

Nothing in the app steps through the choices on its own. Switch scanning means a cursor moves through the options automatically and the person hits a switch at the right moment. That doesn't exist here yet, so a client who can't direct a pointer by any means can't use it today. We designed the system so scanning can be added without rebuilding it, and it's on the roadmap, but it's a plan and not a feature. I haven't tested how scanning would work against the timing the app depends on. The four fixed positions for the reply types may help, since they never move, but that's an expectation, not something we've measured.

**What I'd tell your clients** (angle, 124 words, copied 11 - "the app already asks for eyes on the transcript and the")

For your clients, the question is whether they can drive a pointer by any means. If so, whether by finger, mouse, trackball, eye gaze, or head tracking, the app can work, with the tracker set to pointer control. If switch scanning is their only reliable access method, it doesn't fit yet. I'd rather you hold off than try it and have it fail in a real conversation. One more thing to weigh for gaze users in particular: driving the screen by gaze means looking at the screen. The app already asks for eyes on the transcript and the options, so that's attention not on the partner's face. It doesn't rule anything out, but I haven't measured it, and it's worth watching in early sessions.
