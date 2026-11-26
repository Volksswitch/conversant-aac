/*
 * The keyguard layout file (Ken, November 26 2026).
 *
 * A file that carries ONLY what decides where the keyguard holes go, so a person who
 * wants a keyguard can send it and nothing personal travels with it: no phrases, no
 * people, no places, no conversations, no keys. Ken loads it onto the same model of
 * device, adjusts the spacing if the layout will not take a workable keyguard, saves
 * it again and sends it back, and the user loads his version.
 *
 * WHAT IS IN IT
 *   settings  - the layout settings, applied on import (LAYOUT_KEYS below)
 *   device    - what this device and window measured when the file was saved. Never
 *               applied; it is what an import compares against, because the same
 *               settings in a different-sized window give a different layout.
 *   openings  - the Screen Openings lines measured at the same moment, so a keyguard
 *               can be drawn even without the device in hand.
 *
 * ⚠ AN ABSENT SETTING IS WRITTEN AS null AND CLEARED ON IMPORT. Absent means "never
 * changed", which each reader turns into the shipped default (an undragged layout, the
 * old options rule). Skipping it instead would leave the importing device's own
 * dragged layout in place, and the two screens would quietly differ.
 *
 * ⚠ NOT IN IT, DELIBERATELY: two options per category (Ken: a keyguard for it puts
 * rails across the content of other screens, so keyguards are made for one option per
 * category; the device section records the value so it can be seen), and everything
 * that changes only the look - color scheme, text sizes, icons or words on the
 * Command Bar, what a card shows. None of those moves a hole.
 *
 * Pure: no storage, no DOM. app.js hands it the values and applies what comes back.
 */

export const LAYOUT_KIND = 'conversant-keyguard-layout';
export const LAYOUT_VERSION = 1;

// Each setting that decides where a hole goes, with the name a user would recognize.
export const LAYOUT_KEYS = {
    keyboardDock:       'Where the keyboard sits',
    sideDockPosition:   'Which side the keyboard sits on',
    sideLayout:         'Keyboard layout at the side',
    bottomLayout:       'Keyboard layout at the bottom',
    convLayout:         'How much of the screen each part gets',
    optionsArrangement: 'How the response options are arranged',
    buttonGapPos:       'Button spacing',
    appMarginPos:       'Screen edge margin',
    dockSepPos:         'Keyboard separation',
    transcriptSepPos:   'Transcript separation',
    fullscreen:         'Use the whole screen',
    screenOrientation:  'Screen orientation',
};

const MAX_FILE_CHARS = 200000;
const MAX_MODEL_CHARS = 120;
const MAX_OPENINGS = 200;
const MAX_OPENING_CHARS = 400;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const pos = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const shortText = (v) => typeof v === 'string' && v.length <= 40;
const fraction = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const arrangement = (v) => ['row', 'grid', 'grid-below'].includes(v);

// What a value may be, per setting. A value that fails is left out of the import and
// named, rather than applied: the file may have been edited by hand.
const CHECKS = {
    keyboardDock:       (v) => v === 'side' || v === 'bottom',
    sideDockPosition:   (v) => v === 'left' || v === 'right',
    sideLayout:         shortText,
    bottomLayout:       shortText,
    convLayout:         (v) => isObj(v) && Object.entries(v).every(([dock, one]) =>
                            (dock === 'side' || dock === 'bottom') && isObj(one)
                            && Object.values(one).every(fraction)),
    optionsArrangement: (v) => arrangement(v)
                            || (isObj(v) && Object.entries(v).every(([dock, a]) =>
                                (dock === 'side' || dock === 'bottom') && arrangement(a))),
    buttonGapPos:       pos,
    appMarginPos:       pos,
    dockSepPos:         pos,
    transcriptSepPos:   pos,
    fullscreen:         (v) => typeof v === 'boolean',
    screenOrientation:  (v) => v === 'any' || v === 'portrait' || v === 'landscape',
};

/** The layout settings out of a full settings bundle. Absent ones become null. */
export function pickLayoutSettings(bundle) {
    const out = {};
    for (const k of Object.keys(LAYOUT_KEYS)) {
        const v = bundle ? bundle[k] : undefined;
        out[k] = v === undefined ? null : v;
    }
    return out;
}

/**
 * Build the file. `device` is what app.js measured (model typed by the user, screen,
 * window, pixel density, installed or tab); `openings` is the Screen Openings lines.
 */
export function buildLayoutFile({ bundle, device, openings, screenshotSize, appVersion, created }) {
    return {
        kind: LAYOUT_KIND,
        version: LAYOUT_VERSION,
        appVersion: String(appVersion || ''),
        created: created || new Date().toISOString(),
        device: { ...(device || {}) },
        settings: pickLayoutSettings(bundle),
        openings: Array.isArray(openings) ? openings.slice(0, MAX_OPENINGS) : [],
        screenshotSize: screenshotSize || '',
    };
}

/**
 * Read a file. Throws a message a person can act on. Returns
 * { settings, rejected: [label], device, openings, screenshotSize, created, appVersion }
 * where settings holds only usable values (null meaning "clear it").
 */
export function parseLayoutFile(text) {
    if (typeof text !== 'string' || text.length > MAX_FILE_CHARS) {
        throw new Error('That file is not a Conversant keyguard layout.');
    }
    let file;
    try { file = JSON.parse(text); } catch {
        throw new Error('That file is not a Conversant keyguard layout. It could not be read.');
    }
    if (!isObj(file) || file.kind !== LAYOUT_KIND) {
        throw new Error('That file is not a Conversant keyguard layout. Look for a file named "Conversant keyguard layout….json".');
    }
    if (typeof file.version !== 'number' || file.version > LAYOUT_VERSION) {
        throw new Error('That layout file was made by a newer version of Conversant. Update the app and try again.');
    }
    const incoming = isObj(file.settings) ? file.settings : {};
    const settings = {};
    const rejected = [];
    for (const [k, label] of Object.entries(LAYOUT_KEYS)) {
        if (!(k in incoming)) continue;            // not in the file: leave this device's own
        const v = incoming[k];
        if (v === null || CHECKS[k](v)) settings[k] = v;
        else rejected.push(label);
    }
    const device = isObj(file.device) ? cleanDevice(file.device) : {};
    const openings = Array.isArray(file.openings)
        ? file.openings.filter((l) => typeof l === 'string' && l.length <= MAX_OPENING_CHARS).slice(0, MAX_OPENINGS)
        : [];
    return {
        settings,
        rejected,
        device,
        openings,
        screenshotSize: typeof file.screenshotSize === 'string' ? file.screenshotSize.slice(0, 400) : '',
        created: typeof file.created === 'string' ? file.created.slice(0, 40) : '',
        appVersion: typeof file.appVersion === 'string' ? file.appVersion.slice(0, 40) : '',
    };
}

// Only the fields this module writes, each checked, so a hand-made file cannot put
// anything else on screen.
function cleanDevice(d) {
    const out = {};
    if (typeof d.model === 'string') out.model = d.model.trim().slice(0, MAX_MODEL_CHARS);
    for (const k of ['os', 'shell', 'screen', 'browser']) {
        if (typeof d[k] === 'string') out[k] = d[k].slice(0, 200);
    }
    for (const k of ['appWidth', 'appHeight', 'pixelRatio', 'optionsPerCategory', 'titleBar']) {
        if (typeof d[k] === 'number' && Number.isFinite(d[k])) out[k] = d[k];
    }
    if (typeof d.wholeScreen === 'boolean') out.wholeScreen = d.wholeScreen;
    return out;
}

/** Names of the layout settings that a file would change here. */
export function changedSettings(fileSettings, currentBundle) {
    const here = pickLayoutSettings(currentBundle);
    return Object.keys(fileSettings || {})
        .filter((k) => JSON.stringify(fileSettings[k]) !== JSON.stringify(here[k]))
        .map((k) => LAYOUT_KEYS[k]);
}

/**
 * How the device the file came from compares with this one, in plain sentences.
 * `match` is true when the app area is the same size, which is what decides whether
 * the same settings give the same holes.
 */
export function compareDevices(theirs, ours) {
    const t = theirs || {};
    const o = ours || {};
    const lines = [];
    const size = (d) => (d.appWidth && d.appHeight ? `${d.appWidth} × ${d.appHeight}` : '');
    const tSize = size(t), oSize = size(o);
    const sameSize = !!tSize && tSize === oSize;
    if (tSize && oSize) {
        lines.push(sameSize
            ? `The app area is the same size on both: ${tSize}.`
            : `Their app area was ${tSize}. Here it is ${oSize}, so the openings will not line up until these match.`);
    }
    if (t.shell && o.shell && t.shell !== o.shell) {
        lines.push(t.shell === 'app'
            ? 'They run Conversant installed as an app. Here it is running in a browser tab.'
            : 'They run Conversant in a browser tab. Here it is installed as an app.');
    }
    if (t.pixelRatio && o.pixelRatio && Math.abs(t.pixelRatio - o.pixelRatio) > 0.01) {
        lines.push(`Their display scale is ${t.pixelRatio}×. Here it is ${o.pixelRatio}×.`);
    }
    if (t.optionsPerCategory === 2) {
        lines.push('They show two options per category. Keyguards are made for one, so ask them to switch it to one.');
    }
    return { match: sameSize, lines };
}
