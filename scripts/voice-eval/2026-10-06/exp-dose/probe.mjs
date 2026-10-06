import * as B from './build.mjs';
for (const id of ['marc-delgado','grace-thompson']) {
  const { persona, skipped } = await B.loadPersona(id);
  const b = B.fullBlocks();
  console.log('=====', id, 'skipped:', skipped.join(','));
  console.log('WV chars', b.worldview.length, 'REL', b.relationships.length, 'PL', b.places.length, 'keys', b.keys.length);
  console.log(b.worldview);
  console.log(b.relationships);
  console.log(b.places);
  const v = await B.voiceBlock(persona, { soundCheck: true });
  console.log('VOICE chars', v.length); console.log(v);
}
