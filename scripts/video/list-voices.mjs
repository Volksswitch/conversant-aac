import { readAzureKey, listVoices } from './azure.mjs';
const v = await listVoices(readAzureKey());
for (const x of v.filter(x => x.Locale === 'en-US'))
  console.log(x.ShortName, x.Gender, x.VoiceType, (x.StyleList || []).length ? 'styles' : '');
