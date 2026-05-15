# Tasks 0007 — Station View

**Branch:** `feature/0007-station-view`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-14
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stubs (RED)
- **Status:** pending
- **Depends on:** —
- **Files:**
  - create: `test/nzrcode-station-view/{test_files_exist,test_view_registered,test_no_new_deps,test_i18n_strings,run_all}.sh`
  - create: `test/nzrcode-station-view/README.md`
  - create: `src/vs/workbench/services/nzr/test/common/stationCard.test.ts` (stub)
  - create: `src/vs/workbench/services/nzr/test/common/pipelineRail.test.ts` (stub)
- **Acceptance:**
  - [ ] 5 source files novos + 2 test files referenciados.
  - [ ] `test_view_registered.sh`: contribution file registra `registerViewContainer` + `registerViews` com id contendo `nzr.stations` ou similar.
  - [ ] `test_no_new_deps.sh`: `package.json` deps inalterado vs main.
  - [ ] `test_i18n_strings.sh`: nenhuma string visible hard-coded fora de `localize(`.
  - [ ] `run_all.sh` exit 1 inicialmente.
  - [ ] Commit: `test(nzr-sv): T001 add Station View smoke suite + mocha stubs (RED)`.

### T002 — `stationCard` pure builder + tests
- **Status:** pending
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/stationCard.ts`
  - modify: `src/vs/workbench/services/nzr/test/common/stationCard.test.ts`
- **Acceptance:**
  - [ ] Exporta `interface StationCardHandle { readonly element: HTMLElement; update(station, output): void; dispose(): void }`.
  - [ ] Exporta `function createStationCard(station: Station, output: string): StationCardHandle`.
  - [ ] DOM gera: `div.nzr-station-card[data-station-id][role=region][aria-label]` com filhos `.nzr-station-card__head` (title + stage-badge), `.nzr-station-card__body > pre.nzr-station-card__output[aria-live=polite]`, `.nzr-station-card__footer` (rail placeholder + metric).
  - [ ] `update()` reassigna title, stage-badge class, output `textContent` (slice -200), metric. **Não recria nós.**
  - [ ] Output truncado em -200 chars.
  - [ ] Mocha cobre: estrutura, update muta sem recriar, stage-badge troca classe, output slice.
  - [ ] Commit: `feat(nzr-sv): T002 add stationCard pure DOM builder`.

### T003 — `pipelineRail` pure builder + stage label table + tests
- **Status:** pending
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/pipelineRail.ts`
  - modify: `src/vs/workbench/services/nzr/test/common/pipelineRail.test.ts`
- **Acceptance:**
  - [ ] Exporta `function stageLabel(stage: PipelineStage): string` mapeando 9 stages para localize keys.
  - [ ] Exporta `interface PipelineRailHandle { readonly element: HTMLElement; update(stage): void; dispose(): void }`.
  - [ ] Exporta `function createPipelineRail(stage: PipelineStage): PipelineRailHandle`.
  - [ ] DOM gera `div.nzr-station-card__rail[role=img][aria-label]` com 7 spans `.nzr-station-card__dot.dot-<idx>` onde idx 0-6 cobre specify, clarify, plan, tasks, implement, review, done.
  - [ ] Dot states: `.done` (idx < currentIdx), `.active` (idx === currentIdx), `.todo` (idx > currentIdx).
  - [ ] Stages `idle`/`failed` mapeiam para `currentIdx = -1` (todos `.todo`) e adicionam classe `rail-failed` se `failed`.
  - [ ] Mocha cobre todos os 9 stages.
  - [ ] Commit: `feat(nzr-sv): T003 add pipelineRail pure builder + stage labels`.

### T004 — `StationViewPane` class
- **Status:** pending
- **Depends on:** T003
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/stationView.ts`
- **Acceptance:**
  - [ ] `class StationViewPane extends ViewPane`.
  - [ ] Injeta `IMissionControlService`, `IStationRegistryService`, `IClaudeCodeBridge` (e os base services do ViewPane via constructor padrão).
  - [ ] `renderBody(container)`: monta `div.nzr-station-grid` e empty-state `div.nzr-station-empty`; chama `_render()`.
  - [ ] `_render()`: dispose cards antigos, lê `slots`, cria card por slot via `createStationCard(station, '')`, anexa ao grid; aplica `grid-template-columns: repeat(layout.cols, 1fr)`.
  - [ ] Subscribe `onDidChangeSlots` → `_render()`; subscribe `onStationChanged` → `card.update()`; subscribe `onSessionOutput` → append chunk ao buffer e `card.update()`.
  - [ ] Mantém `Map<stationId, { card: StationCardHandle; rail: PipelineRailHandle; buffer: string }>`.
  - [ ] `layoutBody(h, w)`: no-op (CSS Grid handles).
  - [ ] `dispose()` propaga para cards + rails.
  - [ ] Commit: `feat(nzr-sv): T004 implement StationViewPane`.

### T005 — ViewContainer + View registration
- **Status:** pending
- **Depends on:** T004
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/stationView.contribution.ts`
  - create: `src/vs/workbench/contrib/nzr/browser/media/stationView.css`
- **Acceptance:**
  - [ ] CSS define `.nzr-station-grid`, `.nzr-station-card`, `.nzr-station-card__head`, `__body`, `__footer`, `__rail`, `__dot` com states; usa `var(--nzr-*)` tokens.
  - [ ] Contribution importa CSS via `import './media/stationView.css';`.
  - [ ] `registerIcon('nzr-mission-control-view-icon', Codicon.dashboard, ...)` (Codicon válido, ajustar para o que existir).
  - [ ] `registerViewContainer({ id: 'workbench.view.nzr.missionControl', title: localize2(...), icon, order: 6, ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [...]), storageId: ..., hideIfEmpty: false }, ViewContainerLocation.Sidebar)`.
  - [ ] `registerViews([{ id: 'workbench.view.nzr.stations', name: localize2(...), containerIcon: icon, canToggleVisibility: true, canMoveView: true, ctorDescriptor: new SyncDescriptor(StationViewPane) }], CONTAINER)`.
  - [ ] `test_view_registered.sh` GREEN.
  - [ ] Commit: `feat(nzr-sv): T005 register Mission Control ViewContainer + Station view`.

### T006 — Wire workbench main + final sanity
- **Status:** pending
- **Depends on:** T005
- **Files:**
  - modify: `src/vs/workbench/workbench.common.main.ts`
- **Acceptance:**
  - [ ] Adiciona `import './contrib/nzr/browser/stationView.contribution.js';` próximo ao `missionControl.contribution.js`.
  - [ ] `run_all.sh` exit 0.
  - [ ] Commit: `feat(nzr-sv): T006 register stationView contribution in workbench main`.

### T007 — Verify + push + PR #7
- **Status:** pending
- **Depends on:** T006
- **Files:**
  - create: `specs/0007-station-view/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-station-view/run_all.sh` exit 0.
  - [ ] Suites 0001-0006 sem regressão.
  - [ ] tasks.md pending → done.
  - [ ] push + PR contra `feature/0006-mission-control-shell`.

## Parallelization hints

Serial. T002/T003 podem teoricamente paralelizar mas usam tipos compartilhados; serial é seguro.
