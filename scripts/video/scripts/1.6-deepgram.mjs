// How-to video 1.6: adding a Deepgram key, for an iPad or Android device.
//
// BETA ONLY. During the beta we give iPad and Android testers a Deepgram key; drop
// or rewrite this video when the beta ends.
//
// STAGED: the key typed in is made up, so the Test buttons are pointed at but
// never pressed (a real test would report the made-up key as rejected).

import { settingsTab, section, typeInto } from '../helpers.mjs';

const MADE_UP_KEY = 'video0example0deepgram0key0not0real0000';
const radio = (name, value) => `label.radio-label:has(input[name="${name}"][value="${value}"])`;

export default {
  id: '1.6-deepgram',
  title: 'Adding Your Deepgram Key',
  settings: { deepgramKey: '' },
  trouble: [
    "The test says the key was rejected: check that you copied all of it, with nothing missing at either end. If it still fails, tell us.",
    "You chose Deepgram but Conversant still doesn't hear anyone: check that Deepgram transcription is chosen under Hearing the other person, not only that the key is in.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "This video is for an iPad or an Android device. If you use a Windows computer, a Chromebook, or a Mac, you can skip it." },
    { speaker: 'narrator',
      say: "On an iPad or an Android device, Conversant needs a speech service to hear the other person. During the beta, we'll give you a key for a service called Deepgram. It's in your welcome email." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('speech'), press: true,
      say: "then Speech," },
    { speaker: 'narrator', highlight: section('Keys for paid services'), press: true,
      say: "and Keys for paid services." },
    { speaker: 'narrator', waitFor: '#deepgramKeyInput', before: (p) => typeInto(p, '#deepgramKeyInput', MADE_UP_KEY),
      highlight: '#pasteDeepgramKeyBtn',
      page: "In Settings, Speech, Keys for paid services, copy the Deepgram key we sent you, then tap Paste beside Deepgram.",
      say: "Copy the Deepgram key we sent you, then tap Paste beside Deepgram." },
    { speaker: 'narrator', highlight: '#testDeepgramKeyBtn',
      page: "Tap Test to check that the key works.",
      say: "Tap Test to check that it works." },
    { speaker: 'narrator', highlight: section('Hearing the other person'), press: true,
      say: "The key alone doesn't change anything. Next, open Hearing the other person," },
    { speaker: 'narrator', highlight: radio('sttProvider', 'deepgram'), press: true,
      page: "Open Hearing the other person, and choose Deepgram transcription. Without this step, the key isn't used.",
      say: "and choose Deepgram transcription. Now Conversant uses Deepgram to hear the person you're talking with." },
    { speaker: 'narrator', highlight: section('Your speaking voice'), press: true,
      say: "On an iPad, we also suggest Deepgram's voice, because the iPad's own voices are hard to listen to. Open Your speaking voice," },
    { speaker: 'narrator', highlight: radio('ttsProvider', 'deepgram'), press: true,
      page: "On an iPad, also open Your speaking voice and choose Deepgram voice.",
      say: "and choose Deepgram voice." },
    { speaker: 'narrator', waitFor: '#auraVoiceSelect', highlight: '#auraVoiceSelect',
      page: "Pick a voice from the list, and tap Test to hear it.",
      say: "Then pick a voice from the list, and tap Test to hear it. Choose the one that sounds most like you." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings when you're done. {next}" },
  ],
};
