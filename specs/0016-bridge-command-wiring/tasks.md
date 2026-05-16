# Tasks 0016 — Bridge Command Wiring

**Branch:** `feature/0016-bridge-command-wiring`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Task list

### T001 — Smoke suite (RED)
- **Status:** pending
- **Files:**
  - create: `test/nzrcode-command-wiring/{test_files_exist,test_commands_wired,test_no_new_deps,run_all}.sh`
  - create: `test/nzrcode-command-wiring/README.md`
- **Acceptance:**
  - [ ] `test_files_exist.sh` references `extensions/nzrcode-bridge/src/extension.ts`.
  - [ ] `test_commands_wired.sh` greps for `vscode.commands.registerCommand(\s*'nzrcode-bridge.listPairedDevices'` and `vscode.commands.registerCommand(\s*'nzrcode-bridge.revokeIpad'`, plus `runListPairedDevicesCommand`, `runRevokeIpadCommand`, and `new PairedDeviceStore`.
  - [ ] `test_no_new_deps.sh` passes.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-bridge): T001 add command-wiring smoke (RED)`.

### T002 — Wire `listPairedDevices` + `revokeIpad` in extension.ts
- **Status:** pending
- **Depends on:** T001
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/extension.ts`
- **Acceptance:**
  - [ ] `activate` constructs `PairedDeviceStore` from `context.globalState` + `context.secrets`, stored in a module-level `_store: PairedDeviceStore | undefined`.
  - [ ] Registers `nzrcode-bridge.listPairedDevices` → `runListPairedDevicesCommand(...)` with `vscode.window.showQuickPick` and `showInformationMessage` adapters; disposable pushed to `context.subscriptions`.
  - [ ] Registers `nzrcode-bridge.revokeIpad` → `runRevokeIpadCommand(...)` with:
        - `confirmRevoke` using `showWarningMessage(..., { modal: true }, 'Revoke') === 'Revoke'`,
        - `revokeDevice` → `_store.revoke(id)`,
        - `dropActiveConnections` → `await _runtime?.stop(); _runtime = undefined;`,
        - `rotateToken` → `rotateToken()` from `./server/state.js`,
        - the standard vscode adapters.
  - [ ] `deactivate` clears `_store` alongside `_runtime`.
  - [ ] `run_all.sh` exits 0; bridge mocha (`test/nzrcode-bridge/run_all.sh`) still passes.
  - [ ] Commit: `feat(nzr-bridge): T002 wire list + revoke palette commands`.

### T003 — Verify + push + PR
- **Status:** pending
- **Depends on:** T002
- **Files:**
  - create: `specs/0016-bridge-command-wiring/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-command-wiring/run_all.sh` exit 0.
  - [ ] All 10 prior NZR smoke suites still pass.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. T002 depends on T001's smoke fixtures.
