import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isoDate,
  parseDate,
  addDays,
  dayDifference,
  weekNumber,
  validatePreferences,
  scheduleFor,
  progressFor,
  validateBackup,
} from "../dist/core.js";
const program = JSON.parse(
  readFileSync(new URL("../dist/data/program.json", import.meta.url)),
);
const exercises = JSON.parse(
  readFileSync(new URL("../dist/data/exercises.json", import.meta.url)),
);
const prefs = (n) => ({
  frequency: n,
  days: program.defaults[n],
  startDate: "2026-10-19",
});
test("local dates survive month/year boundaries without UTC shifts", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(isoDate(parseDate("2026-10-19")), "2026-10-19");
  assert.equal(dayDifference("2026-11-02", "2026-10-19"), 14);
  assert.equal(weekNumber("2026-11-01", "2026-10-19"), 2);
  assert.equal(weekNumber("2026-11-02", "2026-10-19"), 3);
});
test("3 / 4 / 5 day calendars match source and preserve lower-body volume", () => {
  const expected = {
    3: ["A", "rest", "B", "rest", "C", "rest", "rest"],
    4: ["A", "B", "rest", "C", "B", "rest", "rest"],
    5: ["A", "B", "cardio", "C", "B", "rest", "rest"],
  };
  for (const n of [3, 4, 5]) {
    assert.equal(validatePreferences(prefs(n), program), "");
    assert.deepEqual(
      Array.from(
        { length: 7 },
        (_, i) => scheduleFor(addDays("2026-11-02", i), prefs(n), program).id,
      ),
      expected[n],
    );
    const sessions = Array.from({ length: 7 }, (_, i) =>
      scheduleFor(addDays("2026-11-02", i), prefs(n), program),
    );
    const lower = sessions.flatMap((w) =>
      ["A", "C"].includes(w.id)
        ? w.exercises.filter((e) =>
            ["hip-thrust", "squat", "rdl", "split-squat"].includes(
              e.exerciseId,
            ),
          )
        : [],
    );
    assert.equal(
      lower.reduce((n, e) => n + e.sets, 0),
      11,
    );
  }
});
test("adaptation uses reduced sets, excludes second hip thrust and retains upper complement", () => {
  const a = scheduleFor("2026-10-19", prefs(3), program),
    c = scheduleFor("2026-10-23", prefs(3), program);
  assert.deepEqual(
    a.exercises.map((e) => e.sets),
    [2, 2, 1, 1, 1],
  );
  assert.deepEqual(
    c.exercises.map((e) => e.sets),
    [2, 1, 1, 1, 1, 1, 1],
  );
  assert.equal(
    c.exercises.some((e) => e.exerciseId === "hip-thrust"),
    false,
  );
  assert.equal(c.exercises.filter((e) => e.extra).length, 2);
  assert.equal(
    scheduleFor("2026-10-22", prefs(4), program).exercises.some((e) => e.extra),
    false,
  );
  assert.equal(scheduleFor("2026-10-18", prefs(3), program).id, "rest");
});
test("calendar rejects duplicates, invalid dates and consecutive lower-body sessions across Sunday", () => {
  for (const p of [
    { ...prefs(3), days: [1, 1, 5] },
    { ...prefs(3), days: [1, 3] },
    { ...prefs(3), days: [1, 3, 0] },
    { ...prefs(3), startDate: "2026-02-30" },
    { ...prefs(3), days: [-1, 3, 5] },
  ])
    assert.notEqual(validatePreferences(p, program), "");
  assert.equal(
    validatePreferences({ ...prefs(3), days: [2, 4, 6] }, program),
    "",
  );
});
test("each exercise has a real attributed video and valid prescription", () => {
  const known = new Set(Object.keys(exercises));
  assert.equal(known.size, 15);
  for (const e of Object.values(exercises)) {
    assert.match(e.media.youtubeId, /^[\w-]{11}$/);
    assert.ok(e.media.channel && e.media.title && e.media.verificationNotes);
    assert.ok(e.media.url.endsWith(e.media.youtubeId));
  }
  for (const w of Object.values(program.workouts))
    for (const e of w.exercises) {
      assert.ok(known.has(e.exerciseId));
      assert.ok(e.sets >= 1 && e.sets <= 3);
      assert.ok(e.restSeconds >= 45);
    }
});
test("completion respects actual prescribed sets and cardio", () => {
  const w = scheduleFor("2026-10-19", prefs(3), program);
  assert.deepEqual(
    progressFor(w, {
      exercises: {
        "hip-thrust": {
          sets: [{ done: true }, { done: true }, { done: true }],
        },
      },
    }),
    { done: 2, total: 7 },
  );
  assert.deepEqual(progressFor({ id: "cardio" }, { completed: true }), {
    done: 1,
    total: 1,
  });
});
test("export/import round-trip retains logs and prescription but rejects foreign data", () => {
  const state = {
    version: 1,
    preferences: prefs(3),
    logs: {
      "2026-10-19:A": {
        prescription: [{ exerciseId: "hip-thrust", sets: 2 }],
        exercises: {
          "hip-thrust": { sets: [{ done: true, weight: "12,5", reps: "10" }] },
        },
      },
    },
  };
  const parsed = validateBackup(JSON.parse(JSON.stringify(state)), program);
  assert.deepEqual(
    parsed.logs["2026-10-19:A"].exercises,
    state.logs["2026-10-19:A"].exercises,
  );
  assert.deepEqual(
    parsed.logs["2026-10-19:A"].prescription,
    state.logs["2026-10-19:A"].prescription,
  );
  for (const invalid of [
    null,
    {},
    { version: 1, preferences: prefs(3), logs: [] },
    { ...state, logs: { fake: {} } },
    {
      ...state,
      logs: { "2026-10-19:A": { exercises: { unknown: { sets: [] } } } },
    },
  ])
    assert.throws(() => validateBackup(invalid, program));
});
