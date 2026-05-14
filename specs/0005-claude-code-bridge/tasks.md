# Tasks: Claude Code bridge

**Branch:** `feature/0005-claude-code-bridge`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-14
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stub (RED)
- **Status:** pending
- **Depends on:** —
- **Files:**
  - create: `test/nzrcode-claude/test_files_exist.sh`
  - create: `test/nzrcode-claude/test_interface_shape.sh`
  - create: `test/nzrcode-claude/test_registration.sh`
  - create: `test/nzrcode-claude/run_all.sh`
  - create: `test/nzrcode-claude/README.md`
  - create: `src/vs/workbench/services/nzr/test/common/claudeCodeBridge.test.ts` (stub)
- **Acceptance:**
  - [ ] Files smoke: 4 source files + 1 test file existem.
  - [ ] Interface shape: 6 types em `claudeCode.ts`; `IClaudeCodeBridge` decorator + 4 events + 4 métodos.
  - [ ] Registration smoke: contribution chama `registerSingleton(IClaudeCodeBridge, ...)`.
  - [ ] `run_all.sh` exit 1 inicialmente.
  - [ ] Commit: `test(nzr-claude): T001 add bridge smoke suite + mocha stub (RED)`.

### T002 — Types + interface
- **Status:** pending
- **Depends on:** T001
- **Files:**
  - create: `src/vs/platform/nzr/common/claudeCode.ts`
  - create: `src/vs/platform/nzr/common/claudeCodeBridge.ts`
- **Acceptance:**
  - [ ] `claudeCode.ts` exporta `ClaudeSessionStatus`, `ClaudeSessionOptions`, `ClaudeSessionHandle`, `ClaudeOutputChunk`, `ClaudeSessionResult`, `ClaudeSessionError`.
  - [ ] `claudeCodeBridge.ts` exporta `IClaudeCodeBridge = createDecorator<IClaudeCodeBridge>('nzrClaudeCodeBridge')` + 4 events + 4 métodos.
  - [ ] `test_interface_shape.sh` GREEN.
  - [ ] Commit: `feat(nzr): T002 add IClaudeCodeBridge interface and session types`.

### T003 — Impl Electron
- **Status:** pending
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/services/nzr/electron-browser/claudeCodeBridge.ts`
- **Acceptance:**
  - [ ] `ClaudeCodeBridge extends Disposable implements IClaudeCodeBridge`.
  - [ ] Map<sessionId, entry> guarda estado.
  - [ ] `startSession`: gera uuid, monta argv (`[--resume id]?` + `['-p', prompt]` + `extraArgs`), spawn `claude`, registra handle, conecta listeners stdout/stderr/error/close, emite events.
  - [ ] `cancelSession`: SIGTERM imediato + SIGKILL após 5s; idempotente.
  - [ ] `getSession`: handle frozen / shallow copy.
  - [ ] `listActiveSessions`: filtra status `starting|running`.
  - [ ] dispose() cancela todas as ativas.
  - [ ] Commit: `feat(nzr): T003 implement ClaudeCodeBridge (spawn + streaming)`.

### T004 — Mocha test
- **Status:** pending
- **Depends on:** T003
- **Files:**
  - modify: `src/vs/workbench/services/nzr/test/common/claudeCodeBridge.test.ts`
- **Acceptance:**
  - [ ] 5 testes mocha cobrindo lifecycle, cancel, ENOENT, parallel, resume.
  - [ ] Usa stubs/mocks no nível possível; testes que dependem de `claude` real são marked como integration (skip se não disponível).
  - [ ] Commit: `test(nzr): T004 add ClaudeCodeBridge mocha tests`.

### T005 — Registrar singleton
- **Status:** pending
- **Depends on:** T004
- **Files:**
  - modify: `src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts`
- **Acceptance:**
  - [ ] Adiciona registerSingleton para IClaudeCodeBridge.
  - [ ] `test_registration.sh` GREEN.
  - [ ] Commit: `feat(nzr): T005 register ClaudeCodeBridge singleton`.

### T006 — Verify + push + PR #5
- **Status:** pending
- **Depends on:** T005
- **Files:**
  - create: `specs/0005-claude-code-bridge/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-claude/run_all.sh` exit 0.
  - [ ] Suites 0001-0004 sem regressão.
  - [ ] PR stacked contra `feature/0004-...`.

## Parallelization hints

Serial.
