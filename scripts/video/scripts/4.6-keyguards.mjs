// How-to video 4.6: keyguards.
//
// STAGED: the Keyguard Design tab, shown without generating a file (that writes
// into a data folder, which this video does not have).

import { settingsTab, section } from '../helpers.mjs';

export default {
  id: '4.6-keyguards',
  title: 'Keyguards',
  trouble: [
    "The keyguard's holes don't line up? The layout has changed since the openings were measured. Measure again, and have the keyguard remade.",
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
    { speaker: 'narrator', highlight: section('Spacing'), press: true,
      say: "Open Spacing." },
    { speaker: 'narrator', waitFor: '#appMarginSlider', highlight: '#appMarginSlider',
      page: "In Settings, Keyguard Design, Screen edge margin leaves room around the edges, for a case that fits tightly.",
      say: "If your tablet's case fits tightly around the screen, Screen edge margin leaves room around the edges for the keyguard to sit on." },
    { speaker: 'narrator', highlight: section('Screen openings'), press: true,
      say: "Then open Screen openings." },
    { speaker: 'narrator', waitFor: '#generateOpeningsBtn', highlight: '#generateOpeningsBtn',
      page: "Generate Screen Openings saves the exact position of every button to your data folder. Give it to whoever is designing your keyguard.",
      say: "Generate Screen Openings measures where every button is, and saves it to your data folder. Give that file to whoever is designing your keyguard. {next}" },
  ],
};
