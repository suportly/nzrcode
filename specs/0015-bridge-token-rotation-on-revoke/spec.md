# Spec 0015 — Bridge Token Rotation on Revoke

**Branch:** `feature/0015-bridge-token-rotation-on-revoke`
**Base:** `main` (post-merge of features 0001-0014)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Goal

Close the security carry-over noted in feature 0009: when the user
revokes a paired iPad, the bridge today removes the device's metadata
and drops live WebSocket connections, but the **shared auth token in
`~/.nzrcode/bridge.json` is unchanged**. A revoked device that kept a
copy of the token (in memory, backup, or screenshot of the QR code)
can reconnect by hitting the next WS port and replaying
`system.authenticate`.

This PR makes revoke **rotate the bridge token**: generate a new 32-byte
base64url token, persist it to disk via the existing
`saveState` path, and drop every live connection. The revoked device
(and every other paired device) must re-pair via QR to learn the new
token. The bridge's `lastPort` is preserved so the dev workflow keeps
working.

This is intentionally a smaller-scope fix than full per-device tokens.
Per-device tokens stays a tracked follow-up (`decision-0015-1`) — that
refactor needs a `bridge.json` schema bump and changes to dispatcher,
pair flow, and QR payload that are out of scope here.

## In scope

1. **`rotateToken(): BridgeState`** in `state.ts`:
   - Generates a new token via `generateToken()`.
   - Builds a `BridgeState { token: newToken, version: 1, lastPort: prev.lastPort }`.
   - Calls `saveState(...)` (atomic write, 0600 perms).
   - Updates the module-level `_cached`.
   - Returns the new state.
   - **No-op safety:** if `getCurrentState()` is undefined (no state loaded), rotates from a freshly created state.
2. **Wire rotation into `runRevokeIpadCommand`** in `revokeCommand.ts`:
   - Add a new `rotateToken: () => Promise<void>` dep on `RevokeIpadDeps`.
   - After `revokeDevice(picked.deviceId)` and `dropActiveConnections()` succeed, call `rotateToken()`.
   - The success notification gains a sentence:
     `"Revoked {name}. Token rotated — other paired devices must re-pair."`.
3. **Tests** for `rotateToken`:
   - Asserts the on-disk file gets a new 43-char base64url token.
   - Asserts `lastPort` survives rotation.
   - Asserts the cached state matches the new on-disk state.
   - Asserts the new token is not equal to the previous one (statistically guaranteed by `crypto.randomBytes(32)`).
4. **Tests** for `runRevokeIpadCommand`:
   - The existing test layout (`pairing/revokeCommand.test.ts`) — if it exists — is augmented to assert `rotateToken` is called after the metadata revoke + connection drop, in that order.
   - If no test exists yet, a fresh one is added.

## Out of scope (deferred)

- **Full per-device tokens**, where each paired device has its own
  token and revoke removes only that entry: tracked as
  `decision-0015-1`. Needs schema v2 + dispatcher/pair-flow changes.
- **A separate `nzrcode-bridge.rotateToken` palette command**: revoke
  is the only trigger this PR adds.
- **Auto-rotate on a timer / on every workbench start**: explicitly
  out of scope; rotation is event-driven only (revoke).
- **Notifying paired devices over WebSocket before dropping**: we drop
  the connection without a structured "you've been revoked" frame.
  The client's reconnect attempt will fail authentication, which is
  a sufficient signal.

## Non-goals

- **No new NPM dependencies.**
- **No new telemetry events.**
- **No schema change** to `bridge.json`. The file still carries
  `{ token, version: 1, lastPort? }`.
- **No new commands or keybindings.**

## Inputs / dependencies

- `extensions/nzrcode-bridge/src/server/state.ts` — `getCurrentState`, `saveState`, `loadOrCreateState`, `BridgeState`.
- `extensions/nzrcode-bridge/src/server/auth.ts` — `generateToken`.
- `extensions/nzrcode-bridge/src/pairing/revokeCommand.ts` — `RevokeIpadDeps`, `runRevokeIpadCommand`.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-token-rotation/run_all.sh` exits 0.
- [ ] `rotateToken` lives in `state.ts` and is unit-tested.
- [ ] `RevokeIpadDeps` carries a `rotateToken` dep; `runRevokeIpadCommand` calls it after `revokeDevice` + `dropActiveConnections`.
- [ ] The success message mentions that other paired devices must re-pair.
- [ ] No new NPM deps.
- [ ] Existing bridge smoke + integration test layouts continue to pass.

## Clarifications (resolved via brief-default judgment)

- **cl-1: When the user is revoking "all" devices (clear path), do we still rotate?**
  Resolved: **N/A for v1**. The current command revokes one device at a time; there is no "all" command exposed yet. The single revoke path rotates unconditionally — which already covers the all-devices case in two clicks (revoke one → revoke the remaining set).
- **cl-2: What about `lastPort`?**
  Resolved: **preserve it**. Token rotation is independent of binding port; the next listener will reuse the cached port and the user doesn't pay an extra port-scan round-trip.
- **cl-3: Order — revoke metadata, drop connections, rotate; or rotate first?**
  Resolved: **revoke → drop → rotate** (no change to existing order; rotate is appended). Rotating first would leak the new token onto disk before the user has confirmed; the existing order is conservative.
- **cl-4: If `rotateToken` throws (disk full, EACCES), do we surface or swallow?**
  Resolved: **rethrow**. Revoke is a security-critical user action; a silent rotation failure would leave the user thinking the revoke was complete. Better to surface the error so they can retry or escalate.
- **cl-5: Should the success notification be different when only one device was paired (rotating is unnecessary because no other devices exist)?**
  Resolved: **No — same message**. The user's mental model after revoking should always be "token rotated; re-pair to use the iPad again". Branching the copy would create false confidence in edge cases.

## Risks

- **R1:** Rotating the shared token forces every paired device to re-pair, even those that weren't revoked. **Mitigation:** documented in cl-5; per-device tokens removes this in the future.
- **R2:** A client mid-frame when rotation lands sees its connection drop. **Mitigation:** dropping connections is already part of the revoke flow before rotation; clients should already handle abrupt drops.
- **R3:** Without a dev build we cannot manually exercise revoke + reconnect. **Mitigation:** unit-test the rotation primitive + the orchestration order; integration tests for the dispatcher already cover the auth-failure path on bad token.
