/*
 * One copy of the app open at a time (Ken, October 9 2026; SEC-9, designed June 16 2026).
 *
 * Two open copies each run their own microphone and voice, so one copy hears the
 * other's holding phrases as the partner speaking - an echo the echo filter cannot
 * catch, because it only knows what ITS OWN copy said. They also overwrite each other's
 * files in the data folder (About Me, people, the conversation file), and the second
 * write silently wins.
 *
 * Mechanism: an exclusive Web Lock held for the life of the page. The first copy takes
 * it. A later copy finds it taken, covers its screen with a notice, and keeps WAITING
 * for the lock - so closing the first copy makes the second one usable on its own,
 * with no reload. A crashed or closed tab releases its lock automatically.
 *
 * Boundary, accepted: locks are shared only within one browser profile. Edge and
 * Chrome both open, or two profiles, are not detected. On a dedicated device that is
 * one browser, which is the case this exists for.
 *
 * Where Web Locks are missing the app simply runs, as it always has.
 */

const LOCK_NAME = 'conversant-aac-single-instance';

let blocked = false;
let overlay = null;

export function isBlocked() { return blocked; }

function hold(lockGranted) {
    // Never resolves: the lock is held until the page goes away.
    lockGranted();
    return new Promise(() => {});
}

function showOverlay() {
    if (overlay || typeof document === 'undefined') return;
    overlay = document.createElement('div');
    overlay.id = 'singleInstanceOverlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'singleInstanceTitle');
    const card = document.createElement('div');
    card.className = 'single-instance-card';
    const h = document.createElement('h2');
    h.id = 'singleInstanceTitle';
    h.textContent = 'Conversant is already open';
    const p1 = document.createElement('p');
    p1.textContent = 'Conversant is open in another window or tab on this device. '
        + 'Two copies would hear each other and overwrite each other’s files, '
        + 'so only one can be used at a time.';
    const p2 = document.createElement('p');
    p2.textContent = 'Use the other one and close this one. Or close the other one, '
        + 'and this one will be ready straight away.';
    card.append(h, p1, p2);
    overlay.append(card);
    document.body.append(overlay);
}

function hideOverlay() {
    if (overlay) { overlay.remove(); overlay = null; }
}

/**
 * Claim the app for this window. `onReady` runs once this copy holds the lock -
 * immediately in the normal case, or later when another copy closes.
 */
export function claim(onReady = () => {}) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
    if (!locks || typeof locks.request !== 'function') { onReady(); return; }
    let readyCalled = false;
    const ready = () => {
        if (readyCalled) return;
        readyCalled = true;
        blocked = false;
        hideOverlay();
        onReady();
    };
    try {
        locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
            if (lock) return hold(ready);
            blocked = true;
            showOverlay();
            // Wait in line; granted the moment the other copy closes.
            locks.request(LOCK_NAME, () => hold(ready)).catch(() => {});
            return undefined;
        }).catch(() => ready());
    } catch {
        ready();
    }
}
