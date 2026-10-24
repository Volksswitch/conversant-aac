// How-to video 2.6: starting and ending a conversation.
//
// LIVE. The openers, wrap-up phrases and goodbyes are the app's own built-in
// lists, so their words are read off the screen rather than written here; a
// change to the defaults changes the video with no edit.

import { card, onScreen, hear, lastSpoken, markSpoken, untilNewSpeech } from '../helpers.mjs';

const P1 = "Hey Marc, good to see you! My week's been pretty busy. How about yours?";

export default {
  id: '2.6-start-and-end',
  title: 'Starting and Ending a Conversation',
  settings: { maxPlaceholders: 0 },
  ai: {
    responseSets: [
      { responses: [
        { slot: 'PREFERRED', text: 'Pretty good! Nothing too exciting.', hint: 'Pretty good' },
        { slot: 'DISPREFERRED', text: "Kind of rough, honestly, but I'm hanging in there.", hint: 'Kind of rough' },
        { slot: 'INITIATIVE', text: 'Good! What kept you so busy?', hint: 'What kept you busy?' },
        { slot: 'REPAIR', text: 'Sorry, how was your week?', hint: 'Your week?' },
      ] },
    ],
  },
  trouble: [
    "Tapped Start conversation or Wrap up by mistake? Tap it again to get your options back.",
    "To change these openers and goodbyes, go to Settings, Commands.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "You don't have to wait for someone to talk to you. You can start a conversation, and you can end one politely." },
    { speaker: 'narrator', highlight: '#initiateBtn', press: true,
      page: "Tap Start conversation, and pick a way to open.",
      say: "To start one, tap Start conversation." },
    { speaker: 'narrator', waitFor: card(1) + ' .response-text', highlight: '#responseOptions',
      say: "Your options are now ways to open a conversation. You can change them to your own in Settings." },
    { speaker: 'narrator', tap: card(4), press: true, before: markSpoken,
      say: "Marc picks this one." },
    { speaker: 'user', until: untilNewSpeech, say: lastSpoken },
    { speaker: 'narrator', highlight: '#listenBtn',
      page: "Conversant starts listening by itself, ready for their answer.",
      say: "After you open a conversation, Conversant starts listening by itself, ready for their answer." },
    { speaker: 'partner', before: (p) => hear(p, P1), waitFor: card(1) + ' ::-p-text("Pretty good")', say: P1 },
    { speaker: 'narrator', highlight: '#responseOptions',
      say: "From here, the conversation goes on as usual." },
    { speaker: 'narrator', highlight: '#windDownBtn', press: true,
      page: "When you're ready to finish, tap Wrap up.",
      say: "When you're ready to finish, tap Wrap up." },
    { speaker: 'narrator', waitFor: card(1) + ' .response-text', highlight: '#responseOptions',
      page: "Pick a way to say you need to go.",
      say: "Your options become ways to start winding things down. They let the other person know you need to go, without saying goodbye yet. If you tapped Wrap up by mistake, tap it again to get your options back." },
    { speaker: 'narrator', tap: card(1), press: true, before: markSpoken,
      say: "Marc picks one." },
    { speaker: 'user', until: untilNewSpeech, say: lastSpoken },
    { speaker: 'narrator', highlight: '#responseOptions',
      page: "Then pick a goodbye.",
      say: "Now the options are goodbyes." },
    { speaker: 'narrator', tap: card(1), press: true, before: markSpoken,
      say: "Marc says goodbye." },
    { speaker: 'user', until: untilNewSpeech, say: lastSpoken },
    { speaker: 'narrator', highlight: '#endConversationBtn', press: true,
      page: "Tap End conversation to clear the screen.",
      say: "Then tap End conversation to clear the screen." },
    { speaker: 'narrator',
      say: "Start conversation to open, Wrap up to close, and End conversation when you're done. Next: buying yourself a little time." },
  ],
};
