# Deferred work — the list

**This file exists because "it's on the list" was said when there was no list (Ken,
September 8 2026: *"It's statements like these that make me worried that things fall
through the cracks. Eliminating cracks is one of the things I rely on you to ensure!"*).**

That was worse than forgetting. Forgetting leaves the item visible to Ken; asserting a
mechanism that does not exist tells him the item is held somewhere and stops him tracking
it himself. **A deferral is not recorded until it is written down, and it is not reported
as recorded until it is in this file.**

## The rule

- **Never say "recorded", "on the list", "tracked", "noted" or "deferred" without naming
  where.** If it is not in a file, the honest sentence is *"I have not recorded this"* —
  then record it.
- **Write the entry BEFORE reporting it**, not after. The report is what Ken acts on.
- **A comment cleared from a document because it belongs elsewhere gets an entry here
  first.** `resolve-review.py` refuses to clear a comment without a stated disposition.
- **Deleting an entry is a decision**, so say which one and why: done, dropped, or
  superseded.

## What belongs here

Work that has been identified, is not being done now, and would otherwise live only in a
sentence somebody has to remember. **Not** a duplicate of things that already have a
home: a shipped decision belongs in `CLAUDE.md`, a released change in `CHANGELOG.md`, a
document's state in `DOC-SYNC.md`.

## Format

Each entry carries the date it was raised, where it came from, what is wanted, and why it
is not being done now — the last one because an item with no stated reason for waiting is
the one that quietly waits forever.

---

## Open

### "OK" in the Deepgram voice spoke too fast to understand
- **Raised:** 2026-10-10 - Ken's problem report from his iPad (0.13.16, Deepgram voice
  aura-2-arcas-en, Home Screen app). The Express Panel button "OK" was hard to
  understand. (The report's note said "bye"; Ken corrected it to "OK" the same day.)
- **What the report shows:** the app plays the voice's recordings at the correct speed
  on every path, so the likely cause is the voice reading "OK" as two quick letters.
  "OK" is one of the shipped Always phrases.
- **What is wanted:** Ken tries "Okay" in that button's "How to say it" box and listens.
  If it fixes it, give the shipped "OK" button the spoken form "Okay" in
  `ALWAYS_DEFAULTS` (express-items.js), so new panels get it. The words on the button
  stay "OK".
- **Why not now:** it needs an ear; there is no Deepgram key on this machine.

### Documents that read as though eye gaze does not work yet
- **Raised:** 2026-10-10 - Ken: Conversant has been used with eye gaze and it worked; it
  should work wherever the eye-gaze equipment emulates a mouse. Recorded in `CLAUDE.md`
  under the access-method decision.
- **What is wanted:** reword these so "not built" plainly means a purpose-built eye-gaze
  layout, and say eye gaze works today through mouse emulation:
  - **Pragmatics:** "Scanning and eye gaze are planned and not built" (the worst one).
  - **Architecture Overview:** "Subsequent versions will expand accessibility... (switch
    access, eye gaze)".
  - **Express Panel Design:** "the access methods we haven't built yet", under scanning
    and eye gaze.
  - **UI-Design:** four places calling eye gaze a "design target, not yet built"; correct
    about the renderer, but needs the same clarification.
  - **The three User Manuals** never mention eye gaze; the Product Overview's Access
    Methods paragraph is the model for adding it.
  - **"One tap or two" (Ken, same day):** the manuals and the Product Overview should tell
    an eye-gaze user to choose One tap and set how long they must look at a button in
    their eye-gaze software instead. Two taps would mean two full looks within at most
    1 second, which likely cannot be done.
- **Why not now:** documents change at a "sync docs" Ken calls.

### The User Manuals: today's speech and fill-in features, with "how can I use it"
- **Raised:** 2026-10-09 - Ken: *"ensure that user documentation includes these kinds of
  'how can I use it' instructions."* Nothing below is in the three User Manuals yet.
- **What is wanted, at the next "sync docs" that Ken calls once these have settled:**
  - **"Words the voice gets wrong"** (Settings > Speech): what it is, and its uses -
    a medical term or brand name, an abbreviation said letter by letter ("lol" as
    "L O L"), and an abbreviation heard in full ("btw" heard as "by the way" while the
    screen keeps "btw"). Say that it applies to everything the app says, AI
    suggestions included, and that capitals do not matter.
  - **The user's own name in About Me:** the "how should it be said" question.
  - **Fill-ins:** their name and the time of day in Express and Commands phrases, the
    Insert buttons, what happens with nobody selected, and examples ("Have a good
    {time of day}!", "Thank you, {name}.").
  - **Hear buttons** on Commands phrases and on each word in the list.
  - **Holding phrases always finish**, and the user's words start half a second after.
  - **Fixed phrases kept on the device** in a paid voice, and that they are fetched
    after Start.
  - **The number page's decimal point**, and "Ask them to repeat" at rest.
- **Why not now:** documents wait until a feature has stopped moving, and Ken times
  "sync docs".
- **DONE 2026-10-09 ("sync docs" for 0.13.15):** all of it is in the three User Manuals,
  the word list with its uses; also the Product Overview, Backup Compatibility, Speech
  Provider Guide and Architecture Overview.

### Ken's October 9 2026 report: "Hi" not spoken, and words heard in a quiet room
- **Raised:** 2026-10-09, Ken's problem report from his laptop (0.13.14, OpenAI for both
  hearing and speaking): after turning "Don't save this conversation" off, tapping
  "Hi" said nothing, and a partner line appeared that nobody said.
- **What was found:** the same sequence in the browser with this device's voice spoke
  "Hi" both times, so the silence is not reproduced. The report could not help because
  of two faults, both fixed the same day: the conversation saved after turning saving
  back on reused the deleted conversation's name and was withheld as private, and the
  "what happened just before" list was empty because automatic reports were off.
- **The words from nowhere** look like the OpenAI transcription inventing text from
  near-silence, as with "Katarzyna." on September 30. The app already drops sounds under
  a quarter of a second; this one got past that.
- **What is wanted:** a repeat of the sequence with OpenAI on 0.13.15 or later, and a
  report sent right away; it will now carry the transcript and the event list.
- **Why not now:** it needs the OpenAI voice and a real microphone to reproduce.

### Check whether an opener tap can speak from the set that was just replaced

- **Raised:** October 8 2026, from Ken's conversation file `2026-10-08T21-15-47.json`.
- **What:** Ken chose "Mom" while the generic openers were showing. At 21:15:51.812 the
  openers were redrawn with Mom's ("Hey Mom, quick thing."), and 212 ms later the app
  spoke "Hey. Got a second?" from the replaced set; the record files the old set as
  chosen and the new one as cleared unused. Either a tap already under way landed as the
  screen changed (harmless), or a tap on the new set spoke the old set's text (a fault:
  the user hears words other than the ones under their finger). Ken does not remember
  the timing. Reproduce in the browser: openers showing, tap a partner, then tap an
  opener, and compare what is spoken with what was on screen.
- **Why not now:** found during a release; it needs a reproduction before a fix.

### Rewrite the Conversation Review design document for the October 6 2026 simplification

- **Raised:** October 8 2026, during "sync docs - all appropriate documents" for 0.13.11.
- **What:** `Conversant AAC Conversation Review.docx` still describes review as it was
  before Ken's October 6 2026 "Let's simplify everything": Previous Word and Next Word,
  answers that change the response options, reframe steers and the word editor. The
  Command Bar section also predates the Report and Delete buttons added in 0.13.11. It
  needs a rewrite to the one-action design (rewrite a turn) described in CLAUDE.md under
  "Conversation Review - one action".
- **Why not now:** it is a design record, not published, and nine releases behind. A
  0.13.11 patch would have put two new buttons into a description of a screen that no
  longer exists. It needs its own pass.

### Fix the problems found in the October 5 2026 code review

**Raised:** October 5 2026, by Ken, who asked for a review of the whole app that a later
session could work from.

**What is wanted:** fix the 303 problems listed in
[code-review-2026-10-05/README.md](code-review-2026-10-05/README.md), most serious first.
Each one has its own file in that folder, written so a separate session can fix it
without reading the rest. The first thirteen (one critical, twelve high) matter most:
a saved conversation that can be overwritten, a paid hearing service quietly swapped for
the free one after a restart, a repair card that crashes, edits typed on the app's own
keyboard that are never saved, and three ways private information leaves the device or
outlives a "Don't save" conversation.

**How to track it:** each item's Status column in the README goes from "open" to "fixed
(commit)" or "dropped" with a reason. Close this entry when nothing is left open.

**Why not now:** the review was the task; fixing is separate work, one item per commit.

### Bottom Layout 6 has two Backspace keys

**Raised:** October 5 2026, from code review item CR-189.

**What is wanted:** Ken's decision on which Backspace to keep on Bottom Layout 6: the
one at the end of the third letter row, or the one on the bottom row beside the period.
The other would become a blank space, so no key moves and a keyguard still fits; the
blank also becomes one more empty spot rather than an Express Panel position. The
layouts document flagged this ("pick one in the build") and the build kept both.

**Why not now:** which key a person reaches for is a choice for the people who use it.
- **CLOSED 2026-10-09:** no longer true. Bottom Layout 6 was folded into Bottom
  Layout 1 on October 8 2026, and no layout in the app has two Backspace keys
  (checked by counting them in every layout).

### The keyboard's number page has no decimal point or comma

**Raised:** October 5 2026, from code review item CR-254.

**What is wanted:** Ken's decision. The number button opens the keyboard on its symbols
page so a number can be typed, but on the usual layouts that page has no "." or ",":
answering "98.6" or "2.5" means switching back to the letters page in the middle of the
number. The keyboard code records that comma and period stay on the letters page by his
spec. Options: (1) put a decimal point on the symbols page in place of one of the rarer
symbols - no key moves, so a keyguard still fits; lean, since numbers with a decimal
point are common in medical answers; (2) leave it as it is.

**Why not now:** it reverses a recorded keyboard decision.
- **DONE 2026-10-09 (Ken: "Go for the & replacement"):** "." takes the place "&" had
  on the number page and "&" moves to where "." was, so it still shows on the two
  largest layouts. No other symbol moved. A test checks every layout.

### "Ask them to repeat" before anything has been heard

**Raised:** October 6 2026, from code review item CR-270.

**What is wanted:** Ken's decision. Tapping "Ask them to repeat" when the app has heard
nothing yet still says the phrase, writes it into the saved conversation as though a
conversation had started, and treats the other person's next words as a repeat. The
app cannot know whether the person spoke before listening was on, in which case this is
right. Options: (1) still say the phrase, but when nothing has been heard and nothing
has been said yet, do not record it or start a conversation file - lean, because a stray
tap then costs only a spoken phrase; (2) leave it as it is.

**Why not now:** whether a pardon at rest should count as the start of a conversation
is a choice about the record, not a fault.
- **DONE 2026-10-09 (Ken chose option 1):** at rest the phrase is spoken and nothing is
  recorded or started. Ken asked whether to disable the button instead; not done,
  because the other person may have spoken before Listen was on.

### Screen-reader heading navigation in Settings

**Raised:** October 6 2026, from code review item CR-269.

**What is wanted:** Ken's decision on whether to rebuild how Settings sections are made
so a screen reader's "next heading" key jumps between them. Today it finds nothing,
because each section heading sits inside a part of the page that browsers flatten for
screen readers. The fix is a rebuild of the section code that has to keep
one-open-at-a-time, remembered open sections, and the spoken help. Lean: leave it, since
the people this app serves rarely use a screen reader in Settings, and the rebuild
touches every Settings tab.

**Why not now:** a large change for a small benefit to this population.

### The "×" beside a sentence in "What the app has picked up"

**Raised:** October 6 2026, from code review item CR-286.

**What is wanted:** Ken's decision. In About Me, each sentence the app has learned from
the user's own conversations has a small "×". One tap stops the app using that sentence
as an example of how the user talks, for good; there is no undo. The sentence itself
stays in the saved conversation. Options: (1) ask first with the red confirmation card
("Stop using this?") - lean, since this population taps imprecisely and these sentences
are the scarcest evidence of how the user talks; (2) offer Undo until the screen is
left; (3) leave it as it is, since the standing rule asks for confirmation only for
"significant work".

**Why not now:** whether this counts as significant work is Ken's call.

### The mode chip's styling: delete it, or is it coming back?

**Raised:** October 5 2026, from code review items CR-175 and CR-179.

**What is wrong:** the conversation screen once showed a small "mode chip" naming what the
app was doing. It is no longer on the screen, but its styling and the code that draws it
are still in the app, and two notes (in the color settings and in CLAUDE.md) still treat
it as live. The other dead styling the review found has been removed.

**What is wanted:** Ken's answer: is the mode chip meant to return? If not, its styling
and drawing code can go, and the notes that mention it can be corrected.

**Why not now:** it may be a feature on hold rather than leftover code, which is Ken's call.

### A second tap while the first reply is still being spoken

**Raised:** October 5 2026, from code review item CR-077.

**What is wanted:** Ken's decision. With one-tap speaking, a second tap on a reply card
or an Express Panel phrase while the first is still being spoken cuts the first one off
and speaks the second. Both are then recorded, and sent to the AI, as if both were said
in full. Two choices: (1) ignore the second tap until the first has finished, which
protects against a stray tap but means the user cannot change their mind mid-sentence;
or (2) let the second replace the first and record the first as cut off. I lean to (1),
because a stray tap is the commoner case for this population and the double-tap setting
does not help someone who has it switched off. "Hold on" and stopping a sound stay
exempt either way.

**Why not now:** it changes what a tap does, which is Ken's call. The part that was wrong
either way is fixed: the first reply's ending no longer lets a holding phrase start over
the second.

### Settings profiles saved before October 5 2026: hold back the device settings or not?

**Raised:** October 5 2026, from code review item CR-067.

**What is wanted:** Ken's decision. A settings profile now records which kind of device
it was saved on, and loading it on a different kind of device leaves how the app hears,
the keyboard type, full screen and the screen edge margin as they are, the same as
restoring a backup does. Profiles saved before this change carry no such record, so the
app cannot tell where they came from. Today they are loaded whole, as they always were.
The other choice is to hold those four settings back for them too, which is safer on a
device the profile did not come from but changes what loading an old profile does on
the device that saved it.

**Why not now:** it changes how existing profiles behave, which is Ken's call.

### Side Layout 10 has no key to reach the symbols

**Raised:** October 5 2026, from code review item CR-044.

**What is wanted:** Ken's decision. On Side Layout 10 there is no key that switches to the
symbols page, so a question mark, an apostrophe, an exclamation mark and every other
symbol except comma and period cannot be typed. The fix the review suggests is to split
the space key on the bottom row into a symbols key plus a shorter space key.

**Why not now:** that changes where keys sit on Side Layout 10, so anyone with a keyguard
cut for that layout would need a new one. The other half of the item is fixed: the
number button no longer opens that layout on the symbols page with no way back.

### Silent "get me other options" buttons must not cut off a placeholder

**Raised:** October 1 2026, by Ken: *"pressing a 'reframe' button shouldn't interrupt a
placeholder statement. It's a silent action that simply requests more options from the
AI."*

**What is wanted:** a button that only asks the AI for a fresh set of cards, and says
nothing aloud, leaves a placeholder that is already playing alone. The placeholder is
holding the floor for the user, and asking for better suggestions is exactly the moment
the floor still needs holding.

**Where it happens today (checked against the code):** three such buttons stop the
placeholder ladder before asking the AI - "New N" (`handleRegenerate`,
`placeholders.stop()`), a choice button (`handleChoiceChip`, `abortPlaceholders()`), and
the compose window's Reframe (`handleReframe`, `placeholders.stop()`). The partner,
place, feeling and goal buttons (`refreshForContextChange`) already leave it alone, so
they are the pattern to follow.

**Decide while doing it:** whether the ladder also keeps going AFTERWARDS (a later
placeholder may still be due), or only the one already speaking is allowed to finish.
Ken's words cover the one speaking; the "In my own words" decision of August 25 2026
(composing is like reading the cards, so placeholders keep running) argues for the
ladder continuing too. Check that the choice button's comment ("nothing may speak over
the result") still holds - a placeholder is not the result, so the fix should not let
one start over freshly arrived cards either.

**Why not now:** Ken asked for it to be recorded, not built.

**ALSO THE LISTEN BUTTON (Ken, same day): *"same with pressing a button like the
'listen' button ... I pressed the button to turn listening off and the placeholder
statement was cut off."*** Turning the microphone off is just as silent and must not
cut off a placeholder either. **Unlike the three buttons above, nothing in the app's
code stops the placeholder on this path** (checked: `toggleListening` ->
`stt.stopListening` -> `handleSttStatus` calls neither `placeholders.stop()` nor
`tts.cancel()`), so the cause has to be found before it can be fixed. Two candidates:
(a) **the device** - on an iPad, closing the microphone changes the iPad's audio setup and
can cut off whatever is playing; (b) **a final result from the recognizer** - stopping
recognition makes it deliver what it last heard, and if that is the placeholder misheard
and it slips past the echo filter, `handlePartnerResumed` stops the placeholder
deliberately. **First step: reproduce on the computer and on the iPad.** Happens on the
iPad only → (a), likely needing the microphone close to wait until the placeholder ends;
happens on both → (b).
**Ken confirmed it was the iPad, in the Home Screen app, with the DEVICE'S OWN
recognizer doing the hearing** (he first thought it was Deepgram, then checked; his
problem report agrees). That recognizer was measured to deliver no results at all in the
Home Screen app (July 30 2026), so (b) has nothing to work with there, which points
strongly at (a).
**The fix to try first (Ken asked for it to be listed):** when listening is turned off
while a placeholder is playing, stop taking in speech at once but CLOSE THE MICROPHONE
ONLY AFTER THE PLACEHOLDER FINISHES. The button shows off immediately, nothing more is
heard, and the iPad has nothing to cut off. If the cause is (b) instead, the fix is to
ignore whatever the recognizer delivers after the user has turned listening off.
**First step either way: try it on the computer** (one minute) and on the iPad with each
hearing setting, to see which explanation it is.
- **DONE 2026-10-09 (Ken: "A placeholder phrase should always complete"):** New 4, a
  choice button and Reframe leave the ladder alone, like the Context buttons. Turning
  Listen off while a holding phrase plays turns the button off at once, ignores what
  is heard from then on, and closes the microphone when the phrase ends (8-second cap);
  a second tap in that moment keeps listening. Buttons that SPEAK still cut a holding
  phrase off, under the July 2026 rule. **Not yet checked on the iPad**, which is where
  the Listen case was seen: confirm there, then close this entry.
- **EXTENDED 2026-10-09 (Ken): the user's own words now WAIT for a holding phrase
  already playing**, reversing the July 2026 rule that a speaking button cuts it off.
  Ken: "one phrase stepped on by another makes both difficult to understand." The wait
  is capped at 4 seconds; End conversation still silences everything at once.

### The monthly provider review, running on the desktop rather than this laptop

**Raised:** September 30 2026, by Ken, after the app was found to have spent three months
on an AI model that was a generation behind and half again as expensive — noticed only
because he asked an unrelated question. Ken: *"a service just got better and cheaper and
we didn't know."*

**What is wanted:** a recurring session, monthly, that checks the provider side and
reports what changed. Four things: which models each provider now offers against the one
in use; published prices against `pricing.json`, which is the only one of the four that
cannot be automated at all; each service's real voice roster against the app's, which is
what closes the OpenAI and Deepgram gap; and a re-run of the eleven-service browser
reachability probe, since a vendor closing that door would silently end a configuration.
It reports and recommends nothing — whether a model is BETTER is a judgment no endpoint
answers, and a mechanical "newer and cheaper, switch" would have shipped the Sonnet 5.5
thinking trap.

**⚠ THE MODEL CHECK COVERS EVERY MODEL THE APP NAMES, NOT JUST THE AI ONE — and the
first review got this wrong, which is the reason it is spelled out.** The September 30
2026 review reported the AI model current and said nothing about the speech models, so
it missed that **the app was asking ElevenLabs to transcribe with a model ElevenLabs had
retired** — while pricing the replacement. It also passed over a whole new ElevenLabs
voice generation, mentioning it only in passing as "its newest voice" inside a note
about a sale. The app names a model for the AI, for each speech service that hears, and
for each that speaks; **all of them age, and a deprecated one fails in the way this
project keeps finding expensive — silently, looking like a refused key.**

**⚠ AND USE `prototypes/speech-providers.html` FOR THE REACHABILITY CHECK RATHER THAN
WRITING A PROBE. This is the trap, and it is not hypothetical: the first review wrote its
own throwaway probe and lost most of the check to a mistake the bench does not make.** A
fake key beginning `sk-` is discarded at OpenAI's edge before any permission header is
attached, so it reads as OpenAI blocking the browser when it is not — and the review
reported OpenAI blocked on every endpoint the app uses, including speaking, which was
wrong. The bench's fake key deliberately looks nothing like a real one, and it carries
the control case (AssemblyAI, expected to fail) without which "everything is reachable"
is equally consistent with a probe that cannot detect a failure. **Writing a fresh probe
rebuilds a worse version of a tool that already exists** — the same shape as every other
time this project has rediscovered something the hard way because the step that needed
the tool never named it.

**⚠ IT IS NOT PART OF CONVERSANT.** Nothing about it ships, deploys, or reaches a
tester. It runs on Ken's machine, for Ken. The part that IS in the app — the key Test
naming the model and any newer one, and the model and rates riding in tester reports —
shipped on September 30 2026 and is separate.

**Why it is not being done now:** a scheduled session belongs to the machine it is created
on, and this one is Ken's LAPTOP. He wants it on the desktop, which is always on: *"we'll
talk later about how to get it to run on my desktop."* The setup itself is short — the
same request made from Claude on the other machine — but it has to be made there.

**⚠ AND DO NOT ATTACH IT TO A RELEASE INSTEAD, which is the obvious shortcut.** Ken
ruled that out for a reason that only bites later: *"That may work well now given that
there are frequent releases but it could be a problem when Conversant goes public and
there are fewer releases."* Anchoring a time-based check to an event whose frequency is
about to fall by an order of magnitude is the trap.

### Nothing can check whether ElevenLabs transcription works at all

- **Raised:** 2026-09-30, while correcting the app from the retired `scribe_v1` to
  `scribe_v2` after the monthly provider review. Went looking for a way to confirm the
  change and found there is none.
- **What is wanted:** any route that proves a real key gets a transcript back from
  ElevenLabs. The app's ElevenLabs Test button asks for the voice list, so it proves the
  key and says nothing about transcription; the bench page does ElevenLabs speaking only;
  and there is no transcription test anywhere in the app for any of the six services.
- **Why it matters more than it looks:** ElevenLabs transcription has been in the app
  since September 8 2026 and has **never** been run with a real key — its own entry in
  the catalog says so, and says it was written from documentation, which this project
  measures at about a 50% error rate. So a user who picks ElevenLabs to hear may be
  getting nothing, and the app would bill them for it on screen either way.
- **Why it is not being done now:** the cheap version is adding ElevenLabs transcription
  to the bench, which needs a real ElevenLabs key — there is none on this machine. The
  thorough version is a transcription Test button per service, which is a new control on
  a panel Ken has deliberately decluttered, so it is his call.

### Does a genuinely revoked key come back unreadable, and does the app then blame the service

- **Raised:** 2026-09-30, by the monthly provider review, which found that a clearly-fake
  key beginning `sk-` is discarded at OpenAI's edge with nothing the browser can read.
- **What is wanted:** find out whether OpenAI's edge treats a real-looking-but-revoked key
  the same way. If it does, a user who pastes a truncated or revoked OpenAI key gets
  nothing the app can read, so the app tells them it could not reach the service when the
  truth is the key was refused — which is the exact misdiagnosis the failure-message work
  of September 30 2026 was aimed at.
- **Why it is not being done now:** **not established, and a fake key is not evidence.** A
  clearly-bogus `sk-` string and a genuine expired one are different things to an edge
  that may be pattern-matching the shape. Settling it needs a real OpenAI key that has
  been created and then revoked, which nobody here has.

### Bold lead-in phrases: keep them or not
- **Raised:** 2026-09-25 - Ken saw the Conversation Review document in bold from top to
  bottom and asked for plain text. The bold was an accident of the rewrite, but 94 of
  those paragraphs had carried a deliberate **bold lead-in phrase** before it, and
  clearing the accident cleared those too. The document now has no bold in its prose at
  all.
- **What is wanted:** Ken's decision. Either the document stays fully plain, or the
  opening phrase comes back on the list-style paragraphs so a reader can scan them.
- **Why it is not being done now:** he asked for plain text and got it; putting bold back
  is a change he has not asked for. The PLAIN STYLE rule in CLAUDE.md currently
  recommends bold lead-ins, so **whichever way he decides, that line has to match** - the
  rule and the documents cannot disagree.
- **Cost either way:** small. One pass over the list-style paragraphs.

### The rest of the documents still carry the old style
- **Raised:** 2026-09-25, when the PLAIN STYLE rule was written and the checks added.
- **The backlog, measured that day across roughly 40 documents:** 101 banned phrases as
  errors and 163 to review (L11), 692 sentences over 40 words (L12), 221 headings too
  long or carrying a colon (L13), 28 documents over the passive-voice limit (L14), and
  63 paragraphs bold end to end (L15).
- **Why it is not being done now:** a single sweep over every document is a large pass
  with no reader waiting on it, and each document reads better when somebody rewrites it
  rather than when a script clears its findings.
- **What is wanted:** clear the findings for a document the next time that document is
  touched for any reason. `check docs <name>` lists them.

### The list tool adds numbering definitions that nothing uses
- **Raised:** 2026-10-06 - found by the checker on the same day's wording pass over the
  Product Overview, the Beta Test Plan and the three User Manuals.
- **The finding:** each run of `scripts/doc-generators/fix-docx-lists.py` gives every list
  run a NEW numbering definition and leaves the old one in place. One run took each
  manual from 48 definitions to 72, with 24 in use; the Product Overview went from 74 to
  78 with 4 in use, and the Beta Test Plan from 39 to 43 with 4 in use. Word opens all
  five, and the integrity and numbering-id checks pass.
- **What is wanted:** have the tool reuse a list's existing definition when that list is
  already numbered on its own, or remove definitions nothing uses after it runs.
- **Why it is not being done now:** it does no harm today and was found during a wording
  pass. It only grows, so fix it before the definitions run into the hundreds.
- **Until then:** run `fix-docx-lists.py --check` first, and skip the real run when it
  reports 0 runs with items split across different numberings.

### Beta Test Plan still tells testers to get a free Deepgram account for speech
- **Raised:** 2026-09-21 - found while applying the public-release documents rule. Its
  "What you need" and set-up steps say to create a free Deepgram account for the voice, and
  to leave hearing on the free option everywhere except an installed iPad.
- **Why it is wrong now:** Azure is the Recommended service (2026-09-21), and Android needs a
  paid service to hear (Ken, 2026-08-31). Volksswitch has also not committed to paying for
  speech services in the beta; it MAY obtain a speech key for a tester.
- **What is wanted:** Ken's decision on the beta speech arrangement (tester signs up for
  Azure themselves with the three buttons, or Volksswitch obtains the key), then rewrite those
  passages to match.
- **DONE 2026-09-21:** Ken decided Volksswitch obtains each tester's Anthropic key and any
  speech key is arranged offline between him and the tester. The plan now names no speech
  service: it says who needs one, points to section 1 of the guide, and says to talk to us
  first. A duplicated half-sentence in set-up step 2 went with the rewrite.

### Internal design documents still refer to "Ken"
- **Raised:** 2026-09-21 - Ken's rule: in documents he is "the project" or "Volksswitch".
  The published documents are done. Still carrying "Ken" (count): Architecture Overview (2),
  Azure-Only Speech Proposal (1), Conversation Goals (6), Express Panel Design (5),
  Measurement Plan (5, plus 4 beta/payment lines), Sounds Like Me (10), Strategic Assessment
  (2, plus 1), UI-Design (1), Voice Files (2), Weekly Report Handling (1, plus 1),
  Worldview Implementation Plan (5).
- **What is wanted:** replace with "the project"/"Volksswitch" - but most are decision
  attributions ("Ken decided..."), where a mechanical swap reads badly and loses who made the
  call. Needs a per-sentence pass.
- **Why not now:** none of these is published, and Ken asked about the published documents first.

### Check that OpenAI, Google Cloud and ElevenLabs hearing are really used where hearing must be paid for
- **Raised:** 2026-09-21 - noticed while making Azure the Recommended service. When the app
  starts, the part that decides whether a paid hearing service is in use only looks for a
  Deepgram or an Azure key. Someone who chose OpenAI, Google Cloud or ElevenLabs for hearing
  may be treated as though they chose the free listening. On a computer that may not matter,
  but on an installed iPad or on Android the app might then say it cannot hear, or
  use the wrong one. Not confirmed; it may be handled somewhere else.
- **What is wanted:** read the start-up path end to end, and if it is a real fault, try
  each of the three on an installed iPad or Android with a real key.
- **Why not now:** outside the Recommended/order change being made, and it needs a real key
  for each service to confirm.
- **Update, October 5 2026:** the code review read the start-up path and confirmed it is a
  real fault: after every restart those three services are replaced by the free listening,
  with nothing on screen saying so. It also found a second way in that affects Deepgram and
  Azure too: a key pasted after choosing a service is not picked up until the next restart.
  The fix is item [CR-002](code-review-2026-10-05/CR-002.md). Trying each service on a real
  device with a real key is still wanted once it is fixed; close this entry then.
- **Update, October 5 2026 (later):** CR-002 is fixed. Checked in the browser with a
  made-up key: OpenAI hearing survives a restart, and a Google key pasted after a restart
  is picked up at once. What remains is the real-device, real-key check above.

### Speech Provider Guide and Azure set-up: the 19 September change list
- **Raised:** 2026-09-19 - assembled over the Azure pricing review and Ken's fresh-account
  Azure trial (a session run from the keyguard folder). **It was kept only in that
  session's temporary folder and never reached this file** - found and moved here
  2026-09-21, copied verbatim below.
- **What is wanted:** the items below. Items 3, 13 and 14 are already standing rules in
  `CLAUDE.md`; item 9 corrects something the guide gets wrong today on the recommended
  (Azure) path.
- **Why not now:** it was waiting on the SLP's view of the Azure-only proposal. That is
  settled differently now - on 2026-09-21 Ken chose to make Azure the *Recommended* service
  rather than the only one - so these are unblocked, and are Ken's call on timing.

1. Azure speaking price: $16 -> $15 per 1M characters (section 3 table). $15 in every
   commercial region since Feb 2024; only US Gov regions differ ($18.75). Update
   "read on September 2 2026" to September 19 2026.
2. Add note on Azure free-tier (F0) throttling: speaking capped at 20 requests per
   minute, listening at 1 conversation at a time; neither can be raised. A burst of
   pre-fetched phrases could be refused and look like a bad key. Paid (S0): 30/second.
3. State plainly (section 2, "What a key is"): Conversant never sees or has access to
   your password or credit card - those are typed only into the provider's own site.
   The only thing Conversant stores is the API key(s), on your own device.
   (Current text says Volksswitch never sees the key - true, but silent on passwords/cards.)
4. Guide, Azure sign-up steps: replace the manual portal steps with the set-up link
   (sign in -> pick Region -> Review + create -> Create -> Outputs -> copy key and region).
   "Next" and "Review + create" go to the same place; tell people to press Review + create.
   Leave the Subscription name as Azure gives it.
5. Guide, new "Removing it" steps, as easy as setting up: (a) remove the speech service =
   delete the conversant-speech-<region> resource group; (b) close the Azure account
   entirely = cancel the subscription. Mention the deleted-service waiting period.
6. Guide, Azure sign-up: say you need a Microsoft account; if you use Windows or Outlook
   you probably have one, and if not, your ordinary email (Gmail etc.) becomes one during
   sign-up.
7. Guide, Azure sign-up: cutting Microsoft's promotional email - uncheck the offers box
   during sign-up; use the unsubscribe link ("stop all") on the first one; billing,
   security and retirement notices keep coming and should. WORDING TO CONFIRM FROM
   KEN'S FRESH-ACCOUNT TRIAL (was the box there, was it pre-ticked, was "stop all" offered).
8. Guide + wherever the app shows the set-up link: the Azure sign-up (phone, card,
   agreement) must be FINISHED first. A Microsoft account alone can open the portal and the
   form, but the Subscription box is then empty and Region says "Loading..." forever, with
   no explanation. Say: "If the Subscription box is empty, you haven't finished signing up
   for Azure - go to azure.microsoft.com/free." (Found in Ken's fresh-account trial.)
9. Guide, CORRECTION: the ordinary Azure free trial DISABLES the whole subscription after
   30 days (or when the $200 credit is used) unless upgraded to pay-as-you-go - and the F0
   speech service stops with it (Microsoft Learn, "Avoid charges with your Azure free
   account"). The guide's "survives after the introductory credit expires" is only true
   after that upgrade. Recommend signing up DIRECTLY for pay-as-you-go
   (azure.microsoft.com/pricing/purchase-options/pay-as-you-go): no 30-day cutoff, F0 still
   free. Also: check the beta testers' accounts - Ken's shows "Upgrade", i.e. still a trial.

10. Guide, Azure steps: the sign-up button is called "Pay as you go". Where to click in Azure
    is inconsistent (sometimes a row in a table, sometimes a tab) - use pictures, dated, and
    prefer DIRECT LINKS to the exact page (e.g. the resource-groups list) so there is less
    to click through and less to break when Microsoft redesigns.
11. Guide: after sign-up Azure shows a "Mandatory Azure MFA" pop-up. Say it can be closed;
    it concerns developer tools, and a Conversant key is unaffected by it.
12. Guide, "Removing it": there is no single "Azure account" to close. Microsoft account =
    who you are; billing account = who pays (holds the credit card); subscription = where
    services live and charges are made. Cancelling the subscription is enough to be sure of
    no charges; removing the credit card and closing the Microsoft account are optional.
13. Everywhere: say "credit card", never just "card" (Ken, 19 Sep 2026).
14. Everywhere user-facing: no references to "the bench".

(The Azure-only draft for SLP review is now `Documents/Conversant AAC Azure-Only Speech Proposal (draft for SLP review).docx`; the online draft was deleted.)

- **DONE 2026-09-21 - items 1-14 (the guide):** all applied to the Speech Provider Guide;
  the Azure price correction (1.5 cents per 1,000 characters) also went into the three User
  Manuals. Two judgment calls: item 7 is written as "if the form asks... leave it unchecked",
  because the fresh-account trial never confirmed the box or the "stop all" option; item 10's
  pictures are left for Ken, who is reviewing the guide to insert screenshots from his run.
  Direct links are used for the set-up link and the resource-group list. The testing page is
  no longer mentioned; section 7 now tells people to compare voices inside Conversant.
- **DONE 2026-09-21 - items A-C (the app):** A - the Region box is a plain box with a Paste
  button, beside the key (Ken: "to the right of the Azure Speech box"), and Test is
  unavailable until both are filled in; the silent "eastus" default no longer shows in the
  box (an existing Azure user without a stored region gets "eastus" written down, so
  nothing breaks). B - three buttons (Ken, 2026-09-21: nobody starts with an Azure
  account, so the question is whether they have a MICROSOFT account): Microsoft account
  sign-up, pay-as-you-go Azure sign-up, and the set-up link, each in a new tab. C - the refusal message names a deleted service and a
  canceled or switched-off subscription.
- **STILL OPEN from B:** whether Microsoft's sign-up can be made to land directly on the
  set-up form when it finishes. Not tried; it would need a fresh-account run.

### Public-facing documents move to a user-manual tone, with no justification
- **Raised:** 2026-09-27 - Ken, on being told the Conversation Review generator has no
  stated goals: *"These documents need to change to a 'user manual' tone and style. We no
  longer need to include 'justification' statements in these documents."*
- **What is wanted:** every public-facing document says what the thing is and how it
  works, and stops arguing for it. A sentence whose job is to persuade the reader that a
  decision was right comes out. The reasoning still lives in `CLAUDE.md`, which is where
  a future session looks to avoid re-arguing a settled decision - it just stops being
  printed for the reader.
- **Why it is not being done now:** it is a pass over roughly thirteen documents and Ken
  has asked for the Conversation Review first. Doing them one at a time, as each is next
  touched, is the same rule already in force for the banned phrases and the long
  sentences.
- **Note:** this is a THIRD writing rule, alongside PLAIN LANGUAGE (vocabulary a
  non-programmer can follow) and PLAIN STYLE (writing a reader gives up on). It removes
  material the other two leave in place, so it needs its own line in CLAUDE.md.

### Conversation Review: what the first build left out
- **Raised:** 2026-10-01 - Ken asked for the feature in "Conversant AAC Conversation
  Review.docx" to be implemented. The first build covers choosing a conversation,
  moving through it, and recording every kind of answer to a file beside the
  conversation. These parts of the design are not built yet:
- **Revised 2026-10-03 after Sarah's comments on the prototype** (one SLP; her PDF is
  "Sarah's input - original.pdf" on Ken's Desktop). Ken's decisions are folded in below.
- **WHY THIS FEATURE MATTERS, and it decides the order of everything below (Ken,
  2026-10-03):** review is Conversant's single biggest answer to "it doesn't sound like
  me." Sarah expects clients to use it "one now and then", and Ken keeps it anyway. **The
  condition is that a review must visibly change how the app sounds.** Today it does not:
  answers are saved to the review file and nothing reads them. A user who reviews and
  sees no difference has wasted their effort, and will not review again.
- **DONE 2026-10-03: review answers feed the voice examples.** Typed sentences and
  reworded response options become voice examples, ahead of words composed live; a
  response option marked closer replaces the live choice; any other answer withdraws the
  live choice. The voice examples are rebuilt when the user leaves a review.
- **DONE 2026-10-03: an Express button chosen in review counts in the length measure**,
  as a choice of a short, ready-made reply over the four offered. It is never a voice
  example (it is a button label). "A different set" teaches nothing about the voice; it
  only withdraws the live choice.
- **Measure whether each review lesson is right** (Ken, 2026-10-03: *"It would be great if
  we could actually measure some of these guesses to know which ones are correct, close,
  or no ops."*). Each kind of review answer is now its own entry in `REVIEW_LESSONS`
  (voice-harvest.js), can be removed alone, and the harvest counts what each one
  contributed. Still wanted: a way to tell whether a lesson helped. Candidates: the
  share of turns answered from a response option without asking for a different set,
  before and after a lesson starts contributing; or showing two sets side by side, with
  and without a lesson, in a practice conversation. Needs beta data first.
- **Leaving a review may be slow with a long history.** It rebuilds the voice examples
  from every saved conversation. If testers notice, update only the conversation just
  reviewed instead. Not measured.
- **LATER, after beta testers have used review: Express Panel buttons and About Me
  facts** (§8, §13.3). Each still needs its own "do you want this?" step at the moment
  it applies, not a separate screen; Sarah was confused by the "what comes of it"
  screen. About Me facts only for clear, lasting facts (Sarah, agreed). **The practice
  question** (§9, true or made up) belongs with the About Me offer.
- **Play it back at real speed** (§7): stays on this list, last. Its button came off
  the review bar on 2026-10-03; "Jump" (next turn where you asked for something else)
  took its place, and is grayed out when no such turn is left.
- **A light bulb on a reviewed turn** (Ken, 2026-10-03). Tapping it opens a dialog that
  lists what the app learned from that turn and how it will change future
  conversations. **First the app has to get better at deciding what it learns** - it
  should not announce lessons it is not sure of. A first version, a whole-review summary
  on the review bar, was built and taken out the same day.
- **DONE 2026-10-03: the list can be cut by date** (last week by default each session,
  last month, last three months, any time). Older conversations are skipped by file name
  without being opened, and a line says how many are hidden, with a button to show them.
- **The turn screen stays as it is** (Ken chose to wait for more reviewers or a tester).
  Sarah called it "a lot"; Ken's view is that needing two taps to edit a card's wording
  already keeps editing out of the way.
- **The "turns you asked for something else" count on the conversation list stays**
  (Ken, disagreeing with Sarah's "steers them too much"). It comes from what the user
  did live (New 4, typing their own words), so it points at the turns where the app
  missed their voice, which is where review is most worth the effort.
- **The beta counts** (§8.1): how often review is used, in the weekly report. Wanted
  before deciding how much more to put into review.
- **2026-10-06, from the Sounds Like Me evaluation:** as wired before that day's
  changes, review is expected to return less than it costs if voice is the return being
  counted. At realistic amounts of reviewing the evaluation could detect no change in
  the best-guess option, though it could not rule out a small gain. So the condition
  above, that a review must visibly change how the app sounds, is not yet shown to be
  met. The same day's changes made Reframe instructions typed in review count, and keep
  typed answers of under four words as short replies. What remains is in "Sounds like
  me: what the October 6 2026 evaluation left to do", below: its item 1 is the candidate
  measure for "Measure whether each review lesson is right", and items 7, 8, 28 and 30
  cover review. The beta counts above are still not built. Two parts of the design were
  also found not built and were not on this list until now: turning a complaint about
  timing into a setting, and the misheard "report to us" (item 28).
- **Why not now:** the rest waits on beta feedback.

### A clinician support tool
- **Raised:** 2026-10-03 - Ken, from Sarah's answers on the review prototype: offering
  to add a fact to About Me is "a requirement for a clinician tool", and summaries of how
  a week went are "only for a clinician".
- **What it is so far:** a separate tool for the user's SLP, alongside the app, not part
  of it. Known contents: (a) weekly summaries for a client - how often they talked, how
  often suggestions were used, what review found; (b) the "add this to About Me?" offer
  for clear, lasting facts, with the clinician helping decide. It overlaps "An SLP
  authoring practice conversations for a client to exercise" below, which is the same
  person wanting a way in.
- **What is wanted first:** a fuller description - who uses it, on what device, how a
  client's data reaches it and with whose permission, and what it never sees (a real
  conversation carries the words of a partner who never agreed to be reviewed).
- **Why not now:** it is undescribed, and it should be shaped by what clinicians ask for
  during the beta.

### Sounds like me: what the October 6 2026 evaluation left to do
- **Raised:** 2026-10-06 - Ken asked whether Conversant's suggestions can "sound like"
  the user. The evaluation is written up as
  `Documents/Conversant AAC Sounds Like Me Evaluation.docx` (being written the same day).
  Ken then said "do all three": record the findings here, make the free fixes, and turn
  the report into that document.
- **What is listed here:** every finding and avenue the same day's changes did not
  cover. Those changes are not repeated here. Among them, the length measure now
  compares like with like and is checked against How I Sound, and practice conversations
  are left out. Reframe instructions with the same meaning are grouped and can be kept
  with one tap in About Me.
- **Avenue numbers** refer to the evaluation's ranked list of other avenues. Avenue 2
  and most of avenue 3 were done on October 6. Avenue 8, editing an option before
  speaking it, is "I, Robot?" item 3, below.
- **Why measurement comes first:** About Me is likely to make the suggestions fit the
  user's life (facts appeared where questions invited them), but for a terse or slangy
  user it changed the wording little and made options longer.
  At realistic amounts of reviewing, no change in the best-guess option could be
  detected. Nothing in the app measures whether suggestions sound like the user, so
  nothing below can yet be shown to work.
- **The order:** items 1-3 measure; 4-16 are other avenues; 17-19 are deferred, each
  with a trigger; 20-31 are faults and gaps found and not fixed; 32-34 follow from the
  October 6 changes.

#### 1. Measure it: a blind "which would you say?" check, and a first-set count
- **Raised:** 2026-10-06 - the evaluation's avenue 1, ranked first because without a
  measure nothing else here can be shown to work.
- **What is wanted:**
  - **(a) A blind check each month,** offered and never required, about 5 minutes. The
    app shows about 12 of the user's own past partner turns. Under each, in random
    order: today's best guess, and one made with About Me's facts but without the voice
    parts. The question is "Which would you say?" Two or three items repeat later to
    show how consistent the user is with themselves. It can reuse the How I Sound screen.
  - **The user's own answer as a third choice:** the user's own typed answer, live or
    from review, can be a third choice, as long as that conversation is kept out of the
    example sentences. This is also how review answers become a yardstick for whether
    the voice parts work at all.
  - **(b) A weekly count** of turns answered from the FIRST set offered, with no New 4,
    Reframe or typing, from data already on the device.
- **Why a comparison is needed:** people rate AI text as sounding like them even when
  their measured style says otherwise (Baumler et al. 2026, and the choice-blindness
  studies). A rising share of picks can also mean the user is deferring to the app.
  Only a comparison against a version without the voice parts tells the two apart.
- **What five testers can show:** one tester needs 18 wins out of 24 to show a
  preference alone. Pooled, five testers at 36 items each detect a 60-to-50 preference
  about 75% of the time, if the testers are alike. A live test that turns the voice
  parts off for half of real conversations needs about 390 sets each way and is not
  recommended. An alternative that degrades no turn shows one option made with the
  profile and one without in each category. It needs about 194 picks, but it doubles the
  reading and adds a second request.
- **Why not now:** the blind check needs a design - where it sits, and how the version
  without voice is made on the device, since conversations never leave it - and Ken chose
  the free fixes first.

#### 2. "Chosen from a card" counts more than its name says
- **Raised:** 2026-10-06 - the evaluation (avenue 1).
- **The finding:** the usage summary's "Chosen from a card" counts any pick of a
  response option. That includes picks made after New 4 or Reframe, picks from the fixed
  openers, wrap-up statements and goodbyes, and repeats of the user's last line. On the
  test data it reads 47 of 60 turns (78%); the strict figure is 36 of 60 (60%). The beta
  evaluator prints it as "A suggestion was good enough", one of the beta's two headline
  numbers, which CLAUDE.md defines as turns spoken from an AI-written option without
  asking for others.
- **What is wanted:** count only picks from the first AI-written set offered for that
  partner turn (the weekly count in item 1), and make the beta evaluator's label match.
  (In the code: `FROM_CARD` in usage-summary.js; `scripts/beta-eval/aggregate.mjs` and
  `render.mjs`.)
- **Also rename the on-screen labels.** Settings > Troubleshooting still says "card" in
  three places: "Chosen from a card", the "From a card" column of the week table, and
  "... cards, about ... words each". They should say "response option" (for example
  "Chosen from the first response options offered"), as the rest of Settings has since
  CR-205.
- **Why not now:** it changes a headline beta number, and reports already in the Sheet
  were counted the old way, so the beta evaluator has to tell the two apart by version.
  It belongs with item 1.

#### 3. A persona test before any model or prompt change
- **Raised:** 2026-10-06 - the evaluation (avenue 1). So far a change of model has been
  checked for speed, cost and usable options, not for voice.
- **What is wanted:** before a change of model, model settings or instructions, run the
  two test personas (Marc, terse and slangy; Grace, gentle and polite) through the
  evaluation's method of adding one layer at a time, and compare with the last run.
  About $2 a run. It can also try settings nobody has tried: the model's thinking
  setting, and a randomness setting, which the app does not set at all.
- **Read it as a check that nothing got worse, not as proof of voice:** the evaluating
  agent wrote the personas and their lines, the same model writes and judges, and for
  Marc the score mostly measures length and common casual words.
- **The first run is owed now.** The October 6 changes themselves change what the AI is
  told, and none was persona-tested: the new length instruction, the user's own
  sentences coming before How I Sound, the note about typing effort, and kept
  instructions.
- **Why not now:** the scripts that ran it are in the evaluation session's temporary
  folder, not in the project, and that folder goes when the session ends. They need
  moving under `scripts/` with a trigger phrase first.

#### 4. Let the user's own evidence outrank the fixed style rules
- **Raised:** 2026-10-06 - the evaluation's avenue 4.
- **The finding:** the fixed instructions carry firm style rules. A decline must have a
  softener, the decline and a reason, and never a bare "No". No reply opens with "Oh",
  "Well" or "So". An answer to an either/or question is a full sentence. Ordinary
  questions get a warm answer. Nothing says which wins when these disagree with the
  user's own examples. Marc's dinner decline contained "I'd love to (or like to), but..."
  in 12 of 12 runs, and 1 of his 96 decline options used his own style. "Wiped", which
  appears in the instructions only in the decline rule's example, turned up in his
  options in 6 of 9 setups. Three of his own How I Sound picks break the opener rule.
- **What is wanted:**
  - **(a) The user wins over a style rule.** One line saying that where the user's own
    sentences, kept instructions or per-person note conflict with a style rule, the user
    wins.
  - **The safety rules stay absolute:** no invented facts, no outside knowledge, no
    vulgarity, speakable text.
  - **(b) The user's own examples beside the rules:** their own declines beside the
    decline instruction, and their own clarifications beside the clarify instruction.
  - **(c) Length as a number** ("about 4 words"), worked out on the device, instead of
    "shorter" or "fuller".
  - **(d) Neutral fixed examples.** The 40 to 50 fixed example phrasings written as if
    the user said them ("I'd love to, but...", "I'm pretty wiped today") removed or made
    neutral.
- **Why not now:** these rules reflect earlier decisions (the empty-opener rule of
  v0.3.9, and a decline that gives a reason), so reversing them is Ken's call. A bare
  "No" can read as rude to a stranger, so relaxing the decline rule may belong per
  person. Any change needs the persona test (item 3).
- **Ken's direction, 2026-10-06:** *"Since these are adults, it seems that they should."*
  Proposed boundary, awaiting his OK: the user's own words outrank rules about HOW to
  say something (softened declines, banned openers, full-sentence answers, the fixed
  example phrasings). They don't outrank rules about WHAT may be said: no invented facts
  or events, no outside knowledge, no vulgarity unless chosen for a person, and text a
  voice can say.
- **Tested 2026-10-06 (Ken: "carry out the test plan"), about $4.60. These are results
  of a test of proposals still waiting for Ken's decision; nothing in the app changed.**
  The plan was `scripts/voice-eval/TEST-PLAN-instructions-and-review.md`, Test A. Four
  changes were made to the instructions on their way out: the user's words win over
  rules about HOW to word a reply; the app's sample wordings ("I'd love to, but…",
  "I'm pretty wiped today", the in-between answers) come out; the user's own ways of
  saying no sit beside the decline rule; and one everyday word of theirs may appear once
  in a set. Marc and Grace, 8 partner turns, 5 samples each, judged blind.
  - **Marc did not clearly sound more like himself.** First option: 8 wins, 7 losses, 25
    ties (0.51). The set of four: 12 wins, 2 losses (0.63), short of the 0.65 bar set in
    advance. Too few same-length pairs to rule length in or out.
  - **His casual words did not rise:** 6 per 100 options, against 8 under today's
    instructions (and 16 in a second batch of today's, so this measure is noisy).
  - **His own way of saying no rose a little:** 4 of 15 declines, against 2 of 15 today
    (and 1 of 96 on October 6). "I'd love to, but…" fell from 10 of 15 declines to 2;
    most became "Thanks for asking, but I can't make Friday", plainer but still not much
    like him.
  - **Grace was not harmed:** judged even (0.54 and 0.49), first option still about 13
    words, polite words unchanged.
  - **Safety:** no vulgarity, catchphrase or unsayable text in 1,340 options. **One probe
    failed after the one allowed rewording:** a stranger's joke about the Packers drew a
    jab back at the stranger ("or just here to enjoy my pain?") in 4 of 10 sets, against 0
    of 5 today, although his profile says he teases only people he is close to. The first
    draft also once invented an event about his dog; the rewording fixed that. Also seen:
    asked "So what happened to you?", 7 of 10 sets offered his About Me line "My body
    doesn't cooperate, but my mind is sharp" to a stranger.
  - **Ken's check by eye (2026-10-06):** all six sets turning down a stranger's favor
    were OK, current and new. All three "Coffee or tea?" sets under today's instructions
    were wrong, all three under the new ones OK. The fault was the fourth option, "What
    are you having?", which is out of place at a café counter. That is one of the sample
    wordings the change takes out of the rule about turning the question back, and with
    it gone the AI offered "What kind of tea do you have?" instead. He agreed with the
    judge on only 5 of 8 blind pairs, so the judge's numbers are weak.
  - **What it means:** taking the sample wordings out changes how declines sound, but by
    itself the rearrangement did not make Marc sound more like himself, and it loosened
    one profile limit on teasing. Test B (under item 8) found that the new instructions
    help most once there is real evidence from the user, such as rewrites.
  - **Limits:** invented personas, the judge is the same kind of AI, Marc is 17 while the
    reason for letting the user win assumed adults, and the per-person note is ranked
    above the fixed rules although a parent may have written it (item 10).
  - **Found in passing, separate from the test:** with Devon, the app suggests two of
    Marc's own Express Panel buttons ("Get on voice chat", "Rematch") about as often
    under today's instructions as under the new ones, although the instructions tell it
    not to.

#### 5. A short version of each response option that can be spoken
- **Raised:** 2026-10-06 - the evaluation's avenue 5.
- **The finding:** each response option carries a 1-to-3-word label. When "What a
  response option shows" is set to "The short version", the user sees that label while
  the device speaks the full sentence, about 9 words. So a terse user can see terse words
  and still be heard saying long ones.
- **What is wanted:** a third form for each option: a short version of the same reply
  that can actually be spoken, about 3 to 5 words, made in the same request. Each pick
  then records a clean style choice - the same content at a different length - which the
  voice plan says is needed to learn about voice.
- **Why not now:** a small-to-medium build that changes the reply format, and the
  instructions that describe the format must change with it (the service has enforced
  the reply's shape since October 1 2026). How an option shows a third form is a display
  decision for Ken.

#### 6. "The app suggested this, the user said that" pairs, by partner
- **Raised:** 2026-10-06 - the evaluation's avenue 6.
- **The finding:** the app already saves a set of response options the user turned
  away from, the Reframe instruction or typed words that followed, the reply finally
  used, and who the partner was. A reworded option in review keeps both versions. The
  reading of past conversations uses only the end of each episode: a typed reply becomes
  an example with no context, and the rejected set, the original wording and the partner
  go unused. The test data has about 0.35 such episodes per conversation.
- **What is wanted:** send the two to four most recent pairs for the current partner
  with each request. Optionally, an occasional extra request turns them into a short
  style note.
- **Evidence and risk:** learning from contrasts (TICL, 2025) and from similar past
  situations (CIPHER, 2024) worked in tests, but with archived text and simulated users,
  not live ones. Rejected wording can leak back into the options.
- **Why not now:** a medium build that changes what goes into every request, so it
  needs the persona test (item 3) first.

#### 7. Review answers that still change nothing
- **Raised:** 2026-10-06 - the evaluation's section on Conversation Review.
- **The finding:** after the October 6 changes, three kinds of review answer are still
  saved and shown again on the review screen, and change nothing else. They are the
  "should have known" marks (partner, place, feeling, goal), the "it misheard" flag with
  what was really said, and the original wording of a reworded option. Example sentences
  and the length reading still apply to every partner: a sentence written for Mom
  applies equally to a store clerk. (A Reframe instruction can now be kept for one
  person, and a request made repeatedly only with one person stands only for them;
  nothing else is tied to a person.)
- **What is wanted:** decide what each of these should change, and tag every lesson
  with the partner and place so that only the matching ones are sent. The reworded
  original belongs with item 6.
- **Why not now:** each is a design decision. A misheard flag carries what the partner
  said, which is never sent automatically, so what it could feed (a count in the weekly
  report, a measure of how well the app hears) needs deciding first.

#### 8. Rebuild review around tapping
- **Raised:** 2026-10-06 - the evaluation's avenue 7.
- **The finding:** typing is most of review's cost. A modest review (10 turns, 2 closer
  marks, 1 reworded option, 1 eight-word typed sentence) comes to about 23 taps and 60
  typed characters, 6 to 8½ minutes at 5 words a minute. The user is never told what a
  review changed.
- **What is wanted:**
  - **(a) Versions to tap instead of typing.** When the user picks an option in review,
    two or three versions of the same content in different styles (shorter, more casual,
    warmer).
  - **(b) A one-tap reason for the miss:** too long, too formal, too polite, wrong idea,
    missing fact.
  - **(c) A "turns worth a look" walk** that skips turns with no sign of trouble.
  - **(d) A summary of what the review changed,** when the user leaves - the
    whole-review form of the light bulb in "Conversation Review: what the first build
    left out", above.
- **Risk:** the restyled versions come from the AI, so they stay within its range.
- **Why not now:** a medium redesign of a feature that is waiting on beta feedback, and
  Ken chose to leave the turn screen as it is until more reviewers or a tester have used
  it. (d) was built once as a whole-review summary and taken out on October 3 2026,
  because the app should not announce lessons it is not sure of (the light-bulb entry
  above). It waits on the measure in item 1. About Me's "What the app has picked up"
  list also does not mark which lines came from a review.
- **BUILT 2026-10-06 (Ken: "Simplify the review process as described").** Review is now
  one action: pick a turn, the Composition Pane opens with what was said at the time (Save
  and Clear in place of Speak and Reframe), and the whole reply is saved. A rewrite with a
  known person is a pair kept for that person only and sent while talking with them;
  struggled turns carry a bar; what the partner was doing is saved with every set of
  options; the tab says several rewrites do the most. Also built: an About Me box for
  words the user uses a lot with one person. Not built from the list below: using each
  pair as a test item for item 1. The User Manuals still describe the old review screen.
- **DECIDED by Ken, 2026-10-06: review becomes one action, a complete
  rewrite.** *"Let's simplify everything."* This replaces (a), (b) and an earlier
  same-day plan of eight restyled versions to tap.
  - **The user picks the turn they want to change, and the Composition Pane opens.** It
    holds the words that were spoken at the time, with Clear available, in the normal
    text box with word completion. The user writes the whole reply they would rather
    have said.
  - **Nothing else is kept from today's review screen:** no closer marks, no choosing a
    different option, no Express buttons, no in-place word editor. The evaluation found
    those answers changed almost nothing the AI sees.
  - **Each rewrite stands alone as a pair:** what the partner said, and what the user
    would rather have said. The conversation might have gone differently after a
    different reply; the app makes no attempt to account for that.
  - **Each pair is also a test item** for item 1: what the app offered against what the
    user wanted, for the same moment.
  - **Each pair is tagged with the moment:** the person, the goals switched on, what
    the partner was doing, the kind of reply, place and feeling, and the partner's
    words.
  - **What the partner was doing is not saved today** (Ken: "add it"). The AI works it
    out on every turn (asking, inviting, sharing news, greeting, wrapping up); save it
    with the set of options in the conversation file. Small, and useful for measurement
    as well, so it can go ahead of the rest.
  - **Turns with known struggles get a clearer mark;** any turn can still be reviewed.
  - **Decision time is not used as a signal** (Ken): reading time and how much a reply
    matters make it hard to read.
- **Tested 2026-10-06 (Ken: "Run the review"), about $3.90.** Six review lessons for Mom,
  each tagged with what she was doing and paired with her words, were given to the AI
  only when talking with her. They were compared with no review and with today's review
  of the same answers, on eight new Mom turns, three samples each, judged blind against
  an invented reference for how Marc talks with her. Scripts:
  `scripts/voice-eval/2026-10-06/exp-review-moment/`.
  - **With Mom's "how I talk with them" settings filled in, neither form of review beat
    no review.** The AI was already short, warm and said "I'm fine" first. The tagged
    lessons lost slightly (5 wins, 10 losses on the first option; not conclusive).
  - **Without those settings, the AI's own guess for "Mom" was already close.** Today's
    review did a little better on the whole set of four (10 wins, 3 losses; not
    conclusive). The tagged lessons made replies about a word longer and lost on the
    first option (4 wins, 11 losses; not conclusive).
  - **What it means:** review can only pay back where the AI's guess differs from how the
    user really talks with that person. For Marc and Mom the gap was small. **Untested:**
    a person the user talks with in a way the AI wouldn't guess, which is the case review
    exists for.
  - **Limits:** invented persona and lessons, 24 comparisons per pairing, and the judge
    mostly preferred whichever reply was shorter.
- **Tested again 2026-10-06, review by rewrite (Test B of
  `scripts/voice-eval/TEST-PLAN-instructions-and-review.md`), about $9.60. These are
  results of a test of proposals still waiting for Ken's decision.** Two partners where
  the AI's guess is wrong: Devon (Marc teases him and uses slang) and Mom with her "how I
  talk with them" settings removed (Marc is blunt and teases her). A check first
  confirmed the gap: Marc's rewrites beat the AI's own first guess in 12 of 12 Devon
  comparisons and 16 of 16 Mom ones. Each rewrite was given to the AI as a pair (what the
  partner said and was doing, what Marc would rather have said), for that person only.
  Ten new turns per partner, 4 samples each, under today's instructions and the new ones
  from item 4.
  - **A full review helps, clearly, for both partners and under both sets of
    instructions** (rewriting every turn: 6 for Devon, 8 for Mom). Win rates against no
    review ran 0.66 to 0.89; for example Mom, new instructions, set of four: 31 wins, 0
    losses.
  - **The smallest review (one rewrite per conversation) did not clear the bar** set in
    advance under the new instructions. Devon: even (0.51 and 0.54). Mom: the set of four
    improved (24 wins, 0 losses), the first option only a little (13 wins, 4 losses,
    0.61).
  - **The full review added a lot over the smallest** (0.63 to 0.74 under the new
    instructions, 0.61 to 0.76 under today's), so asking for one
    rewrite per conversation leaves most of review's value behind.
  - **Today's instructions did not hide review's value.** Review helped as much under
    today's instructions as under the new ones; for Devon the smallest review actually did
    better under today's (first option 0.70 against 0.51).
  - **The new instructions on their own** helped with Devon (set of four 0.69, first
    option 0.63) and made no difference with Mom (0.43 and 0.51).
  - **Marc's words came through with a full review:** with Devon and the new
    instructions, his casual words from the rewrites appeared 29 times per 100 options
    (3 with no review), and 11 of 12 declines were in his own style (1 of 12 today, no
    review). The cost: in 7 of 40 sets the same word of his ("nah", "bro") appeared in two
    options or more. With Mom far less came through (5 per 100).
  - **The judge's chance check passed** for both partners (0.45 to 0.55). No safety
    failure in any option, including Devon's crude remark about a referee.
  - **What it means:** review pays back when the user rewrites many turns with a person,
    not one per conversation. That argues for making rewriting cheap enough to do often,
    rather than asking for the single worst turn.
  - **Limits:** invented personas and rewrites, nobody really typed them, two partners,
    and the judge is the same kind of AI that wrote the options.
  - **Ken's check of the judge (2026-10-06): he agreed with it on 5 of 8 blind pairs**,
    which the plan set in advance as "the judge's numbers are weak". Two of his three
    disagreements were review pairs the judge had scored as wins for review, so the
    judge's numbers above should be read as rough.
  - **Review's value over About Me is unproven (Ken, 2026-10-06).** Ken: *"I can't see
    where conversation review adds any value over and above the About me survey
    content."* The test did not give About Me a fair chance. Devon's "how I talk with
    them" settings name no words, so "nah", "bro" and "dude" reached the AI only through
    the rewrites; and Mom's settings were removed, so review was compared with nothing.
    A note saying "With Devon I say nah, bro and dude a lot" might do much the same for a
    minute's typing instead of about ten. Ken chose not to test that now; recorded so a
    future review design is not justified by these numbers.

#### 9. Register per person
- **Raised:** 2026-10-06 - the evaluation's avenue 9.
- **The finding:** every example sentence is shared across partners. While Marc talks
  to Mom, the AI sees a line he said to his sister ("Prepare to lose, small child") as
  the best evidence of how he talks. The per-person "how I talk with them" menu and note
  have never been measured in a controlled test. In the review experiment the decline
  rule's wording mostly survived them: 12 of 18 decline options to Sofia used the rule's
  softeners although her note says "Nothing here should sound careful or nice", and all
  18 to Devon contained "wiped".
- **What is wanted:**
  - **(a) A test of the per-person menu and note:** Marc with Mom, Sofia and his doctor,
    note on and off. About $2.
  - **(b) Example sentences by partner:** show the AI only the example sentences said to
    the current partner, falling back to everyone.
  - **(c) An easy partner choice at Start conversation,** as an optional tap.
- **Why not now:** (a) needs the persona scripts kept (item 3); (b) changes what goes
  into every request; (c) adds a step on the conversation screen, which is Ken's call. A
  wrong partner applies the wrong register, so the tap has to stay optional.

#### 10. Record who entered each About Me answer
- **Raised:** 2026-10-06 - the evaluation's avenue 9.
- **The finding:** a parent or therapist may fill in About Me, How I Sound or the note
  on how the user talks with someone. The app sends all of it to the AI as the user's
  own word, and the per-person note "overrides the general guidance above". That clashes
  with the decided rule that partner input is second-hand and never outranks the user
  (August 7 2026). It is also a route to a tidier, "well-behaved" version of the user
  that nobody can see happening.
- **What is wanted:** record, for each answer and note, whether the user or a supporter
  entered it, and tell the AI which is which. A supporter's description of how the user
  talks is second-hand.
- **Why not now:** it needs a way for the app to know who is typing that does not add a
  tap to every answer, and a default for the answers already saved, which carry no
  record. Ken's call.

#### 11. The spoken voice and the placeholders are part of sounding like the user
- **Raised:** 2026-10-06 - the evaluation's avenue 10.
- **The finding:** a partner hears more than wording: the voice's age, gender and
  accent, and the placeholders, which the app speaks on its own in the user's voice and
  which by default the app wrote ("Working that out."). The built-in voices offer no
  younger voices. The reading of past conversations treats every placeholder and
  Commands phrase as the app's words, so the user's own edits to them never count as
  evidence of how they talk.
- **What is wanted:**
  - **(a) A voice that fits:** help the user pick a voice whose age and manner fit them.
  - **(b) Placeholders that fit:** offer placeholder phrases that fit the user's
    register.
  - **(c) Edited phrases count as the user's words.** Count an edited placeholder or
    Commands phrase as the user's own words, as the Express Panel already does for a
    button the user wrote or changed.
- **Why not now:** (b) must keep the two standing rules for placeholders (each reads
  correctly after any partner turn, and each is first person and never directed at the
  partner); (c) needs the app to tell an edited phrase from a shipped one. Ken chose the
  free fixes first.

#### 12. The AI sees its own earlier suggestions as the user's replies
- **Raised:** 2026-10-06 - the evaluation's avenue 11.
- **The finding:** within a conversation, the user's earlier replies are sent to the AI
  as the user's own past turns, and most of them are response options the AI wrote (47
  of 60 turns in the test data, which is authored). Research shows that continuing a text
  keeps that text's style, so this may pull suggestions toward the AI's own style as a
  conversation goes on. It stops at the end of each conversation, and the reading of
  past conversations never uses picked options as examples.
- **What is wanted:** test first. Compare the current arrangement with earlier picked
  turns marked as picked options, or moved out of the place the AI reads as the user's
  own replies. Change it only if the test shows a gain.
- **Why not now:** untested, and it touches how the AI keeps track of the exchange. The
  same arrangement once made the AI carry on the conversation instead of answering in
  the required form (fixed October 1 2026), so any change needs the full test.

#### 13. Practice Mode as a labeled source of the user's own words
- **Raised:** 2026-10-06 - the evaluation's avenue 12.
- **The finding:** typed sentences are the only source of the user's own wording, and
  they are rare: 2 of 60 turns in the test data, and none of 30 in one tester's report,
  although her note says she typed (see item 34). Practice is private, low-stakes and
  repeatable, and therapists have asked to write scenarios. Since October 6 practice
  conversations are left out of the reading entirely, because practice skewed the length
  reading, and the AI was told those sentences came from real conversations.
- **What is wanted:**
  - **Scenarios that draw out typed replies:** written to draw out the user's own typed
    replies.
  - **Honest labels:** what they produce marked as practice and described to the AI as
    practice.
  - **Facts from practice checked:** any fact from practice put through the "is that true
    about you?" question (listed in "Conversation Review: what the first build left
    out", above).
- **Risk:** the scenario sets the register (a job interview, an angry partner), and
  made-up content can leak in.
- **Why not now:** untested, and it brings back part of what the same day's change took
  out. It should wait for a measure (item 1) that can show whether it helps.

#### 14. Importing an existing AAC device's history
- **Raised:** 2026-10-06 - the evaluation's avenue 13.
- **The finding:** a device's history (Grid 3 chat history, TD Snap data tracking, text
  messages) is the fastest pool of the user's own conversational sentences. Volume only
  pays if the app picks examples that match the situation: in Tomanek et al. (2023),
  randomly chosen samples gave no gain and matched ones gave 8 points. Today the AI sees
  the newest 12.
- **What is wanted:** an optional import that previews every line, removes other
  people's names and keeps everything on the device, together with examples chosen to
  match the situation.
- **Risks:** device history is shaped by typing effort and word prediction; private
  details can come up out of context; many devices keep no history or make it hard to
  export; texts and email are written, not spoken.
- **Why not now:** a large build, a supporter is probably needed to export, and it
  depends on examples chosen to match the situation, which do not exist.

#### 15. Two options per category as a style comparison
- **Raised:** 2026-10-06 - the evaluation's avenue 14.
- **The finding:** the two-per-category setting asks for options with different
  content, so a pick between them does not isolate style (about 15 of 40 pairs happened
  to keep the content). It costs about a third more per set, and the typical wait rose
  from 3.0 to 4.5 seconds.
- **What is wanted:** an option that asks for the second option in a category to keep
  the content and change the style, and records which one the user picks.
- **Why not now:** item 5 gets the same comparison more cheaply: no extra wait, and no
  second option per category to choose between. Revisit only if item 5 is built and is
  not enough.

#### 16. One-tap Reframe presets
- **Raised:** 2026-10-06 - the evaluation's avenue 3. Its other half, keeping a Reframe
  instruction with one tap, was built the same day in About Me.
- **The finding:** asked plainly on every turn ("shorter and more casual"), the AI made
  a terse persona's best guess shorter (8.8 to 5.9 words) and more casual. That was one
  run of 8 turns, and the gain in score could be chance.
- **What is wanted:** a few one-tap presets such as "shorter", "more casual" and
  "blunter", worded by register and never by age ("talk like a 17 year old" invites a
  stereotype).
- **Why not now:** the presets need a place on the conversation screen, most naturally
  beside Reframe in the compose window, which shares the keyguard grid. Adding controls
  there is Ken's call.

#### 17. Deferred: fine-tuning a model on the user's own text
- **Raised:** 2026-10-06 - the evaluation's deferred list.
- **Where it stands, from the evaluation's research:**
  - **OpenAI:** closed at its own service since May 7 2026 for accounts that have never
    used it. New jobs end for everyone on January 6 2027.
  - **Not offered:** by Anthropic, the Gemini API or Mistral.
  - **Amazon:** closed for Claude models.
  - **Still offered:** by Microsoft's and Google's enterprise clouds, which need a cloud
    subscription and sign-in setup, and at Microsoft an hourly hosting fee.
- **What is wanted:** nothing now. On the trigger below, a test of tuning on the user's
  own sentences, or on chosen-versus-rejected pairs.
- **Why it would matter:** fine-tuning reaches what prompting does not. In IMPersona
  (2025), a model tuned on about 13,000 of a person's messages passed as them 44% of the
  time against 25% for prompting; tuned on 500, it did no better. Weinberg et al. (CHI
  2026) reproduced one AAC user's slang from about 19,500 messages. Training on
  chosen-versus-rejected pairs, offered on Microsoft's cloud, would use data the app
  already saves.
- **Why not now:** it needs thousands of the user's own sentences, which at this app's
  composing rates takes months to years. The routes the evaluation found open are
  Microsoft's and Google's enterprise clouds, which need a cloud subscription and sign-in
  setup. One other service (Fireworks) answered a browser directly, but the evaluation
  did not test fine-tuning through it.
- **Revisit when:** a user has several thousand of their own sentences, or preference
  training becomes reachable with only the user's own key.

#### 18. Deferred: a second request that rewrites options in the user's style
- **Raised:** 2026-10-06 - the evaluation's deferred list.
- **What is wanted:** a second request that rewrites the four response options in the
  user's style, used only if the first request cannot be made to do it.
- **Why not now:** it would roughly double the wait, which works against the silence
  the app exists to shorten, and a plain request in the first pass already shortens and
  loosens the options.
- **Revisit when:** the measure in item 1 shows a gap that instructions in the first
  request cannot close.

#### 19. Deferred: partners describing how the user talks
- **Raised:** 2026-10-06 - the evaluation's deferred list. The partner channel was
  decided on August 7 2026 (offered, never required, private to the user, never
  outranking the user) and has not been built.
- **What the evaluation adds:** use it first only inside the measure in item 1, as a
  check, not as input to the AI.
- **Why not now:** its value as input is unmeasured, and it needs the invite-and-collect
  machinery the August decision describes.
- **Revisit when:** the blind check in item 1 exists.

#### 20. The "never say" list leaks through the partner's own word
- **Raised:** 2026-10-06 - the evaluation's review experiment.
- **The finding:** on one test turn, 10 of 72 response options contained
  "inspiration", a word on the persona's "never say" list. All 10 quoted or rejected the
  partner's own use of it. One change-of-direction option made a joke on a turn about
  disability labels. The instruction reads "Respect this without exception."
- **What is wanted:** Ken's decision on whether quoting the word to reject it is
  allowed, since that is still the user saying it aloud; then an instruction that says
  so, checked with the persona test (item 3).
- **Why not now:** a user may well want to say "please don't call me an inspiration",
  so the right rule is a decision, not a fix.

#### 21. The Express Panel instruction throws away a brevity signal
- **Raised:** 2026-10-06 - the evaluation.
- **The finding:** the user's own Express Panel phrases go to the AI with three
  instructions: use them only to judge vocabulary, never reuse them, and do not read
  their shortness as a wish for short replies. The last one discards one of the few
  brevity signals a terse user's own buttons carry. The evaluation's layered tests never
  sent this part, so no tested setup matches what a user with their own buttons sends.
- **What is wanted:** decide whether short buttons the user wrote should count toward a
  brevity reading, and run the persona test with this part included.
- **Why not now:** the instruction was written on purpose (a button label is short
  because it is a button), so changing it is a judgment, not a fix.

#### 22. Does Start conversation carry the last person's register forward? Verify first
- **Raised:** 2026-10-06 - the evaluation found the per-person "how I talk with them"
  part cleared by End conversation and by entering Practice, but not on the path where
  Start conversation's opener begins a new conversation.
- **What was found on checking (not tested):** that path keeps the active partner on
  purpose, so the openers can use that person's name and phrases; a comment in the code
  says so. While the partner button stays lit, sending that person's register matches
  what the screen shows.
- **What is wanted:** check in the running app whether the per-person part is ever sent
  with no partner button lit, and fix it only if it is.
- **Why not now:** not confirmed, and likely not a fault.
- **DONE 2026-10-06:** the code review of the October 6 changes found the real version of
  this: the part of each request that names the partner was built when a request was
  made and then reused, so switching a partner off could leave that person's name, their
  "how I talk with them" settings and their kept instructions in the next request. Every
  request now builds that part from the buttons lit at that moment (checked in the
  running app).

#### 23. How I Sound throws away its two escape answers
- **Raised:** 2026-10-06 - the evaluation.
- **The finding:** "They all sound like me" and "I wouldn't say any of these" are saved
  and never sent. The voice plan calls the second at least as informative as a pick,
  because it is a rejection the user gave without being asked.
- **What is wanted:** send "I wouldn't say any of these" as a constraint, and treat
  "They all sound like me" as no preference.
- **Why not now:** sending rejected lines risks the AI reusing their wording, so it
  needs the persona test first, and it was not on the list of free fixes.

#### 24. How I Sound is never retired as live evidence builds up
- **Raised:** 2026-10-06 - the evaluation.
- **The finding:** the voice plan says live choices replace How I Sound once enough of
  them build up. Nothing in the app does that: every pick is sent on every request, and
  nothing retires them.
- **What is wanted:** decide how much live evidence lowers How I Sound's weight or
  retires it, and when.
- **Why not now:** the October 6 change already tells the AI to follow the user's own
  typed sentences where the two differ, which covers the commonest conflict. A threshold
  for retiring it cannot be justified until live evidence has built up for a real user,
  which it never has (item 34).

#### 25. How I Sound's wording: one item, past rewordings, and two stale descriptions
- **Raised:** 2026-10-06 - the evaluation.
- **One item breaks the bank's own rule.** Every item is meant to keep the content the
  same across its three choices, so the user chooses on style alone. "How was your
  weekend?" adds "quiet" to two of its three choices (`economy-weekend`), and it is one
  of the four items that isolate length, which the October 6 brevity instruction now
  relies on. The evaluation also found that comparing a pick with the middle choice
  cannot record one of the two directions in 4 items. (Checked October 6: the new
  instruction does not use that comparison; it counts a pick of the shortest or the
  longest choice.)
- **Rewording changes what users chose.** When 11 choices in 8 items were reworded to
  remove British phrasing, saved answers were switched to the new wording, so the AI now
  gets a sentence the user never saw. Any rewording needs a decision on what happens to
  answers already given.
- **Two choices the evaluation pointed at as leaning British** (sound-check-items.js,
  lines 136 and 178 on October 6): "That is quite all right. Please don't worry." and
  "how are you coping?". Read them as an American would say them; a person decides.
- **Two stale descriptions.** The item file's header said there were twelve items, all
  answering a partner; the bank has twenty, five of them starting a conversation. That
  header was corrected on October 6, and so was CLAUDE.md's "GAP IN THE SHIPPED BANK"
  note.
- **Why not now:** each rewording is small but changes saved answers, which is Ken's
  call.

#### 26. British words in response options: watch in real use
- **Raised:** 2026-10-06 - the evaluation.
- **The finding:** with About Me alone, Grace's options used "lovely" twice and "proper"
  once in 64, against none in 128 with no profile. That could be chance.
- **What is wanted:** watch for them in problem reports and reviewed conversations. If
  they recur, tighten the American-English instruction the AI is given.
- **Why not now:** three words in 64 options is not yet a pattern.
- **Found 2026-10-06 in the instructions themselves:** the honesty rules give "What do
  you fancy doing?" as an example question, and the offered-options rule uses "what do
  you fancy?". Both are British phrasings the AI may copy. Change both to "want to".
  The instructions test in `scripts/voice-eval/TEST-PLAN-instructions-and-review.md`
  makes this change in both of its conditions; the app still has the old wording.

#### 27. Sounds Like Me: a citation and section 5.3
- **Raised:** 2026-10-06 - the evaluation's citation audit and its reading of the plan.
- **The citation:** "Conversant AAC Sounds Like Me.docx" says Valencia et al. (CHI 2023)
  found that choosing a generated phrase made AAC users feel the system had made the
  choice. The paper's section 5.4.2 is about other people attributing the words to the
  device, not the user's own feeling. CLAUDE.md's entry on the Cyrano problem repeated
  the claim; that was corrected on October 6.
- **Section 5.3** is titled "The question is authorization, not self-description", but
  the How I Sound question asks about resemblance ("sounds most like something you would
  say"). The section also calls it a preference and still quotes the rejected wording
  "which would you rather say?". CLAUDE.md's note on asking the user and the partner
  different questions carries the same quote.
- **What is wanted:** correct both in the document at its next sync, and the CLAUDE.md
  note on asking the user and the partner different questions with it.
- **Why not now:** design records are corrected in a "sync docs" pass, which Ken times.

#### 28. Conversation Review promises two things that are not built
- **Raised:** 2026-10-06 - the evaluation.
- **The finding:** "Conversant AAC Conversation Review.docx" promises "a report to us"
  when the user flags a misheard line, and says the app asks "is that true about you, or
  did you make it up for the practice?" about facts from practice. Neither is built. The
  User Manuals were already corrected.
- **What is wanted:** build them (the practice question is already listed in
  "Conversation Review: what the first build left out", above), or mark them in the
  design record as not built. A misheard report cannot send what the partner said
  automatically, so it needs a form that carries counts only, or goes through a problem
  report the tester sees first.
- **Why not now:** a documents pass, and whether the misheard report should exist is
  Ken's call.

#### 29. The cached part of the instructions may be larger than the code says - verify
- **Raised:** 2026-10-06 - an observation in the evaluation that it did not check
  separately.
- **The finding:** two code comments (llm.js, near lines 362 and 512) put the cached
  part of every request at about 3,400 tokens, and CLAUDE.md's caching entry at about
  3,570 (August 8 2026). The evaluation's measurements put it at about 10,700 to 16,400
  tokens, which fits Marc's whole request being about 44,400 characters.
- **Why it matters:** each time a review, or the reading of past conversations, changes
  the voice part, the whole cached part is written again at 1.25 times the input price
  (inferred, not measured). A larger cached part makes each such change cost more.
- **What is wanted:** read from one real request in the running app how much was written
  to the cache, then correct the comments and CLAUDE.md.
- **Why not now:** not checked yet; it needs one real request with a key.

#### 30. A piece of review code nothing uses
- **Raised:** 2026-10-06 - the evaluation.
- **The finding:** one part of the reading of past conversations counts what each kind
  of review answer contributed (`reviewContributions` in voice-harvest.js). Nothing has
  used it since the "what this review taught the app" view was removed on October 3
  2026.
- **What is wanted:** use it for item 8(d) and the light bulb, or remove it.
- **Why not now:** it is the natural piece for those, so removing it now may mean
  writing it again.

#### 31. The reading of past conversations runs only when asked
- **Raised:** 2026-10-06 - the evaluation, checked against the code the same day.
- **The finding:** the app reads past conversations for example sentences only when the
  user leaves a review or presses "Read my conversations" in About Me; nothing else
  starts it. So a user who never reviews never gets example sentences from live
  conversations. The voice plan describes this step as needing no user effort
  ("self-populating").
- **What is wanted:** decide whether it should also run on its own, for example after
  each conversation, reading only that conversation.
- **Why not now:** reading every saved conversation may be slow with a long history (see
  "Leaving a review may be slow" above), and each change rewrites the cached part of the
  instructions (item 29). It should follow item 34's check that the reading works on
  real devices at all.

#### 32. The User Manuals: describe "keep an instruction"
- **Raised:** 2026-10-06 - created by the same day's change. About Me's "What the app
  has picked up" now lists the Reframe instructions the user typed recently, in
  conversations and in review, each with "Keep for everyone" and, when a partner was
  set, "Keep for <person>".
- **What is wanted:** describe the list and its buttons in all three User Manuals in the
  same pass: what a kept instruction does (sent on every request, or only while that
  person's partner button is on) and how to remove one. Check the manuals' description of
  the other October 6 changes at the same time.
- **Also check:** no control inside About Me has its own spoken help today, only the tab.
  The coverage test does not read worldview-ui.js, so it cannot notice. Decide whether
  About Me's controls, these two buttons included, should have spoken help, rather than
  adding it to these two alone.
- **Why not now:** the feature changed today, and documents wait until a feature has
  stopped moving. Do it at the next "sync docs" once Ken says it has settled.

#### 33. Over-promising wording: confirm the rest, then republish
- **Raised:** 2026-10-06 - the evaluation listed passages that state as fact outcomes
  nothing has measured, plus two that were out of date the other way. The same day's
  pass reworded them; this entry is what is left once that pass is done.
- **Seen reworded the same afternoon:**
  - **Product Overview:** paragraphs 47, 103, 125 and 206.
  - **Beta Test Plan:** the "Make it yours" step, which now names How I Sound.
  - **All three User Manuals:** the glossary entry for "Profile".
  - **About Me:** the notes on the personality and values sections.
  - **In the app:** the Review tab's and How I Sound's introductions are part of the
    October 6 change.
- **Still open:** the Sounds Like Me plan's table of phases, which calls the reading of
  past conversations "self-populating" (see item 31). Correct it with item 27.
- **Republishing:** every published document whose wording changed needs a fresh PDF on
  the website (the Product Overview, the Beta Test Plan and the three User Manuals, if
  their wording changed). The Beta Test Plan was last published on September 26, so it
  goes out normally. The Product Overview and the three manuals were already published
  with an October 6 byline, and the publishing script sees no change when the byline
  date matches the published one, so it will skip them. Its `--force` option
  republishes all 13 documents, and every replaced copy is then left in the media
  library for Ken to delete.
- **Why not now:** publishing is the last step of a "sync docs" pass, and this pass did
  not publish.

#### 34. Check that real testers' devices build example sentences
- **Raised:** 2026-10-06 - the evaluation found the voice features have never run for a
  real user. From August 7 until the 0.13.5 fix (October 6), typed and Express Panel
  turns were saved under the wrong label and could never become example sentences. The
  reading of past conversations has never run in Ken's own data folders. One tester's
  problem report showed 30 turns and none typed, although her note says she typed.
- **What is wanted:** once testers are on 0.13.5 or later, confirm that their devices
  build example sentences. The weekly report cannot say today: it counts How I Sound
  answers but not example sentences. A count with no words in it (how many example
  sentences, short replies and kept instructions a device holds, and when the reading
  last ran) would answer it.
- **Why not now:** 0.13.5 shipped today, so there is nothing to check yet. The count is
  a small change to the weekly report, best made with the first-set count in item 1.

### The iPad and Android manuals carry the Windows manual's page header
- **Raised:** 2026-09-15 - found while checking table borders. The running header at the
  top of every page of `Conversant AAC User Manual (iPad).docx` and
  `Conversant AAC User Manual (Android).docx` reads "Conversant AAC - User Manual (Windows,
  Chromebook, Mac)". Left over from both being created by copying the Windows manual, and
  it is in the PDFs on the website.
- **What is wanted:** correct each header to name its own device, then republish the two
  PDFs.
- **DONE 2026-09-15:** headers now read "(iPad)" and "(Android)"; both PDFs republished
  with the 1pt-border change.

### Azure "quota tier" upgrade: confirm the speech free plan survives, then fix the guide if not
- **Raised:** 2026-09-14 - Microsoft emailed the first beta tester's Azure subscription
  (bt1@volksswitch.org) saying it will be moved from the Free quota Tier to Tier 1 in three
  days unless opted out. Ken chose to let it upgrade.
- **What is wanted:** a few days after the upgrade (around 2026-09-17 or later), open the
  speech resource on that subscription in the Azure portal and confirm its pricing tier
  still reads **Free (F0)**, and that the free monthly allowance (500,000 characters of
  voice, 5 hours of transcription) is still being applied. If it has changed, or if
  Microsoft now steers new accounts to Tier 1 rather than F0, update the Azure sign-up
  steps in `Documents/Conversant AAC Speech Provider Guide.docx` (and the three User
  Manuals wherever they name F0) so testers and users request the right thing.
- **What we believe, and why it needs checking:** Microsoft's own quotas page describes the
  tiers as request-rate limits for its AI models, not pricing, and Conversant does not use
  those models. But one answer on Microsoft's help forum claims Tier 1 ends free
  allowances. Unverified either way.
- **Why not now:** the upgrade has not happened yet, so there is nothing to look at.

### Six items from the "I, Robot?" ultra-personalized AAC paper
- **Raised:** 2026-09-10 - Ken asked for a review of Weinberg et al., *"I, Robot? Exploring
  Ultra-Personalized AI-Powered AAC; an Autoethnographic Account"* (Cornell Tech, arXiv
  2509.13671), and then for all six findings to go on this list. The source is in
  `Other/Docs and URLs to Review/`. **Read the paper with its limits in mind:** one user,
  who types fast with minor motor impairment, mostly SHOWS his screen rather than having
  the device speak, and whose system only completed his sentences, with no partner speech
  and no conversation history. The identity and privacy findings transfer; the usage
  numbers mostly do not.

#### 1. Let a user take a sentence out of what the voice learns from
- **The finding:** knowing his words would train the AI made the author hold back
  swearing, gossip and dark jokes within two weeks. Once he went back to a plain notes
  app to complain about a neighbor, so nothing would be kept.
- **Why it applies:** Phases 2 and 3 of `Conversant AAC Sounds Like Me.docx` learn the
  voice from the user's own composed words. Expect the same holding back once users know.
- **Wanted:** a way to remove a single sentence from voice evidence after the fact,
  without discarding the whole conversation ("Don't save this conversation" is all or
  nothing, and is decided before the words are said).
- **Why not now:** the voice harvesting it protects has not been built. Build the two
  together.
- **2026-10-06:** that reason no longer holds. The reading of past conversations is
  built, and About Me's "What the app has picked up" list has a × that removes one
  sentence for good (whether it should ask first is the "×" entry above). Check whether
  that answers this item, and close it or say what is still missing.

#### 2. The "well-behaved" voice - corroboration, no new build
- **The finding:** filtering his swearing and dark humor out of the training data left an
  AI that reflected only the polite part of him. His answer was to type those remarks
  himself.
- **Why it applies:** the no-vulgarity rule and the humor guards narrow the voice the same
  way, and the escape hatch is "In my own words", which is the slowest path in the app.
- **Wanted:** treat this as further evidence that composition speed is a DEPENDENCY of the
  voice layer (already recorded in CLAUDE.md under the Cyrano problem), and weigh it when
  the per-partner vulgarity permission is eventually designed.
- **Why not now:** nothing to build on its own; it reinforces existing entries.

#### 3. Edit a suggested card before it is spoken
- **The finding:** the author called accepting only PART of a suggestion the most
  important control he had.
- **Why it applies:** in Conversant a card is all or nothing - speak it as written, or
  type from scratch. Verified 2026-09-10: the only path that opens "In my own words"
  pre-filled is the retype option after a partner asks the user to repeat.
- **Wanted:** a way to open a card's wording in "In my own words" to change it before
  speaking. **The design question to settle first:** the gesture. A second action on a
  card is a new gesture on the keyguard-backed conversation surface, which is exactly the
  kind of change the project has kept off that surface (the tap-to-define and Express
  Panel long-press discussions). Options to weigh include a composer control that pulls in
  the last card shown, which adds nothing to the cards themselves.
- **Why not now:** needs Ken's call on the gesture before anything is drawn.
- **2026-10-06:** the Sounds Like Me evaluation lists this as its avenue 8 and suggests
  the composer control above: load the last option shown into "In my own words" to edit
  word by word. It adds one thing: save each edit as an "AI wrote this, user said that"
  pair (item 6 of "Sounds like me: what the October 6 2026 evaluation left to do",
  above). The pair is where the value lies, since edited text stays closer to the AI's
  style than writing from scratch (Baumler et al. 2026). The cost is time, during the
  silence the app exists to shorten.

#### 4. Partners wondering whether it is the user or the AI talking
- **The finding:** a friend told the author, "since you started using your new app, I am
  always thinking if you or AI is talking to me."
- **Why it applies:** field evidence for the Cyrano risk recorded in CLAUDE.md, and it
  bears on the printed "This device listens and speaks for me" partner card (SEC-7):
  disclosing that a device speaks may make partners doubt what they hear.
- **Wanted:** ask testers' communication partners about this directly during the beta, and
  revisit the partner card's wording in light of what they say.
- **Why not now:** it is a beta interview question and a wording review, not a build.

#### 5. A short, regular check-in for testers
- **The finding:** every three days the author answered a few questions - how helpful the
  suggestions were, how much control he felt over his voice that day, whether anything
  felt too personal, whether anything unexpected came up.
- **⚠ CORRECTED BY KEN when this was proposed:** the review said nothing in our
  instrumentation would catch an AI that keeps bringing up someone's religion. **That was
  wrong - a problem report captures it, along with the supporting data needed to
  investigate it in full.** So the check-in is NOT the route for a specific incident a
  tester notices.
- **What it adds, narrowed accordingly:** the gradual judgments a tester would not think to
  file as a problem - whether the app sounds like them, and how much control over their
  own voice they feel, tracked over weeks.
- **Wanted:** fold a few such questions into the Beta Test Plan (for example, alongside the
  existing interviews). No app code.
- **Why not now:** it is a Beta Test Plan edit, done in a documents pass.
- **2026-10-06:** the Sounds Like Me evaluation proposes the interview question for
  weeks 2 and 6: "Show me one that sounded like you and one that didn't. What was wrong
  with the one that didn't?" Sort each miss as length, formality, wrong kind of reply,
  missing fact, humor, or the AI's own habits. It also advises against an absolute "does
  this sound like me, 1 to 7" rating, which runs high whatever the real fit.

#### 6. Mixing languages within a sentence
- **The finding:** the AI followed the author's Spanish-English mixing and Argentine slang,
  and he counted it among the things he valued most.
- **Why it applies:** the future non-English support entry under Open Questions in
  CLAUDE.md treats language as ONE setting. A bilingual user needs both at once - in the
  recognizer, the voice, the AI's instructions and word prediction.
- **Wanted:** add code-switching to that entry, so it is designed in when language support
  is scoped rather than discovered afterward.
- **Why not now:** non-English support is not scoped yet.

### A problem report shows the new record entries as blank "user:" lines
- **Raised:** 2026-09-10 - found during the 0.11.1 "sync docs" pass, while checking what
  a problem report prints so the manuals could describe it accurately.
- **The fault:** 0.11.1 added `role: 'event'` entries to saved conversations (microphone
  on and off, when suggestions were asked for and why, the composer opened, canceled with
  its text, and Reframe text). `transcriptLine()` in `app/js/app.js` handles partner,
  error, placeholder, context and offer, and sends anything else to its last line, which
  prints `user:` followed by `selectedText`. An event has no `selectedText`, so each one
  prints as the user saying nothing. **A tester's report can therefore show several
  empty turns by the user that never happened** - exactly the kind of misreading a
  report exists to prevent.
- **Wanted:** an `event` branch that prints a short bracketed line (e.g. mic on,
  asked for suggestions: reprompt, composer canceled), and a fallback for an unknown
  role that is anything other than a fake user line, so the next new role cannot do
  this again.
- **One decision to make while building it:** whether a report should show the words
  typed in the composer, including canceled text. The tester sees the whole report
  before it is sent, so it is not a hidden disclosure, but it is the user's own
  unsent writing and deserves a deliberate choice rather than a default.
- **Why not now:** found in a documents pass, which does not change app code. It reached
  testers in 0.11.1, so it gets a changelog bullet when fixed. A one-click task was also
  offered for it in that session.
- **DONE:** events were already printed properly from October 8 2026 (Ken's October
  9 report shows "[listen on]" and "[reframe] text=..."). On 2026-10-09 any other kind
  of entry not taught to the report prints by its own name instead of "user:". The
  composer text question was settled by the October 8 build, which prints it.

### How a Context-band button shows what it is doing: standing versus one-shot
- **Raised:** 2026-09-10 - Ken: "Context should carry and hold a checkmark until tapped
  again, or a different element of the same dimension is tapped. For now, you can't be
  located at the pharmacy and at school at the same time."
- **Wanted:** an explicit held checkmark on an active context button, rather than only
  the lit "selected" background it carries today. One active per dimension, which is
  already the behavior in code (tap again clears, tapping another switches).
- **⚠ THE CONFLICT TO SETTLE BEFORE DRAWING ANYTHING, because it makes one mark mean two
  lifetimes: the app ALREADY has a checked-looking button that does not stand.** A tapped
  choice chip shows as selected while its steering is in effect and is cleared at the
  turn boundary, and the number button is the same shape. So if a checkmark means "true
  until you change it" on a place, and the chip beside it wears the same mark for one
  turn, the mark stops carrying the one thing it was added to say.
- **The distinction is already half-drawn and worth finishing:** the transient buttons
  have a dashed border to read as temporary, the standing ones do not. So the shape of
  the answer is a solid check for standing and the dashed treatment alone for
  this-turn-only - nothing new invented, one existing difference made to carry the
  meaning.
- **Why not yet:** it belongs with the three-band build, where the "Telling buttons
  apart" decoration is being extended anyway; drawing it before that means drawing it
  twice.

### Goals: two decisions closed, and what is left to build
- **Raised:** 2026-09-10 - Ken, asked what goals work remains.
- **ALREADY BUILT, so a future session does not start from zero:** the STANDING goal per
  person shipped in August 2026 - one goal from a menu of twelve or typed, held on the
  me-to-person edge, reaching the prompt with the never-mention guard. The bottom layer
  (how you generally are with people) is Tier B of About Me and is also built. **What is
  missing is the TOP layer, the goal for THIS conversation, and nothing of it exists.**
- **DECIDED (Ken, 2026-09-10): the user sets a goal; the app never suggests one.** Closes
  open sub-question 2 of the June 15 2026 model. Stated as "for now", so it is a default
  rather than a principle - but nothing may infer a goal from the partner, the place or
  the history until Ken reopens it.
- **⚠ DECIDED (Ken, 2026-09-10): THE JULY 13 2026 PLACEMENT DECISION IS SUPERSEDED. It
  said goals must deliberately NOT be Express Panel buttons** (the reasoning: a goal is
  set once per conversation, and panel space belongs to what is touched constantly).
  **Ken: "The July decision is ancient to say the least. It predates the banding of the
  Express Panel."** Correct, and it is the banding specifically that voids it: the old
  argument was about spending scarce high-frequency real estate, and the Flex band is
  precisely the space that fills itself from the situation rather than being spent. So
  goal buttons live in the Flex band, first, and **the Start-flow picker and header chip
  proposed in July are no longer the plan** - do not build them from that entry.
- **Still to build, in dependency order:** several goals per person as an ordered list
  (the storage holds exactly one today); the per-conversation goal in full, including
  List B, the how-I-want-to-come-across options, which was designed and never written;
  the Flex-band buttons; goals that come from a PLACE rather than a person (a place can
  hold one as a fact today, and nothing treats it as a goal); the active goal stamped
  onto each saved turn (built in 0.11.1); and Reframe's sticky version, which IS a conversation goal and was deferred here.
- **2026-10-06:** a Reframe instruction can now be kept, for everyone or one person (About
  Me, "What the app has picked up"). A sticky Reframe for one conversation only is still
  not built; see "a goal typed for THIS conversation only" in "Several conversation goals
  per partner", below.
- **Still open, and Ken's:** whether a goal can attach to a KIND of relationship ("with
  anyone in authority I want to seem capable") rather than only a named person.

### Several conversation goals per partner, as a PRIORITIZED list - BUILT 2026-09-10
- **Raised:** 2026-09-10 - Ken, twice: first "make it possible to add multiple
  conversational goals for a partner", then the refinement "consider making
  conversational goals per person a prioritized list".
- **Wanted:** a standing relationship goal stops being one value on the me-to-person
  edge and becomes an ordered list, most wanted first.
- **Why the ordering matters more than the count**, and this is the part that makes it
  a decision rather than a schema change: the Goals design in CLAUDE.md left "single vs
  multiple goals per layer" open and settled on single as the v1 default. Allowing
  several immediately raises "which one wins when they pull in opposite directions",
  and a priority order is the answer that needs no new machinery - **it is the same
  answer Ken already gave for the Express Panel Flex band**, where roles were killed in
  favor of the user ordering each list by how likely they are to want it. So the app
  never adjudicates between goals; it takes them in the order the user put them.
- **⚠ DECIDED (Ken, 2026-09-10): ALL GOALS ARE EQUIVALENT. No primary-versus-constraint
  distinction. Several may be checked at once, and the user's ORDER is the only statement
  of relative importance.** This REVERSES the one-primary-plus-constraints rule proposed
  earlier the same day. Ken: *"I think the primary goal versus constraints distinction is
  overengineered and will be difficult for users to set up."*
- **⚠ HE IS RIGHT, AND IT IS THE SECOND TIME THE SAME MISTAKE HAS BEEN CAUGHT - which is
  what makes this worth recording as a pattern rather than a preference. IT ASKED THE USER
  TO SORT THEIR OWN GOALS INTO CATEGORIES SOMEBODY ELSE INVENTED** (Dillard's primary and
  secondary goals). **That is precisely why ROLES were killed in the Express Panel bands**
  - a fixed role per position asked the user to think in our taxonomy, and the replacement
  was the user ordering their own list by how likely they were to want it. Same fault, same
  fix, one design layer up. **Watch for it wherever a piece of literature has furnished a
  useful distinction: the distinction can be true and still not belong in front of the
  user.**
- **AND THE DISTINCTION IS NOT LOST BY DROPPING IT, which is the part that makes this
  safe rather than merely simpler: it is already in the WORDS.** A model given "Making
  peace, Being upbeat" reads the first as the aim and the second as the manner, because
  that is what the language means - so nothing has to carry it in the data. A type field
  would have re-stated what the label already says, and charged the user for saying it.
- **⚠ WHAT THIS SHIFTS ONTO THE ORDER, and it is a build requirement rather than a
  nicety: the ORDER MUST REACH THE AI, most important first.** With no primary there is
  nothing else that says one goal matters more than another, so an unordered hand-off
  would make the ordering Ken asked for purely cosmetic and leave the model weighting
  three goals equally.
- **The cost, stated once and accepted: nothing now prevents two goals that pull opposite
  ways** ("Getting help" and "Just chatting" both checked). Under the abandoned rule one
  primary prevented it by construction. It is VISIBLE (both carry a checkmark) and
  RECOVERABLE (uncheck one), which is the property that matters, and it is consistent with
  how the app treats every other thing the user asserts about themselves - take them at
  their word. Do not re-add a structure to prevent it.
- **It also removes the problem the abandoned rule created:** with two kinds of goal,
  tapping a second primary would silently uncheck the first while a second constraint
  merely added, and nothing on the button said which kind it was. Every goal button now
  toggles independently, which is learnable. **The grouping-within-the-run fix proposed
  for that problem is no longer needed** - the run is simply the user's own order.
- **BUILT 2026-09-10.** The stored single goal became an ordered list, migrated ON READ
  so a profile nobody edits keeps its goal (doing it on write would have hidden the goal
  until the next time the user happened to open that person's form), with the legacy key
  removed on the next save so a stale value cannot outlive what replaced it. Duplicates
  are dropped. The order is sent to the AI and NAMED as importance, with the earlier
  goals winning a conflict - without that the ordering would have been decorative. A
  single goal still reads as one goal rather than as a numbered list of one.
- **AND GOALS GOT THEIR OWN SECTION (Ken, the same day): "Conversational goals are now
  buried in the 'How I talk to them' section. I'd like you to raise the visibility of
  goals to its own section."** He is right, and growing it from a dropdown into a list
  had made it worse rather than better - the one control that steers WHAT the user says
  sat deeper inside a section about how it is worded. It is now the FIRST section,
  "What I want from this relationship", and the two sections open independently on edit:
  opening the wording section because a goal is set would put the user in front of the
  wrong controls. **Titled for the relationship rather than "goals"** so there is room to
  tell it apart from the per-conversation goal, which is still unbuilt.
- **THE BUTTON FACE IS BUILT TOO (2026-09-10, the same day).** Goals claim the LEADING
  Flex positions, in the user's priority order, from the active partner; they never
  speak; tapping one re-asks the AI on the same seam a Context tap uses; each latches
  independently and several can be on at once. A typed goal's row in About Me gained the
  **Button label** box the twelve did not need.
- **⚠ THE BAND IS FLEX, NOT CONTEXT, and Ken had to correct that reading once:** the band
  is decided by how a button's content is DETERMINED, not by whether it speaks. Which
  goals exist at all depends on which partner was chosen, so goals are a function of the
  Context band rather than part of it. Recorded in CLAUDE.md under the Express Panel.
- **⚠ WITH THE SHIPPED DEFAULTS NOTHING SHOWS, and that is Ken's decision (option 1,
  "leave as is"): no auto-growing the Flex band, and no note in About Me pointing at the
  Express Panel settings** - *"This administration is too far from the express panel
  settings for most people to make the connection."* The Express Panel tab's own status
  line says how many goal buttons have no room, which is where somebody sizing the bands
  is already looking.
- **THE PER-CONVERSATION LAYER IS BUILT (2026-09-10, Ken: "build the goal layer").**
  Goal buttons come from three ranked sources - this person, this place, then a general
  list - deduped, most specific first. The general list is what makes the layer real: a
  goal button could previously only appear for somebody already in About Me, which left
  the transactional half of the user's life with no way to say what the exchange was for.
  Each source expires with the thing it belonged to; a general goal lasts the conversation.
- **⚠ THE JULY 2026 START-FLOW GOAL PICKER WAS NOT BUILT, AND DELIBERATELY NOT.** That
  design (a goal page in the Start-conversation flow, plus a Goal chip in the transcript
  header) predates the Express Panel bands and rests on a premise Ken has since reversed:
  it said goals should NOT be Express Panel toggles because the panel's real estate is
  scarce, and on 2026-09-10 he put them in the Flex band. Its own note anticipated this -
  *"a place- or person-scoped framing chip IS a one-tap conversation goal for that
  context... the Start-flow Goal picker may end up needed only for the third source"* -
  and the general list is that third source. **Reopen only if a tester cannot find where
  to set a goal**, which is the failure a Start-flow page would fix and the panel might not.
- **⚠ STILL NOT BUILT: a goal typed for THIS conversation only** - the sticky version of
  Reframe that CLAUDE.md defers to the goals subsystem. A general goal covers a recurring
  agenda; a genuinely novel one ("I need to tell them what the consultant said") is
  one-shot Reframe today and is not kept. **Why not now: it needs a fourth control on the
  composer**, which changes the geometry of a modal that shares the keyguard grid - a UI
  decision on the keyguard-backed surface, and Ken's to make rather than mine.
- **2026-10-06:** a Reframe instruction can now be kept from About Me, for everyone or
  for one person (the Sounds Like Me evaluation's avenue 3). That is a standing
  instruction, not a goal for one conversation, so this item is unchanged.
- **THE DOCUMENT EXISTS NOW (2026-09-10): `Conversant AAC Conversation Goals.docx`.** Ken
  asked for it on finding there was none. It records the premise, the three layers, the
  three sources, and - the part he specifically asked for - what we are NOT doing and why,
  including the primary-versus-constraining-goal split and where all of it departs from
  the literature. **Any future goals work should read it first**, and Section 9 of it is
  the open list, kept in step with the entries here.
- **NOT A GAP - no ceiling on goal buttons (Ken, 2026-09-10): *"Like always, priority
  buttons push non-priority buttons off of the end of bands. The flex priorities are:
  goals, dimension-specific phrases, then Always phrases. Nothing has changed."*** Goals
  taking Flex positions and pushing phrases off the end is the band working as designed,
  not a failure to guard against. Earlier entries here that called it one were wrong.
- **BUILT in 0.11.1 (2026-09-10): the goals in force are saved with every turn**, so a
  reviewed conversation says what the user was aiming for. Each saved goal keeps its
  wording and which of the three sources it came from.

### Conversation goals as steering buttons in the FLEX band
- **Raised:** 2026-09-10 - Ken: "treat conversation goals as 'reframe' buttons that can
  appear in the express panel when the combination of dimensional values match - flex
  panel non-speaking buttons(?)"
- **Wanted:** a goal becomes a one-tap button that re-generates the response cards
  around it, appearing when the selected partner and place match the goal's dimensions.
  It says nothing aloud; it steers. **In the FLEX band, first, marked so it cannot be
  mistaken for a phrase that speaks.**
- **⚠ LABELING - DECIDED (Ken, 2026-09-10): every goal carries a SHORT LABEL, in the
  -ING FORM, and the user can change it.** Catching up, Finding out, Getting help,
  Telling them, Making plans, Making peace, Just chatting, Being upbeat, Talking about
  us, Reassuring them, Spending time, Their people.
- **THE REASON IT CAN BE SHORT AT ALL, and it is the whole argument: a goal button's
  face is a REMINDER, NOT A QUOTATION.** Every other button in the Flex band shows the
  words that will be spoken, so its face has to BE those words, which is why a long
  phrase truncates and why that is tolerable. A goal button speaks nothing, so its face
  only has to be enough for the user to recognize which of their own two or three goals
  it is - which also makes the USER the right author of it.
- **Truncation is not an option, measured rather than assumed:** the binding case is a
  side dock, where a cell is about 77px wide - eight or nine characters. "Support their
  other relationships" and "Reassure them I am committed" both become "Suppo.../Reassu..."
  and two different goals end up looking alike.
- **WHY THE -ING FORM EARNS ITS ODDNESS: it stops a goal reading as something to say.**
  "Get help" on a button, in a band where most buttons speak, invites the user to think
  they have just said it - and the cost of that confusion is believing you have spoken
  when you have not. Nobody utters "Getting help", so the grammar itself carries intent
  rather than speech, at no cost in space and without spending the one mark that
  separates goals from phrases.
- **A typed goal MUST supply its own label**, or it arrives with nothing to put on the
  button. Two of the twelve ("Spending time", "Their people") are the weak ones, which
  is itself an argument for the label being editable - the user has better words for
  their own relationships than we do.
- **⚠ I ARGUED FOR THE CONTEXT BAND AND KEN OVERRULED IT. He is right, and the error is
  worth keeping because it is easy to repeat: I had the band rule backwards.** I took
  "Context holds the buttons that never speak" as the DEFINITION of the band, and
  reasoned from it that a non-speaking button must go there. Non-speaking is a PROPERTY
  of the Context band's contents, not what puts them in it. **What actually separates
  the bands is how their content is DETERMINED:** Always never changes; Context is where
  the user SUPPLIES the dimensions (who, where, how I feel); Flex holds content that is
  a FUNCTION of those dimensions. A goal only exists once a partner is chosen, so it is
  derived, so it is Flex - by exactly the same mechanism as a situational phrase. Ken:
  "Goals are context dependent and therefore can't go in the context band."
- **⚠ AND THE SAFETY ARGUMENT WAS THE WRONG WAY ROUND TOO. Ken: "The issue that they
  don't speak is not a danger, it's a no-op."** The property being protected is that a
  mis-hit must not say something irreversible. A goal button cannot speak, so a mis-hit
  on it costs a set of cards and a round trip, and nothing that reaches the other
  person. **A non-speaking button in a speaking band is the SAFE direction of the
  mistake**, which I had counted as the risky one.
- **The decoration is Ken's and it reuses a solved problem:** the Context band already
  has a user-selectable "Telling buttons apart" setting, because it holds three kinds in
  one background. The Flex band has one background today because it holds one kind;
  adding a second kind is precisely the condition that made that setting necessary, so
  it generalizes rather than needing a new marker.
- **⚠ THE ONE RESIDUAL, raised once: the mis-hit that matters is the REVERSE one.**
  Aiming at a goal button and missing lands on a neighbouring phrase, which speaks. So
  the exposure is not the goal buttons themselves but what sits beside them.
  **DECIDED (Ken, September 10 2026): the goals go FIRST in the Flex band.** So they
  are grouped, which is what limits the exposure, and they take the positions the user
  learns best rather than the leftovers - right for the thing that steers the whole
  turn. It also means the phrases below them shift by however many goals are showing,
  which is the weaker half of Spatial Stability and explicitly subordinate to putting a
  quick path to a response in front of the user.
  **No separate allocation is needed (Ken, 2026-09-10):** as in every band, priority
  buttons push lower-priority ones off the end, and the Flex order is goals, then
  dimension-specific phrases, then Always phrases. A partner with several goals pushing
  phrases off the end is that rule working, not a failure.
- **Why not yet:** it depends on the entry above (there are no goals to surface) and on
  the three-band panel, which is designed and not built.

---

### Practice debrief: the app talks through how a rehearsal went
- **Raised:** 2026-09-23 - Ken, during the conversation-review design discussion. He
  asked whether there is value in the app "teaching" the user, especially in practice.
  Answer: yes, and my earlier "the app must never grade the user" was too absolute.
- **The distinction that makes it safe, and it must survive into the build:** feedback
  about the EXCHANGE ("that reply was short enough it could read as curt") is about
  words and is legitimate. A verdict on the PERSON ("you come across as abrupt"), a
  score, a grade, or a progress chart is not, and stays out permanently.
- **Wanted:** at the end of a practice conversation, the practice partner offers to talk
  through how it went. Rehearsal with no debrief is half a feature, and practice is the
  right home - no real person, nothing at stake, and the whole purpose is to improve.
- **The rule for the rest of the app:** never volunteered in a real conversation,
  offered in practice, available anywhere the user asks for it. Refusing feedback the
  user has asked for is its own kind of paternalism.
- **Also settled in the same discussion, so it is not re-argued:** the "it is moot
  because the AI only offers safe options" escape does NOT hold. The app offers a way to
  decline, offers humor where the profile allows it, and nothing checks that a
  suggestion suits the moment. A card can land badly.
- **Why not now:** it depends on the conversation-review playback screen, which is not
  built, and the wider review design is still being settled with Ken.

### An SLP authoring practice conversations for a client to exercise
- **Raised:** 2026-09-23 - Ken, relaying an SLP who wants to create practice
  conversations for an autistic client to work through, and to review the results.
- **Why it matters more than it looks:** a practice conversation has NO third-party
  privacy problem - the other party is the app - so it is freely shareable with a
  clinician, where a real conversation carries the words of someone who never agreed to
  be reviewed. That makes practice the natural first home for clinician review, and it
  comes with a named clinician who has asked for it.
- **Wanted, and it is two separate things:** (a) an SLP can write a practice scenario -
  who the partner is, what they want, how they open - where today the scenario library
  is bundled and custom-scenario editing is deferred; and (b) a way to hand that
  scenario to a client's device, and the finished conversation back.
- **Why not now:** it needs the custom-scenario editor that Practice Mode deliberately
  deferred at its first build, and the sharing half overlaps the export work. Raised as
  a real request from a real clinician rather than a hypothesis, so it should not sit
  behind a general "custom scenarios someday" note.
- **2026-10-06:** the Sounds Like Me evaluation found part (a) built on the device in
  September (commit 09c7ccc, "make one your own, or build a new one"), so that half of
  the reason has gone. Part (b) is still not built, and a backup import cannot stand in
  for it, because an import replaces the whole data set.

## Done

### Layouts for tall screens (done October 8 2026)
- Fifteen layouts in one list, the response options setting, the suggested layout at
  first launch and its Settings button, and the screen-bound restore rule shipped in
  0.13.9; "Screen orientation" on Android only in 0.13.10. Documents synced the same
  day. See CLAUDE.md, "Layouts: one list, suggested starting layouts".

### Product Overview: what a saved conversation holds
- **Raised:** 2026-09-27 - Ken's comment on the Conversation Review document, section 3:
  *"Is this information documented in the Product Overview? If not, it should be added."*
- **Where it stands:** partly. The Product Overview carries one sentence about it, and
  only in the roadmap list under conversation review - response option sets and what
  became of them, the floor-holding phrases, and who/where/feeling/goals. It does not
  mention the partial versions of what the partner said, the voice and spelling actually
  used, the microphone going on and off, the Composition Pane text, or errors in time
  order.
- **What is wanted:** the short list moved into the body of the document, where it
  describes what the app does today, rather than sitting inside a future-feature entry.
- **Why it is not being done now:** the Product Overview is a separate document and Ken
  asked for the Conversation Review first. Doing it in the same pass would mean editing a
  document he has not reviewed.
- **DONE 2026-10-01:** now in the body, in the new "Looking Back at a Conversation"
  section, by "sync docs Product Overview".

### Conversation Review: lift Section 14 into the three User Manuals
- **Raised:** 2026-09-27 - the document became the design record, and Ken asked that the
  user-facing material be preserved inside it rather than lost: *"preserve the
  information that will be entered into the user manuals as a section in the design
  doc."*
- **Where it stands:** Section 14, "What the User Manuals Will Say", seven short
  sub-sections written in the manual's voice, where "you" is the user. It is the only
  part of that document addressed to the user; everything else is about why the feature
  is the way it is, which a manual doesn't carry.
- **What is wanted:** when the feature ships, that section goes into all three User
  Manuals. They are self-contained by decision (Ken, August 1 2026), so it lands in each
  of them in the same pass, and the standing rule applies - a change to shared behavior
  that touches one manual and not the others is an incomplete sync.
- **Why it is not being done now:** the feature's first version was built on 2026-10-01,
  so this is now waiting on a doc sync, which is Ken's call. Section 14 describes some
  parts that are not built yet (see the entry above), so those lines need trimming when
  it is lifted.
- **Note:** the design record itself never becomes customer-facing, so it stays off
  `scripts/wordpress/user-documents.json` permanently.
- **DONE 2026-10-01:** lifted into all three manuals as section 6.8 by "sync docs", cut to
  what was built. The design record's section 14 now says the manuals are the copy kept
  current.

### The keyboard and generation-timing questions - both were collected and unread
- **Raised:** 2026-09-10 - Ken asked two questions: "how many people are using the
  on-screen keyboard vs. device keyboard" and "are we collecting and summarizing in
  reporting the time from AI prompt to return of response options?"
- **The answer to both was the same and it was half good: collecting yes, reading no.**
  Every weekly report already carried the settings bundle (keyboardMode included) and
  the AI round trip as a timing with a median. `scripts/beta-eval` read neither - its
  aggregation touched `events.totals` and nothing else, and no settings at all. So the
  numbers had been arriving in the Sheet for months and coming back out never.
- **Done:** 2026-09-10, plus the third measure Ken asked for in the same breath. A new
  "WHERE THE WAIT GOES" section prints the AI round trip and reading-and-choosing as
  ranges across testers with the sample counts behind them, and "Keyboard they type on"
  joined the setup groupings, which answers the headcount and gets the turn-level
  comparison free.
- **⚠ THE BUG THIS PASS PRODUCED AND THEN CAUGHT IS THE PART WORTH KEEPING, because it
  is the cross-layer rule paying for itself inside one afternoon.** The reader looked up
  `events.timings.generation`. **The real key is `generation.ms`** - a duration is
  bucketed under `<event>.<field>`, since one event can carry several timings. Reading
  the obvious name is not an error: `spread` gets nothing, the section prints "not
  reported yet", and it does so for ever, reading exactly like an app that has never
  been slow. **Six unit tests agreed with the wrong key, because every one of them built
  its own report.** It was found by emitting a real generation event in the running app
  and reading the real snapshot back. The tests now use the real key and one pins it.
- **⚠ AND A SECOND FAULT FELL OUT OF RUNNING IT: the "still on an older build" caveat
  had rotted into always-true.** It was a regex pinned to `0.7.x`, so every version from
  0.8 onward failed it and the warning fired for every tester on a current build. It now
  uses `versionAtLeast`, which is the tested comparison and cannot rot. **A caveat that
  is always showing is one people learn to scroll past**, which costs the reader the one
  occasion it means something - the same reasoning that keeps the check-docs allowlist
  honest.
- **What the section refuses to do, and it is load-bearing:** the two figures are NOT
  presented as a split of the wait. They sit on different denominators (reading-and-
  choosing exists only where a card was taken, so a typed reply has a wait and no
  reading time), a single turn can ask the AI several times, and neither contains the
  silence period or the recognizer's own lag. A reader who adds them under-counts the
  wait and then optimizes whichever half looks larger. A test fails if the warning goes.
- **Reading and choosing cannot be separated** - one number runs from the cards
  appearing to the tap landing, with nothing marking where reading stopped. Naming it
  for both is the honest form, and it is what Ken asked for.

### The layout borders cannot be grabbed with a finger
- **Raised:** 2026-09-09 - Ken, on small touch-screen devices.
- **Done:** 2026-09-09, shipped in 0.10.17 - three 10mm circles, one per movable border,
  centred along its length and following it as it moves. **The proposed shape in the
  original entry was NOT what was built**, and the difference is worth keeping: it
  suggested an explicit mode with the conversation surface made inert, plus tap-then-nudge
  as a discrete alternative to dragging. Ken specified the circles instead, on the existing
  unlock switch, and they answer the measured cause on their own - a circle is a target in
  its own right, so it can be finger-sized without taking anything from the button beside
  it, which is what a wider invisible grab zone could never do.
- **⚠ STILL OPEN, AND DELIBERATELY: the deeper point in the original entry stands.** A drag
  needs sustained contact plus controlled movement, which is among the hardest gestures for
  this population. A bigger target helps the people who can already drag; it does not reach
  the ones who cannot. If that turns out to matter in the field, the answer is a discrete
  alternative (select a border, then nudge), not a bigger circle.
- The stale premise in `styles.css` named by the original entry - *"touch gets nothing from
  this and needs nothing"* - was corrected in the same pass.

### Two design records left WRONG by the September 9 backup churn
- **Raised:** 2026-09-09 - found while working out why doc syncs must not follow releases.
- **Done:** 2026-09-09 at the next sync, as the entry asked. The Architecture Overview's
  Cross-Device Data Transfer sentence is back to a single file and now names why the
  filtering happens at import; the Express Panel Design lost the word "data" from "a data
  backup". **The entry's own guess was right for one of the two**: the Architecture
  Overview's pre-0.10.13 wording was already true again, so the repair is close to a
  revert.
- **The lesson is the one the entry was written to record**, and it survives the fix:
  neither document is reader-facing, so the currency check never raised either of them, and
  both had been CORRECT until a sync pass edited them mid-design.

### Settings versus data — resolved as ONE backup filtered at import
- **Raised:** 2026-09-09 — Ken, after band sizes travelled with a data import.
- **Done:** 2026-09-09 — three positions in one day, and the last one is right. First a
  two-file split; then Ken's rule that a setting is what the device screen determines;
  then his own correction that screen size is itself second-order and "what the person
  has to set up" is not the test. Working through all 44 settings killed the safety
  argument outright: **nothing is genuinely non-travelable.** So the split could not be
  justified, and it collapsed to one file with the decision moved to IMPORT — the only
  moment the app knows both the origin and the destination.
- **Shipped:** package version 3 carrying content, settings, profiles and a device
  signature (OS + shell + display size, in the header, not in the settings bundle);
  `settingsForThisDevice` holding back four values on a foreign device and REPORTING
  them on the restart card; every older file still importing, including the settings-only
  one that existed for part of a day and files the user renamed.
- **⚠ The bug worth remembering, found by reading stored settings after a real
  cross-device import in the browser and invisible to every test:** applying settings
  REPLACES the portable subset, so simply omitting a held-back key deleted it and fell
  back to the default — while the restart card said "left as they are here". Held back
  now means the device's own value is put back explicitly.


### The three User Manuals: the two backup files, and the profile rename
- **Raised:** 2026-09-09 — Ken, on the backup split: *"That behavior gets documented."*
- **Done:** 2026-09-09 — synced right after the 0.10.13 release. The section is renamed and
  split in all three; the description rewritten to cover both files, the profiles riding in
  the settings file, the offer to fold unsaved changes into the current profile, and the
  "Home (2)" rename. **One passage per manual was made WRONG by the release rather than
  merely dated** — Windows and Android sent the reader to "Export my data" to carry settings
  profiles across, which that file no longer holds; the iPad's mode-switch, second-iPad and
  section 5.2 passages all said to export the data, which now leaves the settings behind.
  The Placeholders arrows needed no edit: no manual ever documented them.


### Sample conversations exercising the five modes together
- **Raised:** 2026-09-08 — Ken, as a comment on the Architecture Overview
- **Done:** 2026-09-08 — "What the Five Modes Look Like Together" in the Product
  Overview: two sample conversations, one social and one at a pharmacy counter, with the
  mode noted in brackets. The section exists to make one point — the user never selects a
  mode, they choose what to say and the system follows.

### Architecture Overview: the 0.10.6–0.10.9 sync
- **Raised:** 2026-09-08 — reverted when the document turned out to be under review
- **Done:** 2026-09-08 — synced once Ken cleared the review. Seven passages: the deferring
  option; repair-of-self corrected to four operations plus the guess flag; the placeholder
  ladder easing off; the honesty constraint, which the document had never carried; and the
  Health & Safety module with conversation-authored questions.

### The triple-coding rule, and the badges themselves
- **Raised:** 2026-09-08 — found while reviewing Ken's Architecture Overview corrections
- **Done:** 2026-09-08 — Ken's call was to eliminate the badges rather than reword around
  them: *"The badges are unnecessary and should be eliminated. If we ever extend the tool
  to support non-speaking blind individuals, we can reconsider but I don't see that ever
  happening."* Removed from `ui.js` (the accessible name is now the full wording alone),
  the dead CSS deleted, and the rule reworded in CLAUDE.md to position + colour with the
  reopening condition recorded. "My best guess" was kept — it is a warning about the
  words' provenance, not a category label. The Architecture Overview and Configuration
  Model were corrected; UI-Design already said "double-coded" and needed nothing.

