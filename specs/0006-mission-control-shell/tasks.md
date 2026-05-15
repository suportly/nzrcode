# Tasks: Mission Control shell

**Branch:** `feature/0006-mission-control-shell`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-14
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stubs (RED)
- **Status:** done
- **Depends on:** —
- **Files:**
  - create: `test/nzrcode-mission-control/{test_files_exist,test_interface_shape,test_command_registered,run_all}.sh`
  - create: `test/nzrcode-mission-control/README.md`
  - create: `src/vs/workbench/services/nzr/test/common/gridLayout.test.ts` (stub)
  - create: `src/vs/workbench/services/nzr/test/common/missionControlService.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh`: 4 source files novos + 2 test files exist.
  - [ ] `test_interface_shape.sh`: `gridLayout.ts` exporta `computeGridLayout`; `missionControl.ts` exporta `IMissionControlService` + decorator + interface (2 events + getter slots + isActive + toggle/setActive).
  - [ ] `test_command_registered.sh`: `missionControl.contribution.ts` registra `nzr.toggleMissionControl` via `registerAction2` e cria context key `nzr.missionControl.active`.
  - [ ] `run_all.sh` exit 1 inicialmente.
  - [ ] Commit: `test(nzr-mc): T001 add Mission Control smoke suite + mocha stubs (RED)`.

### T002 — gridLayout pure function + tests
- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/services/nzr/common/gridLayout.ts`
  - modify: `src/vs/workbench/services/nzr/test/common/gridLayout.test.ts`
- **Acceptance:**
  - [ ] Exporta `interface GridLayout { cols: number; rows: number; capacity: number; overflowScroll: boolean }` e `function computeGridLayout(stationCount: number): GridLayout`.
  - [ ] Casos:
    - 0 → `{0,0,0,false}`
    - 1 → `{1,1,1,false}`
    - 2 → `{2,1,2,false}`
    - 3-4 → `{2,2,4,false}`
    - 5-6 → `{3,2,6,false}`
    - 7+ → `{3,2,6,true}`
    - negativo / NaN → mesma saída que 0.
  - [ ] Mocha suite com 7+ test cases (exhaustive).
  - [ ] Commit: `feat(nzr-mc): T002 add computeGridLayout pure function`.

### T003 — IMissionControlService interface
- **Status:** done
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/services/nzr/common/missionControl.ts`
- **Acceptance:**
  - [ ] Exporta `interface MissionControlSlot { stationId: string; row: number; col: number }`.
  - [ ] Exporta `IMissionControlService = createDecorator<IMissionControlService>('nzrMissionControlService')` + interface com `readonly isActive`, `onDidChangeActive: Event<boolean>`, `readonly slots: readonly MissionControlSlot[]`, `onDidChangeSlots: Event<void>`, `readonly layout: GridLayout`, `toggle(): void`, `setActive(active: boolean): void`.
  - [ ] `test_interface_shape.sh` GREEN para a parte de interface.
  - [ ] Commit: `feat(nzr-mc): T003 add IMissionControlService interface`.

### T004 — MissionControlService impl + tests
- **Status:** done
- **Depends on:** T003
- **Files:**
  - create: `src/vs/workbench/services/nzr/common/missionControlService.ts`
  - modify: `src/vs/workbench/services/nzr/test/common/missionControlService.test.ts`
- **Acceptance:**
  - [ ] Classe `MissionControlService extends Disposable implements IMissionControlService`.
  - [ ] Injeta `IStationRegistryService`.
  - [ ] `_isActive: boolean = false`; toggle() flipa; setActive(b) só fire onDidChangeActive se b != current.
  - [ ] No constructor, registra listener para `onStationAdded`/`onStationRemoved` que recomputa slots (row-major) e dispara `onDidChangeSlots`.
  - [ ] Inicializa slots a partir de `stationRegistryService.stations`.
  - [ ] Mocha test cobre:
    - service inicia inactive, slots vazio quando registry vazio.
    - toggle muda flag e fire evento.
    - setActive idempotent (mesmo valor não emite).
    - addStation aumenta slots; reflow correto (3 stations → positions 0,0; 0,1; 1,0).
    - removeStation diminui slots; reflow row-major.
  - [ ] Commit: `feat(nzr-mc): T004 implement MissionControlService with slot reflow`.

### T005 — Contribution (comando + context key)
- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/missionControl.contribution.ts`
- **Acceptance:**
  - [ ] Cria `RawContextKey<boolean>('nzr.missionControl.active', false)`.
  - [ ] Registra `Action2` com id `nzr.toggleMissionControl`, title `'NZR: Toggle Mission Control'` localizado, `f1: true`, category `'NZR'`.
  - [ ] Action handler invoca `accessor.get(IMissionControlService).toggle()`.
  - [ ] Workbench contribution registrada via `registerWorkbenchContribution2` que subscribe `onDidChangeActive` e atualiza o context key bound.
  - [ ] `test_command_registered.sh` GREEN.
  - [ ] Commit: `feat(nzr-mc): T005 register Mission Control toggle command and context key`.

### T006 — Wire singleton + workbench main
- **Status:** done
- **Depends on:** T005
- **Files:**
  - modify: `src/vs/workbench/services/nzr/common/nzr.contribution.ts`
  - modify: `src/vs/workbench/workbench.common.main.ts`
- **Acceptance:**
  - [ ] `nzr.contribution.ts` adiciona `registerSingleton(IMissionControlService, MissionControlService, InstantiationType.Delayed)` após o registerSingleton do StationRegistry.
  - [ ] `workbench.common.main.ts` adiciona `import './contrib/nzr/browser/missionControl.contribution.js';` próximo aos outros contrib imports.
  - [ ] Commit: `feat(nzr-mc): T006 register MissionControlService + load contribution`.

### T007 — Verify + push + PR #6
- **Status:** done
- **Depends on:** T006
- **Files:**
  - create: `specs/0006-mission-control-shell/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-mission-control/run_all.sh` exit 0.
  - [ ] Suites 0001-0005 sem regressão.
  - [ ] tasks.md pending → done.
  - [ ] push + PR contra `feature/0005-...`.

## Parallelization hints

Serial.
