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

### Several conversation goals per partner, as a PRIORITIZED list
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
- **Why not yet:** the Goals subsystem is not built at all - all three layers
  (disposition, standing relationship goal, conversation goal) are design only. There
  is nothing to add a second goal to. Standing relationship goals remain the smallest
  first build, and this says what shape that build takes when it happens.

### Conversation goals as steering buttons in the Express Panel
- **Raised:** 2026-09-10 - Ken: "treat conversation goals as 'reframe' buttons that can
  appear in the express panel when the combination of dimensional values match - flex
  panel non-speaking buttons(?)"
- **Wanted:** a goal becomes a one-tap button that re-generates the response cards
  around it, surfacing when the current partner and place match the goal's dimensions.
  It says nothing aloud; it steers.
- **What it lands on:** the Reframe seam is already built and already used this way
  twice - the closed-set choice chips and the number pad both re-generate without
  speaking. So the mechanism exists; what is new is the trigger being a stored goal
  rather than something the partner just said.
- **⚠ Ken's own question mark is the right one to answer first, and the band design
  answers it: a non-speaking button belongs in CONTEXT, not FLEX.** The organizing rule
  of the three bands is speaking versus influencing - Flex holds phrases that are
  spoken, Context holds the buttons that never speak - and the whole safety argument for
  that split is that a mis-hit in the Context band can never say something irreversible.
  A goal button never speaks, so putting it in Flex would break the one rule that makes
  the panel explainable in a sentence. It also inherits the Context band's existing
  answer for transient buttons: they arrive at the far end and push nobody around.
- **Why not yet:** it depends on the entry above (there are no goals to surface) and on
  the three-band panel, which is designed and not built. It also needs the "which scope
  am I editing" hazard settled, since a goal button is a fourth kind of Context button.

### The keyboard question: nothing reads the answer we already collect
- **Raised:** 2026-09-10 - Ken: "how many people are using the on-screen keyboard vs.
  device keyboard"
- **Where it stands:** the answer is arriving and nobody is reading it. Every weekly
  report carries the whole settings bundle in `systemInfo` via
  `storage.reportableSettings()`, `keyboardMode` included. But `scripts/beta-eval`
  reads **no settings at all** - `aggregate.mjs` touches `events.totals` and nothing
  else - so the number is in the Sheet and never comes out.
- **Wanted:** a line in the configuration grouping of "evaluate beta", counting testers
  by `keyboardMode`. Absent means physical, which is the default, so a tester who never
  touched it still counts correctly.
- **Why not yet:** it is a reader change rather than a collection change, and it is
  worth doing in one pass with the timing item below, which is the same gap.

### The generation-timing question: collected, shipped, never summarized
- **Raised:** 2026-09-10 - Ken: "are we collecting and summarizing in reporting the time
  from AI prompt to return of response options?"
- **Where it stands:** **collecting yes, summarizing no.** `app.js` emits
  `EV.GENERATION` with the round-trip in milliseconds on every successful generation,
  and because it carries an `ms` key `metrics.js` keeps it as a timing sample and
  computes a median. That median rides every weekly report inside `events.timings`. And
  `scripts/beta-eval/aggregate.mjs` reads `t.events.totals` only - **`timings` is never
  touched by anything**, so the number has been collected and shipped and read by
  nobody.
- **⚠ The figure the report DOES print is a different quantity, and confusing the two
  would answer the question wrongly.** "Replies that took over 4s" is measured from the
  saved conversations: it is the whole wait from the other person pausing to the user
  speaking, so it includes reading the cards and choosing between them. The AI round
  trip is one part of it. Both are worth having and they must not be presented as the
  same thing.
- **Wanted:** the generation median in the "evaluate beta" summary, next to the
  four-second figure and labelled as the AI's share of it. `GENERATION_SUPERSEDED` and
  `GENERATION_FAILED` are collected the same way and deserve the same treatment - a
  superseded generation is the cost of the short silence period, which is a number Ken
  has already asked to watch.
- **Why not yet:** same reader change as the item above; do them together.

### Product Overview: the AI vendor's safety rules, and the distress case
- **Raised:** 2026-08-30 — CLAUDE.md, "A speech-to-speech model CANNOT be used here"
- **Wanted:** a paragraph beside *Not a Smart Speaker* saying the vendor's safety rules
  apply and cannot be switched off by the app, and that the app's own honesty rule is
  stricter and applies first.
- **Why not yet:** the paragraph about a user needing to say something bleak must NOT be
  written until the live-model testing below has actually been run — the honest position
  today is that it has not been measured.

### Test distress-shaped turns against the live model
- **Raised:** 2026-08-30 — CLAUDE.md, Open Questions
- **Wanted:** a dozen partner turns inviting a distressed reply, run against the real
  model, checking the cards are usable and in the user's voice rather than deflections.
  The measure is whether the user can SAY the thing.
- **Why not yet:** beta-gated. It also gates the Product Overview paragraph above.

### Tell an AI refusal apart from a network failure
- **Raised:** 2026-08-30 — CLAUDE.md, Open Questions
- **Wanted:** read the response's stop reason, log a refusal as its own kind of error, and
  count it in the weekly report. No user-facing error text — Ken's standing position.
- **Why not yet:** not seen in the field yet; it is instrumentation, not a defect.

### The 0.10.7 release note misstates the Express Panel grid
- **Raised:** 2026-09-08 — found while syncing the manuals
- **Wanted:** the note says "three rows of twelve rather than four rows of nine". The
  QWERTY default is three rows of ELEVEN, and the layout it replaced was 9/9/9/6.
- **Why not yet:** already published; correcting a shipped note is Ken's call, and the
  manuals were worded to be correct regardless.

---

## Done

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

