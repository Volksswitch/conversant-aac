// ElevenLabs speech for the video tools (the demo video's voices: Ken's cloned
// narrator voice, Eric for Marc, Charlie for Ramon, River for the barista).
// Key file: .elevenlabs-key at the project root, the key alone on line 1.
// The key is never printed.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './azure.mjs';

const API = 'https://api.elevenlabs.io/v1';

export function readElevenKey() {
  const p = path.join(ROOT, '.elevenlabs-key');
  if (!fs.existsSync(p)) throw new Error('No .elevenlabs-key file in the project folder.');
  const key = fs.readFileSync(p, 'utf8').split(/\r?\n/)[0].trim();
  if (!key) throw new Error('.elevenlabs-key is empty.');
  return key;
}

const headers = (key, extra = {}) => ({ 'xi-api-key': key, 'User-Agent': 'conversant-video', ...extra });

export async function listElevenVoices(key) {
  const r = await fetch(`${API}/voices`, { headers: headers(key) });
  if (!r.ok) throw new Error(`ElevenLabs voice list refused: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).voices || [];
}

// Returns MP3 bytes. `voice` is { id, model, settings }.
export async function synthesizeEleven(key, voice, text) {
  const r = await fetch(`${API}/text-to-speech/${voice.id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: headers(key, { 'Content-Type': 'application/json', Accept: 'audio/mpeg' }),
    body: JSON.stringify({
      text,
      model_id: voice.model || 'eleven_multilingual_v2',
      ...(voice.settings ? { voice_settings: voice.settings } : {}),
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs refused ${voice.name || voice.id}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

// node scripts/video/elevenlabs.mjs  -> lists the voices this key can use.
if (process.argv[1] && path.basename(process.argv[1]) === 'elevenlabs.mjs') {
  const voices = await listElevenVoices(readElevenKey());
  for (const v of voices) console.log(`${v.voice_id}  ${v.category.padEnd(12)} ${v.name}`);
}
