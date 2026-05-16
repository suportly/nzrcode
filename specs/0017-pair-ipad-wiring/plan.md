# Plan 0017 — Pair iPad Wiring

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0017-pair-ipad-wiring`
**Generated:** 2026-05-16
**Language:** pt-BR

## Architecture sketch

```
extensions/nzrcode-bridge/src/
  protocol/methods.ts                                  # MODIFY
    └─ + MethodName.SystemRegister = 'system.register'
       + MethodParams[SystemRegister] = {deviceId, deviceName, apnsToken?}
       + MethodResult[SystemRegister] = {registered: true}

  pairing/pairingController.ts                         # CREATE
    ├─ class PairingController
    │     ├─ pairingSignal: Promise<PairingResult>
    │     ├─ _resolve?: (result: PairingResult) => void
    │     ├─ createHandler(): Handler<SystemRegister>
    │     └─ resolved: boolean (one-shot)

  bridge.ts                                            # MODIFY
    └─ + startPairableBridge(deps): Promise<BridgeRuntimeHandle>
       - always binds (no fs.existsSync check)
       - constructs PairingController
       - dispatcher.register(SystemRegister, controller.createHandler())
       - saveState({...state, lastPort: server.port})
       - returns {port, pairingSignal, dispose}

  extension.ts                                         # MODIFY
    └─ + registerPairCommand(context, store, channel) (calls runPairCommand)
       includes vscode webview adapter

extensions/nzrcode-bridge/src/test/unit/
  pairingController.test.ts                            # CREATE

test/nzrcode-pair-wiring/
  run_all.sh
  test_files_exist.sh
  test_protocol_extended.sh        # greps for SystemRegister in protocol
  test_pair_wired.sh               # greps extension.ts + bridge.ts wiring
  test_no_new_deps.sh
  README.md
```

## Key design decisions

### DD-1: A separate `system.register` instead of repurposing `notifications.register`

`notifications.register` already exists with params `{deviceId, apnsToken}`. Reusing it would mean the pair signal fires every time a client refreshes its apnsToken (not just at pair time). A dedicated `system.register` keeps the semantics clean: it fires exactly once per pair flow.

### DD-2: PairingController is one-shot

The controller's `pairingSignal` resolves at most once. After resolution, subsequent `system.register` calls succeed at the RPC layer (return `{registered: true}`) but are no-ops on the controller. This matches `runPairCommand`'s single-await usage.

### DD-3: `startPairableBridge` is a NEW function, not a rewrite of `maybeStartBridge`

`maybeStartBridge` stays the activation-time path (only binds when state file exists). The two paths share `loadOrCreateState` and `startBridgeWsServer` but diverge on when to bind and whether to surface the pair signal. Splitting keeps `maybeStartBridge` simple and the pair-specific logic explicit.

### DD-4: The webview adapter is inline in `extension.ts`

The pair flow only needs `createWebviewPanel` + `panel.dispose()`. Extracting a helper would buy nothing testable (vscode API mock would dominate the test). Inline keeps the wiring obvious.

### DD-5: `extension.ts` does NOT replace `_runtime` when pair starts

The pair flow constructs its own runtime via `startPairableBridge` and disposes it when the QR webview closes. The module-level `_runtime` (from `maybeStartBridge`) is left untouched if it was set. This avoids cross-contamination between the activation-time runtime and the pair-time runtime.

(Edge case: if `_runtime` is already running and the user pairs, we briefly have two listeners. Each binds to its own ephemeral port — fine for an OS-assigned-port server. A later refactor can deduplicate; for v1, the simpler model wins.)

## Compile-and-test strategy

- **Unit (mocha):** `pairingController.test.ts` covers:
  - `pairingSignal` resolves on first register call.
  - Result carries deviceId + deviceName + apnsToken.
  - Second register call returns `{registered: true}` but does not re-resolve.
- **Structural (smoke):** shell greps for protocol additions, controller export, bridge entry point, extension wiring, no-new-deps.
- **Visual (dev build):** **DEFERRED** — pair-from-palette manual test requires a real iPad client.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `extensions/nzrcode-bridge/src/protocol/methods.ts` | modify | + SystemRegister enum/params/result |
| `extensions/nzrcode-bridge/src/pairing/pairingController.ts` | create | one-shot controller + handler factory |
| `extensions/nzrcode-bridge/src/bridge.ts` | modify | + startPairableBridge |
| `extensions/nzrcode-bridge/src/extension.ts` | modify | register pairIpad command |
| `extensions/nzrcode-bridge/src/test/unit/pairingController.test.ts` | create | mocha |
| `test/nzrcode-pair-wiring/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0017-pair-ipad-wiring/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 5 clarifications resolved, 3 risks declared.
- **II (Test-first):** T001 RED smoke + mocha stub → T002 protocol green → T003 controller green → T004 bridge green → T005 extension green.
- **III (Simplicity):** zero new deps; one new RPC method; one new controller class; one new bridge entry point.
- **IV (Evidence):** run-all output captured in T006.
- **V (Provider):** no provider switch.
- **VI (Privacy):** apnsToken still passes through `PairedDeviceStore.attachApnsToken` only (SecretStorage).
- **VII (Attribution):** original to NZRCode.
