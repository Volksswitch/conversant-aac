/* Registers the service worker (moved out of index.html so the page can forbid
 * inline scripts - SEC-3, October 9 2026). */
// Register the service worker for offline app-shell loading and PWA install,
// and auto-update the app on launch. A redeployed sw.js installs and (because
// the worker calls skipWaiting) activates immediately; when it takes control
// we reload once so the page runs the new version instead of the one it
// launched with. Guarded so the very first install (no prior controller)
// and repeat fires don't loop.
if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !hadController) return;
        reloading = true;
        // Once the app is running it decides when: never mid-conversation
        // (CR-092). Before it has loaded, reload at once.
        window.__aacUpdateReady = true;
        if (window.__aacReloadIfIdle) window.__aacReloadIfIdle();
        else window.location.reload();
    });
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            // Check for a newer worker on every launch.
            reg.update();
        } catch (err) {
            console.warn('Service worker registration failed:', err);
        }
    });
}
