// How-to video 4.6: keyguards.
//
// STAGED: the Keyguard Design tab, shown without saving a design (the video's screen
// is not a real tablet, so the Save button stays unavailable). Rewritten November 27
// 2026 for Your tablet and Save keyguard design.

import { settingsTab, section } from '../helpers.mjs';

export default {
  id: '4.6-keyguards',
  title: 'Keyguards',
  trouble: [
    "The keyguard's holes don't line up? The layout has changed since the design was saved, or Conversant was not filling the screen. Save the design again, and have the keyguard remade.",
  ],
  steps: [
    { speaker: 'narrator', highlight: '#expressPanel',
      say: "A keyguard is a plastic cover with a hole over each button, so a finger lands on the button it meant. Conversant keeps every button in a fixed place so a keyguard can fit it." },
    { speaker: 'narrator',
      page: "Settle your layout first. Changing it later moves the openings, and the keyguard would have to be remade.",
      say: "Settle your layout before you have a keyguard made. Changing the layout, the button spacing, or where the panel sits moves the openings." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Then open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('keyguard'), press: true,
      say: "and Keyguard Design." },
    { speaker: 'narrator', highlight: section('Your tablet'), press: true,
      say: "Open Your tablet," },
    { speaker: 'narrator', waitFor: '#tabletSelect', highlight: '#tabletSelect',
      page: "In Settings, Keyguard Design, Your tablet, choose your tablet. If it isn't listed, measure the screen with a credit card.",
      say: "and choose your tablet from the list. If it isn't there, choose the last item and measure the screen with a credit card." },
    { speaker: 'narrator', highlight: section('Spacing'), press: true,
      say: "Then open Spacing." },
    { speaker: 'narrator', waitFor: '#appMarginSlider', highlight: '#appMarginSlider',
      page: "Screen edge margin leaves room around the edges, for a case that fits tightly. Each spacing setting shows its distance in millimeters.",
      say: "If your tablet's case fits tightly around the screen, Screen edge margin leaves room around the edges for the keyguard to sit on. Each spacing setting shows the distance it sets, in millimeters." },
    { speaker: 'narrator', highlight: '#saveKeyguardDesignBtn',
      page: "With Conversant filling the screen, Save keyguard design saves a file the Volksswitch keyguard designer opens directly. Give it to whoever is designing your keyguard.",
      say: "Make sure Conversant fills the screen, then tap Save keyguard design. It saves a file the Volksswitch keyguard designer opens directly. Give it to whoever is designing your keyguard. {next}" },
  ],
};
