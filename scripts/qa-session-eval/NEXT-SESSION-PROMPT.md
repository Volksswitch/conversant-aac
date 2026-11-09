We're building the question-session mode: the user gives a talk, takes audience questions, and Conversant offers four answers drawn from material the user chose for that talk. Nothing is built yet.

Read these first, in this order:
1. `Documents/Conversant AAC Question Sessions Design.docx`. This is the design, updated November 8 2026.
2. The CLAUDE.md section "Question sessions after a talk", especially the DECIDED list from November 8 2026.
3. The TODO.md entry "Question sessions after a talk: open items from the November 8 2026 test".
4. `scripts/qa-session-eval/run.mjs`. Its INSTRUCTIONS block is the tested prototype prompt. Reuse it; don't rewrite it from scratch. `2026-11-08/results.md` shows what it produces.

What's decided:
- **Turning it on:** a place (such as "At my talk") switches the mode on and carries the talk's material. The audience's style comes from a People entry ("SLPs at my talk") switched on with it.
- **Four answers, always:** this ignores the two-per-category setting. The short answer comes first and sums up the other three; the next three go deeper on different parts.
- **Short labels are suggested, not forced:** the mode suggests showing only short labels, but the user's "What a response card shows" setting still decides.
- **Answers stay on screen after one is spoken**, so the user can go deeper. They are cleared when Listen is tapped for the next question, and auto-resume listening is off in this mode.
- **The rules in the prototype prompt**, with no attempt to imitate the user's voice: content only from the material; "I don't know, and I haven't thought about it very much"; say which part of a question can't be answered; correct wrong assumptions; never comment on honesty; never claim to know the audience's work; don't repeat a point already spoken in the session; plain American English.
- **Clarifying buttons:** the AI returns `unclear_words`, which become "What do you mean by X?" buttons. They are offered only for words too vague to answer without asking.

Still open. Ask me about these before building the parts they touch, one question at a time, with your recommendation:
- Pronouns: I'll give you examples of when an answer should say "my" and when "I".
- Where the clarifying buttons go: probably the Flex band, since they speak.
- How the user stops an answer partway through.
- How the material is added on a computer and stored with the place, and how it reaches an iPad (data folder or backup).
- Stressing "as" and "for" in the project's tagline when a paid voice speaks it.
- A check on each answer after it is written. The AI still slips now and then; `scripts/qa-session-eval/british-check.mjs` is a start.

How to work:
- Start by laying out a build plan in small steps that each leave the app working. Tell me which steps need my decisions.
- Put the prompt behind the provider seam (`suggest-provider.js`), with the material in the cached part of the request, as `generateResponses` does.
- The change crosses layers (place, prompt, palette, Listen behavior), so include at least one check that runs the real chain end to end, and in the browser where `app.js` can't be tested.
- Record decisions in CLAUDE.md, update the design document when something changes, add user-visible changes to CHANGELOG.md, and commit locally. Don't push.
- Write to me in plain language; I'm not a programmer.
