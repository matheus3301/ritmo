import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
function harness() {
  const events = {},
    opens = [],
    installs = [],
    matches = [];
  const self = {
    location: {
      origin: "https://ritmo.example",
      href: "https://ritmo.example/sw.js",
    },
    addEventListener: (name, handler) => (events[name] = handler),
    clients: { claim: async () => {} },
  };
  const caches = {
    open: async (name) => {
      opens.push(name);
      return {
        addAll: async requests => installs.push(...requests),
        match: async (path) => {
          matches.push(path);
          return { app: "ritmo", path };
        },
      };
    },
    match: async () => ({ app: "unrelated-app" }),
    keys: async () => [],
  };
  vm.runInNewContext(source, {
    self,
    caches,
    fetch: async () => {
      throw new Error("offline");
    },
    URL,
    Request,
    Set,
    Promise,
  });
  return { events, opens, matches, installs };
}
test("offline navigation uses its own cache, never another application cache", async () => {
  const h = harness();
  let response;
  h.events.fetch({
    request: { method: "GET", url: "https://ritmo.example/", mode: "navigate" },
    respondWith: (p) => (response = p),
  });
  assert.equal((await response).app, "ritmo");
  assert.ok(h.opens.every((name) => name.startsWith("ritmo-static-")));
  assert.deepEqual(h.matches, ["./index.html"]);
});
test("static assets use own cache and YouTube requests are not intercepted", async () => {
  const h = harness();
  let response;
  h.events.fetch({
    request: {
      method: "GET",
      url: "https://ritmo.example/data/exercises.json?v=1.1.2",
      mode: "cors",
    },
    respondWith: (p) => (response = p),
  });
  assert.equal((await response).app, "ritmo");
  let intercepted = false;
  h.events.fetch({
    request: {
      method: "GET",
      url: "https://www.youtube-nocookie.com/embed/test",
      mode: "navigate",
    },
    respondWith: () => (intercepted = true),
  });
  assert.equal(intercepted, false);
});

test("a new offline release revalidates files instead of copying stale HTTP responses", async () => {
  const h = harness();
  let installed;
  h.events.install({waitUntil: p => installed = p});
  await installed;
  assert.ok(h.installs.length > 10);
  assert.ok(h.installs.every(request => request.cache === "reload"));
  assert.ok(h.installs.some(request => new URL(request.url).searchParams.has("v")));
});
