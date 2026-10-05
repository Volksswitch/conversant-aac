/* Keeping keyboard focus in place when a region is redrawn (code review CR-016). */

/*
 * KEEP KEYBOARD FOCUS ACROSS A REDRAW (CR-016). These regions are rebuilt from
 * scratch, and a focused button that is thrown away sends focus back to the top of
 * the page, so a keyboard or switch user lost their place on every tap. Before the
 * rebuild, note which button (by position) had focus; afterwards, focus the button
 * now in that position. Positions are fixed by the layout, so it is the right one.
 * Only buttons: focusing a text field would raise the on-screen keyboard. And only
 * when focus was inside the region, so nothing moves for a user who was elsewhere.
 */
export function focusMark(container) {
    const a = document.activeElement;
    if (!container || !a || a === document.body || !container.contains(a)) return null;
    const list = [...container.querySelectorAll('button')];
    const index = list.indexOf(a);
    return index < 0 ? null : { index };
}
export function focusReturn(container, mark, fallback = null) {
    if (!mark || !container) return;
    const list = [...container.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
    const target = [...container.querySelectorAll('button')][mark.index];
    const pick = (target && !target.disabled) ? target : (list[list.length - 1] || fallback);
    if (pick) try { pick.focus({ preventScroll: true }); } catch { /* gone */ }
}
