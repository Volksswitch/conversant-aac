# Manual-test seed fixtures

A known-good baseline for the on-device manual tests, so every run starts from the
**same app state** instead of whatever was there last time. All data is synthetic —
a fictional user "Alex Rivera" and made-up contacts (Jordan/"Mom", Sam, Dr. Lee) —
no real personal data.

| File | Seeds |
|------|-------|
| `worldview.json` | About Me: a few shareable facts, one **Private** field (`living_situation`), one **declined** field (`age_birthyear`) — exercises all three privacy levels. |
| `relationships.json` | People: Jordan ("Mom", lives with me), Sam (friend), Dr. Lee (**private**). |
| `express-panel.json` | Express Panel: feelings, two Partner buttons (Jordan/Sam), a few phrases. |
| `control-phrases.json` | Default openers / wind-downs / closings **plus one distinctive opener** ("TEST FIXTURE opener…") so you can confirm the seed loaded by opening **Start conversation**. |

## A whole demo user — `demo-marc-delgado.json`

A different kind of thing from the four files above, and it is not part of the manual-test
reset. It is a complete **importable backup** for one fully lived-in user (Marc Delgado,
the test persona), restored through **Settings → Backup & transfer → Import**: About Me,
people with per-person profiles, My Places, the Express Panel as somebody rearranged it,
reworded phrases, the voice profile, and three weeks of conversations.

**About Me is answered in full** — 73 of the 74 questions, plus one declined, which is
Marc's own answer on the persona sheet and the only thing in the file exercising the
"prefer not to say" state. A fully answered profile therefore has an empty gaps log by
construction; the two still-open **extra** questions are what keeps "Questions worth
answering" from being blank, and they are the half of that feature a full profile cannot
make stale.

Regenerate it with `node scripts/make-demo-import.mjs`. It is built from
`scripts/doc-generators/persona-data.js` plus `scripts/demo-persona-extras.mjs` and
`scripts/demo-conversations.mjs` — never edited by hand, because seven different data
models each normalize what they are handed and a hand-edited field can go missing
silently.

It carries **no settings**, so importing it changes content only. Importing it *does*
overwrite all of that content, so take a backup first.

## Use

Copy these four files into your test **data folder** (replacing any there) before a
manual run, then open the app and grant that folder. See the **Repeatable setup**
section of `../MANUAL-TEST-PLAN.md` for the full reset procedure.

Don't point the app at *this* `tests/fixtures/` folder directly — copy the files
into a scratch data folder so the app's writes don't modify the committed fixtures.
