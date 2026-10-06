import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.argv[2];
const H = await import(pathToFileURL(join(ROOT, 'app/js/voice-harvest.js')).href);
const R = await import(pathToFileURL(join(ROOT, 'app/js/review-model.js')).href);
const dir = join(ROOT, 'test-data-folder/conversations');
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
const reviews = new Map(); const logs = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  if (f.endsWith('.review.json')) reviews.set(f.slice(0, -12), d); else logs.push({ id: f.slice(0, -5), data: d });
}
for (const c of logs) if (reviews.has(c.id)) c.review = reviews.get(c.id);
logs.sort((a,b)=>a.id.localeCompare(b.id));
// Express phrases from the test folder (user's own) for legacy classification; control phrases unknown -> empty
let expressPhrases = [];
try {
  const ep = JSON.parse(readFileSync(join(ROOT, 'test-data-folder/express-panel.json'), 'utf8'));
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.type === 'phrase' && v.text) expressPhrases.push(v.text); Object.values(v).forEach(walk); } };
  walk(ep);
} catch {}
let controlPhrases = [];
try {
  const cp = JSON.parse(readFileSync(join(ROOT, 'test-data-folder/control-phrases.json'), 'utf8'));
  const walk = (v) => { if (typeof v === 'string') controlPhrases.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k,x] of Object.entries(v)) { if (k !== 'seeded' && k!=='version' && k!=='updated') walk(x); } };
  walk(cp);
} catch {}
try {
  const pp = JSON.parse(readFileSync(join(ROOT, 'test-data-folder/placeholders.json'), 'utf8'));
  const walk = (v) => { if (typeof v === 'string') controlPhrases.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k,x] of Object.entries(v)) { if (k !== 'seeded' && k!=='version' && k!=='updated') walk(x); } };
  walk(pp);
} catch {}
const OPTS = { controlPhrases, expressPhrases };
const practice = logs.filter(c => R.isPractice(c.data));
const real = logs.filter(c => !R.isPractice(c.data));
console.log('total conversations', logs.length, 'practice', practice.length, 'real', real.length, 'reviews', reviews.size);
for (const c of practice) {
  const u = c.data.exchanges.filter(e => e && e.role === 'user');
  const by = {}; for (const t of u) { const k = H.classifyTurn(t, OPTS); by[k] = (by[k]||0)+1; }
  console.log('PRACTICE', c.id, R.practiceTitle(c.data), 'userTurns', u.length, JSON.stringify(by), 'review?', !!c.review);
  for (const t of u) console.log('   ', H.classifyTurn(t, OPTS), '|', t.selectedText, '| opts', (t.allOptions||[]).length);
}
const all = H.harvest(logs, OPTS);
const noP = H.harvest(real, OPTS);
const onlyP = H.harvest(practice, OPTS);
console.log('\nWITH practice:', JSON.stringify({ exemplars: all.exemplars.length, lengthLean: all.lengthLean, counts: all.counts }));
console.log('WITHOUT practice:', JSON.stringify({ exemplars: noP.exemplars.length, lengthLean: noP.lengthLean, counts: noP.counts }));
console.log('ONLY practice:', JSON.stringify({ exemplars: onlyP.exemplars.length, lengthLean: onlyP.lengthLean, counts: onlyP.counts }));
const setNo = new Set(noP.exemplars);
console.log('\nExemplars WITH practice (newest first; * = only present because of practice / displaced):');
all.exemplars.forEach((e,i)=> console.log(' ', i+1, setNo.has(e)?' ':'*', e));
const setAll = new Set(all.exemplars);
console.log('\nExemplars WITHOUT practice that were pushed OUT by practice:');
noP.exemplars.filter(e=>!setAll.has(e)).forEach(e=>console.log('  -', e));
const pex = new Set(onlyP.exemplars);
console.log('\nPractice-origin exemplars in the WITH set:', all.exemplars.filter(e=>pex.has(e) && !setNo.has(e)).length);
