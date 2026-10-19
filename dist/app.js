import {
  STORE_KEY,
  LEGACY_STORE_KEY,
  emptyState,
  validateState,
  validateProfile,
  dayNames,
  isoDate,
  parseDate,
  addDays,
  weekNumber,
  orderedDays,
  validatePreferences,
  scheduleFor,
  workoutKey,
  progressFor,
} from "./core.js";
const $ = (s) => document.querySelector(s);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name, size = 22) => {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',
    chart: '<path d="M4 20V10m8 10V4m8 16v-7"/>',
    settings:
      '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    play: '<path d="m9 5 11 7-11 7Z"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    leaf: '<path d="M20 3C10 2 3 6 4 14c1 8 15 8 16-11ZM5 20 15 9"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
};
let catalog,
  profiles,
  allSources,
  library,
  draftProfileId,
  program,
  exercises,
  sources,
  guidance,
  state = { version: 1, preferences: null, logs: {} },
  storageWarning = "",
  tab = "today",
  selectedDate = isoDate(),
  editing = false,
  draft = null,
  currentExercise = null,
  returnFocus = null,
  timerEnd = 0,
  timerDuration = 0;
const app = $("#app"),
  dialog = $("#exercise-dialog"),
  info = $("#info-dialog");
const dateLabel = (
  date,
  opts = { weekday: "long", day: "numeric", month: "long" },
) => new Intl.DateTimeFormat("pt-BR", opts).format(parseDate(date));
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function activateProfile() {
  program = profiles[library.profileId];
  state = library.plans[library.profileId] || {
    version: 1,
    preferences: null,
    logs: {},
  };
  guidance = program.guidance;
  sources = allSources.filter((s) => program.sourceIds.includes(s.id));
  applyTheme();
}
function applyTheme() {
  const dark =
    library.theme === "dark" ||
    (library.theme === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = dark
    ? "#171622"
    : "#f7f8fc";
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (library) applyTheme();
});
function persist() {
  if (state.preferences) library.plans[library.profileId] = state;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(library));
    storageWarning = "";
  } catch {
    storageWarning =
      "O navegador não conseguiu salvar. Seus registros ficam nesta tela até você fechá-la. Exporte uma cópia em Ajustes.";
    toast(
      "Não foi possível salvar no aparelho. Exporte seus registros em Ajustes.",
    );
  }
  updateStorageBanner();
}
function updateStorageBanner() {
  const b = $("#storage-warning");
  if (b) {
    b.textContent = storageWarning;
    b.hidden = !storageWarning;
  }
}
function todayWorkout() {
  return scheduleFor(selectedDate, state.preferences, program);
}
function getLog(date = selectedDate, w = todayWorkout()) {
  return state.logs[workoutKey(date, w.id)] || { exercises: {} };
}
function ensureLog() {
  const w = todayWorkout(),
    key = workoutKey(selectedDate, w.id);
  state.logs[key] ??= {
    exercises: {},
    prescription: w.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets,
    })),
  };
  return state.logs[key];
}
function brand() {
  return '<a href="#today" class="brand" aria-label="Ritmo, início">ritmo<span aria-hidden="true">✳</span></a>';
}
function nav() {
  return `<nav class="nav" aria-label="Principal">${[
    ["today", "home", "Hoje"],
    ["week", "calendar", "Semana"],
    ["progress", "chart", "Evolução"],
    ["settings", "settings", "Ajustes"],
  ]
    .map(
      ([id, ic, label]) =>
        `<a href="#${id}" class="nav-item ${tab === id ? "active" : ""}" ${tab === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`,
    )
    .join("")}</nav>`;
}
function pageShell(content) {
  app.innerHTML = `<div class="shell"><aside class="sidebar">${brand()}<p class="sidebar-tag">Um treino de cada vez.</p>${nav()}<div class="side-bottom"><span class="local-dot"></span> Seus registros ficam aqui.<button class="text-button" data-action="guide">Sobre o plano ${icon("info", 16)}</button></div></aside><div class="main-shell"><header class="mobile-header">${brand()}<button class="round-button" data-action="guide" aria-label="Sobre o plano">${icon("info")}</button></header><div id="storage-warning" class="warning" role="status" ${storageWarning ? "" : "hidden"}>${escape(storageWarning)}</div><main id="main" tabindex="-1">${content}</main><div class="mobile-nav">${nav()}</div></div></div>`;
}
function startDraft() {
  draftProfileId = library.profileId;
  draft = state.preferences
    ? { ...state.preferences, days: [...state.preferences.days] }
    : {
        frequency: Number(Object.keys(program.sequences)[0]),
        days: [...program.defaults[Object.keys(program.sequences)[0]]],
        startDate: isoDate(),
      };
}
function onboarding() {
  if (!draft) startDraft();
  const selectedProfile = profiles[draftProfileId];
  app.innerHTML = `<main id="main" class="onboarding"><div class="onboard-story">${brand()}<div class="story-content"><p class="eyebrow">SEU PLANO A/B/C</p><h1>Encontre<br>seu ritmo.</h1><p>Escolha seus dias. O treino fica pronto.<br>A evolução vem uma série de cada vez.</p><div class="routine-art" aria-hidden="true">${Object.values(
    selectedProfile.workouts,
  )
    .map(
      (w) =>
        `<div class="art-ticket"><span>${escape(w.id)}</span><div>${escape(w.name)}</div><i>↗</i></div>`,
    )
    .join(
      "",
    )}</div></div><p class="story-foot">Para quem está começando. Com espaço para crescer.</p></div><section class="onboard-form">${storageWarning ? `<p class="warning" role="status">${escape(storageWarning)}</p>` : ""}<span class="small-tag">${editing ? "SUA ROTINA" : "VAMOS COMEÇAR"}</span><h2>${editing ? "Seu plano, do seu jeito." : "Qual é o seu foco?"}</h2><p class="muted">Escolha sua ficha e uma frequência que você consegue manter.</p><form id="preferences-form"><fieldset class="profile-field"><legend>Sua ficha de treino</legend><div class="profile-picker">${Object.values(
    profiles,
  )
    .map(
      (p) =>
        `<button type="button" class="profile-option ${draftProfileId === p.id ? "selected" : ""}" data-action="profile" data-value="${escape(p.id)}" aria-pressed="${draftProfileId === p.id}"><span class="profile-check">${draftProfileId === p.id ? icon("check", 18) : ""}</span><strong>${escape(p.label)}</strong><span>${escape(p.subtitle)}</span></button>`,
    )
    .join(
      "",
    )}</div><p class="form-note">Os nomes indicam o foco da ficha. Escolha pelo seu objetivo. Você pode trocar depois, sem perder os registros.</p></fieldset><fieldset><legend class="sr-only">Dias de academia por semana</legend><div class="frequency">${Object.keys(
    selectedProfile.sequences,
  )
    .map(Number)
    .map(
      (n) =>
        `<button type="button" data-action="frequency" data-value="${n}" class="frequency-option ${draft.frequency === n ? "selected" : ""}" aria-pressed="${draft.frequency === n}"><strong>${n}</strong><span>dias</span></button>`,
    )
    .join(
      "",
    )}</div></fieldset><p class="plan-hint">${escape(selectedProfile.scheduleHints[draft.frequency])}</p><fieldset class="days-field"><legend>Em quais dias?</legend><div class="day-picker">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" data-action="weekday" data-value="${d}" aria-label="${dayNames[d]}" aria-pressed="${draft.days.includes(d)}" class="day-option ${draft.days.includes(d) ? "selected" : ""}">${dayNames[d].slice(0, 3)}</button>`).join("")}</div></fieldset><label class="date-label" for="start-date">${editing ? "Data em que começou o plano" : "Quando você começa?"}</label><input id="start-date" name="startDate" type="date" required value="${draft.startDate}"><p class="form-note">As primeiras ${selectedProfile.adaptationWeeks} semanas têm menos séries para você aprender os movimentos.</p><p id="form-error" class="form-error" role="alert"></p><button class="button primary wide" type="submit">${editing ? "Salvar minha rotina" : "Montar meu treino"} ${icon("arrow")}</button>${editing ? '<button type="button" class="button subtle wide" data-action="cancel-edit">Voltar sem alterar</button>' : ""}</form><p class="privacy-note">Sem cadastro. Sua rotina e suas cargas ficam neste navegador. Você pode exportar uma cópia depois.</p><button class="text-button" data-action="guide">Conhecer o plano e suas fontes ${icon("arrow", 16)}</button></section></main>`;
}
function weekStrip() {
  const start = addDays(
    selectedDate,
    -((parseDate(selectedDate).getDay() + 6) % 7),
  );
  return `<div class="week-strip" aria-label="Dias desta semana">${Array.from(
    { length: 7 },
    (_, i) => {
      const d = addDays(start, i),
        w = scheduleFor(d, state.preferences, program),
        p = progressFor(w, getLog(d, w));
      return `<button class="week-day ${d === selectedDate ? "selected" : ""} ${d === isoDate() ? "is-today" : ""}" data-action="date" data-value="${d}" aria-label="${dateLabel(d)}: ${w.name}" aria-pressed="${d === selectedDate}"><span>${dayNames[parseDate(d).getDay()].slice(0, 3)}</span><strong>${parseDate(d).getDate()}</strong><i class="day-dot ${p.total && p.done === p.total ? "complete" : w.id !== "rest" ? "planned" : ""}"></i></button>`;
    },
  ).join("")}</div>`;
}
function exerciseCard(e, index) {
  const x = exercises[e.exerciseId],
    log = getLog().exercises?.[e.exerciseId],
    done = Array.from(
      { length: e.sets },
      (_, i) => log?.sets?.[i]?.done,
    ).filter(Boolean).length;
  return `<button class="exercise-card ${done === e.sets ? "finished" : ""}" data-action="exercise" data-value="${e.exerciseId}"><div class="exercise-thumb">${x.media?.youtubeId ? `<img src="https://i.ytimg.com/vi/${x.media.youtubeId}/mqdefault.jpg" alt="" width="120" height="90" loading="lazy"><span class="thumb-play">${icon("play", 13)}</span>` : `<span class="movement-mark">${String(index + 1).padStart(2, "0")}</span>`}</div><div class="exercise-card-copy"><span class="exercise-order">${e.extra ? "COMPLEMENTO" : `EXERCÍCIO ${String(index + 1).padStart(2, "0")}`}</span><h3>${escape(x.name)}</h3><p>${e.sets} ${e.sets === 1 ? "série" : "séries"} <span>·</span> ${escape(e.reps)} ${x.measurement === "seconds" ? "" : "reps"}</p></div><span class="exercise-status">${done === e.sets ? icon("check") : icon("chevron", 18)}<small>${done}/${e.sets}</small></span></button>`;
}
function dayPage() {
  const w = todayWorkout(),
    p = progressFor(w, getLog()),
    tom = scheduleFor(addDays(selectedDate, 1), state.preferences, program),
    future = selectedDate > isoDate(),
    isToday = selectedDate === isoDate();
  return `<div class="page-heading"><div><p class="eyebrow">${dateLabel(selectedDate, { weekday: "long", day: "numeric", month: "long" })}</p><h1>${isToday ? "Seu treino de hoje." : selectedDate === addDays(isoDate(), 1) ? "Um olhar para amanhã." : "Seu treino, dia a dia."}</h1></div><button class="round-button desktop-info" data-action="guide" aria-label="Sobre o plano">${icon("info")}</button></div>${weekStrip()}<div class="dashboard-grid"><div class="training-column"><section class="workout-hero ${w.id === "rest" ? "recovery" : w.id === "cardio" ? "cardio" : ""}"><div class="hero-top"><span class="pill">SEMANA ${w.week} ${w.week <= program.durationWeeks ? `/ ${program.durationWeeks}` : ""}</span><span class="hero-phase">${w.adaptation ? "Adaptação" : "Treino base"}</span></div><span class="hero-letter" aria-hidden="true">${Object.hasOwn(program.workouts, w.id) ? w.id : w.id === "rest" ? "✳" : "↗"}</span><div class="hero-copy"><p>${Object.hasOwn(program.workouts, w.id) ? `TREINO ${w.id}` : w.id === "rest" ? "RECUPERAÇÃO" : "CONDICIONAMENTO"}</p><h2>${w.name}</h2><div class="hero-meta">${icon("clock", 17)}<span>${w.minutes ? `${w.minutes} min${w.exercises.some((e) => e.extra) ? " + complemento" : ""}` : w.id === "cardio" ? `${w.adaptation ? program.cardio.adaptationMinutes : program.cardio.baseMinutes} min` : "Sem pressa hoje"}</span>${w.exercises.length ? `<span class="meta-dot">·</span><span>${w.exercises.length} exercícios</span>` : ""}</div></div></section>${w.exercises.length ? `<div class="session-progress"><span>${p.done === p.total ? "Treino concluído" : future ? "Veja o que está programado" : "Seu progresso neste treino"}</span><b>${p.done}/${p.total} séries</b><div class="progress-track"><div style="width:${Math.round((p.done / p.total) * 100)}%"></div></div></div><div class="section-title"><h2>Seu passo a passo</h2><span>Toque para começar</span></div><div class="exercise-list">${w.exercises.map(exerciseCard).join("")}</div>` : w.id === "cardio" ? cardioPanel(future) : `<section class="plain-card recovery-copy">${icon("leaf", 32)}<h2>O descanso faz parte.</h2><p>Uma caminhada leve cabe aqui, se você quiser. Guarde energia para a próxima sessão e mantenha sua rotina de sono.</p><button class="button secondary" data-action="next-workout">Ver próximo treino ${icon("arrow")}</button></section>`}</div><aside class="day-aside"><section class="tip-card"><span class="tip-icon">${icon(w.adaptation ? "info" : "check")}</span><p class="eyebrow">${w.adaptation ? "COMECE COM CONTROLE" : "QUALIDADE ANTES DA CARGA"}</p><h3>${w.adaptation ? "Aprenda o movimento." : "Deixe algumas na reserva."}</h3><p>${w.adaptation ? "As séries já estão reduzidas. Termine cada uma sentindo que conseguiria fazer mais " + program.adaptationRir + " repetições bem executadas." : "Termine cada série com cerca de " + program.baseRir + " repetições em reserva. Aumente a carga quando completar a faixa com boa técnica."}</p><button class="text-button" data-action="guide">Como evoluir ${icon("arrow", 16)}</button></section><button class="tomorrow-card" data-action="date" data-value="${addDays(selectedDate, 1)}"><span class="eyebrow">${isToday ? "AMANHÃ" : "NO DIA SEGUINTE"}</span><div><span class="next-letter">${Object.hasOwn(program.workouts, tom.id) ? tom.id : tom.id === "cardio" ? "↗" : "✳"}</span><h3>${tom.name}</h3>${icon("arrow")}</div></button><div class="warmup-note">${icon("clock", 18)}<p><b>Antes de começar</b><br>5-8 minutos leves e séries de preparação. Peça ao instrutor para conferir os ajustes.</p></div><p class="small-disclaimer">${escape(program.audience)} Plano educativo. Revise com o instrutor se houver dor, lesão ou condição que exija adaptação.</p></aside></div>`;
}
function cardioPanel(future) {
  const log = getLog();
  return `<section class="plain-card"><h2>Respiração mais rápida.<br>Conversa ainda possível.</h2><p>${escape(program.cardio.text)}</p><label for="cardio-minutes">Quantos minutos você fez?</label><input id="cardio-minutes" type="number" inputmode="numeric" min="1" max="300" value="${log.minutes || ""}" placeholder="Ex.: 25" ${future ? "disabled" : ""}><button class="button primary wide" data-action="complete-cardio" ${future ? "disabled" : ""}>${log.completed ? "Atualizar cardio" : "Registrar cardio"} ${icon("check")}</button>${log.completed ? '<button class="text-button" data-action="undo-cardio">Desmarcar cardio</button>' : ""}${future ? '<p class="muted">O registro fica disponível no dia do treino.</p>' : ""}</section>`;
}
function weekPage() {
  const start = addDays(
    selectedDate,
    -((parseDate(selectedDate).getDay() + 6) % 7),
  );
  return `<div class="page-heading"><div><p class="eyebrow">${state.preferences.frequency} DIAS DE ACADEMIA</p><h1>Uma semana possível.</h1></div></div><div class="week-navigation"><button class="round-button" data-action="week-shift" data-value="-7" aria-label="Semana anterior">←</button><p>${dateLabel(start, { day: "numeric", month: "short" })} a ${dateLabel(addDays(start, 6), { day: "numeric", month: "short" })}</p><button class="round-button" data-action="week-shift" data-value="7" aria-label="Próxima semana">→</button></div><div class="schedule-list">${Array.from(
    { length: 7 },
    (_, i) => {
      const d = addDays(start, i),
        w = scheduleFor(d, state.preferences, program),
        p = progressFor(w, getLog(d, w));
      return `<button class="schedule-row ${d === isoDate() ? "today-row" : ""}" data-action="date" data-value="${d}"><div class="schedule-date"><span>${dayNames[parseDate(d).getDay()].slice(0, 3)}</span><b>${parseDate(d).getDate()}</b></div><span class="schedule-letter ${w.id === "rest" ? "rest" : ""}">${w.id === "rest" ? "✳" : w.id === "cardio" ? "↗" : w.id}</span><div><h2>${w.name}</h2><p>${d === isoDate() ? "Hoje · " : ""}${p.total && p.done === p.total ? "Concluído" : w.id === "rest" ? "Caminhada opcional" : w.id === "cardio" ? "Cardio moderado" : `${w.exercises.length} exercícios · ${w.adaptation ? "adaptação" : "base"}`}</p></div>${icon("chevron", 18)}</button>`;
    },
  ).join(
    "",
  )}</div><section class="plain-card compact"><h2>Faltou um dia?</h2><p>${escape(program.recoveryNote)} Se a rotina mudou, ajuste os dias da semana.</p><button class="button secondary" data-action="edit-plan">Ajustar minha rotina ${icon("arrow")}</button></section>`;
}
function progressPage() {
  const records = Object.entries(state.logs)
    .filter(
      ([, l]) =>
        l.completed ||
        Object.values(l.exercises || {}).some((e) =>
          e.sets?.some((s) => s.done),
        ),
    )
    .sort(([a], [b]) => b.localeCompare(a));
  let sessions = 0,
    sets = 0;
  for (const [, log] of records) {
    const done = Object.values(log.exercises || {})
      .flatMap((e) => e.sets || [])
      .filter((s) => s.done).length;
    sets += done;
    const total = log.prescription?.reduce((n, e) => n + e.sets, 0);
    if (log.completed || (total && done >= total)) sessions++;
  }
  return `<div class="page-heading"><div><p class="eyebrow">O QUE VOCÊ JÁ FEZ</p><h1>Cada série conta.</h1></div></div><div class="stats"><section><strong>${sessions}</strong><span>sessões concluídas</span></section><section><strong>${sets}</strong><span>séries registradas</span></section><section><strong>${Math.min(program.durationWeeks, weekNumber(isoDate(), state.preferences.startDate))}</strong><span>semana do plano</span></section></div><div class="section-title"><h2>Seu histórico</h2><span>Ficha ${escape(program.label.toLowerCase())}</span></div>${
    records.length
      ? `<div class="history-list">${records
          .map(([key, log]) => {
            const [date, id] = key.split(":");
            const labels = Object.entries(log.exercises || {})
              .filter(([, e]) => e.sets?.some((s) => s.done))
              .map(
                ([id, e]) =>
                  `${escape(exercises[id]?.name || id)}: ${e.sets
                    .filter((s) => s.done)
                    .map(
                      (s) =>
                        `${escape(s.weight) || "sem carga anotada"}${s.weight ? " kg" : ""}${s.reps ? " / " + escape(s.reps) + " reps" : ""}`,
                    )
                    .join(" · ")}`,
              );
            return `<details class="history-item"><summary><span class="history-letter">${id === "cardio" ? "↗" : id}</span><div><b>${dateLabel(date, { day: "numeric", month: "long" })}</b><p>${id === "cardio" ? "Cardio" : program.workouts[id]?.name}</p></div>${icon("chevron", 18)}</summary><div class="history-detail">${id === "cardio" ? `<p>${log.minutes || 0} minutos registrados.</p>` : labels.map((s) => `<p>${s}</p>`).join("")}</div></details>`;
          })
          .join("")}</div>`
      : `<section class="empty-state">${icon("chart", 44)}<h2>Seu primeiro registro começa no treino.</h2><p>Abra um exercício e marque cada série feita. Anote a carga para comparar nas próximas semanas.</p><a class="button primary" href="#today">Ir para o treino ${icon("arrow")}</a></section>`
  }<p class="small-disclaimer">Cargas de máquinas diferentes não são comparáveis. Força, frequência e recuperação ajudam a avaliar o progresso; estes registros não medem perda de gordura ou ganho muscular.</p>`;
}
function settingsPage() {
  return `<div class="page-heading"><div><p class="eyebrow">DO SEU JEITO</p><h1>A sua rotina.</h1></div></div><section class="settings-card"><span class="eyebrow">FICHA ${escape(program.label.toUpperCase())}</span><p>${escape(program.subtitle)}</p><h2>${state.preferences.frequency} dias por semana</h2><p>${orderedDays(
    state.preferences.days,
  )
    .map((d) => dayNames[d])
    .join(
      ", ",
    )}.</p><p class="muted">Início em ${dateLabel(state.preferences.startDate, { day: "numeric", month: "long", year: "numeric" })}.</p><button class="button primary" data-action="edit-plan">Alterar ficha e dias ${icon("arrow")}</button></section><section class="settings-card"><span class="eyebrow">APARÊNCIA</span><h2>Uma luz para cada ambiente.</h2><p>Escolha um tema ou acompanhe a aparência do aparelho.</p><div class="theme-picker" role="group" aria-label="Tema">${[
    ["light", "Claro"],
    ["dark", "Escuro"],
    ["system", "Automático"],
  ]
    .map(
      ([id, label]) =>
        `<button class="theme-option ${library.theme === id ? "selected" : ""}" data-action="theme" data-value="${id}" aria-pressed="${library.theme === id}"><span class="theme-swatch ${id}" aria-hidden="true"></span>${label}</button>`,
    )
    .join(
      "",
    )}</div></section><section class="settings-card"><h2>Seus registros ficam com você.</h2><p>As cargas e séries são salvas neste navegador. Limpar os dados do site ou trocar de celular não transfere o histórico. Em uma aba privada, ele pode desaparecer ao fechar.</p><div class="button-row"><button class="button secondary" data-action="export">${icon("download", 18)} Exportar cópia</button><label class="button secondary file-label">Importar cópia<input id="import-file" type="file" accept="application/json,.json" class="sr-only"></label></div><p class="form-note">A cópia inclui todas as fichas, seus históricos e o tema. A importação substitui esses dados após sua confirmação.</p></section><section class="settings-card"><h2>Leve o Ritmo para a tela inicial.</h2><p>No iPhone, abra no Safari, toque em Compartilhar e em “Adicionar à Tela de Início”. No Android, abra o menu do navegador e procure “Instalar app” ou “Adicionar à tela inicial”.</p><p class="muted">Depois do primeiro acesso completo, a ficha pode abrir sem internet. Os vídeos e suas imagens precisam de conexão.</p></section><section class="settings-card"><h2>Por trás do plano</h2><p>${sources.length} fontes nesta ficha, adaptação inicial e ${program.durationWeeks} semanas para construir uma rotina.</p><button class="text-button" data-action="guide">Ler orientações e fontes ${icon("arrow", 18)}</button><button class="text-button danger" data-action="reset">Apagar meus registros deste aparelho</button></section>`;
}
function render() {
  activateProfile();
  if (!state.preferences || editing) {
    onboarding();
    return;
  }
  pageShell(
    (
      {
        today: dayPage,
        week: weekPage,
        progress: progressPage,
        settings: settingsPage,
      }[tab] || dayPage
    )(),
  );
}
function syncHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const raw = location.hash.slice(1).split("?")[0];
  tab = ["today", "week", "progress", "settings"].includes(raw) ? raw : "today";
  const date = new URLSearchParams(location.hash.split("?")[1] || "").get(
    "date",
  );
  if (
    date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    isoDate(parseDate(date)) === date
  )
    selectedDate = date;
  else if (tab === "today") selectedDate = isoDate();
  render();
}
function selectDate(date) {
  selectedDate = date;
  tab = "today";
  const target = `#today?date=${date}`;
  if (location.hash === target) render();
  else location.hash = target;
  window.scrollTo({ top: 0, behavior: "instant" });
}
function lastWeight(id, index) {
  const entries = Object.entries(state.logs)
    .filter(([k]) => k.split(":")[0] < selectedDate)
    .sort(([a], [b]) => b.localeCompare(a));
  for (const [, l] of entries) {
    const s = l.exercises?.[id]?.sets?.[index];
    if (s?.weight) return s.weight;
  }
  return "";
}
function openExercise(id) {
  const w = todayWorkout(),
    entry = w.exercises.find((e) => e.exerciseId === id);
  if (!entry) return;
  currentExercise = id;
  returnFocus = document.activeElement;
  const x = exercises[id],
    log = getLog().exercises?.[id],
    future = selectedDate > isoDate(),
    media = x.media;
  dialog.innerHTML = `<div class="dialog-top"><span class="eyebrow">TREINO ${w.id} · ${entry.sets} ${entry.sets === 1 ? "SÉRIE" : "SÉRIES"}</span><button class="round-button" data-action="close-exercise" aria-label="Fechar exercício">${icon("close")}</button></div><h2 id="exercise-title">${escape(x.name)}</h2><p class="exercise-prescription">${escape(entry.reps)} ${x.measurement === "seconds" ? "" : "repetições"} <span>·</span> ${escape(entry.restLabel)} de pausa</p>${media?.youtubeId ? `<div id="media-player" class="video-frame"><button class="video-launch" data-action="play-video" aria-label="Reproduzir demonstração de ${escape(x.name)}"><img src="https://i.ytimg.com/vi/${media.youtubeId}/hqdefault.jpg" width="480" height="360" alt="Demonstração de ${escape(x.name)}"><span class="play-circle">${icon("play", 30)}</span><span class="video-caption">Ver execução</span></button></div><div class="video-attribution"><span>${escape(media.channel)}${media.language === "en" ? " · vídeo em inglês" : ""}</span><a href="${escape(media.url)}" target="_blank" rel="noopener noreferrer">Abrir no YouTube ↗</a></div>${media.matchNotes ? `<p class="form-note">${escape(media.matchNotes)}</p>` : ""}` : '<div class="media-unavailable">A demonstração está em revisão. Peça ao instrutor para conferir a execução.</div>'}<div class="technique"><h3>Preste atenção</h3><p>${escape(x.cue)}</p><p class="form-note">Use uma carga que deixe ${w.adaptation ? program.adaptationRir : program.baseRir} repetições em reserva. Pare se houver dor aguda ou articular.</p></div><div class="sets-heading"><h3>Suas séries</h3><span>${future ? "Disponível no dia do treino" : "Carga por halter, quando houver"}</span></div><div class="sets-table"><div class="sets-labels"><span>Série</span><span>Carga (kg)</span><span>${x.measurement === "seconds" ? "Tempo (s)" : "Reps"}</span><span>Feita</span></div>${Array.from(
    { length: entry.sets },
    (_, i) => {
      const s = log?.sets?.[i] || {},
        prev = lastWeight(id, i);
      return `<div class="set-row ${s.done ? "done" : ""}"><b>${i + 1}</b><input aria-label="Carga da série ${i + 1} em quilos" name="weight-${i}" data-field="weight" data-index="${i}" type="text" inputmode="decimal" maxlength="8" value="${escape(s.weight || "")}" placeholder="${prev ? escape(prev) : "0"}" ${future ? "disabled" : ""}><input aria-label="${x.measurement === "seconds" ? "Segundos" : "Repetições"} da série ${i + 1}" name="reps-${i}" data-field="reps" data-index="${i}" type="text" inputmode="numeric" maxlength="8" value="${escape(s.reps || "")}" placeholder="${escape(entry.reps.split(" ")[0])}" ${future ? "disabled" : ""}><button class="set-check ${s.done ? "checked" : ""}" aria-label="${s.done ? "Desmarcar" : "Concluir"} série ${i + 1}" aria-pressed="${!!s.done}" data-action="toggle-set" data-index="${i}" ${future ? "disabled" : ""}>${icon("check", 20)}</button></div>`;
    },
  ).join(
    "",
  )}</div><p class="form-note">A carga em cinza, quando aparece, é uma referência do treino anterior. Digite para registrá-la hoje. ${escape(x.recordNote)}</p><button class="button secondary wide" data-action="rest" data-value="${entry.restSeconds}">${icon("clock", 18)} Iniciar descanso · ${entry.restLabel}</button><div id="dialog-timer" hidden></div><button class="button primary wide" data-action="next-exercise">${w.exercises.findIndex((e) => e.exerciseId === id) === w.exercises.length - 1 ? "Voltar ao treino" : "Próximo exercício"} ${icon("arrow")}</button>`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
function closeExercise() {
  const id = currentExercise;
  dialog.close();
  dialog.innerHTML = "";
  currentExercise = null;
  render();
  document
    .querySelector(`[data-action="exercise"][data-value="${id}"]`)
    ?.focus();
}
function saveSet(index, field, value) {
  if (selectedDate > isoDate()) return;
  const log = ensureLog();
  log.exercises ??= {};
  log.exercises[currentExercise] ??= { sets: [] };
  log.exercises[currentExercise].sets[index] ??= {
    done: false,
    weight: "",
    reps: "",
  };
  log.exercises[currentExercise].sets[index][field] = value;
  persist();
}
function showGuide() {
  const preview =
    draft && (!state.preferences || editing)
      ? profiles[draftProfileId]
      : program;
  const guidance = preview.guidance,
    sources = allSources.filter((s) => preview.sourceIds.includes(s.id));
  returnFocus = document.activeElement;
  info.innerHTML = `<div class="dialog-top"><span class="eyebrow">SOBRE O PLANO</span><button class="round-button" data-action="close-info" aria-label="Fechar orientações">${icon("close")}</button></div><h2 id="info-title">Ficha ${escape(preview.label.toLowerCase())}.</h2><div class="guide-content">${guidance.sections.map((s) => `<h3>${escape(s.title)}</h3><p>${escape(s.text)}</p>`).join("")}<h3>Fontes da pesquisa</h3><p>Consultadas em ${dateLabel(preview.researchDate, { day: "numeric", month: "long", year: "numeric" })}. A divisão exata das fichas é uma aplicação prática das evidências.</p><ol class="source-list">${sources.map((s) => `<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a></li>`).join("")}</ol></div>`;
  info.showModal();
}
function timerPaint() {
  if (!timerEnd) return;
  const seconds = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
  $("#timer").hidden = false;
  $("#timer").innerHTML =
    `<div><span>${seconds ? "DESCANSO" : "PAUSA CONCLUÍDA"}</span><b>${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}</b></div><button class="round-button" data-action="stop-timer" aria-label="Encerrar cronômetro">${icon("close", 18)}</button>`;
  const inline = $("#dialog-timer");
  if (inline) {
    inline.hidden = false;
    inline.className = "inline-timer";
    inline.innerHTML = `<div>${seconds ? "Descanso" : "Pausa concluída"}</div><span>${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}</span><button data-action="stop-timer">Encerrar</button>`;
  }
  if (!seconds && !timerPaint.announced) {
    toast("Pausa concluída. Continue quando tiver recuperado o fôlego.");
    timerPaint.announced = true;
  }
}
setInterval(timerPaint, 500);
document.addEventListener("click", async (event) => {
  const b = event.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (
    action === "theme" &&
    ["light", "dark", "system"].includes(b.dataset.value)
  ) {
    library.theme = b.dataset.value;
    persist();
    render();
    document
      .querySelector(
        '[data-action="theme"][data-value="' + library.theme + '"]',
      )
      ?.focus();
  }
  if (action === "profile" && Object.hasOwn(profiles, b.dataset.value)) {
    draftProfileId = b.dataset.value;
    const saved = library.plans[draftProfileId]?.preferences,
      profile = profiles[draftProfileId];
    draft = saved
      ? { ...saved, days: [...saved.days] }
      : {
          frequency: Number(Object.keys(profile.sequences)[0]),
          days: [...profile.defaults[Object.keys(profile.sequences)[0]]],
          startDate: isoDate(),
        };
    onboarding();
    document
      .querySelector(
        '[data-action="profile"][data-value="' + draftProfileId + '"]',
      )
      ?.focus();
  }
  if (action === "frequency") {
    draft.frequency = Number(b.dataset.value);
    draft.days = [...profiles[draftProfileId].defaults[draft.frequency]];
    onboarding();
  }
  if (action === "weekday") {
    const d = Number(b.dataset.value);
    draft.days = draft.days.includes(d)
      ? draft.days.filter((v) => v !== d)
      : [...draft.days, d];
    onboarding();
  }
  if (action === "date") selectDate(b.dataset.value);
  if (action === "week-shift") {
    selectedDate = addDays(selectedDate, Number(b.dataset.value));
    render();
  }
  if (action === "next-workout") {
    const base =
      selectedDate < state.preferences.startDate
        ? addDays(state.preferences.startDate, -1)
        : selectedDate;
    for (let i = 1; i <= 14; i++) {
      const d = addDays(base, i);
      if (scheduleFor(d, state.preferences, program).id !== "rest") {
        selectDate(d);
        break;
      }
    }
  }
  if (action === "edit-plan") {
    editing = true;
    startDraft();
    render();
    window.scrollTo(0, 0);
  }
  if (action === "cancel-edit") {
    editing = false;
    draft = null;
    render();
  }
  if (action === "exercise") openExercise(b.dataset.value);
  if (action === "close-exercise") closeExercise();
  if (action === "guide") showGuide();
  if (action === "close-info") {
    info.close();
    returnFocus?.isConnected && returnFocus.focus();
  }
  if (action === "play-video") {
    const x = exercises[currentExercise];
    $("#media-player").innerHTML =
      `<iframe src="https://www.youtube-nocookie.com/embed/${x.media.youtubeId}?playsinline=1&rel=0&cc_load_policy=1" title="Demonstração: ${escape(x.name)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }
  if (action === "toggle-set") {
    if (
      ![...b.closest(".set-row").querySelectorAll("input")].every((input) =>
        input.reportValidity(),
      )
    )
      return;
    const i = Number(b.dataset.index),
      done = !getLog().exercises?.[currentExercise]?.sets?.[i]?.done;
    saveSet(i, "done", done);
    b.classList.toggle("checked", done);
    b.setAttribute("aria-pressed", String(done));
    b.setAttribute(
      "aria-label",
      `${done ? "Desmarcar" : "Concluir"} série ${i + 1}`,
    );
    b.closest(".set-row").classList.toggle("done", done);
    toast(done ? "Série registrada." : "Série desmarcada.");
  }
  if (action === "next-exercise") {
    const list = todayWorkout().exercises,
      index = list.findIndex((e) => e.exerciseId === currentExercise);
    if (index < list.length - 1) openExercise(list[index + 1].exerciseId);
    else closeExercise();
  }
  if (action === "rest") {
    timerDuration = Number(b.dataset.value);
    timerEnd = Date.now() + timerDuration * 1000;
    timerPaint.announced = false;
    timerPaint();
    toast("Descanso iniciado.");
  }
  if (action === "stop-timer") {
    timerEnd = 0;
    $("#timer").hidden = true;
    if ($("#dialog-timer")) $("#dialog-timer").hidden = true;
  }
  if (action === "complete-cardio") {
    if (selectedDate > isoDate()) return;
    const mins = Number($("#cardio-minutes").value);
    if (!Number.isFinite(mins) || mins < 1 || mins > 300) {
      toast("Informe um tempo entre 1 e 300 minutos.");
      $("#cardio-minutes").focus();
      return;
    }
    Object.assign(ensureLog(), { completed: true, minutes: mins });
    persist();
    render();
    toast("Cardio registrado.");
  }
  if (action === "undo-cardio") {
    ensureLog().completed = false;
    persist();
    render();
    toast("Cardio desmarcado.");
  }
  if (action === "export") {
    const blob = new Blob([JSON.stringify(library, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `ritmo-${isoDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Cópia preparada para download.");
  }
  if (
    action === "reset" &&
    confirm(
      "Apagar a rotina e todo o histórico do Ritmo neste navegador? Exporte uma cópia antes, se quiser guardar seus registros.",
    )
  ) {
    library = emptyState(catalog.defaultProfileId);
    activateProfile();
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(LEGACY_STORE_KEY);
    } catch {}
    draft = null;
    timerEnd = 0;
    $("#timer").hidden = true;
    render();
    toast("Registros apagados.");
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "preferences-form") return;
  e.preventDefault();
  draft.startDate = $("#start-date").value;
  const error = validatePreferences(draft, profiles[draftProfileId]);
  if (error) {
    $("#form-error").textContent = error;
    $("#form-error").setAttribute("tabindex", "-1");
    $("#form-error").focus();
    return;
  }
  library.profileId = draftProfileId;
  activateProfile();
  state.preferences = { ...draft, days: orderedDays(draft.days) };
  persist();
  editing = false;
  draft = null;
  tab = "today";
  selectedDate = isoDate();
  location.hash = "today";
  render();
  window.scrollTo(0, 0);
  toast("Sua rotina está pronta.");
});
document.addEventListener("input", (e) => {
  if (e.target.id === "start-date" && draft) draft.startDate = e.target.value;
  if (e.target.matches("[data-field]")) {
    const field = e.target.dataset.field,
      raw = e.target.value;
    if (raw && !/^\d{0,4}([.,]\d{0,2})?$/.test(raw)) {
      e.target.setCustomValidity("Use apenas números, como 12 ou 12,5.");
      return;
    }
    e.target.setCustomValidity("");
    saveSet(Number(e.target.dataset.index), field, raw);
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "import-file") return;
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024)
      throw new Error("Escolha uma cópia de até 2 MB.");
    const restored = validateState(
      JSON.parse(await file.text()),
      profiles,
      catalog.defaultProfileId,
    );
    if (
      confirm("Substituir sua rotina e seu histórico pela cópia selecionada?")
    ) {
      library = restored;
      activateProfile();
      draft = null;
      editing = false;
      persist();
      render();
      toast("Cópia importada.");
    }
  } catch (err) {
    toast(
      err instanceof SyntaxError
        ? "Não foi possível ler esse JSON. Escolha uma cópia exportada pelo Ritmo."
        : err.message,
    );
  }
  e.target.value = "";
});
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeExercise();
});
window.addEventListener("hashchange", () => {
  if (dialog.open) closeExercise();
  syncHash();
});
window.addEventListener("storage", (e) => {
  if (e.key !== STORE_KEY) return;
  try {
    if (e.newValue)
      library = validateState(
        JSON.parse(e.newValue),
        profiles,
        catalog.defaultProfileId,
      );
    else library = emptyState(catalog.defaultProfileId);
    draft = null;
    editing = false;
    activateProfile();
    if (dialog.open) closeExercise();
    render();
    toast("Registros atualizados em outra aba.");
  } catch {}
});
try {
  const loadJson = async (path) => {
    const r = await fetch(path);
    if (!r.ok) throw new Error("Conteúdo indisponível");
    return r.json();
  };
  [catalog, exercises, allSources] = await Promise.all(
    ["profiles", "exercises", "sources"].map((name) =>
      loadJson("./data/" + name + ".json"),
    ),
  );
  if (
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.profiles) ||
    !catalog.profiles.length
  )
    throw new Error("Catálogo inválido");
  profiles = Object.fromEntries(
    await Promise.all(
      catalog.profiles.map(async (entry) => {
        if (!/^\.\/data\/profiles\/[a-z][a-z0-9-]*\.json$/.test(entry.file))
          throw new Error("Caminho de ficha inválido");
        const p = validateProfile(
          await loadJson(entry.file),
          exercises,
          allSources,
        );
        if (p.id !== entry.id)
          throw new Error("Identificação de ficha inválida");
        return [p.id, p];
      }),
    ),
  );
  if (
    !Object.hasOwn(profiles, catalog.defaultProfileId) ||
    Object.keys(profiles).length !== catalog.profiles.length
  )
    throw new Error("Catálogo inválido");
  library = emptyState(catalog.defaultProfileId);
  try {
    const saved = localStorage.getItem(STORE_KEY),
      legacy = !saved && localStorage.getItem(LEGACY_STORE_KEY);
    if (saved || legacy)
      library = validateState(
        JSON.parse(saved || legacy),
        profiles,
        catalog.defaultProfileId,
      );
    activateProfile();
    if (legacy) persist();
  } catch {
    storageWarning =
      "Os dados salvos não puderam ser lidos. Você pode importar uma cópia em Ajustes ou montar uma nova rotina.";
  }
  activateProfile();
  syncHash();
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("./sw.js").catch(() => {});
} catch {
  app.innerHTML = `<main class="empty-state"><h1>O treino não carregou.</h1><p>Confira a conexão e tente novamente. Seus registros salvos não foram alterados.</p><button class="button primary" id="reload">Tentar novamente</button></main>`;
  $("#reload").addEventListener("click", () => location.reload());
}
