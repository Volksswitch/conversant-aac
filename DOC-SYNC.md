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

Every document below is marked **⚠ catch-up pending**: several have drifted, so each
gets a real catch-up review *before* its baseline is stamped to a commit. As each
doc's catch-up is completed, its row moves to `✓ current` with `At commit` = the
`HEAD` at that time. Until then, do not treat `At commit` as a trustworthy baseline
for that row.

Recommended catch-up order (beta-facing first): **Product Overview → Architecture
Overview → User Manual**, then the design docs.

## Documents

| Document | Status | Last reviewed | At commit | Outstanding / notes |
|---|---|---|---|---|
| Conversant AAC Product Overview.docx | ⚠ catch-up pending | — | — | Positioning + feature set drift. Pending items in CLAUDE.md **"Overview-Document To Do List"**: "What This System Is Not" section; conversational honesty; multi-party (future); deliberate Start-Listening + no auto-listen; partner recording indicator; target-age (16+) rationale; future near-real-time/batched comms. Plus recent features: Express Panel, Response Palette (4/8 cards), placeholders-after-any-turn, per-conversation privacy ("Don't save"). |
| Conversant AAC Architecture Overview.docx | ⚠ catch-up pending | — | — | Pending items in CLAUDE.md **"Overview-Document To Do List"**: conversational honesty (generation principle) + no-fabricated-autobiography; multi-party; Start-Listening/consent behavior; recording indicator; supporter-locked appropriateness filter; user-authored "my views" docs into RAG (Phase 3); system-requirements section (cloud now / onboard AI as a future track); near-real-time/batched comms. Plus: the security posture (shared-origin, CSP, private-conversation gating) and the planned settings-persistence / per-device-profile model. |
| Conversant AAC User Manual.docx | ⚠ catch-up pending | — | — | UI has moved since last review: Command Bar (title bar removed), About Me inside Settings, Text Size tab, per-conversation "Don't save", 8-card mode → 8 slots, new starters/closings + auto-append, placeholders now after any partner turn, repair options show real text, error-log viewer + transcript wash. Verify every asserted UI label against source (CLAUDE.md working guideline). |
| Conversant AAC Conversation Engine Design.docx | ⚠ catch-up pending | — | — | Reconcile with shipped engine: no transcript-confirmation gate (fires on silence); placeholder ladder → single pool, fires after ANY complete partner turn; repair-of-self pre-generates rephrase+expand; floor as a first-class field. Design-doc §6 transcript-gate language still asserts the gate as mandatory (flagged in CLAUDE.md) — relax to "default off". |
| Conversant AAC Conversation Engine Overview.docx | ⚠ catch-up pending | — | — | Same reconciliation as the Design doc, at overview altitude. |
| Conversant AAC Configuration Model.docx | ⚠ catch-up pending | — | — | Check against the current settings surface (Text Size tab, button-size/gap/min-gap sliders, keyboard-separation, per-conversation privacy default) and the additive-merge reconciliation policy for user-owned default sets. |
| Conversant AAC Continuous Partner Capture.docx | ⚠ catch-up pending | — | — | Verify against the shipped capture pipeline: echo filtering, partner-resume handling, interrupt-capture of the partner's partial speech. Likely mostly current. |
| Conversant AAC Keyboard Layout Options.docx | ⚠ catch-up pending | — | — | Layouts renamed to "Side/Bottom Keyboard N"; symbols page now matches the active layout's geometry; QWERTY (B11) added; inline word-prediction ghost. Likely light edits. |
| Conversant AAC Worldview Implementation Plan.docx | ⚠ catch-up pending | — | — | Build Steps 1–4 shipped; relationship graph split into its own model; privacy model is now three-level (shareable / private / prefer-not-to-say). Reconcile status + privacy section. |
| Conversant AAC Security Issues.docx | ⚠ catch-up pending | — | — | Point-in-time security review (July 8 2026). Note: SEC-1 masking sub-point is wrong (field is already CSS-masked) — retract + re-scope to the origin issue, re-rate Medium. Not a living product doc; syncs only when the security posture changes. |

*(`Conversant AAC Conversation Engine Design.bak.docx` is a backup and is intentionally not tracked.)*
