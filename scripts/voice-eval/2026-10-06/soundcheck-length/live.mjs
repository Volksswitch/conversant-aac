import { readFileSync, readdirSync, existsSync } from 'node:fs';
import * as L from '../exp-review/lib.mjs';
const DATA = L.ROOT + '/test-data-folder';
const dir = DATA + '/conversations';
// conversations WITH their review files, as storage.listConversationLogs() would attach them
const withReviews = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.review.json')).sort().map((f) => {
  const rp = `${dir}/${f.replace(/\.json$/, '.review.json')}`;
  return { id: f.replace(/\.json$/, ''), data: JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')), review: existsSync(rp) ? JSON.parse(readFileSync(rp, 'utf8')) : null };
});
const noReviews = L.loadConversations();
const opts = L.harvestOpts();
const hR = L.voiceHarvest.harvest(withReviews, opts);
const hN = L.voiceHarvest.harvest(noReviews, opts);
console.log('conversations', withReviews.length, 'with review file', withReviews.filter((c) => c.review).length);
console.log('LIVE lean (app harvest, phrase lists, reviews attached):', JSON.stringify(hR.lengthLean), 'counts', JSON.stringify(hR.counts));
console.log('LIVE lean (no reviews):', JSON.stringify(hN.lengthLean));
// Sound Check-derived lean from the test folder's own voice.json, through the SAME function
const sc = await import(new URL('file:///' + L.ROOT + '/app/js/sound-check-items.js').href);
const v = L.VOICE_JSON;
const pseudo = [];
for (const it of sc.SOUND_CHECK_ITEMS) {
  const a = v.soundCheck[it.id]; if (!a || !a.choice) continue;
  const choice = sc.RENAMED_CANDIDATES[a.choice] || a.choice;
  if (!it.candidates.includes(choice)) { console.log('UNMATCHED', it.id, choice); continue; }
  pseudo.push({ role: 'user', source: 'card', selectedText: choice, allOptions: it.candidates.slice() });
}
console.log('SOUND CHECK lean (voice.json picks through measureLengthLean):', JSON.stringify(L.voiceHarvest.measureLengthLean(pseudo, {})), 'n', pseudo.length);
// the block Marc actually gets with the live harvest
const { block } = await L.voiceBlockFor(withReviews);
const lines = block.split('\n');
lines.forEach((l, i) => { if (/Match the length|fuller one|shorter one|button labels|standing instruction|asked \d times/.test(l)) console.log(`block line ${i}: ${l}`); });
console.log('repeatedSteers:', JSON.stringify(L.voice.repeatedSteers()));
console.log('all steers:', JSON.stringify(L.voice.getHarvest() && null), JSON.stringify((L.VOICE_JSON.steers || []).map((s) => s.text)));
// does the lean paragraph come AFTER the Sound Check paragraph?
const iSC = lines.findIndex((l) => l.startsWith('Match the length')), iLean = lines.findIndex((l) => /fuller one|shorter one/.test(l));
console.log('order: SoundCheck-instruction line', iSC, 'lean line', iLean, 'block chars', block.length);
