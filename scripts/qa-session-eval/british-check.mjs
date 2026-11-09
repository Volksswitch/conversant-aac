// Lists British spellings, words and phrases (from writing-conventions.json) found in a
// question-session results file. Usage: node british-check.mjs <results.md>
import fs from 'node:fs';

const conv = JSON.parse(fs.readFileSync(new URL('../../writing-conventions.json', import.meta.url), 'utf8'));
const first = (x) => (Array.isArray(x) ? x[0] : x);
const flatten = (v) => (Array.isArray(v) ? v.map(first) : Object.keys(v || {}));
const terms = [conv.britishSpellings, conv.britishVocabulary, conv.britishPhrases]
    .flatMap(flatten).filter((t) => typeof t === 'string' && t.trim());

const text = fs.readFileSync(process.argv[2], 'utf8').toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hits = terms.filter((t) => new RegExp(`\\b${esc(t.toLowerCase())}\\b`).test(text));
console.log(`${terms.length} British terms checked; found: ${hits.length ? hits.join(', ') : 'none'}`);
