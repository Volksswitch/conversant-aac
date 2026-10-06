// Is the length lean measuring the person or the palette's shape?
// Compares the real lean against picker policies that know nothing about the user.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.cwd();
const vh = await import(pathToFileURL(resolve(ROOT, 'app/js/voice-harvest.js')).href);
const dir = resolve(ROOT, 'test-data-folder/conversations');
const turns = [];
for (const n of readdirSync(dir).filter((n) => n.endsWith('.json') && !n.endsWith('.review.json'))) {
    const d = JSON.parse(readFileSync(resolve(dir, n), 'utf8'));
    for (const e of d.exchanges || []) if (e.role === 'user' && e.source === 'card' && (e.allOptions || []).length >= 2) turns.push(e);
}
const w = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const out = [];
const lean = (label, ts) => { const r = vh.measureLengthLean(ts, {}); out.push(label.padEnd(52) + JSON.stringify(r)); };
lean('actual picks', turns);
for (const k of [0, 1, 2, 3]) lean(`always pick position ${k}`, turns.map((t) => ({ ...t, selectedText: t.allOptions[k] || t.allOptions[0] })));
lean('always pick the SHORTEST offered', turns.map((t) => ({ ...t, selectedText: [...t.allOptions].sort((a, b) => w(a) - w(b))[0] })));
lean('always pick the LONGEST offered', turns.map((t) => ({ ...t, selectedText: [...t.allOptions].sort((a, b) => w(b) - w(a))[0] })));
// uniform random picker, expected over all choices
let s = 0, l = 0, lv = 0;
for (const t of turns) {
    const lens = t.allOptions.map(w).sort((a, b) => a - b);
    const mid = lens.length % 2 ? lens[(lens.length - 1) / 2] : (lens[lens.length / 2 - 1] + lens[lens.length / 2]) / 2;
    for (const o of t.allOptions) { const n = w(o); if (n < mid) s += 1 / t.allOptions.length; else if (n > mid) l += 1 / t.allOptions.length; else lv += 1 / t.allOptions.length; }
}
out.push('uniform-random picker (expected)'.padEnd(52) + JSON.stringify({ shorter: +s.toFixed(1), longer: +l.toFixed(1), level: +lv.toFixed(1) }));
// how often the last (REPAIR/CHOICE_OTHER) position is the shortest offered
let lastShortest = 0, n4 = 0;
for (const t of turns) { if (t.allOptions.length !== 4) continue; n4++; const lens = t.allOptions.map(w); if (lens[3] <= Math.min(...lens)) lastShortest++; }
out.push(`4-card palettes: position 3 is (joint) shortest in ${lastShortest} of ${n4}`);
// mean words by position
const pos = [0, 1, 2, 3].map((k) => { const v = turns.filter((t) => t.allOptions[k]).map((t) => w(t.allOptions[k])); return (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); });
out.push('mean words by position 0..3: ' + pos.join(' / '));
const text = out.join('\n');
console.log(text);
writeFileSync(resolve(process.argv[2], 'lean-bias.txt'), text);
