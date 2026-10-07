// Builds the Part 5 page: a 10-minute check for Ken. Writes check-page.html and a
// separate answer key (which side came from which instructions) into OUT. The page
// itself never says which instructions or review produced a reply.
//   OUT=<scratch> node page.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { outDir } from './common.mjs';
import { CORPUS } from '../exp-dose/corpus.mjs';
import { PARTNERS } from '../exp-rewrite-review/spec.mjs';

const OUT = outDir();
const rd = (p) => JSON.parse(readFileSync(join(OUT, p), 'utf8'));
let seed = 20261006; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- risky options -----------------------------------------------------------------
const genA = rd('test-a/gen.json').results.filter((r) => !r.error);
const risky = [];
for (const [probe, label] of [['P4-favor', 'A stranger asks a favor'], ['P5-coffee', 'Someone asks "Coffee or tea?"']]) {
    const partner = genA.find((r) => r.turn === probe).partner;
    const sets = {};
    for (const cond of ['current', 'new']) sets[cond] = genA.filter((r) => r.group === `marc|${cond}|probe` && r.turn === probe).slice(0, 3);
    risky.push({ probe, label, partner, sets });
}

// ---- blind pairs ---------------------------------------------------------------------
const key = [];
const pairs = [];
const pickDecided = (comps, n) => {
    const decided = comps.filter((c) => c.unit === 'preferred' && c.score !== 0);
    const out = []; const usedTurns = new Set();
    const shuffled = decided.map((c) => [rnd(), c]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    for (const c of shuffled) { if (out.length >= n) break; if (usedTurns.has(c.turn)) continue; usedTurns.add(c.turn); out.push(c); }
    return out;
};
const jA = rd('test-a/judge.json').comparisons.filter((c) => c.name === 'marc new-vs-current');
for (const c of pickDecided(jA, 4)) {
    const partner = genA.find((r) => r.turn === c.turn).partner;
    pairs.push({ partner, refTitle: 'How Marc talks', ref: CORPUS['marc-delgado'].ref, x: c.x, y: c.y, comp: c, test: 'A' });
}
for (const id of ['devon', 'mom']) {
    let comps = [];
    try { comps = rd(`test-b/judge-${id}.json`).comparisons.filter((c) => /new: (smallest|full)-vs-none/.test(c.name)); } catch { /* Test B not run */ }
    const gen = (() => { try { return rd(`test-b/gen-${id}.json`).results; } catch { return []; } })();
    for (const c of pickDecided(comps, 2)) {
        const partner = gen.find((r) => r.turn === c.turn).partner;
        pairs.push({ partner, refTitle: `How Marc talks with ${PARTNERS[id].label}`, ref: PARTNERS[id].reference, x: c.x, y: c.y, comp: c, test: 'B', who: PARTNERS[id].label });
    }
}
pairs.forEach((p, i) => {
    const flip = rnd() < 0.5;
    p.A = flip ? p.y : p.x; p.B = flip ? p.x : p.y;
    const judgeChoseX = p.comp.score === 1;
    key.push({ pair: i + 1, test: p.test, comparison: p.comp.name, turn: p.comp.turn, A: flip ? p.comp.yg : p.comp.xg, B: flip ? p.comp.xg : p.comp.yg, judgePicked: (judgeChoseX !== flip) ? 'A' : 'B' });
});
writeFileSync(join(OUT, 'check-page-key.json'), JSON.stringify(key, null, 1));

// ---- page -------------------------------------------------------------------------
const setHtml = (r, name) => `<ol class="opts">${r.responses.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ol>`;
let q = 0;
const riskyHtml = risky.map((rk) => {
    const col = (cond, title) => `<div class="col"><h4>${title}</h4>${rk.sets[cond].map((r, i) => {
        const id = `${rk.probe}-${cond}-${i + 1}`; q++;
        return `<div class="card">${setHtml(r)}<div class="marks" data-q="risky ${id}">${['OK', 'Too blunt', 'Wrong'].map((m) => `<label><input type="radio" name="${id}" value="${m}"> ${m}</label>`).join('')}</div></div>`;
    }).join('')}</div>`;
    return `<section><h3>${esc(rk.label)}</h3><p class="said">They say: “${esc(rk.partner)}”</p><div class="cols">${col('current', 'Current instructions')}${col('new', 'New instructions')}</div></section>`;
}).join('');

const pairsHtml = pairs.map((p, i) => `<section class="pair"><h3>Pair ${i + 1}${p.who ? ` (talking with ${esc(p.who)})` : ''}</h3>
<details open><summary>${esc(p.refTitle)}</summary><ul class="ref">${p.ref.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>
<p class="said">They say: “${esc(p.partner)}”</p>
<div class="choice">
<label class="opt"><input type="radio" name="pair${i + 1}" value="A"><span><b>A</b> ${esc(p.A)}</span></label>
<label class="opt"><input type="radio" name="pair${i + 1}" value="B"><span><b>B</b> ${esc(p.B)}</span></label>
<label class="opt small"><input type="radio" name="pair${i + 1}" value="same"><span>Can't tell them apart</span></label>
</div></section>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Marc Voice Check</title>
<style>
:root{--bg:#fbfbf9;--fg:#1d2329;--muted:#5b6670;--card:#fff;--edge:#5f6f7c;--accent:#1f5f8b;--tint:#eef4f8}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#15191d;--fg:#e6eaee;--muted:#a3adb6;--card:#1e2429;--edge:#8b9aa6;--accent:#7fb8e0;--tint:#1d2a33}}
body{background:var(--bg);color:var(--fg);font:17px/1.5 system-ui,Segoe UI,Arial,sans-serif;margin:0;padding:0 16px 80px}
main{max-width:980px;margin:0 auto}
h1{font-size:1.6rem;margin:28px 0 4px} h2{margin-top:36px;border-bottom:2px solid var(--edge);padding-bottom:4px} h3{margin:22px 0 6px} h4{margin:4px 0 8px;color:var(--muted)}
.lead{color:var(--muted)} .said{font-style:italic;background:var(--tint);padding:8px 12px;border-radius:8px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px} @media (max-width:700px){.cols{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--edge);border-radius:10px;padding:8px 12px;margin-bottom:10px}
.opts{margin:4px 0 8px;padding-left:22px} .marks{display:flex;gap:14px;flex-wrap:wrap;font-size:.95rem}
.ref{columns:2;margin:6px 0} @media (max-width:700px){.ref{columns:1}}
.choice{display:grid;gap:8px} .opt{display:flex;gap:10px;align-items:flex-start;background:var(--card);border:1px solid var(--edge);border-radius:10px;padding:10px 12px;cursor:pointer}
.opt.small{color:var(--muted)} input{accent-color:var(--accent);transform:scale(1.2);margin-top:5px}
button{font:inherit;background:var(--accent);color:var(--bg);border:0;border-radius:8px;padding:12px 20px;cursor:pointer}
#out{width:100%;min-height:120px;margin-top:10px;font:14px monospace;background:var(--card);color:var(--fg);border:1px solid var(--edge);border-radius:8px}
</style></head><body><main>
<h1>Does this sound like Marc?</h1>
<p class="lead">About 10 minutes. Marc, Devon and Mom are made up for the test. Your answers stay on this page until you copy them.</p>
<h2>1. What changed in the instructions</h2>
<ul>
<li>When Marc's own wording disagrees with the app's rules about <i>how</i> to word a reply, his wording wins.</li>
<li>Rules about <i>what</i> may be said still win over him: no made-up facts, no vulgarity, words a voice can say, no jokes on serious turns, a way out of topics he avoids, no sides on faith or politics.</li>
<li>The app's sample wordings ("I'd love to, but…", "I wish I could —", "I'm pretty wiped today") come out of the rules.</li>
<li>The AI sees Marc's own ways of saying no next to the rule about declining.</li>
<li>One of his everyday words may appear once in a set of four.</li>
</ul>
<h2>2. The risky options</h2>
<p class="lead">Mark each set of four: OK, too blunt, or wrong.</p>
${riskyHtml}
<h2>3. Eight blind pairs</h2>
<p class="lead">For each pair, pick the reply that sounds more like how Marc talks with that person. The page doesn't say which instructions produced which.</p>
${pairsHtml}
<h2>Done</h2>
<button id="copy">Copy my answers</button>
<textarea id="out" readonly placeholder="Your answers appear here after you press the button."></textarea>
</main>
<script>
document.getElementById('copy').addEventListener('click', async () => {
  const lines = ['Marc voice check answers'];
  document.querySelectorAll('.marks').forEach((m) => { const c = m.querySelector('input:checked'); lines.push(m.dataset.q + ': ' + (c ? c.value : '(none)')); });
  document.querySelectorAll('.pair').forEach((p, i) => { const c = p.querySelector('input:checked'); lines.push('pair ' + (i + 1) + ': ' + (c ? c.value : '(none)')); });
  const text = lines.join('\\n');
  document.getElementById('out').value = text;
  try { await navigator.clipboard.writeText(text); document.getElementById('copy').textContent = 'Copied. Paste into the chat.'; }
  catch { document.getElementById('copy').textContent = 'Select the text below and copy it'; }
});
</script></body></html>`;
writeFileSync(join(OUT, 'check-page.html'), html);
console.log('page', join(OUT, 'check-page.html'), 'risky marks', q, 'pairs', pairs.length);
