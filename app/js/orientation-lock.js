/* Holding the screen upright or sideways (Ken, October 8 2026).
 *
 * Settings > Screen Layout > "Screen orientation": turn with the device (the default,
 * and how the app always behaved), keep it upright, or keep it sideways.
 *
 * WHAT THE PLATFORMS ALLOW, so nobody re-derives it:
 *   - Android: the browser holds the screen still only when the app is installed on
 *     the home screen or the page is full screen. In an ordinary tab it refuses.
 *   - iPad: no web page can do it (measured July 30 2026; Apple's notes agree).
 *   - Surface: refused even as an installed app (measured by Ken, October 8 2026).
 *     MacBooks do not rotate. Chromebooks were not measured.
 *   So the setting is shown on Android only (Ken, October 8 2026); app.js gates it.
 *
 * THE LOCK ONLY LASTS WHILE THE APP IS ON SCREEN. It ends when the user switches to
 * another app or leaves full screen, so app.js asks again on the Start tap, when the
 * app comes back into view, and when full screen starts.
 *
 * The browser cannot tell "this device never can" from "not in this state", so the
 * message is chosen from the state instead: refused while neither full screen nor
 * installed points at those two; refused while in either says use the device's own
 * rotation lock.
 */

export const ORIENTATIONS = ['any', 'portrait', 'landscape'];

/** The value to hand the browser, or null for "turn with the device". */
export function lockTypeFor(setting) {
    return setting === 'portrait' || setting === 'landscape' ? setting : null;
}

/** Whether this browser has a lock to call at all. */
export function lockAvailable(screenObj = (typeof screen !== 'undefined' ? screen : null)) {
    return !!(screenObj && screenObj.orientation && typeof screenObj.orientation.lock === 'function');
}

/**
 * The status line for a result. `outcome` is 'locked', 'unlocked' or 'refused';
 * `fullscreenOrInstalled` says whether the page was full screen or an installed app
 * when it asked.
 */
export function describeResult(setting, outcome, fullscreenOrInstalled) {
    if (!lockTypeFor(setting) || outcome === 'unlocked') return '';
    if (outcome === 'locked') {
        return setting === 'portrait' ? 'The screen is held upright.' : 'The screen is held sideways.';
    }
    if (!fullscreenOrInstalled) {
        return 'This only works with "Use the whole screen" turned on, or with the app '
            + 'installed. If neither helps, use the device’s own rotation lock.';
    }
    return 'This device won’t hold the screen still. Use its own rotation lock.';
}

/**
 * Ask the browser to hold the screen (or let it turn again). Resolves to 'locked',
 * 'unlocked' or 'refused'. Never throws: a refusal must never break Start.
 */
export async function apply(setting, screenObj = (typeof screen !== 'undefined' ? screen : null)) {
    const type = lockTypeFor(setting);
    if (!type) {
        try { if (screenObj && screenObj.orientation && screenObj.orientation.unlock) screenObj.orientation.unlock(); }
        catch { /* nothing was held */ }
        return 'unlocked';
    }
    if (!lockAvailable(screenObj)) return 'refused';
    try {
        await screenObj.orientation.lock(type);
        return 'locked';
    } catch {
        return 'refused';
    }
}
