// Service worker: gør det muligt at åbne BudgetBunkeren uden net.
// - Appens egne filer: hent fra nettet først (så opdateringer altid kommer med), og brug den gemte kopi, hvis der ikke er net.
// - Biblioteker fra esm.sh (låste versioner): brug den gemte kopi, hvis den findes.
// - Data fra Supabase går aldrig gennem her – de sidst hentede tal ligger i appens egen cache (localStorage).
const CACHE = "bb-app-v1";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest", "icon-192.png", "icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(async () => (await caches.match(req)) ?? (req.mode === "navigate" ? caches.match("index.html") : Response.error())));
  } else if (url.hostname === "esm.sh") {
    e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
