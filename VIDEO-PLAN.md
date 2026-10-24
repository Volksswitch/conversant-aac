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

## The course

Groups 1 and 2 are a path, watched in order. Together they take a new user from nothing to a confident first conversation in about 25 minutes. Groups 3, 4 and 5 are a menu; viewers pick what they need.

### 1. Getting started (in order)

| # | Video | You'll be able to | Method | Versions |
|---|---|---|---|---|
| 1.1 | What Conversant is for | Explain what the app does and why it suggests replies | Staged | One |
| 1.2 | Installing Conversant | Open it from its own icon | By hand | Computer, iPad, Android |
| 1.3 | Adding your AI key | Paste the key we gave you and test it | Staged | One |
| 1.4 | Keeping your information safe | Choose a data folder (computer, Android) or make a backup (iPad) | By hand | Computer and Android, iPad |
| 1.5 | Do you need a speech service? | Tell whether your device needs one, and who to talk to if it does | Staged | One |

Video 1.5 is short on purpose. During the beta, speech keys are arranged with us directly, so it explains which setups need one and says to get in touch before signing up for anything.

### 2. Your first conversations (in order)

| # | Video | You'll be able to | Method |
|---|---|---|---|
| 2.1 | A tour of the screen | Name each part of the screen | Staged (done) |
| 2.2 | A practice conversation | Have a whole conversation with a pretend partner | Live |
| 2.3 | Your first real conversation | Listen, read the options, and tap one | Live |
| 2.4 | When it hears wrong | Check what it heard, ask them to repeat, and get new options | Live |
| 2.5 | In your own words | Type what you want to say, or use your words to get better options | Live |
| 2.6 | Starting and ending a conversation | Open with Start conversation, close with Wrap up and End conversation | Live |
| 2.7 | Buying yourself time | Use Hold on and Repeat what I said, and know what the app says while you choose | Live |

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

### 5. Keeping things running (menu)

| # | Video | You'll be able to | Method |
|---|---|---|---|
| 5.1 | Telling us about a problem | Send a problem report in two taps | Staged |
| 5.2 | Backups and moving to a new device | Save everything and bring it back | Staged, plus by hand for iPad |
| 5.3 | Keeping a conversation private | Use "Don't save this conversation" | Staged |

That's 31 topics. Counting device versions, it's 35 videos.

## Companion pages

Each video gets a one-page guide with the same title, made from the same script so the two can't disagree:

- **What you'll learn**, in one sentence.
- **The steps**, numbered, each with a small picture taken from the video at that step.
- **If something goes wrong**: one or two common problems and what to do.
- **Watch next**: the following video on the path, or related ones on the menu.

Narration is written to be heard and a page is written to be followed, so a script step can carry separate page wording. Where it doesn't, the page uses the narration.

There is also one **course map**: a single page listing every video in order, with the path and the menu marked. It's the first thing a new tester gets.

Pages are made as PDFs and published to the website the same way the other documents are.

## Keeping them current

A trigger phrase, **"sync videos"**, works like "sync docs":

1. Re-make every video. Speech already made is reused, so this costs nothing unless wording changed.
2. Stop and report any video whose script points at a button that no longer exists.
3. Compare each new video's pictures with the last published ones, and list the videos that actually changed.
4. Re-make those videos' companion pages and publish both.

Screenshots for the by-hand videos can't be re-taken automatically. The report lists which by-hand videos show screens that have changed, if any.

## Build order

1. **The live method** (stand-in microphone and fixed AI answers), proved on 2.2, the practice conversation.
2. **The rest of group 2**, so the path to a first conversation is complete.
3. **Companion pages and the course map**, starting with 2.1 and 2.2.
4. **Group 1**, including the by-hand screenshots, which need you and your devices.
5. **"sync videos" and publishing to the website.**
6. **Groups 3, 4 and 5**, most-asked-about first.

Steps 1 to 4 are what a beta tester needs on day one.

## Decisions for Ken

1. **Where the videos live.** The pilot is only 2.7 MB, so the website can hold them, and the same publishing route the PDFs use would keep the links current. YouTube is the alternative, but a replaced video there always gets a new link. Lean: the website.
2. **The by-hand screenshots** for installing, sign-up and the iPad need someone holding each device. Lean: you take them on your iPad and Android devices from a short list I'll write, and the program does the rest.
3. **Is 31 topics too many?** It's a menu, so nobody watches them all. But if you'd rather start smaller, groups 1 and 2 plus 3.1, 3.2 and 3.5 cover what most testers will ask about first.
