import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
function harness() {
  const events = {},
    opens = [],
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
    Set,
    Promise,
  });
  return { events, opens, matches };
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
      url: "https://ritmo.example/data/exercises.json",
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
