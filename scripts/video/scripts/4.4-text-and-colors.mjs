// How-to video 4.4: text size and colors.
//
// STAGED: a conversation is drawn on screen first, so changes to colors and text
// size can be seen on real content.

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

export default {
  id: '4.4-text-and-colors',
  title: 'Text Size and Colors',
  trouble: [
    "Hard to tell the four kinds of option apart by color? Try Color-blind safe, which also marks each kind with a different edge.",
  ],
  steps: [
    { speaker: 'narrator', before: stage,
      say: "If the screen is hard to read, you can change its colors and the size of its text." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('textsize'), press: true,
      say: "then Text and Color," },
    { speaker: 'narrator', highlight: section('Colors'), press: true,
      say: "and Colors." },
    { speaker: 'narrator', waitFor: '#colorSchemeInput', before: (p) => choose(p, '#colorSchemeInput', 'Dark'), highlight: '#colorSchemeInput',
      page: "In Settings, Text and Color, choose a color scheme.",
      say: "Choose a color scheme. There are schemes with bolder outlines, higher contrast, dark backgrounds, yellow on black, and one made for color blindness. Marc tries Dark." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings to see it." },
    { speaker: 'narrator', highlight: '#responsesSection',
      page: "The whole screen changes to the scheme you chose.",
      say: "The whole screen changes. Nothing moves; only the colors change." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Now the text. Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('textsize'), press: true,
      say: "Text and Color," },
    { speaker: 'narrator', highlight: section('Text size'), press: true,
      say: "and Text size." },
    { speaker: 'narrator', waitFor: '#responseFontSelect', before: (p) => choose(p, '#responseFontSelect', 'Largest'), highlight: '#responseFontSelect',
      page: "Under Text size, each part of the screen has its own size.",
      say: "Each part of the screen has its own size: the options, the conversation, the Express Panel, and more. Marc makes the options Largest." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings," },
    { speaker: 'narrator', highlight: '#responsesSection',
      say: "and the options' words are bigger. {next}" },
  ],
};
