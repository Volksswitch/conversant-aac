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
  onto each saved turn, which is a small fix and a real gap for reliving a conversation;
  and Reframe's sticky version, which IS a conversation goal and was deferred here.
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
- **⚠ STILL NOT BUILT, and it is the piece the labels were authored for: the button face.**
  Every one of the twelve now carries a short -ing label and nothing displays it yet - the
  Flex-band buttons are the consumer. A TYPED goal has no label at all and falls back to
  its full wording, which will truncate; giving the user a label box is work for a face
  they cannot yet see, so it belongs with the button build, not before it.
- **Why the rest is not yet built:** the per-conversation layer is the large remaining
  piece and needs its own pass.

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
  **The one thing the build must still settle: the Flex band is filled most-specific
  first from four ordered lists, so a leading run of goal buttons needs its own
  allocation** - otherwise a partner with several goals and several phrases silently
  pushes the phrases off the end, which is the failure the editor's insert rules exist
  to prevent elsewhere.
- **Why not yet:** it depends on the entry above (there are no goals to surface) and on
  the three-band panel, which is designed and not built.

---

## Done

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

