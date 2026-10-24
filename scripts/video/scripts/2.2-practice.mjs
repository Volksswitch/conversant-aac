// How-to video 2.2: a practice conversation.
//
// LIVE: the real app runs Practice Mode and every tap is a real tap. Only two
// things are fixed in advance - what the barista says, and the options the AI
// offers - so the narration always matches the screen. The barista's lines and
// the user's replies are voiced by the video's fixed partner and user voices.

const PARTNER_1 = "Hi there, welcome in! What can I get started for you today?";
const PARTNER_2 = "Sure thing. Would you like that hot or iced?";
const REPLY_1 = "Can I get a medium coffee, please?";
const REPLY_2 = "Hot, please.";

const card = (n) => `#responseOptions > .response-cell:nth-child(${n})`;
// The whole Conversation Pane: a line still being said sits outside the log.
const onScreen = (text) => `#transcriptSection ::-p-text(${text})`;

export default {
  id: '2.2-practice',
  title: 'A Practice Conversation',
  settings: {
    // Holding phrases would fire on a timer, at a different moment each render.
    // Video 2.7 is about them; here they are switched off so every render matches.
    maxPlaceholders: 0,
  },
  ai: {
    partnerLines: [PARTNER_1, PARTNER_2],
    responseSets: [
      { partnerAction: 'QUESTION', responses: [
        { slot: 'PREFERRED', text: REPLY_1, hint: 'Medium coffee' },
        { slot: 'DISPREFERRED', text: "I'm still deciding. Can I have a minute?", hint: 'Need a minute' },
        { slot: 'INITIATIVE', text: 'Hi! What would you recommend today?', hint: 'What do you recommend?' },
        { slot: 'REPAIR', text: 'Sorry, could you say that again?', hint: 'Say again' },
      ] },
      { partnerAction: 'QUESTION', offered: ['hot', 'iced'], responses: [
        { slot: 'CHOICE', text: REPLY_2, hint: 'Hot' },
        { slot: 'CHOICE', text: 'Iced, please.', hint: 'Iced' },
        { slot: 'CHOICE_OTHER', text: 'Either one is fine.', hint: 'Either' },
        { slot: 'CHOICE_ASK', text: 'Which one do you recommend?', hint: 'Which do you recommend?' },
      ] },
    ],
  },
  trouble: [
    "Only \"A tour of the buttons\" is listed: practicing a conversation needs your AI key. Add it in Settings, General, then come back.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant can play the other person, so you can try out a whole conversation before you need one. Let's practice ordering a coffee." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      page: "Tap Settings.",
      say: "To start, tap Settings." },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]',
      highlight: '#settingsTabs .settings-tab[data-tab="practice"]', press: true,
      page: "Tap Practice.",
      say: "Then tap Practice." },
    { speaker: 'narrator', waitFor: '.practice-card', highlight: '::-p-xpath(//button[contains(@class,"practice-card")][.//*[text()="Ordering at a coffee shop"]])', press: true,
      page: "Pick something to practice.",
      say: "Pick something to practice. Let's choose ordering at a coffee shop." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      page: "Tap Listen to let the other person talk.",
      say: "In a practice, tapping Listen is how you let the other person talk. Tap it whenever it's their turn." },
    { speaker: 'partner', waitFor: card(1) + ' .response-text', say: PARTNER_1 },
    { speaker: 'narrator', highlight: '#responseOptions',
      page: "Read your options, and tap the one you'd like to say. Tap Listen again when it's their turn.",
      say: "Here are your four options. Read them, and tap the one you'd like to say." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Let's order a coffee." },
    { speaker: 'user', waitFor: onScreen(REPLY_1), say: REPLY_1 },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "It's their turn again, so tap Listen." },
    { speaker: 'partner', waitFor: onScreen('hot or iced'), say: PARTNER_2 },
    { speaker: 'narrator', highlight: '#responseOptions',
      say: "When they give you a choice, your options are their choices, plus a way to answer differently." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Hot sounds good." },
    { speaker: 'user', waitFor: onScreen(REPLY_2), say: REPLY_2 },
    { speaker: 'narrator', highlight: '#endConversationBtn', press: true,
      page: "When you're done, tap End conversation.",
      say: "When you're done, tap End conversation." },
    { speaker: 'narrator',
      say: "That's a practice. Try the others too, and practice as often as you like. Next, your first real conversation." },
  ],
};
