/* ============================================================================
   Fraction Trails — service worker

   WHY THIS WAS REWRITTEN
   ----------------------
   The previous version was cache-first with no revalidation:

       caches.match(request).then(cached => { if (cached) return cached; ... })

   Once a device had cached styles.css it served that copy for ever — until
   someone remembered to bump CACHE_NAME by hand. That is why the game rendered
   differently from one device to the next: an iPad that opened it last month
   was still running last month's CSS against this month's HTML, and the two
   disagreed. It is not a browser difference at all; it is a cache difference
   wearing a browser's clothes.

   THE STRATEGY NOW
   ----------------
   Code (HTML, CSS, JS) — network-first, with the cache as the offline
     fallback. A device that is online always runs the current code. A device
     on a dead school wifi still opens the game.

   Everything else (the sprite sheets, fonts, icons) — stale-while-revalidate.
     The cached copy paints immediately, and a fresh copy is fetched in the
     background for next time. Worst case a sprite sheet is one visit behind,
     which is invisible; it can never be a month behind.

   BUMP CACHE_VERSION ON EVERY DEPLOY. It is the one manual step. With
   network-first code this is now a belt-and-braces measure rather than the
   only thing standing between a child and a broken page, but do it anyway.
   ========================================================================= */

const CACHE_VERSION = 'v6';
const CACHE_NAME = `fraction-trails-${CACHE_VERSION}`;

// Fetched on install so the game works offline from the first visit.
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './utils.js',
  './cloud-config.js',
  './cloud-sync.js',
  './cloud-dashboard.js',
  './game.js',
  './main.js',
  './tree.svg',
  './icon.svg',
  './assets/sprites.css',
  './assets/fonts.css',
  './assets/pixel-scale.js',
  './assets/tiles.png',
  './assets/chars.png',
  './assets/avatars.png',
  './assets/tree.png',
  './assets/fx.png',
  './assets/alert.png',
  './assets/clouds.png',
  './assets/treeline.png'
  ,'./assets/fractlings.png'
  ,'./assets/fractlings.css'
  ,'./assets/rarity.js'
];

// Code has to be current; assets only have to be recent.
const isCode = (url) =>
  /\.(?:html|css|js)$/.test(url.pathname) || url.pathname.endsWith('/');

const NETWORK_TIMEOUT = 3000;   // school wifi that answers slowly is still offline

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll is all-or-nothing: one 404 and the whole install fails and the
      // game has no offline copy at all. Cache them individually instead.
      .then((cache) => Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => {
          console.warn('[sw] could not precache', url);
        }))
      ))
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

function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (response) => { if (!settled) { settled = true; resolve(response); } };

    const timer = setTimeout(() => {
      caches.match(request).then((cached) => { if (cached) done(cached); });
    }, NETWORK_TIMEOUT);

    fetch(request).then((response) => {
      clearTimeout(timer);
      if (response && response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
      }
      done(response);
    }).catch(() => {
      clearTimeout(timer);
      caches.match(request).then((cached) => done(cached || Response.error()));
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const fresh = fetch(request).then((response) => {
      if (response && response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
      }
      return response;
    }).catch(() => cached);
    return cached || fresh;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Don't touch other origins — the Google Fonts CDN has its own caching, and
  // opaque cross-origin responses fill the cache quota with nothing useful.
  if (url.origin !== self.location.origin) return;

  event.respondWith(isCode(url) ? networkFirst(request) : staleWhileRevalidate(request));
});

// Lets the page trigger an immediate update: navigator.serviceWorker.controller
// .postMessage({type:'SKIP_WAITING'})
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
