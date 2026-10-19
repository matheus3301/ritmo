# Contrato dos perfis e renderizador

`dist/` é o aplicativo estático completo. `app.js` renderiza a interface; `core.js` contém calendário, validação, progresso e migração. Não há conta ou serviço de armazenamento.

## Catálogo

`data/profiles.json` tem `schemaVersion: 1`, `defaultProfileId` e uma lista de `{id, file}`. Os caminhos devem apontar para `./data/profiles/<id>.json`. IDs são únicos, estáveis e em minúsculas. Não altere o ID de um perfil publicado: ele identifica seus dados locais.

## Perfil

Cada arquivo declara:

| Campo | Uso |
| --- | --- |
| `schemaVersion`, `id` | Versão do contrato e identidade do perfil |
| `label`, `subtitle`, `audience` | Nome, foco e público apresentados |
| `researchDate`, `sourceIds`, `guidance.sections` | Pesquisa e orientações do perfil |
| `durationWeeks`, `adaptationWeeks`, `adaptationRir`, `baseRir` | Duração e instruções de esforço |
| `workouts` | Sessões por ID, com nome, duração estimada, grupos de recuperação e exercícios |
| `sequences` | Ordem das sessões para cada frequência semanal; `cardio` é reservado |
| `defaults` | Dias sugeridos, de 0 (domingo) a 6 (sábado) |
| `adaptationSets` | Número reduzido de séries por sessão/exercício; zero omite o exercício |
| `supplements` | Complementos por frequência e sessão, cada um com `adaptationSets` próprio |
| `recoveryGroups`, `recoveryNote` | Grupos que exigem pelo menos um dia sem novo estímulo programado e orientação apresentada |
| `scheduleHints`, `cardio` | Explicação de cada agenda e duração/orientação do aeróbico |

Cada prescrição contém `exerciseId`, `sets` (1-5), `reps`, `restSeconds` e `restLabel`. A biblioteca compartilhada fornece nome, cue, mídia, `measurement` (`reps` ou `seconds`), nota de registro e `volumeGroups` para gerar tabelas. As séries unilaterais são contadas depois dos dois lados.

O motor ordena os dias de segunda a domingo, aplica a sequência e confere a recuperação também na virada da semana. Um suplemento pode mudar o conteúdo de uma sessão conforme a frequência. Se acrescentar um grupo relevante, inclua-o nas regras da sessão; a validação não deduz músculos da biomecânica.

`validateProfile` verifica referências, séries, adaptação, sessões e calendários antes de renderizar. Os testes também incluem um terceiro perfil sintético com uma sessão D, para impedir que o motor volte a depender de nomes de sexo ou somente A/B/C.

## Histórico e compatibilidade

A chave atual de armazenamento é `ritmo:v2`:

```json
{
  "version": 2,
  "profileId": "masculino",
  "theme": "system",
  "plans": {
    "masculino": {
      "version": 1,
      "preferences": {"frequency": 3, "days": [1, 3, 5], "startDate": "2026-10-19"},
      "logs": {}
    }
  }
}
```

O `version: 1` interno identifica o formato de um plano, encapsulado no formato de biblioteca v2. Cada perfil tem preferências, data de início e histórico próprios. Trocar de perfil restaura sua agenda anterior. Ajustar dias não apaga o histórico. O perfil ativo e o tema são globais no aparelho.

O formato legado `ritmo:v1` e cópias v1 são migrados para o perfil padrão feminino. A chave antiga permanece como recuperação até uma exclusão explícita pelo usuário. Uma v2 existente tem prioridade. Importações validam todos os perfis antes de substituir o estado; perfis desconhecidos são rejeitados para evitar descarte silencioso. Exportações v2 incluem todos os perfis salvos.

Os registros usam `data:sessão` dentro do perfil. Guardam um snapshot de exercício/séries para calcular sessões concluídas sem depender da agenda atual. O histórico é exibido para o perfil ativo. O tema não interfere nos registros.

## Cache e versões

O service worker mantém o aplicativo e todos os perfis no cache da própria aplicação. Ao adicionar arquivos, atualize `FILES` em `sw.js` e incremente a versão do cache. O teste confere a presença de todos os perfis. A nova versão assume quando todas as abas antigas forem fechadas, evitando substituir uma sessão aberta de treino.

O tema é aplicado antes da primeira pintura por `theme-init.js`; o aplicativo acompanha mudanças na preferência do aparelho quando o modo automático está selecionado.

## Fichas reproduzíveis

`npm run sheets` lê os mesmos perfis, biblioteca e fontes, valida-os e escreve as fichas Markdown e o relatório de pesquisa. Não edite as fichas geradas à mão. `volumeGroups` é uma classificação editorial explícita, sem conversão automática de séries indiretas em séries diretas.
