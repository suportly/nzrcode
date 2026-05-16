# Tasks 0018 — Per-Device Tokens

**Branch:** `feature/0018-per-device-tokens`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stubs (RED)
- **Status:** pending
- **Files:**
  - create: `test/nzrcode-per-device-tokens/{test_files_exist,test_schema_v2,test_helpers_present,test_no_new_deps,run_all}.sh`
  - create: `test/nzrcode-per-device-tokens/README.md`
  - create: `extensions/nzrcode-bridge/src/test/unit/perDeviceTokens.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh` references the perDeviceTokens.test.ts and the modified source files.
  - [ ] `test_schema_v2.sh` greps `state.ts` for `tokens: Record` and `version === 2`.
  - [ ] `test_helpers_present.sh` greps `state.ts` for `export function addToken` and `removeToken` and `getTokens`, `auth.ts` for `findTokenMatch`, and asserts `rotateToken` is gone.
  - [ ] `test_no_new_deps.sh` passes.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-bridge): T001 add per-device-tokens smoke + mocha stub (RED)`.

### T002 — Schema v2 + state helpers + tests
- **Status:** pending
- **Depends on:** T001
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/server/state.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/state.test.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/perDeviceTokens.test.ts`
  - delete: `extensions/nzrcode-bridge/src/test/unit/rotateToken.test.ts`
- **Acceptance:**
  - [ ] `BridgeState.tokens: Record<string, string>` replaces `token`; `version: 2`.
  - [ ] `loadOrCreateState` migrates v1 → v2 (wipes the old single token; preserves `lastPort`).
  - [ ] Exports `addToken(deviceId, token): void`, `removeToken(deviceId): boolean`, `getTokens(): Readonly<Record<string, string>>`.
  - [ ] `rotateToken` is removed.
  - [ ] Mocha covers: schema-v2 round-trip, v1→v2 migration drops old token + bumps version + keeps lastPort, addToken upsert, removeToken returns true/false, getTokens returns a copy.
  - [ ] Commit: `feat(nzr-bridge): T002 migrate bridge state to schema v2 with per-device tokens`.

### T003 — `findTokenMatch` in auth.ts
- **Status:** pending
- **Depends on:** T002
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/server/auth.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/auth.test.ts`
- **Acceptance:**
  - [ ] Exports `interface TokenLookupResult { deviceId: string } | { pending: true }`.
  - [ ] Exports `function findTokenMatch(tokens, pendingPairToken | undefined, candidate): TokenLookupResult | undefined` — linear scan with `crypto.timingSafeEqual` per entry, falls through to the optional pending slot.
  - [ ] Returns `{deviceId}` for persistent matches, `{pending: true}` for pending matches, `undefined` otherwise.
  - [ ] Mocha covers: empty map, single-entry match, multi-entry match, no match, pending-pair match, malformed candidate, both pending + map matching the same token (map wins).
  - [ ] Commit: `feat(nzr-bridge): T003 add findTokenMatch for per-device tokens`.

### T004 — Dispatcher uses `lookupToken`
- **Status:** pending
- **Depends on:** T003
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/server/dispatcher.ts`
  - modify: `extensions/nzrcode-bridge/src/server/wsServer.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/dispatcher.test.ts`
- **Acceptance:**
  - [ ] `DispatcherDeps.token: string` becomes `lookupToken: (candidate: string) => TokenLookupResult | undefined`.
  - [ ] `BridgeConnection` gains `authenticatedDeviceId: string | undefined` (getter on the wrapper).
  - [ ] On successful auth, the dispatcher sets the connection's `authenticatedDeviceId` via a new `_setAuthenticatedDeviceId(id)` helper exposed by the wsServer wrapper.
  - [ ] Mocha updates cover both deviceId match and `__pending__` sentinel.
  - [ ] Commit: `feat(nzr-bridge): T004 dispatcher uses per-device lookupToken`.

### T005 — `startPairableBridge` + `PairingController` promotion
- **Status:** pending
- **Depends on:** T004
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/bridge.ts`
  - modify: `extensions/nzrcode-bridge/src/pairing/pairingController.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/pairingController.test.ts`
- **Acceptance:**
  - [ ] `PairingController` accepts an `onPair: (deviceId, pendingPairToken) => void | Promise<void>` constructor arg. The handler invokes `onPair` BEFORE resolving the signal; thrown errors propagate to the handler's promise.
  - [ ] `startPairableBridge` generates a fresh `pendingPairToken`, passes a `lookupToken` that consults `getTokens()` + the local `pendingPairToken`, constructs `PairingController({onPair: (id, tok) => addToken(id, tok)})`, embeds `pendingPairToken` in the returned handle so the QR uses it.
  - [ ] `maybeStartBridge` uses `lookupToken` over `getTokens()` (no pending slot).
  - [ ] PairingController mocha covers: onPair called with correct args, onPair throwing prevents signal resolution, no-onPair path (backwards-compat default).
  - [ ] Commit: `feat(nzr-bridge): T005 promote pending pair token into per-device tokens`.

### T006 — Revoke uses `removeDeviceToken`
- **Status:** pending
- **Depends on:** T005
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/pairing/revokeCommand.ts`
  - modify: `extensions/nzrcode-bridge/src/extension.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/listRevokeCommand.test.ts`
- **Acceptance:**
  - [ ] `RevokeIpadDeps.rotateToken` → `removeDeviceToken: (deviceId: string) => Promise<void>`.
  - [ ] `RevokeIpadDeps` gains `remainingDevicesCount: () => number`.
  - [ ] `runRevokeIpadCommand` calls `removeDeviceToken(picked.deviceId)` instead of `rotateToken()` and computes the success message:
    - `count === 0` → `"Revoked {name}. No other paired devices."`
    - `count === 1` → `"Revoked {name}. 1 other paired device stays connected."`
    - else        → `"Revoked {name}. {n} other paired devices stay connected."`
  - [ ] `extension.ts` revoke wiring: `removeDeviceToken: (id) => { state.removeToken(id); return Promise.resolve(); }`, `remainingDevicesCount: () => _store?.list().length ?? 0`.
  - [ ] Mocha covers: removeDeviceToken called with correct deviceId, success message branches.
  - [ ] Commit: `feat(nzr-bridge): T006 revoke now targets a single device, leaves others connected`.

### T007 — Verify + push + PR
- **Status:** pending
- **Depends on:** T006
- **Files:**
  - create: `specs/0018-per-device-tokens/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-per-device-tokens/run_all.sh` exit 0.
  - [ ] `bash test/nzrcode-bridge/run_all.sh` still green.
  - [ ] All 12 prior NZR smoke suites still pass.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. Each task depends on the previous.
