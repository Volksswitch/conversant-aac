/* ONE TAP OR TWO — the double-tap safeguard, for the whole conversation screen.
 *
 * Ken, October 1 2026: the setting began as "speaking an Express Panel phrase" and he
 * could not think of a UI element that should not observe it. The rule it now follows:
 * ANY TAP THAT SAYS SOMETHING ALOUD, REPLACES WHAT IS ON SCREEN, OR TAKES THE USER
 * SOMEWHERE ELSE needs two taps when the setting says so. Taps that only move something
 * and are fixed by the next tap - keyboard keys, words in the review editor, tabs and
 * section headings - stay at one.
 *
 * Deliberately left at one tap:
 *   - everything inside Settings (nothing there speaks, someone is often helping, and
 *     every destructive action there already asks to confirm);
 *   - stopping a sound that is playing (stopping cannot say anything and has to work
 *     now);
 *   - the keyboard, and the words of a card being edited in Conversation Review.
 *
 * ONE listener, on the document in the capture phase, so it runs before every handler
 * on the conversation screen - including review's own, which are also capture-phase -
 * and nothing has to remember to call it. A first tap ARMS the control (shown with a
 * ring) and is swallowed; a second tap on the same control within the interval lets the
 * tap through.
 */

import * as storage from './storage.js';

const RULES = [];
let armed = null;
let armedClass = '';
let timer = null;

/** Guard every element matching `selector`, unless `exempt(el, target)` says not to. */
export function addRule(selector, { exempt = null, armClass = 'tap-armed' } = {}) {
    RULES.push({ selector, exempt, armClass });
}

export function doubleTapOn() {
    return storage.loadExpressTapMode() === 'double';
}

function match(target) {
    if (!(target instanceof Element)) return null;
    if (target.closest('#settingsDialog')) return null;
    for (const rule of RULES) {
        const el = target.closest(rule.selector);
        if (!el || el.disabled) continue;
        if (rule.exempt && rule.exempt(el, target)) return null;
        return { el, rule };
    }
    return null;
}

/**
 * Will this tap only ARM a control rather than act? Other capture-phase listeners that
 * react to "the user pressed something" (the button tour, the Express Panel's paging)
 * ask this first, so an arming tap does not count as a press.
 */
export function isArmingTap(target) {
    if (!doubleTapOn()) return false;
    const m = match(target);
    return !!m && armed !== m.el;
}

export function disarm() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (armed) armed.classList.remove(armedClass);
    armed = null;
    armedClass = '';
}

function arm(el, cls) {
    disarm();
    armed = el;
    armedClass = cls;
    el.classList.add(cls);
    timer = setTimeout(disarm, storage.loadDoubleTapMs());
}

let installed = false;
export function install() {
    if (installed) return;
    installed = true;
    document.addEventListener('click', (e) => {
        if (!doubleTapOn()) return;
        const m = match(e.target);
        if (!m) return;
        if (armed === m.el) { disarm(); return; }      // the second tap: let it act
        arm(m.el, m.rule.armClass);
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
}
