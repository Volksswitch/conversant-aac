// How-to video 3.2: the people in your life.
//
// STAGED: the real People form, filled in by real typing and choices.

import { settingsTab, typeInto, choose, topic, fieldByHint, buttonText } from '../helpers.mjs';

const relationship = '::-p-xpath(//select[option[normalize-space(text())="Relationship…"]])';
const talkWith = '::-p-xpath(//summary[contains(normalize-space(.),"How I talk with them")])';
const dim = (name) => `::-p-xpath(//label[contains(@class,"wv-dim-row")][starts-with(normalize-space(.),${JSON.stringify(name)})]//select)`;
const personRow = (name) => `::-p-xpath(//div[starts-with(@id,"wvperson-")][.//*[contains(text(),${JSON.stringify(name)})]])`;

export default {
  id: '3.2-people',
  title: 'The People in Your Life',
  trouble: [
    "A name is said wrong: type how it sounds in the box under the name, like \"Shiv-awn\" for Siobhan, and tap the speaker to hear it.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "When Conversant knows who you're talking with, it can suggest replies that fit that person. Here's how to add someone." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('aboutme'), press: true,
      say: "then About Me," },
    { speaker: 'narrator', waitFor: topic('People in Your Life'), highlight: topic('People in Your Life'), press: true,
      page: "In Settings, About Me, open People in Your Life.",
      say: "and People in Your Life." },
    { speaker: 'narrator', waitFor: fieldByHint('Name'),
      before: (p) => typeInto(p, fieldByHint('Name'), 'Jamie'), highlight: fieldByHint('Name'),
      page: "Type their name.",
      say: "Type their name." },
    { speaker: 'narrator', before: (p) => choose(p, relationship, 'Friend'), highlight: relationship,
      page: "Choose how they're related to you.",
      say: "Choose how they're related to you." },
    { speaker: 'narrator',
      before: (p) => typeInto(p, fieldByHint('Topics I'), 'comics, video games, the Packers'),
      highlight: fieldByHint('Topics I'),
      page: "Add things you like to talk about with them, if you want.",
      say: "If you want, add things you like to talk about together." },
    // pronounce: this line came out "CAN-versant" (October 28 2026); see pronounce.json.
    { speaker: 'narrator', highlight: talkWith, press: true, pronounce: true,
      say: "You can also tell Conversant how you talk with this person. Open How I talk with them." },
    { speaker: 'narrator', waitFor: dim('Formality'),
      before: async (p) => { await choose(p, dim('Formality'), 'More relaxed'); await choose(p, dim('Humor'), 'More playful'); },
      highlight: dim('Formality'),
      page: "Under How I talk with them, say whether you're more relaxed, more playful, and so on, with this person.",
      say: "Marc is more relaxed with Jamie, and more playful, than he is with most people. Everything here is optional." },
    { speaker: 'narrator', highlight: buttonText('Add person'), press: true,
      page: "Tap Add person.",
      say: "Then tap Add person." },
    { speaker: 'narrator', waitFor: personRow('Jamie'), highlight: personRow('Jamie'),
      say: "Jamie is added. You can change these details any time." },
    { speaker: 'narrator',
      say: "To use what Conversant knows about Jamie, you put a button for Jamie on the Express Panel, and tap it when you're talking with them. A later video shows how. {next}" },
  ],
};
