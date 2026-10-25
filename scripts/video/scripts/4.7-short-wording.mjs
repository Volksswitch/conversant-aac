// How-to video 4.7: the short wording on response options.
//
// STAGED: a set of options is drawn on screen first, so each choice of
// "What a response option shows" can be seen on real content.

import { settingsTab, section, choose } from '../helpers.mjs';

const stage = (page) => page.evaluate(async () => {
  const ui = await import('/js/ui.js');
  ui.renderConversation([{ role: 'partner', text: 'Hey Marc, are you coming to the game on Saturday?' }]);
  ui.showResponses([
    { slot: 'PREFERRED', text: "Yeah, I'll be there! Want to sit together?", hint: "I'll be there" },
    { slot: 'DISPREFERRED', text: "I wish I could, but I've got plans.", hint: 'Got plans' },
    { slot: 'INITIATIVE', text: 'Maybe! Who else is going?', hint: 'Who else?' },
    { slot: 'REPAIR', text: 'Sorry, which game?', hint: 'Which game?' },
  ], () => {});
});

// Settings, Conversation, then one choice in the list. Response suggestions
// is still open from the first visit: Settings remembers that within a session.
const pick = (words) => [
  { speaker: 'narrator', highlight: '#settingsBtn', press: true, say: 'Open Settings again,' },
  { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('conversation'), press: true,
    say: 'Conversation,' },
  { speaker: 'narrator', waitFor: '#cardTextModeInput', before: (p) => choose(p, '#cardTextModeInput', words),
    highlight: '#cardTextModeInput', say: `and choose ${words}.` },
  { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true, say: 'Close Settings.' },
];

export default {
  id: '4.7-short-wording',
  title: 'Short Wording on Your Options',
  trouble: [
    "Some options, like your openers and goodbyes, have no short version. They always show their full words, so an option is never blank.",
    "Each version has its own text size, in Settings, Text and Color, Text size.",
  ],
  steps: [
    { speaker: 'narrator', before: stage, highlight: '#responseOptions',
      page: 'Each option shows the full response, and a short version of it.',
      say: "Each option shows two things: the full response, which is what Conversant says out loud, and a short version of it, a few words that are quicker to read." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "You choose which one stands out. Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('conversation'), press: true,
      say: "then Conversation," },
    { speaker: 'narrator', highlight: section('Response suggestions'), press: true,
      say: "and Response suggestions." },
    { speaker: 'narrator', waitFor: '#cardTextModeInput', before: (p) => choose(p, '#cardTextModeInput', 'Both — short version larger'),
      highlight: '#cardTextModeInput',
      page: 'In Settings, Conversation, Response suggestions, choose what a response option shows.',
      say: "What a response option shows has four choices. Marc picks Both, short version larger." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings," },
    { speaker: 'narrator', highlight: '#responseOptions',
      page: 'Short version larger: your eye lands on the few words first.',
      say: "and now the short words are big. Your eye lands on them first, so you can take in all four options at a glance, and still read the whole sentence below if you want to." },
    ...pick('The short version'),
    { speaker: 'narrator', highlight: '#responseOptions',
      page: 'Short version only: the fewest words to read. Tapping still says the full response.',
      say: "Now there's only the short version, the fewest words to read. Tapping an option still says the full response." },
    { speaker: 'narrator', highlight: '#responseOptions',
      page: 'Change it any time, even in a conversation. The options already showing change right away.',
      say: "You can change this any time, even in the middle of a conversation. The options already on screen change right away, so try each choice and keep the one that's quickest for you. {next}" },
  ],
};
