// How-to video 3.1: About Me, a few answers go a long way.
//
// STAGED: the real About Me screens, answered by real taps and typing.

import { settingsTab, typeInto } from '../helpers.mjs';

// A question's card, its text box, and its buttons, found by the question's words.
const q = (words) => `//div[contains(@class,"wv-card")][.//*[contains(text(),${JSON.stringify(words)})]]`;
const card = (words) => `::-p-xpath(${q(words)})`;
const box = (words) => `::-p-xpath(${q(words)}//input)`;
const btn = (words, label) => `::-p-xpath(${q(words)}//button[normalize-space(text())=${JSON.stringify(label)}])`;
const topic = (name) => `::-p-xpath(//button[contains(@class,"wv-module-row")][.//*[normalize-space(text())=${JSON.stringify(name)}]])`;

export default {
  id: '3.1-about-me',
  title: 'About Me: A Few Answers Go a Long Way',
  trouble: [
    "A message says your answers are saved only in this browser: choose a data folder, so they're kept in a file you can back up. See video 1.4.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant writes better options when it knows a little about you: your name, where you live, the things you love. That's what About Me is for." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('aboutme'), press: true,
      page: "Open Settings, then About Me.",
      say: "then About Me." },
    { speaker: 'narrator', waitFor: '.wv-module-row', highlight: topic('About You'),
      page: "Questions are grouped into topics. Nothing is required, and a few answers make a real difference.",
      say: "The questions are grouped into topics. Nothing here is required, and you can stop whenever you like. Even a few answers make a real difference. Let's start with About You." },
    { speaker: 'narrator', highlight: topic('About You'), press: true,
      say: "Tap a topic to open it." },
    { speaker: 'narrator', waitFor: box('What name would you like'),
      before: (p) => typeInto(p, box('What name would you like'), 'Marc'),
      highlight: box('What name would you like'),
      say: "Type your answer," },
    { speaker: 'narrator', highlight: btn('What name would you like', 'Save'), press: true,
      page: "Type your answer, and tap Save.",
      say: "and tap Save." },
    { speaker: 'narrator', waitFor: card('What name would you like') + ' ::-p-text(Answered)', highlight: card('What name would you like'),
      say: "It's saved. You can change it any time." },
    { speaker: 'narrator', highlight: btn('How old are you', 'Prefer not to say'),
      page: "If you'd rather not answer a question, tap Prefer not to say.",
      say: "If you'd rather not answer a question, tap Prefer not to say. Conversant won't ask it again, and won't guess at the answer." },
    { speaker: 'narrator', highlight: '.wv-back', press: true,
      say: "Go back to the list of topics." },
    { speaker: 'narrator', waitFor: topic('About You'), highlight: topic('About You'),
      page: "Each topic shows how many questions you've answered.",
      say: "Each topic shows how many questions you've answered." },
    { speaker: 'narrator', highlight: topic('Health & Safety 🔒'),
      page: "Topics with a lock are private. Conversant only brings them up if the other person asks, or you ask it to.",
      say: "Topics with a lock are private. Conversant knows the answers, but only brings them up if the other person asks, or if you ask it to." },
    { speaker: 'narrator',
      say: "Good places to start are About You, Where You Are, and Favorites. {next}" },
  ],
};
