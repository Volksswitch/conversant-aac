import { readFileSync, writeFileSync } from 'node:fs';
import { CORPUS, TURNS } from './corpus.mjs';
const rd = (f) => readFileSync(new URL(f, import.meta.url), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const GEN = rd('./gen-raw.jsonl').filter(r=>!r.error), J = rd('./judge-raw.jsonl'), R = rd('./rate-raw.jsonl');
const PERS=['marc-delgado','grace-thompson'], CONDS=['C0','C1','C2','C3','C4','C5','C6','C7','C8'];
const mean=a=>a.reduce((x,y)=>x+y,0)/(a.length||1); const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/((a.length-1)||1));};
const out={};
console.log('ABSOLUTE FIDELITY (1-5, Sonnet judge, PREFERRED card vs own held-out ref)');
for (const p of PERS){
  const ceil=R.filter(r=>r.persona===p&&r.kind==='ceiling').map(r=>r.score), floor=R.filter(r=>r.persona===p&&r.kind==='floor').map(r=>r.score);
  const c0=mean(R.filter(r=>r.persona===p&&r.cond==='C0').map(r=>r.score));
  const row=[`${p}: ceiling(own unseen lines) ${mean(ceil).toFixed(2)} (n=${ceil.length}) floor(other persona lines) ${mean(floor).toFixed(2)} (n=${floor.length})`];
  out[p]={ceil:mean(ceil),floor:mean(floor),conds:{}};
  for(const c of CONDS){const s=R.filter(r=>r.persona===p&&r.cond===c).map(r=>r.score); const m=mean(s); const gap=(m-c0)/(mean(ceil)-c0);
    out[p].conds[c]={mean:m,sd:sd(s),n:s.length,gapClosedVsC0:gap, dist:Object.fromEntries([1,2,3,4,5].map(k=>[k,s.filter(x=>x===k).length]))};
    row.push(`  ${c}: mean ${m.toFixed(2)} sd ${sd(s).toFixed(2)} n=${s.length} gapClosed ${(100*gap).toFixed(0)}% dist ${JSON.stringify(out[p].conds[c].dist)}`);}
  console.log(row.join('\n'));
}
// ident split content vs neutral turns
const CONTENT=new Set(['weekend','hobby','disagree']);
console.log('\nIDENT accuracy split: neutral turns (greeting,invitation,badnews,request,clerk) vs content turns (weekend,hobby,disagree), pooled personas');
for (const m of ['claude-sonnet-5-5','claude-haiku-4-5']) for (const k of ['pref','all4']) {
  const row=[`${m.split('-')[1]} ${k}`];
  for(const c of CONDS){const js=J.filter(j=>j.type==='ident'&&j.model===m&&j.kind===k&&j.cond===c);
    const n1=js.filter(j=>!CONTENT.has(j.turn)), n2=js.filter(j=>CONTENT.has(j.turn));
    row.push(`${c} N ${n1.filter(j=>j.correct).length}/${n1.length} C ${n2.filter(j=>j.correct).length}/${n2.length}`);}
  console.log(row.join(' | '));
}
// per persona neutral-only ident sonnet pref
console.log('\nIDENT neutral-turns only, Sonnet pref, per persona');
for (const p of PERS){const row=[p]; for(const c of CONDS){const js=J.filter(j=>j.type==='ident'&&j.model==='claude-sonnet-5-5'&&j.kind==='pref'&&j.cond===c&&j.persona===p&&!CONTENT.has(j.turn)); row.push(`${c} ${js.filter(j=>j.correct).length}/${js.length}`);} console.log(row.join(' | '));}
// mentions of persona content words
const CONTENTWORDS={'marc-delgado':['gaming','game','games','mario','minecraft','packers','bucks','spider','marvel','comic','comics','biscuit','devon','tyler','pizza','swim','school','friends'],'grace-thompson':['knit','knitting','yarn','bird','birds','heron','herons','garden','chickens','porch','market','library','tea','pie','book','books','reading','donna','clover','pond']};
console.log('\nShare of PREFERRED cards mentioning persona content words');
for (const p of PERS){const row=[p]; for(const c of CONDS){const gs=GEN.filter(g=>g.persona===p&&g.cond===c); const hits=gs.filter(g=>{const t=(g.responses.find(r=>r.slot==='PREFERRED')||g.responses[0]).text.toLowerCase(); const tw=t.replace(/[^a-z' ]+/g,' ').split(' '); return CONTENTWORDS[p].some(w=>tw.includes(w));}).length; row.push(`${c} ${hits}/${gs.length}`);} console.log(row.join(' | '));}
writeFileSync(new URL('./deep-results.json', import.meta.url), JSON.stringify(out,null,2));
