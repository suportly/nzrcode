# Spec 0017 — Pair iPad Wiring

**Branch:** `feature/0017-pair-ipad-wiring`
**Base:** `main` (post-merge of features 0001-0016)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Goal

Close the last bridge palette gap: register `nzrcode-bridge.pairIpad`
end-to-end so the user can pair a new iPad from the command palette.
Today the orchestrator (`runPairCommand`) exists but cannot run
because `maybeStartBridge` returns a `BridgeRuntime` without the
`pairingSignal: Promise<PairingResult>` the orchestrator needs.

This PR introduces the missing piece: a new `system.register` RPC
method that the iPad calls after `system.authenticate`, plus a
`PairingController` that converts the next register call into the
pair signal. With those, `extension.ts` registers the command and
wires it through `runPairCommand`.

## In scope

1. **Protocol** (`extensions/nzrcode-bridge/src/protocol/methods.ts`):
   - Add `MethodName.SystemRegister = 'system.register'`.
   - `MethodParams[SystemRegister]` = `{ readonly deviceId: string; readonly deviceName: string; readonly apnsToken?: string }`.
   - `MethodResult[SystemRegister]` = `{ readonly registered: true }`.
2. **PairingController** (`extensions/nzrcode-bridge/src/pairing/pairingController.ts`):
   - Owns a one-shot `pairingSignal: Promise<PairingResult>` and a
     hidden `_resolve` reference.
   - Exposes a `Handler<SystemRegister>` factory that, on the first
     call, resolves the signal with the params (mapping `deviceId`,
     `deviceName`, optional `apnsToken`).
   - Subsequent calls are no-ops (the signal is already fired). They
     return `{registered: true}` so the protocol stays stable.
3. **`startPairableBridge`** in `bridge.ts`:
   - Replaces `maybeStartBridge` for the pair-flow path: always
     starts the WS server (does not check whether state file
     exists), constructs a `PairingController`, registers the
     `system.register` handler on the dispatcher, persists the
     `lastPort`, and returns a `BridgeRuntimeHandle` matching the
     shape `runPairCommand` expects:
     - `port: number`
     - `pairingSignal: Promise<PairingResult>`
     - `dispose(): Promise<void>` — `server.stop()` cleanup.
4. **`extension.ts`** wiring:
   - Register `nzrcode-bridge.pairIpad` → `runPairCommand(deps)`.
   - The deps object pulls `loadOrCreateState` from `./server/state`,
     `startPairableBridge` from `./bridge`, `discoverEndpoints` from
     `./pairing/endpoints`, builds a `PairWebviewHandle` from
     `vscode.window.createWebviewPanel`, and delegates
     `registerDevice` + `attachApnsToken` to the existing
     `PairedDeviceStore`.
   - Push the disposable onto `context.subscriptions`.
5. **i18n:** no new visible strings beyond the command title (already
   localized via `package.nls.json` from feature 0009).

## Out of scope (deferred)

- **Replacing `notifications.register` with `system.register`** for
  apnsToken attachment. Both methods can coexist — `system.register`
  fires at pair time; `notifications.register` is still the canonical
  way to refresh apnsToken later in the session. `system.register`
  may attach the apnsToken on the first call (when provided) as a
  convenience.
- **Per-device tokens**: still tracked as `decision-0015-1`. This PR
  uses the shared token model that's already on main.
- **Replacing the existing `maybeStartBridge` everywhere**:
  `maybeStartBridge` stays as the activation-time path (only binds
  when state exists). The new `startPairableBridge` is the
  user-triggered path (always binds + exposes the pair signal).
- **Animating the QR webview or styling beyond what `renderQrWebviewHtml` already produces.**
- **Cross-window racing**: if the user runs `Pair iPad` twice
  concurrently we don't dedupe. The second call's webview just
  overlays the first.

## Non-goals

- **No new NPM dependencies.**
- **No new telemetry events.**
- **No changes to the dispatcher's auth gate.**
- **No changes to `notifications.register`'s existing semantics.**

## Inputs / dependencies

- `extensions/nzrcode-bridge/src/protocol/methods.ts` — method enum + types.
- `extensions/nzrcode-bridge/src/server/dispatcher.ts` — `Dispatcher.register`.
- `extensions/nzrcode-bridge/src/server/wsServer.ts` — `startBridgeWsServer`.
- `extensions/nzrcode-bridge/src/server/state.ts` — `loadOrCreateState`, `saveState`.
- `extensions/nzrcode-bridge/src/pairing/pairCommand.ts` — `runPairCommand`, `PairCommandDeps`, `BridgeRuntimeHandle`, `PairingResult`.
- `extensions/nzrcode-bridge/src/pairing/endpoints.ts` — `discoverEndpoints`.
- `extensions/nzrcode-bridge/src/pairing/qrModal.ts` — `buildQrPayloadFromEndpoints`, `renderQrWebviewHtml`.
- `extensions/nzrcode-bridge/src/pairing/pairedDevices.ts` — `PairedDeviceStore`.
- `extension.ts` — wiring site.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-pair-wiring/run_all.sh` exits 0.
- [ ] `MethodName.SystemRegister` declared with the documented param/result shapes.
- [ ] `PairingController` exposes `pairingSignal: Promise<PairingResult>` and a `Handler<SystemRegister>` factory.
- [ ] `startPairableBridge` returns the runtime handle shape `runPairCommand` expects.
- [ ] `extension.ts` calls `vscode.commands.registerCommand('nzrcode-bridge.pairIpad', …)` exactly once and pushes the disposable onto `context.subscriptions`.
- [ ] Mocha covers `PairingController` for: first register resolves the signal, second register is a no-op, the signal carries deviceName.
- [ ] `bash test/nzrcode-bridge/run_all.sh` still green.
- [ ] All prior NZR smoke suites still pass.

## Clarifications (resolved via brief-default judgment)

- **cl-1: Does the pair signal time out?**
  Resolved: **no timeout in this PR**. `runPairCommand` awaits
  `bridge.pairingSignal` unconditionally; the user dismissing the
  webview closes the panel but the awaiter stays alive. A cancel
  token / timeout is a separate concern (the user can rerun the
  command).
- **cl-2: When `system.register` fires after the pair signal is
  already resolved (e.g., the same device reconnects), does it
  re-resolve a fresh signal?**
  Resolved: **no — second+ register calls are no-ops on the
  controller**. The controller is a one-shot. A second `Pair iPad`
  invocation creates a fresh controller.
- **cl-3: Should the `system.register` handler also call
  `PairedDeviceStore.register`?**
  Resolved: **no**. The orchestrator (`runPairCommand`) already
  calls `registerDevice` via deps after the pairing signal
  resolves. Putting the register call in the RPC handler would
  duplicate persistence and defeat the dep-injection seam.
- **cl-4: Where does the webview live — editor area or modal?**
  Resolved: **editor area** via `vscode.window.createWebviewPanel`,
  `ViewColumn.One`. Modal would block the user while they scan the
  QR; the editor-area pane lets them see the QR + the output
  channel side-by-side.
- **cl-5: Should `system.register` overwrite an existing pairing
  entry for the same deviceId?**
  Resolved: **yes (via PairedDeviceStore.register's existing
  upsert)**. The store already updates `deviceName + lastSeenAt`
  for an existing deviceId; we delegate to it.

## Risks

- **R1:** A malicious client could authenticate (with the shared
  token) and call `system.register` to inject a fake pairing entry.
  **Mitigation:** the shared-token model already trusts every
  authenticated client; per-device tokens (`decision-0015-1`)
  removes this exposure.
- **R2:** `vscode.window.createWebviewPanel` requires the extension
  host to be active; in some embedder builds it might be
  unavailable. **Mitigation:** if the panel creation throws, we
  catch and surface an error message; the bridge runtime is still
  cleaned up.
- **R3:** Without a dev build we cannot run the visual pair flow.
  **Mitigation:** unit-test the controller exhaustively; integration
  tests on the bridge already cover the auth path; the webview is
  inert (no scripts).
