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

import * as platform from './platform.js';

/*
 * What to ask for when a paid service opens the microphone.
 *
 * ON AN iPAD, NO CALL PROCESSING (Ken, November 13 2026). With echo cancellation the
 * iPad puts the whole app into its call mode while listening, and call mode changes
 * what the app SAYS as well as what it hears: a holding phrase that started while the
 * microphone was on sounded like a phone call, then clear the moment listening
 * stopped - "almost two different voices". A beta tester's iPad also heard him about
 * thirty times more quietly than Voice Memos does, and Voice Memos uses none of this
 * processing. All three are switched off together because on an iPad they are one
 * piece of processing, and asking for any one of them may bring the call mode back.
 *
 * What it costs: the microphone hears the app's own voice more strongly while a
 * holding phrase plays. stt.js already ignores words that match what the app just
 * said, and does not count sound as the partner speaking while the app is talking;
 * those two now do more of the work, and the paid service is sent (and bills for)
 * those few seconds.
 *
 * Everywhere else the request is what it always was.
 */
export function micProcessing(ipad = (() => { try { return platform.isIOS(); } catch { return false; } })()) {
    return ipad
        ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
}

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
