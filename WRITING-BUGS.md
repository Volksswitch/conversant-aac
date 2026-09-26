# Writing Bugs

The faults that keep turning up in the Conversant AAC documents, and what to do about each
one. It is a checklist you work through, not background reading: **open it during a "sync
docs" pass and go down the list.**

The rule these come from is CLAUDE.md → **PLAIN STYLE**, which carries why it exists, who
the reader is, and what to write instead. This file is the catalog. Keep it in one place —
a second copy of a list like this drifts, and the stale copy is the one somebody follows.

## How to use it

1. **Run the scanner** for the part a machine can find:

   ```bash
   python scripts/doc-tests/check-writing-bugs.py "Conversation Review"
   ```

   It reports **candidates, never errors**. Every pattern below has an innocent use, so a
   scanner that failed the build would fire on correct writing, and a check that is always
   red is one people learn to scroll past. It finds nothing for bugs 1–11; those need a
   person.

2. **Read the document against the list, SECTION BY SECTION.** The scanner is a starting
   point and misses most of what matters.

   **⚠ THE BACK OF A DOCUMENT COMES OUT WORSE THAN THE FRONT, and nothing reported it**
   (Ken, September 26 2026, on the Conversation Review: the rules “seem like they are being
   forgotten a third of the way into the document”). A pass that runs top to bottom in one
   go thins out, and a section that got no attention looks exactly like a section that was
   already clean. Two things stop it:

   - **Work one section at a time and write down what each one produced.** A section
     reporting nothing then stands out instead of disappearing. The scanner ends each
     document with a work list of its sections, their length, and how many candidates
     each one holds, for the same reason.
   - **Make a second pass from the back.** It costs little, and it puts fresh attention
     where the first pass had least.

3. **The one test that finds all of them**, and it is Ken's: *say the sentence out loud the
   way you would say it to somebody.* If a plain version arrives instantly and sounds
   nothing like what is on the page, the writing was performing.

## Stop and ask before any fix that could change what the app does

**A writing bug is never worth a wrong sentence.** If clearing one would rename something,
change what the app is said to do, or soften a guarantee, **stop and ask Ken to approve it.**
Style never outranks accuracy.

Ken asked (September 25 2026) whether he had to say this explicitly. He doesn't — it is
already the standing rule under *Working Guidelines*: verify UI details against source before
writing about them, because an invented UI detail is a silent error that reaches users. **It is
written here anyway, because three of these bugs invite exactly that mistake.**

- **Bug 18 is a rename rule.** It tells you to pick one word for a thing and drop the other, so
  it is the highest-risk item on this list. **The winning word is the app's own**, checked in
  `app/index.html` and `app/js/ui.js` — not the one that reads better. *Rehearsal →
  practice conversation* was safe because Settings says *Practice*. *Compose Pane* went to
  Ken because the manuals said *Composition Pane*, and he chose the manuals' word.
- **Bug 16 rewrites whole sentences**, which is where meaning quietly shifts.
- **Bug 17 is safe as a split and unsafe as a reword.** Turning a colon into a period changes
  nothing; rewriting the clause around it can.
- **⚠ Watch the *never* and *does not* sentences hardest.** They are promises — *“the
  app will not answer general-knowledge questions”*, *“it does not follow the device's
  own light or dark setting”*. **Contracting one is safe. Rewording one is a change to what
  the product guarantees**, and it must not happen as a side effect of a style pass.

**⚠ AND THE STEP THAT CATCHES ALL OF IT: AFTER APPLYING BUG 15, DIFF AGAINST THE BACKUP AND CHECK THAT EVERY CHANGE IS ONE OF YOUR OWN REPLACEMENTS.** Not “does it read right” — machine-check each change against the table you applied. That is what found all five faults in the Product Overview pass, none of which a read had noticed. It is the standing rule in another place: verify the thing you did NOT intend to change.

**Bug 15 is the safe end of the scale for MEANING** — contractions and apostrophes change none — **but it is the easiest to get mechanically wrong**, which is why it has four traps listed under it and why a re-scan after applying it is not optional.

---

## The bugs

1. **Every sentence argues instead of informing.** Documentation says what a thing is and how it works. It does not keep proving the design is right when nobody has disagreed.
2. **Aphorisms.** Short punchy fragments dropped in to be admired: *"Not a lesser purpose, just a different one."* *"Those are cheaper to get wrong on paper."*
3. **Superlatives and certainty words.** *precisely, exactly, the strongest single use, nothing else in the app can do, in one stroke.* Most are claims with no evidence behind them.
4. **Drama.** *"fighting a four-second clock", "undo that in one stroke".* Borrowed tension on a design note.
5. **Stacked clauses.** A sentence that starts, interrupts itself with a dash, then resumes. One is fine. Twenty in a row is exhausting.
6. **Defensiveness.** Sentences that answer objections the reader never raised, and sentences that defend the document itself — why it was written, why writing it first was worth the time.
7. **Self-commentary.** *"the first edition had got wrong", "recorded here so it is not re-argued".* The document talking about its own history instead of giving the current answer.
8. **Formal headings.** *"Why This Document Exists"*, *"Getting In: Choosing a Conversation"*. A heading is a label. An opening section usually needs no heading at all — it is just the paragraphs after the title.
9. **Process the reader does not care about.** Build steps, what is and is not built yet, review status. The therapists reading a proposal know it is a proposal.
   - *A version of this that reads as rigor:* **citing our own verification to the reader.** "Measured: all thirty-two cells keep the same size." The fact is what the reader wants; that we checked it is process.
10. **British register.** *had got, somebody, in one stroke, precisely, whilst.* Covered by the American English rule, but it arrives with this style and not on its own.
11. **The document rating its own material** (Ken, September 25 2026). *"This is the main thing on the screen, not a fallback."* *"That last row matters and should stay."* *"Real-time playback deserves to be built."* The document is telling the reader how to weigh what it is about to say, which is the reader's job. **Say what is true and let them weigh it.**
    - *Search:* `the main thing`, `matters`, `deserves`, `worth`, `the strongest`, `only worth` — attached to the document's own content rather than to the app's behavior.
12. **"So" at the start of a sentence.** It announces a conclusion being drawn, which is what turns a list of facts into an argument. It ran 15 times in 420 sentences in the Conversation Review before the September 25 2026 pass. *Therefore, Otherwise, And yet, But* do the same job. A paragraph reads as documentation when its sentences simply follow one another.
    - *Search:* sentence-initial `So`, `Therefore`, `Otherwise`, `And yet`.
    - **⚠ NOT EVERY SENTENCE-INITIAL *So* IS A CONNECTIVE. *So do*, *So does*, *So is*, *So
      are* is an INVERSION meaning "that too", and deleting the *So* turns a statement into
      an order.** *"So do your saved settings profiles"* became *"Do your saved settings
      profiles"* - an imperative telling the reader to go and do something. One shipped into
      Backup Compatibility before a check for sentences starting *Do / Does / Is / Are* caught
      it. **Look at the word after *So* before deleting it.**
    - **⚠ *OTHERWISE* READS LIKE THE SAME TELL AND IS NOT.** *"Otherwise the user taps Listen
      when they are ready"* names the other branch, which the reader needs; *"So ..."* only
      labels what the previous sentence already implied. Leave *Otherwise* alone.
13. **Defensive tags: *anyway, at all, though, still, of course, after all*.** One word tacked onto a clause to fend off an objection nobody raised — *"this layout has no room for a box anyway"*, *"the phrase panel appears in review at all"*. Bug 6 in a form you can search for.
14. **An absence handed the sentence when a real actor was standing right there** (Ken, September 25 2026). *"and nothing tells us why"* → **"and we don't know why."** *"nothing checks whether a suggestion suits the turn"* → **"the app doesn't check whether…"** Personifying an absence borrows weight that naming the actor doesn't need. **Ask who or what actually does the thing, and put them first.**
    - **It is not a ban on *nothing*.** *"Nothing changes without confirmation"* and *"Nothing is at stake in a practice conversation"* are plain and stay. The test is whether a person, or the app, was available to be the subject.
15. **Formality** (Ken, September 25 2026: *"'did not' is a more formal version of 'didn't'. Seek to be less formal"*). **Contract the negations** — *doesn't, didn't, don't, isn't, aren't, can't, won't, wouldn't, couldn't, shouldn't, hasn't, haven't, weren't* — and the ordinary pronoun pairs, *it's, that's, they're, what's*. Headings included: *"What Review Isn't"*, *"What Review Can't Do"*.
    - **Leave *must not* and *may not* alone.** *Mustn't* and *mayn't* are not how an American speaks, so contracting them trades formality for a British register (bug 10).
    - **⚠ MATCH ON WORD BOUNDARIES. THIS IS THE ONE THAT CORRUPTS WORDS.** A plain `replace(“is not”, “isn’t”)` turns **“there is nothing” into “there isn’thing”** and **“is noticeable” into “isn’ticeable”**. Three of those went into the Product Overview. The earlier pass on the Conversation Review used `\b` and was clean, so **the regression came from switching to string replace for speed.** Use `\b` on every side, always.
    - **⚠ A COPULA THAT ENDS A CLAUSE CANNOT CONTRACT, and this one got past a guard that already knew about the other three.** *“the user can tell the system where they are and who they are with”* became **“where they’re and”**, which is not English. The guard checked what came BEFORE the pronoun and nothing checked what came after. **Test both sides: a contraction followed by a comma, a period, a dash, *and*, or *or* is a stranded copula.** Two of them shipped into the Product Overview before a re-scan caught them.
    - **⚠ THREE MORE CONSTRUCTIONS MATCH A NAIVE SWEEP AND MUST NOT BE TOUCHED**, because the words are not a pronoun and its verb: a relative pronoun (*"a button that is no longer on the panel"*), a verb phrase as subject (*"Hearing it is how the user judges"*, *"refusing to offer it is right"*), and a prepositional object (*"The argument for it is that the clock is off"*). Do the negations by rule and the pronoun pairs by a list you have read in context.
    - **⚠ AND THE ONE THAT LOOKS RIGHT ON SCREEN AND IS WRONG IN THE FILE: use the typographic apostrophe ’, not '.** These documents are curly throughout, so 74 straight ones went in beside *user’s* and *person’s* and nothing reported it.
16. **The unusual construction where an ordinary one exists — it reads as reaching for tone** (Ken, September 25 2026, on *"Nothing else needs learning"*: *"cumbersome in a way that tries to sound erudite"*). In plain speech that is *"you don't need to know anything else."* The words are all ordinary; the **grammar** is the affectation, which is why this survives every check and every read for jargon.
    - **The shapes it takes.** *need / want / bear* + a gerund (*"needs learning"*, *"may need revisiting"*); *do the* + a gerund (*"a supporter does the reviewing"*); a gerund or a *neither…nor* pair as the subject (*"Neither trusting it nor quietly refusing to offer it is right"*); comparing two gerunds (*"separates knowing that transcription struggles from knowing which sounds it struggles with"*); a fronted participle (*"Played at real speed, …"*); an abstract stand-in (*"anything of that shape"*); a formal verb where a common one exists (*conveys* for *shows*). One sentence carried two: *"It may need revisiting … where a supporter does the reviewing with them."*
    - **⚠ THE FIRST ANSWER TO THIS ONE WAS WRONG AND THE MISTAKE IS EASY TO REPEAT.** Asked what was wrong with the sentence, I said it was a reassurance about the reader's experience dressed as a fact. True, and beside the point — **the fault was in the grammar, not the claim**, and I went looking in the argument because bugs 1–14 are all about arguments. **When a sentence reads badly, check how it is built before deciding what it is trying to do.**
17. **The colon as a drumroll.** A colon before a **list** is punctuation and is fine — *"it came from one of four places: a suggestion, a phrase, …"*. A colon before a **clause** promises a reveal the clause never earns: *"What this gives up: the user can't fix a single letter"*. **Use a period.** Both halves stand up as sentences, which is the proof the colon was decoration.
18. **Two words for one thing.**
    - **⚠ A RENAME IS NOT A FIND-AND-REPLACE, and the project-wide *card* -> *response option*
      sweep (350 changes, 31 documents, September 25 2026) is the worked example.** Six things
      had to be settled before a single edit, and every one of them would have produced a wrong
      sentence:
        - **Senses that are not the thing being renamed.** *credit card* (the sign-up guides),
          *Partner Card* (a deliverable), *printed card* (a physical card for the back of the
          device), *review card* (a summary screen) and *context card* (a display of what the
          system last said). Ken named the first two; the other three were found by listing the
          word before every hit and had to be excluded on the same grounds. **Applying his word
          where it would be FALSE is what the stop-and-ask rule forbids.**
        - **The compound that doubles.** *response card* -> *response option*, never *response
          response option*. 32 of them.
        - **⚠ A HYPHEN IS A WORD BOUNDARY, so `\bcard\b` matches inside *four-card* and leaves
          *four-response option* - a hyphen followed by a space.** Ten broke this way
          (*four-card*, *on-card*, *from-a-card*, *choice-card*, *cards-per-category*,
          *cards-shown*) and each needed its own wording. **This is the word-boundary trap from
          bug 15 wearing a different hat: `\b` was used and was still not enough.**
        - **Case in a heading.** *The Response Card* became *The response option* until the title
          case was restored by hand.
        - **Contents listings.** The new word is longer, so page numbers moved in the three
          manuals and `update-toc.ps1` had to run afterwards.
        - **Check the result by listing every distinct change**, not by reading. All ten broken
          compounds surfaced from a word-level diff against the backups, grouped and counted. The Conversation Review called the same thing a *rehearsal* seven times and a *practice conversation* eight, twice in one paragraph. A reader who meets both reasonably wonders what the difference is, so a flourish aimed at avoiding repetition costs them a real question. **Pick the app's own word and keep it.** **The cure for a word repeating is a pronoun or a shorter sentence, never a second word**: *"The app already saves one with its scenario name."*
19. **The pseudo-cleft: *What X means is…*** *"What a tap means comes from what the user does next"* → **"The user's next action decides what a tap means."** It front-loads an abstract noun phrase and makes the reader hold it until the verb arrives. Name the actor and let the sentence start moving.
20. **The trailing clause that comments instead of continuing.** *"…in a quiet moment, which is what Settings is for."* The clause adds no fact; it stands back and approves of the sentence just finished. **The test: does it carry information, or a verdict?** *"which keeps the record honest"* and *"which nothing else on the screen can do"* both carry information and stay.
21. **The corrective *X, not Y* used for cadence.** It earns its place when it heads off a misreading the reader would plausibly have — *"four different kinds of reply, not a best-to-worst list"*. It is decoration when nothing was about to be misread, and it turns into a slogan when it goes imperative: *"offer, never just do it"* → **"The app offers and never simply acts."** Count them before defending one; eleven in a short document is a tic, whatever each is doing.
22. **The same fact twice.** *“the most personal material review collects”* appeared twice, four pages apart. **“State a fact once” applies across the whole document, not within a paragraph — and it includes the very next sentence, which is bug 23.**
23. **The invented example** (Ken, September 26 2026). A made-up person doing a made-up thing, put in to illustrate a fact the sentence before it already stated. *“The user can stop and pick up again at any turn. Someone who works through four turns of a long conversation and puts the tablet down comes back to the fifth.”* The second sentence carries no fact, and its specifics — four turns, a long conversation, the tablet going down — make the reader stop and work out whether any of them matter. **The test is mechanical: delete the sentence and see whether a fact goes with it.**
    - *Search:* a sentence opening `Someone who`, `A user who`, `Anyone who`, `A person who`, `Imagine`, `Picture the`, `Say the user`, `Suppose`. The scanner reports these.
    - **⚠ A REAL EXAMPLE IS NOT THIS BUG, and the two look alike.** *“Someone typed the same sentence three times last week”* opens the same way and stays, because it carries the fact — it is what repeated effort looks like — and nothing else in the document says it. **The question is whether the fact is already on the page, not whether the sentence has a person in it.**

**What 16–21 and 23 have in common, and it is the thing to watch for rather than any single pattern: they are ways of making an ordinary sentence sound composed.** None uses a hard word, so the plain-language rule never catches them, and each survives every check we have.

---

## Not bugs

Checked on September 25 2026 against the Conversation Review and found clean or
harmless. **Recorded so they are not chased again.**

- **Short sentences and verbless fragments.** A search for them returns figure captions,
  table cells (*"Never."*) and good short sentences (*"Only the job changes."*). Short is
  the goal, not the fault.
- **Paired verbs that look like near-synonyms** — *"change it quickly and send it as a
  file"*, *"simpler to build and to explain"*. Two different things, not padding.
- **"There is / there are" openers.** None. The rule in CLAUDE.md is holding.
- **Litotes**, **inversion for emphasis** (*"Only they know that"*), **stacked hyphen
  modifiers** (*"one-word-at-a-time editing"*), and **noun-of-noun for a verb** (*"the
  wording of the declining option"*). All plain English here.
- **Nothing in bugs 11–13 belongs in `essayisms`.** That list's bar is that a phrase has
  **no** innocent use. *At all* has one (*"how often anyone used review at all"*), so does
  a sentence-initial *So* now and then, and *worth* in *worth knowing*.
- **A subject that runs past a dozen words before its verb** (tried September 26 2026 as a
  handle for bug 23, and dropped). It returned 62 candidates in a 6,000-word document,
  nearly all of them ordinary sentences — the noise level that teaches people to scroll
  past a check. Long sentences are already reported by `check docs` rule L12.

---

## The backlog is real

As of September 25 2026 `check docs` reports roughly 100 banned phrases, 700 long sentences
and 200 headings across the documents. **Clear them as each document is next touched, not
in one sweep.** The same applies to this list.

**⚠ THIS FILE IS DELIBERATELY NOT SCANNED FOR BRITISH VOCABULARY**, the same exemption `tests/american-spelling.test.mjs` gives CLAUDE.md and for the same reason: bug 10 quotes *had got, somebody, whilst* as examples of what to avoid, so scanning it would be mostly self-reference, and **a check that is always red is one people learn to scroll past.** If a genuine British word ever lands here outside a quoted example, nothing will catch it.

**A clean run proves little.** The Conversation Review passed all five `check docs` rules on
the morning Ken gave up reading it.
