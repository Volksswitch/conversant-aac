// How-to video 2.4: when it hears wrong.
//
// LIVE. The stand-in microphone "mishears" the first line on purpose: the
// partner is heard saying "bag", and the microphone hands the app "bagel".

import { card, cardSays, onScreen, hear, lastSpoken } from '../helpers.mjs';

const SAID = "Do you want a bag for that?";
const MISHEARD = "Do you want a bagel for that?";
const REPLY = "No, I'm good. Thanks, though.";

export default {
  id: '2.4-hears-wrong',
  title: 'When It Hears Wrong',
  settings: { maxPlaceholders: 0 },
  ai: {
    responseSets: [
      { responses: [
        { slot: 'PREFERRED', text: "Sure, I'd love a bagel!", hint: 'Yes, a bagel' },
        { slot: 'DISPREFERRED', text: 'No thanks, I already ate.', hint: 'Already ate' },
        { slot: 'INITIATIVE', text: 'What kinds of bagels do you have?', hint: 'What kinds?' },
        { slot: 'REPAIR', text: 'Sorry, did you say bagel?', hint: 'Bagel?' },
      ] },
      { responses: [
        { slot: 'PREFERRED', text: 'Yes, please.', hint: 'Yes please' },
        { slot: 'DISPREFERRED', text: 'No thanks, I can carry it.', hint: 'I can carry it' },
        { slot: 'INITIATIVE', text: 'Do you have a bigger one?', hint: 'Bigger one?' },
        { slot: 'REPAIR', text: 'Sorry, a what?', hint: 'A what?' },
      ] },
      { responses: [
        { slot: 'PREFERRED', text: "Sure, that'd be great.", hint: 'Sure' },
        { slot: 'DISPREFERRED', text: REPLY, hint: "I'm good" },
        { slot: 'INITIATIVE', text: 'Could I get a paper one instead?', hint: 'Paper bag?' },
        { slot: 'REPAIR', text: 'Sorry, what did you ask?', hint: 'What did you ask?' },
      ] },
    ],
  },
  trouble: [
    "It mishears often: get closer to the person speaking, and cut down background noise if you can.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Sometimes Conversant doesn't hear the other person correctly. Here's what to do." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "Marc taps Listen, and the clerk asks him something." },
    { speaker: 'partner', before: (p) => hear(p, MISHEARD), waitFor: card(1) + ' .response-text', say: SAID },
    { speaker: 'narrator', highlight: '#transcriptSection',
      page: "Check what Conversant heard. If it's wrong, the options will be too.",
      say: "Look at what Conversant heard. The clerk said bag, but it heard bagel." },
    { speaker: 'narrator', highlight: '#responseOptions',
      say: "So the options are all about the wrong thing." },
    { speaker: 'narrator', highlight: '#pardonBtn', press: true,
      page: "Tap Ask them to repeat. Conversant asks them, in your voice, to say it again.",
      say: "When that happens, tap Ask them to repeat. Conversant asks them, in your voice, to say it again." },
    { speaker: 'user', waitFor: onScreen('again'), say: lastSpoken },
    { speaker: 'partner', before: (p) => hear(p, SAID), waitFor: cardSays(1, 'Yes, please.'), say: SAID },
    { speaker: 'narrator', highlight: '#transcriptSection',
      page: "When they say it again, Conversant gives you new options.",
      say: "This time it heard them right, and the options fit." },
    { speaker: 'narrator', highlight: '#regenerateBtn', press: true,
      page: "If none of the options fit, tap this button for four new ones.",
      say: "If none of the options are what you'd say, tap this button for four new ones." },
    { speaker: 'narrator', waitFor: cardSays(2, REPLY), highlight: '#responseOptions',
      say: "Here are four different ones, for the same question." },
    { speaker: 'narrator', tap: card(2), press: true,
      say: "Marc picks this one." },
    { speaker: 'user', waitFor: onScreen(REPLY), say: REPLY },
    { speaker: 'narrator',
      say: "So: check what it heard, ask them to repeat if it's wrong, and ask for new options if none of them fit. {next}" },
  ],
};
