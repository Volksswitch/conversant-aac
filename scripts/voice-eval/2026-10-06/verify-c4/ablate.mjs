// Ablation: FLIP = the K0 voice block with ONLY the length sentence swapped for CLOSER50's
// (keeps K0's two composed exemplars). Generates 3 samples per held-out turn through the app's
// own llm.generateResponses, then judges (fixed parser, both orders, PREFERRED only):
// FLIP-vs-K0, CLOSER50-vs-FLIP, K0-vs-NULLH, K1-vs-NULLH, K10-vs-NULLH. Key never printed.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const EXP = 'C:/Users/ken/AppData/Local/Temp/claude/C--Users-ken-OneDrive-4-T-Z-Volksswitch-AI-driven-AAC/e1f5cd26-5878-4764-aab4-ca5a3f9226d1/scratchpad/slm/exp-review';
const L = await import('file:///' + EXP + '/lib.mjs');
const { REFERENCE, HELD_OUT } = await import('file:///' + EXP + '/spec.mjs');
L.llm.setApiKey(L.env.loadApiKey());
const cf = JSON.parse(readFileSync(EXP + '/conditions.json', 'utf8'));
const K0 = cf.conds.K0.block;
const OLD = cf.summary.K0.leanSentence;
const NEW = 'Offered a choice of wordings in real conversations, this user picks the shorter one far more often than the longer (46 of 46 decided). Keep responses brief unless there is a clear reason not to.';
if (!K0.includes(OLD)) throw new Error('lean sentence not found');
const FLIP = K0.replace(OLD, NEW);
const gusage = {}; L.llm.onUsage((u) => L.addUsage(gusage, u));
const native = globalThis.fetch; const seen = [];
globalThis.fetch = async (url, init) => { if (String(url).includes('/v1/messages') && init && init.body) { const b = JSON.parse(init.body); if (b.output_config) { const sys = Array.isArray(b.system) ? b.system.map((x) => x.text).join('\n') : b.system; seen.push(sys.includes(FLIP)); } } return native(url, init); };
const CTX = { stt_confidence: null, sequence_stack: [], register: 'ORDINARY', phase: 'BODY', last_user_utterance: null, user_holds_floor_to_lead: false };
function call(turn, sample) {
  L.setStaticBlocks(turn.placeId || null); L.llm.setVoiceBlock(FLIP); L.llm.setSituationBlock(L.situationFor(turn));
  return L.llm.generateResponses([{ role: 'partner', text: turn.text }], CTX, { perCategory: 1, reason: 'experiment' })
    .then((r) => ({ cond: 'FLIP', turn: turn.id, sample, responses: r.responses }))
    .catch((e) => ({ cond: 'FLIP', turn: turn.id, sample, error: String(e.message).slice(0, 200) }));
}
const groups = {}; for (const t of HELD_OUT) for (let s = 0; s < 3; s++) (groups[t.placeId || '-'] = groups[t.placeId || '-'] || []).push([t, s]);
const flip = [];
for (const g of Object.values(groups)) { const [first, ...rest] = g; flip.push(await call(...first)); let i = 0; await Promise.all(Array.from({ length: 4 }, async () => { while (i < rest.length) { const j = rest[i++]; flip.push(await call(...j)); } })); }
console.log('gen cost $' + L.costOf(gusage).toFixed(3), 'errors', flip.filter((r) => r.error).length, 'requests carrying FLIP', seen.filter(Boolean).length, '/', seen.length);
const gen = JSON.parse(readFileSync(EXP + '/gen.json', 'utf8')).results.concat(JSON.parse(readFileSync(EXP + '/gen-nullh.json', 'utf8')).results, flip);
const R = {}; for (const r of gen) R[`${r.cond}|${r.turn}|${r.sample}`] = r;
const pref = (r) => (r.responses.find((x) => x.slot === 'PREFERRED') || r.responses[0]).text;
const SYS = `You compare two candidates in a voice-matching study. A non-speaking 17-year-old named Marc uses a device that suggests what he might say next. You get lines Marc has really said in other situations (his voice reference), the situation, and two candidates. Decide which candidate sounds more like Marc. Judge ONLY voice: word choice, length, rhythm, formality, attitude and humor. Ignore which is more polite, more correct or more helpful, and do not reward copying words from the reference. Reply with exactly one character: A, B, or T (T only if they are equally like him).`;
const jusage = {};
function parse(text) { const t = String(text || '').trim(); if (/^[\*\s]*([ABT])[\*\.\s]*$/i.test(t)) return t.replace(/[^ABTabt]/g, '').toUpperCase(); const lines = t.split(/\n/).map((s) => s.trim()).filter(Boolean); const lc = (lines[lines.length - 1] || '').replace(/[^A-Za-z]/g, ''); return /^[ABT]$/i.test(lc) ? lc.toUpperCase() : '?'; }
async function ask(t, a, b) { const msg = `Marc's voice reference (lines he has said elsewhere):\n${REFERENCE.map((x) => `- ${x}`).join('\n')}\n\nSituation: Marc is talking with ${t.who}. They just said: "${t.text}"\n\nCandidate A: "${a}"\nCandidate B: "${b}"\n\nWhich sounds more like Marc? Answer A, B, or T.`; const r = await L.anthropic.complete({ system: SYS, messages: [{ role: 'user', content: msg }], maxTokens: 400 }); L.addUsage(jusage, r.usage); return parse(r.text); }
const comps = []; const jobs = [];
for (const [name, xc, yc] of [['FLIP-vs-K0', 'FLIP', 'K0'], ['CLOSER50-vs-FLIP', 'CLOSER50', 'FLIP'], ['K0-vs-NULLH', 'K0', 'NULLH'], ['K1-vs-NULLH', 'K1', 'NULLH'], ['K10-vs-NULLH', 'K10', 'NULLH']]) {
  for (const t of HELD_OUT) for (let k = 0; k < 3; k++) {
    const X = R[`${xc}|${t.id}|${k}`], Y = R[`${yc}|${t.id}|${k}`]; if (!X || !Y || X.error || Y.error) continue;
    const x = pref(X), y = pref(Y); const rec = { name, turn: t.id, x, y }; comps.push(rec);
    jobs.push(async () => { if (x.trim() === y.trim()) { rec.score = 0; rec.identical = true; return; } const v1 = await ask(t, x, y), v2 = await ask(t, y, x); rec.v = [v1, v2]; rec.score = (v1 === 'A' && v2 === 'B') ? 1 : (v1 === 'B' && v2 === 'A') ? -1 : 0; });
  }
}
let i = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (i < jobs.length) await jobs[i++](); }));
function binom(w, l) { const n = w + l; if (!n) return 1; const k = Math.min(w, l); let p = 0, c = 1; for (let i = 0; i <= n; i++) { if (i > 0) c = c * (n - i + 1) / i; if (i <= k) p += c; } return Math.min(1, 2 * p / 2 ** n); }
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const summary = {};
for (const name of [...new Set(comps.map((c) => c.name))]) { const cs = comps.filter((c) => c.name === name); const W = cs.filter((c) => c.score === 1).length, Lo = cs.filter((c) => c.score === -1).length, T = cs.length - W - Lo; summary[name] = { n: cs.length, W, L: Lo, T, identical: cs.filter((c) => c.identical).length, unparsed: cs.filter((c) => c.v && c.v.includes('?')).length, winRate: +((W + 0.5 * T) / cs.length).toFixed(3), signP: +binom(W, Lo).toFixed(4) }; }
const mw = {}; for (const c of ['NULLH', 'K0', 'FLIP', 'CLOSER50']) { const rs = gen.filter((r) => r.cond === c && !r.error && HELD_OUT.find((t) => t.id === r.turn)); mw[c] = +(rs.reduce((s, r) => s + words(pref(r)), 0) / rs.length).toFixed(2); }
writeFileSync('ablate.json', JSON.stringify({ genCost: L.costOf(gusage), judgeCost: L.costOf(jusage), flip, comps, summary, meanPrefWords: mw }, null, 1));
console.log(JSON.stringify({ summary, meanPrefWords: mw, judgeCost: L.costOf(jusage) }, null, 1));
