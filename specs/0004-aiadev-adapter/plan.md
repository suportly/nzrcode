# Implementation plan: AIADev CLI adapter + spec watcher

**Branch:** `feature/0004-aiadev-adapter`
**Date:** 2026-05-14
**Spec:** [spec.md](./spec.md)
**Plan version:** 1
**Language:** pt-BR

---

## Summary

5 arquivos novos (types, interface, impl Electron, pure parser, electron contribution + mocha test) + 1 import line em `workbench.desktop.main.ts`. ~7 tasks.

## Technical context

| Field | Value |
|---|---|
| Active preset | lean |
| Language / runtime | TypeScript / Node.js 18 (`child_process`) — Electron renderer com Node |
| Primary deps | `child_process` (built-in), `IFileService`, `IWorkspaceContextService`, `Emitter`, `Disposable` — sem nova dep NPM |
| Storage | N/A — output do CLI in-memory; events para consumers |
| Testing | Mocha para parser puro; smoke shell para shape |
| Target platform(s) | Desktop apenas (`workbench.desktop.main.ts`) — child_process não funciona em web |
| Performance budget | spawn < 50ms; preflight típico < 1s; timeout default 30s |
| Security | Spawn com `shell: false`; argv array (sem injection); sem string concat |

## Constitution check

| Article | Status | Evidence |
|---|---|---|
| I. Spec-first | PASS | spec clarificado |
| II. Test-first | PASS | T001 RED antes da impl |
| III. Simplicity | PASS | Adapter primitivo; orquestração em outra feature |
| IV. Evidence | PASS | parser puro com mocha; smoke documenta CLI absence |
| V. Provider pattern | PASS | `IAiadevAdapter` é provider; impl substituível em test |
| VI. Privacy | PASS | Não loga repoPath em telemetria |
| VII. Attribution | N/A | — |

## Architecture decisions

### ADR-1 — Parser puro separado do adapter Electron

**Decisão:** `clarifyMarkerParser.ts` em `common/` (pura, sem DI); `aiadevAdapter.ts` consome.

**Rationale:** Permite testes mocha extensivos sem mocks.

### ADR-2 — `child_process.spawn` com `shell: false`

**Decisão:** `spawn(bin, args, { shell: false })`.

**Rationale:** mata vector de injection; argv array; streams stdout/stderr.

### ADR-3 — Timeout via `setTimeout` + escalação de sinal

**Decisão:** 30s → SIGTERM; +5s → SIGKILL.

**Rationale:** SIGTERM permite flush; SIGKILL é fallback.

### ADR-4 — Section discovery por backward-scan

**Decisão:** Para cada marker, scan reverso até `^## ` — esse é `section`.

**Rationale:** Templates AIADev usam level-2 consistentemente.

### ADR-5 — Eventos via `Emitter`

**Decisão:** 3 emitters (`_onClarifyMarkersDetected`, `_onSpecChanged`, `_onAdapterError`).

**Rationale:** Padrão VS Code.

## Project structure changes

```text
src/vs/platform/nzr/common/aiadev.ts                                       (new)
src/vs/platform/nzr/common/aiadevAdapter.ts                                (new)
src/vs/workbench/services/nzr/common/clarifyMarkerParser.ts                (new)
src/vs/workbench/services/nzr/electron-browser/aiadevAdapter.ts            (new)
src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts(new)
src/vs/workbench/services/nzr/test/common/clarifyMarkerParser.test.ts      (new)
src/vs/workbench/workbench.desktop.main.ts                                 (modified — 1 import)
test/nzrcode-adapter/{test_files_exist,test_interface_shape,
  test_parser,test_registration,run_all}.sh + README.md                    (new)
```

## Phase breakdown

### Phase 1 — RED
- T001: smoke shell + mocha stub.

### Phase 2 — Pure parser + tests
- T002: `clarifyMarkerParser.ts`.
- T003: mocha test 5 casos.

### Phase 3 — Types + interface
- T004: `aiadev.ts` + `aiadevAdapter.ts`.

### Phase 4 — Impl + wiring
- T005: electron-browser impl.
- T006: contribution + import.

### Phase 5 — Verify
- T007: GREEN + evidence + PR.

## Risks and mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| Spawn falha em renderer | L | H | Dev build smoke confirma |
| Watcher leak em dispose | L | M | DisposableStore + ensureNoDisposablesLeaked no test |
| Parser greedy demais | M | M | Test cases T003 cobrem escape/aspas |
| aiadev versão muda flags | L | L | Subcomandos estáveis; falha graceful |

## Complexity tracking

Vazio.

## Hand-off

`tasks`. 7 tasks.
