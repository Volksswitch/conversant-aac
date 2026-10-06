import { readFileSync } from 'node:fs';
const J = JSON.parse(readFileSync('../exp-review/judge.json','utf8')).comparisons;
console.log('total comparisons', J.length, 'identical', J.filter(c=>c.identical).length);
const ni = J.filter(c=>!c.identical && c.v && c.v.length===2);
const pat = {}; for (const c of ni) { const k=c.v.join(''); pat[k]=(pat[k]||0)+1; }
console.log('non-identical', ni.length, pat);
const dec = ni.filter(c=>c.score!==0).length; console.log('decisive', dec, (dec/ni.length).toFixed(3));
const aa = (pat.AA||0); console.log('AA share of pairs', (aa/ni.length).toFixed(3));
let A=0,T=0,B=0,N=0; for (const c of ni) for (const v of c.v) { N++; if(v==='A')A++; else if (v==='T')T++; else if (v==='B') B++; }
console.log('per-verdict A', A, (A/N).toFixed(3), 'B', B, (B/N).toFixed(3), 'T', T, (T/N).toFixed(3), 'N', N);
const vo = ni.filter(c=>c.kind==='voice'); const vdec = vo.filter(c=>c.score!==0).length;
console.log('voice-only nonident', vo.length, 'decisive', vdec, (vdec/vo.length).toFixed(3), 'AA', vo.filter(c=>c.v.join('')==='AA').length);
// noise floor decisive rate
for (const unit of ['preferred','palette']) for (const name of ['K0b-vs-K0a','K1-vs-K0','K3-vs-K0','K10-vs-K0','CLOSER50-vs-K0']) {
  const g = J.filter(c=>c.name===name && c.unit===unit && c.kind==='voice');
  const W=g.filter(c=>c.score===1).length, L=g.filter(c=>c.score===-1).length, n=g.length, Tt=n-W-L;
  const wr=(W+0.5*Tt)/n;
  // cluster bootstrap by turn
  const byTurn={}; for (const c of g) (byTurn[c.turn]=byTurn[c.turn]||[]).push(c.score===1?1:c.score===-1?0:0.5);
  const turns=Object.values(byTurn); let rs=[]; let seed=12345; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648; return seed/2147483648;};
  for (let b=0;b<20000;b++){ let s=0,k=0; for (let i=0;i<turns.length;i++){ const t=turns[Math.floor(rnd()*turns.length)]; for (const x of t){s+=x;k++;} } rs.push(s/k);} rs.sort((a,b)=>a-b);
  console.log(unit, name, 'n',n,'W',W,'L',L,'T',Tt,'wr',wr.toFixed(3),'clusterCI95',rs[500].toFixed(3),rs[19500].toFixed(3), 'nonident', g.filter(c=>!c.identical).length, 'decisive', W+L);
}
// pooled K1+K3+K10 palette & preferred
for (const unit of ['preferred','palette']) { const g=J.filter(c=>['K1-vs-K0','K3-vs-K0','K10-vs-K0'].includes(c.name)&&c.unit===unit&&c.kind==='voice'); const W=g.filter(c=>c.score===1).length, L=g.filter(c=>c.score===-1).length; console.log('pooled',unit,'W',W,'L',L,'n',g.length);}
// MOM
for (const name of ['MOM-vs-K0-H2','MOM-vs-K0-S1','MOM-vs-K0-H2-voice','MOM-vs-K0-S1-voice']) for (const unit of ['preferred','palette']) { const g=J.filter(c=>c.name===name&&c.unit===unit); console.log(name, unit, g.map(c=>(c.identical?'I':'')+c.score+'['+(c.v||[]).join('')+']').join(' ')); }
