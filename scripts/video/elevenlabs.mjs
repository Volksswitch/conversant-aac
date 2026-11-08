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

// A voice's own saved settings (stability and the rest), so a script can change
// only its speed and leave everything else as the voice's owner set it.
const savedSettings = new Map();
async function settingsOf(key, id) {
  if (!savedSettings.has(id)) {
    const r = await fetch(`${API}/voices/${id}/settings`, { headers: headers(key) });
    if (!r.ok) throw new Error(`ElevenLabs refused the settings of voice ${id}: ${r.status}`);
    savedSettings.set(id, await r.json());
  }
  return savedSettings.get(id);
}

// Returns MP3 bytes. `voice` is { id, model, settings, speed }. `speed` (0.7 to
// 1.2) slows or quickens the voice and keeps its other saved settings.
// `around` ({ previous, next }) is the text said just before and after this piece,
// so a line said in pieces keeps one tone instead of each piece sounding as though
// it was recorded somewhere else. `voice.seed` makes the same text come out the same.
export async function synthesizeEleven(key, voice, text, around = {}) {
  let settings = voice.settings ? { ...(await settingsOf(key, voice.id)), ...voice.settings } : null;
  if (voice.speed) settings = { ...(settings || await settingsOf(key, voice.id)), speed: voice.speed };
  const r = await fetch(`${API}/text-to-speech/${voice.id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: headers(key, { 'Content-Type': 'application/json', Accept: 'audio/mpeg' }),
    body: JSON.stringify({
      text,
      model_id: voice.model || 'eleven_multilingual_v2',
      ...(settings ? { voice_settings: settings } : {}),
      ...(voice.seed != null ? { seed: voice.seed } : {}),
      ...(around.previous ? { previous_text: around.previous } : {}),
      ...(around.next ? { next_text: around.next } : {}),
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs refused ${voice.name || voice.id}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

// The same, plus the time each character is said, so one take of a whole line can
// be cut at its sentences. Returns { audio: Buffer (MP3), alignment }.
export async function synthesizeElevenTimed(key, voice, text, around = {}) {
  let settings = voice.settings ? { ...(await settingsOf(key, voice.id)), ...voice.settings } : null;
  if (voice.speed) settings = { ...(settings || await settingsOf(key, voice.id)), speed: voice.speed };
  const r = await fetch(`${API}/text-to-speech/${voice.id}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: headers(key, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      text,
      model_id: voice.model || 'eleven_multilingual_v2',
      ...(settings ? { voice_settings: settings } : {}),
      ...(voice.seed != null ? { seed: voice.seed } : {}),
      ...(around.previous ? { previous_text: around.previous } : {}),
      ...(around.next ? { next_text: around.next } : {}),
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs refused ${voice.name || voice.id}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return { audio: Buffer.from(j.audio_base64, 'base64'), alignment: j.alignment };
}

// node scripts/video/elevenlabs.mjs  -> lists the voices this key can use.
if (process.argv[1] && path.basename(process.argv[1]) === 'elevenlabs.mjs') {
  const voices = await listElevenVoices(readElevenKey());
  for (const v of voices) console.log(`${v.voice_id}  ${v.category.padEnd(12)} ${v.name}`);
}
