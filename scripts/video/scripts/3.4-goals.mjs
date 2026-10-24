// How-to video 3.4: your goals.
//
// LIVE. A goal is added to "Goals For Any Conversation", the Flex group is given
// room for its button, and tapping the button changes the options. The options
// are fixed in the script.

import { settingsTab, section, topic, choose, card, cardSays, onScreen, hear, panelButtonWith } from '../helpers.mjs';

const P1 = "Hi there! Anything I can help you with today?";
const REPLY = "Yes, what new comics would you recommend?";
const addGoal = '::-p-xpath(//select[option[normalize-space(text())="Add a goal…"]])';
const flexPlus = '::-p-xpath(//input[@id="bandFlexInput"]/following-sibling::button[1])';

export default {
  id: '3.4-goals',
  title: 'Your Goals',
  settings: { maxPlaceholders: 0 },
  ai: {
    responseSets: [
      { responses: [
        { slot: 'PREFERRED', text: "I'm all set, thanks.", hint: 'All set' },
        { slot: 'DISPREFERRED', text: "I'm just looking for now.", hint: 'Just looking' },
        { slot: 'INITIATIVE', text: 'Is the new Spider-Man in yet?', hint: 'New Spider-Man?' },
        { slot: 'REPAIR', text: 'Sorry, what was that?', hint: 'What was that?' },
      ] },
      { responses: [
        { slot: 'PREFERRED', text: REPLY, hint: 'What do you recommend?' },
        { slot: 'DISPREFERRED', text: "Not today, but what's popular right now?", hint: "What's popular?" },
        { slot: 'INITIATIVE', text: 'What would you read if you liked Spider-Man?', hint: 'If I like Spider-Man?' },
        { slot: 'REPAIR', text: 'Sorry, could you say that again?', hint: 'Say again' },
      ] },
    ],
  },
  trouble: [
    "No goal button on the panel? The Flex group needs room for it. Give it a row under Band sizes and look.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "A goal tells Conversant what you want from a conversation, like getting advice, or making plans. Then its options help you get there." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('aboutme'), press: true,
      say: "then About Me," },
    { speaker: 'narrator', waitFor: topic('Goals For Any Conversation'), highlight: topic('Goals For Any Conversation'), press: true,
      page: "In Settings, About Me, open Goals For Any Conversation.",
      say: "and Goals For Any Conversation. You can also give goals to a person or a place, where you add them." },
    { speaker: 'narrator', waitFor: addGoal, before: (p) => choose(p, addGoal, 'Get information or advice'), highlight: addGoal,
      page: "Choose a goal from the list, or type your own.",
      say: "Choose a goal from the list. Marc picks Get information or advice." },
    { speaker: 'narrator', highlight: settingsTab('express'), press: true,
      say: "A goal gets a button in the Flex group of the Express Panel, and that group starts with no room. So open Express Panel and Keyboard," },
    { speaker: 'narrator', highlight: section('Band sizes and look'), press: true,
      say: "then Band sizes and look," },
    { speaker: 'narrator', highlight: flexPlus, press: true,
      page: "Give the Flex group room under Express Panel and Keyboard, Band sizes and look.",
      say: "and tap plus beside Flex band." },
    { speaker: 'narrator', highlight: panelButtonWith('Finding out'),
      page: "Your goal now has a button on the Express Panel.",
      say: "Marc's goal now has a button, called Finding out." },
    { speaker: 'narrator', highlight: '#closeSettingsBtn', press: true,
      say: "Close Settings." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "At the store, Marc taps Listen." },
    { speaker: 'partner', before: (p) => hear(p, P1), waitFor: cardSays(1, "I'm all set, thanks."), say: P1 },
    { speaker: 'narrator', tap: panelButtonWith('Finding out'), press: true,
      page: "In a conversation, tap the goal's button. Your options change to help you get there.",
      say: "He wants advice today, so he taps his goal." },
    { speaker: 'narrator', waitFor: cardSays(1, REPLY), highlight: '#responseOptions',
      say: "Now the options ask for advice. Tap the goal again to switch it off." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Marc picks one." },
    { speaker: 'user', waitFor: onScreen(REPLY), say: REPLY },
    { speaker: 'narrator',
      say: "{next}" },
  ],
};
