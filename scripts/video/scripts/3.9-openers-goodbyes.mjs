// How-to video 3.9: your own openers and goodbyes.
//
// STAGED, then a real tap on Start conversation to show the changed opener
// offered first.

import { settingsTab, section, replaceText, card } from '../helpers.mjs';

const openers = section('Openers (Start conversation)');
const firstOpener = '::-p-xpath((//details[.//summary[contains(normalize-space(.),"Openers (Start conversation)")]]//input[@placeholder="Response option text"])[1])';
const insertName = '::-p-xpath((//details[.//summary[contains(normalize-space(.),"Openers (Start conversation)")]]//button[normalize-space(.)="Insert: Their name"])[1])';
const addOpener = '::-p-xpath((//details[.//summary[contains(normalize-space(.),"Openers (Start conversation)")]]//button[normalize-space(.)="+ Add"])[1])';

export default {
  id: '3.9-openers-goodbyes',
  title: 'Your Own Openers and Goodbyes',
  trouble: [
    "A phrase you delete doesn't come back on its own. To get one back, type it in again with + Add.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "The Command Bar buttons say phrases from lists you can change: the ways you open a conversation, wrap one up, and say goodbye." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('commands'), press: true,
      page: "In Settings, open Commands.",
      say: "then Commands." },
    { speaker: 'narrator', highlight: openers, press: true,
      say: "Each section is the list behind one button. Openers is the list behind Start conversation." },
    { speaker: 'narrator', waitFor: firstOpener, before: (p) => replaceText(p, firstOpener, "Hey, what's up?"), highlight: firstOpener,
      page: "Each line is one phrase. Tap a line and type your own words.",
      say: "Each line is one phrase. Tap a line, and type your own words. The ones at the top are offered first." },
    { speaker: 'narrator', highlight: insertName,
      page: "Insert: Their name adds the name of the person you're talking with.",
      say: "Insert: Their name adds the name of whoever you're talking with, when you've told Conversant who that is." },
    { speaker: 'narrator', highlight: addOpener,
      page: "+ Add makes a new line.",
      say: "And + Add makes a new line." },
    { speaker: 'narrator', highlight: section('Closings (goodbyes)'),
      say: "Wrap-up phrases and goodbyes work the same way, in their own sections." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Changes are saved as you type. Close Settings," },
    { speaker: 'narrator', highlight: '#initiateBtn', press: true,
      say: "and tap Start conversation." },
    { speaker: 'narrator', waitFor: card(1) + ' .response-text', highlight: card(1),
      page: "Your phrases are offered the next time you tap the button.",
      say: "Marc's new opener is offered first. {next}" },
  ],
};
