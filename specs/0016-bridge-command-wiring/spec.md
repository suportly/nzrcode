# Spec 0016 — Bridge Command Wiring

**Branch:** `feature/0016-bridge-command-wiring`
**Base:** `main` (post-merge of features 0001-0015)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Goal

Wire the bridge extension's command activations end-to-end. Three
commands are declared in `extensions/nzrcode-bridge/package.json`
(`nzrcode-bridge.pairIpad`, `nzrcode-bridge.listPairedDevices`,
`nzrcode-bridge.revokeIpad`) and all three orchestrators
(`runPairCommand`, `runListPairedDevicesCommand`,
`runRevokeIpadCommand`) exist in `src/pairing/`, but `extension.ts`
never calls `vscode.commands.registerCommand` for any of them.
Running them from the palette today triggers VS Code's "command 'X'
not found" error.

This PR closes that gap for the **list** and **revoke** commands.
**Pair** stays a follow-up — its orchestrator demands a
`pairingSignal: Promise<PairingResult>` on the running bridge that
`maybeStartBridge` does not yet expose, so wiring pair is a larger
refactor.

## In scope

1. **Activate-time scaffolding** in `extension.ts`:
   - Build a `PairedDeviceStore` from `context.globalState` and
     `context.secrets`.
   - Track the (possibly undefined) `BridgeRuntime` so the revoke
     flow can stop it.
2. **Register `nzrcode-bridge.listPairedDevices`**:
   - Wraps `runListPairedDevicesCommand` with vscode adapters
     (`vscode.window.showQuickPick`, `vscode.window.showInformationMessage`,
     `Date.now`).
   - The QuickPick items use `humaniseLastSeen` already exposed by
     `listCommand.ts`.
3. **Register `nzrcode-bridge.revokeIpad`**:
   - Wraps `runRevokeIpadCommand` with vscode adapters plus:
     - `confirmRevoke` via `vscode.window.showWarningMessage(..., { modal: true })`.
     - `revokeDevice(deviceId)` → `store.revoke(deviceId)`.
     - `dropActiveConnections()` → if a runtime is live, `await runtime.stop()` and set the local ref to `undefined`.
     - `rotateToken()` → `state.rotateToken()`.
   - The revoke flow does not restart the bridge after the token rotation; pairing again requires the user to run `Pair iPad` (which doesn't ship in this PR — see Out of scope).
4. **`context.subscriptions.push`** for every registered command so
   they are disposed cleanly when the extension deactivates.

## Out of scope (deferred)

- **`nzrcode-bridge.pairIpad` wiring.** The orchestrator needs a
  `BridgeRuntimeHandle` with a `pairingSignal: Promise<PairingResult>`.
  Today `maybeStartBridge` returns a `BridgeRuntime` without that
  signal — exposing it requires touching the dispatcher (a new
  `system.register` handler) and the runtime contract. Tracked as a
  follow-up.
- **Restarting the bridge after revoke.** Once `runtime.stop()` runs
  and the token rotates, the bridge stays down until the user
  invokes `Pair iPad` (also out of scope). A separate follow-up can
  call `maybeStartBridge` again to keep the listener up.
- **A `BridgeWsServer.dropAllConnections()` method that closes
  sockets without stopping the listener** (so revoke doesn't take
  the server down). Larger surface change; defer.
- **Localizing the command titles** beyond what `package.nls.json`
  already provides.
- **A new mocha layer for the adapter wiring** — the orchestrators
  are already unit-tested; the wiring is a thin glue layer asserted
  via grep.

## Non-goals

- **No new NPM dependencies.**
- **No new telemetry events.**
- **No changes to existing protocol** (state.ts schema, RPC methods, etc.).
- **No changes to declared commands in `package.json`** — those
  three entries stay as-is.

## Inputs / dependencies

- `extensions/nzrcode-bridge/src/extension.ts` — current activate/deactivate.
- `extensions/nzrcode-bridge/src/pairing/pairedDevices.ts` — `PairedDeviceStore`.
- `extensions/nzrcode-bridge/src/pairing/listCommand.ts` — `runListPairedDevicesCommand`, `humaniseLastSeen`.
- `extensions/nzrcode-bridge/src/pairing/revokeCommand.ts` — `runRevokeIpadCommand`, `RevokeIpadDeps`.
- `extensions/nzrcode-bridge/src/server/state.ts` — `rotateToken`.
- `extensions/nzrcode-bridge/src/bridge.ts` — `BridgeRuntime`.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-command-wiring/run_all.sh` exits 0.
- [ ] `extension.ts` calls `vscode.commands.registerCommand` exactly
      twice in this PR: once for `nzrcode-bridge.listPairedDevices`,
      once for `nzrcode-bridge.revokeIpad`.
- [ ] Both registrations are pushed onto `context.subscriptions`.
- [ ] `extension.ts` constructs a `PairedDeviceStore` from
      `context.globalState` + `context.secrets`.
- [ ] No new NPM deps.
- [ ] All prior NZR smoke suites still pass.

## Clarifications (resolved via brief-default judgment)

- **cl-1: Should the revoke confirmation use `IDialogService.confirm`
  or `vscode.window.showWarningMessage`?**
  Resolved: **`showWarningMessage` with `{ modal: true }`**. The
  extension only has the standard `vscode` API; the workbench-level
  `IDialogService` isn't reachable from an extension host.
- **cl-2: What does `dropActiveConnections` do when the bridge
  runtime is undefined (no live listener)?**
  Resolved: **no-op**. If the runtime never started (no prior pair),
  there are no connections to drop; revoke can proceed straight to
  token rotation.
- **cl-3: Should revoke also restart the bridge automatically?**
  Resolved: **No, out of scope** (see Out of scope). The next pair
  attempt will re-bind via `maybeStartBridge`. Documented in the
  user-facing notification ("Token rotated — other paired devices
  must re-pair.").
- **cl-4: Where does the `PairedDeviceStore` live across the
  extension lifecycle?**
  Resolved: **a module-level `let _store: PairedDeviceStore | undefined`**
  next to the existing `_runtime`. Same pattern; same teardown.
- **cl-5: Should we localize the "Pair iPad" / "List Paired Devices" /
  "Revoke iPad" command titles in `package.nls.json`?**
  Resolved: **No — already localized**. `package.json` references
  `%command.pairIpad%` etc.; those localization keys are existing
  surface and stay untouched.

## Risks

- **R1:** Without a dev build we cannot manually exercise the palette
  triggers. **Mitigation:** smoke greps assert the wiring shape;
  unit tests for the orchestrators already cover behavior.
- **R2:** Disposing `BridgeRuntime` mid-revoke could leave the socket
  in a half-closed state. **Mitigation:** `runtime.stop()` is the
  existing graceful-shutdown path (closes connections, waits up to
  1 s, terminates stragglers).
- **R3:** If the user invokes `Revoke iPad` before pairing anything,
  `_runtime` is undefined and the command lists zero devices.
  **Mitigation:** existing `runRevokeIpadCommand` short-circuits
  with the "No paired devices to revoke." info message.
