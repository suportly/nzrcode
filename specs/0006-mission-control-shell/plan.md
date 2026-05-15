# Implementation plan: Mission Control shell

**Branch:** `feature/0006-mission-control-shell`
**Date:** 2026-05-14
**Spec:** [spec.md](./spec.md)
**Plan version:** 1
**Language:** pt-BR

---

## Summary

Service + comando + context key + função pura de layout. Sem DOM. **Não renderiza grid** — isso casa naturalmente com 0007 (`station-view`). 6 arquivos novos + 2 modificados, ~7 tasks.

## Technical context

| Field | Value |
|---|---|
| Active preset | lean |
| Language / runtime | TypeScript / Node 18 |
| Primary deps | `IStationRegistryService` (0003), `Emitter`, `IContextKeyService`, `registerAction2`, `nls.localize` — todos já no upstream |
| Storage | N/A — toggle in-memory; persistência cross-session é cl-3 deferida |
| Testing | Mocha (puro + service) + smoke shell |
| Target platform(s) | Cross-platform (common layer) |
| Performance budget | `computeGridLayout` O(1); slot reflow O(n) com n <= 100 |
| Security | Sem PII, sem rede |

## Constitution check

| Article | Status | Evidence |
|---|---|---|
| I. Spec-first | PASS | spec clarificado |
| II. Test-first | PASS | T001 RED — incluindo cases exhaustive para o pure function |
| III. Simplicity | PASS | Pure function isolada; service é ~80 LOC; sem DOM prematuro (cl-1) |
| IV. Evidence | PASS | mocha + smoke documentam |
| V. Provider | No | N/A |
| VI. Privacy | PASS | Sem logs/PII |
| VII. Attribution | N/A | — |

## Architecture decisions

### ADR-1 — Pure function `computeGridLayout` separado do service

**Decisão:** `gridLayout.ts` exporta função pura sem DI; service consome.

**Rationale:** layout é determinístico em `stationCount`; testável extensively sem mocks. Service mantém apenas estado.

### ADR-2 — DOM render adiado para 0007

**Decisão:** sem `MissionControlPart` nesta feature. Render é casado com `StationView` em 0007.

**Rationale:** ver cl-1. Render placeholder agora é DOM throw-away.

### ADR-3 — Context key + comando no contrib browser; service no `services/`

**Decisão:** service workbench em `services/nzr/common/`; comando + context key em `contrib/nzr/browser/missionControl.contribution.ts`.

**Rationale:** services upstream pattern (common = pode ser usado por web/desktop); contribs ficam em `contrib/` (são UI/orchestration layer).

### ADR-4 — Layout reflow row-major

**Decisão:** slots preenchem grid linha-a-linha (`(0,0), (0,1), (1,0), ...`).

**Rationale:** previsível; usuário vê stations adicionadas aparecerem na primeira linha disponível.

### ADR-5 — Slot mantém referência ao `stationId`, não cópia

**Decisão:** `MissionControlSlot { stationId }` — caller resolve a Station completa via `IStationRegistryService.getStation(id)`.

**Rationale:** evita duplicar state; quando station é atualizada (pipeline.stage muda), slot não precisa refletir — referência via id mantém canonical source.

## Project structure changes

```text
src/vs/workbench/services/nzr/common/gridLayout.ts                            (new)
src/vs/workbench/services/nzr/common/missionControl.ts                        (new)
src/vs/workbench/services/nzr/common/missionControlService.ts                 (new)
src/vs/workbench/contrib/nzr/browser/missionControl.contribution.ts           (new)
src/vs/workbench/services/nzr/test/common/gridLayout.test.ts                  (new)
src/vs/workbench/services/nzr/test/common/missionControlService.test.ts       (new)
src/vs/workbench/services/nzr/common/nzr.contribution.ts                      (modified — +1 registerSingleton)
src/vs/workbench/workbench.common.main.ts                                     (modified — +1 import)
test/nzrcode-mission-control/{test_files_exist,test_interface_shape,
  test_command_registered,run_all}.sh + README.md                             (new)
```

## Phase breakdown

### Phase 1 — RED
- T001: smoke shell + mocha stubs.

### Phase 2 — Pure function
- T002: `gridLayout.ts` + mocha exhaustive (7 cases per Story 2).

### Phase 3 — Service + interface
- T003: `missionControl.ts` interface.
- T004: `missionControlService.ts` impl + mocha (toggle, slot reflow).

### Phase 4 — Contrib (command + context key)
- T005: `missionControl.contribution.ts` registra comando, context key, sincroniza.

### Phase 5 — Wiring
- T006: registra singleton em `nzr.contribution.ts` (junta com 0003); import em `workbench.common.main.ts`.

### Phase 6 — Verify
- T007: GREEN + evidence + push + PR.

## Risks and mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| Context key não sincroniza com service state | M | M | Service subscribe + listener fire em ambos os toggles; mocha test cobre |
| Slot reflow recomputa caro com 1000 stations | L | L | n <= 100 na prática; O(n) é ok |
| Comando duplicado no command palette (já registrado) | L | L | id namespaced `nzr.*` |

## Complexity tracking

Vazio.

## Hand-off

`tasks`. 7 tasks.
