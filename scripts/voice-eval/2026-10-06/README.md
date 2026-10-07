# Sounds-like-me evaluation scripts, October 6 2026

These are the scripts behind `Documents/Conversant AAC Sounds Like Me Evaluation.docx`,
kept as they were run. They are the starting point for TODO.md's "A persona test before
any model or prompt change" (Sounds like me, item 3). They are not maintained tools yet.

**Before running any of them:**

- **Some point at a temporary folder that no longer exists.** Eleven of them name the
  session's scratch folder in an absolute path, and others expect files that folder
  held. Change those paths to a folder of your own before you run anything.
- **The live ones spend real money on the project's API key.** They read the key from
  the git-ignored `.anthropic-key` at the project root (or `ANTHROPIC_API_KEY`), the same
  way `tests/live.test.mjs` does. Each main experiment cost about $3.
- **The personas and their lines are invented** (Marc and Grace, written for the test).
  A result here shows whether the app passes along a voice it is given, not whether it
  finds a real person's voice.
- **The raw outputs are not kept here**, only the scripts.

**What each folder did:**

| Folder | What it measured |
|---|---|
| `exp-dose` | Each layer added in turn (About Me, How I Sound, 4, 12 and 30 example sentences, Reframe on every turn), judged blind against the persona's own lines |
| `exp-review` | The real review pipeline after reviewing 0, 1, 3 and 10 conversations |
| `verify-c4` | The corrected re-scoring of `exp-review` (its first judge parser was wrong) |
| `verifier-c6` | The length instruction on its own, which made options longer |
| `dose-validity` | Whether the judge's score measured more than length, and the correction for many comparisons |
| `soundcheck-length` | How I Sound's length signal compared with the live one |
| `practice-harvest` | How practice conversations changed what the app read |
| `voice-layer` | The harvest over the test data, and the length-measure bias |
| `prompt-assembly` | The full instructions sent to the AI, and their sizes |
| `exp-instructions` | Test A of `scripts/voice-eval/TEST-PLAN-instructions-and-review.md`: four changes to the instructions (the user's words win over rules about how to word a reply, sample wordings out, the user's own declines beside the decline rule, one habit word allowed), applied by rewriting the outgoing request, never the app. Marc and Grace, plus nine safety probes. `run-a.mjs prep / dry / gen / judge / analyze`; `page.mjs` builds the 10-minute check page. Shared pieces (the request wrapper, word lists, judge, statistics, a cost ledger with a $25 stop) are in `common.mjs`; the change table is `edits.mjs`. Set `OUT` to a folder outside the project. Results are in TODO.md under "Let the user's own evidence outrank the fixed style rules" |
| `exp-rewrite-review` | Test B of the same plan: review as one rewrite per conversation, and as a full rewrite of every turn, for Marc with Devon and with a blunt-with-Mom Marc, under today's and the new instructions. The material (rewrites, the judge's reference lines, new partner turns) is `spec.mjs`. `run-b.mjs check / dry / gap / gen / judge / analyze`; run it in its own process, separately from Test A. Results are in TODO.md under "Rebuild review around tapping" |
| `exp-review-moment` | Review lessons kept per person and tagged with the moment, against no review and today's review, with and without the person's "how I talk with them" settings (`NOPROFILE=1`). Set `OUT` to a folder outside the project before running. Results are in TODO.md under "Rebuild review around tapping" |

The judge is the same model family that writes the suggestions. Treat any judge score
as one measure among several, never as proof that the suggestions sound like someone.
