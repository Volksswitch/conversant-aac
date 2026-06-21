/* Fast Phrases — base-UI quick-speak sets (June 2026)
 *
 * Modeled on keyboard-layouts.js: phrase SETS encoded as data so the panel
 * renderer can switch between them and the chosen set is a user Setting. Per UI
 * Layout Rule 9 the fast-phrases panel is a BASE UI element (not a modal asset,
 * not an "In my own words" starter): each button SPEAKS its phrase directly,
 * shows the phrase as text (ellipsis-truncated when too long), and is exempt
 * from the icon-only rule (it's content, like a response card). Activation is
 * single- or double-tap per Rule 10.
 *
 * These are app-provided STARTER sets. Like the other user-owned configurable
 * sets (placeholders, openers, closers, keyboard layouts) the content becomes
 * user-editable later (its own editor + a data-folder JSON); this module is the
 * default seed and the selectable-set scaffold.
 *
 * WHY model on keyboard layouts — the keyguard-overlay reason (Ken, June 21
 * 2026): the panel must be GRID-CONGRUENT with a keyboard layout so a SINGLE
 * static keyguard overlays BOTH — fast-phrase buttons showing through the holes
 * at rest, and the compose-modal keyboard's keys showing through the SAME holes
 * during "In my own words" (Rule 8: the modal asset superimposes over the inert
 * base panel). So the panel sits where the keyboard will appear — same side
 * (the keyboard's left/right Setting), same grid — NOT opposite it.
 *
 * This module holds only the phrase CONTENT (the ordered sets). The GEOMETRY is
 * applied at render: the phrases fill the cells of the PAIRED keyboard layout's
 * grid 1:1 (one phrase per key-cell, ellipsis-truncated when long — Rule 9), so
 * the holes line up. Which keyboard layout a set pairs with is the binding, set
 * in the (held) base-layout pass; the content here is reusable across pairings.
 *
 * Phrase shape: { text, speak? } — `text` is shown AND spoken; optional `speak`
 * overrides only the spoken form (the display-vs-spoken / pronunciation model
 * recorded for proper nouns and static statements), falling back to `text`.
 */

// Phrase builder: P('Yes') or P('Mom', 'Mom') to give a distinct spoken form.
const P = (text, speak) => (speak ? { text, speak } : { text });

// Ordered within each set by likely frequency / utility — position is stable so
// the user builds motor automaticity, and a small keyguard grid that shows only
// the first N still surfaces the most useful phrases.
export const PHRASE_SETS = {
  CORE: {
    name: 'Core conversation (24)',
    phrases: [
      P('Yes'), P('No'), P('Yes please'), P('No thank you'),
      P('Maybe'), P("I don't know"), P("I'm not sure"), P('Okay'),
      P('Please'), P('Thank you'), P("You're welcome"), P('Got it'),
      P('Hi'), P('Bye'), P('Sorry'), P('Excuse me'),
      P('Wait'), P('One moment'), P('Stop'), P('Go on'),
      P('More'), P('Why?'), P('Say that again'), P('Help'),
    ],
  },
  MINIMAL: {
    name: 'Minimal (6)',
    phrases: [
      P('Yes'), P('No'), P('Please'), P('Thank you'), P('Stop'), P('Help'),
    ],
  },
  SOCIAL: {
    name: 'Social (16)',
    phrases: [
      P('Hi'), P('Hello'), P('Bye'), P('See you later'),
      P('Thank you'), P("You're welcome"), P('Please'), P('Sorry'),
      P('Excuse me'), P('Nice to see you'), P('How are you?'), P('Good, thanks'),
      P('Take care'), P('Of course'), P('Really?'), P("That's funny"),
    ],
  },
  REGULATE: {
    name: 'Pace & repair (16)',
    phrases: [
      P('Wait'), P('One moment'), P('Hold on'), P('Stop'),
      P('Go on'), P('Slow down'), P('Keep going'), P('Almost done'),
      P('Not now'), P('Later'), P('Never mind'), P('Say that again'),
      P("I didn't get that"), P('Let me think'), P('I need a break'), P('Enough'),
    ],
  },
  BACKCHANNEL: {
    name: 'Backchannels (12)',
    phrases: [
      P('Okay'), P('Got it'), P('I see'), P('Right'),
      P('Exactly'), P('Of course'), P('Really?'), P('Wow'),
      P("That's funny"), P('Good point'), P('Makes sense'), P('I agree'),
    ],
  },
};

export const DEFAULT_PHRASE_SET = 'CORE';

// Ordered list for the Settings selector (id + name), mirroring the keyboard
// layouts' SIDE_LAYOUTS / BOTTOM_LAYOUTS exports.
export const PHRASE_SET_LIST = Object.entries(PHRASE_SETS)
  .map(([id, set]) => ({ id, name: set.name }));
