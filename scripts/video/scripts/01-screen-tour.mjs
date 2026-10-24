// How-to video 1: a tour of the conversation screen.
//
// Each step is one line of speech and the screen state it is said over. The
// renderer speaks the line, holds the picture for as long as the line takes, and
// draws a ring around `highlight`. A selector that matches nothing stops the
// render, so a renamed or moved control cannot produce a video showing the wrong
// thing.
//
// The conversation is seeded through the app's own renderers (as the manual
// figures are), with fixed partner and option text, so the narration always
// matches the cards on screen.

const PARTNER_LINE = "Hi Marc! Good to see you again. Looking for anything special today?";
const OPTIONS = [
  { slot: 'PREFERRED', text: "Yeah, I came in for the new Spider-Man. Is it out yet?", hint: 'New Spider-Man' },
  { slot: 'DISPREFERRED', text: "Not really, I'm just looking around today.", hint: 'Just looking' },
  { slot: 'INITIATIVE', text: "Good to see you too! Did anything cool come in this week?", hint: "What's new?" },
  { slot: 'REPAIR', text: "Sorry, what was that?", hint: 'What was that?' },
];

const showPartner = (page) => page.evaluate(async (line) => {
  const ui = await import('/js/ui.js');
  ui.renderConversation([{ role: 'partner', text: line }]);
}, PARTNER_LINE);

const showOptions = (page) => page.evaluate(async (opts) => {
  const ui = await import('/js/ui.js');
  ui.showResponses(opts, () => {});
}, OPTIONS);

const userSpeaks = (page) => page.evaluate(async (line, said) => {
  const ui = await import('/js/ui.js');
  ui.renderConversation([{ role: 'partner', text: line }, { role: 'user', text: said }]);
  ui.clearResponseOptions();
}, PARTNER_LINE, OPTIONS[0].text);

const card = (n) => `#responseOptions > .response-cell:nth-child(${n})`;

export default {
  id: '01-screen-tour',
  title: 'A Tour of the Screen',
  steps: [
    { speaker: 'narrator',
      say: "This is Conversant. Let's take a quick look at the screen, so you know where everything is." },
    { speaker: 'narrator', highlight: '#transcriptSection',
      say: "This is the Conversation Pane. It shows what the other person says, and what you say back." },
    { speaker: 'partner', before: showPartner, say: PARTNER_LINE },
    { speaker: 'narrator', before: showOptions, highlight: '#responseOptions',
      say: "When they stop talking, Conversant writes four response options for you, here in the Response Panel." },
    { speaker: 'narrator', highlight: card(1),
      say: "Each option is a different kind of reply. This one answers them in a friendly way." },
    { speaker: 'narrator', highlight: card(2),
      say: "This one says no, politely." },
    { speaker: 'narrator', highlight: card(3),
      say: "This one takes the conversation somewhere new." },
    { speaker: 'narrator', highlight: card(4),
      say: "And this one asks them to say it again, or explain." },
    { speaker: 'narrator', tap: card(1),
      say: "Tap the one you want, and Conversant says it for you." },
    { speaker: 'user', before: userSpeaks, say: OPTIONS[0].text },
    { speaker: 'narrator', highlight: '#regenerateBtn',
      say: "If none of the four fit, tap this button, and you'll get four different ones." },
    { speaker: 'narrator', highlight: '#listenControls',
      say: "This row is the Command Bar. Its buttons start and end a conversation, and ask the other person to repeat or to wait." },
    { speaker: 'narrator', highlight: '#listenBtn',
      say: "The one you'll use most is Listen. Tap it when it's the other person's turn to talk." },
    { speaker: 'narrator', highlight: '#expressPanel',
      say: "This is the Express Panel. Its buttons say common things right away, like yes, no, and thank you. You can change them to the words you use most." },
    { speaker: 'narrator', highlight: '#expressPanel button[aria-label*="own words" i]',
      say: "This button opens a box where you can type exactly what you want to say." },
    { speaker: 'narrator', highlight: '#settingsBtn',
      say: "And this is Settings. Other videos show you how to set Conversant up your way." },
    { speaker: 'narrator',
      say: "That's the whole screen. Next, let's try a practice conversation." },
  ],
};
