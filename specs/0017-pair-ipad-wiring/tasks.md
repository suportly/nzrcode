# Tasks 0017 — Pair iPad Wiring

**Branch:** `feature/0017-pair-ipad-wiring`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stub (RED)
- **Status:** done
- **Files:**
  - create: `test/nzrcode-pair-wiring/{test_files_exist,test_protocol_extended,test_pair_wired,test_no_new_deps,run_all}.sh`
  - create: `test/nzrcode-pair-wiring/README.md`
  - create: `extensions/nzrcode-bridge/src/test/unit/pairingController.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh` references the future source files.
  - [ ] `test_protocol_extended.sh` greps protocol/methods.ts for `SystemRegister = 'system.register'`, the params shape, and the result shape.
  - [ ] `test_pair_wired.sh` greps `extension.ts` for `registerCommand('nzrcode-bridge.pairIpad'` and `runPairCommand`, and `bridge.ts` for `export async function startPairableBridge`.
  - [ ] `test_no_new_deps.sh` passes.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-bridge): T001 add pair-wiring smoke + mocha stub (RED)`.

### T002 — Protocol: add SystemRegister
- **Status:** done
- **Depends on:** T001
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/protocol/methods.ts`
- **Acceptance:**
  - [ ] `enum MethodName` gains `SystemRegister = 'system.register'`.
  - [ ] `MethodParams[SystemRegister]` = `{ deviceId: string; deviceName: string; apnsToken?: string }` (all readonly).
  - [ ] `MethodResult[SystemRegister]` = `{ registered: true }` (readonly).
  - [ ] Commit: `feat(nzr-bridge): T002 add system.register protocol method`.

### T003 — PairingController + handler
- **Status:** done
- **Depends on:** T002
- **Files:**
  - create: `extensions/nzrcode-bridge/src/pairing/pairingController.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/pairingController.test.ts`
- **Acceptance:**
  - [ ] Exports `class PairingController` with public `pairingSignal: Promise<PairingResult>`.
  - [ ] `createHandler(): Handler<MethodName.SystemRegister>` resolves the signal on first call (with `{ deviceId, deviceName, apnsToken }` from params) and is a no-op resolution-wise on subsequent calls.
  - [ ] Mocha covers: first register resolves signal, second register returns `{registered: true}` without re-resolving, deviceName + apnsToken propagate.
  - [ ] Commit: `feat(nzr-bridge): T003 add PairingController + system.register handler`.

### T004 — startPairableBridge in bridge.ts
- **Status:** done
- **Depends on:** T003
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/bridge.ts`
- **Acceptance:**
  - [ ] Exports `function startPairableBridge(deps): Promise<BridgeRuntimeHandle>` where `BridgeRuntimeHandle` is the shape from `pairCommand.ts` (`port`, `pairingSignal`, `dispose`).
  - [ ] Loads state via `loadOrCreateState`, constructs a `Dispatcher`, registers system handlers + the `PairingController.createHandler()`, starts the WS server, persists `lastPort`.
  - [ ] `dispose()` calls `server.stop()`.
  - [ ] `maybeStartBridge` stays unchanged.
  - [ ] Commit: `feat(nzr-bridge): T004 add startPairableBridge with pairingSignal`.

### T005 — Wire pairIpad in extension.ts
- **Status:** done
- **Depends on:** T004
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/extension.ts`
- **Acceptance:**
  - [ ] Registers `nzrcode-bridge.pairIpad` via `vscode.commands.registerCommand`; disposable pushed onto `context.subscriptions`.
  - [ ] Handler delegates to `runPairCommand` with the documented deps (`loadOrCreateState`, `startPairableBridge`, `discoverEndpoints`, webview adapter via `vscode.window.createWebviewPanel`, `registerDevice`/`attachApnsToken` from `PairedDeviceStore`, `showInformationMessage`).
  - [ ] Smoke + bridge mocha green; all prior NZR suites still pass.
  - [ ] Commit: `feat(nzr-bridge): T005 wire nzrcode-bridge.pairIpad palette command`.

### T006 — Verify + push + PR
- **Status:** done
- **Depends on:** T005
- **Files:**
  - create: `specs/0017-pair-ipad-wiring/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-pair-wiring/run_all.sh` exit 0.
  - [ ] `bash test/nzrcode-bridge/run_all.sh` still green.
  - [ ] All 11 prior NZR smoke suites still pass.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. Each task depends on the previous.
