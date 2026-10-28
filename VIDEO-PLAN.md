# Learning Conversant: Video and Companion Page Plan

Draft, October 24 2026. This plan lays out the how-to videos for beta testers, the order to watch them in, how each one gets made, and the one-page guide that goes with each.

## Who it's for

The viewer is the person who uses Conversant. "You" in every video and page means the user. A supporter watching along will follow it just as well.

Each video teaches one task in about two minutes and ends with something the viewer can now do.

## How the videos are made

Every video is a short script file in `scripts/video/scripts/`. A program opens the real app, puts it in each step's state, draws a ring on what's being named, and speaks the narration. Three fixed voices are used throughout: Andrew narrates, Ava is the partner, and Jason is Marc, the user.

There are three ways to make a video, depending on what it shows:

| Method | What it shows | How it's made | Effort to keep current |
|---|---|---|---|
| **Staged** | The screen in a set state, like the screen tour | Fixed text drawn by the app's own screen code | None. It re-makes itself. |
| **Live** | The app actually working: listening, suggesting, speaking | The real app runs, with a stand-in microphone and with the AI's answers fixed in advance, so the narration always matches | None, once the stand-ins are built |
| **By hand** | Things outside the app: installing it, signing up for a service, the folder picker, the iPad Home Screen | Screenshots taken on the device, narrated by the same program | Re-take the screenshots when the outside screen changes, which is rare |

The live method needs two new pieces: the stand-in microphone and the fixed AI answers. Both are small, and the app's tests already do something similar.

**Narration never says where something is.** It says "this button" and lets the ring point. The layout changes with the device and the user's settings, so words like "top" or "left" would often be wrong.

**When a voice says a word wrong in one line** (October 28 2026, "CAN-versant" in video 3.2): the narrator's voice varies a little each time it records a line, so a word it says right everywhere else can come out wrong once. Put the word's exact sounds in `scripts/video/pronounce.json` and add `pronounce: true` to that step. Only that line is recorded again; every other line keeps its approved recording. To find which line is wrong without listening to each one, Azure's pronunciation check reports the sounds it heard and how long each part of the word took: the wrong line in 3.2 had "æ" (as in "can") and a first part 250 ms long, against "ə" and 130 to 230 ms in twenty other lines.

## The course

Groups 1 and 2 are a path, watched in order. Together they take a new user from nothing to a confident first conversation in about 25 minutes. Groups 3, 4 and 5 are a menu; viewers pick what they need.

### 1. Getting started (in order)

| # | Video | You'll be able to | Method | Versions |
|---|---|---|---|---|
| 1.1 | What Conversant is for | Explain what the app does and why it suggests replies | Staged (made) | One |
| 1.2 | Installing Conversant | Open it from its own icon | By hand (made) | Computer, iPad, Android |
| 1.3 | Adding your AI key | Paste the key we gave you and test it | Staged (made) | One |
| 1.4 | Keeping your information safe | Choose a data folder (computer, Android) or make a backup (iPad) | By hand (made) | Computer, iPad, Android |
| 1.5 | Do you need a speech service? | Tell whether your device needs one, and who to talk to if it does | Staged (made) | One |

Video 1.5 is short on purpose. During the beta, speech keys are arranged with us directly, so it explains which setups need one and says to get in touch before signing up for anything.

### 2. Your first conversations (in order)

| # | Video | You'll be able to | Method |
|---|---|---|---|
| 2.1 | A tour of the screen | Name each part of the screen | Staged (made) |
| 2.2 | A practice conversation | Have a whole conversation with a pretend partner | Live (made) |
| 2.3 | Your first real conversation | Listen, read the options, and tap one | Live (made) |
| 2.4 | When it hears wrong | Check what it heard, ask them to repeat, and get new options | Live (made) |
| 2.5 | In your own words | Type what you want to say, or use your words to get better options | Live (made) |
| 2.6 | Starting and ending a conversation | Open with Start conversation, close with Wrap up and End conversation | Live (made) |
| 2.7 | Buying yourself time | Use Hold on and Repeat what I said, and know what the app says while you choose | Live (made) |

### 3. Making it yours (menu)

| # | Video | You'll be able to | Method |
|---|---|---|---|
| 3.1 | About Me: a few answers go a long way | Answer the questions that matter most first | Staged |
| 3.2 | The people in your life | Add a person and say how you talk with them | Staged |
| 3.3 | Your places | Add a place and what's worth knowing about it | Staged |
| 3.4 | Your goals | Set what you want from a person, a place, or any conversation | Staged |
| 3.5 | Changing an Express Panel button | Change a button's words, add one, and move one | Staged |
| 3.6 | How the Express Panel is organized | Use the three groups of buttons and the More button | Staged |
| 3.7 | Telling Conversant who, where and how you feel | Tap a person, place or feeling button and see the options change | Live |
| 3.8 | Your voice | Choose a voice and fix a name it says wrong | Staged |
| 3.9 | Your own openers and goodbyes | Change the phrases behind Start conversation, Wrap up and the other commands | Staged |
| 3.10 | Looking back at a conversation | Rewrite a reply so the app learns how you'd say it | Live |

### 4. Fitting it to you (menu)

| # | Video | You'll be able to | Method |
|---|---|---|---|
| 4.1 | Button size and spacing | Make buttons easier to hit | Staged |
| 4.2 | Screen layout | Choose a layout and where the keyboard sits | Staged |
| 4.3 | One tap or two | Guard against taps you didn't mean | Staged |
| 4.4 | Text size and colors | Make the screen easier to read | Staged |
| 4.5 | Timing | Change how long the app waits, and its holding phrases | Staged |
| 4.6 | Keyguards | Get the measurements to have a keyguard made | Staged |
| 4.7 | Short Wording on Your Options | Show the full response, a short version, or both | Staged |

### 5. Keeping things running (menu)

| # | Video | You'll be able to | Method |
|---|---|---|---|
| 5.1 | Telling us about a problem | Send a problem report in two taps | Staged |
| 5.2 | Backups and moving to a new device | Save everything and bring it back | Staged, plus by hand for iPad |
| 5.3 | Keeping a conversation private | Use "Don't save this conversation" | Staged |

That's 31 topics. Counting device versions, it's 35 videos.

## Companion pages

**Built (October 24 2026):** every video's page is made in the same run as the video, from the same pictures (`Videos/<id>.pdf`), and the course map is `Videos/Learning Conversant.pdf` (`node scripts/video/make-course-map.mjs`). Titles, summaries and the order live in `scripts/video/course.json`. The screenshot list for the by-hand videos is `Videos/Screenshots to Take.docx` (made by `scripts/video/make-screenshot-guide.py`, with real computer screenshots from `capture-computer-samples.mjs`).

Each video gets a one-page guide with the same title, made from the same script so the two can't disagree:

- **What you'll learn**, in one sentence.
- **The steps**, numbered, each with a small picture taken from the video at that step.
- **If something goes wrong**: one or two common problems and what to do.
- **Watch next**: the following video on the path, or related ones on the menu.

Narration is written to be heard and a page is written to be followed, so a script step can carry separate page wording. Where it doesn't, the page uses the narration.

There is also one **course map**: a single page listing every video in order, with the path and the menu marked. It's the first thing a new tester gets.

Pages are made as PDFs and published to the website the same way the other documents are.

## Keeping them current

**Built (October 24 2026):** `node scripts/video/sync-videos.mjs` (add `--publish` to upload). The page it maintains is `conversant-videos`, made first as a draft.

A trigger phrase, **"sync videos"**, works like "sync docs":

1. Re-make every video. Speech already made is reused, so this costs nothing unless wording changed.
2. Stop and report any video whose script points at a button that no longer exists.
3. Compare each new video's pictures with the last published ones, and list the videos that actually changed.
4. Re-make those videos' companion pages and publish both.

Screenshots for the by-hand videos can't be re-taken automatically. The report lists which by-hand videos show screens that have changed, if any.

## When a video changes: what else to update

Other pages, documents and emails link to the videos and name them. These rules keep them right when a video is re-made, renamed, added or removed.

### Where the videos are mentioned

**Kept right automatically**, because they're rebuilt from `scripts/video/course.json` every time:
- the videos page and each video's watch page, with its Next buttons,
- each one-page guide's "Watch next" line, and the course map,
- the spoken "Next: ..." at the end of each video.

**Written by hand, so they can go wrong:**
- **The beta emails.** `BETA-EMAILS.md` is the master. The Word copies in `Other/Beta Testing/Emails` are made from it with `python scripts/make-beta-emails.py`, so a change goes in the master and the copies are made again.
- **The Conversant home page** on the website. The WordPress page is the copy now; its first draft (`Documents/Conversant AAC Website Home Page.docx`) is history and isn't updated.
- **The three User Manuals.** Since October 25 2026 each section a video covers ends with a "Video:" line linking it, and the Introduction links the whole list. They're made by `python scripts/video/add-manual-links.py --apply`, whose list says which section gets which video, so they're not edited by hand.
- **The other pages on the website** (the beta page, the Beta Test Plan, Known Issues, Documents) and **the other documents** in `Documents/`. None of these links a video today.
- **Emails already sent.** They can't be changed, which is why rule 1 below matters.

### The checker

`python scripts/video/check-video-references.py` reads everything in the hand-written list and reports:
- a link to a video that doesn't exist or isn't published,
- a link whose words are one video's title but which opens a different video,
- a link in a User Manual whose words aren't its video's current title (a renamed video the manuals haven't caught up with),
- a sentence naming a video by a title no video has,
- "the six Getting Started videos" when a different number is linked beside it, and "about four minutes" when they add up to something else,
- Word copies of the emails older than `BETA-EMAILS.md`,
- a watch page still published for a video no longer in the course.

**It runs by itself at the end of every "sync videos"**, and can be run on its own with the trigger phrase **"check video links"**. Fix every ERROR before sending a beta email. It can't judge whether a sentence describing a video is still true; that's rule 2.

### The rules

1. **A watch page's address never changes once it's published.** The address comes from the video's number (`video-2-3`) and, for a device version, the device (`video-1-2-ipad`). Sent emails carry these addresses for good. So:
   - **A new video goes at the end of its group**, with the next free number, never between two existing ones. (That's why "Short Wording on Your Options" is 4.7 rather than sitting beside 4.4.)
   - **Don't renumber a published video, and don't split one into device versions after it's published.**
   - If one must move anyway, change every link in the same sitting, and turn the old watch page into a short page pointing to the new one.
   - **A stale link now shows "page not found".** Until October 25 2026 the website guessed at an address it didn't know, so `video-1-2` quietly opened the Android version of 1.2 and nobody would have noticed. The plugin "Disable URL Autocorrect Guessing" (installed by Ken that day) stops the guessing on the whole site. Keep it installed: the rules and the checker reduce stale links, and can't guarantee there are none.
   - **A video made in one version per device also has a page at its plain number** (`video-1-2`, `video-1-4`) that asks which device and links each version. The publisher makes and updates these by itself. They keep the addresses used before 1.2 and 1.4 were split working, and give an email that doesn't know the reader's device one address to link.

2. **A video re-made with the same number and title needs nothing changed elsewhere.** Its address stays the same. But if an email or page says what the video shows ("The Adding Your AI Key video shows where to paste it"), read that sentence again and check it's still true.

3. **A new title** goes in `course.json` and nowhere else by hand, except:
   - the link words and quoted titles in `BETA-EMAILS.md`, then make the Word copies again,
   - the Conversant home page in WordPress, if it names the video,
   - the table in this plan,
   - the User Manuals: run `python scripts/video/add-manual-links.py --apply`, which puts the new title on their links. Then republish the manuals' PDFs.
   The video before it changes too, because its last line names this one; "sync videos" re-makes it.

4. **A new video:**
   - Add it to `course.json` at the end of its group, and to the table in this plan.
   - "Sync videos" re-makes the video before it, whose last line now names the new one.
   - Once it's published, add it to the list in `scripts/video/add-manual-links.py` under the manual section it belongs to, run that with `--apply`, and republish the manuals' PDFs. Nothing reports a video the manuals don't link, so this step is easy to miss.
   - If it's in Getting Started, decide which welcome emails should list it (each email lists only its own device's versions), then update their count and their "about N minutes". The checker catches a count that's wrong, but not a video that should be listed and isn't.

5. **Removing a video:**
   - First run the checker to find everything that links it, and point those links elsewhere. In the User Manuals that means taking it out of the list in `add-manual-links.py` and deleting its "Video:" line from each manual by hand (the script adds links, it doesn't remove them).
   - Then take it out of `course.json`. "Sync videos" re-makes the video before it.
   - The checker then reports its watch page as still published. Unpublish it in WordPress (set it to Draft) rather than deleting it, so it can come back.

6. **Changing the Getting Started set** (adding, removing, or making one much longer or shorter) changes the welcome emails' "six videos ... about four minutes". The checker catches it.

7. **Old copies of the files stay in the website's media library** after each upload, because deleting there is permanent. The publisher lists them by name, and Ken deletes them when he wants to.

## Build order

1. **The live method** (stand-in microphone and fixed AI answers), proved on 2.2, the practice conversation.
2. **The rest of group 2**, so the path to a first conversation is complete.
3. **Companion pages and the course map**, starting with 2.1 and 2.2.
4. **Group 1**, including the by-hand screenshots, which need you and your devices.
5. **"sync videos" and publishing to the website.**
6. **Groups 3, 4 and 5**, most-asked-about first.

Steps 1 to 4 are what a beta tester needs on day one.

## Decisions (Ken, October 24 2026)

1. **The videos live on the website**, published the same way the PDFs are. The site can't stream them, so they're downloaded and played. That means each file has to stay small; the pilot is 2.7 MB for 91 seconds.
2. **Ken takes the iPad and Android screenshots** for the by-hand videos, from a list the build provides.
3. **All 31 topics are in scope.**
