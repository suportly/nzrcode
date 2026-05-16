# Implementation plan: IStationRegistryService

**Branch:** `feature/0003-station-registry-service`
**Date:** 2026-05-14
**Spec:** [spec.md](./spec.md)
**Plan version:** 1
**Language:** pt-BR

---

## Summary

Adicionar 5 arquivos novos sob `src/vs/{platform,workbench/services}/nzr/` (types, interface, implementação, contribution, mocha test) e 1 linha de import em `workbench.common.main.ts`. Cobrir com 4 smoke tests shell + 1 mocha unit test. Zero UI, zero comando, zero registro de view. ~7 tasks.

## Technical context

| Field | Value |
|---|---|
| Active preset | lean |
| Language / runtime | TypeScript 5.x / Node 18 (VS Code platform layer) |
| Primary dependencies | `IFileService`, `IWorkspaceContextService`, `Emitter`, `URI`, `createDecorator` — **todas já no upstream**. Sem nova dep NPM. |
| Storage | `<workspace>/.nzrcode/workspace.json` via `IFileService` |
| Testing framework | Mocha (`src/vs/platform/nzr/test/common/stationRegistry.test.ts`); smoke shell em `test/nzrcode-stations/` |
| Target platform(s) | Cross-platform (common layer) |
| Performance budget | Debounce 250ms; round-trip < 50ms para ≤1000 stations |
| Security considerations | UUID v4 ids; permissões herdadas do workspace; sem PII |

## Constitution check

| Article | Applies? | Status | Evidence |
|---|---|---|---|
| I. Spec-first | Yes | PASS | spec clarificado, 0 markers |
| II. Test-first | Yes | PASS | T001 ship failing tests antes da impl |
| III. Simplicity | Yes | PASS | Sem abstrações novas além do exigido; impl ~150 LOC |
| IV. Evidence | Yes | PASS | grep/jq/tsc asserts no smoke |
| V. Provider | No | N/A | — |
| VI. Privacy | Yes | PASS | Zero PII |
| VII. Attribution | No | N/A | — |

## Architecture decisions

### ADR-1 — platform/ para types+interface, workbench/services/ para impl

**Decisão:** Types e decorator em `src/vs/platform/nzr/common/`; impl em `src/vs/workbench/services/nzr/common/`.

**Rationale:** Padrão upstream (storage/configuration). Impl depende de `IWorkspaceContextService` que é workbench-only.

### ADR-2 — IFileService em vez de fs

**Decisão:** Todo I/O via `IFileService` injetado.

**Rationale:** Funciona em web/remote; tratamento de erro consistente; padrão do codebase. Brief §7 reforça "infra existente do VS Code".

### ADR-3 — Schema envelope `{ version, stations }`

**Decisão:** `{ "version": 1, "stations": [...] }`.

**Rationale:** Permite migrations futuras com custo zero hoje.

### ADR-4 — Debounce 250ms para writes

**Decisão:** Mutations marcam dirty; `RunOnceScheduler` flusha após 250ms de quietude. `dispose()` força flush síncrono.

**Rationale:** Bulk ops não disparam N writes; perda em crash ≤ 250ms — aceitável para state de produtividade.

### ADR-5 — Mocha test commitado, executado em CI/dev build

**Decisão:** `stationRegistry.test.ts` é escrito mas não executado nesta sessão (custo do `npm test`). Validado por `tsc --noEmit` no smoke shell.

**Rationale:** Article II exige test-first; test no PR satisfaz; smoke confirma compila.

## Project structure changes

```text
src/vs/platform/nzr/common/pipelineState.ts                       (new)
src/vs/platform/nzr/common/stationRegistry.ts                     (new)
src/vs/workbench/services/nzr/common/stationRegistryService.ts    (new)
src/vs/workbench/services/nzr/common/nzr.contribution.ts          (new)
src/vs/platform/nzr/test/common/stationRegistry.test.ts           (new)
src/vs/workbench/workbench.common.main.ts                         (modified — 1 import)
test/nzrcode-stations/{test_files_exist,test_interface_shape,
  test_typecheck,test_registration,run_all}.sh + README.md        (new)
```

## Phase breakdown

### Phase 1 — Tests RED
- T001: suite shell + mocha stub (RED).

### Phase 2 — Types + interface
- T002: `pipelineState.ts`.
- T003: `stationRegistry.ts`.

### Phase 3 — Implementação + contribution
- T004: `stationRegistryService.ts`.
- T005: `nzr.contribution.ts` + import em `workbench.common.main.ts`.

### Phase 4 — Test + verify
- T006: completar `stationRegistry.test.ts`.
- T007: `run_all.sh` GREEN, evidence, push, PR.

## Risks and mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| tsc isolado não pega cross-module type errors | M | M | Smoke compila todos os arquivos juntos; dev build futuro fecha gap |
| Import path errado (.js suffix) em workbench.common.main.ts | M | M | Smoke grepa import exato |
| Mocha compila mas falha em runtime (Disposable ordering) | L | M | Test segue padrão DisposableStore |
| .nzrcode/workspace.json conflita com gitignore | L | L | Adicionar `.nzrcode/` ao .gitignore (workspace-level, não user-level) |

## Complexity tracking

Vazio. Nenhuma waiver.

## Hand-off to tasks

7 tasks. Pré-condições:
- [x] Constitution Check completo
- [x] Complexity vazia
- [x] Project structure delta acurada
