import { closerEverything, allConditions } from '../exp-review/conditions.mjs';
const c = await closerEverything();
console.log('CLOSER50 answers', c.answers.length, 'lean', JSON.stringify(c.harvest.lengthLean), 'exemplars', c.harvest.exemplars.length, 'counts', JSON.stringify(c.harvest.counts));
console.log((c.block.match(/Offered a choice[^\n]*/)||['none'])[0]);
