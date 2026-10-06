// Re-judge every non-identical comparison from exp-review/judge.json with the SAME prompts,
// SAME model/adapter, both orders, but a CORRECTED verdict parser (judge.mjs:37 took the first
// A/B/T letter anywhere in the uppercased reply, so a reply starting "Marc's ..." parsed as 'A').
// Raw replies are stored. The key is never printed.
import { readFileSync, writeFileSync } from 'node:fs';
const EXP = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm/exp-review';
const L = await import('file:///' + EXP + '/lib.mjs');
const { REFERENCE, HELD_OUT, VARIANT_B } = await import('file:///' + EXP + '/spec.mjs');
L.llm.setApiKey(L.env.loadApiKey());
const judge = JSON.parse(readFileSync(EXP + '/judge.json', 'utf8'));
const TURN = Object.fromEntries([...HELD_OUT, ...VARIANT_B].map((t) => [t.id, t]));
const SYS_VOICE = `You compare two candidates in a voice-matching study. A non-speaking 17-year-old named Marc uses a device that suggests what he might say next. You get lines Marc has really said in other situations (his voice reference), the situation, and two candidates. Decide which candidate sounds more like Marc. Judge ONLY voice: word choice, length, rhythm, formality, attitude and humor. Ignore which is more polite, more correct or more helpful, and do not reward copying words from the reference. Reply with exactly one character: A, B, or T (T only if they are equally like him).`;
const SYS_WARM = `You compare two candidate replies. Decide which reply is WARMER toward the person being spoken to: more affectionate, reassuring, or emotionally open. Ignore length and correctness. Reply with exactly one character: A, B, or T (T only if equally warm).`;
function userMsg(kind, turn, a, b, unit) {
  const sit = `Situation: Marc is talking with ${turn.who}. They just said: "${turn.text}"`;
  if (kind === 'warm') return `${sit}\n\nReply A: "${a}"\nReply B: "${b}"\n\nWhich reply is warmer? Answer A, B, or T.`;
  const ref = `Marc's voice reference (lines he has said elsewhere):\n${REFERENCE.map((x) => `- ${x}`).join('\n')}`;
  if (unit === 'palette') return `${ref}\n\n${sit}\n\nThe device shows four suggestions at once and Marc picks one.\n\nSuggestion set A:\n${a}\n\nSuggestion set B:\n${b}\n\nWhich SET sounds more like Marc overall? Answer A, B, or T.`;
  return `${ref}\n\n${sit}\n\nCandidate A: "${a}"\nCandidate B: "${b}"\n\nWhich sounds more like Marc? Answer A, B, or T.`;
}
const usage = {};
function parse(text) {
  const t = String(text || '').trim();
  if (/^[\*\s]*([ABT])[\*\.\s]*$/i.test(t)) return { v: t.replace(/[^ABTabt]/g, '').toUpperCase(), how: 'single' };
  const lines = t.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  const lc = last.replace(/[^A-Za-z]/g, '');
  if (/^[ABT]$/i.test(lc)) return { v: lc.toUpperCase(), how: 'lastline' };
  const m = last.match(/(?:answer|verdict|choice)\s*(?:is)?\s*[:\-]?\s*\**\s*([ABT])\b/i);
  if (m) return { v: m[1].toUpperCase(), how: 'lastline-phrase' };
  return { v: '?', how: 'unparsed' };
}
async function ask(kind, turn, a, b, unit) {
  const r = await L.anthropic.complete({ system: kind === 'warm' ? SYS_WARM : SYS_VOICE, messages: [{ role: 'user', content: userMsg(kind, turn, a, b, unit) }], maxTokens: 400 });
  L.addUsage(usage, r.usage);
  const p = parse(r.text);
  const old = (String(r.text || '').trim().toUpperCase().match(/[ABT]/) || ['?'])[0];
  return { ...p, old, text: r.text, stop: r.stopReason };
}
const recs = judge.comparisons.filter((c) => !c.identical && c.v).map((c) => ({ name: c.name, unit: c.unit, kind: c.kind, turn: c.turn, xCond: c.xCond, xSample: c.xSample, yCond: c.yCond, ySample: c.ySample, x: c.x, y: c.y, origV: c.v, origScore: c.score }));
const jobs = recs.map((rec) => async () => {
  const t = TURN[rec.turn];
  const v1 = await ask(rec.kind, t, rec.x, rec.y, rec.unit);
  const v2 = await ask(rec.kind, t, rec.y, rec.x, rec.unit);
  rec.r1 = v1; rec.r2 = v2;
  const xW = (v1.v === 'A') + (v2.v === 'B'), yW = (v1.v === 'B') + (v2.v === 'A');
  rec.score = xW === 2 ? 1 : yW === 2 ? -1 : 0;
});
let i = 0, done = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < jobs.length) { const k = i++; try { await jobs[k](); } catch (e) { recs[k].error = String(e.message).slice(0, 200); } if (++done % 40 === 0) console.log('done', done, 'cost $' + L.costOf(usage).toFixed(3)); } }));
writeFileSync('rejudge.json', JSON.stringify({ usage, cost: L.costOf(usage), recs }, null, 1));
console.log('calls', usage.calls, 'cost $' + L.costOf(usage).toFixed(3), 'errors', recs.filter((r) => r.error).length);
