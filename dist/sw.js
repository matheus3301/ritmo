const CACHE = "ritmo-static-v9";
const FILES = [
  "./",
  "./index.html",
  "./app.js?v=1.1.1",
  "./core.js",
  "./style.css",
  "./data/profiles.json",
  "./data/profiles/feminino.json",
  "./data/profiles/masculino.json",
  "./theme-init.js",
  "./data/exercises.json",
  "./data/sources.json",
  "./assets/display.ttf",
  "./assets/body.ttf",
  "./assets/body-bold.ttf",
  "./assets/icon.svg",
  "./manifest.webmanifest",
];
const urls = new Set(
  FILES.map((path) => new URL(path, self.location.href).href),
);
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map(path => new Request(new URL(path, self.location.href), { cache: "reload" }))))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("ritmo-static-") && key !== CACHE)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.open(CACHE).then((cache) => cache.match("./index.html")),
      ),
    );
    return;
  }
  if (urls.has(event.request.url))
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match(event.request))
        .then((cached) => cached || fetch(event.request)),
    );
});
