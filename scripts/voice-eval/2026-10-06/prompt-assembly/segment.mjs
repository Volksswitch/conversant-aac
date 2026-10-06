// Segment the rendered prompt into named pieces, size them, and tally by kind.
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm/prompt-assembly';
const file = process.argv[2] || 'marc-prompt.txt';
const raw = readFileSync(`${OUT}/${file}`, 'utf8');
const b1 = raw.split(/===== SYSTEM BLOCK 1[^\n]*\n/)[1].split(/\n\n===== SYSTEM BLOCK 2/)[0];
const b2 = raw.split(/===== SYSTEM BLOCK 2[^\n]*\n/)[1].split(/\n\n===== MESSAGES/)[0];
const full = b1 + b2;

// [name, startMarker, kind, about]  kind: CONSTRAINT | DESCRIPTION | EXEMPLAR | PREFERENCE | TASK
// about: HOW (how user talks) | WHAT (what user knows/likes/is) | MECH (mechanics/format/classification) | SAFETY
const marks = [
    ['F01 role preamble', 'You are an AAC (Augmentative', 'TASK', 'MECH'],
    ['F02 JSON shape', 'Return ONLY a JSON object', 'TASK', 'MECH'],
    ['F03 anti-fabrication (autobiography)', 'Speak only to what is real', 'CONSTRAINT', 'SAFETY'],
    ['F04 NO_OUTSIDE_KNOWLEDGE', 'You are voicing a person, NOT an information service', 'CONSTRAINT', 'SAFETY'],
    ['F05 two-rules bridge / do-not-over-apply', 'Those two rules are the same rule', 'CONSTRAINT', 'SAFETY'],
    ['F06 classification incl. CLOSING, offered_options, offered_range', 'Classification (commit to these', 'TASK', 'MECH'],
    ['F07 closed-set palette rules', 'CLOSED-SET TURNS override', 'CONSTRAINT', 'MECH'],
    ['F08 four-slot definitions', 'Responses — the four structural slots', 'CONSTRAINT', 'HOW'],
    ['F09 user-is-leading', 'User is leading:', 'CONSTRAINT', 'MECH'],
    ['F10 SPEAKABLE', 'EVERYTHING YOU WRITE WILL BE SPOKEN ALOUD', 'CONSTRAINT', 'HOW'],
    ['F11 NO_VULGARITY', 'No vulgarity.', 'CONSTRAINT', 'HOW'],
    ['F12 NO_EMPTY_INTERJECTION', 'Get to the point: NO response', 'CONSTRAINT', 'HOW'],
    ['F13 missing_facts/missing_other/heard_uncertain + key list', '- "missing_facts": personal facts', 'TASK', 'MECH'],
    ['V1 Sound Check picks (17 bland)', 'HOW THIS USER SOUNDS', 'PREFERENCE', 'HOW'],
    ['V2 Sound Check levity picks (3)', 'Offered a flat reply and a lighter one', 'PREFERENCE', 'HOW'],
    ['V3 harvested composed sentences', 'Sentences this user has actually written themselves', 'EXEMPLAR', 'HOW'],
    ['V4 measured length lean', 'Offered a choice of wordings in real conversations', 'PREFERENCE', 'HOW'],
    ['V5 Express idiom (user-authored buttons)', 'Words and turns of phrase this user actually uses', 'EXEMPLAR', 'HOW'],
    ['V6 never-says list', 'This user never says:', 'CONSTRAINT', 'HOW'],
    ['W01 worldview header + flat facts', 'You are speaking AS this person, in the first person', 'DESCRIPTION', 'WHAT'],
    ['W02 traits (B1+B4)', 'How this person describes themselves:', 'DESCRIPTION', 'HOW'],
    ['W03 private facts', 'These details are known to you for context', 'DESCRIPTION', 'WHAT'],
    ['W04 topics to avoid', 'This person would rather not be asked about', 'CONSTRAINT', 'WHAT'],
    ['W05 expertise', 'This person knows the following subjects WELL', 'DESCRIPTION', 'WHAT'],
    ['W06 humor (B2)', 'How this person does humor.', 'DESCRIPTION', 'HOW'],
    ['W07 outlook', 'Their general outlook on things:', 'DESCRIPTION', 'HOW'],
    ['W08 conflict style', 'When there is tension or disagreement', 'DESCRIPTION', 'HOW'],
    ['W09 register by group (B6)', 'How this person shifts depending on who', 'DESCRIPTION', 'HOW'],
    ['W10 understand (B7)', 'Something this person wants people to understand', 'DESCRIPTION', 'HOW'],
    ['W11 beliefs (B5)', 'The most sensitive things in this profile', 'CONSTRAINT', 'WHAT'],
    ['W12 seek topics', 'This person always enjoys talking about', 'DESCRIPTION', 'WHAT'],
    ['W13 declined phrase-around', 'The person chose not to share these', 'CONSTRAINT', 'WHAT'],
    ['R1 relationships', 'People in my life:', 'DESCRIPTION', 'WHAT'],
    ['P1 places', 'Places I go:', 'DESCRIPTION', 'WHAT'],
    ['N1 no-brackets', 'Never output placeholder text in square brackets', 'CONSTRAINT', 'MECH'],
    // block 2
    ['S1 partner identity line', 'You are currently talking with', 'DESCRIPTION', 'MECH'],
    ['S2 partner block header', 'How this user speaks WITH', 'CONSTRAINT', 'HOW'],
    ['S3 partner register clauses', 'Talking with ', 'DESCRIPTION', 'HOW'],
    ['S4 partner standing goals', 'Over time, what this user wants', 'DESCRIPTION', 'WHAT'],
    ['S5 partner note (user prose)', "In the user's own words about talking with", 'DESCRIPTION', 'HOW'],
    ['T1 engine context', 'Conversation context (engine state', 'TASK', 'MECH'],
    ['T2 extra names', 'Names already added from earlier conversations', 'TASK', 'MECH'],
];
const found = [];
for (const [name, mark, kind, about] of marks) {
    // find first occurrence after previous segment start
    const from = found.length ? found[found.length - 1].start + 1 : 0;
    const i = full.indexOf(mark, from);
    if (i < 0) continue;
    found.push({ name, start: i, kind, about });
}
// The "Talking with " marker can collide; S3 must come after S2.
for (let k = 0; k < found.length; k++) found[k].end = k + 1 < found.length ? found[k + 1].start : full.length;
const rows = found.map((s) => ({ ...s, chars: s.end - s.start, tokens: Math.round((s.end - s.start) / 4) }));
// Correction: F10-F12 are injected between F09 and F13 in the source; the four-slot block F08 also carries HOW-shaping lines.
const tot = full.length;
const by = (key) => { const o = {}; for (const r of rows) o[r[key]] = (o[r[key]] || 0) + r.chars; return o; };
const pct = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v} chars / ~${Math.round(v / 4)} tok / ${(100 * v / tot).toFixed(1)}%`]));
const lines = [];
lines.push(`TOTAL system text: ${tot} chars (~${Math.round(tot / 4)} tokens); block1(cached)=${b1.length}, block2=${b2.length}; unsegmented leading chars=${rows[0].start}`);
for (const r of rows) lines.push(`${r.name.padEnd(62)} ${String(r.chars).padStart(6)} ch ~${String(r.tokens).padStart(5)} tok  ${r.kind.padEnd(11)} ${r.about}`);
lines.push('', 'BY KIND:', JSON.stringify(pct(by('kind')), null, 1), '', 'BY ABOUT:', JSON.stringify(pct(by('about')), null, 1));
// fixed vs user-specific
const userSpecific = rows.filter((r) => /^(V|W|R|P|S)/.test(r.name)).reduce((n, r) => n + r.chars, 0);
lines.push('', `USER-SPECIFIC (V,W,R,P,S): ${userSpecific} chars (${(100 * userSpecific / tot).toFixed(1)}%); FIXED (F,N,T): ${tot - userSpecific} chars (${(100 * (tot - userSpecific) / tot).toFixed(1)}%)`);
const how = rows.filter((r) => /^(V|W|R|P|S)/.test(r.name) && r.about === 'HOW').reduce((n, r) => n + r.chars, 0);
const what = rows.filter((r) => /^(V|W|R|P|S)/.test(r.name) && r.about === 'WHAT').reduce((n, r) => n + r.chars, 0);
lines.push(`Within user-specific: HOW=${how} (${(100 * how / userSpecific).toFixed(1)}%), WHAT=${what} (${(100 * what / userSpecific).toFixed(1)}%), MECH=${userSpecific - how - what}`);
writeFileSync(`${OUT}/sizes-${file.replace('.txt', '')}.txt`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
