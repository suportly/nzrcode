# Tasks: IStationRegistryService

**Branch:** `feature/0003-station-registry-service`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-14
**Language:** pt-BR

---

## Task list

### T001 — Smoke tests + mocha stub (RED)

- **Status:** done
- **Depends on:** —
- **Files:**
  - create: `test/nzrcode-stations/test_files_exist.sh`
  - create: `test/nzrcode-stations/test_interface_shape.sh`
  - create: `test/nzrcode-stations/test_typecheck.sh`
  - create: `test/nzrcode-stations/test_registration.sh`
  - create: `test/nzrcode-stations/run_all.sh`
  - create: `test/nzrcode-stations/README.md`
- **Spec scenarios:** Story 1.1-1.3, 2.1-2.3, 3.1-3.4
- **Acceptance:**
  - [ ] `test_files_exist.sh`: 4 arquivos `.ts` (pipelineState, stationRegistry, stationRegistryService, nzr.contribution) e 1 `.test.ts` existem.
  - [ ] `test_interface_shape.sh`: `pipelineState.ts` exporta types `PipelineStage`, `Station`, `SpecRef`, `PipelineState`, `GateReason`, `ClarifyMarker`, `ReviewFinding`; `stationRegistry.ts` declara `IStationRegistryService` decorator + os 3 eventos (`onStationAdded`, `onStationRemoved`, `onStationStageChanged`) + os 5 métodos (`getStations`, `getStation`, `addStation`, `removeStation`, `updateStationPipeline`).
  - [ ] `test_typecheck.sh`: roda `npx -y typescript@5 tsc --noEmit --strict --moduleResolution Bundler --target ES2022 --module ESNext --allowImportingTsExtensions --skipLibCheck` sobre os 4 arquivos novos; exit 0. (TypeScript CLI invocado via npx — sem npm install do repo.)
  - [ ] `test_registration.sh`: grep verifica que `src/vs/workbench/workbench.common.main.ts` importa `./services/nzr/common/nzr.contribution.js` e que essa contribution chama `registerSingleton(IStationRegistryService, ...)`.
  - [ ] `run_all.sh` agrega; exit 1 (RED) inicialmente.
  - [ ] Commit: `test(nzr-stations): T001 add station registry smoke suite (RED)`.

### T002 — pipelineState.ts types

- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `src/vs/platform/nzr/common/pipelineState.ts`
- **Spec scenarios:** Story 1.1
- **Acceptance:**
  - [ ] Exporta type alias `PipelineStage = 'specify' | 'clarify' | 'plan' | 'tasks' | 'implement' | 'review' | 'done' | 'failed' | 'idle';`.
  - [ ] Exporta interfaces `SpecRef`, `ClarifyMarker`, `ReviewFinding`, `PipelineState`, `Station` exatamente como brief §4, mais um `ClaudeProcess` placeholder `{ pid?: number; status: 'starting' | 'running' | 'crashed' | 'idle' }`.
  - [ ] Exporta `GateReason` como discriminated union de 5 variantes (clarify, spec-approval, plan-approval, tasks-approval, code-review).
  - [ ] Header copyright NZRCode + MIT.
  - [ ] `test_interface_shape.sh` GREEN para a parte de types.
  - [ ] Commit: `feat(nzr): T002 add pipeline state and Station types`.

### T003 — IStationRegistryService interface

- **Status:** done
- **Depends on:** T002
- **Files:**
  - create: `src/vs/platform/nzr/common/stationRegistry.ts`
- **Spec scenarios:** Story 1.1-1.3, 2.1-2.3
- **Acceptance:**
  - [ ] `export const IStationRegistryService = createDecorator<IStationRegistryService>('nzrStationRegistryService');`
  - [ ] Interface declara getters: `readonly stations: readonly Station[]`, e métodos: `getStation(id: string): Station | undefined`, `addStation(input: NewStationInput): Promise<Station>`, `removeStation(id: string): Promise<boolean>`, `updateStationPipeline(id: string, patch: Partial<PipelineState>): Promise<void>`.
  - [ ] Eventos: `readonly onStationAdded: Event<Station>`, `readonly onStationRemoved: Event<string>`, `readonly onStationStageChanged: Event<StageChangeEvent>` onde `StageChangeEvent = { stationId: string; previous: PipelineStage; next: PipelineStage }`.
  - [ ] Type `NewStationInput = { repoPath: string; branch: string; preset: string; activeSpec?: SpecRef }` exportado.
  - [ ] `test_interface_shape.sh` GREEN.
  - [ ] Commit: `feat(nzr): T003 add IStationRegistryService interface and events`.

### T004 — StationRegistryService implementation

- **Status:** done
- **Depends on:** T003
- **Files:**
  - create: `src/vs/workbench/services/nzr/common/stationRegistryService.ts`
- **Spec scenarios:** Story 1.1-1.3, 2.1-2.3, 3.1-3.4
- **Acceptance:**
  - [ ] Classe `StationRegistryService` implementa `IStationRegistryService`, estende `Disposable`.
  - [ ] Constructor injeta `IFileService` + `IWorkspaceContextService`. Load lazy: na primeira chamada de `getStations()`/`addStation()`/etc., carrega `<workspaceFolder>/.nzrcode/workspace.json` se existir, ou inicia coleção vazia.
  - [ ] Writes debouncados via `RunOnceScheduler` (250ms). `dispose()` força flush síncrono.
  - [ ] `addStation()` gera UUID v4 (usar `generateUuid()` de `src/vs/base/common/uuid.ts`), deriva `repoName` de `repoPath.split('/').pop()`, default `pipeline = { stage: 'idle', blocked: false }`, `metrics = { tokens: 0, cost: 0, startedAt: Date.now() }`. Emite `onStationAdded`.
  - [ ] `removeStation()` retorna `false` se id inexistente (sem emitir evento). Emite `onStationRemoved` com o id quando bem-sucedido.
  - [ ] `updateStationPipeline()` aplica `Object.assign(station.pipeline, patch)`. Se `patch.stage` mudou, emite `onStationStageChanged({ stationId, previous, next })`. Se patch não muda stage (só tasksDone etc.), não emite stage event.
  - [ ] Sem workspace folder: `getStations()` retorna `[]`; `addStation()` rejeita com `Error('Cannot add station: no workspace folder open')`.
  - [ ] Persistência: pretty JSON (indent 2), schema `{ version: 1, stations: [...] }`.
  - [ ] `test_typecheck.sh` GREEN.
  - [ ] Commit: `feat(nzr): T004 implement StationRegistryService with file persistence`.

### T005 — nzr.contribution.ts + workbench.common.main wiring

- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `src/vs/workbench/services/nzr/common/nzr.contribution.ts`
  - modify: `src/vs/workbench/workbench.common.main.ts`
- **Spec scenarios:** Story 1.1
- **Acceptance:**
  - [ ] `nzr.contribution.ts` chama `registerSingleton(IStationRegistryService, StationRegistryService, InstantiationType.Delayed)`.
  - [ ] `workbench.common.main.ts` ganha `import './services/nzr/common/nzr.contribution.js';` em uma seção apropriada (próximo aos outros service imports).
  - [ ] `test_registration.sh` GREEN.
  - [ ] Commit: `feat(nzr): T005 register StationRegistryService singleton`.

### T006 — Mocha unit test

- **Status:** done
- **Depends on:** T005
- **Files:**
  - create: `src/vs/platform/nzr/test/common/stationRegistry.test.ts`
- **Spec scenarios:** Story 1.1-1.3, 2.1-2.3, 3.1-3.4
- **Acceptance:**
  - [ ] `suite('StationRegistryService', ...)` com test cases que cobrem cada cenário de aceitação:
    - addStation produz Station com id válido + repoName derivado + pipeline idle.
    - getStations / getStation reflete o add.
    - removeStation existente retorna true e atualiza coleção; inexistente retorna false.
    - updateStationPipeline com `stage: 'specify'` muda o stage.
    - onStationAdded emite com a station correta.
    - onStationRemoved emite com o id correto.
    - onStationStageChanged emite com previous/next corretos; não emite quando stage não muda.
    - Persistência round-trip: addStation → flush → read file → JSON tem a station.
    - Workspace vazio retorna [] e addStation rejeita.
  - [ ] Usa `TestFileService` / mock de `IWorkspaceContextService` (padrão upstream — referenciar `configurationService.test.ts` se necessário).
  - [ ] Compila via `test_typecheck.sh` que agora também inclui o `.test.ts`.
  - [ ] Commit: `test(nzr): T006 add StationRegistryService mocha unit tests`.

### T007 — Verify GREEN + push + PR

- **Status:** done
- **Depends on:** T006
- **Files:**
  - create: `specs/0003-station-registry-service/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-stations/run_all.sh` exit 0.
  - [ ] `bash test/nzrcode-theme/run_all.sh` exit 0 (sem regressão 0002).
  - [ ] `bash test/nzrcode-brand/run_all.sh` exit 0 (sem regressão 0001).
  - [ ] tasks.md statuses pending → done.
  - [ ] Commit verify; push; PR contra `feature/0002-...` (stacked).

## Parallelization hints

- Serial inteiro — cada task depende da anterior. T002+T003 poderiam paralelizar mas como T003 importa de T002, mantemos serial.

## Post-task checklist

After every task:
- [ ] Commit referencia task id.
- [ ] Status flipped pending → done.

After all tasks:
- [ ] Todas as 3 suites smoke GREEN.
- [ ] Hand off para PR stacked.
