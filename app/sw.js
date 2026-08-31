/* AAC Conversation Assistant — service worker
 *
 * Strategy:
 *   - Same-origin GET requests: network-first, falling back to cache when
 *     offline. Network-first keeps the app fresh whenever GitHub Pages
 *     redeploys; the cache only serves when the network is unavailable.
 *   - Cross-origin requests (the Claude API at api.anthropic.com, the speech
 *     services, etc.) are never intercepted — they pass straight through.
 *
 * Bump CACHE_VERSION whenever the precached shell changes so old caches are
 * cleaned out on activate.
 */
// The deploy workflow replaces @@BUILD@@ with the commit sha, so EVERY deploy gets
// its own cache name and activate() clears the previous shell. Without that, all
// the pushes inside one dev cycle shared a cache key (they share an APP_VERSION),
// and a redeploy could keep serving the shell precached by an earlier one. A copy
// served straight from the working tree keeps the placeholder, which is a valid
// (and stable) cache name for local development.
const CACHE_VERSION = 'aac-v0.8.14-@@BUILD@@';
// Cache Storage is scoped to the ORIGIN, not the path, and activate() below
// deletes every cache that is not this one. Two Conversant deployments on the same
// GitHub Pages origin (/conversant-aac/ and the /conversant-aac-ipad/ trial) would
// therefore delete each other's shell every time the user switched between them —
// self-healing, since fetch is network-first, but it would look like a bug and
// would break offline start for whichever was used last. Including the scope's own
// path segment gives each deployment its own cache namespace.
const SCOPE_TAG = (() => {
    try {
        const seg = new URL(self.registration.scope).pathname.split('/').filter(Boolean).pop();
        return seg ? `${seg}-` : '';
    } catch {
        return '';
    }
})();
const CACHE_NAME = `aac-shell-${SCOPE_TAG}${CACHE_VERSION}`;

// App shell precached on install so the app can cold-start offline.
// Paths are relative to the service worker scope (the site root).
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/stt.js',
  './js/stt-deepgram.js',
  './js/vad.js',
  './js/tts.js',
  './js/llm.js',
  './js/ui.js',
  './js/storage.js',
  './js/placeholders.js',
  './js/placeholder-phrases.js',
  './js/placeholder-editor.js',
  './js/chime.js',
  './js/practice-scenarios.js',
  './js/practice-tour.js',
  './js/engine.js',
  './js/conversation-logic.js',
  './js/transcript-log.js',
  './js/worldview.js',
  './js/relationships.js',
  './js/places.js',
  './js/pronunciation.js',
  './js/voice.js',
  './js/voice-harvest.js',
  './js/sound-check-items.js',
  './js/partner-profile.js',
  './js/worldview-ui.js',
  './js/confirm-dialog.js',
  './js/keyboard.js',
  './js/keyboard-layouts.js',
  './js/viewport.js',
  './js/express-items.js',
  './js/express-panel.js',
  './js/express-bands.js',
  './js/data-transfer.js',
  './js/tts-deepgram.js',
  './js/platform.js',
  './js/express-editor.js',
  './js/control-phrases.js',
  './js/control-phrases-editor.js',
  './js/icons.js',
  './js/prediction.js',
  './js/whats-new.js',
  './js/settings-help.js',
  './js/help-mode.js',
  './js/sections.js',
  './js/usage-summary.js',
  './js/diagnostics.js',
  './js/weekly-send.js',
  './js/metrics.js',
  './data/words.json',
  './data/pricing.json',
  './data/worldview-questions.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll is atomic; if any file 404s the whole install fails, so keep
      // SHELL in sync with what actually ships. `cache: 'reload'` bypasses the
      // browser HTTP cache (GitHub Pages serves max-age=600) so a freshly
      // deployed shell is precached, not a stale copy.
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// How long to wait for the network before serving the cached copy instead.
//
// ⚠ THIS IS NOT ABOUT BEING OFFLINE. A server that is genuinely DOWN fails in
// milliseconds and never reaches this deadline. The deadline is for the far nastier
// case: a server that is REACHABLE BUT SICK — answering very slowly, or accepting the
// connection and then saying nothing. Without a deadline the browser waits as long as
// it is willing to (which can be minutes) and the user sits in front of a blank screen
// with a perfectly good copy of the app cached on the device.
//
// Falling back is safe, which is what makes a short deadline the right trade: the
// cached copy is a working app, at worst one version behind, and the next launch
// updates it. Waiting is only better when there is nothing to fall back TO — see the
// retry at the end of networkFirst, which covers the first-ever load on a slow link.
const NETWORK_TIMEOUT_MS = 6000;

async function networkFirst(request) {
  let response = null;
  let timedOut = false;
  const controller = new AbortController();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, NETWORK_TIMEOUT_MS);
  try {
    // `cache: 'no-cache'` forces revalidation with the server (ETag) instead of
    // letting the browser's HTTP cache serve a stale copy within GitHub Pages'
    // max-age=600 window — so a launch while online always gets the latest.
    response = await fetch(new Request(request, { cache: 'no-cache' }), { signal: controller.signal });
  } catch {
    response = null;            // offline, DNS failure, or aborted at the deadline
  } finally {
    clearTimeout(timer);
  }

  // ⚠ AN ERROR RESPONSE IS A FAILURE, NOT AN ANSWER. This used to return whatever the
  // server said as long as it said something, and only skipped CACHING a non-OK reply.
  // So a host that was up but broken — a 503 from an overloaded server, a hosting
  // provider's parking page, a captive portal at a hotel or an airport — was handed
  // to the page AS THE APP, and the app failed to start while a working copy sat in
  // the cache unused. That made a half-broken host worse than a completely dead one,
  // which is backwards. Anything that is not OK now falls through to the cache.
  if (response && response.ok) {
    if (response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }

  const cached = await caches.match(request);
  if (cached) return cached;
  // Navigation requests fall back to the cached app shell.
  if (request.mode === 'navigate') {
    const shell = await caches.match('./index.html');
    if (shell) return shell;
  }

  // Nothing cached to fall back on, so the deadline bought nothing and cost a load:
  // it exists to avoid waiting for a sick server WHEN THERE IS A GOOD COPY TO SERVE
  // INSTEAD. With no copy, waiting is strictly better than failing. This is the
  // first-ever visit on a slow connection, and cutting that off at six seconds would
  // turn "slow" into "broken" for exactly the user who has nothing cached yet.
  if (timedOut) {
    try { return await fetch(new Request(request, { cache: 'no-cache' })); } catch { /* fall through */ }
  }
  // Hand back whatever the network said, so the user sees a real browser error
  // rather than a silent nothing.
  return response || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs. Everything else (Claude API POSTs,
  // cross-origin assets) bypasses the worker entirely.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});
