/* Registers the service worker (moved out of index.html so the page can forbid
 * inline scripts - SEC-3, October 9 2026). */
// Register the service worker for offline app-shell loading and PWA install,
// and auto-update the app on launch. A redeployed sw.js installs and (because
// the worker calls skipWaiting) activates immediately; when it takes control
// we reload once so the page runs the new version instead of the one it
// launched with. Guarded so the very first install (no prior controller)
// and repeat fires don't loop.
//
// ⚠ THE PAGE IS USUALLY ALREADY THE NEW VERSION, SO THE RELOAD IS USUALLY POINTLESS
// (Ken, October 28 2026). Fetching is network-first, so a launch after a release
// loads the new code straight away; the new worker then spends a few seconds
// precaching the shell in the background and takes control AFTER the Start screen
// is up. Reloading then threw the user back to the Start screen they had just
// tapped, and the "What's new" notes only appeared on the second Start. So we ask
// the new worker which build it serves and reload only when the page is a
// different one - a page served from the cache while offline, or one left open
// across a deploy. No answer, or no build on the page yet, still reloads.
if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    let checking = false;
    navigator.serviceWorker.addEventListener('controllerchange', async () => {
        if (reloading || checking || !hadController) return;
        checking = true;
        const current = await pageIsWorkerBuild(navigator.serviceWorker.controller);
        checking = false;
        // Not latched: a later deploy in the same session must still be handled.
        if (current) return;
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

// True when the worker's cache name is the one this page's code would use, i.e.
// the page already runs the build the worker serves. app.js sets __aacPageBuild
// in the same format as CACHE_VERSION in sw.js (tests/sw-shell.test.mjs keeps
// the two in step).
function pageIsWorkerBuild(worker) {
    const mine = window.__aacPageBuild;
    if (!worker || !mine) return Promise.resolve(false);
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(false), 3000);
        channel.port1.onmessage = (e) => {
            clearTimeout(timer);
            resolve(!!e.data && e.data.cacheVersion === mine);
        };
        try {
            worker.postMessage({ type: 'cache-version' }, [channel.port2]);
        } catch {
            clearTimeout(timer);
            resolve(false);
        }
    });
}
