// How-to video 4.1: bigger buttons and spacing.
//
// STAGED: the two real ways to make buttons easier to hit: dragging a border to
// give an area more room (a real drag), and button spacing. Choosing an Express
// Panel layout only changes the buttons' shape (all have 32), so it is in 4.2.

import { settingsTab, section, dragBy } from '../helpers.mjs';

const lastHandle = '::-p-xpath((//*[contains(@class,"layout-handle")])[last()])';

export default {
  id: '4.1-bigger-buttons',
  title: 'Bigger Buttons and Spacing',
  trouble: [
    "Use a keyguard? Either change moves the buttons, so the keyguard has to be made to match. See video 4.6.",
    "Moved a border too far? Under Resizing the screen areas, Put the layout back undoes it.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "If the buttons are hard to hit, you can make them bigger, or put more room between them." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('input'), press: true,
      say: "then Screen Layout," },
    { speaker: 'narrator', highlight: section('Resizing the screen areas'), press: true,
      say: "and Resizing the screen areas." },
    { speaker: 'narrator', highlight: '#layoutUnlockToggle', press: true,
      page: "In Settings, Screen Layout, turn on Let me drag the borders to resize.",
      say: "Turn on Let me drag the borders to resize," },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "and close Settings." },
    { speaker: 'narrator', waitFor: lastHandle, highlight: lastHandle,
      page: "Drag a round handle on a border to give an area more room.",
      say: "Round handles appear on the borders between areas. Drag one to move the border." },
    { speaker: 'narrator', before: (p) => dragBy(p, lastHandle, 0, -110), highlight: '#expressPanel',
      say: "Dragging this one up makes the Express Panel, and its buttons, taller." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "When it's right, go back to Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('input'), press: true,
      say: "Screen Layout," },
    { speaker: 'narrator', waitFor: '#layoutUnlockToggle', highlight: '#layoutUnlockToggle', press: true,
      page: "Then turn dragging off, so a stray touch can't move the borders.",
      say: "and turn dragging off again, so a stray touch can't move the borders." },
    { speaker: 'narrator', highlight: section('Gaps between buttons'), press: true,
      say: "You can also put more room between the buttons. Open Gaps between buttons," },
    { speaker: 'narrator', highlight: section('Button spacing'), press: true,
      say: "then Button spacing." },
    { speaker: 'narrator', waitFor: '#buttonGapSlider', highlight: '#buttonGapSlider',
      page: "Under Gaps between buttons, Button spacing puts more room between buttons, so a near miss lands on nothing.",
      say: "Move this to put more room between the buttons, so a near miss lands on nothing instead of the wrong button. {next}" },
  ],
};
