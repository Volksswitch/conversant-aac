import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = 'C:/Users/ken/OneDrive/4 T-Z/Volksswitch/AI-driven AAC';
const sc = await import(pathToFileURL(ROOT + '/app/js/sound-check-items.js').href);
const vh = await import(pathToFileURL(ROOT + '/app/js/voice-harvest.js').href);
const require = createRequire(import.meta.url);
const { PERSONAS } = require(ROOT + '/scripts/doc-generators/persona-data.js');
// App's own tokenizer (voice-harvest.js:42-44): whitespace split -> dashes count as words.
const tok = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
// Lexical words only (drop tokens with no letter/digit, i.e. a lone dash).
const lex = (t) => String(t || '').trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const ITEMS = sc.SOUND_CHECK_ITEMS;
console.log('items', ITEMS.length);
console.log('\n## (1) Candidate word counts  [app tokenizer / lexical]');
for (const it of ITEMS) {
  console.log(`${it.id.padEnd(20)} ${it.dimension.padEnd(10)} leads=${String(it.leads).padEnd(8)} ` +
    it.candidates.map((c, i) => `${i}:${tok(c)}/${lex(c)}`).join('  ') + '   | ' + it.candidates.map((c) => JSON.stringify(c)).join(' / '));
}
function rankOf(it, idx, f) {
  const L = it.candidates.map(f), n = L[idx], mn = Math.min(...L), mx = Math.max(...L);
  const tiedMin = L.filter((x) => x === mn).length > 1, tiedMax = L.filter((x) => x === mx).length > 1;
  if (n === mn) return tiedMin ? 'shortest(tie)' : 'shortest';
  if (n === mx) return tiedMax ? 'longest(tie)' : 'longest';
  return 'middle';
}
const itemMean = (it, f) => it.candidates.map(f).reduce((a, b) => a + b, 0) / it.candidates.length;
const economyIds = new Set(ITEMS.filter((i) => i.dimension === 'economy').map((i) => i.id));
console.log('\neconomy items:', [...economyIds].join(', '));
console.log('\n## (2) Per persona (app tokenizer)');
const rows = [];
for (const p of PERSONAS) {
  const c = { shortest: 0, 'shortest(tie)': 0, middle: 0, longest: 0, 'longest(tie)': 0 };
  let pickSum = 0, meanSum = 0, n = 0, minSum = 0, maxSum = 0; const esc = [];
  const pseudo = []; const pseudoEcon = [];
  const lexC = { shortest: 0, 'shortest(tie)': 0, middle: 0, longest: 0, 'longest(tie)': 0 };
  for (const it of ITEMS) {
    const v = p.soundCheck[it.id];
    if (typeof v !== 'number') { esc.push(`${it.id}=${v}`); continue; }
    c[rankOf(it, v, tok)]++; lexC[rankOf(it, v, lex)]++;
    pickSum += tok(it.candidates[v]); meanSum += itemMean(it, tok); n++;
    minSum += Math.min(...it.candidates.map(tok)); maxSum += Math.max(...it.candidates.map(tok));
    const t = { role: 'user', source: 'card', selectedText: it.candidates[v], allOptions: it.candidates.slice() };
    pseudo.push(t); if (economyIds.has(it.id)) pseudoEcon.push(t);
  }
  const lean = vh.measureLengthLean(pseudo, {});
  const leanE = vh.measureLengthLean(pseudoEcon, {});
  const shortShare = (c.shortest + c['shortest(tie)']) / n;
  rows.push({ id: p.id, n, ...c, pickMean: pickSum / n, itemMean: meanSum / n, minMean: minSum / n, maxMean: maxSum / n, shortShare, lean, leanE, esc, lexC });
}
for (const r of rows) {
  console.log(`${r.id.padEnd(16)} n=${r.n} S=${r.shortest}+${r['shortest(tie)']}t M=${r.middle} L=${r.longest}+${r['longest(tie)']}t ` +
    `pickMean=${r.pickMean.toFixed(2)} itemMean=${r.itemMean.toFixed(2)} (floor ${r.minMean.toFixed(2)}, ceil ${r.maxMean.toFixed(2)}) ` +
    `shortestShare=${(100 * r.shortShare).toFixed(0)}% measureLengthLean(all)=${JSON.stringify(r.lean)} econ-only=${JSON.stringify(r.leanE)} esc=${r.esc.join(',')} lexRanks=${JSON.stringify(r.lexC)}`);
}
// position-bias check: which index each persona picked
console.log('\n## index distribution per persona');
for (const p of PERSONAS) { const d = [0, 0, 0]; for (const it of ITEMS) { const v = p.soundCheck[it.id]; if (typeof v === 'number') d[v]++; } console.log(p.id.padEnd(16), d.join(' ')); }
import { writeFileSync } from 'node:fs';
writeFileSync('rows.json', JSON.stringify(rows, null, 1));
