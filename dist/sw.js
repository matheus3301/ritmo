const CACHE = "ritmo-static-v6";
const FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./core.js",
  "./style.css",
  "./data/program.json",
  "./data/exercises.json",
  "./data/sources.json",
  "./data/guidance.json",
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
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))),
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
