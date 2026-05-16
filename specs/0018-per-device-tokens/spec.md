# Spec 0018 — Per-Device Tokens

**Branch:** `feature/0018-per-device-tokens`
**Base:** `main` (post-merge of features 0001-0017)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Goal

Replace the bridge's shared-token security model (where every paired
device shares one secret in `~/.nzrcode/bridge.json`) with **per-device
tokens**: each paired iPad gets its own 32-byte base64url token. Revoke
deletes just that device's entry, leaving every other paired device
operational.

This closes `decision-0015-1` from feature 0015. The blanket "rotate on
revoke" shipped in PR #15 was a stopgap that forced every paired
device to re-pair whenever one was revoked. After this PR, revoke is
targeted and silent for unrelated devices.

## In scope

1. **Schema v2** in `~/.nzrcode/bridge.json`:
   - Replace `token: string` with `tokens: Record<deviceId, string>`.
   - Bump `version: 2`.
   - **Migration v1 → v2**: on load, a `version: 1` file is rewritten
     as `version: 2` with `tokens: {}`. The old single token is
     dropped. Effect: every device paired under v1 is implicitly
     revoked at first launch after upgrade; users must re-pair. This
     is the security goal — old shared token cannot reconnect.
   - Migration is one-way; v2 files are never downgraded.
2. **`state.ts` helpers**:
   - `addToken(deviceId, token): void` — inserts or replaces an entry, persists.
   - `removeToken(deviceId): boolean` — removes an entry; returns `true` if it existed.
   - `getTokens(): Readonly<Record<deviceId, string>>` — defensive copy.
   - `rotateToken` is removed. The carry-over from feature 0015 was a
     stopgap; per-device removeToken supersedes it.
3. **`auth.ts`**:
   - `findTokenMatch(tokens, pendingPairToken, candidate): { deviceId } | { pending: true } | undefined`.
   - Linear scan with `crypto.timingSafeEqual` per entry, plus the
     optional in-memory pending-pair slot.
   - The shape exposes whether the match came from the persistent map
     or the transient pair-time slot so callers can route the
     connection correctly (a "pending" connection awaits
     `system.register` before it can be considered fully paired).
4. **Dispatcher** changes:
   - `DispatcherDeps.token: string` → `DispatcherDeps.lookupToken: (candidate: string) => TokenLookupResult | undefined`.
   - On a successful match, the resolved deviceId (or the sentinel
     `'__pending__'`) attaches to the connection state.
   - Subsequent handlers can read `connection.authenticatedDeviceId`
     via a getter on the connection wrapper (added to `BridgeConnection`).
5. **`startPairableBridge`**:
   - Generates a fresh `pendingPairToken` at start, holds it in a
     local closure (in-memory only — never persisted).
   - Passes the closure-aware `lookupToken` into the dispatcher.
   - Embeds `pendingPairToken` in the QR (replacing `state.token` in
     the legacy code path).
   - When `PairingController.createHandler` resolves the pair signal,
     it promotes the pending token into the persistent tokens map
     under the real deviceId: `addToken(deviceId, pendingPairToken)`.
6. **`maybeStartBridge`**:
   - Now passes a `lookupToken` that consults `getTokens()` (no
     pending slot — activation-time runtime never accepts new pair
     attempts).
7. **Revoke flow** (`revokeCommand.ts` + `extension.ts`):
   - The `rotateToken` dep is renamed to `removeDeviceToken(deviceId)`.
   - The success message changes to:
     `"Revoked {name}. {n} other paired devices stay connected."`
     where `n` is computed inside the orchestrator (deps gain
     `remainingDevicesCount: () => number`).
   - Existing call-order tests update (`revokeDevice → dropActiveConnections → removeDeviceToken → showInfo`).
8. **Tests**:
   - `state.ts` mocha: schema v2 round-trip, v1→v2 migration drops the
     old token, addToken/removeToken/getTokens.
   - `auth.ts` mocha: `findTokenMatch` for empty map, single-entry
     match, multi-entry match, no match, pending-pair match,
     malformed candidate.
   - Dispatcher mocha: `lookupToken` injection, deviceId attached to
     connection.
   - `PairingController` mocha: promotion callback fires with
     deviceId + pending token.
   - `revokeCommand` mocha (extends existing): `removeDeviceToken` is
     called with the revoked deviceId.

## Out of scope (deferred)

- **Token rotation for an existing paired device** (e.g., periodic
  re-issuance). Out of scope; per-device removeToken + re-pair is the
  current rotation story.
- **A "Revoke all" command**: `pairedDevices.clear()` exists but no
  command surface yet; a future PR can add it.
- **Surfacing the per-device-token count in the Status Bar** (visual
  feedback).
- **Multi-token concurrent pair flows**: only one `pendingPairToken`
  at a time. Running `Pair iPad` twice consecutively overwrites the
  first pending token.
- **Versioning the on-the-wire protocol** to advertise per-device
  semantics. `system.hello` already includes `serverVersion`; clients
  can detect via that.

## Non-goals

- **No new NPM dependencies.**
- **No new telemetry events.**
- **No changes to the existing list/revoke palette UX** beyond the
  notification text.

## Inputs / dependencies

- All of feature 0009's bridge infrastructure (state, auth, dispatcher, pairing).
- Feature 0017's `PairingController` (extended with a `onPair` callback for promotion).

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-per-device-tokens/run_all.sh` exits 0.
- [ ] `BridgeState.tokens: Record<string, string>` (no `token`).
- [ ] `version: 2`; v1 files migrate cleanly.
- [ ] `addToken`, `removeToken`, `getTokens` exported with the documented behavior + mocha.
- [ ] `rotateToken` removed.
- [ ] `findTokenMatch` exported and unit-tested for 6+ cases.
- [ ] Dispatcher passes `lookupToken`; the connection wrapper exposes the matched deviceId.
- [ ] `PairingController` accepts an `onPair(deviceId, pendingToken)` callback.
- [ ] `revokeCommand` calls `removeDeviceToken` and surfaces the
      "X other paired devices stay connected" wording.
- [ ] `bash test/nzrcode-bridge/run_all.sh` still green.
- [ ] All 12 prior NZR smoke suites still pass.

## Clarifications (resolved via brief-default judgment)

- **cl-1: Migration semantics — silently wipe v1's shared token, or surface a notification?**
  Resolved: **silently wipe**. The bridge has no notification surface
  at activation; `vscode.window.showWarningMessage` would fire on
  every restore until acknowledged. The trade-off is that users notice
  only when their iPad fails to reconnect ("auth_failure"); they
  re-pair via the palette command. The migration is permanent.
- **cl-2: Pending-pair slot — persisted or in-memory?**
  Resolved: **in-memory only**. Pending tokens are short-lived (until
  `system.register` fires). Persisting them would leak a half-paired
  state across restarts and complicate the auth surface.
- **cl-3: What deviceId does the iPad use?**
  Resolved: **the client's choice**. `system.register({deviceId})`
  authoritatively sets the deviceId. The pair signal's
  `pendingPairToken` is **renamed** under the real deviceId on
  register; there is no server-allocated deviceId.
- **cl-4: When a pair flow aborts before `system.register`, what
  happens to the pending token?**
  Resolved: **garbage-collected with the bridge runtime**. The user
  cancelling the QR webview triggers `runtime.dispose()` which drops
  the in-memory slot. Resilient against half-completed flows.
- **cl-5: Should we keep `rotateToken` as a deprecated alias for backward compatibility?**
  Resolved: **No — remove it**. The function was a stopgap for one
  release; removing it cleanly is preferable to deprecation drift.
  All call sites move to `removeToken`.

## Risks

- **R1:** Migration silently invalidates v1-paired devices. **Mitigation:** documented in cl-1; users will retry the pair palette command.
- **R2:** The dispatcher's `BridgeConnection.authenticatedDeviceId` is a new surface; consumers that haven't been updated treat it as undefined. **Mitigation:** the new field is additive; no existing handler reads `authenticatedDeviceId`.
- **R3:** Linear scan in `findTokenMatch` is O(N) per auth. With typical N ≤ 5 paired devices, this is negligible; even at N=100 the scan dominates < 1 ms. **Mitigation:** acceptable.
