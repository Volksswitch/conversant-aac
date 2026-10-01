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
 *   - A space (or Enter) finishes the word and moves on, opening a slot at the end.
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
    return ed ? ed.words.filter((w) => w !== '').join(' ') : '';
}

export function currentWord(ed) {
    return ed ? (ed.words[ed.sel] || '') : '';
}

/** Move the highlight by `d` words. Stepping off the end opens a slot to add a word. */
export function moveWord(ed, d) {
    if (!ed) return ed;
    const words = ed.words.slice();
    let sel = ed.sel;
    // An empty slot is where the next word goes. Leaving it collapses it, so stepping
    // through a sentence never leaves gaps behind.
    if (words[sel] === '' && words.length > 1) {
        if (d > 0 && sel === words.length - 1) return { words, sel, fresh: true };
        words.splice(sel, 1);
        if (d < 0) sel = Math.max(0, sel - 1);
        else sel = Math.min(sel, words.length - 1);
        return { words, sel, fresh: true };
    }
    if (d > 0 && sel === words.length - 1 && words[sel] !== '') words.push('');
    sel = Math.max(0, Math.min(words.length - 1, sel + d));
    return { words, sel, fresh: true };
}

export function selectWord(ed, i) {
    if (!ed) return ed;
    const words = ed.words.slice();
    let target = Math.max(0, Math.min(words.length - 1, i));
    // Tapping away from an empty slot collapses it, the same as stepping away does.
    if (words[ed.sel] === '' && words.length > 1 && target !== ed.sel) {
        words.splice(ed.sel, 1);
        if (target > ed.sel) target -= 1;
    }
    return { words, sel: target, fresh: true };
}

/**
 * The hidden input's value changed. `value` is the whole of what is in it now; it started
 * as the highlighted word, fully selected while fresh, so the keyboard's insert replaced
 * it. A space anywhere in it ends the word: the part before becomes the word, anything
 * after (a paste) becomes following words, and the highlight moves on.
 */
export function typeInto(ed, value) {
    if (!ed) return ed;
    const v = String(value == null ? '' : value);
    const words = ed.words.slice();
    if (/\s/.test(v)) {
        const parts = v.split(/\s+/);
        const first = parts.shift();
        const rest = parts.filter(Boolean);
        words[ed.sel] = first;
        words.splice(ed.sel + 1, 0, ...rest);
        let sel = ed.sel + rest.length;
        // A space means "on to the next word", exactly as the Next Word button does.
        // Typing "two words" over one word puts both in.
        if (first === '' && !rest.length) return { words, sel, fresh: false };
        if (sel === words.length - 1) words.push('');
        sel += 1;
        return { words, sel, fresh: true };
    }
    words[ed.sel] = v;
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
