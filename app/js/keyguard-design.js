/*
 * keyguard-design.js - the file "Save keyguard design" writes (Ken, November 27 2026).
 *
 * A settings file the Volksswitch keyguard designer opens directly: Ken's default
 * designer settings (keyguard-defaults.js) with the tablet, the orientation and the
 * openings for this screen filled in. It replaces the Conversant layout file and the
 * Screen Openings file, which needed a person to carry their contents into the designer
 * by hand.
 *
 * WHAT IT ASSUMES: the app fills the screen, or nothing sits below it. The bar above
 * the app is worked out as the screen's height minus the app's height, so a taskbar or
 * browser bar BELOW the app would be counted as if it were above, and every opening
 * would come out low. That is the documented way to use this (Ken: "the only way that
 * the keyguard design function will work"), and keyguards do not make sense for
 * Conversant in a Safari tab.
 *
 * Pure: app.js supplies the measurements.
 */
import { DESIGNER_DEFAULTS, FILE_FORMAT_VERSION } from './keyguard-defaults.js';
import { findTablet } from './screen-measure.js';

/*
 * The designer's 21 "other tablet" sizes, as Ken gave them: tablet width, height and
 * thickness; screen width and height (mm, landscape); the four borders between the
 * screen edge and the tablet edge (left, right, top, bottom); then the camera, home
 * button and the rest, which do not affect the openings. Items 0, 1, 3 and 4 are
 * replaced by the measured screen plus the borders, so the screen the designer draws
 * is the screen the openings were measured on.
 */
export const OTHER_TABLET_GENERAL = [190, 140, 10, 150, 100, 20, 20, 20, 20, 5, 5, 5, 2, 10, 4, 4, 4, 10, 10, 10, 10];

const round = (n, places) => Number(n.toFixed(places));

/**
 * The designer's sizes for a tablet not on its list.
 * `screen` is { long, short } in device pixels; `mmPerPx` the size of one device pixel.
 * Returns { general, pixel } as the comma-separated strings the designer reads. The
 * pixel sizes go landscape HEIGHT first, then width, then the pixel size: the same
 * order as the designer's own tablet table (item 17), and its example "1000,1500,0.100".
 */
export function otherTabletSizes(screen, mmPerPx) {
    const g = OTHER_TABLET_GENERAL.slice();
    const screenW = round(screen.long * mmPerPx, 2);
    const screenH = round(screen.short * mmPerPx, 2);
    g[3] = screenW;
    g[4] = screenH;
    g[0] = round(screenW + g[5] + g[6], 2);
    g[1] = round(screenH + g[7] + g[8], 2);
    return {
        general: g.join(','),
        pixel: `${screen.short},${screen.long},${round(mmPerPx, 6)}`,
    };
}

/** "2026-11-27" for the date given, in local time. */
export function dateStamp(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The file name without ".json"; also the name of the settings inside it. */
export function designName(tabletName, date = new Date()) {
    // A file name cannot carry these on Windows; no tablet name has one today.
    const safe = String(tabletName || 'tablet').replace(/[\\/:*?"<>|]/g, '-').trim();
    return `${safe} - Conversant keyguard - ${dateStamp(date)}`;
}

/**
 * The bar above the app, in device pixels: the screen's height in the current
 * orientation minus the app's height. Never negative.
 * `screen` { long, short } device px; `appHeightPx` the app's height in device px.
 */
export function titleBarPx(screen, landscape, appHeightPx) {
    const screenH = landscape ? screen.short : screen.long;
    return Math.max(0, Math.round(screenH - appHeightPx));
}

/**
 * Build the design.
 *   choice    the stored "Your tablet" setting ({ kind: 'tablet', name } or a card one)
 *   landscape true when the device is held sideways
 *   openings  the opening lines, one per control, as Screen Openings has always made them
 *   screen    { long, short } in device pixels
 *   mmPerPx   size of one device pixel in mm (needed for a card measurement)
 * Returns { name, fileName, json } where json is the text to save.
 */
export function buildDesign({ choice, landscape, openings, screen, mmPerPx, date = new Date() }) {
    const p = { ...DESIGNER_DEFAULTS };
    let tabletName;
    if (choice?.kind === 'tablet') {
        const t = findTablet(choice.name);
        if (!t) throw new Error('That tablet is not on the list.');
        tabletName = t.name;
        p.type_of_tablet = t.name;
    } else if (choice?.kind === 'card') {
        if (!(mmPerPx > 0) || !screen?.long || !screen?.short) throw new Error('The screen has not been measured.');
        tabletName = 'other tablet';
        const sizes = otherTabletSizes(screen, mmPerPx);
        p.type_of_tablet = 'other tablet';
        p.other_tablet_general_sizes = sizes.general;
        p.other_tablet_pixel_sizes = sizes.pixel;
    } else {
        throw new Error('Choose your tablet first.');
    }
    p.orientation = landscape ? 'landscape' : 'portrait';
    p.number_of_rows = '0';
    p.number_of_columns = '0';
    p.cell_edge_chamfer = '0.6';
    // One opening per line, each ending in a comma, exactly as Screen Openings has
    // always written them. The designer ignores the last comma, and keeping it lets a
    // person add their own openings after it without remembering to put one back.
    p.my_screen_openings = (openings || []).join('\n');

    const name = designName(tabletName, date);
    const file = { parameterSets: { [name]: p }, fileFormatVersion: FILE_FORMAT_VERSION };
    return { name, fileName: `${name}.json`, json: JSON.stringify(file, null, 4) + '\n' };
}
