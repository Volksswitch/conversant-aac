/* Does an OpenAI key actually work for speech, and what does it cost?
 *
 *   node scripts/test-openai-speech.mjs
 *
 * Reads the key from OPENAI_API_KEY, or from a gitignored `.openai-key` at the repo
 * root - the same arrangement as the Anthropic and Deepgram keys, so no key ever
 * passes through a conversation or a commit.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE BENCH. The bench answers "which voice sounds
 * best" and needs ears. This answers "does this account work at all", which is a
 * yes/no that should not need a browser, a microphone or a person - and it is the
 * question that comes up the moment somebody makes a key without paying.
 *
 * (!) THE MOST LIKELY FAILURE IS NOT A BROKEN KEY. OpenAI answers an account with no
 * credit with the SAME status code it uses for genuine rate limiting, so the reason
 * has to be read out of the message rather than the number. That distinction is the
 * whole point of the reporting below: "add money" and "slow down" are different
 * problems and only one of them is fixed by waiting.
 *
 * It writes hello.mp3 beside itself so the voice can be listened to afterwards, and
 * then sends that same audio back for transcription - so one run exercises both
 * halves and the second half is fed by the first rather than by something invented.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, 'hello.mp3');

const PHRASE = 'Are you wearing a tie tonight? I thought we might walk down to the diner after.';

function loadKey() {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
        return process.env.OPENAI_API_KEY.trim();
    }
    for (const name of ['.openai-key', '.openai-key.txt']) {
        const p = join(ROOT, name);
        if (existsSync(p)) {
            const k = readFileSync(p, 'utf8').trim();
            if (k) return k;
        }
    }
    return null;
}

/* Turn a failure into the sentence that names what to DO about it. A bare status
 * number is the least useful thing to print, and for 429 it is actively misleading. */
async function explain(res) {
    let body = '';
    try { body = await res.text(); } catch { /* nothing to read */ }
    const short = body.replace(/\s+/g, ' ').slice(0, 300);
    if (res.status === 401 || res.status === 403) {
        return `the key was refused (HTTP ${res.status}). Check it was copied whole.\n     ${short}`;
    }
    if (res.status === 429) {
        return /insufficient_quota|exceeded your current quota|billing/i.test(body)
            ? `this account has no API credit (HTTP 429).\n`
              + `     The free ChatGPT plan does not pay for the API - they are billed separately.\n`
              + `     Adding the $5 minimum at platform.openai.com under Billing turns it on.\n`
              + `     ${short}`
            : `too many requests just now (HTTP 429). Wait a moment and run it again.\n     ${short}`;
    }
    if (res.status === 404) {
        return `not found (HTTP 404) - the model name is probably wrong for this account.\n     ${short}`;
    }
    return `the request was rejected (HTTP ${res.status}).\n     ${short}`;
}

async function speak(key, model, voice) {
    const t0 = Date.now();
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voice, input: PHRASE }),
    });
    if (!res.ok) return { ok: false, why: await explain(res) };
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, ms: Date.now() - t0, bytes: buf.length, buf };
}

async function transcribe(key, model, buf) {
    const t0 = Date.now();
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'hello.mp3');
    form.append('model', model);
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
    });
    if (!res.ok) return { ok: false, why: await explain(res) };
    const j = await res.json();
    return { ok: true, ms: Date.now() - t0, text: (j.text || '').trim() };
}

async function main() {
    const key = loadKey();
    if (!key) {
        console.error('No OpenAI key found.\n');
        console.error('Put it in a file called  .openai-key  at the top of the project');
        console.error('folder (it is gitignored, so it cannot be committed), or set');
        console.error('OPENAI_API_KEY in the environment. Then run this again.');
        process.exit(1);
    }
    console.log(`Using a key ending ...${key.slice(-4)}\n`);

    console.log('SPEAKING');
    let spoken = null;
    for (const model of ['gpt-4o-mini-tts', 'tts-1']) {
        const r = await speak(key, model, 'alloy');
        if (r.ok) {
            console.log(`  ${model.padEnd(16)} spoke, ${(r.ms / 1000).toFixed(2)}s, `
                        + `${Math.round(r.bytes / 1024)} KB`);
            if (!spoken) spoken = r.buf;
        } else {
            console.log(`  ${model.padEnd(16)} ${r.why}`);
        }
    }

    if (spoken) {
        writeFileSync(OUT, spoken);
        console.log(`\n  Saved ${OUT} - play it to hear the voice.`);
    }

    console.log('\nHEARING');
    if (!spoken) {
        console.log('  skipped - there is no audio to transcribe, because speaking failed.');
    } else {
        for (const model of ['gpt-4o-transcribe', 'whisper-1']) {
            const r = await transcribe(key, model, spoken);
            console.log(r.ok
                ? `  ${model.padEnd(18)} ${(r.ms / 1000).toFixed(2)}s  "${r.text}"`
                : `  ${model.padEnd(18)} ${r.why}`);
        }
    }

    console.log('\nWHAT THIS DID AND DID NOT SHOW');
    console.log('  It shows whether the account works and roughly how quick it is.');
    console.log('  It does NOT tell you whether the voice is any good - that needs ears,');
    console.log('  and side by side against the others, which is what the bench is for:');
    console.log('  prototypes/speech-providers.html');
}

main().catch((e) => { console.error('Failed to run:', e.message); process.exit(1); });
