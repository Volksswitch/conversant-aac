#!/usr/bin/env python3
"""
Exercise check-reply.py against replies whose right answer is known.

⚠ THE FALSE-POSITIVE CASES MATTER MORE THAN THE OTHERS, and both faults this suite
exists for showed up in a real run rather than in reasoning: the check first
reported three British constructions and read straight past the metaphor sitting
between them, then invented four findings on a reply with nothing wrong in it -
one of them quoting words that were not in the reply. Ken's standing rule decides
which way to err: a check that fires on correct writing is one people learn to
scroll past, which is worse than no check.

  python scripts/writing-check/run-cases.py

Each case costs one small Haiku call. It reads the same key the live test tier
reads and skips with a message when there is none.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "check-reply.py"

# Each case: name, the reply, and whether the check SHOULD send it back.
# "must_fire" names the words a finding has to mention for the case to count.
CASES = [
    dict(
        name="clean long reply - must stay silent",
        fire=False,
        reply="""Committed and published, and the writing check is part-way set up.

Committed as one change, locally only, so nothing pushed and no tester sees it yet.
Published means the corrected guide is on the documents page. I checked it, and there
is one old file left for you to delete, named above.

I've installed a temporary probe. When I finish a reply, it records what the check is
actually handed. I need to know whether it gets the words I wrote, because that
decides whether this can work at all.

Send me anything, even "ok", and I'll read what it captured. The probe cannot run
until this reply ends, which is why I can't just test it myself. It records to a
scratch file, changes nothing, and comes out once I've read it.

Two things I found while setting it up. This will only exist on the laptop, because
the folder holding your Claude settings for this project is deliberately kept out of
the repository, so nothing in it reaches the desktop. I will put the check itself in
the project's own scripts folder, which does travel, and then the desktop needs one
line added to switch it on.""",
    ),
    dict(
        name="plain report of a decision - must stay silent",
        fire=False,
        reply="""The prices are corrected. ElevenLabs hearing goes from $0.40 to $0.22 an hour and
speaking from $0.10 to $0.08 per thousand characters. I confirmed both against
ElevenLabs' own pricing page, and both are the rate for the exact voice and
transcription the app asks for, not a similar one.

Bigger than the price: the app was asking ElevenLabs to transcribe with a model they
have retired. Nobody knows whether a retired model still answers, so that was either
paying for something obsolete or failing outright.

Nothing anywhere can confirm the fix. The Test button asks for the voice list, so it
proves the key and says nothing about transcription. I recorded that on the deferred
list rather than leaving it as a sentence somebody has to remember.

Two things need your word: whether to commit the six changed files, and whether to put
the corrected guide on the website.""",
    ),
    dict(
        name="a metaphor among louder British faults - must catch the metaphor",
        fire=True,
        must_fire="table surgery",
        reply="""Done, with one correction to my earlier report and one judgment call for you.

I was wrong that the guide tells the reader ElevenLabs can't hear. That sentence is in
the guide's old generator script, which has drifted from the document.

The guide has six corrections, all text, no table surgery: the speaking price range,
the "three to six times the price" claim in two places, and the source note that said
they only sell monthly plans.

Shall I go ahead and commit? Have a look at the ranking paragraph first if you'd like,
and I'll sort out the rest straight away.""",
    ),
    dict(
        name="programming jargon - must catch it",
        fire=True,
        must_fire="object",
        reply="""I've fixed the hearing path. The catalog entry was handing the service a stale voice
id, so every utterance was refused at the edge before the permission header was even
attached.

The fix walks the provider object rather than doing a two-way test, so an unknown
service returns null and the backend falls back to its own default instead of
inheriting Deepgram's. I also had to parse the refusal body to get at the real reason,
because the old code read it only to throw it away.

The regex that matched the voice id had a dead backslash in it, which is why nothing
ever fired. Tests pass, 994 of them.""",
    ),
    dict(
        name="short reply with a metaphor - the length gate must keep it silent",
        fire=False,
        min_words=None,      # the shipped 150-word threshold, not the test override
        reply="""Done. Six corrections to the guide, all text, no table surgery.""",
    ),
]


def run(reply, prompt_id, min_words="0"):
    """⚠ min_words DEFAULTS TO 0 HERE, AND THAT IS THE POINT: these cases test the
    JUDGMENT, not the length gate. Leaving the real 150-word threshold in place cost
    a long detour - two cases reported FAIL with no findings, which reads exactly
    like the model going silent on a planted fault, and the replies were simply too
    short for the check to run at all. The fail-silent design is right in the hook
    and it hides its own reason, so a case that needs the gate must say so."""
    payload = json.dumps({
        "last_assistant_message": reply,
        "stop_hook_active": False,
        "prompt_id": prompt_id,
    })
    env = dict(os.environ, CONVERSANT_WRITING_CHECK_MIN_WORDS=min_words)
    out = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=payload, capture_output=True, text=True, encoding="utf-8", env=env,
    )
    if out.returncode != 0:
        return None, f"script exited {out.returncode}"
    raw = (out.stdout or "").strip()
    if not raw:
        return "", None
    try:
        return json.loads(raw)["reason"].split("\n\n", 1)[1], None
    except (ValueError, KeyError, IndexError):
        return None, "output was not the expected JSON: " + raw[:200]


def main():
    passed = failed = 0
    for i, case in enumerate(CASES):
        mw = case.get("min_words", "0")
        findings, err = run(case["reply"], f"case-{i}-{id(case)}",
                            min_words="150" if mw is None else mw)
        if err:
            print(f"  ERROR  {case['name']}\n         {err}")
            failed += 1
            continue

        fired = bool(findings)
        ok = fired == case["fire"]
        if ok and case["fire"] and case.get("must_fire"):
            ok = case["must_fire"].lower() in findings.lower()

        print(f"  {'pass' if ok else 'FAIL'}   {case['name']}")
        if findings:
            for line in findings.splitlines():
                if line.strip():
                    print("         " + line.strip()[:150])
        passed, failed = (passed + 1, failed) if ok else (passed, failed + 1)

    print(f"\n{passed} passed, {failed} failed")
    # ⚠ Exits 0 even on a failure. This reads a model, so a case can go either way
    # between runs; a red build on a judgment call would be noise. Read the output.
    return 0


if __name__ == "__main__":
    sys.exit(main())
