// How-to video 2.7: buying yourself time.
//
// LIVE, with holding phrases ON (the other videos switch them off). The options
// are made to arrive late on purpose, so the holding phrase plays first, as it
// does when the AI is slow. Which phrase plays is the app's own choice; the
// renderer fixes the app's random numbers, so it is the same on every render,
// and the video says whatever the app actually said.

import { card, onScreen, hear, lastSpoken, markSpoken, untilNewSpeech } from '../helpers.mjs';

const P1 = "Hey, did you get a chance to read the one I recommended last week?";
const REPLY = "Yes! I loved it. The ending was amazing.";

export default {
  id: '07-buying-time',
  title: 'Buying Yourself Time',
  settings: { maxPlaceholders: 2, initialDelay: 2, subsequentDelay: 10 },
  ai: {
    responseSets: [
      { delayMs: 4500, responses: [
        { slot: 'PREFERRED', text: REPLY, hint: 'Loved it' },
        { slot: 'DISPREFERRED', text: "Not yet, sorry. It's been a busy week.", hint: 'Not yet' },
        { slot: 'INITIATIVE', text: 'Almost done! Do you have any others like it?', hint: 'Others like it?' },
        { slot: 'REPAIR', text: 'Sorry, which one was that?', hint: 'Which one?' },
      ] },
    ],
  },
  steps: [
    { speaker: 'narrator',
      say: "Choosing a reply takes time, and a long silence can feel awkward. Conversant helps fill it." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true, before: markSpoken,
      say: "Marc taps Listen." },
    { speaker: 'partner', before: (p) => hear(p, P1), waitFor: onScreen('recommended last week'), say: P1 },
    { speaker: 'user', until: untilNewSpeech, say: lastSpoken },
    { speaker: 'narrator', highlight: '#transcriptSection',
      say: "That wasn't Marc tapping anything. A moment after the other person stops talking, Conversant says something like that, in Marc's voice, so they know he's thinking about his answer." },
    { speaker: 'narrator', waitFor: card(1) + ' .response-text', highlight: '#responseOptions',
      say: "Then the options arrive. You can change the holding phrases, and how long it waits before saying one, in Settings." },
    { speaker: 'narrator', highlight: '#holdOnBtn', press: true, before: markSpoken,
      say: "If you need more time, tap Hold on. Conversant tells them you're still thinking." },
    { speaker: 'user', until: untilNewSpeech, say: lastSpoken },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "When you're ready, tap your reply." },
    { speaker: 'user', waitFor: onScreen(REPLY), say: REPLY },
    { speaker: 'narrator', highlight: '#sayAgainBtn', press: true, before: markSpoken,
      say: "And if they didn't catch what you said, tap Repeat what I said." },
    { speaker: 'user', until: untilNewSpeech, say: lastSpoken },
    { speaker: 'narrator',
      say: "Holding phrases, Hold on, and Repeat what I said all keep the conversation going while you think. That's the end of the first conversations. Next, you can start making Conversant your own." },
  ],
};
