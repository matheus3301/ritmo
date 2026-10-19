export const STORE_KEY = "ritmo:v2";
export const LEGACY_STORE_KEY = "ritmo:v1";
export const dayNames = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
export function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function addDays(value, n) {
  const d = parseDate(value);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function dayDifference(a, b) {
  const utc = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(a) - utc(b)) / 86400000);
}
export function weekNumber(date, start) {
  return Math.max(1, Math.floor(dayDifference(date, start) / 7) + 1);
}
export function orderedDays(days) {
  return [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
}
export function validatePreferences(p, program) {
  if (!p || !Object.hasOwn(program.sequences, p.frequency))
    return "Escolha uma frequência disponível nesta ficha.";
  if (
    !Array.isArray(p.days) ||
    p.days.length !== p.frequency ||
    new Set(p.days).size !== p.frequency ||
    p.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    return `Selecione exatamente ${p.frequency} dias da semana.`;
  if (
    typeof p.startDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(p.startDate) ||
    isoDate(parseDate(p.startDate)) !== p.startDate
  )
    return "Escolha uma data de início válida.";
  const days = orderedDays(p.days),
    seq = program.sequences[p.frequency];
  for (const group of program.recoveryGroups) {
    const positions = days.filter((day, i) =>
      program.workouts[seq[i]]?.recoveryGroups.includes(group),
    );
    if (positions.length < 2) continue;
    for (let i = 0; i < positions.length; i++) {
      const gap =
        (positions[(i + 1) % positions.length] - positions[i] + 7) % 7;
      if (gap < 2) return program.recoveryNote + " Escolha outros dias.";
    }
  }
  return "";
}
export function scheduleFor(date, p, program) {
  const week = weekNumber(date, p.startDate),
    adaptation = week <= program.adaptationWeeks;
  if (date < p.startDate)
    return {
      id: "rest",
      name: "Seu plano começa em breve",
      week,
      adaptation,
      exercises: [],
    };
  const index = orderedDays(p.days).indexOf(parseDate(date).getDay());
  const id = index < 0 ? "rest" : program.sequences[p.frequency][index];
  if (id === "rest" || id === "cardio")
    return {
      id,
      name: id === "rest" ? "Dia de recuperar" : "Cardio no seu ritmo",
      week,
      adaptation,
      exercises: [],
    };
  let exercises = program.workouts[id].exercises
    .map((e) => ({
      ...e,
      sets: adaptation ? program.adaptationSets[id][e.exerciseId] : e.sets,
    }))
    .filter((e) => e.sets > 0);
  exercises.push(
    ...(program.supplements[p.frequency]?.[id] || [])
      .map((e) => ({
        ...e,
        sets: adaptation ? e.adaptationSets : e.sets,
        extra: true,
      }))
      .filter((e) => e.sets > 0),
  );
  return { ...program.workouts[id], week, adaptation, exercises };
}
export function workoutKey(date, id) {
  return `${date}:${id}`;
}
export function progressFor(workout, log) {
  if (workout.id === "cardio")
    return { done: log?.completed ? 1 : 0, total: 1 };
  let total = 0,
    done = 0;
  for (const e of workout.exercises) {
    total += e.sets;
    for (let i = 0; i < e.sets; i++)
      if (log?.exercises?.[e.exerciseId]?.sets?.[i]?.done === true) done++;
  }
  return { done, total };
}
export function validateBackup(value, program) {
  if (
    !value ||
    value.version !== 1 ||
    validatePreferences(value.preferences, program)
  )
    throw new Error("Este arquivo não contém um plano Ritmo válido.");
  if (
    !value.logs ||
    typeof value.logs !== "object" ||
    Array.isArray(value.logs) ||
    Object.keys(value.logs).length > 5000
  )
    throw new Error("O histórico do arquivo é inválido.");
  const known = new Set(
    [
      ...Object.values(program.workouts).flatMap((w) => w.exercises),
      ...Object.values(program.supplements).flatMap((byWorkout) =>
        Object.values(byWorkout).flat(),
      ),
    ].map((e) => e.exerciseId),
  );
  const logs = {};
  for (const [key, log] of Object.entries(value.logs)) {
    if (
      !/^\d{4}-\d{2}-\d{2}:[A-Za-z0-9-]+$/.test(key) ||
      isoDate(parseDate(key.split(":")[0])) !== key.split(":")[0] ||
      !(
        key.split(":")[1] === "cardio" ||
        Object.hasOwn(program.workouts, key.split(":")[1])
      ) ||
      !log ||
      typeof log !== "object"
    )
      throw new Error("Há registros inválidos no arquivo.");
    const out = {
      completed: log.completed === true,
      minutes: Math.max(0, Math.min(300, Number(log.minutes) || 0)),
      exercises: {},
    };
    for (const [id, e] of Object.entries(log.exercises || {})) {
      if (!known.has(id) || !e || !Array.isArray(e.sets) || e.sets.length > 10)
        throw new Error("Há exercícios inválidos no arquivo.");
      out.exercises[id] = {
        sets: e.sets.map((s) => ({
          done: s?.done === true,
          weight: String(s?.weight ?? "").slice(0, 8),
          reps: String(s?.reps ?? "").slice(0, 8),
        })),
      };
    }
    // Snapshots keep the original prescription when preferences change.
    if (
      Array.isArray(log.prescription) &&
      log.prescription.length <= 15 &&
      log.prescription.every(
        (e) =>
          known.has(e.exerciseId) &&
          Number.isInteger(e.sets) &&
          e.sets >= 1 &&
          e.sets <= 5,
      )
    )
      out.prescription = log.prescription.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets,
      }));
    logs[key] = out;
  }
  return {
    version: 1,
    preferences: {
      frequency: value.preferences.frequency,
      days: orderedDays(value.preferences.days),
      startDate: value.preferences.startDate,
    },
    logs,
  };
}

// One saved plan per profile. A and B in different profiles never share logs.
export function emptyState(defaultProfileId) {
  return {
    version: 2,
    profileId: defaultProfileId,
    theme: "system",
    plans: {},
  };
}
export function validateState(value, profiles, defaultProfileId) {
  if (value?.version === 1) {
    const migrated = emptyState(defaultProfileId);
    migrated.plans[defaultProfileId] = validateBackup(
      value,
      profiles[defaultProfileId],
    );
    return migrated;
  }
  if (
    !value ||
    value.version !== 2 ||
    !Object.hasOwn(profiles, value.profileId) ||
    !["system", "light", "dark"].includes(value.theme) ||
    !value.plans ||
    typeof value.plans !== "object" ||
    Array.isArray(value.plans)
  ) {
    throw new Error("Este arquivo não contém perfis Ritmo válidos.");
  }
  const clean = emptyState(value.profileId);
  clean.theme = value.theme;
  for (const [id, plan] of Object.entries(value.plans)) {
    if (!Object.hasOwn(profiles, id))
      throw new Error("A cópia contém um perfil indisponível nesta versão.");
    clean.plans[id] = validateBackup(plan, profiles[id]);
  }
  return clean;
}
export function validateProfile(profile, exercises, sources) {
  const fail = () => {
    throw new Error(
      "Ficha JSON inválida: " + (profile?.id || "sem identificação"),
    );
  };
  const safeId = (id) =>
    typeof id === "string" &&
    /^[a-z][a-z0-9-]*$/.test(id) &&
    !["constructor", "prototype", "__proto__"].includes(id);
  if (
    !profile ||
    profile.schemaVersion !== 1 ||
    !safeId(profile.id) ||
    !profile.label ||
    !profile.subtitle ||
    !profile.audience ||
    !Number.isInteger(profile.durationWeeks) ||
    profile.durationWeeks < 1 ||
    !Number.isInteger(profile.adaptationWeeks) ||
    profile.adaptationWeeks < 0 ||
    profile.adaptationWeeks > profile.durationWeeks ||
    !profile.workouts ||
    !profile.sequences ||
    !profile.defaults ||
    !profile.adaptationSets ||
    !profile.supplements ||
    !Array.isArray(profile.recoveryGroups) ||
    !profile.recoveryNote ||
    !profile.scheduleHints ||
    !profile.guidance?.sections?.length ||
    !profile.cardio?.text ||
    !profile.cardio.adaptationMinutes ||
    !profile.cardio.baseMinutes ||
    !profile.adaptationRir ||
    !profile.baseRir ||
    !Array.isArray(profile.sourceIds)
  )
    fail();
  const checkEntry = (e) => {
    if (
      !e ||
      !Object.hasOwn(exercises, e.exerciseId) ||
      !Number.isInteger(e.sets) ||
      e.sets < 1 ||
      e.sets > 5 ||
      typeof e.reps !== "string" ||
      !e.restLabel ||
      !Number.isInteger(e.restSeconds) ||
      e.restSeconds < 15 ||
      e.restSeconds > 600
    )
      fail();
  };
  for (const [id, w] of Object.entries(profile.workouts)) {
    if (
      !/^[A-Z][A-Z0-9-]*$/.test(id) ||
      w.id !== id ||
      !w.name ||
      !w.minutes ||
      !Array.isArray(w.recoveryGroups) ||
      !Array.isArray(w.exercises) ||
      !w.exercises.length ||
      w.exercises.length > 15 ||
      new Set(w.exercises.map((e) => e.exerciseId)).size !== w.exercises.length
    )
      fail();
    for (const e of w.exercises) {
      checkEntry(e);
      const reduced = profile.adaptationSets[id]?.[e.exerciseId];
      if (!Number.isInteger(reduced) || reduced < 0 || reduced > e.sets) fail();
    }
  }
  for (const [frequency, sequence] of Object.entries(profile.sequences)) {
    const n = Number(frequency);
    if (
      !Number.isInteger(n) ||
      n < 1 ||
      n > 7 ||
      !Array.isArray(sequence) ||
      sequence.length !== n ||
      sequence.some(
        (id) => id !== "cardio" && !Object.hasOwn(profile.workouts, id),
      ) ||
      !profile.scheduleHints[frequency] ||
      validatePreferences(
        {
          frequency: n,
          days: profile.defaults[frequency],
          startDate: "2026-10-19",
        },
        profile,
      )
    )
      fail();
  }
  for (const [frequency, extras] of Object.entries(profile.supplements)) {
    if (!Object.hasOwn(profile.sequences, frequency)) fail();
    for (const [id, entries] of Object.entries(extras)) {
      if (!Object.hasOwn(profile.workouts, id) || !Array.isArray(entries))
        fail();
      const seen = new Set(
        profile.workouts[id].exercises.map((e) => e.exerciseId),
      );
      for (const e of entries) {
        checkEntry(e);
        if (
          seen.has(e.exerciseId) ||
          !Number.isInteger(e.adaptationSets) ||
          e.adaptationSets < 0 ||
          e.adaptationSets > e.sets
        )
          fail();
        seen.add(e.exerciseId);
      }
      if (seen.size > 15) fail();
    }
  }
  if (
    profile.sourceIds.some((id) => !sources.some((s) => s.id === id)) ||
    profile.guidance.sections.some(
      (s) => typeof s.title !== "string" || typeof s.text !== "string",
    )
  )
    fail();
  return profile;
}
