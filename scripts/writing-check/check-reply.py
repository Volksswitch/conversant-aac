#!/usr/bin/env python3
"""
Read Claude's chat reply against the project's plain-speak rules, and send it back
to be revised when the reply breaks them.

WHY THIS EXISTS (Ken, September 30 2026, after "no table surgery" reached him):
the American-English rule already records that writing faults come in three tiers -
a misspelling, a British word, and a CONSTRUCTION made entirely of correct plain
words. The document tests catch the first two and nothing has ever checked the
third, because nothing could see a chat reply. This can. So it is a READER, not a
word list: a word list would not have caught "table surgery", which is the fault
that prompted it.

Ken chose a reader on LONG replies only (September 30 2026), over one on every
reply: the constructions creep into the long explanatory answers, and a pause
before every "yes" would be resented within a day.

  HOW IT RUNS
  A Stop hook. Claude Code hands it the finished reply on stdin as JSON
  (`last_assistant_message`), and a `{"decision": "block", "reason": ...}` on stdout
  sends that reason back to Claude, which then revises and finishes again.

  ⚠ IT MUST FAIL SILENT, AND THAT IS NOT LAZINESS. This sits between Ken and every
  answer he gets. A check that throws, hangs, or blocks on its own confusion would
  break the conversation to protect its prose, which is the wrong trade every time.
  So every error path exits 0 and says nothing, and the network call is capped.

  ⚠ IT MAY BLOCK A REPLY ONCE. Never twice. One revision is the whole benefit; a
  second is Ken watching a spinner while two models argue about a word. Guarded
  twice over - `stop_hook_active`, which Claude Code sets on a re-run, and a note of
  the last prompt it blocked, because that flag alone proved too narrow to trust.
"""

import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Long replies only - Ken's choice. Tune it here; 150 words is about three
# paragraphs, and leaves "done", "committed", and a one-line answer alone.
MIN_WORDS = int(os.environ.get("CONVERSANT_WRITING_CHECK_MIN_WORDS", "150"))

# ⚠ SONNET, NOT HAIKU, AND THE MEASUREMENT IS THE REASON. Haiku was tried first
# because the reading looked like a small job. It is not: spotting a metaphor built
# of correct words while leaving ordinary phrasing alone is precisely the tier this
# project's own rules call unautomatable, and Haiku failed it in BOTH directions -
# it invented four findings on a clean reply, and when the bar was raised to stop
# that it went silent on a planted metaphor and on three pieces of jargon. Sonnet
# is the cheapest model that held both ends. Re-measure with
# scripts/writing-check/run-cases.py before changing this line.
MODEL = os.environ.get("CONVERSANT_WRITING_CHECK_MODEL", "claude-sonnet-5-5")
TIMEOUT_S = 25
MAX_FINDINGS = 5

STATE = Path(tempfile.gettempdir()) / "conversant-writing-check-state.json"


def quiet_exit():
    """Say nothing, change nothing, let the reply through."""
    sys.exit(0)


def read_text(path):
    # ⚠ utf-8 EXPLICITLY. Both rule files carry curly quotes and arrows, and on
    # Windows the default encoding is cp1252, which throws on them - so leaving
    # this off makes the check die on the very files it is built from.
    return path.read_text(encoding="utf-8")


def load_api_key():
    """Environment first, then the gitignored key file - the same order and the
    same file the live test tier uses (tests/env.mjs). Never printed anywhere."""
    env = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if env:
        return env
    try:
        return read_text(ROOT / ".anthropic-key").strip() or None
    except OSError:
        return None


def already_blocked(prompt_id):
    """True when this same reply has been sent back once already."""
    if not prompt_id:
        return False
    try:
        return json.loads(read_text(STATE)).get("last_blocked") == prompt_id
    except (OSError, ValueError):
        return False


def remember_block(prompt_id):
    try:
        STATE.write_text(json.dumps({"last_blocked": prompt_id}), encoding="utf-8")
    except OSError:
        pass  # Losing the note costs one extra check, never a loop: stop_hook_active still holds.


def build_prompt(reply, rules):
    return f"""You are checking one chat reply written by Claude to Ken Hackbarth, who
runs the Conversant AAC project. Ken is a systems engineer of three decades and is
NOT a programmer. Your job is to catch writing he would skip over or have to re-read.

Report ONLY these, and nothing else. Look for 1 FIRST, on its own pass through the
reply, and always report every one you find even when you also find others - it is
the fault this check exists for, it is the easiest to read straight past, and a
measured run of this check reported three of item 3 and missed an item 1 sitting
between them.

1. A METAPHOR OR UNUSUAL CONSTRUCTION where an ordinary phrase exists. The hardest
   to see, because every word in it is correct and the sentence parses perfectly.
   "No table surgery" instead of "I added no rows" is the example that prompted this
   check. So is "walking the object", "the seam", "load-bearing", "paying for
   itself", "wearing one coat", "earns its keep".
2. PROGRAMMING JARGON, or a bare file or function name used as though he knows it.
   Fine: systems, trade-offs, architecture. Not fine: object, instance, array,
   parse, callback, hook, refactor, regex, DOM, or a filename standing in for a thing.
3. BRITISH CONSTRUCTION - correct American words in an order no American would use.
   shall I, lovely, suits you, come to us, at yours, have a look, straight away,
   in future, sort out, different to, whilst, amongst, quite meaning fairly.
4. A SENTENCE OVER 40 WORDS, or a paragraph whose point is buried past its first
   two sentences.
5. WRITING THAT ARGUES, ADMIRES ITSELF, RATES ITS OWN MATERIAL, OR BORROWS DRAMA.

⚠ HOW TO DECIDE, AND THE TWO HALVES PULL IN OPPOSITE DIRECTIONS ON PURPOSE - both
of these happened in measured runs of this check and each is a real failure:

  HALF ONE - the five classes above are NOT judgment calls. If the words plainly
  fit class 1, 2, 3 or 4, report them. Do not weigh whether they are bad enough,
  do not decide the reply reads well overall, and do not skip a metaphor because
  you already found something else. A run that answered CLEAN on a reply
  containing "no table surgery" and three British phrases was WRONG.

  HALF TWO - anything that does NOT plainly fit one of the five classes is CLEAN,
  however you would have phrased it. A run that reported "part-way set up" and
  "comes out" as faults was WRONG: neither is a metaphor, jargon, British, long,
  or self-admiring. It is ordinary American English, and a check that fires on
  good writing is one Ken learns to ignore, which is worse than no check.

So: match against the five classes, report every match, invent no sixth class.

NEVER report any of these:
- A phrase that does not appear VERBATIM in the reply. Quote only what is there.
- Contractions, "I've", "I'll", "you're". They are house style and wanted.
- A word that is ordinary American English but you would have chosen differently
  ("part-way", "comes out", "worth doing"). Different is not wrong.
- Active, plain sentences you would merely re-order.
- American spelling, formatting, bold, headings, the length of the reply itself,
  or technical detail that is genuinely needed to answer the question.
- A term the project itself uses as a proper name for one of its own things.
- ⚠ THE VERSION-CONTROL AND WORKFLOW WORDS KEN USES HIMSELF. He wrote the trigger
  phrase "bump Conversant" and asks for changes to be committed and pushed, so
  commit, push, bump, repository, branch, hook, settings, release, deploy, the
  bench, a scratch file and the app's own feature names are shared vocabulary in
  this project, NOT jargon. A measured run flagged all of the first four, which
  would send a reply back for words Ken had used in the message he was answering.
- A sentence whose subject is an absence. "Nothing can confirm the fix" is plain
  English, not a fault.
- "somebody", "someone", "worth doing", "needs your word", "I need your decision".
  Ordinary American idiom. An idiom is only class 3 if it appears in the list there.
- Anything you would describe as "an unusual idiom", "unusual phrasing" or "reads
  oddly" without it fitting class 1, 2, 3, 4 or 5. That reasoning is how a sixth
  class gets invented, and inventing one is the failure described above.

The test for a class-1 finding is Ken's own: would somebody say this out loud, to
another person, in these words? A metaphor fails it; ordinary plain wording passes.

The project's own catalog of these faults follows, for reference:

<rules>
{rules}
</rules>

The reply to check:

<reply>
{reply}
</reply>

Answer with the single word CLEAN if nothing above applies. Otherwise list at most
{MAX_FINDINGS} findings, worst first, one per line, each as:
  - "<the exact words>" -> <the plain version, or what is wrong>
Nothing else: no preamble, no summary, no praise."""


def ask_haiku(key, prompt):
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 1200,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
        answer = json.loads(r.read().decode("utf-8"))
    # ⚠ FIRST TEXT BLOCK, not the first block - the same trap recorded for the app's
    # own reader. A thinking model puts its reasoning first.
    for block in answer.get("content", []):
        if block.get("type") == "text":
            return block.get("text", "").strip()
    return ""


def main():
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        quiet_exit()

    if payload.get("stop_hook_active"):
        quiet_exit()

    reply = (payload.get("last_assistant_message") or "").strip()
    if len(reply.split()) < MIN_WORDS:
        quiet_exit()

    prompt_id = payload.get("prompt_id")
    if already_blocked(prompt_id):
        quiet_exit()

    key = load_api_key()
    if not key:
        quiet_exit()

    try:
        rules = read_text(ROOT / "WRITING-BUGS.md")
    except OSError:
        quiet_exit()

    try:
        verdict = ask_haiku(key, build_prompt(reply, rules))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, ValueError):
        quiet_exit()

    if not verdict or verdict.upper().startswith("CLEAN"):
        quiet_exit()

    remember_block(prompt_id)
    # ensure_ascii keeps this valid JSON on a Windows console whatever the findings
    # quote back, and matches the standing rule that anything logged stays ASCII.
    print(json.dumps({
        "decision": "block",
        "reason": (
            "PLAIN-SPEAK CHECK - rewrite the reply to clear these, then finish. "
            "Do not explain the findings to Ken, do not apologize, and do not "
            "mention that this check ran; just send the better reply. If a finding "
            "is wrong, say so in one short sentence and keep your wording.\n\n"
            + verdict
        ),
    }, ensure_ascii=True))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException:
        # The last net. Nothing this script can hit is worth breaking a reply over.
        sys.exit(0)
