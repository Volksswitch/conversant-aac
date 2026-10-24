// How-to video 3.6: how the Express Panel is organized.
//
// STAGED: the real panel. A ring around a whole group uses the renderer's
// "all:" form, which rings every matching button at once.

import { settingsTab, section } from '../helpers.mjs';

const group = (name) => `all:#expressPanel .ep-band-${name}`;
const more = '#expressPanel .ep-more';
const flexPlus = '::-p-xpath(//input[@id="bandFlexInput"]/following-sibling::button[1])';

export default {
  id: '3.6-panel-groups',
  title: 'How the Express Panel Is Organized',
  trouble: [
    "Lost on the second set of buttons? Tap Close, in the place where More was, to go back to the first set.",
  ],
  steps: [
    { speaker: 'narrator', highlight: '#expressPanel',
      say: "The Express Panel's buttons are in three groups. Here's what each one is for." },
    { speaker: 'narrator', highlight: group('always'),
      page: "Always: the words you say most. They never move, so you can learn where they are.",
      say: "The first group is called Always. It holds the words you say most, and they never move, so you can learn where each one is." },
    { speaker: 'narrator', highlight: more, press: true,
      page: "When a group has more buttons than places, its last place becomes More. Tap it to see the rest.",
      say: "When a group has more buttons than places, its last place becomes More. Tap it to see the rest." },
    { speaker: 'narrator', highlight: more, press: true,
      say: "Then tap Close to go back." },
    { speaker: 'narrator', highlight: group('context'),
      page: "Context: who you're with, where you are, and how you feel. These never speak; they tell Conversant about the conversation.",
      say: "The second group is called Context: who you're with, where you are, and how you feel. These buttons never speak. They tell Conversant about the conversation, so its options fit." },
    { speaker: 'narrator', highlight: 'all:#expressPanel .ep-choice-slot',
      page: "The places marked Choice button are kept for choices the other person offers.",
      say: "The places marked Choice button are kept for choices the other person offers, like hot or iced." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "The third group, Flex, holds phrases that suit the person you're with, or the place you're in. It starts with no room. To give it some, open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('express'), press: true,
      say: "then Express Panel and Keyboard," },
    { speaker: 'narrator', highlight: section('Band sizes and look'), press: true,
      say: "and Band sizes and look." },
    { speaker: 'narrator', highlight: flexPlus, press: true,
      page: "Flex: phrases for a person or a place. Give it room under Band sizes and look.",
      say: "Tap plus beside Flex band." },
    { speaker: 'narrator', highlight: group('flex'),
      say: "Now the Flex group has a row. You add its phrases in the Flex section of this tab, for anyone, for one person, or for one place." },
    { speaker: 'narrator',
      say: "{next}" },
  ],
};
