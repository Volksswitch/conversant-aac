/* THE RIGHT MOUSE BUTTON AND THE WHEEL PRESS DO NOTHING, EXCEPT IN A TEXT BOX (Ken,
 * November 22 2026: "Turn them off everywhere except text boxes").
 *
 * Neither does anything for Conversant itself: the right button only opens the browser's
 * menu (back, reload, print, inspect) and the wheel press only starts the browser's
 * scroll cursor or opens a link in a new tab. For someone pointing with a mouse and
 * limited hand control, a stray press then puts a menu over the buttons in the middle of
 * a conversation. In a text box the right button's menu is useful (paste, spelling
 * suggestions), mostly to a helper setting the app up, so text boxes keep both.
 *
 * Only the browser's own response is cancelled: the press still reaches the app, so a
 * mouse used as switches (switch-access.js) is unaffected. Rolling the wheel is not a
 * press and still scrolls.
 */

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'password', 'email', 'url', 'tel', 'number', '']);

/** Is this element (or the one it sits in) a box the user types into? */
export function isTextBox(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const tag = n.tagName;
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') return TEXT_INPUT_TYPES.has(String(n.getAttribute('type') || '').toLowerCase());
        if (n.isContentEditable) return true;
    }
    return false;
}

/** Should the browser's own response to this mouse event be cancelled? */
export function shouldCancel(type, button, target) {
    const extra = type === 'contextmenu' || (button === 1 && (type === 'mousedown' || type === 'auxclick'));
    return extra && !isTextBox(target);
}

let installed = false;
export function install(win = window) {
    if (installed) return;
    installed = true;
    const handler = (e) => { if (shouldCancel(e.type, e.button, e.target)) e.preventDefault(); };
    for (const t of ['contextmenu', 'mousedown', 'auxclick']) win.addEventListener(t, handler, true);
}
