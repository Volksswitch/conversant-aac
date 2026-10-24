// How-to video 4.5: timing.
//
// STAGED: the real timing settings, shown without changing them.

import { settingsTab, section } from '../helpers.mjs';

const label = (words) => `::-p-xpath(//dialog[@open]//label[contains(normalize-space(.),${JSON.stringify(words)})])`;

export default {
  id: '4.5-timing',
  title: 'Timing',
  trouble: [
    "Options keep changing while the other person is still talking? They may pause mid-sentence. Try a longer silence period.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "A few timings shape how a conversation feels. Here's where they are." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('conversation'), press: true,
      say: "then Conversation," },
    { speaker: 'narrator', highlight: section('Listening'), press: true,
      say: "and Listening." },
    { speaker: 'narrator', waitFor: '#silenceThresholdInput', highlight: '#silenceThresholdInput',
      page: "In Settings, Conversation, Silence period is how long the other person must stop before your options are written.",
      say: "Silence period is how long the other person has to stop talking before Conversant writes your options. Short gets options to you sooner. Longer suits someone who pauses in the middle of a sentence." },
    { speaker: 'narrator', highlight: label('Resume listening automatically'),
      page: "Resume listening automatically turns listening back on after you speak.",
      say: "Resume listening automatically turns listening back on after you speak, so you don't have to tap Listen every time." },
    { speaker: 'narrator', highlight: settingsTab('placeholders'), press: true,
      say: "The holding phrases have their own tab, Placeholders." },
    { speaker: 'narrator', highlight: section('Timing and count'), press: true,
      say: "Open Timing and count." },
    { speaker: 'narrator', waitFor: '#initialDelayInput', highlight: '#initialDelayInput',
      page: "Under Placeholders, Initial delay is how soon the first holding phrase is said.",
      say: "Initial delay is how long after the other person stops before Conversant says a holding phrase." },
    { speaker: 'narrator', highlight: '#placeholderEaseOffInput',
      page: "Wait longer each exchange makes them come later as a conversation goes on.",
      say: "Wait longer each exchange makes them come a little later each time, so they don't get repetitive." },
    { speaker: 'narrator', highlight: '#maxPlaceholdersInput',
      page: "Maximum per turn limits how many are said. Zero turns them off.",
      say: "And Maximum per turn limits how many are said while you choose. Zero turns them off. {next}" },
  ],
};
