// How-to video 3.3: your places.
//
// STAGED: the real My Places form, filled in by real typing.

import { settingsTab, typeInto, topic, fieldByHint, buttonText } from '../helpers.mjs';

const placeRow = (name) => `::-p-xpath(//div[starts-with(@id,"wvplace-")][.//*[contains(text(),${JSON.stringify(name)})]])`;

export default {
  id: '3.3-places',
  title: 'Your Places',
  trouble: [
    "Want to add more facts? Tap + Add a fact as many times as you need.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant can also know about the places you go, like your favorite store, your school, or the doctor's office. Then, when you tell it where you are, its options fit the place." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('aboutme'), press: true,
      say: "then About Me," },
    { speaker: 'narrator', waitFor: topic('My Places'), highlight: topic('My Places'), press: true,
      page: "In Settings, About Me, open My Places.",
      say: "and My Places." },
    { speaker: 'narrator', waitFor: fieldByHint('Place'),
      before: (p) => typeInto(p, fieldByHint('Place'), 'Pulp Comics'), highlight: fieldByHint('Place'),
      page: "Type the place's name.",
      say: "Type the place's name." },
    { speaker: 'narrator',
      before: async (p) => { await typeInto(p, fieldByHint('What'), 'What I usually buy'); await typeInto(p, fieldByHint('Is'), 'Spider-Man comics'); },
      highlight: fieldByHint('What'),
      page: "Add facts about it: what you usually get there, who you see, anything worth knowing.",
      say: "Then add facts about it, like what you usually buy there, or who you usually see. Marc usually buys Spider-Man comics." },
    { speaker: 'narrator', highlight: buttonText('Add place'), press: true,
      page: "Tap Add place.",
      say: "Tap Add place." },
    { speaker: 'narrator', waitFor: placeRow('Pulp Comics'), highlight: placeRow('Pulp Comics'),
      say: "Pulp Comics is added." },
    { speaker: 'narrator',
      say: "When you're at a place, you tap its button on the Express Panel, and Conversant keeps it in mind until you tap it again. A later video shows how to add the button. {next}" },
  ],
};
