# Settings help text — removed from the app, destined for the manuals

**Ken, August 1 2026:** *"There's way too much explanatory (hint) text in the Settings panel. Remove all text associated with individual controls. Text describing a settings tab as a whole can stay. Since the app is targeted at direct select (not a mouse gesture) a tool-tip can't be the place for this information. Unless you have a better idea, this information should go in a user document like the user manual."*

A tooltip is genuinely unavailable here — it needs hover, and the target user taps. So there is no in-app home for per-control help that does not cost the panel the space Ken is reclaiming. The text moves to the manuals.

**This file is the source material for that manual pass, and exists so the removal loses nothing.** It is a staging document, not a permanent record: once both User Manuals carry this content, delete it. It is extracted verbatim from `app/index.html` at commit `9977595` (labels corrected by hand where a control shared a group with the one above it).

**Both manuals, same pass** — per the standing rule in `DOC-SYNC.md`, shared behavior must land in the Windows/Chromebook/Mac manual *and* the iPad manual together. Several entries below are platform-split (the Speech tab especially), so watch which half belongs where.

## What stayed in the app

- **Tab-level descriptions** — Practice, Express Panel, Controls. These describe a tab as a whole, which Ken explicitly kept.
- **Live status regions** — storage durability, settings-profile status, backup status, partner-voice status, the error/voice counts, the usage-since date. These are *feedback*, not explanation; they say what just happened or what is currently true, and a manual cannot do their job.
- **Empty-state messages** — e.g. the Express Panel editor's "No items yet". Functional, not explanatory.
- **The startup-error block**, which is outside the Settings dialog entirely.

## Priority for the manual writer

Not all of this is equally worth carrying. Three tiers:

1. **Must survive — the reader cannot deduce it and getting it wrong costs money or data.** Deepgram pricing (both services), what a backup does and does not include, that changing button size or spacing re-cuts the keyguard, the iPad voice limitation, and that the API key is never in a backup.
2. **Worth carrying — explains a non-obvious mechanism.** The shared Express-Panel/keyboard grid, the silence period, placeholder timing, choice buttons, the privacy default.
3. **Safe to compress or drop — the control's own label already says it.** The four Text Size entries, "Which side", "Reset to default".

---

## General tab

**Data folder** `#dataFolderHint` — this element was also rewritten from `app.js` on iPad; both versions below.

> *(Chromium)* Local folder for conversation history and user data. Synced by OneDrive, not uploaded to the cloud.

> *(iPad — written by `app.js`)* This device keeps your data in the app's own private storage. You cannot open it as a folder, so use Backup & transfer below to keep a copy you can see and move.

**Settings profiles**

> Save **all** of your settings (voice, silence period, dock & layout, button/gap sizes, tap mode, text sizes, placeholders) as a named profile, then re-apply it in one tap — handy for a repeatable test baseline or moving your setup to another device. Your API keys and usage counters are **not** included. Profiles are stored with the rest of your data (above), so they travel with a backup.

**Backup & transfer**

> **Export** saves everything — your About Me answers, people, Express Panel, starters, settings and saved conversations — into one file. With a data folder chosen it is written to a **backups** folder inside it; otherwise it is saved through your browser so you can put it somewhere safe. **Restore** puts a backup back, **replacing** what is on this device. Your API key is never included in a backup.

> **Add here from the separate to-do in CLAUDE.md:** what the browser's save prompt says on Export, and that nothing leaves the device.

## Text Size tab

*(Tier 3 — each label already says it. Consider one sentence covering all four.)*

**Response card text size** > Size of the text on the suggested response cards.

**Transcript text size** > Size of the text in the conversation transcript.

**"In my own words" text size** > Size of the text you type in the "In my own words" box.

**Express Panel text size** > Size of the text on the Express Panel buttons.

## Speech tab

**Deepgram key**

> Only needed if you choose Deepgram below — for hearing, for speaking, or for both. **One key covers both.** Sign up at deepgram.com — new accounts include $200 of free credit, which is several hundred hours, and no card is needed to start. Create a key in the console under Settings → API Keys.

**Hearing the other person**

> Your browser can usually do this itself, at no cost. On an iPad it can't — listening does nothing in a Home Screen app, and in Chrome or Edge — so a transcription service is the way to have the app hear the other person there.

**Hearing the other person — cost** `#sttCostHint` *(was shown only when Deepgram is selected)*

> Deepgram transcription costs about 46 cents an hour of speech; the app only sends audio while someone is actually talking, so quiet stretches are free.

**Your speaking voice**

> Your device's own voices cost nothing and work offline. On an iPad they are limited to Samantha and a set of joke voices, so a paid voice is the way to sound like yourself there.

**Your speaking voice — Deepgram cost**

> Costs about 3 cents per 1,000 characters spoken — a few cents an hour of conversation. Phrases the app repeats (placeholders, your Express Panel buttons, starters and goodbyes) are remembered after the first time and cost nothing to say again. If the service cannot be reached, the app falls back to this device's own voice so you are never left unable to speak.

**Practice partner voice**

> In Practice Mode, the AI plays the other person. Give them a different voice from yours so you can tell who's speaking. "Auto" picks a voice that isn't yours. This follows the choice above — the other person speaks through the same service you do.

## Buttons & Keyboard tab

**Button size**

> How big the buttons are, for limited motor control and larger fingers. Use the − and + buttons for a small, precise step, or drag the slider. Bigger buttons grow the keyboard / Express Panel area in the direction it can expand — a side panel widens (and the panel beside it shrinks), a bottom panel grows taller (and the transcript shrinks). Changing this moves the keyguard holes, so re-cut the keyguard to match.

**Button spacing**

> The gap between buttons — the width of the bars on a 3D-printed keyguard. Wider spacing grows the dock area where it can expand rather than shrinking the buttons. Cannot go below the minimum spacing.

**Minimum spacing**

> A hard floor on the gap in every direction. It has priority over button size — buttons stop growing (or shrink) so this minimum is always kept. Raising it also raises the button-spacing value to match.

**Reset buttons and gaps to default**

> Restores button size, spacing, and the minimum spacing to their defaults. Does not change the keyboard or transcript separation (on the Keyguard Design tab).

**Keyboard for typing**

> How you type into the app's text fields ("About Me" and "In your own words"). **On-screen keyboard** shows the app's own keyboard and stops Windows from popping its keyboard. **Physical keyboard** uses the keyboard attached to your tablet. Takes effect on the next field you tap.

**Express Panel & keyboard position**

> Where the Express Panel sits during conversations — and where the on-screen keyboard appears when you type (the composer, "About Me", and Settings). They share this spot so a single keyguard fits both, so this applies **even if you type on a physical keyboard**.

**Which side**

> Which side of the screen the Express Panel and keyboard sit on.

**Express Panel & keyboard layout — bottom**

> The grid used by the bottom Express Panel — and by the on-screen keyboard when you type. They share one grid so a single keyguard fits both, so this shapes your Express Panel **even if you type on a physical keyboard**.

**Express Panel & keyboard layout — side**

> The grid used by the side Express Panel — and by the on-screen keyboard when you type. They share one grid so a single keyguard fits both, so this shapes your Express Panel **even if you type on a physical keyboard**.

## Conversation tab

**Start new conversations private (don't save by default)**

> When on, new conversations start private — nothing from them is saved. This sets the *starting* state; you can still turn saving on or off for the current conversation with the "Don't save" button in the Command Bar. Default is off (conversations are saved).

**Suggestions per category**

> How many suggested responses to offer in each of the four categories (preferred, dispreferred, initiative, repair). Choosing 2 gives eight cards — two stacked in each category — in the same space as four.

**Most choice buttons in the Express Panel**

> When your partner offers a set of choices ("mild, moderate, or severe?"), those choices also appear as green buttons at the start of the Express Panel. Tapping one asks the AI for a full set of responses built around *that* choice — a plainer one, a more hesitant one, one that adds a detail. The response cards already let you answer in one tap; these are for when you want to say more about one of them. The buttons appear only while a choice is on offer and take only as many spaces as there are choices; your phrases shift along to make room and slide back afterwards. This sets the most that can appear at once, so a long list can't push too many phrases off. Set to 0 to turn them off.

**Silence period**

> How long the partner can pause before the speech collected so far is sent for response options. Recording keeps going — if the partner continues, the combined speech is re-sent after the next pause. Recording stops only when you choose a response.

**Resume listening automatically**

> When on, partner recording turns back on by itself after you select a response and it is spoken — no need to tap Start Listening for the next exchange. Default is off.

**Listening chime**

> A short tone plays each time you start listening — an audible cue for the person you're talking with that the device is now listening (they're facing you, not the screen). Default is on.

**Placeholder delays and maximum** *(covered all three placeholder controls)*

> The initial delay is how long after the partner stops speaking before the first placeholder is spoken — the clock starts at the pause, so if the response options are slow to arrive a placeholder still fills the silence (a quick choice plays none). Subsequent delays are the interval between additional placeholders while you choose. The first placeholder acknowledges ("Good question."); later ones say you're still thinking. The maximum caps how many play before the system stays quiet — set it to 0 if you find placeholders artificial, or "No limit" to keep them coming (2 keeps them from sounding repetitive).

**Double-tap interval**

> When double tap is required, how long the first tap stays armed waiting for the second. A longer interval is more forgiving for slower or less precise taps.

## Keyguard Design tab

**Keyboard separation**

> The gap between the keyboard / Express Panel and the rest of the screen. It only shifts the other content away from the keyboard — the keyboard itself stays put, so changing this does not move the keyguard holes. Widening it leaves room for a keyguard bar between the two areas.

**Transcript separation**

> The gap between the transcript and the command bar below it. It makes the transcript shorter to open the gap — the command bar and everything below it stay put, so this does not move the keyguard holes. Widening it leaves room for a keyguard bar between the transcript and the buttons.

**Generate screen openings**

> Generate a **Screen Openings.txt** file describing each control on the main conversation screen — for cutting a physical keyguard. Positions and sizes are in **device (screenshot) pixels**, measured from the upper-left of the screen. Enter your window's title-bar height so each opening's Y matches a full-screen screenshot.

**Generate screen openings — destination** `#generateOpeningsHint` *(written by `app.js`, platform-conditional)*

> *(Chromium)* Writes **Screen Openings.txt** to the root of your data folder. Choose a data folder first (General tab) if you haven't.

> *(iPad)* Saves **Screen Openings.txt** to your device.

## About tab

**App updates**

> Forces a fresh reload to pick up the latest version — the same as a hard refresh (Ctrl+Shift+R), but no keyboard needed.

**Error log**

> Errors grouped by conversation (newest first). **Copy** puts the full report on the clipboard — each conversation's transcript together with its errors — ready to paste into a bug report. Also written to an `errors.log` file alongside your data.

**Voices offered to the app**

> Every voice this browser offers, with the internal id that identifies it. If a voice you installed on the device is missing here, the app cannot use it — some systems only reveal a newly installed voice after the app has been **fully closed and reopened**, not merely reloaded. **Copy** puts the whole list on the clipboard for a bug report.

**Estimated API cost**

> Estimated cost based on token usage. Check console.anthropic.com for exact billing.

---

## Also removed — generated from JavaScript, not `index.html`

**Practice tab, while a practice is running** (`app.js`)

> Ends the practice conversation and returns to the normal conversation screen. The End conversation button does the same thing.

**Controls tab — per-section descriptions** (`control-phrases-editor.js`, the `desc` argument to `singleSection()` / `listSection()`)

- **"Hold on" phrase** > Spoken when you tap Hold on — a brief beat to hold the floor while you choose.
- **"Ask them to repeat" phrase** > Spoken when you tap Ask them to repeat — asks the partner to say again what they said.
- **Openers (Start conversation)** > The cards shown when you tap Start conversation. Use `{name}` where the person's name should go — it fills in when a Partner is selected and is left out otherwise.
- **Wind-down statements (Wind down)** > The cards shown when you tap Wind down — they signal you'd like to end the conversation without saying goodbye yet ("I should get going."). Selecting one brings up the closings below.
- **Closings (goodbyes)** > The goodbyes ("Bye!", "Take care!") that appear after you pick a wind-down statement.
- **"One more thing" phrase** > Shown beside the goodbyes when the OTHER person starts wrapping up, so you can hold them a moment instead of only being able to say goodbye. Selecting it speaks the phrase and keeps the conversation open.

> **Worth keeping in the manual:** the `{name}` token in openers is not discoverable — nothing else tells the user it exists or that it drops out cleanly when no Partner is selected.

**Controls tab — the "Say again" note** (`control-phrases-editor.js`)

> "Say again" isn't listed here — it re-speaks your own last words exactly, so there's nothing to edit.

> **Worth keeping in the manual:** this one explains an *absence*. A reader looking for "Say again" in the Controls editor and not finding it has no other way to learn why.

**Express Panel tab — insert-position hint** (`express-editor.js`)

> The buttons above add to the end. To insert somewhere specific, tap ＋ on a row.
