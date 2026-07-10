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
| `control-phrases.json` | Default openers/closers **plus one distinctive opener** ("TEST FIXTURE opener…") so you can confirm the seed loaded by opening **Start conversation**. |

## Use

Copy these four files into your test **data folder** (replacing any there) before a
manual run, then open the app and grant that folder. See the **Repeatable setup**
section of `../MANUAL-TEST-PLAN.md` for the full reset procedure.

Don't point the app at *this* `tests/fixtures/` folder directly — copy the files
into a scratch data folder so the app's writes don't modify the committed fixtures.
