import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.argv[2];
const H = await import(pathToFileURL(join(ROOT, 'app/js/voice-harvest.js')).href);
const R = await import(pathToFileURL(join(ROOT, 'app/js/review-model.js')).href);
const dir = join(ROOT, 'test-data-folder/conversations');
const logs = []; const reviews = new Map();
for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  if (f.endsWith('.review.json')) reviews.set(f.slice(0,-12), d); else logs.push({ id: f.slice(0,-5), data: d });
}
for (const c of logs) if (reviews.has(c.id)) c.review = reviews.get(c.id);
logs.sort((a,b)=>a.id.localeCompare(b.id));
const real = logs.filter(c => !R.isPractice(c.data));
const prac = logs.find(c => R.isPractice(c.data));
// Show the practice conversation's offered options for the 4 picks
for (const t of prac.data.exchanges.filter(e=>e.role==='user')) console.log('pick:', JSON.stringify(t.selectedText), 'from', JSON.stringify(t.allOptions));
const show = (label, set) => { const h = H.harvest(set, {}); console.log(label.padEnd(34), 'exemplars', h.exemplars.length, 'lean', JSON.stringify(h.lengthLean)); return h; };
show('real only (16)', real);
for (const k of [1,2,3,5,10]) {
  const copies = Array.from({length:k}, (_,i) => ({ id: `2026-10-0${3}T0${i}-00-00-${i}`, data: prac.data }));
  show(`real + ${k} coffee practice run(s)`, real.concat(copies));
}
// SYNTHETIC: practice job interview with composed answers (formal register, invented content)
const mk = (i, composed) => ({ id: `2026-10-04T1${i}-00-00`, data: { exchanges: [
  ...composed.flatMap((txt, j) => [
    { role: 'partner', timestamp: `2026-10-04T1${i}:0${j}:00.000Z`, rawTranscript: 'Q', partner: { id: null, label: 'Practice: A job interview' } },
    { role: 'user', timestamp: `2026-10-04T1${i}:0${j}:30.000Z`, selectedText: txt, selectedIndex: -1, allOptions: [], source: 'composed', partner: { id: null, label: 'Practice: A job interview' } },
  ])]}});
const interview = [
  mk(1, ['I have worked in customer service for three years at the library.', 'My greatest strength is that I am very organized and reliable.', 'I solved a scheduling problem by building a shared calendar for the team.']),
  mk(2, ['I am applying because I want to grow my skills in a professional setting.', 'In five years I hope to be leading a small team of my own.']),
];
const withInt = show('real + 2 SYNTHETIC interview practices', real.concat(interview));
console.log('exemplars (newest first):'); withInt.exemplars.forEach((e,i)=>console.log('  ', i+1, e));
