// How-to video 4.3: one tap or two.
//
// STAGED, then a real double tap on an Express Panel button, which speaks.

import { settingsTab, section, panelButton, markSpoken, untilNewSpeech, lastSpoken } from '../helpers.mjs';

const radio = (words) => `::-p-xpath(//dialog[@open]//label[contains(normalize-space(.),${JSON.stringify(words)})])`;
const doubleTap = async (page, selector) => {
  await page.click(selector);
  await new Promise((r) => setTimeout(r, 150));
  await page.click(selector);
};

export default {
  id: '4.3-one-tap-or-two',
  title: 'One Tap or Two',
  trouble: [
    "Your second tap often comes too late? Choose a longer Time allowed between the two taps.",
    "Use eye gaze? Leave this on One tap, and let your eye-gaze software's dwell time guard against mistakes.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "A stray touch can make Conversant say something you didn't mean. If that happens to you, you can ask for two taps." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('general'), press: true,
      say: "General," },
    { speaker: 'narrator', highlight: section('One tap or two'), press: true,
      say: "and One tap or two." },
    { speaker: 'narrator', highlight: radio('Two taps'), press: true,
      page: "In Settings, General, One tap or two, choose Two taps.",
      say: "Choose Two taps." },
    { speaker: 'narrator', highlight: '#doubleTapMsSelect',
      page: "Choose how much time you have between the two taps.",
      say: "Then choose how much time you have between the two taps." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings." },
    { speaker: 'narrator', tap: panelButton('Hi'), before: markSpoken,
      page: "Now a button needs two quick taps. One tap alone does nothing.",
      say: "Now one tap on a button does nothing. Tap it twice, quickly," },
    { speaker: 'user', before: (p) => doubleTap(p, panelButton('Hi')), until: untilNewSpeech, say: lastSpoken },
    { speaker: 'narrator', highlight: '#listenControls',
      page: "It works for every button that speaks or changes the screen. Settings still takes one tap.",
      say: "and it speaks. Two taps work the same way for every button that speaks or changes the screen, including the Command Bar. Inside Settings, one tap is still enough. {next}" },
  ],
};
