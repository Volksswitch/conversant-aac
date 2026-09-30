# The plain-speak check on chat replies

Reads Claude's long chat replies against the project's plain-speak rules and sends
them back to be rewritten when it finds a fault.

**Why it exists (Ken, September 30 2026).** He read "no table surgery" in a reply and
asked whether the plain-speak rules could be applied to conversations. The document
tests already catch a misspelling and a British word; nothing had ever checked a chat
reply, because nothing could see one. **A Stop hook can.**

**It is a READER, not a word list, and that is the whole point.** A word list would
not have caught "table surgery" — every word in it is correct and the sentence parses
perfectly. That is the third tier the American-English rule in `CLAUDE.md` describes,
and the tier that actually loses Ken.

## Switching it on, on a machine that does not have it yet

`.claude/` is excluded from the repository, so the setting is per machine while these
scripts travel with the project. Add this to `.claude/settings.local.json`:

```json
"hooks": {
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "python \"$CLAUDE_PROJECT_DIR/scripts/writing-check/check-reply.py\"",
          "timeout": 40,
          "statusMessage": "Reading that reply against the plain-speak rules"
        }
      ]
    }
  ]
}
```

It needs an Anthropic API key, from `ANTHROPIC_API_KEY` or the gitignored
`.anthropic-key` file at the project root — the same two places the live test tier
looks. With no key it does nothing at all.

## What it does and does not do

- **Long replies only** — 150 words, about three paragraphs. Ken's choice: the
  constructions creep into long explanatory answers, and a pause before every "yes"
  would be resented within a day. Change it with
  `CONVERSANT_WRITING_CHECK_MIN_WORDS`.
- **One rewrite per reply, never two.** One is the benefit; a second is Ken watching a
  spinner while two models argue about a word.
- **It fails silent.** No key, no network, a timeout, bad input, a crash — it says
  nothing and lets the reply through. It sits between Ken and every answer he gets,
  so breaking the conversation to protect its own prose is the wrong trade every time.
- **It costs about a penny and a few seconds** per long reply, on Ken's key.

## Testing it

```
python scripts/writing-check/run-cases.py
```

Five cases with known right answers, one small model call each. **Read the output
rather than the exit code** — it reads a model, so a judgment call can go either way
between runs, and a red build on one would become noise.

**⚠ THE FALSE-POSITIVE CASES MATTER MORE THAN THE OTHERS.** Ken's standing rule
decides which way to err: a check that fires on correct writing is one people learn to
scroll past, which is worse than no check. Every tightening has to be measured against
the clean cases as well as the faulty ones — the two pull in opposite directions, and
moving one moved the other every single time during the build.

## What it cost to get right, so it is not re-derived

Four measured failures, none of them predictable from reasoning:

1. **Haiku could not do it, in both directions.** It invented four findings on a clean
   reply, one quoting words that were not in the reply at all; raising the bar to stop
   that made it go silent on a planted metaphor and on three pieces of jargon. Sonnet
   is the cheapest model that held both ends.
2. **It read straight past the metaphor** when three British phrases sat around it —
   it reported those three and stopped looking. The metaphor check is now a pass of its
   own, made first, and the prompt says why.
3. **It flagged "commit", "push" and "repository" as jargon.** Ken wrote the trigger
   phrase "bump Conversant" and asks for work to be committed and pushed, so those are
   shared vocabulary here. Without that exemption the check sends a reply back for
   words Ken used in the message it is answering.
4. **⚠ THE FAIL-SILENT DESIGN HID A TEST FAULT AND COST THE LONGEST DETOUR.** Two cases
   reported a failure with no findings, which reads exactly like the model going silent
   on a planted fault. The replies were simply shorter than the 150-word threshold, so
   the check never ran and the model was never asked. The harness now sets the
   threshold to zero except in the one case that tests the threshold itself.

**The general lesson, and it is one this project keeps paying for: when a check is
silent, establish whether it ran before concluding anything about what it found.**
