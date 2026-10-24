// How-to video 4.2: screen layout.
//
// STAGED: real changes to how the screen is arranged, each shown with Settings
// closed so the whole screen can be seen.

import { settingsTab, section } from '../helpers.mjs';

const radio = (words) => `::-p-xpath(//dialog[@open]//label[contains(normalize-space(.),${JSON.stringify(words)})])`;

export default {
  id: '4.2-screen-layout',
  title: 'Screen Layout',
  trouble: [
    "Lost track of what you changed? Under Screen Layout, Use the suggested layout for this screen puts everything back to what fits your screen.",
    "Use a keyguard? Changing the layout moves the buttons, so the keyguard has to match.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "You can arrange the screen to suit how you hold or mount your device. Here are the main choices." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('input'), press: true,
      say: "then Screen Layout," },
    { speaker: 'narrator', highlight: section('Response options'), press: true,
      say: "and Response options." },
    { speaker: 'narrator', highlight: radio('Two by two, New 4 beside'), press: true,
      page: "Under Screen Layout, Response options, choose one row, or two by two.",
      say: "Your four options can sit in one row, or two by two. Marc tries two by two." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings to see it." },
    { speaker: 'narrator', highlight: '#responsesSection',
      say: "Now the options are two by two." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "The Express Panel and keyboard can also sit at the side of the screen. Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('express'), press: true,
      say: "then Express Panel and Keyboard," },
    { speaker: 'narrator', highlight: section('Express Panel and Keyboard selection'), press: true,
      say: "and open its first section." },
    { speaker: 'narrator', highlight: radio('Side of the screen'), press: true,
      page: "Under Express Panel and Keyboard, choose Bottom of the screen or Side of the screen.",
      say: "Choose Side of the screen." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings." },
    { speaker: 'narrator', highlight: '#expressPanel',
      page: "The Layout list in the same place changes the shape of the panel's buttons.",
      say: "Now the panel is at the side. The Layout list, in the same place in Settings, changes the shape of its buttons: more across and shorter, or fewer across and taller." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "If you want to start over, open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('input'), press: true,
      say: "Screen Layout," },
    { speaker: 'narrator', highlight: section('Suggested layout'), press: true,
      say: "and Suggested layout." },
    { speaker: 'narrator', highlight: '#suggestedLayoutBtn',
      page: "Use the suggested layout for this screen puts back the layout that fits your screen.",
      say: "This button puts back the layout that fits your screen best. {next}" },
  ],
};
