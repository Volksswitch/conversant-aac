import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const ROOT = 'C:/Users/ken/OneDrive/4 T-Z/Volksswitch/AI-driven AAC';
const rm = await import(pathToFileURL(ROOT + '/app/js/review-model.js').href);
const dir = ROOT + '/test-data-folder/conversations';
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.review.json')).sort()) {
  const data = JSON.parse(readFileSync(dir + '/' + f, 'utf8'));
  const turns = rm.buildTurns(data);
  console.log(`\n=== ${f.replace('.json','')}  partner=${turns[0]?.context.partner} place=${turns[0]?.context.place}`);
  for (const t of turns) {
    console.log(` [${t.key}] P: ${t.partnerText}`);
    t.cards.forEach((c, i) => console.log(`    ${i === t.took ? '*' : ' '}${i} ${c.slot}: ${c.text}`));
    if (t.user) console.log(`    U(${t.user.source}): ${t.user.text}`);
  }
}
