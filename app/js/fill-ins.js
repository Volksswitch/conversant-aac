/*
 * Words the app fills in when a fixed phrase is said (Ken, October 9 2026).
 *
 *   {name}      the person the user is talking with, as the user calls them ("Mom")
 *   {greeting}  Good morning / Good afternoon / Good evening, by the clock
 *
 * ⚠ THE TEST FOR A FILL-IN (Ken, October 9 2026): it must CHANGE with the situation,
 * and the phrase must still make sense when it has no value. The user's own name was
 * proposed and dropped on both counts - it never changes, so typing it is no harder
 * (and the phrase's own "How to say it" box then applies), and "Hi, I'm {me}." with no
 * name came out as "Hi, I'm." The other person's name gets its "How to say it"
 * spelling automatically, through the pronunciation list.
 *
 * Used by Express Panel phrases and by every Commands list (openers, wrap-ups,
 * goodbyes, asking them to repeat, hold on, "before you go"). The editors insert these
 * with buttons, so nobody has to type the curly brackets.
 *
 * WHEN A VALUE IS MISSING (no partner selected) the fill-in is
 * dropped and the sentence tidied: "Thank you, {name}." becomes "Thank you." The
 * button still works rather than going blank, because a button that only works some
 * of the time looks broken. The tidying is the rule the openers have used since July
 * 2026 (engine.js applyName, which now calls this).
 */

export const FILL_INS = [
    { token: '{name}', label: 'Their name' },
    { token: '{greeting}', label: 'Greeting' },
];

/** The greeting for a time of day: before noon, before 5 pm, then evening. */
export function greetingFor(date = new Date()) {
    const h = date.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

/* Drop one fill-in with nothing to put in its place, tidying the punctuation and
 * spaces around it. Between two words a comma is kept; otherwise the gap closes. */
function drop(text, token) {
    const t = token.replace(/[{}]/g, (c) => '\\' + c);
    const re = new RegExp('\\s*,?\\s*' + t + '\\s*,?\\s*', 'g');
    return text.replace(re, (m, offset, str) => {
        const before = str.slice(0, offset).trimEnd();
        const after = str.slice(offset + m.length).trimStart();
        if (before && after && /[A-Za-z0-9]$/.test(before) && /^[A-Za-z0-9]/.test(after)) return ', ';
        return after && !/^[?.!,;:]/.test(after) ? ' ' : '';
    });
}

/** Does this phrase contain anything to fill in? */
export function hasFillIns(text) {
    return /\{(name|greeting)\}/.test(String(text || ''));
}

/**
 * Fill in a phrase. `name` may be empty; the greeting always has a value.
 * A function replacement, so a "$" in a name is inserted as typed (CR-145).
 */
export function fillIn(text, { name = '', now = new Date() } = {}) {
    let out = String(text || '');
    if (!hasFillIns(out)) return out;
    const values = { '{name}': (name || '').trim(), '{greeting}': greetingFor(now) };
    for (const [token, value] of Object.entries(values)) {
        if (!out.includes(token)) continue;
        out = value ? out.split(token).join(value) : drop(out, token);
    }
    // A sentence that now starts with a lowercase word after a dropped fill-in keeps
    // its first letter as written; only spacing is tidied here.
    return out.replace(/\s+([?.!,;:])/g, '$1').replace(/\s+/g, ' ').trim();
}

/** Put a fill-in into a text box at the cursor, as if typed (fires 'input'). */
export function insertAtCursor(field, token) {
    if (!field) return;
    const v = field.value || '';
    const start = field.selectionStart ?? v.length;
    const end = field.selectionEnd ?? v.length;
    const needsSpaceBefore = start > 0 && !/\s$/.test(v.slice(0, start));
    const piece = (needsSpaceBefore ? ' ' : '') + token;
    field.value = v.slice(0, start) + piece + v.slice(end);
    const at = start + piece.length;
    try { field.setSelectionRange(at, at); } catch { /* not every field has a cursor */ }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * A row of Insert buttons for an editor. `getTarget()` returns the text box to insert
 * into (the one last used in that part of the editor). The buttons act on pointerdown
 * and cancel it, so the text box keeps its focus and cursor and the on-screen
 * keyboard stays up - the same arrangement the keyboard's own keys use.
 */
export function buildInsertRow(getTarget) {
    const row = document.createElement('div');
    row.className = 'fill-in-row';
    for (const f of FILL_INS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fill-in-btn ee-add';   // the editors' own text-button look
        b.textContent = `Insert: ${f.label}`;
        b.setAttribute('aria-label', `Insert ${f.label.toLowerCase()}`);
        const go = (e) => {
            if (e) e.preventDefault();
            const field = getTarget();
            if (!field) return;
            insertAtCursor(field, f.token);
            try { field.focus(); } catch { /* best effort */ }
        };
        b.addEventListener('pointerdown', go);
        // A keyboard user presses Enter or Space, which arrives as a click with no
        // pointerdown before it.
        b.addEventListener('click', (e) => { if (e.detail === 0) go(e); });
        row.appendChild(b);
    }
    return row;
}
