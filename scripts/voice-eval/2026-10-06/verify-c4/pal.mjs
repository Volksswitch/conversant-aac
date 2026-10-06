import { readFileSync } from 'node:fs';
const J = JSON.parse(readFileSync('../exp-review/judge.json','utf8')).comparisons;
const g=J.filter(c=>['K1-vs-K0','K3-vs-K0','K10-vs-K0','K0b-vs-K0a'].includes(c.name)&&c.unit==='palette'&&c.kind==='voice'&&c.score!==0);
for (const c of g) console.log(c.name, c.turn, 'x', c.xCond+c.xSample, 'y', c.yCond+c.ySample, c.score, c.v.join(''));
// distinct K0 samples beaten
const beaten = new Set(g.filter(c=>c.score===1 && c.name!=='K0b-vs-K0a').map(c=>c.turn+'#'+c.ySample)); console.log('distinct K0 palettes beaten', beaten.size, [...beaten]);
