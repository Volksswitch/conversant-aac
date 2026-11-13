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
import * as pressAgain from './press-again.js';

const RULES = [];
let armed = null;
let armedClass = '';
let armedKey = '';
let timer = null;

/**
 * Guard every element matching `selector`, unless `exempt(el, target)` says not to.
 * `always` (a function): when it returns true the control needs two taps even with
 * "One tap" chosen; when false the rule is skipped and a later rule may apply.
 */
export function addRule(selector, { exempt = null, armClass = 'tap-armed', always = null } = {}) {
    RULES.push({ selector, exempt, armClass, always });
}

// A control that always asks for a second tap gets at least 2 seconds for it, whatever
// "Time allowed between the two taps" says - the same as a switch user (Ken, November
// 13 2026: "Let's treat everyone the same way"). Someone who chose one tap is not
// expecting to tap twice, so 0.4 s would leave them no time to read "Press again".
export const ALWAYS_SECOND_MS = 2000;
export function secondTapMs(el) {
    const m = el ? match(el) : null;
    const base = storage.loadDoubleTapMs();
    return m && m.rule.always ? Math.max(ALWAYS_SECOND_MS, base) : base;
}
function guarded(m) {
    return !!m && (!!m.rule.always || doubleTapOn());
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
        if (rule.always && !rule.always(el)) continue;
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
    const m = match(target);
    return guarded(m) && !sameAsArmed(m.el);
}

// ⚠ THE EXPRESS PANEL REDRAWS ITSELF (CR-161) - when the partner's choices arrive, a
// sound starts, a band pages - and the armed button is replaced by an identical new one.
// A button that carries a data-tap-key is the same button if the key matches, so the
// second tap still acts. A response card carries no key: a replaced card is new
// wording, and must be armed again.
function sameAsArmed(el) {
    if (armed === el) return true;
    return !!armed && !armed.isConnected && !!armedKey && el.dataset.tapKey === armedKey;
}

/**
 * Switch scanning (Switch Access Design section 2.2): the scanner counts the two switch
 * presses itself, so it asks here whether a button needs them, and then lets its one
 * confirmed press through. Otherwise every choice would take four presses.
 */
export function needsSecondTap(el) {
    return guarded(match(el));
}
let passOnce = false;
export function letNextThrough(on = true) { passOnce = !!on; }

export function disarm() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (armed) armed.classList.remove(armedClass);
    if (armed) pressAgain.hide(armed);
    armed = null;
    armedKey = '';
    armedClass = '';
}

function arm(el, cls) {
    disarm();
    armed = el;
    armedKey = el.dataset.tapKey || '';
    armedClass = cls;
    el.classList.add(cls);
    pressAgain.show(el);
    timer = setTimeout(disarm, secondTapMs(el));
}

let installed = false;
export function install() {
    if (installed) return;
    installed = true;
    document.addEventListener('click', (e) => {
        if (passOnce) { passOnce = false; disarm(); return; }
        const m = match(e.target);
        if (!guarded(m)) return;
        if (sameAsArmed(m.el)) { disarm(); return; }   // the second tap: let it act
        arm(m.el, m.rule.armClass);
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
}
