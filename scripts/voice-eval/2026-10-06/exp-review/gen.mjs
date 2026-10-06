// Live generation through the app's own llm.generateResponses. The key is read by
// tests/env.mjs loadApiKey() and never printed. Usage comes from the app's onUsage hook.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as L from './lib.mjs';
import { allConditions } from './conditions.mjs';
import { HELD_OUT, VARIANT_B } from './spec.mjs';

const MODE = process.argv[2] || 'test';
const key = L.env.loadApiKey();
if (!key) { console.error('no key'); process.exit(1); }
L.llm.setApiKey(key);

const usage = {};
L.llm.onUsage((u) => L.addUsage(usage, u));

// Record the exact request body (never headers) so prompts can be audited.
const native = globalThis.fetch;
const requests = [];
globalThis.fetch = async (url, init) => {
    if (String(url).includes('/v1/messages') && init && init.body) {
        const b = JSON.parse(init.body);
        const sys = Array.isArray(b.system) ? b.system.map((x) => x.text).join('\n<<BREAK>>\n') : b.system;
        requests.push({ tag: currentTag, sysHash: createHash('sha256').update(sys).digest('hex').slice(0, 16), cachedHash: createHash('sha256').update(Array.isArray(b.system) ? b.system[0].text : sys).digest('hex').slice(0, 16), sys });
    }
    return native(url, init);
};
let currentTag = null;

const CTX = { stt_confidence: null, sequence_stack: [], register: 'ORDINARY', phase: 'BODY', last_user_utterance: null, user_holds_floor_to_lead: false };

function call(cond, turn, sample) {
    // Set every block and call synchronously: generateResponses builds its prompt
    // before its first await, so concurrent calls cannot see each other's blocks.
    L.setStaticBlocks(turn.placeId || null);
    L.llm.setVoiceBlock(cond.block);
    L.llm.setSituationBlock(L.situationFor(turn));
    currentTag = `${cond.name}|${turn.id}|${sample}`;
    const t0 = Date.now();
    return L.llm.generateResponses([{ role: 'partner', text: turn.text }], CTX, { perCategory: 1, reason: 'experiment' })
        .then((r) => ({ cond: cond.name, turn: turn.id, sample, ms: Date.now() - t0, responses: r.responses, classification: r.classification }))
        .catch((e) => ({ cond: cond.name, turn: turn.id, sample, ms: Date.now() - t0, error: String(e.message).slice(0, 300) }));
}

async function pool(jobs, n) {
    const out = []; let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const j = jobs[i++]; out.push(await j()); } }));
    return out;
}

import { closerEverything } from './conditions.mjs';
const conds = await allConditions();
conds.CLOSER50 = await closerEverything();
const plan = [];
if (MODE === 'test') {
    plan.push([conds.K0, HELD_OUT[0], 0]);
} else {
    const S = { K0: 6, K1: 3, K3: 3, K10: 3, CLOSER50: 3 };
    for (const [c, n] of Object.entries(S)) for (const t of HELD_OUT) for (let s = 0; s < n; s++) plan.push([conds[c], t, s]);
    for (let s = 0; s < 4; s++) { plan.push([conds.MOM, VARIANT_B[0], s]); plan.push([conds.MOM, VARIANT_B[1], s]); plan.push([conds.K0, VARIANT_B[1], s]); }
}

// Group by condition so each condition's cache entry is written once then read.
const results = [];
const byCond = {};
for (const p of plan) { const g = p[0].name + '|' + (p[1].placeId || '-'); (byCond[g] = byCond[g] || []).push(p); }
for (const [name, ps] of Object.entries(byCond)) {
    const [first, ...rest] = ps;
    results.push(await call(...first));
    results.push(...await pool(rest.map((p) => () => call(...p)), 4));
    console.log(name, 'done', ps.length, 'calls; cost so far $' + L.costOf(usage).toFixed(4));
}

const out = { mode: MODE, usage, cost: L.costOf(usage), results, requests };
const file = MODE === 'test' ? 'gen-test.json' : 'gen.json';
writeFileSync(file, JSON.stringify(out, null, 1));
console.log('usage', usage, 'cost $' + L.costOf(usage).toFixed(4));
for (const r of results.slice(0, 3)) console.log(JSON.stringify(r).slice(0, 800));
const errs = results.filter((r) => r.error); console.log('errors', errs.length, errs.slice(0, 3));
