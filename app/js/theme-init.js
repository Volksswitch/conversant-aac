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
