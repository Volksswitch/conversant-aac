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

### Two design records left WRONG by the September 9 backup churn
- **Raised:** 2026-09-09 — found while working out why doc syncs must not follow releases.
- **What is wrong:** the **Architecture Overview** says Export/Import "writes what the user
  owns into two files, data and settings, kept apart because the data belongs on any device
  while the settings describe one" — false since 0.10.15, which put it back to one file.
  **Express Panel Design** says "restoring a data backup replaces About Me, people, places
  and the panel together" — a restore now replaces the settings too, and there is no "data
  backup" distinct from a backup.
- **⚠ BOTH WERE CORRECT UNTIL I EDITED THEM.** The Architecture Overview said "a single
  file", which is true again today. The 0.10.13 sync made two right documents wrong, and
  0.10.15 did not catch them because neither is reader-facing.
- **Why not now:** Ken is testing the migration features and has said he may come back for
  more work on them. Editing a third time on a design that may move again is the exact
  mistake this entry exists to record. Fix at the next sync, once he says the feature is
  settled — and check whether simply reverting to the pre-0.10.13 wording is right, since
  for the Architecture Overview it already is.

### The layout borders cannot be grabbed with a finger
- **Raised:** 2026-09-09 — Ken, on small touch-screen devices: *"it was impossible to grab
  the divider at the bottom of the command bar with a finger without invoking a button. The
  line at the left of the right side express panel has the same problem."*
- **Measured cause:** the grab zone is `GRIP_PX = 20` tested as ±10px, so **20 CSS px, about
  5mm** — roughly HALF a fingertip contact patch, and about a fifth of the minimum touch
  target both Apple (44pt) and Google (48dp) publish. A press 11px from the border reaches
  the button instead.
- **⚠ THE STRUCTURAL REASON IT IS THIN, which is what a naive fix would miss: the buttons
  stay LIVE while the layout is unlocked.** `layout-dragging` kills pointer events only once
  a drag has been claimed. So the app is serving two gestures on the same pixels, and the
  grip must stay narrow or it would eat presses meant for buttons. **Widening it alone just
  moves the failure to the other side.**
- **⚠ AND THE COMMENT IN styles.css STATES THE WRONG PREMISE OUT LOUD:** *"Touch gets
  nothing from this and needs nothing: the border is live along its whole length, so there is
  no small target to find."* Length was never the problem; THICKNESS is. Fix that comment
  with the code.
- **⚠ THE DEEPER POINT: A DRAG IS THE WRONG PRIMITIVE FOR THIS POPULATION AT ALL.** It needs
  sustained contact plus controlled movement, which is among the hardest gestures for someone
  with limited motor control - the reason the double-tap safeguard exists. So a bigger target
  helps the people who can already drag and still excludes the ones who cannot. Any fix should
  offer a discrete alternative (tap a border to select it, then large nudge buttons), not just
  a fatter grab zone.
- **Proposed shape:** an explicit "Adjust layout" mode in which the conversation surface goes
  inert (the precedent exists - `main.disabled { pointer-events: none }` for the pre-start
  state, and Rule 8's modal-assets-over-inert-elements), each border draws a real handle of at
  least 48px, and the handle can be dragged OR tapped-then-nudged. Done exits.
- **Why not now:** Ken asked what a better mechanism would be, not for one to be built, and
  the choice between a mode, Settings sliders and nudge-only is his.

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

