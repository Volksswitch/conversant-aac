// How-to video 1.5: do you need a speech service?
//
// STAGED. Short on purpose: during the beta, speech keys are arranged with each
// tester directly, so this video says which setups need one and to talk to us
// first. It names no service.

import { section, settingsTab } from '../helpers.mjs';

export default {
  id: '1.5-speech-service',
  title: 'Do You Need a Speech Service?',
  trouble: [
    "Not sure which kind of device or setup you have? Ask us, and we'll check with you.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant has two speech jobs: hearing the other person, and speaking for you. Most devices can do both for free." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "You can see the choices in Settings." },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('speech'), press: true,
      page: "The speech choices are in Settings, Speech.",
      say: "Under Speech." },
    { speaker: 'narrator', highlight: section('Hearing the other person'), press: true,
      say: "Here's how Conversant hears the other person." },
    { speaker: 'narrator', highlight: '[role="radiogroup"][aria-label="Hearing the other person"]',
      page: "On a Windows computer, Chromebook, Mac, or an iPad using Safari, the free choice works. You don't need a speech service.",
      say: "On a Windows computer, a Chromebook, a Mac, or an iPad using Safari, the free choice works, and you don't need anything else." },
    { speaker: 'narrator',
      page: "On an Android device, or an iPad using the Home Screen app, Conversant needs a paid speech service to hear.",
      say: "On an Android device, or an iPad using Conversant from its Home Screen icon, the device can't hear for Conversant. Then it needs a paid speech service." },
    { speaker: 'narrator',
      page: "If you need one, or want a better voice, talk to us before signing up for anything.",
      say: "If that's you, or if you'd like a better-sounding voice, please talk to us before you sign up for anything. We'll help you choose a service and set it up." },
    { speaker: 'narrator',
      say: "That's everything you need to get started. Next: a tour of the screen." },
  ],
};
