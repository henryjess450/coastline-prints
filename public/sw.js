/*
 * Coastline Prints service worker. Deliberately small: it only steps in when
 * a page can't load because there's no connection, and shows the offline
 * page instead of the browser's error. Nothing else is cached or intercepted,
 * so prices, checkout and payments always come straight from the server.
 */
const CACHE = "coastline-offline-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only full page loads on this site; everything else goes to the network untouched.
  if (req.method !== "GET" || req.mode !== "navigate" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())));
});
