/* Applies the saved color scheme before the first paint (moved out of index.html so
 * the page can forbid inline scripts - SEC-3, October 9 2026). Loaded as an ordinary
 * script in <head>, which still runs before anything is drawn. */
// Runs before the first paint on purpose -- see the note above. The colours
// here are only the browser-chrome tint per scheme; every colour the PAGE
// uses lives in styles.css. Deliberately tolerant: any failure leaves the
// app on Default.
try {
    var CHROME = {
        'bold': '#2c3e50', 'hc-light': '#000000', 'dark': '#15181b',
        'hc-dark': '#000000', 'yellow': '#000000', 'cb': '#2c3e50'
    };
    var saved = JSON.parse(localStorage.getItem('aac_settings') || '{}');
    var scheme = saved.colorScheme;
    if (scheme && CHROME[scheme]) {
        document.documentElement.setAttribute('data-theme', scheme);
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.setAttribute('content', CHROME[scheme]);
    }
} catch (e) { /* no stored settings, or storage is blocked: stay on Default */ }

// Keep the page hidden until app.js has laid it out (Ken, October 28 2026). The
// stylesheet alone draws a "primordial" screen - no dock, worded Command Bar, the
// transcript across the whole width - and app.js, a module with ~80 imports, takes
// about half a second to arrive and rearrange it, so every launch showed one layout
// and then jumped to another. app.js calls __aacReveal once initApp has run.
// ⚠ THE CLASS IS SET HERE, NOT IN THE MARKUP, so hiding and its safety nets travel
// together: if this file never runs, nothing is hidden. The safety nets cover an
// app.js that never runs at all - a failed module load or a throw while the imports
// evaluate - which would otherwise leave a blank screen forever: any script or
// resource error shows the page at once, and so does a deadline long enough for a
// slow tablet's first load.
try {
    document.documentElement.classList.add('booting');
    window.__aacReveal = function () { document.documentElement.classList.remove('booting'); };
    setTimeout(window.__aacReveal, 8000);
    window.addEventListener('error', window.__aacReveal, true);
} catch (e) { /* never let this stop the page appearing */ }
