// How-to video 1.7: adding your tester name.
//
// BETA ONLY. The tester name exists so we can tell whose weekly report is whose;
// drop this video from the course when the beta ends.
//
// STAGED: the app starts with no tester name, and a made-up one is typed in.

import { settingsTab, section, typeInto } from '../helpers.mjs';

export default {
  id: '1.7-tester-name',
  title: 'Adding Your Tester Name',
  settings: { testerName: '' },
  trouble: [
    "Not sure what your tester name is? It's in the welcome email we sent you. If you can't find it, ask us.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "During the beta, Conversant sends us a short report each week. Your tester name tells us which reports are yours. It's in the welcome email we sent you." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('troubleshooting'), press: true,
      say: "then Troubleshooting," },
    { speaker: 'narrator', highlight: section('Who these reports come from'), press: true,
      say: "and Who these reports come from." },
    { speaker: 'narrator', waitFor: '#testerNameInput', before: (p) => typeInto(p, '#testerNameInput', 'Marc'),
      highlight: '#testerNameInput',
      page: "In Settings, Troubleshooting, Who these reports come from, type your tester name into the Tester name box.",
      say: "Type your tester name into the Tester name box, exactly as it appears in the email." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      page: "Conversant saves it as you type. Close Settings when you're done.",
      say: "Conversant saves it as you type, so you can close Settings. You only need to do this once on each device." },
    { speaker: 'narrator',
      say: "{next}" },
  ],
};
