/*
 * platform.js — what this browser can actually be relied on to do.
 *
 * Every fact encoded here was MEASURED on an iPad 10th generation (iPadOS 26,
 * Safari 26.6) on July 30 2026, across six runs: Safari, Chrome and Edge, each as
 * a browser tab and as a Home Screen app. Nothing here is inferred from published
 * documentation, which was wrong about iOS four times out of eight when tested.
 *
 * THE MEASURED RESULT, in one table:
 *
 *                        speech recognition        persistent storage
 *   Safari, tab          WORKS                     denied
 *   Safari, Home Screen  starts, delivers nothing  GRANTED
 *   Chrome, tab          starts, delivers nothing  denied
 *   Edge, tab            starts, delivers nothing  denied
 *   any Home Screen app  starts, delivers nothing  GRANTED
 *
 * The failure mode is the dangerous kind: recognition STARTS, feature detection
 * passes, and then no interim and no final results ever arrive. An app that trusts
 * feature detection will sit with its microphone icon lit, believing it is
 * listening, forever. For an AAC user that is worse than an honest refusal, so the
 * app asks this module first and says plainly when partner capture cannot work.
 *
 * WHAT THE APP DOES WITH THAT ANSWER — the verdict WARNS, it does not BLOCK
 * (Ken, July 30 2026). An earlier cut disabled the Listen button wherever this
 * module reported capture unusable. Ken's call: leave it live, "give Safari every
 * opportunity to surprise us and work in desktop app mode." The precedent is real
 * — the same probe run read as though placeholder speech would not fire either,
 * and on the device it did. A measured failure on one build of one iPadOS is
 * evidence, not a permanent property, and Apple ships changes we would never see
 * if the button refuses to try.
 *
 * So the two questions are kept SEPARATE, and callers should keep them separate:
 *
 *   apiPresent — is there a recognizer to call at all? When false there is
 *                genuinely nothing to try, and the control is disabled.
 *   usable     — is it MEASURED to deliver results here? When false the user is
 *                warned before they start, and then allowed to try anyway.
 *
 * ON USER-AGENT SNIFFING. Detecting the platform is normally a smell, and it is
 * used sparingly here, because these behaviors are NOT feature-detectable — the
 * APIs are all present in the environments where they silently do nothing. Where a
 * capability check exists (storage), it is used instead; see storage.js.
 *
 * The one genuine trap: iPadOS Safari requests desktop sites by default and its
 * user-agent says "Macintosh; Intel Mac OS X" with no "iPad" anywhere in it
 * (measured). A naive /iPad/ test therefore MISSES Safari — the only browser the
 * app works in — while matching Chrome and Edge, which do say "iPad" and are the
 * two that do not work. The maxTouchPoints check below is what avoids getting this
 * exactly backwards.
 */

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

// A Mac never reports multiple touch points; an iPad always does. This is the
// documented way to tell an iPadOS Safari (which claims to be a Mac) from an
// actual Mac, and it is why we do not simply match /iPad/.
function isTouchApple() {
    if (typeof navigator === 'undefined') return false;
    const applish = /Macintosh|iPad|iPhone|iPod/.test(ua);
    return applish && (navigator.maxTouchPoints || 0) > 1;
}

export function isIOS() {
    return isTouchApple();
}

/*
 * An Android phone or tablet.
 *
 * A SUPPORTED PLATFORM since August 31 2026 (Ken), measured on his own phone and
 * tablet. Until then the app did not know the word: Android matched no test here and
 * fell through to the desktop answers, so every bug report from one said "desktop"
 * and told us nothing about the device - which is a poor position to be in for a
 * platform people are being asked to use.
 *
 * Plain substring test, and unlike the Apple case it needs no trickery: Android
 * browsers say "Android" and mean it. Chrome OS says "CrOS" and is a desktop, so it
 * is not caught here. Deliberately does NOT try to separate phone from tablet - the
 * app has no behaviour that depends on which, and a guess based on screen size would
 * be wrong for a small tablet and a large phone alike.
 */
export function isAndroid() {
    return /\bAndroid\b/.test(ua);
}

// Running as a Home Screen app rather than in a browser tab. Both signals are
// checked because navigator.standalone is the older iOS-specific one and
// display-mode is the standard.
export function isStandalone() {
    if (typeof window === 'undefined') return false;
    if (window.navigator && window.navigator.standalone === true) return true;
    try {
        return window.matchMedia('(display-mode: standalone)').matches;
    } catch {
        return false;
    }
}

// Chrome and Edge on iOS are WebKit in a different wrapper. They identify
// themselves with their own tokens AND do say "iPad", so unlike Safari they are
// straightforward to detect.
export function iosBrowserShell() {
    if (!isTouchApple()) return null;
    if (/CriOS/.test(ua)) return 'Chrome';
    if (/EdgiOS/.test(ua)) return 'Edge';
    if (/FxiOS/.test(ua)) return 'Firefox';
    return null;    // Safari proper
}

/*
 * Can built-in speech recognition be relied on here?
 *
 * Returns { usable, apiPresent, reason, remedy }. `reason` and `remedy` are
 * user-facing, because the whole point is to replace a silent failure with an
 * explanation the user can act on — and, where there is a recognizer to call, the
 * wording invites them to try it rather than declaring the matter closed (see the
 * warn-don't-block note at the top of this file).
 */

// Shared by both measured-unreliable cases. Phrased as an invitation to try,
// because the button is live: the user finds out in ten seconds, and if Safari has
// improved they get listening rather than a refusal citing a stale measurement.
const IOS_TRY_ANYWAY =
    'On the iPad we tested, listening started but never heard anything. Try it — ' +
    'if nothing appears when the other person speaks, open Conversant in Safari instead.';

export function speechRecognitionSupport() {
    const apiPresent = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    if (!apiPresent) {
        return {
            usable: false,
            apiPresent: false,
            reason: 'This browser has no speech recognition.',
            remedy: isIOS()
                ? 'Use Safari on this iPad.'
                : 'Use Microsoft Edge or Google Chrome.',
        };
    }

    // Android: the built-in recognizer WORKS, unlike the installed iPad's - it is
    // simply poor. Measured on Ken's tablet: it re-sends the whole sentence on every
    // update (so what the partner said arrived as a stutter until stt.js learned to
    // collapse it), it restarted eighteen times in one conversation, and Android plays
    // its own tone at each restart, which is disconcerting mid-conversation.
    //
    // Ken's decision, August 31 2026: the paid transcription is REQUIRED on Android,
    // as it is on an installed iPad. Said here, in the one place that already carries
    // this kind of verdict, so the reason travels with a bug report instead of living
    // only in a manual.
    //
    // Still `apiPresent: true`, so the control stays live and the user may try
    // anyway - the warn-don't-block rule (July 30 2026) is unchanged, and the free
    // recognizer really does work well enough to evaluate the app with.
    if (isAndroid()) {
        return {
            usable: false,
            apiPresent: true,
            reason: 'On Android, hearing the other person needs the paid transcription service.',
            remedy: 'Add a Deepgram key in Settings, under Speech, and choose it for hearing '
                + 'the other person. Without it the built-in listening still works, but it '
                + 'drops words and the device plays a tone of its own each time it restarts.',
        };
    }

    if (isIOS()) {
        // Measured: recognition starts and then delivers nothing at all in a Home
        // Screen app, in every browser.
        if (isStandalone()) {
            return {
                usable: false,
                apiPresent: true,
                reason: 'Listening may not work when the app is opened from the Home Screen.',
                remedy: IOS_TRY_ANYWAY,
            };
        }
        // Measured: same silent failure in the Chrome and Edge wrappers, which
        // share Safari's engine but not its access to speech.
        const shell = iosBrowserShell();
        if (shell) {
            return {
                usable: false,
                apiPresent: true,
                reason: `Listening may not work in ${shell} on iPad.`,
                remedy: IOS_TRY_ANYWAY,
            };
        }
        return { usable: true, apiPresent: true, reason: '', remedy: '' };
    }

    return { usable: true, apiPresent: true, reason: '', remedy: '' };
}

/*
 * Recognition tuning for this platform.
 *
 *  continuous — iOS is NOT given continuous mode. Not because it fails: measured,
 *    it works. But it took 4,274 ms to a first result against 1,851 ms without,
 *    and this app exists to beat the four-second awkward-silence threshold, so
 *    2.4 seconds of avoidable latency on every partner turn is not affordable.
 *    stt.js already restarts recognition on 'end' while the user intends to
 *    listen, so non-continuous costs nothing structurally.
 *
 *  restartDelayMs — a beat before restarting, so a session that ends immediately
 *    cannot spin into a tight restart loop.
 *
 *  guardVisibility — ON EVERYWHERE since August 31 2026. It was an iOS-only guard,
 *    because iOS was the only platform where backgrounding was KNOWN to stop
 *    recognition. Measured on Ken's Android tablet: it does there too, and worse -
 *    the recognizer came back 'not-allowed' and the app tore listening down
 *    altogether, so he had to notice and press Listen again mid-conversation.
 *
 *    Made universal rather than given an Android branch, which REMOVES a fork
 *    instead of adding one. It is safe where recognition would have survived: the
 *    guard stops on hide and restarts on return, and stt.js flushes the pending
 *    interim on the way out, so nothing heard is lost. What it gives up is hearing
 *    the room while the app is in the background - which is not a thing this app
 *    does: the screen IS the interface, and a user who has switched away is not in
 *    the conversation.
 *
 *    ⚠ The alternative - detecting Android - would have needed a THIRD platform
 *    test in a file whose own header warns that these behaviours are not feature
 *    detectable, and would have left every future platform defaulting to the
 *    setting that is now known to be wrong on two of the three we have tried.
 */
export function speechConfig() {
    if (isIOS()) {
        return { continuous: false, restartDelayMs: 200, guardVisibility: true };
    }
    return { continuous: true, restartDelayMs: 0, guardVisibility: true };
}

// One-line description for diagnostics and bug reports.
export function describe() {
    const bits = [];
    bits.push(isIOS() ? 'iPadOS/iOS' : isAndroid() ? 'Android' : 'desktop');
    const shell = iosBrowserShell();
    if (shell) bits.push(shell + ' (WebKit wrapper)');
    else if (isIOS()) bits.push('Safari');
    bits.push(isStandalone() ? 'Home Screen app' : 'browser tab');
    const sr = speechRecognitionSupport();
    // Three states, not two: a missing recognizer and one that is merely measured
    // unreliable are different facts, and only the first is a dead end.
    bits.push(sr.usable ? 'listening available'
        : sr.apiPresent ? 'listening unreliable here (enabled anyway)'
            : 'no speech recognition in this browser');
    return bits.join(' · ');
}

/*
 * A signature of the things that CONSTRAIN settings, for deciding at import time
 * whether a backup came off this kind of device (Ken, September 9 2026).
 *
 * WHY THIS SHAPE. Ken's design collapses the two backup files into one and filters at
 * IMPORT instead of at export, and the argument for it is the reason this function
 * exists: at export nobody knows where the file is going, so any split makes the user
 * guess the destination. At import the app knows both sides — and this is the "both
 * sides" half.
 *
 * ⚠ THE SCREEN COMES FROM `screen`, NOT THE LAYOUT VIEWPORT, and that is the whole
 * reason this is usable on a desktop. The viewport changes every time somebody resizes
 * the window, so a viewport-based signature would report the SAME machine as a
 * different device between two exports an hour apart. The display does not move.
 * (And not devicePixelRatio: it moves with zoom — see the July 31 2026 finding.)
 *
 * ⚠ THE SHELL IS PART OF THE OS AXIS, not a detail. On an iPad a Home Screen app and a
 * Safari tab differ in a way that decides whether the free recognizer works at all
 * (measured July 30 2026), so a backup crossing between them is crossing a real
 * capability boundary even though the OS is identical.
 *
 * Deliberately NOT a unique machine id. The question is "is this the same KIND of
 * device", so two identical Surfaces read the same and settings move between them
 * whole, which is what somebody with two identical devices would expect.
 */
export function deviceSignature() {
    let w = 0, h = 0;
    try {
        if (typeof screen !== 'undefined' && screen) {
            w = Math.round(screen.width || 0);
            h = Math.round(screen.height || 0);
        }
    } catch { /* no screen object — leave zeros, which compare equal to other zeros */ }
    return {
        os: isIOS() ? 'ios' : isAndroid() ? 'android' : 'desktop',
        // 'app' (installed / Home Screen) or 'tab'.
        shell: isStandalone() ? 'app' : 'tab',
        screen: w && h ? `${w}x${h}` : '',
    };
}

/*
 * How a backup's origin compares with here. Two axes because Ken's own two examples
 * are two axes: the OS decides folder rules, keyboard options and which speech
 * services work; the SCREEN decides the keyguard.
 *
 * An absent or unreadable signature counts as different on BOTH axes. That is the safe
 * direction: it means an older file holds back the few device-bound settings rather
 * than applying a value from a machine nobody can identify.
 */
export function compareDevice(sig, here = deviceSignature()) {
    const ok = sig && typeof sig === 'object';
    return {
        sameOs: !!ok && sig.os === here.os && sig.shell === here.shell,
        // An empty screen on either side is not a match: unknown is not the same as equal.
        sameScreen: !!ok && !!sig.screen && !!here.screen && sig.screen === here.screen,
        known: !!ok && !!sig.os,
    };
}
