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

### CLAUDE.md says "triple coding" where the app now has two visible codings
- **Raised:** 2026-09-08 — found while reviewing Ken's Architecture Overview corrections
- **Wanted:** the UI rule says slot identity is position + colour + text badge. The badge
  is real but reaches only the accessible name (`ui.js`: "Category isn't shown visually"),
  so what a sighted user gets is position + colour. Correct the rule, keeping the
  "never colour alone" requirement it exists to protect.
- **Why not yet:** it is a wording fix to a settled rule, not a behavior change, and it
  wants Ken's eye on whether the badge should become visible instead.

### The 0.10.7 release note misstates the Express Panel grid
- **Raised:** 2026-09-08 — found while syncing the manuals
- **Wanted:** the note says "three rows of twelve rather than four rows of nine". The
  QWERTY default is three rows of ELEVEN, and the layout it replaced was 9/9/9/6.
- **Why not yet:** already published; correcting a shipped note is Ken's call, and the
  manuals were worded to be correct regardless.

### Architecture Overview still owes the deferring-option note
- **Raised:** 2026-09-08 — the 0.10.6–0.10.9 sync was reverted when the document turned
  out to be under review
- **Wanted:** the response-palette section should record the deferring option ("give me a
  second and I'll type it") — not a fifth slot but a property a card in any slot can
  carry, the one option that does not close the open sequence, never placed first.
- **Why not yet:** the document is now clear of review artifacts, so this can be synced.

---

## Done

### Sample conversations exercising the five modes together
- **Raised:** 2026-09-08 — Ken, as a comment on the Architecture Overview
- **Done:** 2026-09-08 — "What the Five Modes Look Like Together" in the Product
  Overview: two sample conversations, one social and one at a pharmacy counter, with the
  mode noted in brackets. The section exists to make one point — the user never selects a
  mode, they choose what to say and the system follows.
