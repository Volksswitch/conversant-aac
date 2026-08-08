/* Deepgram Aura-2 pronunciation probe — August 8 2026
 *
 * Deepgram documents two ways to bend a voice using nothing but the text, because
 * Aura supports no SSML at all:
 *   developers.deepgram.com/docs/text-to-speech-prompting        (respelling, pauses)
 *   developers.deepgram.com/docs/improving-aura-2-formatting     (Aura-2 specifics)
 * This runs every documented technique against a real Aura-2 voice — the same models
 * the app ships — and reports what actually happened.
 *
 * ── WHY IT MEASURES INSTEAD OF JUST SAVING AUDIO ──
 *
 * "Did the pronunciation change?" needs an ear, and the point of a probe is to answer
 * it without one being required. So each phrase is spoken and then fed straight back
 * through Deepgram's own speech-to-text, and the transcript is the evidence: if
 * "rahn-day-voo" comes back as "rendezvous", the respelling reached the phonemes.
 *   The round trip is EVIDENCE, NOT PROOF, and the limit is worth knowing: a
 * recogniser is a language model too, so it snaps what it hears toward real words. It
 * can therefore report a success that a listener would not accept, and it says
 * nothing at all about whether the result sounds natural. Every phrase is also saved
 * as a .wav so the ear can overrule the numbers.
 *   Pauses need no ear either way: they are measured off the audio directly, as the
 * longest run of near-silence between the two words. That number is objective.
 *
 * ── USAGE ──
 *
 *   node scripts/deepgram-pronunciation-probe.mjs [--voice aura-2-thalia-en] [--out DIR]
 *
 * The key comes from DEEPGRAM_API_KEY, or from a gitignored file in the repo root
 * (see KEY_FILES). It is never printed, never written to the output, and never sent
 * anywhere but Deepgram.
 *
 * Cost is a couple of US cents per run: Aura-2 bills per character (~1,000 here) and
 * pre-recorded speech-to-text per minute (well under one).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Candidate key files, in order. Kept loose on purpose — the .gitignore covers all
// of these spellings, and a probe that cannot find the key is a better outcome than
// one that sends an empty string and reports a wall of auth failures.
const KEY_FILES = ['deepgram key.txt', '.deepgram-key', 'deepgram-key.txt', 'deepgram_key.txt'];

const SAMPLE_RATE = 24000;
const BYTES_PER_SAMPLE = 2;              // linear16

// ── the probes ───────────────────────────────────────────────────────────────
// Each is { group, name, text, expect } and, where a comparison is the point, they
// are ordered baseline-then-variant so the report reads as a pair. `expect` is what
// the transcript should say if the technique worked — compared case- and
// punctuation-insensitively, and reported, never asserted (this is a probe, not a
// test suite: the interesting outcome is the one nobody predicted).
const PROBES = [
    // A. Phonetic respelling — the documented headline technique, and the one the
    // app most needs: proper nouns are exactly what a voice gets wrong.
    { group: 'Respelling', name: 'rendezvous (as written)', text: 'Meet me at the rendezvous.', expect: 'rendezvous' },
    { group: 'Respelling', name: 'rendezvous (respelled)', text: 'Meet me at the rahn-day-voo.', expect: 'rendezvous' },
    { group: 'Respelling', name: 'Siobhan (as written)', text: 'I am going with Siobhan.', expect: 'Siobhan' },
    { group: 'Respelling', name: 'Siobhan (respelled)', text: 'I am going with Shiv-awn.', expect: 'Siobhan' },
    { group: 'Respelling', name: 'Worcestershire (as written)', text: 'Pass the Worcestershire sauce.', expect: 'Worcestershire' },
    { group: 'Respelling', name: 'Worcestershire (respelled)', text: 'Pass the Wuss-ter-sher sauce.', expect: 'Worcestershire' },
    // A real one for this project: the org name is a coinage no voice has seen.
    { group: 'Respelling', name: 'Volksswitch (as written)', text: 'It is from Volksswitch.', expect: 'Volksswitch' },
    { group: 'Respelling', name: 'Volksswitch (respelled)', text: 'It is from Folks-switch.', expect: 'Volksswitch' },

    // B. Letters and acronyms. "AAC" is the case that matters here — read as a word
    // it is meaningless, and this app says it.
    { group: 'Acronyms', name: 'AAC (bare)', text: 'I use an AAC device.', expect: 'AAC' },
    { group: 'Acronyms', name: 'AAC (quoted, Aura-2 doc)', text: 'I use an "AAC" device.', expect: 'AAC' },
    { group: 'Acronyms', name: 'AAC (spelled phonetically)', text: 'I use an Eigh Eigh Sea device.', expect: 'AAC' },
    { group: 'Acronyms', name: 'NASA (should be a word)', text: 'She works at NASA.', expect: 'NASA' },
    { group: 'Acronyms', name: 'NBA (should be letters)', text: 'He watches the NBA.', expect: 'NBA' },

    // C. Numbers and currency.
    { group: 'Numbers', name: '1235 (digits)', text: 'The total is 1235 dollars.', expect: '1235' },
    { group: 'Numbers', name: '1235 (with "and")', text: 'The total is twelve hundred and thirty-five dollars.', expect: '1235' },
    { group: 'Numbers', name: 'currency $45.82', text: 'Your total is $45.82.', expect: '45.82' },
    { group: 'Numbers', name: 'phone number', text: 'Call 555.867.5309 today.', expect: '5558675309' },

    // D. Pauses. Judged by measured silence, not by transcript.
    { group: 'Pauses', name: 'baseline (period)', text: 'Yes. No.', pause: true },
    { group: 'Pauses', name: 'comma', text: 'Yes, No.', pause: true },
    { group: 'Pauses', name: 'ellipsis', text: 'Yes ... No.', pause: true },
    { group: 'Pauses', name: 'spaced dots', text: 'Yes . . . No.', pause: true },
    { group: 'Pauses', name: 'more spaced dots', text: 'Yes . . . . . . No.', pause: true },
    { group: 'Pauses', name: 'hyphen (Aura-2 doc)', text: 'Yes - No.', pause: true },

    // E. Emphasis. The two Deepgram pages DISAGREE here: the general prompting page
    // is silent on capitals, the Aura-2 page lists ALL CAPS among things to avoid.
    // The failure worth catching is the voice spelling the word out letter by letter.
    { group: 'Emphasis', name: 'plain', text: 'I never said that.', expect: 'never' },
    { group: 'Emphasis', name: 'ALL CAPS', text: 'I NEVER said that.', expect: 'never' },

    // F. Fillers — documented as a naturalness lever, and directly relevant to the
    // placeholder phrases, which must sound like thinking rather than like an answer.
    { group: 'Fillers', name: 'no filler', text: 'Let me think about that.' },
    { group: 'Fillers', name: 'with filler', text: 'Um, let me think about that.' },
];

// ── key ──────────────────────────────────────────────────────────────────────

function loadKey() {
    const fromEnv = (process.env.DEEPGRAM_API_KEY || '').trim();
    if (fromEnv) return { key: fromEnv, source: 'DEEPGRAM_API_KEY' };
    for (const f of KEY_FILES) {
        if (!existsSync(f)) continue;
        const key = readFileSync(f, 'utf8').trim();
        if (key) return { key, source: f };
    }
    return null;
}

// ── audio helpers ────────────────────────────────────────────────────────────

/** Strip a RIFF/WAVE header if Deepgram returned one, leaving raw linear16. */
function toPcm(buf) {
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF') {
        // Walk the chunks rather than assuming the canonical 44-byte header — some
        // encoders insert LIST/fact chunks, and a fixed offset would shift every
        // sample and quietly corrupt every measurement below.
        let at = 12;
        while (at + 8 <= buf.length) {
            const id = buf.toString('ascii', at, at + 4);
            const size = buf.readUInt32LE(at + 4);
            if (id === 'data') return buf.subarray(at + 8, Math.min(at + 8 + size, buf.length));
            at += 8 + size + (size % 2);
        }
    }
    return buf;
}

const seconds = (pcm) => pcm.length / (SAMPLE_RATE * BYTES_PER_SAMPLE);

/**
 * The longest run of near-silence, in seconds, ignoring the lead-in and run-out.
 * That interior run IS the pause between the two words, which is what the pause
 * techniques claim to lengthen.
 */
function longestInteriorSilence(pcm) {
    const total = pcm.length / BYTES_PER_SAMPLE;
    if (!total) return 0;
    // Threshold relative to this clip's own peak: voices differ in level, and a fixed
    // amplitude would call a quiet voice silent throughout.
    let peak = 0;
    for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)));
    const quiet = Math.max(120, peak * 0.04);

    // Trim the leading and trailing silence first — every clip has some, and it is
    // not a pause between anything.
    let first = 0, last = total - 1;
    while (first < total && Math.abs(pcm.readInt16LE(first * 2)) < quiet) first++;
    while (last > first && Math.abs(pcm.readInt16LE(last * 2)) < quiet) last--;

    let best = 0, run = 0;
    for (let i = first; i <= last; i++) {
        if (Math.abs(pcm.readInt16LE(i * 2)) < quiet) { run++; best = Math.max(best, run); }
        else run = 0;
    }
    return best / SAMPLE_RATE;
}

/** Wrap raw linear16 in a minimal WAV header so the file plays on a double-click. */
function toWav(pcm) {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
    h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * BYTES_PER_SAMPLE, 28);
    h.writeUInt16LE(BYTES_PER_SAMPLE, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
}

// ── Deepgram ─────────────────────────────────────────────────────────────────

async function speak(key, model, text) {
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`
              + `&encoding=linear16&sample_rate=${SAMPLE_RATE}&container=wav`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`speak ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return toPcm(Buffer.from(await res.arrayBuffer()));
}

async function listen(key, pcm) {
    const url = `https://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16`
              + `&sample_rate=${SAMPLE_RATE}&channels=1&punctuate=true&smart_format=false`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/octet-stream' },
        body: pcm,
    });
    if (!res.ok) throw new Error(`listen ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const alt = json?.results?.channels?.[0]?.alternatives?.[0];
    return { transcript: (alt?.transcript || '').trim(), confidence: alt?.confidence ?? null };
}

// ── run ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const VOICE = argOf('--voice', 'aura-2-thalia-en');
const OUT = argOf('--out', 'deepgram-probe-audio');

const found = loadKey();
if (!found) {
    console.error('No Deepgram key. Set DEEPGRAM_API_KEY, or put the key in one of:');
    for (const f of KEY_FILES) console.error(`  ${f}`);
    process.exit(1);
}
console.log(`Voice: ${VOICE}   Key: read from ${found.source}   Audio: ${OUT}/\n`);
mkdirSync(OUT, { recursive: true });

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const rows = [];
let n = 0;

for (const probe of PROBES) {
    n++;
    const label = `${probe.group} / ${probe.name}`;
    try {
        const pcm = await speak(found.key, VOICE, probe.text);
        const file = join(OUT, `${String(n).padStart(2, '0')}-${probe.group}-${probe.name.replace(/[^\w]+/g, '_')}.wav`);
        writeFileSync(file, toWav(pcm));
        const heard = await listen(found.key, pcm);
        rows.push({
            label,
            sent: probe.text,
            heard: heard.transcript,
            conf: heard.confidence == null ? '' : heard.confidence.toFixed(2),
            secs: seconds(pcm).toFixed(2),
            gap: longestInteriorSilence(pcm).toFixed(2),
            match: probe.expect ? (norm(heard.transcript).includes(norm(probe.expect)) ? 'yes' : 'NO') : '',
            file,
        });
        console.log(`[${n}/${PROBES.length}] ${label}`);
    } catch (err) {
        rows.push({ label, sent: probe.text, heard: `ERROR: ${err.message}`, conf: '', secs: '', gap: '', match: '', file: '' });
        console.log(`[${n}/${PROBES.length}] ${label} — ${err.message}`);
    }
}

// ── report ───────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(100));
console.log(`RESULTS — ${VOICE}`);
console.log('='.repeat(100));
let group = null;
for (const r of rows) {
    const g = r.label.split(' / ')[0];
    if (g !== group) { group = g; console.log(`\n── ${g} ` + '─'.repeat(Math.max(0, 96 - g.length))); }
    console.log(`\n  ${r.label.split(' / ')[1]}`);
    console.log(`    sent   : ${r.sent}`);
    console.log(`    heard  : ${r.heard}${r.conf ? `   (confidence ${r.conf})` : ''}`);
    console.log(`    audio  : ${r.secs}s total, longest interior silence ${r.gap}s`);
    if (r.match) console.log(`    wanted : ${r.match === 'yes' ? 'yes — the transcript carries it' : 'NO  — the transcript does not carry it'}`);
}

console.log(`\n\n${'='.repeat(100)}`);
console.log('READ THIS BEFORE BELIEVING THE TABLE');
console.log('='.repeat(100));
console.log([
    'The transcript is evidence, not proof. Speech-to-text is a language model too, so it',
    'snaps what it hears toward real words - it can report a respelling as working when a',
    'listener would not accept it, and it says nothing about whether the result sounds',
    'natural. The pause figures need no such caveat: they are measured off the audio.',
    '',
    `Every phrase is saved in ${OUT}/ - listen before deciding anything.`,
].join('\n'));
