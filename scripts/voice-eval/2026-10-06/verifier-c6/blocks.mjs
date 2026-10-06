// Build K0 block via the app's harvest, then split it into exemplar-only and lean-only variants. No API calls.
import { writeFileSync } from 'node:fs';
import * as L from '../exp-review/lib.mjs';
const { block } = await L.voiceBlockFor(L.loadConversations());
const paras = block.split('\n\n');
const isEx = (p) => p.startsWith('Sentences this user has actually written');
const isLean = (p) => p.startsWith('Offered a choice of wordings');
console.log('paras', paras.length, 'ex', paras.filter(isEx).length, 'lean', paras.filter(isLean).length);
const EXONLY = paras.filter((p) => !isLean(p)).join('\n\n');
const LEANONLY = paras.filter((p) => !isEx(p)).join('\n\n');
const NULLH = await L.voiceBlockNullHarvest();
const K0 = paras.join('\n\n');
// sanity: removing both should equal NULLH
const BOTHOFF = paras.filter((p) => !isEx(p) && !isLean(p)).join('\n\n');
console.log('BOTHOFF === NULLH:', BOTHOFF === NULLH, BOTHOFF.length, NULLH.length);
writeFileSync('blocks.json', JSON.stringify({ K0, EXONLY, LEANONLY, NULLH }, null, 1));
