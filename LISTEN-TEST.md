# Listen-mode test script

A scripted run for the Listen button, the transcript, and where partner speech is
kept or discarded. **Say the lines exactly as written** — they are chosen so that the
trace and the saved conversation files can be read without guessing which part of the
test a fragment came from. Counted words make a truncation obvious at a glance;
distinct vocabulary per test says which test it belongs to.

You do not need to describe what you saw. The app writes it down.

> **⚠ OUT OF DATE as written (August 5 2026). The diagnostic trace was removed from the
> app** — there is no Settings → About → "Record what the app does" any more, so every
> instruction below that mentions the trace (step 1 of *Before you start*, and *When you
> are done*) has nothing to switch on and no `diagnostic-*.log` to send. **What still
> works: the five test sequences themselves and the `conversations/*.json` files**, which
> are written normally and were enough on their own to show Test 3's loss (the saved entry
> kept the first checkpoint's timestamp while carrying the second checkpoint's text).
> Rewrite this script when the Troubleshooting tab is built — see CLAUDE.md. The trace is
> recoverable at `git show 4bab171:app/js/trace.js`.

---

## Before you start

1. **Settings → About → Diagnostic trace →** tick **"Record what the app does"**.
2. **Settings → General →** confirm a **data folder** is chosen (the trace is written there).
3. Note these, but do not change them — the trace records them and I need to know
   which configuration produced the run:
   - **Settings → Speech →** "Hearing the other person": browser or Deepgram
   - **Settings → Conversation →** "Resume listening automatically": on or off
   - **Settings → Conversation →** "Silence period" (default 2.0 seconds)
4. Press **Start**.

**Run all five tests in one sitting, without reloading the app.** The trace covers the
whole session, so one save at the end captures everything.

Where a test says *pause*, count silently to three — comfortably longer than the
silence period, so the app is certain the turn has settled.

---

## Test 1 — Does the button track its own state?

No speaking at all. This is the baseline: it should be four clean transitions.

| Step | Do this | Watch |
|---|---|---|
| 1 | Tap **Listen** | it should turn red and stay red |
| 2 | Wait 5 seconds, saying nothing | it should still be red |
| 3 | Tap **Listen** | it should go dark |
| 4 | Tap **Listen** again | it should turn red again |
| 5 | Tap **Listen** once more | it should go dark |

*Answers: whether the button ever changes state on its own, and whether every tap is
acted on.*

---

## Test 2 — One ordinary exchange

| Step | Do this |
|---|---|
| 1 | Tap **Listen** |
| 2 | Say: **"Good morning. How are you doing today?"** |
| 3 | *Pause* until response cards appear |
| 4 | Tap the **first response card** |
| 5 | Tap **End conversation** |

*Answers: whether the normal path records the partner turn and the chosen response,
in that order.*

---

## Test 3 — Stop and restart in the middle of a turn ← the important one

This is the sequence that lost your counting on the iPad.

| Step | Do this |
|---|---|
| 1 | Tap **Listen** |
| 2 | Say: **"One two three four five."** |
| 3 | *Pause* |
| 4 | Tap **Listen** (to stop) |
| 5 | Tap **Listen** again (to start) |
| 6 | Say: **"Six seven eight nine ten."** |
| 7 | *Pause* |
| 8 | Tap **End conversation** |

*Answers: whether "one two three four five" survives the stop-and-start, or is
discarded. Note in passing whether the on-screen conversation still shows it after
step 4 and after step 5 — but do not worry about remembering; the trace records both.*

> **Run August 5 2026: it was discarded, and that has since been fixed** (stop/start
> mid-turn is now a pause — see CLAUDE.md). **From that release on, this test is a
> regression check and its expected result is Test 4's:** one partner turn reading
> "one two three four five six seven eight nine ten". Check it in this conversation's
> `conversations/*.json` — a single partner exchange holding all ten numbers. Seeing only
> "six seven eight nine ten" means the fix has regressed. (This is also pinned by
> `tests/stt.test.mjs`, "LISTEN-TEST Test 3 == Test 4", which fails without a device.)

---

## Test 4 — A pause in the middle of one long turn

Same words as Test 3 in structure, different vocabulary so the two cannot be confused.

| Step | Do this |
|---|---|
| 1 | Tap **Listen** |
| 2 | Say: **"Apple banana cherry."** |
| 3 | *Pause* (do **not** touch the Listen button) |
| 4 | Say: **"Damson elderberry fig."** |
| 5 | *Pause* |
| 6 | Tap **End conversation** |

*Answers: whether an uninterrupted turn keeps both halves — the control for Test 3.
If Test 4 keeps all six words and Test 3 keeps only five, the stop-and-start is the
cause and nothing else is.*

---

## Test 5 — Ending with the partner's words unanswered

| Step | Do this |
|---|---|
| 1 | Tap **Listen** |
| 2 | Say: **"Alpha bravo charlie."** |
| 3 | *Pause* until response cards appear |
| 4 | Do **not** pick a card. Tap **End conversation**. |

*Answers: whether a partner turn you never replied to is still written down.*

---

## When you are done

1. **Settings → About → Diagnostic trace → "Save trace to my data folder"**.
   It will confirm the filename.
2. Send me:
   - `diagnostic-<something>.log` from your data folder
   - every `conversations/*.json` file created during the run (there should be four —
     Tests 2, 3, 4 and 5)
3. Untick **"Record what the app does"** when you have finished testing.

If something behaves oddly at a step, carry on to the end anyway — the trace is more
useful complete than stopped at the interesting moment, and I would rather read what
happened next than have you decide it was not worth capturing.
