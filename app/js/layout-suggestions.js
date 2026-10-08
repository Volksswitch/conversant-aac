/* Suggested starting layouts, one per kind of screen (Ken, October 8 2026).
 *
 * The app STARTS with the suggestion that fits its screen the first time it runs, and
 * Settings > Screen Layout has one button that applies it again. There is no picker:
 * pictures of whole screens are too small to read on a phone, so they live in the User
 * Manuals instead. Every part of a suggestion is an ordinary setting afterwards.
 *
 * The full reasoning, with a picture of each, is "Conversant AAC Layout
 * Suggestions.docx". The proportions follow one rule: the Express Panel gets enough
 * height for its rows at a comfortable size, the Command Bar about one row of the same
 * height, the response options about a third, and the transcript what is left.
 *
 * A sideways tablet has two suggestions in that document (keyboard at the side or the
 * bottom). The app starts with the keyboard at the bottom and QWERTY, which is what it
 * did before suggestions existed (Ken, October 8 2026).
 *
 * Pure: give it the screen size and it returns settings. Nothing here reads or writes
 * storage, so it can be tested without a browser.
 */

// Below this many points on the SHORTER side, a screen is treated as a phone. Phones
// are about 360-430; the smallest iPad (mini) is 744.
export const PHONE_MAX_SHORT_SIDE = 600;

export const SUGGESTIONS = {
    'phone-upright': {
        label: 'Phone, upright',
        keyboardDock: 'bottom', layout: 'S1', optionsArrangement: 'grid-below',
        convLayout: { command: 0.07, response: 0.30, dock: 0.45 },
    },
    'tablet-upright': {
        label: 'Tablet, upright',
        keyboardDock: 'bottom', layout: 'S1', optionsArrangement: 'grid-below',
        convLayout: { command: 0.06, response: 0.30, dock: 0.42 },
    },
    'tablet-sideways': {
        label: 'Tablet, sideways',
        keyboardDock: 'bottom', layout: 'B11', optionsArrangement: 'row',
        convLayout: { command: 0.10, response: 0.30, dock: 0.30 },
    },
    'phone-sideways': {
        label: 'Phone, sideways',
        keyboardDock: 'side', layout: 'S2', optionsArrangement: 'grid-below',
        convLayout: { command: 0.14, response: 0.56, dock: 0.40 },
    },
};

/** Which kind of screen this is, from its size in points. */
export function screenKind(width, height) {
    const w = Number(width) || 0, h = Number(height) || 0;
    const phone = Math.min(w, h) > 0 && Math.min(w, h) < PHONE_MAX_SHORT_SIDE;
    const upright = h > w;
    return `${phone ? 'phone' : 'tablet'}-${upright ? 'upright' : 'sideways'}`;
}

/** The suggestion for a screen of this size, with its kind as `id`. */
export function suggestionFor(width, height) {
    const id = screenKind(width, height);
    return { id, ...SUGGESTIONS[id] };
}

/**
 * The suggestion as changes to a settings object. The layout goes to the slot for its
 * keyboard position, and the screen proportions to that position's entry, leaving the
 * other position's entries as they were.
 */
export function applyToSettings(settings, suggestion) {
    const s = { ...(settings || {}) };
    const side = suggestion.keyboardDock === 'side';
    s.keyboardDock = suggestion.keyboardDock;
    if (side) s.sideLayout = suggestion.layout; else s.bottomLayout = suggestion.layout;
    s.optionsArrangement = suggestion.optionsArrangement;
    const all = s.convLayout && typeof s.convLayout === 'object' ? { ...s.convLayout } : {};
    all[side ? 'side' : 'bottom'] = { ...suggestion.convLayout };
    s.convLayout = all;
    s.layoutSuggestion = suggestion.id;
    return s;
}
