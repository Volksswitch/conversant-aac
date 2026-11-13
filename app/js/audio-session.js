/*
 * audio-session.js - tell an iPad what kind of sound the app is making.
 *
 * WHY IT EXISTS (Ken, measured on his iPad, November 13 2026). With a paid hearing
 * service, the app's voice played at full volume while the microphone was on, then
 * dropped to very quiet the moment the microphone was turned off - mid-word, when a
 * tap interrupted a holding phrase - and stayed quiet for every response and Express
 * phrase until Listen was pressed again. The Settings voice Test was loud before the
 * microphone had ever been used. One volume control moved both, so this is not a
 * separate "call" volume the user could set once.
 *
 * Best explanation, NOT proven: once a page has used the microphone, Safari leaves
 * its audio in a mode meant for calls after the microphone closes. Safari lets a page
 * say what kind of audio it is making (navigator.audioSession, Safari 16.4+), so the
 * app says "playback" whenever paid listening stops and hands the choice back to
 * Safari ("auto", what it did before this file existed) before the microphone opens.
 *
 * Scope, deliberately narrow:
 *   - Paid hearing only (stt.js calls this around an external source). The iPad's own
 *     recognizer in a Safari tab was never reported quiet, and it restarts itself
 *     constantly; changing the audio type under it is a risk with no evidence behind it.
 *   - A browser without navigator.audioSession (every Chromium browser) does nothing,
 *     so Windows, Chromebook, Mac and Android are unchanged.
 *   - Never throws: a diagnostic or a volume fix must not break listening.
 */

function session() {
    try {
        const s = typeof navigator !== 'undefined' ? navigator.audioSession : null;
        return s && 'type' in s ? s : null;
    } catch { return null; }
}

/** Before the microphone opens: let Safari choose, as it always did. */
export function forListening() {
    const s = session();
    if (!s) return;
    try { if (s.type !== 'auto') s.type = 'auto'; } catch { /* leave it */ }
}

/** After paid listening stops: ordinary playback, so the voice is not left quiet. */
export function forSpeaking() {
    const s = session();
    if (!s) return;
    try { if (s.type !== 'playback') s.type = 'playback'; } catch { /* leave it */ }
}

/** For the problem report: what the page last told Safari, or that it cannot. */
export function describe() {
    const s = session();
    if (!s) return 'not available here';
    try { return `${s.type}${s.state ? ` (${s.state})` : ''}`; } catch { return 'unreadable'; }
}
