/* SWITCH ACCESS SETTINGS - the starting values and the checks on stored values.
 *
 * Pure, so tests/switch-settings.test.mjs can check it. The values are the Switch
 * Access Design's section 4 (Ken, November 12 2026). They are Claude's judgment, not
 * published guidance; switch access is marked "in progress" so they can change in the
 * app as feedback comes in.
 *
 * "Number of switches" (0 = touch, 1-3 = switches) is stored on its own, because it is
 * the most basic choice in the app and lives on the General tab. Everything else is one
 * object, `switchScan`, so choosing a different number can put back its starting values
 * in one step.
 */

// Shared by every number of switches.
const COMMON = {
    pattern: 'regions',      // 'regions' | 'items' (one line, no groups)
    exit: 'pass',            // 'pass' (after a pass with no press) | 'leave' (a Leave stop)
    actOn: 'press',          // 'press' | 'release'
    minMs: 0,                // ignore presses shorter than this
    reading: 4,              // seconds the highlight waits on new options
    newOpts: 'hold',         // 'hold' (until the highlight leaves the options) | 'show'
    flexFirst: false,        // the partner's and place's row (the Flex band) first
    moreFirst: 'last',       // "More" scanned 'first' or 'last' in its row
    suggest: 'key',          // the word suggestion: 'key' (in Enter's place) | 'first' | 'last' | 'off'
    stayKey: true,           // after a key, stay on it for one more stop
    dropdown: 'list',        // a drop-down list: 'list' (a press opens it) | 'cycle' (each press moves on)
};

export const STARTING_VALUES = {
    1: { ...COMMON, method: 'auto', speed: 1.5, forgiveMs: 300, repeatMs: 300, tapMs: 400, heldSpeed: 0.5, rampStops: 4 },
    2: { ...COMMON, method: 'step', speed: 1.5, forgiveMs: 0, repeatMs: 300, tapMs: 400, heldSpeed: 0.3, rampStops: 2 },
    3: { ...COMMON, method: 'step', speed: 1.5, forgiveMs: 0, repeatMs: 300, tapMs: 400, heldSpeed: 0.3, rampStops: 2 },
};

// What each value may be. Anything else is replaced by the starting value.
const ALLOWED = {
    pattern: ['regions', 'items'],
    exit: ['pass', 'leave'],
    actOn: ['press', 'release'],
    newOpts: ['hold', 'show'],
    moreFirst: ['first', 'last'],
    suggest: ['key', 'first', 'last', 'off'],
    dropdown: ['list', 'cycle'],
};
const NUMBERS = {
    speed: [0.3, 10], minMs: [0, 2000], reading: [0, 30], forgiveMs: [0, 2000], repeatMs: [0, 3000],
    tapMs: [100, 2000], heldSpeed: [0.1, 5], rampStops: [0, 20],
};
const BOOLS = ['flexFirst', 'stayKey'];

/** One switch offers automatic, inverse and hold to move; two or three, step only. */
export function methodsFor(count) {
    return Number(count) === 1 ? ['auto', 'inverse', 'hold'] : ['step'];
}

export function normalizeCount(n) {
    const v = Number(n);
    return [0, 1, 2, 3].includes(v) ? v : 0;
}

/** A complete, valid set of scan settings for this number of switches. */
export function normalizeScan(raw, count) {
    const c = normalizeCount(count) || 1;
    const start = STARTING_VALUES[c];
    const out = { ...start };
    const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    for (const [k, list] of Object.entries(ALLOWED)) if (list.includes(r[k])) out[k] = r[k];
    for (const [k, [lo, hi]] of Object.entries(NUMBERS)) {
        const v = Number(r[k]);
        if (r[k] !== undefined && r[k] !== null && Number.isFinite(v) && v >= lo && v <= hi) out[k] = v;
    }
    for (const k of BOOLS) if (typeof r[k] === 'boolean') out[k] = r[k];
    out.method = methodsFor(c).includes(r.method) ? r.method : start.method;
    return out;
}

/** Has anything been changed from this number's starting values? */
export function changedFromStart(scan, count) {
    const c = normalizeCount(count);
    if (!c) return false;
    const now = normalizeScan(scan, c);
    const start = STARTING_VALUES[c];
    return Object.keys(start).some((k) => now[k] !== start[k]);
}

export function isScanObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Keys a switch interface can send. A set key is added for that switch and taken from
// any other switch that had it. The starting keys stay.
export const START_KEYS = { Space: 1, Digit1: 1, Numpad1: 1, Enter: 2, NumpadEnter: 2, Digit2: 2, Numpad2: 2, Digit3: 3, Numpad3: 3 };

/** key code -> switch number, from the user's set keys. */
export function keyMap(custom) {
    const map = { ...START_KEYS };
    const mine = Object.values(custom || {});
    for (const c of Object.keys(map)) if (mine.includes(c)) delete map[c];
    for (const [n, code] of Object.entries(custom || {})) {
        if ([1, 2, 3].includes(Number(n)) && typeof code === 'string' && code) map[code] = Number(n);
    }
    return map;
}

/** How a key code reads on screen: "F", "1", "Keypad 2", "Space". */
export function keyName(code) {
    return String(code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Keypad ').replace(/^Arrow/, 'Arrow ');
}

// The app settings that suit switches (Design section 2.7). Choosing switches sets
// these; choosing "None" puts back what the user had.
export const SWITCH_APP_SETTINGS = {
    keyboardMode: 'onscreen',
    expressTapMode: 'single',
    responsesPerCategory: 1,
    autoRelisten: true,
};

/** The wait between stops while a switch is held: from the scan speed down (or up) to
 *  the top speed, evenly over `rampStops` stops; 0 goes straight to the top speed. */
export function raceWait(k, scan) {
    const n = scan.rampStops;
    if (!n) return scan.heldSpeed;
    return scan.speed + (scan.heldSpeed - scan.speed) * Math.min(k, n) / n;
}
