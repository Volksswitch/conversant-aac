// Shared Azure Speech helpers for the how-to video tools.
// Key file: .azure-key at the project root, key on line 1, region on line 2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readAzureKey() {
  const p = path.join(ROOT, '.azure-key');
  if (!fs.existsSync(p)) throw new Error('No .azure-key file in the project folder.');
  const [key, region] = fs.readFileSync(p, 'utf8').split(/\r?\n/).map(s => s.trim());
  if (!key || !region) throw new Error('.azure-key needs the key on line 1 and the region on line 2.');
  return { key, region };
}

export async function listVoices({ key, region }) {
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    { headers: { 'Ocp-Apim-Subscription-Key': key } });
  if (!r.ok) throw new Error(`Voice list refused: ${r.status} ${await r.text()}`);
  return r.json();
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Returns MP3 bytes. The free tier refuses past 20 requests a minute, so
// callers making several in a row should pace them (see pace()).
export async function synthesize({ key, region }, voice, text) {
  const ssml = `<speak version="1.0" xml:lang="en-US"><voice name="${voice}">${esc(text)}</voice></speak>`;
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'conversant-video',
    },
    body: ssml,
  });
  if (!r.ok) throw new Error(`Azure refused ${voice}: ${r.status} ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}

export const pace = ms => new Promise(res => setTimeout(res, ms));
