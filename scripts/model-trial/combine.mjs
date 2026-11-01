/*
 * Un-blind the judges' verdicts and put them beside the measurements.
 *
 * Reads results.json, key.json and every judge-*.json in Reports/model-trial-<date>/,
 * and writes summary.md: wait and cost per model, each judge's wins per MODEL (not per
 * letter), the moments where the judges disagree (those go to Ken), every rule break
 * by model, and a few mechanical checks a program can make on its own.
 *
 * Run:  node --no-warnings scripts/model-trial/combine.mjs [date]
 */
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const dir = path.join(ROOT, 'Reports', `model-trial-${date}`);
const { summary, results } = JSON.parse(readFileSync(path.join(dir, 'results.json'), 'utf8'));
const key = JSON.parse(readFileSync(path.join(dir, 'key.json'), 'utf8'));
const judges = readdirSync(dir).filter((f) => /^judge-.*\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));

const short = (m) => (m.includes('haiku') ? 'Haiku' : 'Sonnet');
const L = [`# Haiku 5.5 against Sonnet 5.5 - ${date}`, ''];

L.push('## Speed and cost', '', '| | Sonnet 5.5 | Haiku 5.5 |', '|---|---|---|');
const s = summary.sonnet, h = summary.haiku;
const row = (label, a, b) => L.push(`| ${label} | ${a} | ${b} |`);
row('Sets of suggestions', s.sets, h.sets);
row('Failed / declined', `${s.failed} / ${s.refused}`, `${h.failed} / ${h.refused}`);
row('Typical wait', `${(s.waitMedianMs / 1000).toFixed(1)} s`, `${(h.waitMedianMs / 1000).toFixed(1)} s`);
row('Slowest tenth starts at', `${(s.wait90Ms / 1000).toFixed(1)} s`, `${(h.wait90Ms / 1000).toFixed(1)} s`);
row('Waits over 4 seconds', s.over4s, h.over4s);
row('Typical cost per set', `${s.costPerSetMedianCents.toFixed(3)} cents`, `${h.costPerSetMedianCents.toFixed(3)} cents`);
row('Share of the prompt read from cache', `${Math.round(s.cacheReadShare * 100)}%`, `${Math.round(h.cacheReadShare * 100)}%`);
L.push('');

// ---- judges, un-blinded ----
const verdicts = {};   // id -> [{ judge, winner: 'Haiku'|'Sonnet'|'tie', strength, why }]
const breaks = { Haiku: [], Sonnet: [] };
for (const j of judges) {
    for (const v of j.moments || []) {
        const k = key[v.id];
        if (!k) continue;
        const winner = v.better === 'tie' ? 'tie' : short(k[v.better]);
        (verdicts[v.id] ||= []).push({ judge: j.judge, winner, strength: v.strength, why: v.why });
        for (const letter of ['A', 'B']) {
            for (const b of (v.ruleBreaks && v.ruleBreaks[letter]) || []) {
                breaks[short(k[letter])].push(`${v.id} (${j.judge}): ${b}`);
            }
        }
    }
}

L.push('## What the judges preferred', '', '| Judge | Sonnet better | Haiku better | Tie |', '|---|---|---|---|');
for (const j of judges) {
    const vs = Object.values(verdicts).flat().filter((v) => v.judge === j.judge);
    const c = (w, st) => vs.filter((v) => v.winner === w && (!st || v.strength === st)).length;
    L.push(`| ${j.judge} | ${c('Sonnet')} (${c('Sonnet', 'clear')} clear) | ${c('Haiku')} (${c('Haiku', 'clear')} clear) | ${c('tie')} |`);
}
L.push('');

const agree = [], split = [];
for (const [id, vs] of Object.entries(verdicts)) {
    const ws = new Set(vs.map((v) => v.winner));
    if (vs.length < 2) continue;
    if (ws.size === 1) agree.push([id, vs[0].winner]);
    else split.push([id, vs]);
}
const agreeCount = (w) => agree.filter(([, x]) => x === w).length;
L.push(`Both judges agreed on ${agree.length} of ${Object.keys(verdicts).length} moments: Sonnet ${agreeCount('Sonnet')}, Haiku ${agreeCount('Haiku')}, tie ${agreeCount('tie')}.`, '');

// A real disagreement is one judge picking Sonnet and the other Haiku. One picking a
// model and the other calling it a tie is a weaker split and is listed separately.
const opposite = split.filter(([, vs]) => vs.some((v) => v.winner === 'Sonnet') && vs.some((v) => v.winner === 'Haiku'));
const soft = split.filter((x) => !opposite.includes(x));
L.push('## Where the judges disagree', '');
L.push(`**Opposite verdicts (${opposite.length})** - one judge preferred Sonnet, the other Haiku. These are the ones for Ken.`, '');
for (const [id, vs] of opposite) {
    L.push(`- **${id}**`);
    for (const v of vs) L.push(`  - ${v.judge}: ${v.winner} (${v.strength || ''}) - ${v.why}`);
}
L.push('', `**One judge saw a difference, the other a tie (${soft.length}):** ${soft.map(([id, vs]) => `${id} (${vs.find((v) => v.winner !== 'tie').winner})`).join(', ') || 'none'}`, '');

L.push('## Rule breaks the judges found', '');
for (const m of ['Sonnet', 'Haiku']) {
    L.push(`**${m}** (${breaks[m].length})`, '');
    for (const b of breaks[m]) L.push(`- ${b}`);
    L.push('');
}

// ---- mechanical checks ----
const EMPTY_OPENERS = /^(um|uh|er|well|so|oh|ah|hmm|you know)\b/i;
const mech = { Sonnet: [], Haiku: [] };
for (const r of results) {
    for (const a of ['sonnet', 'haiku']) {
        const run = r.runs[a];
        const M = a === 'haiku' ? 'Haiku' : 'Sonnet';
        for (const o of run.options || []) {
            if (EMPTY_OPENERS.test(o.text.trim())) mech[M].push(`${r.moment.id}: empty opening - "${o.text}"`);
            if (/[^\x00-\x7F’‘“”—–éñáíóú]/.test(o.text)) mech[M].push(`${r.moment.id}: unusual character - "${o.text}"`);
            if (r.moment.id === 'P1-fact' && /18\d\d/.test(o.text)) mech[M].push(`P1-fact: states a year - "${o.text}"`);
        }
        const c = run.classification || {};
        if (r.moment.id === 'P4-menu' && !(c.offered_options || []).length) mech[M].push('P4-menu: the menu was not recognized');
        if (r.moment.id === 'P5-what' && !c.is_repair_initiator) mech[M].push('P5-what: "What?" not recognized as a repeat request');
        if (r.moment.id === 'P6-bye' && c.partner_action !== 'CLOSING') mech[M].push(`P6-bye: goodbye read as ${c.partner_action}`);
        if (r.moment.id === 'P8-scale' && !c.offered_range) mech[M].push('P8-scale: the 1-10 range was not recognized');
        const n = (run.options || []).length;
        if (run.ok && n && n !== 4 && !(c.offered_options || []).length && c.partner_action !== 'CLOSING') mech[M].push(`${r.moment.id}: ${n} options instead of 4`);
    }
}
L.push('## Mechanical checks', '', 'Things a program can check without judgment: empty openings, odd characters, a year in the fact question, and whether a menu, a "What?", a goodbye and a 1-10 scale were recognized.', '');
for (const m of ['Sonnet', 'Haiku']) {
    L.push(`**${m}:** ${mech[m].length ? '' : 'nothing found'}`);
    for (const x of mech[m]) L.push(`- ${x}`);
    L.push('');
}

writeFileSync(path.join(dir, 'summary.md'), L.join('\n'));
console.log(L.join('\n'));
