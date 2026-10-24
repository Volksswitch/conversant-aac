// How-to video 3.10: looking back at a conversation (Conversation Review).
//
// LIVE. A short real conversation is had and saved, then reviewed and one reply
// rewritten. Saved in the browser's own storage (as on an iPad), because a data
// folder can only be chosen through Windows' picker.

import { settingsTab, section, card, onScreen, hear, replaceText } from '../helpers.mjs';

const P1 = "Hey Marc, how was your weekend?";
const SAID = "It was good, thanks. Pretty relaxing.";
const BETTER = "Pretty chill. Mostly played games with Jamie.";

export default {
  id: '3.10-looking-back',
  title: 'Looking Back at a Conversation',
  settings: { maxPlaceholders: 0 },
  inBrowserStorage: true,
  ai: {
    responseSets: [
      { responses: [
        { slot: 'PREFERRED', text: SAID, hint: 'Good, relaxing' },
        { slot: 'DISPREFERRED', text: 'Kind of busy, to be honest.', hint: 'Busy' },
        { slot: 'INITIATIVE', text: 'Good! How was yours?', hint: 'How was yours?' },
        { slot: 'REPAIR', text: 'Sorry, my weekend?', hint: 'My weekend?' },
      ] },
    ],
  },
  trouble: [
    "No conversations listed? They're kept in your data folder, so choose one first. See video 1.4.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant saves your conversations. Looking back at one is how you teach it the way you'd really say things. First, here's a short conversation." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "Marc taps Listen." },
    { speaker: 'partner', before: (p) => hear(p, P1), waitFor: card(1) + ' .response-text', say: P1 },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "He taps the first option." },
    { speaker: 'user', waitFor: onScreen(SAID), say: SAID },
    { speaker: 'narrator', highlight: '#endConversationBtn', press: true,
      say: "And ends the conversation. Later, he looks back at it." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "Open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('review'), press: true,
      say: "then Conversation Review." },
    { speaker: 'narrator', highlight: section('Saved conversations'), press: true,
      say: "Open Saved conversations." },
    { speaker: 'narrator', waitFor: '.review-row', highlight: '.review-row',
      page: "In Settings, Conversation Review, open Saved conversations, and tap one.",
      say: "Your recent conversations are listed here. Tap one to open it." },
    { speaker: 'narrator', highlight: '.review-row', press: true,
      say: "Marc taps this one." },
    { speaker: 'narrator', waitFor: 'body.reviewing', highlight: '#transcriptSection',
      page: "The conversation opens. The outlined lines are the part you're looking at.",
      say: "The conversation opens on the screen you know. The outlined lines are the part you're looking at." },
    { speaker: 'narrator', highlight: '#initiateBtn', press: true,
      page: "Step through it with these two buttons: next, and back.",
      say: "While you're reviewing, this button moves forward through the conversation, and the one before it moves back." },
    { speaker: 'narrator', waitFor: '.review-current', tap: '.review-current.turn-user', press: true,
      page: "Tap a reply that didn't sound like you.",
      say: "Marc's reply didn't sound like him. He taps it." },
    { speaker: 'narrator', waitFor: '#composerInput', before: (p) => replaceText(p, '#composerInput', BETTER), highlight: '#composerInput',
      page: "Write what you'd rather have said, and tap Save.",
      say: "The box opens with what he said. He writes what he'd rather have said," },
    { speaker: 'narrator', highlight: '#speakBtn', press: true,
      say: "and taps Save." },
    { speaker: 'narrator',
      say: "Each rewrite teaches Conversant how you talk. Rewrites from conversations where you told it who you were with teach it how you talk with that person, and several rewrites do much more than one." },
    { speaker: 'narrator', highlight: '#settingsBtn',
      page: "To leave review, tap Settings.",
      say: "To leave review, tap Settings. {next}" },
  ],
};
