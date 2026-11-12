// How-to video 2.8: when they didn't catch what you said.
//
// LIVE. The friend asks Marc to say it again, which switches the response
// options to the four ways of trying again: his exact words, two reworded
// versions, and "Sorry, let me try that again", which opens the Composition
// window with his words already in it. Made because that last one surprised
// Ken in his own testing (problem report, November 11 2026).

import { card, cardSays, onScreen, hear, lastSpoken, markSpoken, untilNewSpeech } from '../helpers.mjs';

const P1 = "Want to grab dinner on Saturday?";
const REPLY = "Sure! How about the Thai place on Fifth?";
const P2 = "Sorry, the what? It's really loud in here.";
const REPHRASE = "Let's go to the Thai restaurant on Fifth.";
const EXPAND = "How about the Thai restaurant on Fifth Street, near the library?";
const FIXED = "Sure! How about the Thai place on Fifth Street?";

export default {
  id: '2.8-didnt-catch',
  title: "When They Didn't Catch What You Said",
  settings: { maxPlaceholders: 0 },
  ai: {
    responseSets: [
      { responses: [
        { slot: 'PREFERRED', text: REPLY, hint: 'Thai on Fifth?' },
        { slot: 'DISPREFERRED', text: "I'd love to, but Saturday's packed for me.", hint: "Saturday's packed" },
        { slot: 'INITIATIVE', text: 'Sure! Where were you thinking?', hint: 'Where?' },
        { slot: 'REPAIR', text: 'Sorry, which day?', hint: 'Which day?' },
      ] },
      // The friend asks him to say it again. The app replaces the options with
      // the four ways of trying again, so these four are never shown.
      { repairInitiator: true, responses: [
        { slot: 'PREFERRED', text: REPLY, hint: 'Thai on Fifth' },
        { slot: 'DISPREFERRED', text: 'Never mind.', hint: 'Never mind' },
        { slot: 'INITIATIVE', text: 'Want to go somewhere quieter?', hint: 'Somewhere quieter?' },
        { slot: 'REPAIR', text: 'Sorry, what?', hint: 'What?' },
      ] },
    ],
    repairSets: [
      { rephrase: REPHRASE, expand: EXPAND, guessed: false },
    ],
  },
  trouble: [
    "An option marked \"My best guess\" means Conversant wasn't sure what you meant. Read it before you tap it.",
    "To change the words of the \"let me try that again\" option, go to Settings, Commands.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Sometimes the other person doesn't catch what you said. Conversant helps you try again." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "Marc taps Listen, and his friend asks about the weekend." },
    { speaker: 'partner', before: (p) => hear(p, P1), waitFor: card(1) + ' .response-text', say: P1 },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Marc picks this one." },
    { speaker: 'user', waitFor: onScreen(REPLY), say: REPLY },
    // After a tapped option the app leaves listening off (see 2.5), so Listen
    // is tapped here only if it is off.
    { speaker: 'narrator', highlight: '#listenBtn',
      before: async (p) => {
        await new Promise((r) => setTimeout(r, 1200));
        const on = await p.evaluate(() => document.getElementById('listenBtn').classList.contains('listening'));
        if (!on) await p.click('#listenBtn');
      },
      say: "Then he listens for the answer." },
    { speaker: 'partner', before: (p) => hear(p, P2), waitFor: cardSays(2, REPHRASE), say: P2 },
    { speaker: 'narrator', highlight: '#responseOptions',
      page: "When they ask you to say it again, the options change to four ways to try again.",
      say: "His friend didn't catch it. Conversant notices, and the options change to four ways to try again." },
    { speaker: 'narrator', highlight: card(1),
      page: "This one says your exact words again.",
      say: "This one says Marc's exact words again. That's the one to pick when it was just too noisy." },
    { speaker: 'narrator', highlight: card(2),
      page: "These two say the same thing in other words. The second adds a little more.",
      say: "This one says the same thing in other words," },
    { speaker: 'narrator', highlight: card(3),
      say: "and this one adds a little more, to make it clearer." },
    { speaker: 'narrator', highlight: card(4),
      page: "This one says you're going to try again, then opens the box for your own words with what you said already in it.",
      say: "This last one tells them Marc is going to try again. Then it opens the box for his own words, with what he said already in it." },
    { speaker: 'narrator', tap: card(4), press: true, before: markSpoken,
      say: "Marc wants to say exactly which street, so he picks it." },
    { speaker: 'user', until: untilNewSpeech, say: lastSpoken },
    { speaker: 'narrator', waitFor: '#composerInput', highlight: '#composerInput',
      before: async (p) => {
        await p.focus('#composerInput');
        await p.keyboard.press('End');
        await p.keyboard.press('ArrowLeft');
        await p.keyboard.type(' Street', { delay: 40 });
      },
      page: "Change what you need to. You don't have to type it all again.",
      say: "Here's what he said, ready to change. He only has to add one word." },
    { speaker: 'narrator', highlight: '#speakBtn', press: true,
      page: "Tap Speak to say it.",
      say: "Then he taps Speak." },
    { speaker: 'user', waitFor: onScreen(FIXED), say: FIXED },
    { speaker: 'narrator',
      say: "So when they didn't catch it, you can say it again, say it another way, or fix it first. That's the end of the first conversations. {next}" },
  ],
};
