import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = 'C:/Users/ken/OneDrive/4 T-Z/Volksswitch/AI-driven AAC';
const sc = await import(pathToFileURL(ROOT + '/app/js/sound-check-items.js').href);
const vh = await import(pathToFileURL(ROOT + '/app/js/voice-harvest.js').href);
const { PERSONAS } = createRequire(import.meta.url)(ROOT + '/scripts/doc-generators/persona-data.js');
const tok = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const ITEMS = sc.SOUND_CHECK_ITEMS;
// Which direction can the app's median rule register per item?
console.log('## items where measureLengthLean median rule cannot register one direction');
for (const it of ITEMS) { const L = it.candidates.map(tok); const s=[...L].sort((a,b)=>a-b); const m=s[1];
  const canS = L.some(x=>x<m), canL = L.some(x=>x>m); if(!canS||!canL) console.log(' ', it.id, L.join(','), 'median', m, canS?'':'NO-shorter', canL?'':'NO-longer'); }
// Is the marked/expressive end of each non-economy dimension also the longest candidate?
const DESC = { 'marc-delgado':'short','diego-fuentes':'short','emily-sorenson':'detail','grace-thompson':'detail','hannah-goldberg':'detail','jamal-carter':'short','liam-obrien':'short','noah-kim':'short (concise, thorough when accuracy requires)','priya-nair':'detail (some)','sofia-reyes':'mixed (detail when it matters; brief in casual chat)' };
const subsets = { all: () => true, noLevity: (it) => it.dimension !== 'levity', economy: (it) => it.dimension === 'economy' };
console.log('\n## per persona: normalized position NP=(len-min)/(max-min) mean; shortest/longest share (ties count); app median-rule counts');
const out = [];
for (const p of PERSONAS) {
  const r = { id: p.id, desc: DESC[p.id] };
  for (const [k, f] of Object.entries(subsets)) {
    const its = ITEMS.filter(f).filter((it) => typeof p.soundCheck[it.id] === 'number');
    let np = 0, sh = 0, lo = 0; const turns = [];
    for (const it of its) { const L = it.candidates.map(tok), v = p.soundCheck[it.id], n = L[v], mn = Math.min(...L), mx = Math.max(...L);
      np += (n - mn) / (mx - mn); if (n === mn) sh++; if (n === mx) lo++;
      turns.push({ role: 'user', source: 'card', selectedText: it.candidates[v], allOptions: it.candidates }); }
    // median rule counts computed directly (measureLengthLean returns null below 6)
    let s = 0, l = 0, lv = 0; for (const t of turns) { const L = t.allOptions.map(tok).sort((a,b)=>a-b); const m = L[1]; const n = tok(t.selectedText); if (n < m) s++; else if (n > m) l++; else lv++; }
    const dec = s + l; const lean = dec ? (s/dec >= .6 ? 'shorter' : l/dec >= .6 ? 'longer' : 'neither') : 'neither';
    r[k] = { n: its.length, NP: +(np / its.length).toFixed(2), shortestShare: +(sh / its.length).toFixed(2), longestShare: +(lo / its.length).toFixed(2), s, l, lv, lean };
  }
  out.push(r);
  console.log(p.id.padEnd(16), `desc=${r.desc}`);
  for (const k of Object.keys(subsets)) console.log('   ', k.padEnd(9), JSON.stringify(r[k]));
}
console.log('\n## per persona per item: pick index (len) [S/M/L]');
const hdr = ITEMS.map((it) => it.id.split('-').map(s=>s.slice(0,4)).join('-'));
for (const p of PERSONAS) {
  const cells = ITEMS.map((it) => { const L = it.candidates.map(tok), v = p.soundCheck[it.id]; if (typeof v !== 'number') return `${it.id}:${v}`; const n=L[v], mn=Math.min(...L), mx=Math.max(...L); return `${it.id}:${v}(${n})${n===mn?'S':n===mx?'L':'M'}`; });
  console.log(p.id.padEnd(16), cells.join(' '));
}
// per-dimension mean NP across personas
console.log('\n## per-dimension NP by persona');
const dims = [...new Set(ITEMS.map(i=>i.dimension))];
console.log('persona'.padEnd(16), dims.map(d=>d.padEnd(10)).join(''));
for (const p of PERSONAS) { console.log(p.id.padEnd(16), dims.map(d=>{ const its=ITEMS.filter(i=>i.dimension===d); let s=0; for (const it of its){ const L=it.candidates.map(tok), v=p.soundCheck[it.id]; s+=(L[v]-Math.min(...L))/(Math.max(...L)-Math.min(...L)); } return (s/its.length).toFixed(2).padEnd(10); }).join('')); }
import { writeFileSync } from 'node:fs'; writeFileSync('rows2.json', JSON.stringify(out, null, 1));
