# Implementation plan: Claude Code bridge

**Branch:** `feature/0005-claude-code-bridge`
**Date:** 2026-05-14
**Spec:** [spec.md](./spec.md)
**Plan version:** 1
**Language:** pt-BR

---

## Summary

4 arquivos novos + 1 modificado (a contribution já existente da 0004). ~6 tasks. Reusa todo o pattern de spawn/timeout que a 0004 estabeleceu — não introduz abstração nova entre os dois bridges (poderia ser tentação prematura; ADR-1 explica por que não).

## Technical context

| Field | Value |
|---|---|
| Active preset | lean |
| Language / runtime | TypeScript / Node.js 18 (`child_process`) — Electron renderer |
| Primary deps | `child_process`, `Emitter`, `Disposable`, `URI`, `generateUuid` — sem nova dep NPM |
| Storage | N/A — output em memory; events para consumer |
| Testing | Mocha (lifecycle, cancel, ENOENT, paralelo) + smoke shell |
| Target platform(s) | Desktop apenas (`workbench.desktop.main.ts` — child_process) |
| Performance budget | spawn < 50ms; chunk latency sub-second |
| Security | `shell: false`; consumer responsável por sanitizar `extraArgs` |

## Constitution check

| Article | Status | Evidence |
|---|---|---|
| I. Spec-first | PASS | spec clarificado |
| II. Test-first | PASS | T001 RED |
| III. Simplicity | PASS | Sem abstração entre bridges (0004 e 0005 são serviços separados) |
| IV. Evidence | PASS | mocha + smoke documentam comportamento |
| V. Provider | PASS | `IClaudeCodeBridge` é provider para o CLI claude (substituível em test) |
| VI. Privacy | PASS | Não loga prompt nem repoPath em telemetria |
| VII. Attribution | N/A | — |

## Architecture decisions

### ADR-1 — Não consolidar com AiadevAdapter

**Decisão:** `ClaudeCodeBridge` é serviço independente, mesmo que ~70% do código de spawn seja parecido com `AiadevAdapter`.

**Rationale:** consolidar prematuramente cria uma abstração `IExternalCliProvider` que pesa em tudo. As duas APIs são semanticamente diferentes (preflight é one-shot vs. session com lifecycle multi-evento). Article III (Simplicity): "três linhas similares > abstração prematura". Refatoramos se um terceiro CLI bridge aparecer.

### ADR-2 — Sessão tem id próprio, separado do `stationId`

**Decisão:** `sessionId` é UUID v4 gerado pelo bridge; `stationId` agrupa.

**Rationale:** uma station pode ter múltiplas sessions concorrentes (usuário cancela uma e abre outra antes da primeira sair). Eventos carregam ambos.

### ADR-3 — Streaming via Emitter por evento + concat no result final

**Decisão:** `onSessionOutput` emite chunks em real-time; também acumulamos `stdout`/`stderr` em strings para `onSessionExit.result`.

**Rationale:** consumer escolhe o modo. UI render incremental (chunks); script de validação consome só o resultado.

### ADR-4 — Timeout via setTimeout + SIGTERM/SIGKILL (mesmo padrão da 0004)

**Decisão:** 300s default; SIGTERM → 5s grace → SIGKILL.

**Rationale:** consistência com adapter; testado conceitualmente em 0004.

### ADR-5 — Bridge não injeta `IStationRegistryService`

**Decisão:** caller passa `stationId` + `repoPath` nos opts.

**Rationale:** desacopla bridge do registry; bridge é testável standalone sem mockar o registry inteiro.

## Project structure changes

```text
src/vs/platform/nzr/common/claudeCode.ts                                   (new)
src/vs/platform/nzr/common/claudeCodeBridge.ts                             (new)
src/vs/workbench/services/nzr/electron-browser/claudeCodeBridge.ts         (new)
src/vs/workbench/services/nzr/test/common/claudeCodeBridge.test.ts         (new)
src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts(modified — +1 registerSingleton)
test/nzrcode-claude/{test_files_exist,test_interface_shape,
  test_registration,run_all}.sh + README.md                                (new)
```

## Phase breakdown

### Phase 1 — RED
- T001: smoke shell (3 sub-tests) + mocha stub.

### Phase 2 — Types + interface
- T002: `claudeCode.ts` (types) + `claudeCodeBridge.ts` (interface).

### Phase 3 — Impl
- T003: `claudeCodeBridge.ts` electron impl (spawn + sessões + emitters).

### Phase 4 — Mocha test
- T004: 5 casos (lifecycle, cancel, ENOENT, parallel, resume).

### Phase 5 — Registro + verify
- T005: adiciona `registerSingleton` à contribution existente.
- T006: GREEN + push + PR.

## Risks and mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| Race entre cancel e exit natural | M | L | Estado da sessão guardado em Map; transitions são atômicas dentro do close handler |
| Memory leak — sessões finalizadas não removidas do Map | M | M | `onSessionExit` remove a entrada após emit |
| Spawn no Windows com argv contendo espaços | L | M | `shell: false` + argv array; Node lida com escaping no Windows |
| Mocha test fica intermitente por timing | M | M | Usa `await timeout()` mínimo; cleanup via DisposableStore |

## Complexity tracking

Vazio.

## Hand-off

`tasks`. 6 tasks.
