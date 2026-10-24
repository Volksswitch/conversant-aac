// How-to video 3.7: telling Conversant who, where and how you feel.
//
// LIVE. Starts with Jamie (video 3.2) and Pulp Comics (video 3.3) already saved,
// adds their buttons to the Express Panel, then shows the options changing as
// they are tapped. The options are fixed in the script, one set per tap.

import { settingsTab, card, cardSays, onScreen, hear, choose, panelButtonWith as panelButton } from '../helpers.mjs';

const P1 = "Hey Marc! What can I help you find today?";
const REPLY = "Did my Spider-Man come in? You know I always get it here.";

const contextSection = '::-p-xpath(//summary[contains(normalize-space(.),"Context — describing")])';
const addBtn = (what) => `::-p-xpath(//button[contains(@class,"ee-add")][normalize-space(.)=${JSON.stringify(what)}])`;
const lastPicker = '::-p-xpath((//select[contains(@class,"ee-name-select")])[last()])';

export default {
  id: '3.7-who-where-feel',
  title: 'Telling Conversant Who, Where and How You Feel',
  settings: { maxPlaceholders: 0 },
  storage: {
    aac_relationships: { version: 1, people: [{ id: 'p-jamie', name: 'Jamie', private: false, attrs: {} }],
      edges: [{ from: 'me', to: 'p-jamie', type: 'Friend', attrs: {} }] },
    aac_places: { version: 1, places: [{ id: 'pl-pulp', name: 'Pulp Comics', private: false,
      facts: [{ key: 'What I usually buy', value: 'Spider-Man comics' }] }] },
  },
  ai: {
    responseSets: [
      { responses: [
        { slot: 'PREFERRED', text: "I'm just looking around, thanks.", hint: 'Just looking' },
        { slot: 'DISPREFERRED', text: "I'm fine for now, thank you.", hint: 'Fine for now' },
        { slot: 'INITIATIVE', text: 'Do you have any new comics this week?', hint: 'New comics?' },
        { slot: 'REPAIR', text: 'Sorry, what was that?', hint: 'What was that?' },
      ] },
      { responses: [
        { slot: 'PREFERRED', text: 'Hey Jamie! Just seeing what came in.', hint: 'Seeing what came in' },
        { slot: 'DISPREFERRED', text: 'Nothing today, just came to say hi.', hint: 'Just saying hi' },
        { slot: 'INITIATIVE', text: 'Jamie! Did you finish that game yet?', hint: 'Finish that game?' },
        { slot: 'REPAIR', text: 'Sorry, what did you say?', hint: 'What did you say?' },
      ] },
      { responses: [
        { slot: 'PREFERRED', text: REPLY, hint: 'My Spider-Man?' },
        { slot: 'DISPREFERRED', text: "Nothing today, I'm saving up.", hint: 'Saving up' },
        { slot: 'INITIATIVE', text: 'Anything good come in this week, Jamie?', hint: 'Anything good?' },
        { slot: 'REPAIR', text: 'Sorry, what did you say?', hint: 'What did you say?' },
      ] },
    ],
  },
  trouble: [
    "A button you added isn't on the panel? The Context group may be full. Its More button shows the rest, or you can make the group bigger under Band sizes and look.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant writes better options when it knows who you're talking with, where you are, and how you feel. You tell it with buttons on the Express Panel." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Marc has already added his friend Jamie and the store Pulp Comics in About Me. To give them buttons, open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('express'), press: true,
      say: "then Express Panel and Keyboard," },
    { speaker: 'narrator', highlight: contextSection, press: true,
      page: "In Settings, Express Panel and Keyboard, open the Context section.",
      say: "and the Context section." },
    { speaker: 'narrator', highlight: addBtn('Add a partner'), press: true,
      say: "Tap Add a partner," },
    { speaker: 'narrator', waitFor: lastPicker, before: (p) => choose(p, lastPicker, 'Jamie'), highlight: lastPicker,
      page: "Tap Add a partner or Add a place, and choose from the people and places you added in About Me.",
      say: "and choose Jamie." },
    { speaker: 'narrator', highlight: addBtn('Add a place'), press: true,
      say: "Then Add a place," },
    { speaker: 'narrator', waitFor: lastPicker, before: (p) => choose(p, lastPicker, 'Pulp Comics'), highlight: panelButton('Jamie'),
      say: "and choose Pulp Comics. Their buttons are on the panel now." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "Marc walks into the store and taps Listen." },
    { speaker: 'partner', before: (p) => hear(p, P1), waitFor: cardSays(1, "I'm just looking around, thanks."), say: P1 },
    { speaker: 'narrator', highlight: '#responseOptions',
      say: "These options would fit anyone. But this is Jamie, Marc's friend, who works here." },
    { speaker: 'narrator', tap: panelButton('Jamie'), press: true,
      page: "Tap the person you're talking with. Your options change to fit them.",
      say: "Marc taps Jamie's button." },
    { speaker: 'narrator', waitFor: cardSays(1, 'Hey Jamie! Just seeing what came in.'), highlight: '#responseOptions',
      say: "The options change to fit how Marc talks with Jamie." },
    { speaker: 'narrator', tap: panelButton('Pulp Comics'), press: true,
      page: "Tap where you are. Conversant uses what it knows about the place.",
      say: "Now he taps Pulp Comics." },
    { speaker: 'narrator', waitFor: cardSays(1, REPLY), highlight: '#responseOptions',
      say: "Conversant knows Marc usually buys Spider-Man comics here, so now that's in his options too." },
    { speaker: 'narrator', highlight: panelButton('Tired'),
      page: "Feeling buttons work the same way. Tap one again to switch it off.",
      say: "The feeling buttons work the same way. Tap one to tell Conversant how you feel, and tap it again to switch it off." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Marc picks his reply." },
    { speaker: 'user', waitFor: onScreen(REPLY), say: REPLY },
    { speaker: 'narrator', highlight: panelButton('Pulp Comics'),
      say: "Jamie's button switches off when the conversation ends. Pulp Comics stays on until Marc taps it again, because he's still in the store. {next}" },
  ],
};
