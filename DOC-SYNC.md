# Document sync tracker

Tracks when each **product document** was last reviewed for content currency
against the code + design record, so "update documents X, Y, Z" has a precise,
unambiguous starting point.

## What's tracked

Every document in the **project root** whose name begins with **"Conversant AAC"**
(Ken, July 8 2026) — excluding `.bak` backups. These are the living product
documents; the `Other/` folder (research, article drafts, archived versions) is not
tracked.

## How this works (why not modification date)

A document's file modification date is **not** a reliable "is it current" signal — a
format-only edit bumps the mtime without changing content. Instead, each document
records the **git commit it was last reviewed against** (`At commit`), plus a human
date. The change history to review against lives in git: the code, `CLAUDE.md` (the
design decisions), and `CHANGELOG.md` are all version-controlled; the `.docx` files
themselves are git-ignored (OneDrive), so their timestamps were never the right
anchor.

**To bring a document current** ("update the Product Overview"):
1. `git log <that doc's At-commit>..HEAD` — the exact commits since its last review.
2. Read the `CLAUDE.md` / `CHANGELOG.md` entries added in that window.
3. Filter to what's relevant to *that* document's scope, and apply the edits.
4. Update the doc's row here: `Last reviewed` = today, `At commit` = current `HEAD`,
   and a one-line note of what the pass covered.

The tracker bounds the window; judging relevance within it is done at review time.

## Baseline (Ken chose option (a), July 8 2026)

Each document gets a real catch-up review *before* its baseline is stamped to a
commit; a completed row shows `✓ current` with `At commit` = the `HEAD` at review
time, and a `⚠ catch-up pending` row's `At commit` is not yet a trustworthy baseline.

**Done July 8 2026 (commit `9f02669`): the three beta-facing docs — Product Overview,
Architecture Overview, User Manual.** The remaining design docs are still pending
(next catch-up pass). The Architecture Overview has an image residual noted in its
row (Figures 6 & 7).

## Documents

| Document | Status | Last reviewed | At commit | Outstanding / notes |
|---|---|---|---|---|
| Conversant AAC Product Overview.docx | ✓ current | 2026-07-08 | `9f02669` | Caught up July 8 2026: corrected the transcript description (no confirm-gate by default) and removed the never-built "low-confidence words underlined" + the card "hint"; Filler→Placeholder and Move Palette→Response Palette throughout; added "What This System Is Not", conversational honesty, consent + deliberate-listening, per-conversation privacy, Express Panel + Spatial Stability (incl. glossary entries), and a future-directions line (multi-party / batched / cloned voices). Residual: the renamed "Response Palette" glossary entry was left in its former alphabetical slot. |
| Conversant AAC Architecture Overview.docx | ✓ current | 2026-07-08 | `9f02669` | Caught up July 8 2026: Filler→Placeholder; replaced the abandoned "filler ladder" with the shipped single-pool-after-any-turn placeholder model (§11 Timing, §12 Timing Feedback, config registry, JSON schema sketch); corrected the Transcript Validation States section (informational, no gate by default; dropped the low-confidence underline); added a "Conversational Honesty, Consent, and Privacy Behavior" subsection to §9. **RESIDUAL (next pass):** Figures 6 & 7 still depict the old transcript-gate / ladder and need regenerating (no image toolchain on this box); still to add — multi-party (future), a system-requirements section (cloud now / onboard AI as a future track), user-authored "my views" documents into RAG (§6 Phase 3), and the supporter-locked appropriateness filter. |
| Conversant AAC User Manual.docx | ✓ current | 2026-07-08 | `9f02669` | Reviewed July 8 2026 — already current from the v0.5.60 (July 3) manual-review pass. Fixed only: "In my own words" is a compose (pencil) icon now, not a text-labeled button, and standardized "In your own words" → "In my own words" (§4.4 + §7.4, verified against `ui.js`); enhanced the glossary Placeholder entry (plays after anything the partner says). No other drift found (9-button Command Bar table, "four or eight" palette, per-conversation privacy all current). |
| Conversant AAC Conversation Engine Design.docx | ⚠ catch-up pending | — | — | Reconcile with shipped engine: no transcript-confirmation gate (fires on silence); placeholder ladder → single pool, fires after ANY complete partner turn; repair-of-self pre-generates rephrase+expand; floor as a first-class field. Design-doc §6 transcript-gate language still asserts the gate as mandatory (flagged in CLAUDE.md) — relax to "default off". |
| Conversant AAC Conversation Engine Overview.docx | ⚠ catch-up pending | — | — | Same reconciliation as the Design doc, at overview altitude. |
| Conversant AAC Configuration Model.docx | ⚠ catch-up pending | — | — | Check against the current settings surface (Text Size tab, button-size/gap/min-gap sliders, keyboard-separation, per-conversation privacy default) and the additive-merge reconciliation policy for user-owned default sets. |
| Conversant AAC Continuous Partner Capture.docx | ⚠ catch-up pending | — | — | Verify against the shipped capture pipeline: echo filtering, partner-resume handling, interrupt-capture of the partner's partial speech. Likely mostly current. |
| Conversant AAC Keyboard Layout Options.docx | ⚠ catch-up pending | — | — | Layouts renamed to "Side/Bottom Keyboard N"; symbols page now matches the active layout's geometry; QWERTY (B11) added; inline word-prediction ghost. Likely light edits. |
| Conversant AAC Worldview Implementation Plan.docx | ⚠ catch-up pending | — | — | Build Steps 1–4 shipped; relationship graph split into its own model; privacy model is now three-level (shareable / private / prefer-not-to-say). Reconcile status + privacy section. |
| Conversant AAC Security Issues.docx | ⚠ catch-up pending | — | — | Point-in-time security review (July 8 2026). Note: SEC-1 masking sub-point is wrong (field is already CSS-masked) — retract + re-scope to the origin issue, re-rate Medium. Not a living product doc; syncs only when the security posture changes. |

*(`Conversant AAC Conversation Engine Design.bak.docx` is a backup and is intentionally not tracked.)*
