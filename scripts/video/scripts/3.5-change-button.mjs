// How-to video 3.5: changing an Express Panel button.
//
// STAGED: the real Express Panel editor, used by real taps and typing. The
// change is made in a fresh copy of the app, so nothing real is altered.

import { settingsTab, replaceText, panelButton } from '../helpers.mjs';

const picked = '.ee-row-picked';
const pickedBox = '.ee-row-picked input.ee-input';
const tool = (name) => `button.ee-tool[data-tool="${name}"]`;
const addPhrase = '::-p-xpath(//button[contains(@class,"ee-add")][normalize-space(.)="Add a phrase"])';

export default {
  id: '3.5-change-button',
  title: 'Changing an Express Panel Button',
  trouble: [
    "A button isn't showing on the panel? There may be more buttons than places. They're reached with the More button.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Every Express Panel button can say the words you really use. Here's how to change one." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('express'), press: true,
      page: "In Settings, open Express Panel and Keyboard.",
      say: "then Express Panel and Keyboard." },
    { speaker: 'narrator', highlight: '#expressPanel',
      say: "With this tab open, the Express Panel stays beside it, so you can work on the buttons where they are." },
    { speaker: 'narrator', tap: panelButton('Awesome'), press: true,
      page: "Tap the button you want to change.",
      say: "Tap the button you want to change. Marc wants Awesome to say Let's go, instead." },
    { speaker: 'narrator', waitFor: picked, highlight: picked,
      say: "Its row opens, ready to edit." },
    { speaker: 'narrator', before: (p) => replaceText(p, pickedBox, "Let's go!"), highlight: panelButton("Let's go!"),
      page: "Type the new words. The button changes as you type.",
      say: "Type the new words. The button changes as you type." },
    { speaker: 'narrator', highlight: tool('up'), press: true,
      page: "Use the arrows to move it, one place at a time.",
      say: "To move it, use the arrows. Each tap moves it one place." },
    { speaker: 'narrator', highlight: panelButton("Let's go!"),
      say: "It moved one place earlier." },
    { speaker: 'narrator', highlight: addPhrase,
      say: "Add a phrase puts a new button right after the one you selected." },
    { speaker: 'narrator', highlight: tool('delete'), press: true,
      say: "And this removes the selected button." },
    { speaker: 'narrator', waitFor: '.danger-dialog[open]', highlight: '.danger-dialog[open] .danger-body',
      page: "To remove a button, use the X. Conversant asks first, because the buttons after it move up.",
      say: "Conversant asks first, because every button after it moves up one place. Marc wants to keep it," },
    { speaker: 'narrator', highlight: '.danger-dialog[open] .danger-cancel', press: true,
      say: "so he taps Cancel." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      page: "Changes are saved as you make them. Close Settings when you're done.",
      say: "Your changes are saved as you make them. Close Settings when you're done." },
    { speaker: 'narrator',
      say: "{next}" },
  ],
};
