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

**Trigger phrase (Ken):** **"sync docs"**, optionally naming documents — e.g. "sync
docs", "sync docs Product Overview", "sync docs the two overviews and the user manual".

**To bring a document current** ("sync docs: Product Overview"):
0. **Back up first (MANDATORY):** copy the `.docx` to `Doc Backups/<name> <YYYY-MM-DD_HHMMSS>.docx`
   before touching it. Never edit a product document without a fresh backup in the
   same pass.
1. `git log <that doc's At-commit>..HEAD` — the exact commits since its last review.
2. Read the `CLAUDE.md` / `CHANGELOG.md` entries added in that window.
3. Filter to what's relevant to *that* document's scope, verify any UI detail against
   source, and apply the edits.
4. Update the doc's row here: `Status` = `✓ current`, `Last reviewed` = today,
   `At commit` = current `HEAD`, and a note of what the pass covered + any residual.

The tracker bounds the window; judging relevance within it is done at review time.

## Baseline (Ken chose option (a), July 8 2026)

Each document gets a real catch-up review *before* its baseline is stamped to a
commit; a completed row shows `✓ current` with `At commit` = the `HEAD` at review
time, and a `⚠ catch-up pending` row's `At commit` is not yet a trustworthy baseline.

**Done July 8 2026: the three beta-facing docs — Product Overview, Architecture
Overview, User Manual** — caught up and then re-synced for the **0.5.78** release
(stamped at commit `5f672f5`). The remaining design docs are still pending (next
catch-up pass). The Architecture Overview has an image residual noted in its row
(Figures 6 & 7).

## Documents

| Document | Status | Last reviewed | At commit | Outstanding / notes |
|---|---|---|---|---|
| Conversant AAC Product Overview.docx | ✓ current | 2026-07-08 | `5f672f5` | Caught up July 8 2026: corrected the transcript description (no confirm-gate by default) and removed the never-built "low-confidence words underlined" + the card "hint"; Filler→Placeholder and Move Palette→Response Palette throughout; added "What This System Is Not", conversational honesty, consent + deliberate-listening, per-conversation privacy, Express Panel + Spatial Stability (incl. glossary entries), and a future-directions line (multi-party / batched / cloned voices). **Re-checked for the 0.5.78 release:** already reflects it (placeholders-after-any-turn, per-conversation privacy, 8-card option); repair-shows-real-text and additive-merge are below overview altitude — no new edits. Residual: the renamed "Response Palette" glossary entry was left in its former alphabetical slot. **Pending (since `5f672f5`, Ken July 9 2026):** document that AI/LLM access is NOT required for basic functionality — with the AI down or no key, manual conversation (Express Panel + "In my own words") and partner-speech validation (the transcript) still work + save; the AI adds the *suggested-response* layer on top (graceful degradation / positioning). |
| Conversant AAC Architecture Overview.docx | ✓ current | 2026-07-08 | `5f672f5` | Caught up July 8 2026: Filler→Placeholder; replaced the abandoned "filler ladder" with the shipped single-pool-after-any-turn placeholder model (§11 Timing, §12 Timing Feedback, config registry, JSON schema sketch); corrected the Transcript Validation States section (informational, no gate by default; dropped the low-confidence underline); added a "Conversational Honesty, Consent, and Privacy Behavior" subsection to §9. **0.5.78 re-sync (non-user-visible architecture changes):** updated repair-of-self to pre-generated rephrase/expand (§11 [272], §12 latency dot, Table 2) and added the additive-merge reconciliation policy (new "User-Owned Content Sets" entry in Data Stores). **RESIDUAL (next pass):** Figures 6 & 7 still depict the old transcript-gate / ladder and need regenerating (no image toolchain on this box); still to add — multi-party (future), a system-requirements section (cloud now / onboard AI as a future track), user-authored "my views" documents into RAG (§6 Phase 3), and the supporter-locked appropriateness filter. **Pending (since `5f672f5`, Ken July 9 2026):** document the AI-optional / graceful-degradation property — the LLM is an enhancement layer, not a hard dependency; basic functionality (partner-speech validation via the transcript + manual communication via Express Panel / "In my own words", recorded + saved) survives with no LLM. Distinguish from the *STT* network dependency (partner capture is a cloud service). |
| Conversant AAC User Manual.docx | ✓ current | 2026-07-08 | `3c407de` | Added a discoverable **§6.5 Controls Tab** subsection (Ken flagged it as "missing" from Settings — it was only in §8 Persistent Buttons, pointed to from the §6 intro; verified the editor's Hold on / Ask them to repeat / openers / closings / {name} / Reset against `control-phrases-editor.js` + `ui.js` button labels), renumbered Keyguard→6.6 / About→6.7, and updated the §6 intro count (seven tabs described here, two elsewhere). Added the missing "Do not save conversations…" row to the Conversation-tab reference table (was covered in §4.5 prose but not the table). Verified the Speech & Input + Conversation tables otherwise cover the current settings surface. **Word TOC is an auto-field — refreshes on open in Word (the new §6.5 entry + renumbers appear then); this box has no Word toolchain to force the refresh.** |
| Conversant AAC Conversation Engine Design.docx | ⚠ catch-up pending | — | — | Reconcile with shipped engine: no transcript-confirmation gate (fires on silence); placeholder ladder → single pool, fires after ANY complete partner turn; repair-of-self pre-generates rephrase+expand; floor as a first-class field. Design-doc §6 transcript-gate language still asserts the gate as mandatory (flagged in CLAUDE.md) — relax to "default off". |
| Conversant AAC Conversation Engine Overview.docx | ⚠ catch-up pending | — | — | Same reconciliation as the Design doc, at overview altitude. |
| Conversant AAC Configuration Model.docx | ⚠ catch-up pending | — | — | Check against the current settings surface (Text Size tab, button-size/gap/min-gap sliders, keyboard-separation, per-conversation privacy default) and the additive-merge reconciliation policy for user-owned default sets. |
| Conversant AAC Continuous Partner Capture.docx | ⚠ catch-up pending | — | — | Verify against the shipped capture pipeline: echo filtering, partner-resume handling, interrupt-capture of the partner's partial speech. Likely mostly current. |
| Conversant AAC Keyboard Layout Options.docx | ⚠ catch-up pending | — | — | Layouts renamed to "Side/Bottom Keyboard N"; symbols page now matches the active layout's geometry; QWERTY (B11) added; inline word-prediction ghost. Likely light edits. |
| Conversant AAC Worldview Implementation Plan.docx | ⚠ catch-up pending | — | — | Build Steps 1–4 shipped; relationship graph split into its own model; privacy model is now three-level (shareable / private / prefer-not-to-say). Reconcile status + privacy section. |
| Conversant AAC Security Issues.docx | ⚠ catch-up pending | — | — | Point-in-time security review (July 8 2026). Note: SEC-1 masking sub-point is wrong (field is already CSS-masked) — retract + re-scope to the origin issue, re-rate Medium. Not a living product doc; syncs only when the security posture changes. |
| Conversant AAC Known Issues.docx | ✓ current | 2026-07-10 | `96b5ba4` | Tester-facing known-issues list, created July 10 2026. 11 items across During-a-conversation / Speech-and-voice / Setup-and-devices, each with What you'll notice / Why / What to do / Status. **Keep current as issues are resolved:** when a listed limitation is fixed, remove or update it — e.g. #1 placeholder/partner-resumption collision (resolved by partner voice recognition), #8 single-instance guard, #9 settings-to-data-folder portability, #4 multi-party support. Generator: scratchpad `gen-known-issues.mjs` (docx-js). No image toolchain on this box; render in Word to eyeball layout. |

*(`Conversant AAC Conversation Engine Design.bak.docx` is a backup and is intentionally not tracked.)*
