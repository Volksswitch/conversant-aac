import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const { PERSONAS } = require(resolve(ROOT, 'scripts/doc-generators/persona-data.js'));
const sc = await import(pathToFileURL(resolve(ROOT, 'app/js/sound-check-items.js')).href);
const items = sc.SOUND_CHECK_ITEMS;
const rows = [];
for (const p of PERSONAS) {
  const picks = items.map(it => { const v = p.soundCheck?.[it.id]; return v === undefined ? '-' : (typeof v === 'number' ? String(v) : v[0]); });
  rows.push({ id: p.id, age: p.topics?.age_birthyear, picks });
}
console.log('item order:', items.map(i=>i.id).join(','));
for (const r of rows) console.log(r.id.padEnd(16), (r.age||'').padEnd(16), r.picks.join(' '));
console.log('\npairwise agreement (items identical / ' + items.length + ')');
for (let i=0;i<rows.length;i++) { let line = rows[i].id.slice(0,8).padEnd(9); for (let j=0;j<rows.length;j++){ let s=0; for(let k=0;k<items.length;k++) if(rows[i].picks[k]===rows[j].picks[k]) s++; line += String(s).padStart(4);} console.log(line); }
console.log('\nper-item distribution of picks across personas:');
for (let k=0;k<items.length;k++){ const c={}; for(const r of rows) c[r.picks[k]]=(c[r.picks[k]]||0)+1; console.log(items[k].id.padEnd(20), JSON.stringify(c)); }
// distinct profiles
console.log('\ndistinct profiles:', new Set(rows.map(r=>r.picks.join(''))).size, 'of', rows.length);
// how many personas pick index that is the terse end per item: report mean
for (const p of PERSONAS) {
  const q = (p.quickRead||[]).join(' ');
  const m = q.match(/[^.]*(says|short|snappy|talk|voice|writes|formal|blunt|wordy|chatty)[^.]*\./gi);
  console.log('\n' + p.id + ': ' + (m ? m.join(' | ') : ''));
}
