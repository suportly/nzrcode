# Feature specification: Mission Control shell (state + toggle + layout)

**Branch:** `feature/0006-mission-control-shell`
**Created:** 2026-05-14
**Status:** Draft
**Spec ID:** 0006
**Language:** pt-BR

---

<!-- section: Problem -->
## Problema

Após 0001-0005 temos rebrand, theme, station registry, AIADev adapter e Claude bridge — mas nada disso é **visível**. Não há comando, não há painel, não há sinalização contextual de "estou em modo Mission Control". A feature 0006 entrega o **switching layer** entre o workbench tradicional do VS Code e a futura UI de Mission Control: (a) um serviço workbench que mantém o estado do toggle (ligado/desligado), (b) um comando `nzr.toggleMissionControl` invocável via command palette, (c) um context key (`nzr.missionControl.active`) que features 0007+ vão usar para gate UI, (d) uma função pura de layout (`computeGridLayout(stationCount)`) que devolve `{cols, rows}` para o grid auto-tiling do brief §6.6. A pintura real do grid (cada slot renderizando uma StationView com head/body/footer) é casada com a feature 0007 (`station-view`) — fazer só metade do grid sem o conteúdo seria carregar DOM placeholder sem valor. Esta feature é a fundação de wiring; a pintura visual sai em 0007.

<!-- section: Reconnaissance -->
## Reconnaissance

- **`registerAction2`** — entry: `src/vs/workbench/contrib/scm/browser/scm.contribution.ts:671` · auth: `none` · integration: padrão para comandos com title/keybinding/menu metadata. `Action2` carrega `id`, `title` (com `nls.localize`), `f1: true` (aparece no command palette), `menu`, `keybinding` opcional, `category`.
- **Context keys** — entry: `src/vs/platform/contextkey/common/contextkey.ts` · integration: `RawContextKey<boolean>('nzr.missionControl.active', false).bindTo(contextKeyService)` permite UI condicional via `when:` em menu items e keybindings.
- **`registerWorkbenchContribution2`** — entry: `src/vs/workbench/common/contributions.ts` linha ~`registerWorkbenchContribution2(id, ctor, phase)` · integration: contributions são instanciadas no boot; recebem DI via constructor.
- **`IStationRegistryService`** (0003) — entry: `src/vs/platform/nzr/common/stationRegistry.ts` · integration: o service de Mission Control vai observar `onStationAdded`/`onStationRemoved` para recomputar a grid layout dinamicamente.
- **`IThemeService`** + NZR_TOKENS (0002) — quando a UI for pintada (em 0007), tokens já existem.
- **`nls.localize`** — entry: `src/vs/nls.js` · integration: toda string visível ao usuário passa por aqui.

<!-- section: Users and stakeholders -->
## Usuários e stakeholders

- **Usuário final** — após Ctrl/Cmd+Shift+P → "NZR: Toggle Mission Control", entra em modo MC; em 0007 verá o grid.
- **Station view (0007)** — vai instanciar slots usando o layout computado por esta feature.
- **Welcome screen (0011)** — vai oferecer um botão "Start Mission Control" que invoca o mesmo comando.
- **Future features (0008-0012)** — usam o context key `nzr.missionControl.active` para gate UI deles (ex: gate queue panel só aparece em MC mode).

<!-- section: Success criteria -->
## Critérios de sucesso

- `src/vs/workbench/services/nzr/common/missionControl.ts` exporta `IMissionControlService` decorator + interface com: `readonly isActive: boolean`, `readonly onDidChangeActive: Event<boolean>`, `readonly slots: readonly MissionControlSlot[]`, `readonly onDidChangeSlots: Event<void>`, `toggle(): void`, `setActive(active: boolean): void`.
- `MissionControlSlot` (`{ stationId: string; row: number; col: number; spanCols?: number; spanRows?: number }`) deriva da station list via `computeGridLayout`.
- `src/vs/workbench/services/nzr/common/gridLayout.ts` exporta função pura `computeGridLayout(stationCount: number): { cols: number; rows: number; capacity: number; overflowScroll: boolean }`. Regras (brief §6.6):
  - 0 stations → `{cols: 0, rows: 0, capacity: 0, overflowScroll: false}`
  - 1 station → `{cols: 1, rows: 1, capacity: 1, overflowScroll: false}`
  - 2 stations → `{cols: 2, rows: 1, capacity: 2, overflowScroll: false}`
  - 3-4 stations → `{cols: 2, rows: 2, capacity: 4, overflowScroll: false}`
  - 5-6 stations → `{cols: 3, rows: 2, capacity: 6, overflowScroll: false}`
  - 7+ stations → `{cols: 3, rows: 2, capacity: 6, overflowScroll: true}` (grid de 3x2 visível, restante scrollable)
- `src/vs/workbench/services/nzr/common/missionControlService.ts` implementa o service: injeta `IStationRegistryService`, registra event listeners (`onStationAdded`/`onStationRemoved`), recomputa slots e emite `onDidChangeSlots`. Toggle muda `isActive` e dispara `onDidChangeActive`.
- `src/vs/workbench/contrib/nzr/browser/missionControl.contribution.ts` registra:
  - context key `nzr.missionControl.active` (tipo `RawContextKey<boolean>`) com default `false`.
  - command `nzr.toggleMissionControl` via `registerAction2`, title `NZR: Toggle Mission Control` localizado, `f1: true`.
  - listener que sincroniza o context key com `IMissionControlService.isActive`.
- `MissionControlPart`/`StationView` rendering — **explicitamente fora de escopo desta feature** (decisão cl-1). Documentado em non-goals.
- Mocha test cobre: `computeGridLayout` exhaustively (0, 1, 2, 3, 4, 5, 6, 7, 100); service toggle muda flag + emite evento; service observa registry e recomputa slots.
- Smoke shell `test/nzrcode-mission-control/run_all.sh` GREEN: file existence, interface shape, registration (contribution importada).
- Diff: 5 arquivos novos (service interface, service impl, gridLayout puro, contribution, mocha) + 1 modificado (`workbench.common.main.ts` para importar a contribution). Sem regressão nas 5 suites anteriores.

<!-- section: Non-goals -->
## Não-goals

- **Renderização DOM do grid** — decisão cl-1; folded em feature 0007. Sem `MissionControlPart` class, sem `<div>` rendering. Apenas state + layout computation.
- **Substituir EditorPart** — fora de escopo. EditorPart fica intocado; quando 0007 pintar a UI, ela vai num view container próprio (não substitui editor).
- **Keybinding** — comando registrado sem keybinding default. Brief §6.6 não específica; adicionar depois quando UI estiver pronta para teste manual.
- **Persistência do toggle state** — se o usuário fecha NZRCode com MC ativo, abre fechado. Cross-session toggle persistence é feature de polish.
- **Comando "Add Station"** — feature 0010 (`add-station-palette`).
- **Layout responsivo (window resize)** — `computeGridLayout` depende de `stationCount`, não de window size. Reflow por resize é trabalho do componente DOM em 0007.
- **Animation de transition entre layouts** — pode ser tarefa de polish.

<!-- section: User stories -->
## User stories

### Story 1 — Toggle Mission Control via comando (P1)

Como **usuário final**, eu quero um comando "NZR: Toggle Mission Control" no command palette, para alternar entre o workbench padrão e Mission Control.

**Acceptance:**

1. **Given** NZRCode aberto fresh, **When** abro command palette (Ctrl/Cmd+Shift+P) e busco "NZR", **Then** o comando "NZR: Toggle Mission Control" aparece na lista.
2. **Given** o comando é invocado pela primeira vez, **When** observo o context key `nzr.missionControl.active`, **Then** vira `true` (de `false`).
3. **Given** o comando é invocado novamente, **When** observo o context key, **Then** vira `false` (de `true`).
4. **Given** `IMissionControlService.isActive === true`, **When** assino `onDidChangeActive`, **Then** o evento fire quando o toggle muda para `false`.

### Story 2 — Layout computation determinístico (P1)

Como **autor da station-view (0007)**, eu quero uma função pura que diz quantas colunas/rows usar pra N stations, para que a UI não recompute essa lógica em cada render.

**Acceptance:**

1. **Given** `computeGridLayout(0)`, **When** chamo, **Then** retorna `{cols: 0, rows: 0, capacity: 0, overflowScroll: false}`.
2. **Given** `computeGridLayout(1)`, **When** chamo, **Then** retorna `{cols: 1, rows: 1, capacity: 1, overflowScroll: false}`.
3. **Given** `computeGridLayout(2)`, **When** chamo, **Then** retorna `{cols: 2, rows: 1, capacity: 2, overflowScroll: false}`.
4. **Given** `computeGridLayout(3)` e `computeGridLayout(4)`, **When** chamo, **Then** ambos retornam `{cols: 2, rows: 2, capacity: 4, overflowScroll: false}`.
5. **Given** `computeGridLayout(5)` e `computeGridLayout(6)`, **When** chamo, **Then** ambos retornam `{cols: 3, rows: 2, capacity: 6, overflowScroll: false}`.
6. **Given** `computeGridLayout(7)` e `computeGridLayout(100)`, **When** chamo, **Then** ambos retornam `{cols: 3, rows: 2, capacity: 6, overflowScroll: true}`.
7. **Given** input negativo `computeGridLayout(-3)`, **When** chamo, **Then** retorna mesmo result que `computeGridLayout(0)` (defensive default).

### Story 3 — Slots reagem ao registry (P1)

Como **futuro `MissionControlPart`**, eu quero `IMissionControlService.slots` sempre refletir as stations atuais, para que mudanças no registry repaintem o grid sem polling.

**Acceptance:**

1. **Given** registry vazio, **When** instancio `IMissionControlService`, **Then** `slots.length === 0`.
2. **Given** service em estado vazio, **When** `IStationRegistryService.addStation(...)` cria uma station, **Then** `slots.length === 1`; `slots[0] === { stationId: <id>, row: 0, col: 0 }`; `onDidChangeSlots` foi disparado.
3. **Given** 3 stations registradas, **When** chamo `slots`, **Then** retorna 3 entries com positions `(0,0), (0,1), (1,0)` (preenchendo grid 2x2 row-major).
4. **Given** 4 stations, **When** removo a primeira, **Then** as 3 restantes reflowm para `(0,0), (0,1), (1,0)`; `onDidChangeSlots` foi disparado.

<!-- section: Clarifications -->
## Clarifications

> Resolvidas em auto-mode.

- **cl-1 — DOM render do grid nesta feature ou na 0007?** **Decidido:** **adiado para 0007.** **Rationale:** brief §6.6 descreve `MissionControlPart` + grid; brief §6.7 descreve `StationView`. Os dois são acoplados (cada slot do grid É uma StationView). Renderizar grid vazio em 0006 e re-renderizar tudo em 0007 = trabalho duplicado e DOM placeholder sem valor. Esta feature entrega state + layout primitives; 0007 entrega Part + grid + StationView numa única tacada coerente.
- **cl-2 — Layout responsivo a window resize.** **Decidido:** fora de escopo. **Rationale:** layout depende de `stationCount`, não de tamanho de janela. Reflow visual em resize é responsabilidade do componente DOM (0007); a função pura não precisa saber sobre pixels.
- **cl-3 — Persistência cross-session do toggle state.** **Decidido:** fora de escopo. **Rationale:** comportamento default (sempre abre desligado) é seguro e previsível. Persistir via `IStorageService` quando 0007 estiver maduro.
- **cl-4 — Keybinding default.** **Decidido:** nenhum default. **Rationale:** brief não específica; sem UI ainda para testar manualmente, keybinding agora é forte de comprometer com.
- **cl-5 — `nzr.missionControl.active` vs múltiplos context keys.** **Decidido:** um context key boolean. **Rationale:** simplicidade; sub-modes (ex: "MC com gate queue aberto") são context keys adicionais quando precisarmos.
- **cl-6 — Layout overflow (7+ stations).** **Decidido:** grid 3x2 visível + scroll vertical no container. **Rationale:** brief §6.6 explicita "7+ scroll". `overflowScroll: true` no return permite o componente DOM decidir como renderizar (scrollbar custom etc.).
- **cl-7 — Layout para input negativo / NaN.** **Decidido:** clamp em 0 (mesma saída que stationCount=0). **Rationale:** defensive default; nunca deve acontecer em prod (registry retorna `readonly Station[]`), mas o test cobre.

<!-- section: Data touched -->
## Dados tocados

- **Novos:**
  - `src/vs/workbench/services/nzr/common/gridLayout.ts` — função pura.
  - `src/vs/workbench/services/nzr/common/missionControl.ts` — interface + decorator + types.
  - `src/vs/workbench/services/nzr/common/missionControlService.ts` — impl.
  - `src/vs/workbench/contrib/nzr/browser/missionControl.contribution.ts` — context key + command + workbench contribution.
  - `src/vs/workbench/services/nzr/test/common/gridLayout.test.ts` — mocha (pura, exhaustive).
  - `src/vs/workbench/services/nzr/test/common/missionControlService.test.ts` — mocha (service behaviour).
  - `test/nzrcode-mission-control/` — suite shell.
- **Modificados:**
  - `src/vs/workbench/services/nzr/common/nzr.contribution.ts` — registra IMissionControlService singleton (junta com 0003).
  - `src/vs/workbench/workbench.common.main.ts` — adiciona import da nova contribution browser.
- **Intocados:** EditorPart, layout service, todo o resto.

<!-- section: Out-of-band effects -->
## Efeitos out-of-band

Nenhum. Mudança 100% in-process — state + events + comando registrado.

<!-- section: Open risks -->
## Riscos abertos

- **Toggle sem feedback visual** — usuário invoca o comando mas não vê nada mudar até 0007 landar. Mitigação: command title + status bar future (não nesta feature).
- **Registry pré-existente no boot** — `IStationRegistryService` lazy-load; quando MC service instancia, o registry pode estar vazio mesmo havendo stations no `.nzrcode/workspace.json`. **Mitigação:** service espera o primeiro `onStationAdded` para popular slots; alternativa é forçar load eager (out-of-scope agora).
- **Race entre toggle e slot updates** — usuário toggla MC enquanto stations sendo adicionadas. Eventos são sequenciais via Emitter; sem race real.

<!-- section: Traceability -->
## Traceability

- Originating: brief §6.6.
- Related: 0003 (registry consumer), 0007 (DOM consumer dos slots + Part rendering).
- Constitution articles: I, II, III (sem render = sem DOM prematuro).
