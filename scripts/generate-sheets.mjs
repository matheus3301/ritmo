import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  scheduleFor,
  addDays,
  dayNames,
  validateProfile,
} from "../dist/core.js";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const catalog = read("dist/data/profiles.json"),
  exercises = read("dist/data/exercises.json"),
  sources = read("dist/data/sources.json");
mkdirSync("docs/fichas", { recursive: true });
for (const entry of catalog.profiles) {
  const p = validateProfile(read("dist/" + entry.file), exercises, sources);
  let text = `# Ficha ${p.label.toLowerCase()}\n\n${p.subtitle}. ${p.audience}\n\nGerada de [${p.id}.json](../../dist/data/profiles/${p.id}.json) por \`npm run sheets\`. Pesquisa: ${p.researchDate}. Revise com o profissional da academia.\n\n`;
  text += `## Como usar\n\n${p.adaptationWeeks} semanas iniciais com séries reduzidas e ${p.adaptationRir} repetições em reserva. Depois, ficha base com cerca de ${p.baseRir} em reserva, se estiver recuperando bem. Aquecimento: 5-8 minutos leves e séries preparatórias, que não entram na contagem.\n\n${p.recoveryNote}\n\n`;
  for (const n of Object.keys(p.sequences).map(Number)) {
    const prefs = {
      frequency: n,
      days: p.defaults[n],
      startDate: "2026-10-19",
    };
    const base = Array.from({ length: 7 }, (_, i) =>
      scheduleFor(addDays("2026-11-02", i), prefs, p),
    );
    const adaptation = Array.from({ length: 7 }, (_, i) =>
      scheduleFor(addDays("2026-10-19", i), prefs, p),
    );
    text += `## ${n} dias por semana\n\n${p.scheduleHints[n]}\n\n| Dia sugerido | Sessão |\n| --- | --- |\n`;
    base.forEach((w, i) => {
      text += `| ${dayNames[(i + 1) % 7]} | ${w.id === "rest" ? "Descanso" : w.id === "cardio" ? "Cardio moderado" : w.id + " · " + w.name} |\n`;
    });
    for (const id of [...new Set(p.sequences[n])]) {
      if (id === "cardio") {
        text += `\n### Cardio\n\n${p.cardio.adaptationMinutes} min na adaptação; ${p.cardio.baseMinutes} min na base. ${p.cardio.text}\n`;
        continue;
      }
      const w = base.find((w) => w.id === id),
        a = adaptation.find((w) => w.id === id);
      text += `\n### ${id} · ${w.name}\n\nDuração estimada: ${w.minutes} min${w.exercises.some((e) => e.extra) ? ", mais o complemento de superiores" : ""}.\n\n| Exercício e demonstração | Séries: adaptação → base | Repetições / tempo | Pausa |\n| --- | --- | --- | --- |\n`;
      for (const e of w.exercises) {
        const x = exercises[e.exerciseId];
        text += `| [${x.name}](${x.media.url})${e.extra ? " (complemento)" : ""} | ${a.exercises.find((v) => v.exerciseId === e.exerciseId)?.sets || 0} → ${e.sets} | ${e.reps} | ${e.restLabel} |\n`;
      }
    }
    const volume = {};
    for (const w of base)
      for (const e of w.exercises)
        for (const group of exercises[e.exerciseId].volumeGroups)
          volume[group] = (volume[group] || 0) + e.sets;
    text +=
      "\n### Volume semanal da fase base\n\nSéries direcionadas aos grupos principais conforme a classificação editorial `volumeGroups` de cada exercício. Um movimento pode ter mais de um grupo principal. A tabela não soma participação indireta, não mede estímulo individual e não é uma conta de “séries efetivas”.\n\n| Grupo | Séries por semana |\n| --- | ---: |\n";
    for (const [group, sets] of Object.entries(volume))
      text += `| ${group} | ${sets} |\n`;
  }
  text +=
    "\n## Orientações\n\n" +
    p.guidance.sections.map((s) => `### ${s.title}\n\n${s.text}\n`).join("\n");
  text +=
    "\n## Fontes\n\n" +
    sources
      .filter((s) => p.sourceIds.includes(s.id))
      .map((s) => `- [${s.title}](${s.url}) ${s.description}`)
      .join("\n") +
    "\n";
  writeFileSync(`docs/fichas/${p.id}.md`, text);
}
const r = read("research/masculino.json");
let report = `# Pesquisa: hipertrofia geral para iniciantes\n\nConsulta: ${r.reviewDate}.\n\n${r.scope}\n\n## Método e limites\n\n${r.method}\n\nConsultas usadas: ${r.queries.map((q) => "“" + q + "”").join("; ")}.\n\nOs critérios favorecem evidência de síntese, mas esta seleção não é exaustiva. As recomendações operacionais abaixo são uma interpretação para o projeto.\n\n`;
for (const f of r.findings) {
  report += `## ${f.topic}\n\n${f.finding}\n\n**Aplicação na ficha:** ${f.decision}\n\n**Limite:** ${f.limitation}\n\n${f.sourceIds
    .map((id) => {
      const s = sources.find((s) => s.id === id);
      return "[" + s.title + "](" + s.url + ")";
    })
    .join(" · ")}\n\n`;
}
report +=
  "## Regras práticas\n\n" +
  r.practicalRules.map((r) => "- " + r).join("\n") +
  "\n\n## Fichas reproduzíveis\n\nA [ficha masculina](fichas/masculino.md) contém agendas, exercícios, séries, pausas e volume semanal calculados do JSON. Execute `npm run sheets` para regenerá-la, sem editar a prescrição em dois lugares.\n";
writeFileSync("docs/pesquisa-masculina.md", report);
console.log("Fichas e relatório gerados dos JSONs.");
