# Conversant AAC — Beta Test Plan

**Draft, August 7 2026. Revised August 9 2026 after Ken's review.**

⚠ **This prose exists in three places and none of them generates the others:** this file,
`generate-beta-test-plan-doc.js`, and `Conversant AAC Beta Test Plan.docx` — which Ken edits
directly, so the .docx can be *ahead* of both. **Every change must be made in all three in the
same pass, and the .docx must be backed up before it is regenerated**, or a hand edit is silently
overwritten (that is how the MacBook line and the keyguard sentence came to exist only in the
.docx). **Appendix B is for Ken and is deliberately dropped from the .docx.**

---

## 1. What this is

Conversant AAC is a free, open-source communication app for people who cannot speak. It listens
to the person you are talking with, and within a few seconds it offers you several things you
might say back. You pick one and the device speaks it in your voice.

Most communication devices are built for getting a message out. Conversant AAC is built for
something harder: **keeping a conversation going in real time.** People find silence awkward after
about four seconds, and that is the gap this app is trying to close.

You are among the first people outside the project to use it. Nothing about it is finished, and
your experience over the next six weeks will decide what gets fixed, what gets changed, and what
gets thrown away.

## 2. What we are trying to learn

Please read this section, because it explains why we ask what we ask.

**Question 1 — Do you keep using it?**
Not "do you use it every day." You will open this app when there is a conversation to have, and
some weeks have more of those than others. What we want to know is whether, six weeks in, you
still reach for it when a conversation comes up. If you stop, we badly want to know why. **A
tester who quits in week two teaches us more than one who is politely enthusiastic in week six.**

**Question 2 — Can you say what you actually meant?**
When the app offers you cards, how often is one of them close enough to say out loud without
asking for a new set or typing your own? This is the central bet of the whole product. If the
answer is "rarely," we need to know that plainly and early.

**Question 3 — Does it keep up?**
How long is the gap between the other person finishing and you speaking? If it is still long
enough to be uncomfortable, the app has not solved the problem it exists to solve.

Everything else — buttons, colors, layout, voices — matters, but it matters in service of those
three.

## 3. What we ask of you

| | |
|---|---|
| **How long** | Six weeks |
| **How much** | Use it when you would naturally have a conversation. There is no daily quota. |
| **Weekly** | A short note back — three questions, a couple of minutes (see §8) |
| **When something goes wrong** | Tap **Report a problem**. That is the whole procedure. |
| **At the end** | A conversation with Ken, in whatever form works for you |

You may stop at any time, for any reason, and we would still like the five minutes it takes to
tell us why.

## 4. What you need

- **A tablet or computer.** A Windows tablet, a Chromebook, a MacBook, or an iPad. On a computer,
  use Chrome or Edge. A Windows tablet (a Microsoft Surface is the usual choice) is the
  configuration we know best.
- **An internet connection.** The app needs it both to hear the other person and to suggest
  responses. It will not work offline.
- **An API key for the AI — we provide this, at no cost to you.** It is what powers the response
  suggestions. Ken will send you a key to paste into Settings. (The app calls it the *API key*,
  which is what the AI companies call it too.) You do not need an account and you will not be
  billed.
- **A free Deepgram account, for the voice.** Deepgram gives the app a much more natural, more
  varied voice than the ones built into your device, and signing up gives you **$200 of free
  credit — no credit card**. That is far more than six weeks of testing will use. On an iPad set
  up as a Home Screen app it also does the listening, which the device cannot do on its own. If
  you somehow run through the credit, tell us and we will sort it out.
- **A supporter, for setup.** Choosing a folder, pasting a key, and setting the layout are
  fiddly one-time jobs. After that the app is yours to drive.

Your User Manual covers your device specifically. Use the one for your device — they are
self-contained, and you should never need both.

## 5. Before your first real conversation

### 5.1 Setup (with your supporter)

**Your User Manual is where setup is explained properly** — §3 *Getting Started* for opening the
app and entering your API key, §5.2 for where your data is kept, §6.3 *Speech* for your voice and
the listening, and §6.4 for button size and the keyboard. Work through it there. This is only a
tick-list, plus the two things that are different because you are a beta tester.

- [ ] Everything in the manual's **§3** and **§5.2** — open the app, set up where your data is
      kept, and paste your **API key** (§3.2). **We send you that key**: you do not need an
      Anthropic account of your own and you will not be billed.
- [ ] Create your free **Deepgram** account and paste that key too (**§6.3**). This is what gives
      you the good voice. On an iPad set up as a **Home Screen app** it also has to do the
      listening — that is the one configuration where it is required. Everywhere else, leave the
      listening on your browser's own: it is free, reliable, and spends no Deepgram credit.
- [ ] Pick your **voice** and listen to it (**§6.3**). This is the voice people will hear as you.
- [ ] Set the **button size**, the **gaps**, and where the keyboard sits (**§6.4**).
- [ ] **Enter the tester ID we gave you** — **Settings → Troubleshooting**, in the box marked
      *Tester name*. This one is beta-only and is not in the manual. It saves as you type. It is
      the only thing that tells us whose reports are whose; without it they arrive anonymous and
      we cannot come back to you about anything in them.
- [ ] Save all of that as a **named settings profile**, and **re-save it every time you change
      something**. This is what protects your setup, and it is the one habit worth building.
- [ ] If you are on an iPad, do an **Export** and keep the file somewhere safe.

If you'd benefit from having a keyguard, contact Ken and he'll print one for you.

### 5.2 Tell your communication partners

**Please do this. It matters more than any feature.**

The app listens to the person you are talking with and sends what they say to a transcription
service to turn it into text. Their words are written down in your conversation record. They have
no way of knowing that unless you tell them.

Say something once, at the start, and that is usually the end of it. **The app will say it for
you:** your Express Panel has an amber **Notice** button reading *"This device listens and speaks
for me"* — tap it when you sit down with someone new. We will also send you a small printed card
for the back of the device if that is easier than saying it each time.

### 5.3 Learn the buttons before you need them

The row of buttons across the middle of the screen is the part testers most often forget. Spend
one practice session pressing every one of them at least once, so that when you need **Ask them
to repeat** in a real conversation, your hand already knows where it is.

Open **Settings → Practice** and work through a scenario. Nobody is listening; nothing you say
is spoken to a real person. Practice as many times as you like.

## 6. Week by week

This is a suggestion, not homework. If your life gives you a real conversation in week one, take
it.

| Week | What to try |
|---|---|
| **1** | Setup and practice. Do not have a real conversation yet. Get the buttons into your hands. |
| **2** | **Make it yours.** Fill in About Me. Add the people you talk to, the places you go, and how you feel. Edit the Express Panel so the phrases are *your* phrases. This is not optional setup — it is what makes the suggestions sound like you. |
| **3** | **First real conversations**, at home, with someone patient who knows what you are doing. |
| **4** | Widen it. A different person. A different room. |
| **5** | Take it out — a shop, an appointment, somewhere with noise and strangers. |
| **6** | Just use it. No tasks. This is the week that tells us whether it has earned a place in your life. |

Keep editing your phrases, people, and places throughout. Testers who keep tuning the app tend to
be the ones it ends up working for, and we would like to understand why.

## 7. When something goes wrong

**Tap "Report a problem."** You will find it in **Settings → Troubleshooting**, and also on the
opening screen next to the version number, in case the app is too stuck to reach Settings.

Write one line about what happened in your own words — *"I pressed Listen and nothing happened"*
is a perfect report. The app attaches everything technical by itself: what version you are on,
what device, what settings, and what the app was doing in the seconds before.

**You do not have to catch every problem.** If something felt wrong and you were mid-conversation,
carry on. Report it afterwards if you remember.

**Two things to watch for and always report:**

- The conversation panel turns **faintly red**. That means the app hit an error. It is a nudge,
  not an emergency — finish your conversation, then report it.
- **Nothing happens when it should.** No cards, no speech, a dead button. These are the failures
  we are worst at detecting on our own, because the app does not know it has failed. Your report
  is the only way we find out.

## 8. The weekly note

Three questions, once a week. Two minutes.

This is not the same thing as the report the app sends by itself. That one is counts and timings
— it can tell us that you waited eleven seconds, and it can never tell us why, or whether you
minded. Only you can answer that, which is why we still ask.

1. Roughly how many real conversations did you have with it this week?
2. Was there a moment it let you down? What happened?
3. Was there a moment it worked? What happened?

Question 3 is not a courtesy. Knowing what already works tells us what not to break.

## 9. Privacy — read this once

**What stays on your device:** everything you enter. About Me, your people, your places, your
phrases, and the full text of your conversations are stored on your device — in the data folder
you chose, or, on an iPad, in the app's own private storage. They are not uploaded, and there is no account and no server holding your information.

**What leaves your device, and why:**

- **What the other person says** goes to a transcription service to be turned into text. This is
  how every speech recognition system works, and it is why telling your partners matters.
- **What you might say** — the conversation so far, plus what you have told the app about
  yourself — goes to the AI so it can suggest responses. You pick what is spoken; nothing is
  said out loud unless you choose it.
- **During this beta only:** the app sends back **usage information and error reports** so we can
  see how it is holding up. This is **counts and timings only** — how many conversations, how
  long you waited, which buttons you pressed, what error occurred. **It never includes what you
  or the other person said.** A transcript is only ever sent if you choose to attach one, and you
  see it first.

**These reports are not anonymous, and you should know that before you agree to them.** Each one
carries the tester name we gave you at setup, so we can tell whose report is whose and follow up
with the right person. We already know who you are — you volunteered — so the name tells us
nothing new. But it does mean the reports are a record with your name on it, held by us, and that
is worth saying out loud rather than leaving you to work out. They also carry a code identifying
the device, so reports from your tablet stay separate from reports from anything else you use.

You can read exactly what a report contains at any time in **Settings → Troubleshooting**, under
*What is in a weekly report*, along with a list of every report already sent.

**Error reports travel the same way.** They are part of the weekly report, so you do not have to
do anything to send us the errors the app noticed by itself. That is separate from **Report a
problem** (§7), which only goes when you tap it — because that one is *your* description of what
happened, and it may carry a transcript you have chosen to attach.

You can turn automatic reporting off in the same place. We would rather you left it on, because it
means you never have to remember to send us anything — but it is your choice and turning it off
will not affect the app. **If you do turn it off**, nothing is lost: **Settings → Troubleshooting**
still has **Save to a file** and **Copy** for both the problem report and the error log, and you
can send either to Ken whenever you like.

**This arrangement ends with the beta.** In the public release, sending anything back will be off
unless the person using the app deliberately turns it on.

**Any single conversation can be kept out of the record entirely.** Tap **Don't save this
conversation** before you begin, and nothing from it is written down. Use it whenever you want
to; you do not need a reason.

## 10. What we already know is wrong

See the **Known Issues** document that came with your kit. It is worth five minutes before you
start — several things that look like faults are known and already understood, and reading it
saves you reporting them.

If something is in there and it is causing you real trouble, tell us anyway. Knowing which known
problems actually hurt is how we decide what to fix first.

## 11. Getting help

Contact Ken directly — you have his details in your welcome pack. **Always include your version
number**, which is on the opening screen and in **Settings → About**.

There is no wrong question and no bad report. If you are unsure whether something is a fault or
just how the app works, that uncertainty is itself worth telling us about.

---

## Appendix A — Glossary

| Term | What it means |
|---|---|
| **Response cards** | The suggestions the AI offers you. Four of them, or eight if you have chosen two per category. |
| **Category** | The kind of reply a card is. Agreeing, declining, changing direction, or asking them to repeat. They are always in the same place so your hand can learn them. |
| **Command Bar** | The row of buttons between your conversation and your cards. |
| **Express Panel** | Your own phrases, and the buttons for who you are with, where you are, and how you feel. |
| **In my own words** | Type something the AI did not suggest and have it spoken. |
| **Reframe** | Type what you want to get across, and the AI rewrites the cards around it. |
| **Practice** | Rehearse with the AI playing the other person. Nothing is spoken to a real person. |
| **Your data** | Everything you enter — About Me, your people, places, phrases and conversations. On a Windows tablet, Chromebook or MacBook it goes in a **data folder** you choose yourself, which you can open, copy and back up like any other folder. On an iPad the app keeps it in its own private storage, which you cannot browse; **Export** is how you get a copy out of it, and it is why iPad testers are asked to export. |

---

## Appendix B — For Ken, not for testers

### B.1 This plan describes features that do not exist yet

Everything below must ship before testers arrive, or the corresponding section needs rewriting:

| § | Depends on | Status |
|---|---|---|
| 7 | **Report a problem** button + free-text note | **Built** |
| 7 | Pre-start reporting affordance | **Built** |
| 7, 9 | **Settings → Troubleshooting** tab | **Built** |
| 9 | Automatic reporting + its off switch | **Built**, proven end to end against the live endpoint |
| 7, 11 | Version number on the opening screen | **Built Aug 9 2026** — both sections claimed it and it was not there |
| 5.2 | Express Panel **Notice** button, "This device listens and speaks for me" | **Built Aug 9 2026** — new amber *Notice* phrase category. ⚠ It is a new **default**, and Express items have no new-defaults merge, so it appears for a tester setting up fresh and NOT in an existing panel (Ken's own). See B.2.6. |
| 5.2 | Printed card | Not produced (SEC-7) |
| 5.3, 6 | Controls-tour practice scenario | Not built — §5.3 currently asks testers to improvise it |
| 10 | Known Issues doc refreshed to current version | Exists, last updated at 0.5.82. Where it should live is B.2.7. |

### B.2 Decisions still needed

1. ~~Who pays for the API key?~~ **Decided (Ken, August 7 2026): Ken funds and supplies the
   Anthropic key; the tester signs up for Deepgram's free $200 credit on the assumption it
   suffices, and they talk if it doesn't.** The retention-metric confound is removed. Two things
   that follow and are not yet handled: **how keys are distributed and revoked** (a shared key
   across testers makes per-tester spend invisible and a leak unrevokable in isolation — separate
   keys are worth the admin), and the fact that **the Anthropic key must never reach a settings
   profile or a backup**, which `PROFILE_EXCLUDE` already enforces, so a tester restoring a
   profile will need to re-paste it. Worth saying in the welcome pack rather than letting them
   discover it.

2. **One plan or two?** The manuals are deliberately two self-contained documents. This plan is
   mostly platform-neutral, with the split confined to §4 and §5.1. One document seems right, but
   the same reasoning that produced two manuals may apply.

3. **Weekly note — OPEN, and Ken has challenged whether it is worth asking at all (Aug 9 2026).**
   His three objections, all sound: there is no interface for it (a pop-up? a keyboard? nothing is
   built); it is effortful for exactly the population least able to afford effort; it asks people
   to recall several days back; and **question 1 arrives automatically in the weekly report
   anyway.** Answering the last first — yes, conversations-per-week is counted for us, so Q1 is
   pure duplication and should go regardless of what happens to the rest.
   **Recommendation: drop Q1, keep Q2 and Q3, and stop calling it weekly.** They are the only
   thing the numbers cannot supply — a falling card-selection rate says *something* changed and
   never says whether the tester minded. Make it **one box, always there, filled in when there is
   something to say**: the *Report a problem* box on the Troubleshooting tab already is that box,
   already has the on-screen keyboard in scope, and already rides the weekly send. A second
   prompt beside it — *"Anything that worked well, or badly, this week?"* — costs almost nothing
   to build and nothing at all to skip.
   **Deliberately not recommended: a pop-up.** A prompt that interrupts is the one thing this
   population cannot dismiss cheaply, and a tester who resents it will stop reading it rather than
   answer it.
   If the questions survive in any form, the remaining question is the channel back — email is
   fine, a form collates better, and the app's own box is better than both because it is where
   the tester already is.

4. **Six weeks is a guess.** It is long enough to see a week-4 retention curve, which is what
   Question 1 needs. Shorter loses the curve.

5. ~~**The Product Overview's "Private by Design" claim now needs a beta exception** (§9).~~
   **Done Aug 8 2026** — added as a stated exception rather than by softening the opening claim.

6. **Express Panel has no new-defaults merge, and the Notice button is the first time it has
   cost anything (Aug 9 2026).** CLAUDE.md's standing reconciliation policy — a new *default*
   appends to an existing user's list via a `seeded` watermark, so a release cannot hide new
   functionality behind "file in folder wins" — was built for control-phrases and **never applied
   to Express items**. So the Notice button reaches a fresh setup and not an existing one.
   For a beta that has not started this is nearly free: testers set up from scratch, and Ken can
   add the phrase himself in a few taps. **Decide whether to build the watermark now or leave it**
   — the argument for now is that the panel is the set most likely to gain defaults later; the
   argument against is that appending to a grid whose positions the user has arranged is more
   disruptive here than in a flat phrase list, and it is worth designing rather than dropping in.

7. **Where does Known Issues live? (Ken asked, Aug 9 2026.)** The document exists —
   `Conversant AAC Known Issues.docx` — but was last reviewed at 0.5.82 and is currently a file
   in the kit, which means it is out of date the moment a release ships.
   **Recommendation: a simple web page at `conversant.volksswitch.org`, plus a button on the
   Troubleshooting tab that opens it.** The page is the honest home — one copy, always current,
   nothing to redistribute, and Ken can edit it without a release. The button is what makes it
   findable at the moment it is wanted, which is the moment something looks broken.
   **The cost to accept: it needs the internet.** That is not much of a cost here, because the app
   does not work without the internet anyway, so a tester who cannot reach the page also cannot
   have hit most of the issues on it.
   **Not recommended: a pop-up carrying the text inside the app.** It would have to ship with the
   release, so it goes stale exactly like the file, and it spends panel space on prose — the thing
   UI Layout Rule 14 was written to stop.

### B.3 How the sections map to the measures

- §2 Q1 → adoption (conversations per active week, week1→week4)
- §2 Q2 → sufficiency (share of turns spoken from a card without a regenerate)
- §2 Q3 → time from partner pause to user turn
- §6 week 2 → personalization depth, which segments palette abandonment (onboarding problem vs.
  generator problem)
- §5.3 → the never-pressed Command Bar button finding
- §8 Q2/Q3 → the "why" that the numbers cannot supply
