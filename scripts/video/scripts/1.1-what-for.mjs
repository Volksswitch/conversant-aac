// How-to video 1.1: what Conversant is for.
//
// STAGED: the conversation is drawn with the app's own screen code, as in the
// screen tour, with fixed words.

import { card, ownWordsBtn } from '../helpers.mjs';

const PARTNER = "Hey Marc, are you coming to the game on Saturday?";
const OPTIONS = [
  { slot: 'PREFERRED', text: "Yeah, I'll be there! Want to sit together?", hint: "I'll be there" },
  { slot: 'DISPREFERRED', text: "I wish I could, but I've got plans with my family.", hint: 'Family plans' },
  { slot: 'INITIATIVE', text: 'Maybe! Who else is going?', hint: 'Who else?' },
  { slot: 'REPAIR', text: 'Sorry, which game?', hint: 'Which game?' },
];

const showPartner = (page) => page.evaluate(async (line) => {
  const ui = await import('/js/ui.js');
  ui.renderConversation([{ role: 'partner', text: line }]);
}, PARTNER);
const showOptions = (page) => page.evaluate(async (opts) => {
  const ui = await import('/js/ui.js');
  ui.showResponses(opts, () => {});
}, OPTIONS);
const userSpeaks = (page) => page.evaluate(async (line, said) => {
  const ui = await import('/js/ui.js');
  ui.renderConversation([{ role: 'partner', text: line }, { role: 'user', text: said }]);
  ui.clearResponseOptions();
}, PARTNER, OPTIONS[0].text);

export default {
  id: '1.1-what-for',
  title: 'What Conversant Is For',
  steps: [
    { speaker: 'narrator',
      say: "Conversant helps you take part in conversations as they happen." },
    { speaker: 'narrator',
      say: "In a conversation, people expect an answer within a few seconds. If the answer takes too long, the conversation moves on without you. Conversant is built to close that gap." },
    { speaker: 'partner', before: showPartner, highlight: '#transcriptSection',
      page: "Conversant listens to the other person and writes down what they said.",
      say: PARTNER },
    { speaker: 'narrator', before: showOptions, highlight: '#responseOptions',
      page: "It writes four replies you might want to say: different kinds of answer, so you have real choices.",
      say: "Conversant listens to the other person, and writes four replies you might want to say. Each is a different kind of answer, so you have real choices." },
    { speaker: 'narrator', tap: card(1),
      page: "You tap the one you want, and Conversant says it in your voice.",
      say: "You tap the one you want, and Conversant says it in your voice." },
    { speaker: 'user', before: userSpeaks, say: OPTIONS[0].text },
    { speaker: 'narrator',
      say: "Nothing is ever said until you tap it. The words are always your choice." },
    { speaker: 'narrator', highlight: ownWordsBtn,
      page: "When none of them fit, you can type exactly what you want to say.",
      say: "And when none of them fit, you can type exactly what you want to say." },
    { speaker: 'narrator', highlight: '#settingsBtn',
      page: "The more you tell Conversant about yourself, in Settings, the more its suggestions sound like you.",
      say: "The more you tell Conversant about yourself, the more its suggestions sound like you." },
    { speaker: 'narrator',
      say: "Next, let's get Conversant set up on your device." },
  ],
};
