# Plan 0018 — Per-Device Tokens

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0018-per-device-tokens`
**Generated:** 2026-05-16
**Language:** pt-BR

## Architecture sketch

```
extensions/nzrcode-bridge/src/
  server/state.ts                                # MODIFY
    ├─ BridgeState.token: string  ──❌
    ├─ BridgeState.tokens: Record<deviceId, string>  ── NEW
    ├─ version: 1 → 2
    ├─ addToken(id, token)
    ├─ removeToken(id): boolean
    ├─ getTokens(): Readonly<Record<...>>
    ├─ migration helper: parseState reshapes v1 into v2-with-empty-tokens
    └─ rotateToken removed

  server/auth.ts                                 # MODIFY
    └─ findTokenMatch(tokens, pendingToken, candidate): TokenLookupResult | undefined

  server/dispatcher.ts                           # MODIFY
    ├─ DispatcherDeps.token  ──❌
    ├─ DispatcherDeps.lookupToken: (cand) => TokenLookupResult | undefined
    └─ BridgeConnection.authenticatedDeviceId getter (added to wsServer wrapper)

  pairing/pairingController.ts                   # MODIFY
    └─ constructor accepts { onPair: (deviceId, pendingToken) => void }
       handler calls onPair before resolving the signal

  bridge.ts                                      # MODIFY
    ├─ maybeStartBridge → lookupToken from getTokens()
    └─ startPairableBridge:
        ├─ generate pendingPairToken (in closure)
        ├─ lookupToken consults tokens + pendingPairToken
        ├─ PairingController({onPair: (id, tok) => addToken(id, tok)})
        └─ pairingSignal carries deviceId for the caller

  pairing/qrModal.ts                             # NO CHANGE
    (QR payload still takes a single token — caller passes pendingPairToken)

  pairing/pairCommand.ts                         # NO CHANGE
    (orchestration semantics survive — BridgeRuntimeHandle.port + pairingSignal + dispose)

  pairing/revokeCommand.ts                       # MODIFY
    ├─ RevokeIpadDeps.rotateToken ──❌
    ├─ RevokeIpadDeps.removeDeviceToken: (id) => Promise<void>
    ├─ RevokeIpadDeps.remainingDevicesCount: () => number
    └─ message: "Revoked {name}. {n} other paired devices stay connected."

  extension.ts                                   # MODIFY
    ├─ revoke wiring: rotateToken → removeDeviceToken via state.removeToken
    └─ remainingDevicesCount → store.list().length

extensions/nzrcode-bridge/src/test/unit/
  state.test.ts                                  # MODIFY (existing) — schema v2
  rotateToken.test.ts                            # DELETE (replaced)
  perDeviceTokens.test.ts                        # CREATE — addToken/removeToken/migration/findTokenMatch
  pairingController.test.ts                      # MODIFY — onPair callback
  listRevokeCommand.test.ts                      # MODIFY — removeDeviceToken + count

test/nzrcode-per-device-tokens/
  run_all.sh
  test_files_exist.sh
  test_schema_v2.sh
  test_helpers_present.sh
  test_no_new_deps.sh
  README.md
```

## Key design decisions

### DD-1: `lookupToken` lambda instead of passing the raw tokens map

The dispatcher should not own knowledge of the pending-pair slot.
`bridge.ts` is the only file that needs to know "auth can match the
persistent map OR the in-flight pair slot". Injecting a lambda keeps
the dispatcher single-purpose.

### DD-2: `pendingPairToken` lives in `startPairableBridge`'s closure

The pending slot is per-pair-flow. Multiple concurrent pair flows
would each have their own bridge runtime (and their own closure).
There is no global `pendingPairToken` register.

### DD-3: Migration is destructive

V1 → V2 wipes the shared token; every previously paired device must
re-pair. The alternative — a `legacyToken` shim during the transition —
would create a permanent backdoor for the shared-token model. Better
to take the migration cost once.

### DD-4: `BridgeConnection.authenticatedDeviceId` is a getter, not a constructor arg

The deviceId is set by the dispatcher *after* successful auth, not at
connection creation. A getter on the wrapper (backed by a mutable
internal slot) keeps the contract: "available after auth, undefined
before". Handlers that don't need it can ignore it.

### DD-5: Promotion order in `PairingController.createHandler`

```
1. call onPair(deviceId, pendingPairToken)   // persists token under real deviceId
2. resolve pairingSignal                      // pair command continues
```

If `onPair` throws (disk error), the pairing signal does NOT resolve.
This is intentional: a successful pair must imply a persisted token.

## Compile-and-test strategy

- **Unit (mocha):**
  - `perDeviceTokens.test.ts`: schema-v2 round-trip, v1→v2 migration
    (asserts shared token wiped, version bumped, lastPort preserved),
    addToken / removeToken / getTokens.
  - `auth.test.ts` augmentation: `findTokenMatch` cases.
  - `pairingController.test.ts` augmentation: `onPair` called with
    correct args before signal resolves.
  - `dispatcher.test.ts` augmentation: `lookupToken` deps shape +
    deviceId attached.
  - `listRevokeCommand.test.ts` augmentation: orchestration order and
    "X other paired devices" message.
- **Structural (smoke):** file existence + schema-v2 grep + helper
  exports + no-new-deps.
- **Visual (dev build):** **DEFERRED**.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `extensions/nzrcode-bridge/src/server/state.ts` | modify | schema v2 + helpers |
| `extensions/nzrcode-bridge/src/server/auth.ts` | modify | findTokenMatch |
| `extensions/nzrcode-bridge/src/server/dispatcher.ts` | modify | lookupToken |
| `extensions/nzrcode-bridge/src/server/wsServer.ts` | modify | authenticatedDeviceId on BridgeConnection |
| `extensions/nzrcode-bridge/src/pairing/pairingController.ts` | modify | onPair |
| `extensions/nzrcode-bridge/src/bridge.ts` | modify | wiring |
| `extensions/nzrcode-bridge/src/pairing/revokeCommand.ts` | modify | removeDeviceToken + count |
| `extensions/nzrcode-bridge/src/extension.ts` | modify | revoke deps |
| `extensions/nzrcode-bridge/src/test/unit/perDeviceTokens.test.ts` | create | new mocha |
| `extensions/nzrcode-bridge/src/test/unit/rotateToken.test.ts` | delete | replaced |
| `extensions/nzrcode-bridge/src/test/unit/state.test.ts` | modify | schema v2 |
| `extensions/nzrcode-bridge/src/test/unit/auth.test.ts` | modify | findTokenMatch |
| `extensions/nzrcode-bridge/src/test/unit/dispatcher.test.ts` | modify | lookupToken |
| `extensions/nzrcode-bridge/src/test/unit/pairingController.test.ts` | modify | onPair |
| `extensions/nzrcode-bridge/src/test/unit/listRevokeCommand.test.ts` | modify | removeDeviceToken |
| `test/nzrcode-per-device-tokens/{test_*,run_all}.sh` | create | smoke |
| `specs/0018-per-device-tokens/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 5 clarifications resolved, 3 risks declared.
- **II (Test-first):** T001 RED smoke → T002 state green → T003 auth → T004 dispatcher → T005 pair → T006 revoke green.
- **III (Simplicity):** zero new deps; the cleanup is a net code reduction (rotateToken stub removed).
- **IV (Evidence):** run-all output captured in T007.
- **V (Provider):** no provider switch.
- **VI (Privacy):** apnsToken still routed through `PairedDeviceStore.attachApnsToken` only.
- **VII (Attribution):** original to NZRCode.
