export const STORE_KEY = "ritmo:v1";
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
  if (!p || ![3, 4, 5].includes(p.frequency)) return "Escolha 3, 4 ou 5 dias.";
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
    seq = program.sequences[p.frequency],
    a = days[seq.indexOf("A")],
    c = days[seq.indexOf("C")],
    gap = (c - a + 7) % 7;
  if (gap < 2 || gap > 5)
    return "Deixe pelo menos um dia entre A e C, inclusive na virada da semana. Escolha outros dias.";
  return "";
}
export function scheduleFor(date, p, program) {
  const week = weekNumber(date, p.startDate),
    adaptation = week <= 2;
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
  if (id === "C" && p.frequency === 3)
    exercises.push(
      ...program.extraUpper.map((e) => ({
        ...e,
        sets: adaptation ? 1 : e.sets,
        extra: true,
      })),
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
    Object.values(program.workouts).flatMap((w) =>
      w.exercises.map((e) => e.exerciseId),
    ),
  );
  const logs = {};
  for (const [key, log] of Object.entries(value.logs)) {
    if (
      !/^\d{4}-\d{2}-\d{2}:(A|B|C|cardio)$/.test(key) ||
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
          done: s.done === true,
          weight: String(s.weight ?? "").slice(0, 8),
          reps: String(s.reps ?? "").slice(0, 8),
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
