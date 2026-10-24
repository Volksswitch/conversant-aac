// How-to video 2.3: your first real conversation.
//
// LIVE: the real app listens through a stand-in microphone, and the options it
// gets back are fixed in advance so the narration always matches.

import { card, cardSays, onScreen, hear } from '../helpers.mjs';

const P1 = "Hey Marc! The new Spider-Man just came in. Want me to grab you a copy?";
const P2 = "Great, I'll put one behind the counter for you. Anything else today?";
const R1 = "Yes please! I've been waiting all month for that one.";
const R2 = "No, that's it for today. Thanks!";

export default {
  id: '03-first-conversation',
  title: 'Your First Real Conversation',
  settings: { maxPlaceholders: 0 },
  ai: {
    responseSets: [
      { responses: [
        { slot: 'PREFERRED', text: R1, hint: 'Yes please' },
        { slot: 'DISPREFERRED', text: 'Not today, but thanks for thinking of me.', hint: 'Not today' },
        { slot: 'INITIATIVE', text: 'Is that the one with the new villain?', hint: 'New villain?' },
        { slot: 'REPAIR', text: 'Sorry, which one came in?', hint: 'Which one?' },
      ] },
      { responses: [
        { slot: 'PREFERRED', text: R2, hint: "That's it" },
        { slot: 'DISPREFERRED', text: 'Actually, can I look around a little more first?', hint: 'Look around more' },
        { slot: 'INITIATIVE', text: 'Did the new X-Men come in too?', hint: 'X-Men too?' },
        { slot: 'REPAIR', text: 'Sorry, what was that?', hint: 'What was that?' },
      ] },
    ],
  },
  steps: [
    { speaker: 'narrator',
      say: "Let's watch Marc have a real conversation at his favorite comic store." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "When someone starts talking to you, tap Listen. The button turns red while Conversant is listening." },
    { speaker: 'partner', before: (p) => hear(p, P1), waitFor: card(1) + ' .response-text', say: P1 },
    { speaker: 'narrator', highlight: '#transcriptSection',
      say: "Conversant writes down what they said, so you can check that it heard them right." },
    { speaker: 'narrator', highlight: '#responseOptions',
      say: "As soon as they stop talking, your four options appear." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Tap the one you want to say." },
    { speaker: 'user', waitFor: onScreen(R1), say: R1 },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "After you speak, Conversant stops listening. When it's their turn, tap Listen again. If you'd like it to start listening again by itself, there's a setting for that." },
    { speaker: 'partner', before: (p) => hear(p, P2), waitFor: onScreen('Anything else today'), until: (p) => p.waitForSelector(cardSays(1, R2)), say: P2 },
    { speaker: 'narrator', highlight: '#responseOptions',
      say: "New options, for what they just said." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Marc's done shopping, so he picks this one." },
    { speaker: 'user', waitFor: onScreen(R2), say: R2 },
    { speaker: 'narrator', highlight: '#endConversationBtn', press: true,
      say: "When the conversation's over, tap End conversation. That clears the screen, ready for the next one." },
    { speaker: 'narrator',
      say: "That's a conversation. Next: what to do when Conversant doesn't hear them right." },
  ],
};
