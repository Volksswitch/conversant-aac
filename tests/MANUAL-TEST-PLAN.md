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

## 13. About Me — the worldview profile and the voice layer

The automated suite already covers the mechanics here: field states, decline/undo,
the privacy levels, trait aggregation, the per-partner profile, and every block's
prompt text. **Do not re-do those by hand.** What is left is the part a stub cannot
answer — *does a filled profile actually make the suggestions sound like this
person?* — plus how the filling-in feels on the tablet.

### 13.0 Filling in the data (read this first — it saves the most time)

**Use a persona rather than inventing answers.** Ten are in `Other/Personas/`.
Inventing as you go produces a bland profile, and a bland profile is exactly the
condition under which the feature looks like it does nothing. **Marc Delgado** is
the one the demo script uses.

Each persona now ends with a section called **App-Ready Answers (Tier B)** — two
tables giving the exact field key and the exact answer to tap for all 20
personality and values questions. Work from those tables, not the prose above them;
the prose is the human-readable version and does not map one-to-one onto the
options on screen.

**Order to enter it in.** Roughly 20 minutes for a full persona.

1. **Settings → General → Choose Folder** *first.* Everything below is written to
   that folder as you go, and answers entered with no folder live only in this
   browser.
2. **About Me → Topics** — work down the list. A1/A2/A4 come straight from the
   persona's Tier A tables; C1/C2 from Tier C.
3. **A5 Contact & Logistics** — enter at least the phone number. It is marked
   private by default, and 13.4 checks that private behaves differently from
   declined.
4. **Decline one question deliberately** (any field → *Prefer not to say*). Note
   which one; 13.4 needs it.
5. **What I'm Like** and **What Matters to Me** — 10 questions each, straight from
   the App-Ready tables.
6. **People** — add two or three, and give at least one a filled-in
   **"How I talk with them"** (it is collapsed; tap the summary line to open it).
7. **My Places** — add one with two or three facts.
8. **How I Sound** — answer at least six items. There are 17.

**Things that will look wrong and are not.**

- **"Somewhat like me" is the app's way of saying *no strong feeling*, and it
  contributes nothing to the suggestions.** That is deliberate — it is what keeps a
  half-answered profile from pulling the wording around. If a persona's App-Ready
  table says "Somewhat like me", tapping it and skipping the question have the same
  effect on output. It still counts as answered on the progress bar.
- **B2 and B3 are missing from the topic list, and that is correct.** The Tier B
  numbering comes from the question bank and the personas: B2 (humor) and B7
  (emotional landscape) are not built, B5 (beliefs) is deferred, and B3/B6/B8 moved
  elsewhere — B3 and B6 into "How I talk with them", B8 into How I Sound and the
  Express Panel.
- **A persona is richer than the app can hold.** Catchphrases ("Let's go!") are
  Express Panel buttons by design and the AI never produces them, so do not expect
  to see them in cards.
- **Nothing in About Me is a topic.** Personality, values, relationship goals and
  places all steer *wording only*. A card that announces "I'm a really sociable
  person" or raises your relationship goal is a **bug** — see 13.5.

### 13.1 Does a filled profile change the output? (the headline test)

- [ ] **13.1 Empty vs. filled, same partner turn.** Before entering anything, run
  three or four exchanges (Practice Mode → *Catching up with a friend* is fine) and
  screenshot the cards. Now fill the persona in and run the **same scenario** again.
  **Expect:** the second set is recognizably more specific — it reaches for their
  interests, and the wording is shorter or fuller in line with how they answered.
  **This is the whole bet of the voice layer.** If you cannot tell the two runs
  apart, say so plainly; that is the most important result this plan can produce,
  and it is worth more than every other box in this section.

- [ ] **13.2 Does it sound like *them*?** With the profile loaded, hold a few
  exchanges and read the cards as if you were the persona. **Expect:** you would be
  willing to say most of them. Note any card that is clearly someone else talking —
  wrong register, wrong level of detail, wrong enthusiasm.

### 13.3 Per-partner register

- [ ] **13.3 Same words, different person.** Give one person a **relaxed / playful**
  register and another **careful / serious**. Tap the first in the Express Panel and
  run a scenario; tap the second and run the same one. **Expect:** the cards move
  audibly between the two. **If they do not, that is a real finding** — the register
  is reaching the model (verified), so a non-effect means the model is ignoring it
  and the wording of the block needs strengthening.
- [ ] **13.3b Their own openers.** Give a person one distinctive conversation
  starter. Tap them, then **Start conversation**. **Expect:** their starter is on the
  first page, your usual ones after it. Untap them and check it withdraws.
  *Pick a starter that could not be one of the defaults — the defaults substitute the
  person's name, so "Hi <name>, got a minute?" will look like it worked either way.*

### 13.4 Privacy on the device

- [ ] **13.4a Private ≠ declined.** Have the partner **ask for the phone number**
  from 13.0 step 3. **Expect:** a card offers it. Then have them ask about the
  question you **declined**. **Expect:** the app phrases around it and never states
  or guesses the value.
- [ ] **13.4b Private is not volunteered.** Across a normal conversation, the phone
  number should never appear in a card unless the partner asked or you steered to it
  with **Reframe**.
- [ ] **13.4c Private person.** Mark a person private. **Expect:** they are never
  named on the app's own initiative.

### 13.5 The guards (report any breach immediately)

- [ ] **13.5 Nothing from About Me becomes a topic.** Over a dozen or so exchanges,
  watch for a card that: describes the user's own character; states a personality or
  values answer back; raises a **standing relationship goal** (a card *about* repairing
  the relationship rather than one worded warmly); or treats a place's recorded facts
  as a subject ("what did you find here last Saturday?" while standing in the shop).
  **Expect:** none of these. Each is guarded in the prompt, and a breach means the
  guard is not holding — worth a bug report with the conversation file attached.

### 13.6 How it feels to use (judgment, not pass/fail)

- [ ] **13.6a Is Tier B too tiring?** 20 questions of five options each. Note where
  you would have given up, and whether the two modules should be shorter.
- [ ] **13.6b Is "How I talk with them" discoverable?** It is collapsed by default
  inside the person form. Would a supporter find it without being told?
- [ ] **13.6c Caricature check.** The app turns Tier B into a single sentence of up
  to 20 descriptions, which you cannot see from the UI — so judge it from the
  output. Answer most of Tier B **strongly** (avoid the middle), then hold a
  conversation. **Expect:** the cards reflect the person's outlook without becoming a
  parody of it — a persona marked strongly playful should sound cheerful, not
  relentlessly jokey. If it tips into caricature, that is a signal the description is
  carrying too much weight and should be capped.
- [ ] **13.6d Sound Check wording.** Answer several items. **Expect:** the question
  reads naturally and the four candidates feel genuinely different from one another.
  Note any item where you would have picked "They all sound like me" only because
  none of them did.

### 13.7 Persistence

- [ ] **13.7 Survives a restart.** With everything entered, close and relaunch.
  **Expect:** every count is unchanged. Then copy the data folder to another machine,
  point the app at it, and confirm the profile, people, places and How I Sound
  answers all come across.

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
