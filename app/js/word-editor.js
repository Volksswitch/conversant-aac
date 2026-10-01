/* The word-at-a-time editor used by Conversation Review (design document §6.3).
 *
 * PURE. There is no text cursor: one word always carries a highlight, and that
 * highlight IS the cursor. A one-pixel line between two letters is hard to see and hard
 * to place for somebody with limited hand control; a whole highlighted word is neither.
 *
 *   - Typing replaces the highlighted word. The first key on an untouched word replaces
 *     it outright, the way typing over a selection does everywhere else.
 *   - Backspace on an untouched word removes it and leaves the GAP highlighted. A second
 *     backspace steps back and removes the word before. So three words is three presses,
 *     going the way backspace already goes, and afterwards the next thing typed goes
 *     into the hole rather than over a word the user meant to keep.
 *   - TYPING NEVER MOVES THE HIGHLIGHT (Ken, October 1 2026). A space is just part of
 *     what is being typed, so "need to" can replace "me" in one go. Only the Previous
 *     Word and Next Word buttons, or tapping a word, move it. When the highlight moves
 *     on, whatever was typed into it splits back into separate words.
 *     Ken found the old rule - a space moved the highlight on - made it impossible to
 *     replace one word with two: the space jumped to the next word before the second
 *     one could be typed, and it was typed over that word instead.
 *   - Holes collapse when the text is read back.
 *
 * A single letter in the middle of a word cannot be fixed on its own; the user retypes
 * the word. That is deliberate (§6.3).
 *
 * The DOM half lives in review-ui.js: a hidden input holds the highlighted word, so both
 * the on-screen keyboard and a physical keyboard type into it unchanged.
 */

export function createWordEditor(text) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    return { words: words.length ? words : [''], sel: 0, fresh: true };
}

export function editorText(ed) {
    return ed ? ed.words.join(' ').split(/\s+/).filter(Boolean).join(' ') : '';
}

export function currentWord(ed) {
    return ed ? (ed.words[ed.sel] || '') : '';
}

// The highlighted slot may hold several words typed into it. Before the highlight goes
// anywhere they become separate words again, so each can be reached on its own. An
// empty slot becomes nothing at all, which is how gaps collapse.
function partsOf(slot) {
    return String(slot || '').split(/\s+/).filter(Boolean);
}

/** Move the highlight by `d` words. Stepping off the end opens a slot to add a word. */
export function moveWord(ed, d) {
    if (!ed) return ed;
    const parts = partsOf(ed.words[ed.sel]);
    const words = ed.words.slice();
    // An empty slot at the very end is where the next word goes; stepping forward
    // from it has nowhere to go, so it stays.
    if (!parts.length && d > 0 && ed.sel === words.length - 1) return { words, sel: ed.sel, fresh: true };
    words.splice(ed.sel, 1, ...parts);
    if (!words.length) return { words: [''], sel: 0, fresh: true };
    let sel;
    if (d > 0) {
        // Just past the last of the slot's words. An emptied slot has none, so the word
        // after it has slid into its place.
        sel = ed.sel + parts.length;
        if (sel >= words.length) words.push('');
    } else {
        sel = Math.max(0, ed.sel - 1);
    }
    return { words, sel, fresh: true };
}

/** Tapping a word moves the highlight straight to it. */
export function selectWord(ed, i) {
    if (!ed) return ed;
    let target = Math.max(0, Math.min(ed.words.length - 1, i));
    if (target === ed.sel) return { words: ed.words.slice(), sel: ed.sel, fresh: true };
    const parts = partsOf(ed.words[ed.sel]);
    const words = ed.words.slice();
    words.splice(ed.sel, 1, ...parts);
    if (!words.length) return { words: [''], sel: 0, fresh: true };
    // A word after the slot has moved along by however many words the slot now holds.
    if (target > ed.sel) target += parts.length - 1;
    return { words, sel: Math.max(0, Math.min(words.length - 1, target)), fresh: true };
}

/**
 * The hidden input's value changed. `value` is the whole of what is in it now; it started
 * as the highlighted word, fully selected while fresh, so the keyboard's insert replaced
 * it.
 */
export function typeInto(ed, value) {
    if (!ed) return ed;
    // Everything typed stays in the highlighted slot, spaces included - typing never
    // moves the highlight. It splits into words when the highlight moves on.
    const words = ed.words.slice();
    words[ed.sel] = String(value == null ? '' : value);
    return { words, sel: ed.sel, fresh: false };
}

/**
 * Backspace. Returns null when the key should do its ordinary thing (delete one letter
 * of a word the user is part way through typing).
 */
export function backspace(ed) {
    if (!ed) return ed;
    const words = ed.words.slice();
    if (!ed.fresh && words[ed.sel] !== '') return null;
    if (words[ed.sel] !== '') {
        words[ed.sel] = '';
        return { words, sel: ed.sel, fresh: true };
    }
    if (ed.sel > 0) {
        // The empty slot goes, and the word before it becomes the new gap.
        words.splice(ed.sel, 1);
        const sel = ed.sel - 1;
        words[sel] = '';
        return { words, sel, fresh: true };
    }
    return { words, sel: 0, fresh: true };
}
