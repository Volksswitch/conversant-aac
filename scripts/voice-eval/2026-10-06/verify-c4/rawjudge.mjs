// Re-ask a few judge pairs with the experiment's exact prompts and capture the RAW reply
// (block types + text + output tokens). The key is never printed.
import { readFileSync, writeFileSync } from 'node:fs';
const EXP = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm/exp-review';
const L = await import('file:///' + EXP + '/lib.mjs');
const { REFERENCE, HELD_OUT, VARIANT_B } = await import('file:///' + EXP + '/spec.mjs');
L.llm.setApiKey(L.env.loadApiKey());
const judge = JSON.parse(readFileSync(EXP + '/judge.json', 'utf8'));
const TURN = Object.fromEntries([...HELD_OUT, ...VARIANT_B].map((t) => [t.id, t]));
const SYS_VOICE = `You compare two candidates in a voice-matching study. A non-speaking 17-year-old named Marc uses a device that suggests what he might say next. You get lines Marc has really said in other situations (his voice reference), the situation, and two candidates. Decide which candidate sounds more like Marc. Judge ONLY voice: word choice, length, rhythm, formality, attitude and humor. Ignore which is more polite, more correct or more helpful, and do not reward copying words from the reference. Reply with exactly one character: A, B, or T (T only if they are equally like him).`;
function userMsg(turn, a, b, unit) {
  const sit = `Situation: Marc is talking with ${turn.who}. They just said: "${turn.text}"`;
  const ref = `Marc's voice reference (lines he has said elsewhere):\n${REFERENCE.map((x) => `- ${x}`).join('\n')}`;
  if (unit === 'palette') return `${ref}\n\n${sit}\n\nThe device shows four suggestions at once and Marc picks one.\n\nSuggestion set A:\n${a}\n\nSuggestion set B:\n${b}\n\nWhich SET sounds more like Marc overall? Answer A, B, or T.`;
  return `${ref}\n\n${sit}\n\nCandidate A: "${a}"\nCandidate B: "${b}"\n\nWhich sounds more like Marc? Answer A, B, or T.`;
}
const native = globalThis.fetch; const raws = [];
globalThis.fetch = async (url, init) => { const r = await native(url, init); const c = r.clone(); try { const d = await c.json(); raws.push({ types: (d.content || []).map((b) => b.type), texts: (d.content || []).map((b) => (b.text || b.thinking || '').slice(0, 300)), out: d.usage && d.usage.output_tokens, stop: d.stop_reason }); } catch (e) { raws.push({ err: String(e) }); } return r; };
const pick = [];
const voice = judge.comparisons.filter((c) => c.kind === 'voice' && !c.identical && c.v);
for (const [unit, pat, n] of [['preferred', 'AA', 3], ['palette', 'AA', 2], ['preferred', 'AB', 1]]) pick.push(...voice.filter((c) => c.unit === unit && c.v.join('') === pat).slice(0, n));
const out = [];
for (const c of pick) {
  const t = TURN[c.turn];
  for (const [a, b, ord] of [[c.x, c.y, 'xA'], [c.y, c.x, 'xB']]) {
    const before = raws.length;
    const { text } = await L.anthropic.complete({ system: SYS_VOICE, messages: [{ role: 'user', content: userMsg(t, a, b, c.unit) }], maxTokens: 400 });
    const m = String(text || '').trim().toUpperCase().match(/[ABT]/);
    out.push({ name: c.name, unit: c.unit, turn: c.turn, origV: c.v, ord, parsed: m ? m[0] : '?', text, raw: raws[before] });
  }
}
writeFileSync('rawjudge.json', JSON.stringify(out, null, 1));
for (const o of out) console.log(o.name, o.unit, o.ord, 'orig', o.origV.join(''), 'parsed', o.parsed, 'types', JSON.stringify(o.raw && o.raw.types), 'out', o.raw && o.raw.out, 'text:', JSON.stringify(o.text).slice(0, 200));
