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

### ONE backup, filtered at IMPORT by a device signature (Ken, September 9 2026)
- **Ken's proposal, superseding the two-file split:** *"The more that can go as data... the
  less there's a need for separate settings vs data backup features. It also argues for
  settings profiles to capture everything on that device... data is that subset of settings
  that aren't OS dependent and is a virtual, not a physical concept... only those settings
  that aren't OS dependent are then imported on the new machine. How does a machine know
  that it is a 'new' machine for the import step. I don't know... keyguard properties don't
  need to travel to a new device type. Do you record in settings the device type associated
  with the settings?"*
- **⚠ THE DECISIVE ARGUMENT FOR IT, and it is worth stating because it is not the obvious
  one: THE CLASSIFICATION BELONGS AT IMPORT, NOT EXPORT.** At export time nobody knows where
  the file is going, so any split forces the user to guess the destination. At import time
  the app knows both sides. Two files ask the user a question the app is better placed to
  answer.
- **The app CAN tell, and already computes most of it.** `platform.describe()` yields OS
  family, browser shell, Home Screen app vs tab, and speech availability. Missing for this
  purpose: **screen dimensions**, which are what the keyguard turns on. Signature = OS family
  + standalone/tab + folder-picker present + layout viewport size.
- **Record it in the FILE/PROFILE HEADER, not in the settings bundle.** Profiles already
  carry `name` / `savedAt` / `version`; `device` belongs beside them. Putting it inside
  settings means it becomes a travelling setting that then has to be excluded again - the
  PROFILE_EXCLUDE dance, for a value that is a fact about the file rather than a preference.
- **Two axes fall out, matching Ken's own two examples:** OS (folder rules, keyboard mode,
  which speech services work) and SCREEN (keyguard). So three tiers, not a yes/no: same
  signature -> everything; same OS, different screen -> hold back the screen-geometry set;
  different OS -> also hold back the OS set.
- **⚠ THE HOLD-BACK LIST IS ABOUT THREE ITEMS**, which cuts both ways: the mechanism is
  cheap and low-risk, and it is fair to ask whether it earns itself against simply importing
  everything and letting the user adjust. The answer is probably that the value is in the app
  being able to SAY what it kept and what it did not, which for this population is worth more
  than the three taps.
- **⚠ A GAP IN THE FORMULATION TO CLOSE FIRST: "data is a subset of settings" leaves out the
  actual content.** About Me answers, people, places, the panel's words, phrases and
  conversations are not settings at all. So the backup is content PLUS settings, and the
  import filter applies only to the settings half; content always travels whole.
- **⚠ ONE GENUINE TENSION with Ken's earlier call that service choice is operational:** on an
  iPad Home Screen the free recognizer delivers nothing (measured, July 30 2026), so
  travelling "use the browser's own listening" there lands someone on a device that cannot
  hear. It is visible and fixable, but it is the clearest candidate for the OS hold-back set.
- **Why not now:** Ken has not chosen between this and the two-file split, and this supersedes
  work already shipped in 0.10.13, so it needs his decision before anything moves.

### What is a SETTING and what is DATA — a rule, and the re-filing it implies
- **Raised:** 2026-09-09 — Ken, after importing data onto his Android tablet: *"I expected
  my Express Panel buttons to be part of that import. I didn't expect my Band sizes to come
  across... Maybe we need to think about what is a setting and what is data. It might be
  easiest to come up with a rule that defines a 'setting'. I think it should be something
  that is uniquely impacted by the device screen size. These can be second order like
  keyboard layout > express panel band size."*
- **Confirmed empirically, and it is wrong in BOTH directions.** Band sizes live inside
  `express-panel.json`, which is a DATA file, so they travelled — exactly what he saw. And
  `contextMark`, which is purely the LOOK of the Context band, lives in settings, so it does
  not travel. Today the split is by which STORE a value happens to sit in, not by what it
  means.
- **The rule's shape is right; "screen size" is too narrow, and his own manual proves it.**
  The Backup Compatibility document lists four things a user must set up again on a new
  device — the API key, the voice, on-screen vs physical keyboard, and how the app hears the
  other person. **Not one of them is screen-size dependent**, so under the literal rule all
  four become data and all four travel wrongly: a voice that is not installed, a keyboard
  mode wrong for the hardware, a transcription service that does not work on that device.
- **Proposed instead: is it a property of the DEVICE or of the PERSON?** Screen size is the
  biggest case but not the only one; installed voices, an attached keyboard and which speech
  services work there are the rest. Ken's second-order clause is kept and is the sharp part
  (keyboard layout > band size).
- **⚠ SEPT 9, LATER: THE SAFETY ARGUMENT COLLAPSED, and Ken got there first** (*"I'm
  beginning to think that there aren't many things that can't travel - and they're
  primarily OS related"*). Applying his easier test - can it be easily tuned? - to all 44
  stored settings, **nothing is genuinely non-travelable.** Every one is a picker, slider,
  checkbox or radio reachable from Settings without typing, so a wrong value costs one
  adjustment. The one true trap, full screen on an iPad, is ALREADY guarded in code (the
  request returns early on iOS and the control is hidden), so even that travels harmlessly.
  What is excluded from both files is excluded for OTHER reasons entirely: the six keys for
  secrecy, and installId / testerName / usage counters / lastSeenVersion as per-device
  bookkeeping.
- **⚠ SO THE SPLIT CANNOT BE JUSTIFIED ON SAFETY, and that reopens what the two files are
  FOR.** The remaining justification is CHOICE - Ken's original words were *"not necessarily
  my settings"*, which is a want, not a risk. Under choice the natural line is **"my words"
  vs "my setup"**: data is who you are and what you say (About Me, people, places, panel
  CONTENT, phrases, conversations), settings is how the app is arranged and behaves (layout,
  sizes, timings, colours, band sizes). **That line puts band sizes in SETTINGS, which is the
  opposite of where "easily tuned" puts them and is what Ken's original complaint asked for**
  - the two axes genuinely disagree and he has now argued both. Recommend the words/setup
  line, because it is the one a user can predict from the two button names.
- **⚠ CORRECTION to an earlier claim in this entry: storage permission, quota and usage are
  NOT stored settings.** They are fields on a status object a regex picked up. Nothing about
  device storage travels today, so there is no bug there to fix.
- **Roughly 18 of 44 portable settings are operational** and would move to data under that
  rule — placeholder timings and the ease-off, silence period, tap mode and double-tap
  interval, colour scheme, the band mark, cards per category, chime, auto-relisten.
- **Why not now:** it is a decision Ken has not made yet, and the cheap implementation is
  worth stating before anyone starts: split by KEY at export time rather than moving values
  between stores. One settings store stays; the data file carries the operational subset and
  the settings file the device subset. No storage migration, no new files, and reversible.
  Band sizes are the one genuine move, out of `express-panel.json` and into the settings
  file.

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

