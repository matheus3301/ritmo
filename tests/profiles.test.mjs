import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  scheduleFor,
  validatePreferences,
  validateProfile,
  validateState,
  emptyState,
  addDays,
} from "../dist/core.js";
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const catalog = read("../dist/data/profiles.json");
const profiles = Object.fromEntries(
  catalog.profiles.map((p) => [p.id, read("../dist/" + p.file)]),
);
const exercises = read("../dist/data/exercises.json"),
  sources = read("../dist/data/sources.json");
const prefs = (p, n = 3) => ({
  frequency: n,
  days: p.defaults[n],
  startDate: "2026-10-19",
});
test("all published profiles resolve exercises, sources, adaptation and valid calendars", () => {
  for (const p of Object.values(profiles))
    assert.equal(validateProfile(p, exercises, sources), p);
});
test("male 3/4/5 day sequences, reduced phase and cardio are rendered from data", () => {
  const p = profiles.masculino;
  for (const n of [3, 4, 5]) {
    const days = Array.from({ length: 7 }, (_, i) =>
      scheduleFor(addDays("2026-11-02", i), prefs(p, n), p),
    );
    assert.deepEqual(
      days.filter((w) => w.id !== "rest").map((w) => w.id),
      p.sequences[n],
    );
    const adapted = scheduleFor("2026-10-19", prefs(p, n), p);
    assert.equal(
      adapted.exercises.reduce((sum, e) => sum + e.sets, 0),
      8,
    );
    assert.equal(
      days[0].exercises.reduce((sum, e) => sum + e.sets, 0),
      14,
    );
  }
  assert.equal(
    validatePreferences({ ...prefs(p), days: [1, 3, 0] }, p).length > 0,
    true,
  );
  assert.equal(
    validatePreferences({ ...prefs(p, 4), days: [1, 2, 3, 4] }, p),
    "",
  );
  assert.equal(
    validatePreferences({ ...prefs(p, 4), days: [1, 2, 6, 0] }, p),
    "",
  );
});
test("legacy backup migration keeps feminine dates, weights, completion and prescription", () => {
  const legacy = {
    version: 1,
    preferences: prefs(profiles.feminino),
    logs: {
      "2026-10-19:A": {
        prescription: [{ exerciseId: "hip-thrust", sets: 2 }],
        exercises: {
          "hip-thrust": { sets: [{ done: true, weight: "12,5", reps: "10" }] },
        },
      },
    },
  };
  const migrated = validateState(legacy, profiles, catalog.defaultProfileId);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.profileId, "feminino");
  assert.deepEqual(migrated.plans.feminino.preferences, legacy.preferences);
  assert.deepEqual(
    migrated.plans.feminino.logs["2026-10-19:A"].exercises,
    legacy.logs["2026-10-19:A"].exercises,
  );
  assert.deepEqual(
    migrated.plans.feminino.logs["2026-10-19:A"].prescription,
    legacy.logs["2026-10-19:A"].prescription,
  );
});
test("v2 backups isolate same-date workout keys and retain themes and both schedules", () => {
  const state = emptyState("masculino");
  state.theme = "dark";
  for (const id of ["feminino", "masculino"])
    state.plans[id] = {
      version: 1,
      preferences: prefs(profiles[id]),
      logs: {
        "2026-10-19:A": {
          exercises: {
            "chest-press": {
              sets: [
                {
                  done: true,
                  weight: id === "masculino" ? "30" : "10",
                  reps: "12",
                },
              ],
            },
          },
        },
      },
    };
  const restored = validateState(
    JSON.parse(JSON.stringify(state)),
    profiles,
    catalog.defaultProfileId,
  );
  assert.equal(restored.theme, "dark");
  assert.equal(restored.profileId, "masculino");
  assert.equal(
    restored.plans.feminino.logs["2026-10-19:A"].exercises["chest-press"]
      .sets[0].weight,
    "10",
  );
  assert.equal(
    restored.plans.masculino.logs["2026-10-19:A"].exercises["chest-press"]
      .sets[0].weight,
    "30",
  );
  for (const broken of [
    { ...state, theme: "wat" },
    { ...state, profileId: "unknown" },
    { ...state, plans: { unknown: {} } },
  ])
    assert.throws(() =>
      validateState(broken, profiles, catalog.defaultProfileId),
    );
  assert.deepEqual(
    validateState(emptyState("feminino"), profiles, "feminino"),
    emptyState("feminino"),
  );
});
test("a third JSON profile can use different workout IDs without renderer changes", () => {
  const p = structuredClone(profiles.masculino);
  p.id = "equilibrio";
  p.label = "Equilíbrio";
  p.workouts.D = { ...p.workouts.A, id: "D" };
  delete p.workouts.A;
  p.adaptationSets.D = p.adaptationSets.A;
  delete p.adaptationSets.A;
  for (const [n, sequence] of Object.entries(p.sequences))
    p.sequences[n] = sequence.map((id) => (id === "A" ? "D" : id));
  validateProfile(p, exercises, sources);
  assert.equal(scheduleFor("2026-11-02", prefs(p), p).id, "D");
  const all = { ...profiles, equilibrio: p };
  const v = emptyState(p.id);
  v.plans[p.id] = {
    version: 1,
    preferences: prefs(p),
    logs: { "2026-11-02:D": { exercises: {} } },
  };
  assert.equal(validateState(v, all, "feminino").profileId, p.id);
});
test("broken profile references and contradictory adaptation are rejected", () => {
  for (const mutate of [
    (p) => (p.workouts.A.exercises[0].exerciseId = "missing"),
    (p) => p.sourceIds.push("missing"),
    (p) => (p.adaptationSets.A["chest-press"] = 99),
    (p) => (p.sequences[3] = ["A", "missing", "C"]),
    (p) => (p.id = "__proto__"),
  ]) {
    const p = structuredClone(profiles.masculino);
    mutate(p);
    assert.throws(() => validateProfile(p, exercises, sources));
  }
});
test("offline manifest includes every profile and theme startup asset", () => {
  const sw = readFileSync(new URL("../dist/sw.js", import.meta.url), "utf8");
  for (const p of catalog.profiles) assert.ok(sw.includes('"' + p.file + '"'));
  assert.ok(sw.includes('"./theme-init.js"'));
});
