// How-to video 1.3: adding your AI key.
//
// STAGED, from the very first screen: the app is opened with no key, so the
// viewer sees the same notice a new user sees. The key typed in is made up, and
// the key test is answered by the renderer, so no real key is involved.

import { section, settingsTab, typeInto } from '../helpers.mjs';

const MADE_UP_KEY = 'sk-ant-api03-video-example-key-not-real-0000000000000000';

export default {
  id: '1.3-ai-key',
  title: 'Adding Your AI Key',
  start: false,
  settings: { apiKey: '' },
  trouble: [
    "The test says the key was rejected: check that you copied all of it, with nothing missing at either end. If it still fails, tell us.",
    "The test says it couldn't reach the service: check that you're online, then tap Test again.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant uses an AI service to write your response options. To use it, Conversant needs a key: a long line of letters and numbers. During the beta, we'll give you yours." },
    { speaker: 'narrator', highlight: '#startBtn', press: true,
      say: "When you open Conversant, tap Start." },
    { speaker: 'narrator', waitFor: '#apiKeyPrompt:not([hidden])', highlight: '#apiKeyPromptBtn', press: true,
      page: "If Conversant has no key yet, it tells you. Tap Add API key to Settings.",
      say: "If Conversant doesn't have a key yet, it tells you. Tap Add API key to Settings." },
    { speaker: 'narrator', waitFor: '#settingsDialog[open] #apiKeyInput', before: (p) => typeInto(p, '#apiKeyInput', MADE_UP_KEY),
      highlight: '#pasteApiKeyBtn',
      page: "Copy the key we sent you, then tap Paste. Your key goes in this box.",
      say: "Copy the key we sent you, then tap Paste. Your key goes into this box. For your safety, it's hidden as you enter it." },
    { speaker: 'narrator', highlight: '#testApiKeyBtn', press: true,
      page: "Tap Test.",
      say: "Then tap Test." },
    { speaker: 'narrator', waitFor: '#apiKeyStatus:not([hidden])', highlight: '#apiKeyStatus',
      page: "When it says your key is working, you're done.",
      say: "When it says your key is working, you're all set. Conversant keeps the key on this device." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      page: "Close Settings to start using Conversant.",
      say: "Close Settings, and you're ready to have a conversation." },
    { speaker: 'narrator',
      say: "Next: keeping your information safe." },
  ],
};
