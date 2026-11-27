/*
 * screen-measure.js — turning on-screen distances into millimetres (Ken, November 27 2026).
 *
 * WHY THIS EXISTS. Every spacing setting sets one exact distance in CSS pixels, and a
 * keyguard is designed in millimetres. Browsers deliberately do not report a screen's
 * physical size, so the app cannot convert on its own. Two ways in:
 *
 *   1. THE TABLET LIST (the main route). tablets.js is generated from the keyguard
 *      designer, which records the size of one DEVICE pixel in millimetres for every
 *      tablet it supports. Using the designer's own numbers means the millimetres shown
 *      here are the millimetres the keyguard is built with.
 *   2. A CARD MEASUREMENT (the backup). The user stretches a bar on screen until it is as
 *      long as the short side of a credit card - a size fixed by an international
 *      standard - which measures the screen directly.
 *
 * ⚠ THE BUILT-IN CSS "mm" IS NOT A REAL MILLIMETRE. It is 96/25.4 CSS pixels whatever
 * the screen, so on an iPad or a Surface it comes out about a quarter too small. Never
 * use it where a physical size matters; use mmPerCssPx() below.
 *
 * CSS px -> device px is devicePixelRatio, which already includes Windows display
 * scaling (and browser zoom, which the app blocks). So for a listed tablet the result
 * does not depend on the scaling setting. A card measurement DOES (it is taken in CSS
 * pixels), so it records the ratio it was taken at and stops being trusted if that
 * changes.
 *
 * Pure: no DOM, no storage. app.js supplies the screen facts.
 */
import { TABLETS } from './tablets.js';

export { TABLETS };

/** The short side of an ID-1 card (a credit card), in mm (ISO/IEC 7810). */
export const CARD_SHORT_MM = 53.98;

/** How far the screen's pixel count may differ from the listed tablet's and still match.
 *  Some browsers round the screen size to whole CSS pixels, which at a ratio of 2 or 3
 *  can be a few device pixels out; a different tablet is almost always out by far more. */
export const MATCH_TOLERANCE = 0.015;

export function findTablet(name) {
    return TABLETS.find(t => t.name === name) || null;
}

/**
 * Does this screen look like the chosen tablet?
 * `screen` is { w, h } in DEVICE pixels (CSS screen size × devicePixelRatio).
 * Orientation does not matter. Returns { ok, short, long } with this screen's sides.
 */
export function matchTablet(tablet, screen) {
    const a = Math.round(Number(screen?.w) || 0), b = Math.round(Number(screen?.h) || 0);
    const short = Math.min(a, b), long = Math.max(a, b);
    if (!tablet || !short || !long) return { ok: false, short, long };
    const near = (x, y) => Math.abs(x - y) <= y * MATCH_TOLERANCE;
    return { ok: near(short, tablet.short) && near(long, tablet.long), short, long };
}

/**
 * Millimetres per CSS pixel on this screen, or null when it is not known.
 * `choice` is the stored setting: { kind: 'tablet', name } or
 * { kind: 'card', mmPerCssPx, dpr }. `dpr` is the current devicePixelRatio.
 * `screen` (device pixels) is used to refuse a tablet that does not match.
 */
export function mmPerCssPx(choice, dpr, screen) {
    if (!choice || typeof choice !== 'object') return null;
    const ratio = Number(dpr) || 1;
    if (choice.kind === 'tablet') {
        const t = findTablet(choice.name);
        if (!t) return null;
        if (screen && !matchTablet(t, screen).ok) return null;
        return t.mmPerPx * ratio;
    }
    if (choice.kind === 'card') {
        const v = Number(choice.mmPerCssPx);
        if (!(v > 0)) return null;
        // Taken at a different scaling: the measurement no longer describes this screen.
        if (Math.abs((Number(choice.dpr) || 1) - ratio) > 0.01) return null;
        return v;
    }
    return null;
}

/*
 * Common screen sizes in device pixels [long, short], for laptops, monitors and
 * Windows tablets. Together with the tablet list they are the sizes a screen is
 * likely to be (Ken, November 27 2026).
 *
 * WHY: the browser reports the screen in its own units, rounded to whole numbers. At a
 * display scaling that is not a whole number (115%, 125%, 150%) converting back to
 * screen pixels can be out by up to the scaling factor: a 1080-pixel screen at 115% is
 * reported as 940 units, and 940 × 1.15 = 1081. Snapping to a known size gives the
 * real figure.
 */
export const COMMON_SCREENS = [
    [1024, 768], [1280, 720], [1280, 800], [1280, 1024], [1366, 768], [1440, 900],
    [1600, 900], [1600, 1200], [1680, 1050], [1920, 1080], [1920, 1200], [1920, 1280],
    [2048, 1536], [2160, 1440], [2160, 1350], [2256, 1504], [2400, 1600], [2496, 1664],
    [2560, 1080], [2560, 1440], [2560, 1600], [2560, 1664], [2736, 1824], [2880, 1620],
    [2880, 1800], [2880, 1864], [2880, 1920], [3000, 2000], [3024, 1964], [3072, 1920],
    [3200, 1800], [3240, 2160], [3440, 1440], [3456, 2234], [3840, 1600], [3840, 2160],
    [3840, 2400], [5120, 2880],
];

function knownSizes() {
    const seen = new Set();
    const out = [];
    for (const [long, short] of [...COMMON_SCREENS, ...TABLETS.map(t => [t.long, t.short])]) {
        const k = `${long}x${short}`;
        if (!seen.has(k)) { seen.add(k); out.push({ long, short }); }
    }
    return out;
}

/**
 * The screen's real size in device pixels, as best it can be known.
 * `cssW`, `cssH` are the browser's screen size in its own units; `dpr` the ratio.
 * Returns { long, short, exact }. `exact` is true when the figure is certain: the ratio
 * is a whole number (no rounding happened), or exactly one known size lies within the
 * rounding error. Otherwise the calculated figure is returned with exact: false.
 */
export function screenSize(cssW, cssH, dpr) {
    const ratio = Number(dpr) || 1;
    const a = (Number(cssW) || 0) * ratio, b = (Number(cssH) || 0) * ratio;
    const long = Math.round(Math.max(a, b)), short = Math.round(Math.min(a, b));
    if (!long || !short) return { long, short, exact: false };
    if (Math.abs(ratio - Math.round(ratio)) < 0.001) return { long, short, exact: true };
    // Rounding one unit costs less than one unit's worth of pixels, so the real size
    // is within `ratio` pixels of the calculated one (and never less than 2).
    const tol = Math.max(2, Math.ceil(ratio));
    const near = knownSizes().filter(s => Math.abs(s.long - long) <= tol && Math.abs(s.short - short) <= tol);
    if (near.length === 1) return { long: near[0].long, short: near[0].short, exact: true };
    return { long, short, exact: false };
}

/** The card measurement: the bar was `barCssPx` CSS pixels long when it matched the card. */
export function cardChoice(barCssPx, dpr) {
    const px = Number(barCssPx);
    if (!(px > 0)) return null;
    return { kind: 'card', mmPerCssPx: CARD_SHORT_MM / px, dpr: Number(dpr) || 1 };
}

/** Is a stored choice well-formed? (For the import checks in storage.js.) */
export function isValidChoice(v) {
    if (v === null) return true;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    if (v.kind === 'tablet') return typeof v.name === 'string' && v.name.length <= 120;
    if (v.kind === 'card') return Number(v.mmPerCssPx) > 0 && Number(v.mmPerCssPx) < 2
        && Number(v.dpr) > 0 && Number(v.dpr) < 10;
    return false;
}

/**
 * The words shown under a spacing slider: "3.2 mm (34 screen pixels)", or just the
 * screen pixels when the millimetres are not known. Screen pixels are device pixels,
 * which is what the keyguard designer and the Screen Openings file use.
 */
export function describeDistance(cssPx, dpr, scale) {
    const devicePx = Math.round((Number(cssPx) || 0) * (Number(dpr) || 1));
    const pxWords = `${devicePx} screen pixel${devicePx === 1 ? '' : 's'}`;
    if (!(scale > 0)) return pxWords;
    const mm = (Number(cssPx) || 0) * scale;
    return `${mm.toFixed(1)} mm (${pxWords})`;
}
