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
 * EACH SUGGESTION COVERS BOTH KEYBOARD POSITIONS (Ken, October 8 2026). The app
 * starts with the one that suits the screen, and the other is filled in too, so
 * changing "Where it sits" afterwards lands on a layout that suits that position
 * rather than on whatever the other position had. A sideways tablet starts with the
 * keyboard at the bottom and QWERTY, which is what the app did before suggestions
 * existed.
 *
 * Pure: give it the screen size and it returns settings. Nothing here reads or writes
 * storage, so it can be tested without a browser.
 */

// Below this many points on the SHORTER side, a screen is treated as a phone. Phones
// are about 360-430; the smallest iPad (mini) is 744.
export const PHONE_MAX_SHORT_SIDE = 600;

// For a side keyboard, `dock` is a share of the WIDTH, and `command` and `response`
// are shares of the height of the column beside it; the transcript gets the rest.
const SIDEWAYS_SIDE = { layout: 'S2', optionsArrangement: 'grid',
    convLayout: { command: 0.10, response: 0.50, dock: 0.30 } };

export const SUGGESTIONS = {
    'phone-upright': {
        label: 'Phone, upright', keyboardDock: 'bottom',
        bottom: { layout: 'S1', optionsArrangement: 'grid-below',
            convLayout: { command: 0.07, response: 0.30, dock: 0.45 } },
        side: { layout: 'S2', optionsArrangement: 'grid-below',
            convLayout: { command: 0.07, response: 0.45, dock: 0.40 } },
    },
    'tablet-upright': {
        label: 'Tablet, upright', keyboardDock: 'bottom',
        bottom: { layout: 'S1', optionsArrangement: 'grid-below',
            convLayout: { command: 0.06, response: 0.30, dock: 0.42 } },
        side: { layout: 'S2', optionsArrangement: 'grid-below',
            convLayout: { command: 0.06, response: 0.45, dock: 0.40 } },
    },
    'tablet-sideways': {
        label: 'Tablet, sideways', keyboardDock: 'bottom',
        bottom: { layout: 'B11', optionsArrangement: 'row',
            convLayout: { command: 0.10, response: 0.30, dock: 0.30 } },
        side: SIDEWAYS_SIDE,
    },
    'phone-sideways': {
        label: 'Phone, sideways', keyboardDock: 'side',
        bottom: { layout: 'B11', optionsArrangement: 'row',
            convLayout: { command: 0.12, response: 0.30, dock: 0.40 } },
        side: { layout: 'S2', optionsArrangement: 'grid-below',
            convLayout: { command: 0.14, response: 0.56, dock: 0.40 } },
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
 * The suggestion as changes to a settings object: both keyboard positions get their
 * layout, their response options arrangement and their screen proportions, and the
 * keyboard goes where the suggestion puts it. Everything else is left alone.
 */
export function applyToSettings(settings, suggestion) {
    const s = { ...(settings || {}) };
    s.keyboardDock = suggestion.keyboardDock;
    s.bottomLayout = suggestion.bottom.layout;
    s.sideLayout = suggestion.side.layout;
    s.optionsArrangement = {
        bottom: suggestion.bottom.optionsArrangement,
        side: suggestion.side.optionsArrangement,
    };
    const all = s.convLayout && typeof s.convLayout === 'object' ? { ...s.convLayout } : {};
    all.bottom = { ...suggestion.bottom.convLayout };
    all.side = { ...suggestion.side.convLayout };
    s.convLayout = all;
    s.layoutSuggestion = suggestion.id;
    return s;
}
