// Speaks one line per candidate voice for each of the three video roles,
// so the narrator, user and partner voices can be chosen by ear.
// Output: Videos/voice-samples/<role> - <n> <name>.mp3
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readAzureKey, synthesize, pace } from './azure.mjs';

const ROLES = {
  narrator: {
    line: "This is the Conversant screen. At the top, you'll see what the other person said. Below it are four options for what you could say back.",
    voices: [
      ['Ava', 'en-US-Ava:DragonHDLatestNeural'],
      ['Andrew', 'en-US-Andrew:DragonHDLatestNeural'],
      ['Emma', 'en-US-Emma:DragonHDLatestNeural'],
    ],
  },
  user: {
    line: "Hey! I'm doing good. I came in for the new Spider-Man. Did it come out yet?",
    voices: [
      ['Brandon', 'en-US-BrandonNeural'],
      ['Kai', 'en-US-KaiNeural'],
      ['Jason', 'en-US-JasonNeural'],
    ],
  },
  partner: {
    line: "Hi Marc, good to see you again. How's it going? Looking for anything special today?",
    voices: [
      ['Jenny', 'en-US-JennyNeural'],
      ['Sara', 'en-US-SaraNeural'],
      ['Aria', 'en-US-AriaNeural'],
    ],
  },
};

const creds = readAzureKey();
const out = path.join(ROOT, 'Videos', 'voice-samples');
fs.mkdirSync(out, { recursive: true });
for (const [role, { line, voices }] of Object.entries(ROLES)) {
  for (const [i, [name, id]] of voices.entries()) {
    const file = path.join(out, `${role} - ${i + 1} ${name}.mp3`);
    fs.writeFileSync(file, await synthesize(creds, id, line));
    console.log('wrote', path.relative(ROOT, file));
    await pace(4000); // free tier: no more than 20 requests a minute
  }
}
