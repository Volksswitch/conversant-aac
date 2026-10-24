// How-to video 2.5: in your own words.
//
// LIVE. Shows both things the box is for: Speak (say exactly these words) and
// Reframe (get new options built from them). The options that come back after
// Reframe are fixed in the script, like every other set.

import { card, cardSays, onScreen, hear, typeInto, ownWordsBtn } from '../helpers.mjs';

const P1 = "So, what are you up to this weekend?";
const TYPED = "My cousin is visiting from Chicago.";
const P2 = "Oh, nice! What are you two going to do?";
const STEER = "we're going to a Brewers game";
const REPLY = "We're going to a Brewers game! I can't wait.";

export default {
  id: '05-own-words',
  title: 'In Your Own Words',
  settings: { maxPlaceholders: 0 },
  ai: {
    responseSets: [
      { responses: [
        { slot: 'PREFERRED', text: 'Not much, just relaxing.', hint: 'Not much' },
        { slot: 'DISPREFERRED', text: "I'm not sure yet, honestly.", hint: 'Not sure yet' },
        { slot: 'INITIATIVE', text: 'How about you? Any plans?', hint: 'How about you?' },
        { slot: 'REPAIR', text: 'Sorry, this weekend?', hint: 'This weekend?' },
      ] },
      { responses: [
        { slot: 'PREFERRED', text: "We'll figure it out when he gets here.", hint: "We'll figure it out" },
        { slot: 'DISPREFERRED', text: "Honestly, we haven't planned anything yet.", hint: 'No plans yet' },
        { slot: 'INITIATIVE', text: 'Any ideas? You know the city better than me.', hint: 'Any ideas?' },
        { slot: 'REPAIR', text: 'Sorry, what was that?', hint: 'What was that?' },
      ] },
      { responses: [
        { slot: 'PREFERRED', text: REPLY, hint: 'Brewers game' },
        { slot: 'DISPREFERRED', text: "A Brewers game, if the weather holds up.", hint: 'If the weather holds' },
        { slot: 'INITIATIVE', text: "We're going to a Brewers game. Do you ever go?", hint: 'Do you ever go?' },
        { slot: 'REPAIR', text: 'Sorry, did you ask what we are doing?', hint: 'What we are doing?' },
      ] },
    ],
  },
  steps: [
    { speaker: 'narrator',
      say: "Sometimes none of the options say what you want. Then you can type it yourself." },
    { speaker: 'narrator', highlight: '#listenBtn', press: true,
      say: "Marc taps Listen." },
    { speaker: 'partner', before: (p) => hear(p, P1), waitFor: card(1) + ' .response-text', say: P1 },
    { speaker: 'narrator', highlight: '#responseOptions',
      say: "These are fine, but Marc has something specific to tell them." },
    { speaker: 'narrator', highlight: ownWordsBtn, press: true,
      say: "Tap this button to open a box where you can type." },
    { speaker: 'narrator', waitFor: '#composerInput', before: (p) => typeInto(p, '#composerInput', TYPED), highlight: '#composerInput',
      say: "Marc has set Conversant to use his computer's own keyboard, so he types there. You can also choose a keyboard that appears on the screen." },
    { speaker: 'narrator', highlight: '#speakBtn', press: true,
      say: "Then tap Speak, and Conversant says your words exactly." },
    { speaker: 'user', waitFor: onScreen(TYPED), say: TYPED },
    // ⚠ After a typed reply to the partner's FIRST line, the app turns listening
    // back on by itself; after a tapped option it does not (reported to Ken,
    // October 24 2026). So Listen is tapped here only if it is off, and the
    // narration does not depend on which.
    { speaker: 'narrator', highlight: '#listenBtn',
      before: async (p) => {
        await new Promise((r) => setTimeout(r, 1200));
        const on = await p.evaluate(() => document.getElementById('listenBtn').classList.contains('listening'));
        if (!on) await p.click('#listenBtn');
      },
      say: "Then it's their turn to answer." },
    { speaker: 'partner', before: (p) => hear(p, P2), until: (p) => p.waitForSelector(cardSays(1, "We'll figure it out when he gets here.")), say: P2 },
    { speaker: 'narrator', highlight: '#responseOptions',
      say: "None of these say what Marc has planned. Here's the other way to use the box." },
    { speaker: 'narrator', highlight: ownWordsBtn, press: true,
      say: "Open it again," },
    { speaker: 'narrator', waitFor: '#composerInput', before: (p) => typeInto(p, '#composerInput', STEER), highlight: '#composerInput',
      say: "and type a few words about what you want to get across." },
    { speaker: 'narrator', highlight: '#reframeBtn', press: true,
      say: "This time, tap Reframe. Instead of saying your words, Conversant writes four new options built from them." },
    { speaker: 'narrator', waitFor: cardSays(1, REPLY), highlight: '#responseOptions',
      say: "Now the options are about the game." },
    { speaker: 'narrator', tap: card(1), press: true,
      say: "Marc picks this one." },
    { speaker: 'user', waitFor: onScreen(REPLY), say: REPLY },
    { speaker: 'narrator',
      say: "So: Speak says your words exactly, and Reframe uses them to get better options. Next: starting and ending a conversation." },
  ],
};
