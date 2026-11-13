/* "PRESS AGAIN" - the tag on a button that is waiting for its second tap or press.
 *
 * Ken, November 13 2026. A button armed by its first tap used to show only a ring (an
 * inset ring for touch, dashed rings for switches), which is easy to miss, and a user
 * who misses it thinks the tap did nothing. The tag says what to do in words.
 *
 * One tag, shared by tap-guard.js (touch, mouse, eye gaze) and switch-access.js (the
 * scanner's held press). It is drawn OVER the button, in the switch highlight's colors
 * (each color scheme sets them and tests/theme.test.mjs checks their contrast), so
 * nothing moves and a keyguard still fits.
 *
 * ⚠ The words may need rethinking for other languages, where the same idea can take far
 * more characters, and for users who do not read (TODO.md).
 */

let tag = null;
let owner = null;
let listening = false;

function place() {
    if (!tag || !owner) return;
    if (!owner.isConnected) { hide(); return; }
    const r = owner.getBoundingClientRect();
    const t = tag.getBoundingClientRect();
    const left = Math.max(2, Math.min(window.innerWidth - t.width - 2, r.left + (r.width - t.width) / 2));
    // On the button's top edge, half above it; kept on screen for a button at the top.
    const top = Math.max(2, r.top - t.height * 0.6);
    tag.style.left = `${left}px`;
    tag.style.top = `${top}px`;
}

/** Show the tag on `el`. */
export function show(el) {
    if (!el || !el.isConnected) return;
    if (!tag) {
        tag = document.createElement('div');
        tag.id = 'pressAgainTag';
        tag.setAttribute('role', 'status');
        tag.textContent = 'Press again';
    }
    // In an open dialog's top layer when the button is in one, so the tag shows above it.
    const host = el.closest('dialog[open]') || document.body;
    if (tag.parentNode !== host) host.appendChild(tag);
    owner = el;
    tag.hidden = false;
    place();
    if (!listening) {
        listening = true;
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
    }
}

/** Hide the tag; with `el`, only if it is showing on that button. */
export function hide(el) {
    if (el && el !== owner) return;
    owner = null;
    if (tag) tag.hidden = true;
}

export function shownOn() { return tag && !tag.hidden ? owner : null; }
