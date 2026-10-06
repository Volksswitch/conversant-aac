/* Viewport / screen diagnostics.
 *
 * Logs everything the web platform can tell us about the display the app is
 * running on (see the "how much of the screen size can the app determine"
 * analysis): the layout viewport, the full screen, the available area, the
 * scaling factor, the recovered native resolution, and the visual viewport
 * (which shrinks when the OS keyboard overlays). Re-logged on every change
 * (resize / orientation / keyboard) so a beta tester can read off their real
 * numbers when something looks wrong on their device.
 *
 * IMPORTANT — what is NOT here, because the platform does not expose it: the
 * physical diagonal (inches), the true pixel density (real PPI), or any real
 * physical size. `devicePixelRatio` is the Windows SCALING factor, not the
 * panel's density. Everything below is therefore in CSS pixels (or a ratio).
 * This is exactly why a proportional, pixel-relative layout is the right model:
 * the pixel box is knowable and reactive; physical millimeters are not.
 */

const PREFIX = '[viewport]';

// Collect the full metric set. All lengths are CSS pixels unless noted.
export function getMetrics() {
    const dpr = window.devicePixelRatio || 1;
    const vv = window.visualViewport;
    const orientation = (screen.orientation && screen.orientation.type)
        || (matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape');

    // The box our page actually lays out against (the number that matters). It is
    // the documentElement's client box, which zoom cannot move - the same reading
    // app.js uses (layoutVW/layoutVH; UI Layout Rule 13). window.innerWidth/Height
    // is reported separately because in Safari it is the VISUAL viewport and shrinks
    // under zoom, which is exactly the difference a zoom report has to show (CR-201).
    const lw = document.documentElement.clientWidth || window.innerWidth;
    const lh = document.documentElement.clientHeight || window.innerHeight;
    return {
        layoutViewport: { w: lw, h: lh },
        // window.innerWidth/Height: the layout box plus any scrollbars, except in
        // Safari under zoom, where it follows the visual viewport.
        innerWindow: { w: window.innerWidth, h: window.innerHeight },
        // The whole browser window (incl. chrome). outerH - innerH ≈ top chrome.
        outerWindow: { w: window.outerWidth, h: window.outerHeight },
        approxBrowserChromeH: Math.max(0, window.outerHeight - window.innerHeight),
        // The entire display in CSS px (= native ÷ scaling), and minus taskbar.
        screen: { w: screen.width, h: screen.height },
        screenAvail: { w: screen.availWidth, h: screen.availHeight },
        // The Windows scaling factor (NOT physical density).
        devicePixelRatio: dpr,
        // Native physical resolution, recovered: screen(CSS) × scaling.
        nativeResolution: {
            w: Math.round(screen.width * dpr),
            h: Math.round(screen.height * dpr),
        },
        // The visual viewport — reflects pinch-zoom and the OS keyboard overlay.
        // A height noticeably below the layout viewport means the keyboard (or a
        // zoom) is covering part of the page.
        visualViewport: vv
            ? { w: Math.round(vv.width), h: Math.round(vv.height), scale: vv.scale }
            : null,
        orientation,
        // Aspect ratio of the layout viewport (landscape > 1).
        aspect: lh ? +(lw / lh).toFixed(3) : null,
    };
}

let logTimer = null;

function log(reason) {
    const m = getMetrics();
    // Group so the (large) object is one collapsible console entry per change.
    console.log(`${PREFIX} ${reason} —`,
        `layout ${m.layoutViewport.w}×${m.layoutViewport.h}`,
        `| screen ${m.screen.w}×${m.screen.h}`,
        `| dpr ${m.devicePixelRatio}`,
        `| native ${m.nativeResolution.w}×${m.nativeResolution.h}`,
        `| ${m.orientation}`);
    console.log(`${PREFIX} full metrics:`, m);
}

// Debounce the change-driven logs so a drag-resize doesn't flood the console.
function scheduleLog(reason) {
    clearTimeout(logTimer);
    logTimer = setTimeout(() => log(reason), 200);
}

// Start logging: once now, then on every viewport change.
export function init() {
    log('initial');
    window.addEventListener('resize', () => scheduleLog('resize'));
    if (screen.orientation) {
        screen.orientation.addEventListener('change', () => scheduleLog('orientation'));
    }
    if (window.visualViewport) {
        // Fires when the OS keyboard overlays/retracts or on pinch-zoom.
        window.visualViewport.addEventListener('resize', () => scheduleLog('visualViewport'));
    }
}
