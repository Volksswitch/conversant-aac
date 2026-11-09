PIN — where the question-session work stands (November 9 2026). Paste this to resume.

We're building the question-session mode: the user takes audience questions and Conversant offers four answers drawn from documents the user chose. It is BUILT and working, committed locally on `main`, NOT pushed. Ken has just asked to REWORK HOW IT IS SWITCHED ON (see "Open now" below), so do not build anything until that is decided.

Read first:
1. The CLAUDE.md section "Question sessions after a talk" - every decision and what is built.
2. `Documents/Conversant AAC Question Sessions Design.docx` (updated November 9 2026).
3. This file.

Commits so far (oldest first): 7503920 answer request + documents folder + PDF reading; 6943af4 talk set up on its place; 2638461 the mode itself; acfe7a1 clarifying buttons; 51aafe0 pause and continue; 6f8c92b word check and rewrite.

What is built (all of it currently hangs off a PLACE):
- My Places -> a place -> "Questions after a talk": switch on, tick documents (PDF via Mozilla's PDF reader in app/vendor/pdfjs, or pasted text; kept once in the data folder's `sources` folder), the note on how the presenter relates to the material, and an audience chosen from People. Stored as `place.talk = { on, sources, note, audienceId }` (places.js).
- Tapping that place on the Express Panel turns the mode on: each question gets four answers (short first, green; three deeper, blue), `generateTalkAnswers` in app.js, prompt in app/js/question-session.js (the tested prototype, word for word).
- Answers stay up after one is spoken; Listen clears them; no automatic listening at a talk (`autoResumeOn()`).
- New 4 and Reframe work on the same question.
- "What do you mean by X?" buttons at the end of the Flex band; a tap reopens the microphone and the explanation is answered with the original question.
- A tap pauses an answer; another continues from the start of the interrupted sentence. Answers are spoken a sentence at a time, the next fetched ahead (`tts.prepare`).
- A word check on each answer (`qs.answerSlips`), and a background rewrite of any it flags (`llm.rewriteAnswer`).
- Checks: `npm test` (1,455 pass) and `node scripts/qa-session-eval/browser-check.mjs` (43 checks, the real app in a headless browser with a stand-in AI and microphone). Run both after any change to this path.

Open now:
1. **REDESIGN DECIDED AND BUILT (November 9 2026), see CLAUDE.md: a TOPIC is its own Context-band dimension (documents + note), replacing `place.talk`; the AUDIENCE is a group entry in the "who" (partner) dimension.** Full reasoning in CLAUDE.md. Still to ask Ken, one at a time: (a) DECIDED: each topic has its own Flex list, looked up first, standing alone; (b) DECIDED: a topic switches off at End conversation, like a partner; (c) DECIDED: a topic means taking questions only; "talking about it" is a separate future project (TODO.md). The topic rebuild is IN PROGRESS: see the task list in the conversation, or CLAUDE.md for the decisions.
2. Stressing "as" and "for" in the tagline: Claude recommended trying the existing "Words the voice gets wrong" list first (entry: "as the user, not for them" -> "AS the user, not FOR them"; checked to change only that exact phrase). Awaiting Ken.

How to work (unchanged):
- One question at a time, with a recommendation, before building the parts a decision touches. Put options in the reply as plain text, never in the question widget.
- Small steps that each leave the app working. Record decisions in CLAUDE.md, update the design document (back it up first), add user-visible changes to CHANGELOG.md under Unreleased, commit locally. Don't push.
- Plain language for Ken.
