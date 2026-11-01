/*
 * Hide which model wrote which set, so the quality judges cannot tell.
 *
 * Reads Reports/model-trial-<date>/results.json and writes, beside it:
 *   - blinded.md   every moment with its two sets labeled A and B, in an order shuffled
 *                  per moment (seeded, so a re-run gives the same file);
 *   - persona.md   who the user is, built by the app's own builders, so a judge knows
 *                  what "sounds like Marc" and what Marc has actually told the app;
 *   - key.json     which of A and B is which model. Judges must not be shown this.
 *
 * Run:  node --no-warnings scripts/model-trial/blind.mjs [date]
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TD = path.join(ROOT, 'test-data-folder');
const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const dir = path.join(ROOT, 'Reports', `model-trial-${date}`);
const { results } = JSON.parse(readFileSync(path.join(dir, 'results.json'), 'utf8'));

// A small seeded generator, so the blinding is repeatable.
let seed = 20261031;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const key = {};
const L = ['# Response options to judge', '',
    'Each moment shows what the other person just said (and the conversation before it), then two sets of response options, A and B, written by two different systems for the same moment. The user taps one option and the device speaks it as the user.', ''];

const fmt = (run) => {
    if (!run.ok) return [run.refused ? '- *(the system declined to answer)*' : '- *(no usable options came back)*'];
    if (!run.options.length) return ['- *(no options)*'];
    const out = run.options.map((o) => `- **${o.slot}:** ${o.text}${o.hint && o.hint !== o.text ? `  _(short label: ${o.hint})_` : ''}`);
    const c = run.classification || {};
    out.push(`- _How it read the other person's turn: ${c.partner_action || '?'}${c.is_repair_initiator ? ', asking the user to repeat' : ''}${(c.offered_options || []).length ? `, choices offered: ${c.offered_options.join(' / ')}` : ''}${c.offered_range ? `, a number range: ${JSON.stringify(c.offered_range)}` : ''}_`);
    return out;
};

for (const row of results) {
    const m = row.moment;
    const flip = rand() < 0.5;
    const A = flip ? 'haiku' : 'sonnet';
    const B = flip ? 'sonnet' : 'haiku';
    key[m.id] = { A: row.runs[A].model, B: row.runs[B].model };
    L.push(`## ${m.id}`, '');
    L.push(`*Talking with:* ${m.who}${m.placeId ? ` · *at:* ${m.placeId.replace(/^pl-/, '').replace(/-/g, ' ')}` : ''}${m.practice ? ` · *practice role-play:* ${m.practice}` : ''}`, '');
    if (m.look) L.push(`*What to check here:* ${m.look}`, '');
    for (const h of m.history.slice(-8)) L.push(`> **${h.role === 'user' ? 'Marc' : m.who}:** ${h.text}`);
    if (m.history.length > 8) L.splice(L.length - 8, 0, `> _(${m.history.length - 8} earlier turns not shown)_`);
    L.push(`> **${m.who}:** ${m.partner}`, '');
    L.push('**Set A**', ...fmt(row.runs[A]), '', '**Set B**', ...fmt(row.runs[B]), '');
}
writeFileSync(path.join(dir, 'blinded.md'), L.join('\n'));
writeFileSync(path.join(dir, 'key.json'), JSON.stringify(key, null, 2));

// ---- persona, from the app's own builders (no network) ----
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
await imp('tests/env.mjs');
globalThis.fetch = async (url) => {
    const m = String(url).match(/data\/([\w.-]+\.json)$/);
    const text = readFileSync(path.join(ROOT, 'app/data', m[1]), 'utf8');
    return { ok: true, status: 200, async json() { return JSON.parse(text); }, async text() { return text; } };
};
const read = (f) => readFileSync(path.join(TD, f), 'utf8');
localStorage.setItem('aac_worldview', read('worldview.json'));
localStorage.setItem('aac_relationships', read('relationships.json'));
localStorage.setItem('aac_places', read('places.json'));
localStorage.setItem('aac_voice', read('voice.json'));
localStorage.setItem('aac_express_items', read('express-panel.json'));
const worldview = await imp('app/js/worldview.js');
const relationships = await imp('app/js/relationships.js');
const places = await imp('app/js/places.js');
const voice = await imp('app/js/voice.js');
const expressPanel = await imp('app/js/express-panel.js');
await worldview.loadRegistry(); await worldview.load(); await relationships.load();
await places.load(); await voice.load(); await expressPanel.load();
const idiom = expressPanel.userAuthoredItems().filter((it) => it.type === 'phrase' && it.text).map((it) => it.text);
writeFileSync(path.join(dir, 'persona.md'), [
    '# The user: Marc (a made-up test user)', '',
    'This is what the app tells the AI about him. Every option must be something Marc could plausibly say, and must not state facts about his life that are not here or in the conversation.', '',
    '## About Marc', worldview.buildBlock(), '',
    '## People in his life', relationships.buildBlock(), '',
    '## Places', places.buildBlock(null), '',
    '## How he sounds', voice.buildBlock(idiom), '',
].join('\n'));
console.log('Wrote blinded.md, persona.md and key.json to', dir);
