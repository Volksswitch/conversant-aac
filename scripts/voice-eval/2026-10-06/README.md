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

The judge is the same model family that writes the suggestions. Treat any judge score
as one measure among several, never as proof that the suggestions sound like someone.
