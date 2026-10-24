// How-to video 5.3: keeping a conversation private.
//
// STAGED: the real button, tapped on and off.

import { settingsTab, section } from '../helpers.mjs';

const label = (words) => `::-p-xpath(//dialog[@open]//label[contains(normalize-space(.),${JSON.stringify(words)})])`;

export default {
  id: '5.3-private',
  title: 'Keeping a Conversation Private',
  trouble: [
    "Even when a conversation isn't saved, its words still go to the AI service and any speech service while it happens, as they always do. They just aren't kept on the device.",
  ],
  steps: [
    { speaker: 'narrator',
      say: "Conversant saves your conversations, so you can look back at them. Sometimes you'd rather it didn't." },
    { speaker: 'narrator', highlight: '#privacyBtn', press: true,
      page: "Tap Don't save this conversation, on the Command Bar, before or during a conversation.",
      say: "Tap this button, Don't save this conversation, before or during a conversation." },
    { speaker: 'narrator', highlight: '#privacyBtn',
      page: "While it's lit, the words of the conversation aren't saved. A technical problem is still noted, but never what was said.",
      say: "While it's lit, the words of this conversation aren't saved. If something goes wrong, Conversant still notes the problem, but never what was said." },
    { speaker: 'narrator', highlight: '#privacyBtn', press: true,
      say: "Tap it again to turn it off." },
    { speaker: 'narrator', highlight: '#settingsBtn', press: true,
      say: "If you'd rather never save conversations, open Settings," },
    { speaker: 'narrator', waitFor: '#settingsDialog[open]', highlight: settingsTab('conversation'), press: true,
      say: "Conversation," },
    { speaker: 'narrator', highlight: section('Saving conversations'), press: true,
      say: "and Saving conversations." },
    { speaker: 'narrator', highlight: label('Do not save my conversations'),
      page: "To never save them, check Do not save my conversations, in Settings, Conversation.",
      say: "Check Do not save my conversations. Then each conversation starts private. {next}" },
  ],
};
