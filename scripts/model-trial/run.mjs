/*
 * Claude Haiku 5.5 against Claude Sonnet 5.5 for the response options (Ken, October 31
 * 2026). The question is whether the small, cheap model writes suggestions good enough
 * to switch to, and whether it is faster.
 *
 * Both models get the app's REAL prompt: the test user Marc's profile, people, places
 * and voice from test-data-folder/, built by the app's own builders, exactly as
 * app.js assembles it. The app's code is not changed; the request is rewritten on its
 * way out (model, and the thinking setting each model needs), so one prompt goes to
 * both.
 *
 * Two kinds of moment:
 *   - points from Marc's 17 saved conversations (the first partner turn and the last),
 *     with the conversation so far and the partner and place in force at the time;
 *   - targeted checks of the app's standing rules (no facts about the world, no
 *     invented life events, a polite decline, a menu, "What?", a goodbye, a 1-10 scale).
 *
 * Measured here: the wait for each set, its cost, and whether it failed, could not be
 * read, or was declined. Quality is judged separately, blind (see blind.mjs).
 *
 * Run:  node --no-warnings scripts/model-trial/run.mjs
 * Needs .anthropic-key and test-data-folder/ ("reset test data" makes it). Writes
 * Reports/model-trial-<date>/ (git-ignored). Roughly 90 requests, well under a dollar.
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TD = path.join(ROOT, 'test-data-folder');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const env = await imp('tests/env.mjs');
const key = env.loadApiKey();
if (!key) { console.error('No API key: add .anthropic-key or set ANTHROPIC_API_KEY.'); process.exit(1); }

// The two arms. Sonnet is sent exactly as the app sends it. Haiku thinks by default,
// like Sonnet 5.5, and its way of turning that off is different: {type:'disabled'}
// (accepted at its default effort), where Sonnet takes {type:'between_tools'}.
const ARMS = {
    sonnet: { model: 'claude-sonnet-5-5', thinking: { type: 'between_tools' }, inPerM: 2.00, outPerM: 10.00 },
    haiku:  { model: 'claude-haiku-5-5',  thinking: { type: 'disabled' },      inPerM: 0.10, outPerM: 0.50 },
};
let arm = 'sonnet';
let last = null;   // what the network saw for the most recent request

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
    const m = String(url).match(/data\/([\w.-]+\.json)$/);
    if (m && !String(url).startsWith('http')) {
        const text = readFileSync(path.join(ROOT, 'app/data', m[1]), 'utf8');
        return { ok: true, status: 200, async json() { return JSON.parse(text); }, async text() { return text; } };
    }
    if (String(url).includes('api.anthropic.com/v1/messages')) {
        const body = JSON.parse(init.body);
        body.model = ARMS[arm].model;
        body.thinking = ARMS[arm].thinking;
        const t0 = performance.now();
        const res = await realFetch(url, { ...init, body: JSON.stringify(body) });
        const ms = Math.round(performance.now() - t0);
        let data = null;
        try { data = await res.clone().json(); } catch { /* not JSON */ }
        last = { ms, status: res.status, usage: data && data.usage, stop: data && data.stop_reason,
            blocks: data && Array.isArray(data.content) ? data.content.map((b) => b.type) : [] };
        return res;
    }
    return realFetch(url, init);
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
const engine = await imp('app/js/engine.js');
const convLogic = await imp('app/js/conversation-logic.js');
const llm = await imp('app/js/llm.js');

await worldview.loadRegistry();
await worldview.load();
await relationships.load();
await places.load();
await voice.load();
await expressPanel.load();

llm.setApiKey(key);
llm.setWorldviewKeys(worldview.fieldKeys());
llm.setWorldviewBlock(worldview.buildBlock());
llm.setExtraNames(worldview.extraNames());
llm.setRelationshipsBlock(relationships.buildBlock());
const idiom = expressPanel.userAuthoredItems().filter((it) => it.type === 'phrase' && it.text).map((it) => it.text);
llm.setVoiceBlock(voice.buildBlock(idiom));

// app.js buildSituationBlock, for the parts these moments use: partner and place.
function situation(partnerId, partnerLabel, placeId) {
    const lines = [];
    if (partnerLabel) {
        const label = partnerId ? relationships.displayName(partnerId, partnerLabel) : partnerLabel;
        lines.push(`You are currently talking with ${label} — ${label} is the person being spoken TO, not a topic to raise. When you address or refer to them, use "${label}".`);
        if (partnerId) {
            const how = relationships.buildPartnerBlock(partnerId, label);
            if (how) lines.push(how);
        }
    }
    if (placeId) {
        const here = places.buildHereBlock(placeId);
        if (here) lines.push(here);
    }
    return lines.join(' ');
}

// ---- the moments -------------------------------------------------------------

const moments = [];
const dir = path.join(TD, 'conversations');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.review.json')).sort()) {
    const d = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
    const turns = (d.exchanges || []).filter((e) => e.role === 'partner' || e.role === 'user');
    const partnerIdx = turns.map((t, i) => (t.role === 'partner' ? i : -1)).filter((i) => i >= 0);
    if (!partnerIdx.length) continue;
    const picks = [...new Set([partnerIdx[0], partnerIdx[partnerIdx.length - 1]])];
    for (const i of picks) {
        const t = turns[i];
        const history = turns.slice(0, i).map((e) => (e.role === 'partner'
            ? { role: 'partner', text: e.cleanedTranscript || e.rawTranscript || '' }
            : { role: 'user', text: e.selectedText || '' })).filter((h) => h.text);
        const p = t.partner || {};
        const isPractice = /^Practice:/.test(p.label || '');
        moments.push({
            id: `${f.slice(0, 10)}-${i}`,
            kind: 'conversation',
            who: isPractice ? 'Barista (practice)' : (p.label || 'Someone Marc does not know'),
            partnerId: isPractice ? null : (p.id || null),
            partnerLabel: isPractice ? null : (p.label || null),
            placeId: (t.place && t.place.id) || null,
            practice: isPractice ? p.label.replace(/^Practice:\s*/, '') : null,
            history,
            partner: t.cleanedTranscript || t.rawTranscript || '',
        });
    }
}

// Targeted checks of the standing rules. `look` is what a judge should check.
const PROBES = [
    { id: 'P1-fact', who: 'Ms. Whitaker', partnerId: 'p-ms-whitaker', placeId: 'pl-west-high-school',
      partner: 'Quick question before the quiz, Marc. What year did the Civil War end?',
      look: 'A fact about the world Marc never gave. No option may state the year; it should say he is not sure, turn it back, or similar.' },
    { id: 'P2-episode', who: 'Tyler', partnerId: 'p-tyler',
      partner: 'So what did you end up doing last night?',
      look: 'No option may invent a specific event (who won, what happened, a score). General answers only.' },
    { id: 'P3-decline', who: 'Aisha', partnerId: 'p-aisha',
      partner: 'Want to come help set up for the bake sale Saturday at seven in the morning?',
      look: 'An invitation. One option should decline politely with a reason that is not made up as a specific fact.' },
    { id: 'P4-menu', who: 'Gino', placeId: 'pl-gino-s-pizza',
      partner: 'You want pepperoni, sausage, or just cheese?',
      look: 'A menu. One option per choice (pepperoni, sausage, cheese), plus a spare that is not one of them.' },
    { id: 'P5-what', who: 'Elena', partnerId: 'p-elena',
      history: [{ role: 'partner', text: 'Did you finish your homework?' }, { role: 'user', text: 'Almost. Just the math left.' }],
      partner: 'What? Say that again?',
      look: 'Elena is asking Marc to repeat. The classification should mark it as a repeat request.' },
    { id: 'P6-bye', who: 'Devon', partnerId: 'p-devon',
      history: [{ role: 'partner', text: 'That game was wild.' }, { role: 'user', text: 'Best one all season.' }],
      partner: 'Alright man, I gotta head out. Catch you later.',
      look: 'Devon is leaving. The classification should mark it as a closing.' },
    { id: 'P7-body', who: 'Dr. Aldrich', partnerId: 'p-dr-aldrich', placeId: 'pl-the-rehab-clinic',
      partner: 'Any falls since your last visit?',
      look: 'A yes-or-no question about Marc\'s body. No option may invent a fact he never gave (a number of falls, a date, an injury).' },
    { id: 'P8-scale', who: 'Nurse', placeId: 'pl-the-rehab-clinic',
      partner: 'On a scale of one to ten, how bad is the pain today?',
      look: 'A 1-to-10 scale. The classification should report the range rather than ten choices.' },
    { id: 'P9-feeling', who: 'Elena', partnerId: 'p-elena',
      partner: 'You seem upset tonight. Do you want to talk about it?',
      look: 'Emotional, from his mother. Options should sound like a teenage son, warm or guarded, not like a counselor.' },
    { id: 'P10-plans', who: 'Devon', partnerId: 'p-devon',
      partner: 'We still on for the arcade Friday or what?',
      look: 'Casual plans with a close friend. Short, natural, in Marc\'s voice.' },
];
for (const p of PROBES) {
    moments.push({ kind: 'probe', history: [], partnerLabel: p.partnerId ? p.who : p.who, ...p });
}

// ---- run ---------------------------------------------------------------------

function cost(a, u) {
    if (!u) return null;
    const A = ARMS[a];
    const inp = (u.input_tokens || 0) + 1.25 * (u.cache_creation_input_tokens || 0) + 0.1 * (u.cache_read_input_tokens || 0);
    return (inp * A.inPerM + (u.output_tokens || 0) * A.outPerM) / 1e6;
}

async function one(a, m) {
    arm = a;
    last = null;
    llm.setSituationBlock(m.practice
        ? `This is a PRACTICE role-play. The situation is: ${m.practice}. Keep every suggested response realistic and appropriate to THIS setting — only refer to things that would actually make sense here.`
        : situation(m.partnerId, m.partnerLabel, m.placeId));
    engine.reset();
    engine.partnerSpeaking(m.partner);
    const ctx = engine.buildRequestContext();
    const history = convLogic.historyForRequest(m.history, m.partner, -1, '');
    const out = { arm: a, model: ARMS[a].model };
    const t0 = performance.now();
    try {
        const r = await llm.generateResponses(history, ctx, { reason: 'reprompt', perCategory: 1 });
        out.ok = true;
        out.options = (r.responses || []).map((o) => ({ slot: o.slot, text: o.text, hint: o.hint || null }));
        const c = r.classification || {};
        out.classification = { partner_action: c.partner_action, is_repair_initiator: !!c.is_repair_initiator,
            offered_options: c.offered_options || [], offered_range: c.offered_range ?? null };
        if (!out.options.length) out.empty = true;
    } catch (err) {
        out.ok = false;
        out.refused = err.stopReason === 'refusal' || /stop: refusal\b/.test(err.message || '');
        out.error = String(err.message || err).slice(0, 300);
    }
    out.totalMs = Math.round(performance.now() - t0);
    out.netMs = last ? last.ms : null;
    out.usage = last ? last.usage : null;
    out.stop = last ? last.stop : null;
    out.blocks = last ? last.blocks : [];
    out.cost = cost(a, out.usage);
    return out;
}

// Warm each arm's cache once so the first measured request is not the only one that
// pays to write it (the app writes once per session and reads thereafter).
const warm = moments[0];
for (const a of Object.keys(ARMS)) await one(a, warm);

const results = [];
let n = 0;
for (const m of moments) {
    // Alternate which model goes first, so neither gets the quieter moment on the network.
    const order = (n++ % 2) ? ['haiku', 'sonnet'] : ['sonnet', 'haiku'];
    const row = { moment: m, runs: {} };
    for (const a of order) row.runs[a] = await one(a, m);
    results.push(row);
    process.stdout.write(`${m.id} `);
}
console.log();

// ---- summary -----------------------------------------------------------------

const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const pct = (xs, p) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
const summary = {};
for (const a of Object.keys(ARMS)) {
    const runs = results.map((r) => r.runs[a]);
    const waits = runs.map((r) => r.netMs);
    summary[a] = {
        model: ARMS[a].model,
        sets: runs.length,
        failed: runs.filter((r) => !r.ok && !r.refused).length,
        refused: runs.filter((r) => r.refused).length,
        empty: runs.filter((r) => r.ok && r.empty).length,
        thinkingSeen: runs.filter((r) => (r.blocks || []).includes('thinking')).length,
        waitMedianMs: median(waits),
        wait90Ms: pct(waits, 0.9),
        over4s: waits.filter((w) => w != null && w > 4000).length,
        outTokensMedian: median(runs.map((r) => r.usage && r.usage.output_tokens)),
        costPerSetMedianCents: median(runs.map((r) => r.cost)) * 100,
        costTotalCents: runs.reduce((s, r) => s + (r.cost || 0), 0) * 100,
        cacheReadShare: (() => {
            let read = 0, all = 0;
            for (const r of runs) { const u = r.usage || {}; read += u.cache_read_input_tokens || 0; all += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0); }
            return all ? read / all : null;
        })(),
    };
}

const date = new Date().toISOString().slice(0, 10);
const outDir = path.join(ROOT, 'Reports', `model-trial-${date}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ date, arms: ARMS, summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('Wrote', path.join(outDir, 'results.json'));
