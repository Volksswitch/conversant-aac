/*
 * The native speaker's review page for the Spanish evaluation (Ken, October 25 2026).
 *
 * Reads Reports/spanish-eval-<date>.json (written by scripts/spanish-eval.mjs) and
 * writes two files:
 *   Reports/spanish-review-<date>.html        a whole page, for trying it locally
 *   Reports/spanish-review-<date>.block.html  the same page as one WordPress block,
 *                                             published by scripts/wordpress/publish-spanish-review.py
 *
 * The reviewer taps a grade beside each option, may write how they would say it, and
 * presses Send. Answers go to the beta Sheet (kind 'spanish-review', its own tab) through
 * the same receiver the weekly reports use. Answers are kept in the browser as they go,
 * so the reviewer can stop and come back.
 *
 * Run: node --no-warnings scripts/spanish-review/build-review-page.mjs [<date>]
 *      (no date = the newest evaluation in Reports/)
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { ENDPOINT, SHARED_SECRET } from '../../app/js/weekly-send.js';

const date = process.argv[2] || readdirSync('Reports')
    .filter(f => /^spanish-eval-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop()?.slice(13, 23);
if (!date) { console.error('No Reports/spanish-eval-<date>.json found. Run scripts/spanish-eval.mjs first.'); process.exit(1); }
const data = JSON.parse(readFileSync(`Reports/spanish-eval-${date}.json`, 'utf8'));

// The question a reviewer is asked about each situation, AFTER grading it, so it does
// not decide what they look at. Written for the reviewer; the "what" notes in the
// evaluation script are written for us.
const ASK = {
    S1: 'Do these sound like a 24-year-old talking to a good friend?',
    S2: 'The second option turns the invitation down. Is it a natural, polite way to say no to a cousin?',
    S3: 'Anything odd about how she orders?',
    S4: 'Marisol should not state facts she was never told, so the app has her say she isn\'t sure instead. Do these sound natural?',
    S5: 'Do these sound like a granddaughter talking to her grandmother?',
    S6: 'Marisol always uses "usted" with her doctor. Does every option?',
    S7: 'With a store clerk she doesn\'t know, would Marisol use "usted" or "tú"? Did the options get it right?',
    S8: 'Marisol is a woman. Is every word that changes for gender in the feminine form?',
    S9: 'Here the app was NOT told Marisol is a woman. If she is, is anything wrong?',
    S10: 'Her mother didn\'t catch what she said. These are three ways to say it again. Natural?',
    S11: 'The coworker mixed in English words. Do the answers mix the way a bilingual person from Texas would?',
    S12: 'The friend spoke English and the answers came back in Spanish. Is that what Marisol would do, or would she answer in English?',
    S13: 'Marisol typed what she wanted to get across (no puede, cita con el doctor). Does every option say it naturally?',
    S14: 'Marisol typed what she wanted to get across, in English (she has to work). Does every option say it naturally in Spanish?',
    S15: 'The friend is leaving. Are these natural ways to say goodbye?',
    S16: 'The nurse asked for a number. (A separate button in the app lets Marisol pick the number itself.) Do these sound natural?',
};
// What a situation's settings were, when the conversation alone doesn't show it.
const NOTE = { S6: 'Marisol always uses "usted" with this person.' };

// The kind of reply each option is meant to be, in plain words. The reviewer judges
// whether it sounds natural; knowing what it was trying to do makes that fairer.
const KIND = {
    PREFERRED: 'Goes along', DISPREFERRED: 'Politely declines or disagrees',
    INITIATIVE: 'Adds something new', REPAIR: 'Asks to clarify',
    CHOICE: 'Picks one', CHOICE_OTHER: 'Something else', CHOICE_ASK: 'Asks a question',
    CHOICE_REPAIR: 'Asks to hear the choices again',
    REPAIR_RESPEAK: 'Says it again', REPAIR_REPHRASE: 'Says it differently', REPAIR_EXPAND: 'Says a little more',
};

const sets = data.sets.filter(s => s.options.length).map(s => ({
    id: s.id, who: s.who, note: NOTE[s.id] || '', history: s.history, partner: s.partner,
    steer: s.steer, ask: ASK[s.id] || '',
    options: s.options.map(o => ({ slot: o.slot, kind: KIND[o.slot] || '', text: o.text, hint: o.hint })),
}));

const CONFIG = { evalDate: date, endpoint: ENDPOINT, secret: SHARED_SECRET, sets };
const json = JSON.stringify(CONFIG).replace(/</g, '\\u003c');

const CSS = `
#sr{--ink:#1f2933;--muted:#52606d;--edge:#9aa5b1;--soft:#f5f7fa;--accent:#0b5cad;--good:#1e7a46;--mid:#a86300;--bad:#b42318;
max-width:760px;margin:0 auto;color:var(--ink);background:#fff;font-size:18px;line-height:1.5;font-family:inherit}
#sr *{box-sizing:border-box}
#sr h2{font-size:1.35em;margin:1.4em 0 .4em}
#sr .sr-card{border:1px solid var(--edge);border-radius:10px;padding:16px;margin:0 0 18px;background:#fff}
#sr .sr-about{background:var(--soft)}
#sr label.sr-field{display:block;margin:10px 0 4px;font-weight:600}
#sr input[type=text],#sr textarea{width:100%;font:inherit;padding:8px 10px;border:1px solid var(--edge);border-radius:6px;background:#fff;color:var(--ink)}
#sr textarea{min-height:3em;resize:vertical}
#sr .sr-line{margin:4px 0}
#sr .sr-who{font-weight:700}
#sr .sr-typed{background:var(--soft);border-left:4px solid var(--edge);padding:6px 10px;margin:8px 0}
#sr .sr-note{color:var(--muted);font-style:italic;margin:4px 0}
#sr .sr-opt{border-top:1px solid var(--edge);padding:14px 0 6px;margin-top:12px}
#sr .sr-kind{font-size:.85em;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
#sr .sr-text{font-size:1.15em;margin:2px 0 8px}
#sr .sr-hint{font-size:.95em;color:var(--muted);margin:6px 0 4px}
#sr .sr-btns{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0}
#sr .sr-btns button{font:inherit;font-size:.95em;min-height:48px;padding:8px 14px;border:2px solid var(--edge);border-radius:8px;background:#fff;color:var(--ink);cursor:pointer}
#sr .sr-btns button[aria-pressed=true][data-v=natural],#sr .sr-btns button[aria-pressed=true][data-v=fine]{background:var(--good);border-color:var(--good);color:#fff}
#sr .sr-btns button[aria-pressed=true][data-v=off]{background:var(--mid);border-color:var(--mid);color:#fff}
#sr .sr-btns button[aria-pressed=true][data-v=wrong]{background:var(--bad);border-color:var(--bad);color:#fff}
#sr .sr-rewrite{margin-top:8px}
#sr .sr-ask{margin-top:16px;padding-top:12px;border-top:2px solid var(--edge)}
#sr .sr-bar{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--edge);padding:10px 0;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
#sr .sr-send{font:inherit;font-weight:700;min-height:52px;padding:10px 24px;border:0;border-radius:10px;background:var(--accent);color:#fff;cursor:pointer}
#sr .sr-send:disabled{opacity:.6;cursor:default}
#sr .sr-status{flex:1;min-width:200px}
#sr .sr-copy{width:100%;min-height:10em;font-family:monospace;font-size:.85em}
`.replace(/\n/g, '');

const BODY = `<div id="sr">
<p>Thank you for helping. <strong>Conversant AAC</strong> is a free app for people who can't speak. Someone talks to them, the app suggests a few things they could say back, and they tap one for the app to say aloud in their voice.</p>
<p>We're starting to make the app work in Spanish, and nobody on our team is a native speaker. So we need your ear. Below are 16 short situations. In each, someone says something to Marisol, and the app suggests a few replies. Please tap how natural each reply sounds. It takes about 15 to 20 minutes, and your answers are kept in your browser on your device if you stop and come back later.</p>
<div class="sr-card sr-about"><p><strong>About Marisol.</strong> She's 24 and lives in San Antonio, Texas, with her mother and grandmother. She has cerebral palsy and doesn't speak, so she uses the app to talk. She's bilingual: Spanish at home and with family, English at work and with most friends. She works part time at a community library and likes cumbia, telenovelas and the Spurs.</p>
<p><strong>The question for every reply:</strong> would a young bilingual woman from San Antonio actually say this? Anything stiff, translated from English, from another country, or just wrong is worth marking.</p>
<p>Each set of replies is meant to offer different <em>kinds</em> of answer (going along, politely saying no, adding something, asking to clarify), so they aren't supposed to agree with each other.</p>
<p>The "Shortened version" under each reply is what Marisol sees on her screen to find the reply quickly.</p></div>
<div class="sr-card"><h2 style="margin-top:0">About you</h2>
<label class="sr-field" for="sr-name">Your name (optional)</label><input type="text" id="sr-name" autocomplete="name">
<label class="sr-field" for="sr-region">Where your Spanish comes from (for example, San Antonio, or Monterrey)</label><input type="text" id="sr-region">
<label class="sr-field" for="sr-freq">How often you speak Spanish these days</label><input type="text" id="sr-freq" placeholder="For example: every day at home"></div>
<div id="sr-sets"></div>
<div class="sr-card"><h2 style="margin-top:0">Anything else?</h2>
<label class="sr-field" for="sr-overall">Overall impressions, or anything we should have asked</label><textarea id="sr-overall"></textarea></div>
<div class="sr-bar"><button type="button" class="sr-send" id="sr-send">Send my answers</button><div class="sr-status" id="sr-status" role="status"></div></div>
<div id="sr-fallback" hidden><p>If sending won't work, copy everything below and email it to <a href="mailto:ken@volksswitch.org">ken@volksswitch.org</a>.</p><textarea class="sr-copy" id="sr-copy" readonly></textarea></div>
</div>`;

// Plain browser code, ES5-ish so an older tablet copes.
// (!) WORDPRESS REWRITES "&&" AS "&#038;&#038;" INSIDE A MULTI-LINE SCRIPT, a syntax
// error that silently kills the whole page (found October 25 2026; the videos pages
// escape it only because their script is one line). So this code never uses "&&" and
// is joined onto ONE line before it is written, which is also why it has no line
// comments: joined, one would swallow everything after it. Before Send, the page asks
// the receiver its version, because an older receiver would file the answers as a
// weekly report.
const JS = `(function(){
var C=${json};
var KEY='conversant-spanish-review-'+C.evalDate;
var A={};try{A=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){A={};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(A));}catch(e){}}
function el(t,cls,txt){var n=document.createElement(t);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;}
function key(s,i,f){return s+'.'+i+'.'+f;}
var root=document.getElementById('sr-sets');
var GRADES=[['natural','Natural'],['off','OK, but a bit off'],['wrong','Wrong']];
var HINTS=[['fine','Fine'],['off','Not right']];
function btnRow(label,choices,k,onPick){
  var wrap=el('div');var row=el('div','sr-btns');row.setAttribute('role','group');row.setAttribute('aria-label',label);
  choices.forEach(function(c){var b=el('button',null,c[1]);b.type='button';b.setAttribute('data-v',c[0]);
    b.setAttribute('aria-pressed',A[k]===c[0]?'true':'false');
    b.addEventListener('click',function(){A[k]=(A[k]===c[0])?'':c[0];save();
      row.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',A[k]===x.getAttribute('data-v')?'true':'false');});
      if(onPick)onPick();progress();});
    row.appendChild(b);});
  wrap.appendChild(row);return wrap;}
function textBox(label,k,id){var w=el('div','sr-rewrite');var l=el('label','sr-field',label);l.htmlFor=id;var t=el('textarea');t.id=id;t.value=A[k]||'';
  t.addEventListener('input',function(){A[k]=t.value;save();});w.appendChild(l);w.appendChild(t);return w;}
C.sets.forEach(function(s,n){
  var card=el('div','sr-card');card.appendChild(el('h2',null,'Situation '+(n+1)+' of '+C.sets.length));
  card.appendChild(el('p','sr-line','Talking with: '+s.who));
  if(s.note)card.appendChild(el('p','sr-note',s.note));
  s.history.forEach(function(h){var p=el('p','sr-line');p.appendChild(el('span','sr-who',(h.role==='user'?'Marisol':s.who)+': '));p.appendChild(document.createTextNode(h.text));card.appendChild(p);});
  var p=el('p','sr-line');p.appendChild(el('span','sr-who',s.who+': '));p.appendChild(document.createTextNode(s.partner));card.appendChild(p);
  if(s.steer){var t=el('div','sr-typed');t.appendChild(el('span','sr-who','Marisol typed this, for the app to work into her reply: '));t.appendChild(document.createTextNode(s.steer));card.appendChild(t);}
  card.appendChild(el('p','sr-note','The app suggested these replies for Marisol:'));
  s.options.forEach(function(o,i){
    var box=el('div','sr-opt');box.appendChild(el('div','sr-kind',o.kind));box.appendChild(el('div','sr-text',o.text));
    var gk=key(s.id,i,'grade');
    var rw=textBox('How would you say it? (optional)',key(s.id,i,'rewrite'),'sr-rw-'+s.id+'-'+i);
    function showRw(){rw.hidden=!(A[gk]==='off'||A[gk]==='wrong');}
    box.appendChild(btnRow('How natural is this reply?',GRADES,gk,showRw));
    if(o.hint){box.appendChild(el('div','sr-hint','Shortened version: “'+o.hint+'”'));box.appendChild(btnRow('Is the shortened version right?',HINTS,key(s.id,i,'hint')));}
    box.appendChild(rw);showRw();card.appendChild(box);});
  var ask=el('div','sr-ask');ask.appendChild(el('p',null,s.ask||'Anything to add about this situation?'));
  var cb=textBox('Your comment (optional)',s.id+'.comment','sr-c-'+s.id);ask.appendChild(cb);card.appendChild(ask);root.appendChild(card);});
['name','region','freq','overall'].forEach(function(f){var n=document.getElementById('sr-'+f);n.value=A['me.'+f]||'';n.addEventListener('input',function(){A['me.'+f]=n.value;save();});});
var total=0;C.sets.forEach(function(s){total+=s.options.length;});
var status=document.getElementById('sr-status');
function graded(){var g=0;C.sets.forEach(function(s){s.options.forEach(function(o,i){if(A[key(s.id,i,'grade')])g++;});});return g;}
function progress(){if(!sending)status.textContent=graded()+' of '+total+' replies graded.';}
var sending=false;progress();
function payload(){return{secret:C.secret,kind:'spanish-review',evalDate:C.evalDate,sentAt:new Date().toISOString(),
  reviewer:{name:A['me.name']||'',region:A['me.region']||'',frequency:A['me.freq']||''},overall:A['me.overall']||'',
  sets:C.sets.map(function(s){return{id:s.id,who:s.who,partner:s.partner,comment:A[s.id+'.comment']||'',
    options:s.options.map(function(o,i){return{slot:o.slot,kind:o.kind,text:o.text,hint:o.hint,grade:A[key(s.id,i,'grade')]||'',hintGrade:A[key(s.id,i,'hint')]||'',rewrite:A[key(s.id,i,'rewrite')]||''};})};})};}
function readable(p){var L=['Spanish review, evaluation of '+C.evalDate,'Reviewer: '+p.reviewer.name+' | '+p.reviewer.region+' | '+p.reviewer.frequency,''];
  p.sets.forEach(function(s){L.push(s.id+' ('+s.who+'): '+s.partner);s.options.forEach(function(o){L.push('  ['+(o.grade||'-')+'] '+o.text+(o.hint?' | shortened "'+o.hint+'": '+(o.hintGrade||'-'):'')+(o.rewrite?' | would say: '+o.rewrite:''));});if(s.comment)L.push('  Comment: '+s.comment);L.push('');});
  if(p.overall)L.push('Overall: '+p.overall);return L.join('\\n');}
function fail(msg,p){sending=false;send.disabled=false;status.textContent=msg;document.getElementById('sr-copy').value=readable(p);document.getElementById('sr-fallback').hidden=false;}
var send=document.getElementById('sr-send');
send.addEventListener('click',function(){
  var g=graded();if(g<total){if(!confirm('You have graded '+g+' of '+total+' replies. Send anyway?'))return;}
  var p=payload();sending=true;send.disabled=true;status.textContent='Sending\\u2026';
  fetch(C.endpoint,{method:'GET'}).then(function(r){return r.text();}).then(function(v){
    var m=/Script version: (\\S+)/.exec(v||'');
    if(!m||m[1]<'2026-10-25'){fail('Sending isn\\u2019t switched on yet on our side. Your answers are saved here; you can try again later, or copy them below.',p);return;}
    return fetch(C.endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(p)}).then(function(r){return r.text();}).then(function(t){
      if(t==='ok'){sending=false;send.disabled=false;status.textContent='Sent. Thank you! If you change anything, you can send again.';}
      else fail('Our side didn\\u2019t accept it ('+t+'). Your answers are saved here.',p);});
  }).catch(function(){fail('Couldn\\u2019t reach our side. Check the connection and try again; your answers are saved here.',p);});
});
})();`;

if (JS.includes('&&') || /^\s*\/\//m.test(JS)) throw new Error('The page script must not use && or line comments (see above).');
const block = `<style>${CSS}</style>\n${BODY}\n<script>${JS.split('\n').map(l => l.trim()).join('')}</script>`.split('\n').filter(l => l.trim()).join('\n');
writeFileSync(`Reports/spanish-review-${date}.block.html`, block, 'utf8');
writeFileSync(`Reports/spanish-review-${date}.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spanish Review</title><style>body{margin:0;padding:16px;background:#fff;font-family:Arial,sans-serif}</style></head><body>\n${block}\n</body></html>`, 'utf8');
console.log(`Reports/spanish-review-${date}.html\nReports/spanish-review-${date}.block.html\n${sets.length} situations, ${sets.reduce((n, s) => n + s.options.length, 0)} replies`);
