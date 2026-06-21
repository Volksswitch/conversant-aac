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

// Functional categories (Ken: color the phrases by category). Color is the
// SECONDARY cue — the phrase text is always shown — so this never violates the
// "no meaning by color alone" principle; it just groups at a glance. Hues are
// kept distinct from the four move-slot colors where practical (repair reuses
// purple deliberately — same concept).
export const CATEGORIES = {
  affirm: { label: 'Affirm / deny', color: '#00796B', tint: '#e0f2f1' }, // teal
  social: { label: 'Social',        color: '#3949AB', tint: '#e8eaf6' }, // indigo
  pace:   { label: 'Pace / turn',   color: '#E65100', tint: '#fff3e0' }, // deep orange
  repair: { label: 'Repair',        color: '#6A1B9A', tint: '#f3e5f5' }, // purple
  need:   { label: 'Needs',         color: '#AD1457', tint: '#fce4ec' }, // magenta
  back:   { label: 'Backchannel',   color: '#546E7A', tint: '#eceff1' }, // blue-grey
};

// Phrase builder: P('Yes','affirm') or P('Mom','social','Mom') for a distinct
// spoken form. `cat` keys into CATEGORIES for the button color.
const P = (text, cat = 'back', speak) => (speak ? { text, cat, speak } : { text, cat });

// Ordered within each set by likely frequency / utility — position is stable so
// the user builds motor automaticity, and a small keyguard grid that shows only
// the first N still surfaces the most useful phrases.
// Substantive sets are padded to 32 phrases — enough to fill the non-space key
// cells of a 5-wide keyboard layout (33 keys − space). Smaller layouts use the
// first N; MINIMAL is deliberately left short.
export const PHRASE_SETS = {
  CORE: {
    name: 'Core conversation (32)',
    phrases: [
      P('Yes','affirm'), P('No','affirm'), P('Yes please','affirm'), P('No thank you','affirm'),
      P('Maybe','affirm'), P("I don't know",'affirm'), P("I'm not sure",'affirm'), P('I think so','affirm'),
      P('Okay','back'), P('Got it','back'), P("That's funny",'back'), P('I agree','affirm'),
      P('Please','social'), P('Thank you','social'), P("You're welcome",'social'), P('Sorry','social'),
      P('Excuse me','social'), P('Hi','social'), P('Hello','social'), P('Bye','social'),
      P('See you later','social'), P('Wait','pace'), P('One moment','pace'), P('Stop','pace'),
      P('Go on','pace'), P('More','pace'), P('Not now','pace'), P('Almost done','pace'),
      P('Let me think','pace'), P('Why?','repair'), P('Say that again','repair'), P('Help','need'),
    ],
  },
  MINIMAL: {
    name: 'Minimal (6)',
    phrases: [
      P('Yes','affirm'), P('No','affirm'), P('Please','social'),
      P('Thank you','social'), P('Stop','pace'), P('Help','need'),
    ],
  },
  SOCIAL: {
    name: 'Social (32)',
    phrases: [
      P('Hi','social'), P('Hello','social'), P('Good morning','social'), P('Good night','social'),
      P('Bye','social'), P('See you later','social'), P('Talk soon','social'), P('Take care','social'),
      P('Thank you','social'), P("You're welcome",'social'), P('My pleasure','social'), P('Please','social'),
      P('Sorry','social'), P('Excuse me','social'), P('No worries','back'), P('Of course','back'),
      P('Nice to see you','social'), P('Happy to see you','social'), P('How are you?','social'), P('How have you been?','social'),
      P("It's been a while",'social'), P('I missed you','social'), P('Congratulations','social'), P('Good luck','social'),
      P('Welcome','social'), P('Same to you','social'), P('Have a good one','social'), P('Take it easy','social'),
      P('Cheers','social'), P('Really?','back'), P("That's funny",'back'), P('Good, thanks','social'),
    ],
  },
  REGULATE: {
    name: 'Pace & repair (32)',
    phrases: [
      P('Wait','pace'), P('One moment','pace'), P('Hold on','pace'), P('Hang on','pace'),
      P('Give me a second','pace'), P('Stop','pace'), P('Pause','pace'), P('Go on','pace'),
      P('Continue','pace'), P('Keep going','pace'), P('Slow down','pace'), P('Too fast','pace'),
      P('Almost done','pace'), P('Almost there','pace'), P('Not now','pace'), P('Later','pace'),
      P('Move on','pace'), P('Come back to that','pace'), P('One thing at a time','pace'), P('Start over','repair'),
      P('Never mind','repair'), P('Say that again','repair'), P('Repeat that','repair'), P('What was that?','repair'),
      P("I didn't get that",'repair'), P("I'm lost",'repair'), P('Let me think','pace'), P('I need a break','need'),
      P('I need help','need'), P('Enough','pace'), P("I'm done",'pace'), P('Ready','pace'),
    ],
  },
  BACKCHANNEL: {
    name: 'Backchannels (32)',
    phrases: [
      P('Okay','back'), P('Got it','back'), P('I see','back'), P('Right','back'),
      P('Exactly','back'), P('Of course','back'), P('Sure','back'), P('Yeah','back'),
      P('Totally','back'), P('Absolutely','back'), P('For sure','back'), P('Definitely','affirm'),
      P('Agreed','affirm'), P('I agree','affirm'), P('True','back'), P('Fair enough','back'),
      P('Makes sense','back'), P('Good point','back'), P('Well said','back'), P('Noted','back'),
      P('Understood','back'), P('I hear you','back'), P('Good to know','back'), P('Sounds good','back'),
      P('Interesting','back'), P('Nice','back'), P('Cool','back'), P('Wow','back'),
      P('Really?','back'), P('Seriously?','back'), P('No way','back'), P("That's funny",'back'),
    ],
  },
};

export const DEFAULT_PHRASE_SET = 'CORE';

// Ordered list for the Settings selector (id + name), mirroring the keyboard
// layouts' SIDE_LAYOUTS / BOTTOM_LAYOUTS exports.
export const PHRASE_SET_LIST = Object.entries(PHRASE_SETS)
  .map(([id, set]) => ({ id, name: set.name }));
