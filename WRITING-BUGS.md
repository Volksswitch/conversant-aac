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

2. **Read the document against the list.** The scanner is a starting point and misses most
   of what matters.

3. **The one test that finds all of them**, and it is Ken's: *say the sentence out loud the
   way you would say it to somebody.* If a plain version arrives instantly and sounds
   nothing like what is on the page, the writing was performing.

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
13. **Defensive tags: *anyway, at all, though, still, of course, after all*.** One word tacked onto a clause to fend off an objection nobody raised — *"this layout has no room for a box anyway"*, *"the phrase panel appears in review at all"*. Bug 6 in a form you can search for.
14. **An absence handed the sentence when a real actor was standing right there** (Ken, September 25 2026). *"and nothing tells us why"* → **"and we don't know why."** *"nothing checks whether a suggestion suits the turn"* → **"the app doesn't check whether…"** Personifying an absence borrows weight that naming the actor doesn't need. **Ask who or what actually does the thing, and put them first.**
    - **It is not a ban on *nothing*.** *"Nothing changes without confirmation"* and *"Nothing is at stake in a practice conversation"* are plain and stay. The test is whether a person, or the app, was available to be the subject.
15. **Formality** (Ken, September 25 2026: *"'did not' is a more formal version of 'didn't'. Seek to be less formal"*). **Contract the negations** — *doesn't, didn't, don't, isn't, aren't, can't, won't, wouldn't, couldn't, shouldn't, hasn't, haven't, weren't* — and the ordinary pronoun pairs, *it's, that's, they're, what's*. Headings included: *"What Review Isn't"*, *"What Review Can't Do"*.
    - **Leave *must not* and *may not* alone.** *Mustn't* and *mayn't* are not how an American speaks, so contracting them trades formality for a British register (bug 10).
    - **⚠ THREE CONSTRUCTIONS MATCH A NAIVE SWEEP AND MUST NOT BE TOUCHED**, because the words are not a pronoun and its verb: a relative pronoun (*"a button that is no longer on the panel"*), a verb phrase as subject (*"Hearing it is how the user judges"*, *"refusing to offer it is right"*), and a prepositional object (*"The argument for it is that the clock is off"*). Do the negations by rule and the pronoun pairs by a list you have read in context.
    - **⚠ AND THE ONE THAT LOOKS RIGHT ON SCREEN AND IS WRONG IN THE FILE: use the typographic apostrophe ’, not '.** These documents are curly throughout, so 74 straight ones went in beside *user’s* and *person’s* and nothing reported it.
16. **The unusual construction where an ordinary one exists — it reads as reaching for tone** (Ken, September 25 2026, on *"Nothing else needs learning"*: *"cumbersome in a way that tries to sound erudite"*). In plain speech that is *"you don't need to know anything else."* The words are all ordinary; the **grammar** is the affectation, which is why this survives every check and every read for jargon.
    - **The shapes it takes.** *need / want / bear* + a gerund (*"needs learning"*, *"may need revisiting"*); *do the* + a gerund (*"a supporter does the reviewing"*); a gerund or a *neither…nor* pair as the subject (*"Neither trusting it nor quietly refusing to offer it is right"*); comparing two gerunds (*"separates knowing that transcription struggles from knowing which sounds it struggles with"*); a fronted participle (*"Played at real speed, …"*); an abstract stand-in (*"anything of that shape"*); a formal verb where a common one exists (*conveys* for *shows*). One sentence carried two: *"It may need revisiting … where a supporter does the reviewing with them."*
    - **⚠ THE FIRST ANSWER TO THIS ONE WAS WRONG AND THE MISTAKE IS EASY TO REPEAT.** Asked what was wrong with the sentence, I said it was a reassurance about the reader's experience dressed as a fact. True, and beside the point — **the fault was in the grammar, not the claim**, and I went looking in the argument because bugs 1–14 are all about arguments. **When a sentence reads badly, check how it is built before deciding what it is trying to do.**
17. **The colon as a drumroll.** A colon before a **list** is punctuation and is fine — *"it came from one of four places: a suggestion, a phrase, …"*. A colon before a **clause** promises a reveal the clause never earns: *"What this gives up: the user can't fix a single letter"*. **Use a period.** Both halves stand up as sentences, which is the proof the colon was decoration.
18. **Two words for one thing.** The Conversation Review called the same thing a *rehearsal* seven times and a *practice conversation* eight, twice in one paragraph. A reader who meets both reasonably wonders what the difference is, so a flourish aimed at avoiding repetition costs them a real question. **Pick the app's own word and keep it.** **The cure for a word repeating is a pronoun or a shorter sentence, never a second word**: *"The app already saves one with its scenario name."*
19. **The pseudo-cleft: *What X means is…*** *"What a tap means comes from what the user does next"* → **"The user's next action decides what a tap means."** It front-loads an abstract noun phrase and makes the reader hold it until the verb arrives. Name the actor and let the sentence start moving.
20. **The trailing clause that comments instead of continuing.** *"…in a quiet moment, which is what Settings is for."* The clause adds no fact; it stands back and approves of the sentence just finished. **The test: does it carry information, or a verdict?** *"which keeps the record honest"* and *"which nothing else on the screen can do"* both carry information and stay.
21. **The corrective *X, not Y* used for cadence.** It earns its place when it heads off a misreading the reader would plausibly have — *"four different kinds of reply, not a best-to-worst list"*. It is decoration when nothing was about to be misread, and it turns into a slogan when it goes imperative: *"offer, never just do it"* → **"The app offers and never simply acts."** Count them before defending one; eleven in a short document is a tic, whatever each is doing.
22. **The same fact in two sections.** *"the most personal material review collects"* appeared twice, four pages apart. **"State a fact once" applies across the whole document, not within a paragraph.**

**What 16–21 have in common, and it is the thing to watch for rather than any single pattern: they are ways of making an ordinary sentence sound composed.** None uses a hard word, so the plain-language rule never catches them, and each survives every check we have.

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

---

## The backlog is real

As of September 25 2026 `check docs` reports roughly 100 banned phrases, 700 long sentences
and 200 headings across the documents. **Clear them as each document is next touched, not
in one sweep.** The same applies to this list.

**⚠ THIS FILE IS DELIBERATELY NOT SCANNED FOR BRITISH VOCABULARY**, the same exemption `tests/american-spelling.test.mjs` gives CLAUDE.md and for the same reason: bug 10 quotes *had got, somebody, whilst* as examples of what to avoid, so scanning it would be mostly self-reference, and **a check that is always red is one people learn to scroll past.** If a genuine British word ever lands here outside a quoted example, nothing will catch it.

**A clean run proves little.** The Conversation Review passed all five `check docs` rules on
the morning Ken gave up reading it.
