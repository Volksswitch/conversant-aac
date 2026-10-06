import { join } from 'node:path'; import { pathToFileURL } from 'node:url';
const ROOT = process.argv[2];
const H = await import(pathToFileURL(join(ROOT, 'app/js/voice-harvest.js')).href);
const lbl = { id: null, label: 'Practice: A visit to the doctor' };
const convo = { id: '2026-10-05T10-00-00', data: { exchanges: [
  { role: 'partner', timestamp: '2026-10-05T10:00:00.000Z', rawTranscript: 'How have you been feeling?', partner: lbl },
  { role: 'user', timestamp: '2026-10-05T10:00:20.000Z', selectedText: 'Fine, I guess.', selectedIndex: 0, allOptions: ['Fine, I guess.', 'Not great, honestly.', 'Can I ask you something first?', 'Sorry, how have I been what?'], source: 'card', partner: lbl },
  { role: 'partner', timestamp: '2026-10-05T10:01:00.000Z', rawTranscript: 'Anything bothering you?', partner: lbl },
  { role: 'user', timestamp: '2026-10-05T10:01:20.000Z', selectedText: 'Not really.', selectedIndex: 0, allOptions: ['Not really.', 'My back has been hurting a lot lately, actually.', 'Why do you ask?', 'Bothering me how?'], source: 'card', partner: lbl },
]}};
// A practice REVIEW: user types the doc's own example sentence for turn 2
const turnKey = '2026-10-05T10:01:00.000Z';
const review = { kind: 'conversant-review', version: 1, conversationId: convo.id, turns: { [turnKey]: { answer: { kind: 'typed', text: 'My back has been bad this week.' } } } };
const out = H.harvest([{ ...convo, review }], {});
console.log(JSON.stringify(out, null, 1));
console.log('reviewContributions:', JSON.stringify(H.reviewContributions(convo.data, review)));
