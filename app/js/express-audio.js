/* Express Panel SOUND buttons — the rules that do not need a page (Ken, September 14 2026).
 *
 * A speech and language therapist asked for a panel button that plays an audio file.
 * Three kinds of recording are in scope: the user's own recorded voice (message
 * banking), somebody else's voice, and a sound or music. The KIND matters because the
 * conversation record and the AI are told what happened, and a recording of somebody
 * else must never be filed as the user saying it.
 *
 * WHERE THEY MAY GO: the Always and Flex bands only. The Context band holds things that
 * describe the conversation; a sound is something the other person hears.
 *
 * FILES live in an "audio" folder inside the data folder, one per button, and travel
 * inside a backup so they copy from device to device with everything else.
 *
 * ONLY MP3 AND M4A are accepted, and the check happens when the file is added - not at
 * playback, in the middle of a conversation - because other formats do not play on an
 * iPad.
 */

export const AUDIO_KIND = { MINE: 'mine', OTHER: 'other', SOUND: 'sound' };

export const AUDIO_KIND_LABELS = {
    [AUDIO_KIND.MINE]: 'My own recorded voice',
    [AUDIO_KIND.OTHER]: "Someone else's voice",
    [AUDIO_KIND.SOUND]: 'A sound or music',
};

// Generous enough for a song, small enough that a backup carrying a handful of clips
// stays a file somebody can still move around.
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const ALLOWED = { mp3: 'audio/mpeg', m4a: 'audio/mp4' };

export function audioExtension(name) {
    const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
}

/** Is this file one the app will accept? { ok, ext, type } or { ok: false, reason }. */
export function checkAudioFile(file) {
    if (!file) return { ok: false, reason: 'No file was chosen.' };
    const ext = audioExtension(file.name);
    if (!ALLOWED[ext]) {
        return { ok: false, reason: 'Only MP3 and M4A files can be used. Other kinds do not play on every device.' };
    }
    if (file.size > MAX_AUDIO_BYTES) {
        return { ok: false, reason: 'That file is larger than 10 MB. Try a shorter clip.' };
    }
    return { ok: true, ext, type: ALLOWED[ext] };
}

/**
 * The name the clip is stored under. It carries a fresh stamp every time, so choosing a
 * different file for the same button makes a NEW name, and nothing that remembered the
 * old one can play stale audio.
 */
export function audioFileName(itemId, ext, now = Date.now()) {
    const safeId = String(itemId || 'sound').replace(/[^A-Za-z0-9_-]/g, '');
    return `${safeId}-${now.toString(36)}.${ext}`;
}

/** A stored name we are willing to read or write. Guards a backup handed to us from outside. */
export function isSafeAudioName(name) {
    return /^[A-Za-z0-9_-]+\.(mp3|m4a)$/.test(String(name || ''));
}

export function mimeForName(name) {
    return ALLOWED[audioExtension(name)] || 'application/octet-stream';
}

/**
 * What the conversation record and the AI are told. Never the user "saying" the label:
 * a recording of somebody else is said to be one.
 */
export function transcriptText(item) {
    const label = String((item && item.label) || '').trim() || 'a recording';
    const kind = item && item.kind;
    if (kind === AUDIO_KIND.MINE) return `(played my recorded message: ${label})`;
    if (kind === AUDIO_KIND.OTHER) return `(played a recording of someone else: ${label})`;
    return `(played a sound: ${label})`;
}

// --- carrying clips inside a backup, which is a text file -------------------------

export async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let out = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(out);
}

export function base64ToBlob(b64, type) {
    const bin = atob(String(b64 || ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || 'application/octet-stream' });
}
