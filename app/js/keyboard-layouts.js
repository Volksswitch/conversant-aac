/* AAC Conversation Assistant — on-screen keyboard and Express Panel layouts
 *
 * ONE LIST, OFFERED ON EITHER SIDE OF THE SCREEN (Ken, October 8 2026). The layouts
 * used to come in two lists, ten for a keyboard at the side and eleven for one at the
 * bottom. A tall phone held upright showed what that cost: the narrow shapes it
 * needed existed, but only for the side. Now every layout can sit in either place,
 * and the list is sorted narrowest first.
 *
 * FIFTEEN LAYOUTS, ONE PER SHAPE plus two that differ in letter order (Ken, October 8
 * 2026, after reviewing "Conversant AAC Layout Review.docx"). Seven layouts that only
 * repeated another's shape were removed; LAYOUT_ALIASES moves anybody using one to
 * the kept layout of the same shape, so their Express Panel and keyguard are
 * unchanged.
 *
 * THE NAME IS WORKED OUT FROM THE LAYOUT ("Alphabet, 5 × 7, 32 buttons"), so it
 * can never disagree with the grid it describes. The ids (S1, B11 ...) are internal and
 * are what settings store; they no longer say which side a layout belongs on.
 *
 * Cell shapes (all carry a `span` = how many columns the cell takes):
 *   { kind:'char',  char, label }    — inserts the character (letters, digits, , .)
 *   { kind:'space', action:'space' } — space
 *   { kind:'action', action, label } — 'shift' | 'backspace' | 'enter' | 'page'
 *   { kind:'blank' }                 — inert spacer (grid filler / split gap)
 */

// --- cell builders ----------------------------------------------------------
const C  = (ch, span = 1) => ({ kind: 'char', char: ch, label: ch, span });
const SP = (span = 1) => ({ kind: 'space', action: 'space', label: 'space', span });
const SH = (span = 1) => ({ kind: 'action', action: 'shift', label: '⇧', span });
const BK = (span = 1) => ({ kind: 'action', action: 'backspace', label: '⌫', span });
const EN = (span = 1) => ({ kind: 'action', action: 'enter', label: '↵', span });
const PG = (label = '123', span = 1) => ({ kind: 'action', action: 'page', label, span });
const BL = (span = 1) => ({ kind: 'blank', label: '', span });
const r  = (str) => str.split(' ').filter(Boolean).map((c) => C(c)); // a row of chars

const DEFS = {
  S6: { arrangement: 'Alphabet', rows: [
    r('a b c'), r('d e f'), r('g h i'), r('j k l'), r('m n o'), r('p q r'), r('s t u'), r('v w x'),
    [C('y'), C('z'), BK()],
    [SH(), PG(), EN()],
    [C(','), SP(1), C('.')],
  ]},
  S2: { arrangement: 'Alphabet', rows: [
    r('a b c d'), r('e f g h'), r('i j k l'), r('m n o p'), r('q r s t'), r('u v w x'),
    [C('y'), C('z'), C(','), C('.')],
    [SH(), PG(), BK(), EN()],
    [SP(4)],
  ]},
  S1: { arrangement: 'Alphabet', rows: [
    r('a b c d e'), r('f g h i j'), r('k l m n o'), r('p q r s t'), r('u v w x y'),
    [C('z'), C(','), C('.'), BK(), SH()],
    [PG(), SP(3), EN()],
  ]},
  S7: { arrangement: 'Alphabet down the columns', rows: [
    [C('a'), C('g'), C('m'), C('s'), C('y')],
    [C('b'), C('h'), C('n'), C('t'), C('z')],
    [C('c'), C('i'), C('o'), C('u'), BK()],
    [C('d'), C('j'), C('p'), C('v'), SH()],
    [C('e'), C('k'), C('q'), C('w'), PG()],
    [C('f'), C('l'), C('r'), C('x'), EN()],
    [C(','), SP(3), C('.')],
  ]},
  // QWERTY for a narrow screen (Ken, October 8 2026): the left-hand half of the
  // keyboard on top, the right-hand half underneath, so each half keeps its shape -
  // q, a and z still line up down the left edge. A five-column QWERTY was turned down
  // in September 2026 for the side dock; a tall phone reopened it.
  Q5: { arrangement: 'QWERTY in halves', rows: [
    r('q w e r t'), r('a s d f g'), r('z x c v b'),
    r('y u i o p'), [C('h'), C('j'), C('k'), C('l'), C(',')],
    [C('n'), C('m'), C('.'), BK(), SH()],
    [PG(), SP(3), EN()],
  ]},
  S8: { arrangement: 'Alphabet, wide punctuation', rows: [
    r('a b c d e'), r('f g h i j'), r('k l m n o'), r('p q r s t'), r('u v w x y'),
    [C('z'), C(',', 2), C('.', 2)],
    [SH(), PG(), BK(), EN(2)],
    [SP(5)],
  ]},
  S10: { arrangement: 'Alphabet with numbers', rows: [
    r('a b c d e'), r('f g h i j'), r('k l m n o'), r('p q r s t'), r('u v w x y'),
    [C('z'), C(','), C('.'), BK(), SH()],
    r('1 2 3 4 5'), r('6 7 8 9 0'),
    [SP(4), EN()],
  ]},
  S3: { arrangement: 'Alphabet', rows: [
    r('a b c d e f'), r('g h i j k l'), r('m n o p q r'), r('s t u v w x'),
    [C('y'), C('z'), C(','), C('.'), BK(), SH()],
    [PG(), SP(4), EN()],
  ]},
  B4: { arrangement: 'Alphabet', rows: [
    r('a b c d e f g'), r('h i j k l m n'), r('o p q r s t u'),
    [C('v'), C('w'), C('x'), C('y'), C('z'), C(','), C('.')],
    [SH(), PG(), BK(), SP(3), EN()],
  ]},
  B1: { arrangement: 'Alphabet', rows: [
    r('a b c d e f g h i'), r('j k l m n o p q r'),
    [C('s'), C('t'), C('u'), C('v'), C('w'), C('x'), C('y'), C('z'), BK()],
    [SH(), PG(), C(','), SP(4), C('.'), EN()],
  ]},
  B8: { arrangement: 'Alphabet split in two', rows: [
    [C('a'), C('b'), C('c'), C('d'), BL(1), C('n'), C('o'), C('p'), C('q')],
    [C('e'), C('f'), C('g'), C('h'), BL(1), C('r'), C('s'), C('t'), C('u')],
    [C('i'), C('j'), C('k'), C('l'), BL(1), C('v'), C('w'), C('x'), C('y')],
    [C('m'), C(','), C('.'), BK(), BL(1), C('z'), SH(), PG(), EN()],
    [SP(4), BL(1), SP(4)],
  ]},
  B2: { arrangement: 'Alphabet', rows: [
    r('a b c d e f g h i j'), r('k l m n o p q r s t'),
    [C('u'), C('v'), C('w'), C('x'), C('y'), C('z'), C(','), C('.'), BK(), SH()],
    [PG(), SP(8), EN()],
  ]},
  B9: { arrangement: 'Alphabet with numbers', rows: [
    r('1 2 3 4 5 6 7 8 9 0'),
    r('a b c d e f g h i j'), r('k l m n o p q r s t'),
    [C('u'), C('v'), C('w'), C('x'), C('y'), C('z'), C(','), C('.'), BK(), SH()],
    [PG(), SP(8), EN()],
  ]},
  // QWERTY for users with touch-typing skills (Ken). Three letter rows in the
  // standard QWERTY ORDER, aligned in a clean grid (q/a/z share column 1, etc.)
  // so the letters are easy to find and never shift between rows. Each row sums to
  // 12 units so the columns line up. The default for a keyboard at the bottom
  // (Ken, September 7 2026) -- see loadBottomLayout in storage.js for why.
  B11: { arrangement: 'QWERTY', rows: [
    [C('q'), C('w'), C('e'), C('r'), C('t'), C('y'), C('u'), C('i'), C('o'), C('p'), BK(2)],
    [C('a'), C('s'), C('d'), C('f'), C('g'), C('h'), C('j'), C('k'), C('l'), SH(), EN(2)],
    [C('z'), C('x'), C('c'), C('v'), C('b'), C('n'), C('m'), PG(), SP(2), C(','), C('.')],
  ]},
  B3: { arrangement: 'Alphabet', rows: [
    r('a b c d e f g h i j k l m'), r('n o p q r s t u v w x y z'),
    [SH(), PG(), C(','), SP(7), C('.'), BK(), EN()],
  ]},
};

/** How many columns across (the widest row) and rows down a layout has. */
export function layoutShape(rows) {
  const across = Math.max(0, ...(rows || []).map((row) => (row || []).reduce((n, c) => n + (c.span || 1), 0)));
  return { across, down: (rows || []).length };
}

// The name is computed so a layout's name can never disagree with its grid.
for (const def of Object.values(DEFS)) {
  const { across, down } = layoutShape(def.rows);
  // panelPositionCount is a hoisted function declaration further down this file.
  def.name = `${def.arrangement}, ${across} × ${down}, ${panelPositionCount(def.rows)} buttons`;
}

export const LAYOUTS = DEFS;

/*
 * The seven layouts removed October 8 2026, and the kept layout with the SAME SHAPE
 * that replaces each. Same shape means the Express Panel and a keyguard cut for it
 * are unchanged; only where the space bar or the action keys sit on the keyboard
 * differs. Bottom Layout 10 was an exact copy of Bottom Layout 1.
 */
export const LAYOUT_ALIASES = { B5: 'B1', B6: 'B1', B10: 'B1', B7: 'B2', S4: 'S3', S5: 'S1', S9: 'S1' };

/** A stored layout id, resolved to one that exists; `fallback` if it is unknown. */
export function resolveLayoutId(id, fallback) {
  if (id && DEFS[id]) return id;
  if (id && LAYOUT_ALIASES[id]) return LAYOUT_ALIASES[id];
  return fallback;
}

// --- symbols/numbers page (reached with the 123 key) ------------------------
//
// Spatial Stability (Ken, June 2026): a single static physical keyguard overlays
// the keyboard, so EVERY page must share ONE geometry — the holes can't move when
// the user taps 123. A fixed symbols page (one per dock) breaks this the moment
// the chosen letters layout isn't the same shape (e.g. the 3-wide S6 vs. a 5-wide
// symbols page). So the symbols page is GENERATED from the active letters layout:
// identical rows, identical spans, action/space/blank/pred cells left exactly
// where they are — only each LETTER cell becomes a symbol (in pool order) and the
// 123 key relabels to ABC. The grid is therefore guaranteed congruent with the
// letters page for whichever layout is selected, so one keyguard fits both pages.
//
// Pool order = importance: digits first, then the common specials, then the rarer
// ones so even a large-grid layout (many letter cells) is filled. A layout with
// more letter cells than pool symbols leaves the surplus cells blank (still in the
// same position — geometry preserved); a layout with fewer simply uses a prefix.
//
// The DECIMAL POINT takes the place "&" had (Ken, October 9 2026), so a number like
// 98.6 can be typed without going back to the letters page. "&" moves to where "."
// was, so it still appears on the two largest layouts; the voice says "&" as "and",
// so typing the word costs nothing. Swapping the two moves no other symbol.
const SYMBOL_POOL = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
  '@', '#', '$', '%', '.', '*', '(', ')', '-', '+',
  '!', '?', "'", '"', ':', ';', '/', '=', '_', '~',
  '&', ',', '<', '>', '[', ']', '{', '}', '\\', '|', '^', '`',
];

// Build the symbols page for a given letters layout's rows, preserving geometry.
export function buildSymbolsPage(letterRows) {
  let i = 0;
  return (letterRows || []).map((row) => (row || []).map((cell) => {
    if (cell.kind === 'char') {
      const sym = SYMBOL_POOL[i++];
      return sym === undefined ? BL(cell.span) : C(sym, cell.span);
    }
    // The 123 key becomes the ABC key (same cell, same span/position).
    if (cell.kind === 'action' && cell.action === 'page') return PG('ABC', cell.span);
    // space / shift / backspace / enter / blank / pred — unchanged, same place.
    return cell;
  }));
}

// The Settings list: every layout, narrowest first (fewest columns across), then the
// shorter of two the same width. The same list is offered whichever side of the screen
// the keyboard sits on.
export const LAYOUT_LIST = Object.keys(DEFS)
  .map((id) => ({ id, name: DEFS[id].name, ...layoutShape(DEFS[id].rows) }))
  .sort((a, b) => a.across - b.across || a.down - b.down)
  .map(({ id, name }) => ({ id, name }));

/**
 * How the Express Panel reads a keyboard layout, in one place because three callers
 * used to decide it separately and drifted (Ken, August 23 2026).
 *
 * Returns the same shape as `rows`, each cell annotated with the role it plays ON THE
 * PANEL — which is not the role it plays on the keyboard:
 *
 *   'compose'  — "In my own words". The layout's space key.
 *   'gap'      — an inert spacer, holding the grid's shape. Never a button.
 *   'position' — a place a panel button can go.
 *
 * ⚠ ONLY THE FIRST SPACE KEY BECOMES COMPOSE. Bottom Layout 8 is a split keyboard with
 * one space key per thumb, and every consumer used to turn each of them into a compose
 * button — so that layout drew TWO identical "In my own words" buttons, wasting a
 * position and reading as a bug. A second space key is a perfectly good panel position;
 * on the keyboard itself both remain real space keys, which is untouched by this.
 */
export function panelRoles(rows) {
    let composeTaken = false;
    return (rows || []).map((row) => (row || []).map((cell) => {
        const span = cell.span || 1;
        if (cell.kind === 'space' && !composeTaken) { composeTaken = true; return { role: 'compose', span }; }
        if (cell.kind === 'blank') return { role: 'gap', span };
        return { role: 'position', span };
    }));
}

/** How many panel buttons a layout has room for. */
export function panelPositionCount(rows) {
    return panelRoles(rows).reduce((n, row) => n + row.filter((c) => c.role === 'position').length, 0);
}

/**
 * Lay one row of a dock surface out as a grid of EQUAL COLUMNS, as many as that
 * row's spans add up to. Each cell then claims columns (`grid-column: span N`)
 * rather than taking a share of the leftover space.
 *
 * ⚠ IT LIVES HERE, WITH THE LAYOUTS, BECAUSE BOTH DOCK SURFACES MUST CALL THE SAME
 * ONE. The Express Panel and the on-screen keyboard have to occupy identical cells
 * so a single keyguard fits both (Rule 9), and the columns are the thing that
 * decides where those cells are. Two copies of this - even two correct copies -
 * would be two things that have to be kept in step, which is how the surfaces came
 * to disagree in the first place (see the note on .ep-row in styles.css).
 *
 * The count comes from the row's own contents, never from --kbd-cols, so a row can
 * never disagree with the cells about to go into it. minmax(0, 1fr) rather than 1fr
 * is load-bearing: a bare 1fr lets a long phrase widen its own column, and these
 * columns must not care what is in them.
 */
export function setRowColumns(rowEl, cells) {
    const columns = (cells || []).reduce((n, c) => n + (c.span || 1), 0) || 1;
    rowEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
}
