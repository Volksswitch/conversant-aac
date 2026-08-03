// help-mode.js — "tap for a spoken tooltip" in the Settings panel (Ken, August 2 2026).
//
// Arm the "?" in the Settings title bar, then tap a control, its label, or a tab, and
// the app says what it does. Settings only, deliberately: the conversation screen is
// keyguard-backed and Ken's instruction was that nothing there may "slow or trip
// someone up".
//
// WHY SPOKEN AND NOT A TOOLTIP: a tooltip needs hover, and this app targets direct
// select, so a tapping user can never summon one. That is the whole reason UI Layout
// Rule 14 sent per-control help to the manuals rather than to an in-app affordance.
// Audio costs no panel space, so this satisfies Rule 14 rather than reversing it —
// what the rule forbids is per-control TEXT ON SCREEN.
//
// THE LOAD-BEARING SAFETY PROPERTY: a tap in help mode must NOT change the control.
// A slider that moves, or a checkbox that flips, while the user is asking what it does
// would be worse than no help at all — and this population taps imprecisely, which is
// the very reason the feature is attractive. Every tap is therefore intercepted in the
// CAPTURE phase, before the control sees it, and focus is suppressed too (focusing a
// text field would summon the on-screen keyboard).
//
// BARGE-OUT AND THE SAME-TARGET EXCEPTION (Ken): any tap during playback stops the
// voice — "a natural way for people to indicate that they're done early". Tapping the
// SAME control or group also lets the action through; a tap anywhere else is swallowed.
// The asymmetry is principled rather than merely convenient: the tap you can trust is
// the one that already landed on target deliberately. A tap elsewhere is the one that
// might be a stray, and a stray is exactly what the swallow protects against.
//
// Verified when this was designed: every destructive Settings button already routes
// through confirmDanger() — including Import and Restore, which confirm one level down
// in importPackageText — so the worst a pass-through can do is raise the red
// confirmation card.

import { lookup } from './settings-help.js';

// Actions decideTap can return. Kept as a frozen map so a typo at a call site is a
// crash rather than a silently-skipped branch.
export const ACTION = Object.freeze({
    TOGGLE: 'toggle',                     // the "?" itself
    SPEAK: 'speak',                       // armed, and the tap resolved to a phrase
    SWALLOW: 'swallow',                   // armed, but nothing helpful under the finger
    ABORT_AND_PASS: 'abortAndPass',       // stop talking AND let the tap act
    ABORT_AND_SWALLOW: 'abortAndSwallow', // stop talking, eat the tap
    ALLOW: 'allow',                       // help is not involved; normal behaviour
});

/**
 * The whole interaction model, as a pure function so it can be tested without a DOM.
 *
 * @param {{armed: boolean, speaking: boolean}} state
 * @param {{isHelpButton: boolean, key: ?string, sameGroup: boolean, isRange: boolean}} tap
 */
export function decideTap(state, tap) {
    if (tap.isHelpButton) return { action: ACTION.TOGGLE };

    if (state.speaking) {
        // The same-target exception. Ranges are excluded and that carve-out is not
        // fussiness: on an <input type="range"> the tap COORDINATE is the value, so
        // "stop talking" and "set this to 90%" are the same gesture and cannot be
        // told apart. It costs nothing in practice — every slider sits in a group
        // with - / + steppers, which are discrete and so still pass through.
        if (tap.sameGroup && !tap.isRange) return { action: ACTION.ABORT_AND_PASS };
        return { action: ACTION.ABORT_AND_SWALLOW };
    }

    if (state.armed) {
        if (tap.key) return { action: ACTION.SPEAK, key: tap.key };
        // Armed but the finger landed on nothing explainable (padding, a heading with
        // no entry). Eat it and stay armed: acting on it would be the accidental
        // change this mode exists to prevent, and disarming would look like a failure.
        return { action: ACTION.SWALLOW };
    }

    return { action: ACTION.ALLOW };
}

// --- DOM resolution -------------------------------------------------------------

// Controls that are part of another control rather than a thing in their own right.
const IGNORED = '.slider-step';

/**
 * Work out what a tap is asking about. Returns the help key, the .setting-group it
 * belongs to (identity, for the same-group test), and whether it landed on a range.
 *
 * Resolution order matches how the panel is actually built:
 *   1. the "?" button
 *   2. a tab                     → tab:<data-tab>
 *   3. a <label for=...>         → that control  (Ken: tapping a label is tapping its control)
 *   4. an actual control         → control:<id>  /  radio:<name>
 *   5. a group heading with no control of its own → section:<data-help>
 */
export function resolveTap(target, doc = document) {
    if (!target || !target.closest) return { isHelpButton: false, key: null, groupEl: null, isRange: false };
    if (target.closest('#settingsHelpBtn')) return { isHelpButton: true, key: null, groupEl: null, isRange: false };

    const tab = target.closest('.settings-tab');
    if (tab) return { isHelpButton: false, key: `tab:${tab.dataset.tab}`, groupEl: tab, isRange: false };

    let control = null;
    const label = target.closest('label');
    if (label) {
        if (label.htmlFor) control = doc.getElementById(label.htmlFor);
        if (!control) control = label.querySelector('input, select, textarea');
    }
    if (!control) control = target.closest('input, select, textarea, button');

    // A stepper explains its slider, not itself — it has no meaning apart from it.
    if (control && control.matches && control.matches(IGNORED)) {
        control = doc.getElementById(control.dataset.target) || null;
    }

    const groupEl = (control || target).closest('.setting-group');
    let key = null;
    if (control) {
        if (control.type === 'radio') key = `radio:${control.name}`;
        else if (control.id) key = `control:${control.id}`;
    }
    // No control under the finger (a group heading), or one with no phrase of its own:
    // fall back to the group's entry so tapping "Settings profiles" explains the group
    // rather than whichever control happens to sit first inside it.
    if (!key && groupEl && groupEl.dataset.help) key = `section:${groupEl.dataset.help}`;

    return {
        isHelpButton: false,
        key,
        groupEl,
        isRange: !!(control && control.type === 'range'),
    };
}

// --- Wiring ---------------------------------------------------------------------

/**
 * @param {object} deps
 *   dialog     the Settings <dialog>
 *   helpBtn    the "?" button
 *   speak      (text) => Promise, resolving when the phrase finishes or is cancelled
 *   cancel     () => void, stop speaking now
 *   labelFor   (key, groupEl) => string, the spoken fallback when there is no entry
 */
export function init({ dialog, helpBtn, speak, cancel, labelFor }) {
    if (!dialog || !helpBtn) return null;

    let armed = false;
    let speakingGroup = null;   // the .setting-group currently being described
    let speakToken = 0;
    // Per-gesture state: one tap raises pointerdown → mousedown → click, and only the
    // first may decide. `gesturePrevented` carries that decision to the rest.
    let gestureDecided = false;
    let gesturePrevented = false;

    const state = () => ({ armed, speaking: speakingGroup !== null });

    function render() {
        helpBtn.classList.toggle('help-armed', armed);
        helpBtn.classList.toggle('help-speaking', speakingGroup !== null);
        helpBtn.setAttribute('aria-pressed', armed ? 'true' : 'false');
    }

    function stopSpeaking() {
        speakToken++;
        speakingGroup = null;
        cancel();
        render();
    }

    function reset() {
        armed = false;
        if (speakingGroup !== null) stopSpeaking();
        else render();
    }

    async function say(key, groupEl) {
        const text = lookup(key) || labelFor(key, groupEl);
        // One-shot (Ken): disarm before speaking, so the user is never stuck in help
        // mode unable to change the value they just asked about.
        armed = false;
        if (!text) { render(); return; }
        speakingGroup = groupEl || null;
        const mine = ++speakToken;
        render();
        try { await speak(text); }
        finally {
            // Only the utterance that is still current may clear the state — a
            // barged-out one resolves late and would otherwise wipe its successor's.
            if (mine === speakToken) { speakingGroup = null; render(); }
        }
    }

    function handle(e) {
        // Only inside the panel. Anything else (the backdrop, the page behind) is
        // not ours to intercept.
        if (!dialog.contains(e.target)) return;

        // ONE decision per gesture. A single tap fires pointerdown AND mousedown (and
        // then click), so deciding on each would run the action three times — which
        // made the "?" arm and instantly disarm itself. The later events in the
        // gesture only re-apply the prevention the first one decided on.
        if (gestureDecided) {
            if (gesturePrevented) { e.preventDefault(); e.stopPropagation(); }
            return;
        }
        gestureDecided = true;

        const tap = resolveTap(e.target);
        const { action, key } = decideTap(state(), {
            isHelpButton: tap.isHelpButton,
            key: tap.key,
            sameGroup: !!(tap.groupEl && tap.groupEl === speakingGroup),
            isRange: tap.isRange,
        });

        const stop = () => { gesturePrevented = true; e.preventDefault(); e.stopPropagation(); };

        switch (action) {
            case ACTION.ALLOW:
                return;
            case ACTION.TOGGLE:
                stop();
                if (speakingGroup !== null) stopSpeaking();
                armed = !armed;
                render();
                return;
            case ACTION.SPEAK:
                stop();
                say(key, tap.groupEl);
                return;
            case ACTION.SWALLOW:
                stop();
                return;
            case ACTION.ABORT_AND_SWALLOW:
                stop();
                stopSpeaking();
                return;
            case ACTION.ABORT_AND_PASS:
                // Deliberately NOT prevented: stop the voice and let the tap do its job.
                stopSpeaking();
                return;
        }
    }

    // pointerdown is where a <select> opens and a range jumps, so it is the one that
    // has to be stopped; mousedown covers paths without pointer events; the trailing
    // click needs stopping too, because preventing pointerdown does not always cancel
    // it. All three share one decision — see `gestureDecided` in handle().
    dialog.addEventListener('pointerdown', handle, true);
    dialog.addEventListener('mousedown', handle, true);
    dialog.addEventListener('click', (e) => {
        handle(e);
        // End of the gesture: the next tap decides afresh.
        gestureDecided = false;
        gesturePrevented = false;
    }, true);

    // Focus is its own hazard: reaching a text field would raise the on-screen
    // keyboard over the panel the user is asking about.
    dialog.addEventListener('focusin', (e) => {
        if (!armed && speakingGroup === null) return;
        if (helpBtn.contains(e.target)) return;
        if (typeof e.target.blur === 'function') e.target.blur();
    }, true);

    // Leaving Settings by any route ends help mode; a phrase still playing would
    // otherwise talk over whatever the user did next.
    dialog.addEventListener('close', reset);
    dialog.addEventListener('cancel', reset);

    render();
    return { reset, isArmed: () => armed, isSpeaking: () => speakingGroup !== null };
}
