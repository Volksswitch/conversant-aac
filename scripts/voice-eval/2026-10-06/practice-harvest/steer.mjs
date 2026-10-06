import { join } from 'node:path'; import { pathToFileURL } from 'node:url';
const ROOT = process.argv[2];
await import(pathToFileURL(join(ROOT, 'tests/env.mjs')).href);
const voice = await import(pathToFileURL(join(ROOT, 'app/js/voice.js')).href);
const H = await import(pathToFileURL(join(ROOT, 'app/js/voice-harvest.js')).href);
localStorage.removeItem('aac_voice'); await voice.resetAll();
// Two rehearsals of the coffee scenario, same Reframe steer typed each time (app.js:3982 records it; no practice gate)
voice.recordSteer('say I want it iced');
voice.recordSteer('Say I want it iced.');
// A practice review typed answer becomes an exemplar
const lbl = { id: null, label: 'Practice: A visit to the doctor' };
const data = { exchanges: [
  { role: 'partner', timestamp: '2026-10-05T10:01:00.000Z', rawTranscript: 'Anything bothering you?', partner: lbl },
  { role: 'user', timestamp: '2026-10-05T10:01:20.000Z', selectedText: 'Not really.', selectedIndex: 0, allOptions: ['Not really.', 'My back hurts.', 'Why?', 'Sorry?'], source: 'card', partner: lbl }]};
const review = { kind: 'conversant-review', version: 1, turns: { '2026-10-05T10:01:00.000Z': { answer: { kind: 'typed', text: 'My back has been bad this week.' } } } };
await voice.setHarvest(H.harvest([{ id: 'x', data, review }], {}));
console.log(voice.buildBlock([]));
