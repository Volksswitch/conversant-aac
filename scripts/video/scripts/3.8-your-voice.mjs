// How-to video 3.8: your voice.
//
// STAGED: the real Speech tab. The voices listed are whatever this computer
// offers, so a viewer's list will differ; the narration says so.

import { settingsTab, section, typeInto } from '../helpers.mjs';

const addWord = '::-p-xpath(//button[contains(@class,"ee-add")][normalize-space(.)="+ Add a word"])';
const lastWord = '::-p-xpath((//input[@placeholder="The word"])[last()])';
const lastSay = '::-p-xpath((//input[@placeholder="How to say it"])[last()])';
const hearWord = '::-p-xpath((//button[@aria-label="Hear this word"])[last()])';

export default {
  id: '3.8-your-voice',
  title: 'Your Voice',
  trouble: [
    "The voices sound robotic? Paid voices sound much more natural. During the beta, talk to us before signing up for one.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant speaks for you, so the voice matters. Here's how to choose it, and how to fix a word it says wrong." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('speech'), press: true,
      say: "then Speech." },
    { speaker: 'narrator', highlight: section('Your speaking voice'), press: true,
      page: "In Settings, Speech, open Your speaking voice.",
      say: "Open Your speaking voice." },
    { speaker: 'narrator', waitFor: '#voiceSelect', highlight: '#voiceSelect',
      page: "Choose a voice from the list. The voices depend on your device.",
      say: "Choose a voice from this list. Which voices you see depends on your device." },
    { speaker: 'narrator', highlight: '#testVoiceBtn',
      page: "Tap Test to hear it.",
      say: "Tap Test to hear how it sounds. Try a few before you decide." },
    { speaker: 'narrator', highlight: section('Words the voice gets wrong'), press: true,
      say: "Sometimes the voice says a word wrong, often a name. Open Words the voice gets wrong." },
    { speaker: 'narrator', highlight: addWord, press: true,
      say: "Tap Add a word." },
    { speaker: 'narrator', waitFor: lastWord,
      before: async (p) => { await typeInto(p, lastWord, 'Siobhan'); await typeInto(p, lastSay, 'Shiv-awn'); },
      highlight: lastSay,
      page: "Under Words the voice gets wrong, add the word, then spell it the way it sounds.",
      say: "Type the word, then spell it the way it should sound. The screen still shows Siobhan; only the voice changes." },
    { speaker: 'narrator', highlight: hearWord,
      page: "Tap the speaker to hear it. Keep adjusting until it sounds right.",
      say: "Tap the speaker to hear it, and keep adjusting the spelling until it sounds right." },
    { speaker: 'narrator',
      say: "This list works for more than names. Add short forms you type, like b t w, and have the voice say by the way. {next}" },
  ],
};
