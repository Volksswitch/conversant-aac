# Conversant AAC — Manual Test Plan (on-device)

These are the checks the automated suite **cannot** do, because they depend on
real hardware and browser behavior: the microphone, spoken audio and its timing,
the acoustic echo loop, touch, the on-screen keyguard fit, the File System Access
folder, the service-worker auto-update, and the live AI. Run them on the **target
tablet** (Windows, Edge or Chrome), not on the dev PC.

**What the automated tests already cover (don't re-do by hand):** the Conversation
Engine's decision logic, the response parsing, the placeholder sequencing rules, the
privacy/withholding logic, word prediction, keyboard-layout geometry, and the
user-started "lead" fix — including a live-API check. Run those with `npm test`
before you start here; this document is only the on-device remainder.

**Terminology (Ken, July 2026).** In this plan **the transcript** means the saved
JSON file (`conversations/<id>.json`) in your data folder; **the conversation pane**
means the on-screen scrolling conversation log. The transcript is designed to
**mirror the conversation pane at all times** (§8), so it's a reliable record of any
misbehavior.

## Before you start

- [ ] Note the version shown at **Settings → About** (report it with every issue).
- [ ] Fresh browser profile, or clear site data, if testing first-run behavior.
- [ ] Enter your Claude API key in **Settings → General**.
- [ ] Choose a **data folder** (Settings → General → Choose Folder). For the
      cloud-sync test, use a OneDrive-synced folder; otherwise a local folder.
- [ ] A second person to act as the communication partner (or play partner audio
      through a speaker near the mic).

For each case: do the **Steps**, confirm the **Expect**, tick the box. If it fails,
record the version, what you did, and what happened (and grab the transcript
`conversations/<id>.json` from the data folder + **Settings → About → error log** if relevant).

---

## Repeatable setup (do this before a run)

Manual tests drift when the starting state drifts. Control the **inputs and starting
state** and every run begins identically; assert on **behavior/structure**, never on
the exact wording (live speech recognition and the AI are non-deterministic by
nature — that variance is expected, not a bug).

**A. Reset to a known baseline.**
1. Pick ONE device + orientation + browser + Windows display scaling, and keep it
   fixed across runs. (The app logs its viewport metrics to the console at startup —
   capture them once so you can confirm you're on the same box.)
2. Clear the app's site data (Edge/Chrome: Site settings → Clear data) so localStorage
   settings, the cached service-worker version, and the last-seen version reset.
3. Create a **scratch data folder** (e.g. `Conversant Test Data`) and copy the four
   files from `tests/fixtures/` into it — replacing any that are there. Do NOT point
   the app at `tests/fixtures/` itself (its writes would modify the committed seed).
4. Launch the app, enter your API key, and **Choose Folder** → the scratch folder.
5. Confirm the seed loaded: **Start conversation** should list the distinctive
   *"TEST FIXTURE opener — one two three"* card, and **About Me → People** should show
   Jordan/Sam/Dr. Lee.
6. Set a known Settings profile (record it once and re-apply): voice, silence period,
   dock + layout, button/gap sliders, tap mode. Note them so a later run matches.

Now About Me, People, the Express Panel, and the openers/closers are identical every
run, so §2/§4/§6/§8 aren't at the mercy of leftover data.

**B. Fixed partner script.** Use these EXACT partner utterances so the STT input is
as consistent as a human can make it. For the strongest repeatability, record them
once as audio clips and play them through a speaker near the mic — that removes the
human phrasing variance entirely (the remaining variance is just the cloud
recognizer, which you can't control and shouldn't try to).

| Ref | Partner says |
|-----|--------------|
| P1  | "How was your weekend?" |
| P2  | "Yeah, sure — any time." *(short go-ahead, for §2.1)* |
| P3  | "Sure." *(one-word go-ahead, for §2.2)* |
| P4  | "What?" *(repair-of-self, §4.1)* |
| P5  | "So the other day I was walking down the street and…" *(trails off — mid-sentence, should NOT produce options)* |
| P6  | "Anyway, I should get going." *(closing)* |

Re-flash the data folder from `tests/fixtures/` between runs to return to baseline.

---

## 1. Microphone capture & the core loop (partner-started)

- [ ] **1.1 Listen + transcribe.** Tap **Start Listening**; the partner says "How
  was your weekend?" **Expect:** the words appear in the conversation pane within
  ~1–2 s of them finishing; the Listen button shows its active/latched state while capturing.
- [ ] **1.2 Options appear.** After the partner pauses (~2 s, the silence period),
  **Expect:** four response cards appear (or eight, if "Suggestions per category" = 2),
  color-coded by category.
- [ ] **1.3 Placeholder covers the wait.** If you don't pick immediately,
  **Expect:** you hear a spoken placeholder ("Good question." then, if you keep
  waiting, "Still thinking it through."), at most the configured **Maximum
  placeholders per turn**, and each is shown on the ♪ now-playing line as it plays.
- [ ] **1.4 Speak a response.** Tap a card. **Expect:** the app speaks the full
  text in the selected voice; the spoken line then appears in the conversation pane
  as your turn (not before it's spoken).
- [ ] **1.5 Auto-resume.** With auto-resume on, **Expect:** listening restarts on
  its own after your turn is spoken, ready for the partner's next turn.

## 2. User-started conversation (the July 2026 bug — verify on device)

- [ ] **2.1 Opener → lead.** Tap **Start conversation**, pick an opener (e.g. "Hi
  {name}, got a minute?"). It speaks. The partner replies with a **short go-ahead**:
  "Yeah, sure — any time." **Expect:** within a couple seconds you get a placeholder
  AND a set of lead response cards (things *you* say next), NOT silence.
- [ ] **2.2 One-word go-ahead.** Repeat with the partner saying just "Sure."
  **Expect:** same — lead options appear.
- [ ] **2.3 No red wash.** **Expect:** the conversation pane does not turn faint red
  (no error logged) during 2.1–2.2.

## 3. The echo feedback loop (mic hears the app's own speech)

- [ ] **3.1 Placeholder isn't re-captured.** During a long choosing window where a
  placeholder plays aloud, **Expect:** the placeholder text does NOT appear as
  partner speech in the conversation pane, the options do not flicker/regenerate, and
  no runaway loop occurs.
- [ ] **3.2 Partner over the placeholder.** Have the partner start talking while a
  placeholder is playing. **Expect:** the partner's real words are still captured
  (the mic isn't muted), and generation picks them up on the next pause.

## 4. Repair paths

- [ ] **4.1 Partner didn't understand you.** After you speak a turn, the partner
  says "What?" **Expect:** three repair cards appear — **re-speak** (your exact last
  words), **rephrase**, **expand** — all showing real, speakable text (not just a
  hint), and each speaks when tapped.
- [ ] **4.2 You didn't catch the partner.** Tap **Ask them to repeat** (Pardon?).
  **Expect:** it speaks a "could you say that again?" line, discards the last
  captured statement, and keeps listening; the partner's re-say produces fresh
  options without stacking duplicates.
- [ ] **4.3 Say again.** Tap **Repeat what I said**. **Expect:** your last utterance
  is re-spoken and re-appears in the conversation pane.

## 5. Wind down / closings

- [ ] **5.1 Wind down → closings.** Tap **Wind down**. **Expect:** *wind-down* statements
  appear ("I should get going.", "Great catching up with you." — NOT goodbyes). Pick one —
  it speaks, then the *closings* (goodbyes: "Bye!", "Take care!") appear automatically. Pick
  a goodbye — it speaks and the goodbyes are re-offered so you can say a final one.
- [ ] **5.2 Re-press Wind down (partner didn't reciprocate).** With goodbyes showing, tap
  **Wind down** again. **Expect:** wind-down statements return — and, if you have more than
  fit on screen, a *different* set than the first press (each re-press dips to the next).
- [ ] **5.3 "New N" pages the static sets.** With wind-downs (or goodbyes, or conversation
  starters) showing, tap the **New** button. **Expect:** the next set of that category's
  cards, wrapping around — no AI call, no waiting.
- [ ] **5.4 End conversation.** Tap **End conversation**. **Expect:** the conversation
  pane and cards clear, listening stops, and the active Partner/Feeling toggles clear. A
  new conversation's first **Wind down** press shows page 0 again.

## 6. Express Panel

- [ ] **6.1 Speak a phrase.** Tap a phrase (e.g. "Thank you"). **Expect:** it speaks
  and is recorded as your turn in the conversation pane (and the transcript). Confirm
  your **single-tap vs. double-tap** setting behaves as chosen (and the double-tap interval).
- [ ] **6.2 Partner toggle.** Tap a Partner (e.g. "Tyler"). **Expect:** it shows a
  selected ring; openers personalize with that name; generated responses reflect
  talking to them. Tapping again clears it.
- [ ] **6.3 Feeling toggle.** Tap a Feeling (e.g. "Tired"). **Expect:** selected
  ring; the tone of suggestions shifts accordingly.
- [ ] **6.4 Editing.** Settings → Express Panel: add/reorder/delete items, change a
  phrase's color, pick a Partner from People. **Expect:** the panel reflects edits;
  order maps to panel position.

## 7. "In my own words" composer + on-screen keyboard

- [ ] **7.1 Open composer.** With "Keyboard for typing" = On-screen, tap **In my own
  words**. **Expect:** the input box overlays the response area and the keyboard
  appears in the dock; the base screen isn't blurred.
- [ ] **7.2 Speak.** Type a sentence, tap **Speak**. **Expect:** it speaks in your
  voice, commits as your turn, and both the box and keyboard dismiss.
- [ ] **7.3 Reframe (partner on floor).** With a partner turn active, type a steer
  and tap **Reframe**. **Expect:** the response cards regenerate around your steer.
- [ ] **7.4 Reframe (you lead).** With no partner turn, type a direction and
  **Reframe**. **Expect:** it offers **statements** that steer the conversation.
- [ ] **7.5 Cancel.** **Expect:** discards and dismisses both box and keyboard.
- [ ] **7.6 Keyboard behavior.** Try Shift (one-shot + double-tap caps lock), the
  123/ABC symbols page, and Cut/Copy/Paste (paste your API key into the Settings
  field). **Expect:** symbols page keeps the same key positions as the letters page
  (keyguard congruent); first letter of a field auto-capitalizes (except the API key).
- [ ] **7.7 Word prediction ghost.** As you type, **Expect:** a bold, tinted
  completion appears inline after your text; tapping anywhere in the field accepts
  it; typing a space/comma/period inserts literally (does NOT accept). Check the ghost
  color is legible on the device.
- [ ] **7.8 Keyboard docking.** Switch dock to Side (Left/Right) and Bottom, and try
  a few layouts. **Expect:** the Express Panel and the keyboard occupy the same dock
  footprint (one keyguard fits both); the conversation pane / composer stay visible.

## 8. The transcript mirrors the conversation pane (needs a granted folder)

The transcript (`conversations/<id>.json`) must match the conversation pane at all
times. Watch the file update live — re-open it after each step, or use an editor that
reloads on change. (The order of `exchanges` entries is what to check, not the exact
wording — recognition and AI cleanup are non-deterministic.)

- [ ] **8.1 File created on Listen / Start.** Tap **Start Listening** (or **Start
  conversation**) with nobody speaking yet. **Expect:** a new `conversations/<id>.json`
  appears **immediately**, with an empty `exchanges` list — before any turn.
- [ ] **8.2 Partner pause writes the raw line at once.** Partner says P1 and pauses.
  **Expect:** during that pause a `partner` entry is written with `rawTranscript` = what
  was heard and `cleanedTranscript` **empty**.
- [ ] **8.3 Continuation overwrites, doesn't duplicate.** Partner keeps talking after
  the pause (P1 then more). **Expect:** the **same** `partner` entry's `rawTranscript` is
  overwritten with the fuller text and `cleanedTranscript` stays empty — NOT a second
  partner entry.
- [ ] **8.4 Your response is written immediately; the partner turn is cleaned in
  place.** Pick a response. **Expect:** your `user` turn appears in the file **right
  away** (not seconds later); a moment after, the partner entry's `cleanedTranscript`
  fills in (tidied text), and the order stays **partner-then-user**.
- [ ] **8.5 Opener / interruption / End-with-partner-mid-turn are all recorded.** An
  opener writes your turn; interrupting the partner (instant Express phrase) writes
  their partial raw text **then** your turn; ending while the partner is mid-turn still
  writes their pending turn. **Expect:** no turn is silently dropped, order preserved.
- [ ] **8.6 Consecutive conversations don't merge.** End one, start another.
  **Expect:** a NEW `<id>.json` for the second — not appended to the first.
- [ ] **8.7 About Me persists.** Answer some About Me questions; confirm
  `worldview.json` updates. Copy it to a second machine's folder and open the app
  there. **Expect:** the copied answers show up (file-in-folder wins).
- [ ] **8.8 People / Express / Controls persist.** Add a person, edit an Express
  item and a control phrase; confirm `relationships.json`, `express-panel.json`,
  `control-phrases.json` update.
- [ ] **8.9 Error log.** Force an error (e.g. wrong API key, then converse). **Expect:**
  `errors.log` in the folder gets an entry stamped with the version + conversation id,
  it also shows in Settings → About → error log, and (for a saved conversation) the
  error is interleaved into the transcript in time order.

## 9. Graceful degradation (AI / network down)

- [ ] **9.1 Bad key.** Set an invalid API key and have the partner speak. **Expect:**
  the partner's raw words stay visible (blue/italic "uncleaned"), the conversation
  pane shows the faint-red wash, and you can still reply via the Express Panel / "In my
  own words" (which commit and save).
- [ ] **9.2 No internet.** Disable the network and tap Start Listening. **Expect:**
  a microphone/network error is surfaced (STT is cloud-based), the red wash trips,
  and the app doesn't lock up.

## 10. Auto-update + "What's new"

- [ ] **10.1 Update on relaunch.** Deploy a new version. Relaunch (or press Start on
  the open app). **Expect:** it reloads to the new version without a manual hard
  refresh; Settings → About shows the new number.
- [ ] **10.2 What's new.** **Expect:** after the update, a "What's new" card appears
  in the conversation-pane region above Start, listing the changes since the version
  you last saw; "Close" dismisses it and doesn't reappear next launch.
- [ ] **10.3 Reload the app.** Settings → About → **Reload the app**. **Expect:**
  clears caches and reloads fresh (a keyboard-free hard refresh).

## 11. Privacy, settings & sizing

- [ ] **11.1 Don't save this conversation.** Toggle the privacy control on; hold a
  conversation. **Expect:** NO `conversations/*.json` file is written for it, and its
  content is withheld from the error log / bug report.
- [ ] **11.2 Text sizes.** Settings → Text Size: change the Response / Transcript /
  Composer / Express sizes. **Expect:** each surface resizes independently.
- [ ] **11.3 Button size & gaps.** Settings → Speech & Input: move the Button size,
  Button spacing, and Minimum gap sliders. **Expect:** the dock grows/shrinks
  accordingly, the conversation pane yields, and the keyguard footprint stays coherent.
  (Confirm on both side and bottom docks.)
- [ ] **11.4 Keyguard separations.** Settings → **Keyguard Design**: move **Keyboard
  separation** (gap between the dock and the rest of the screen) and **Transcript
  separation** (shortens the conversation pane to open a gap above the command bar).
  **Expect:** each gap opens as described and the button / dock hole positions do NOT
  move. (Confirm on both side and bottom docks.)
- [ ] **11.5 Voice.** Pick a different TTS voice and confirm it's used and persists.

## 12. Keyguard alignment (visual)

- [ ] **12.1** With a chosen dock + layout, verify the Express Panel cells, the
  keyboard keys, and the Settings/About Me dock region line up to the **same grid**
  (hold a printed keyguard, or eyeball the columns). Nothing on the base screen
  should move between LISTENING / RESPONDING / repair / closing states.

---

## Known / not-yet-built (don't file as bugs)

- **Single-instance guard** (two tabs/windows) — designed, not built; opening two
  instances will cross-feed mics.
- **Settings portability across devices** — settings are per-machine (localStorage)
  until the data-folder settings work lands.
- **Non-English languages**, **situational awareness (GPS/calendar/face)**,
  **conversation review**, and **voice banking** — future phases.

## Reporting

For any failure, include: **version** (Settings → About), the **steps**, **what you
expected vs. saw**, and — if a conversation was involved — the **transcript**
(`conversations/<id>.json`) and the **error log** text. The version number is the
single most useful field.
