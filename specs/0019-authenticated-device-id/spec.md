# Spec 0019 — `authenticatedDeviceId` on `BridgeConnection`

**Branch:** `feature/0019-authenticated-device-id`
**Base:** `main` (post-merge of features 0001-0018)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Goal

Surface the authenticated device's identity on every active
`BridgeConnection` so RPC handlers and the canonical event publisher
can route by device. The 0018 spec listed this as a deliverable
("`BridgeConnection` gains `authenticatedDeviceId: string | undefined`
(getter on the wrapper)") but the actual shipping work was deferred —
the dispatcher matches a device's token but never attaches the result
to the connection.

This PR closes that small gap. No new commands, no new protocol; just
the connection-level surface that future per-device features
(audit logs, mute filtering, per-device throttling) can read.

## In scope

1. **`BridgeConnection.authenticatedDeviceId: string | undefined`** —
   getter on the wsServer wrapper. `undefined` before auth; populated
   after a successful `system.authenticate` whose token matched a
   persistent entry. **Pending-pair matches leave it `undefined`** —
   pair-time clients have no identity yet.
2. **`BridgeConnection._setAuthenticatedDeviceId(deviceId)`** —
   package-private setter (still public on the type but documented
   as internal). The dispatcher is the only call site.
3. **Dispatcher attaches deviceId post-auth**: when
   `lookupToken(...)` returns `{ deviceId }`, the dispatcher calls
   `conn._setAuthenticatedDeviceId(deviceId)` before responding with
   `{ ok: true }`. When the result is `{ pending: true }`, the
   dispatcher leaves the deviceId undefined.
4. **Tests**: dispatcher mocha gains two cases — persistent match
   sets the deviceId; pending match does not. The wsServer wrapper's
   default state (`undefined`) is asserted in a unit test.

## Out of scope (deferred)

- **Wiring per-device mute filtering** through `authenticatedDeviceId`.
  `canonical.ts` already takes a `deviceId` on its subscription map
  — the link from `BridgeConnection.authenticatedDeviceId` to the
  publisher's subscriber registration is a follow-up.
- **Audit logging by deviceId** (would need a new log channel).
- **Per-device rate limiting**.

## Non-goals

- **No new NPM dependencies.**
- **No new telemetry events.**
- **No changes to the auth gate's behavior** beyond setting the
  field; rejected candidates still close with `4001`.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-authenticated-device-id/run_all.sh` exits 0.
- [ ] `BridgeConnection` exposes `authenticatedDeviceId: string | undefined` and `_setAuthenticatedDeviceId(deviceId: string): void`.
- [ ] Dispatcher unit tests verify both code paths (persistent and pending).
- [ ] Bridge mocha still green (≥ 355 passing).
- [ ] All 13 prior NZR smoke suites still pass.

## Clarifications (resolved via brief-default judgment)

- **cl-1: Should the setter be public or hidden behind a private
  Symbol?**
  Resolved: **public with a leading underscore + JSDoc `@internal`**.
  Matches the existing `_address()` convention on `BridgeWsServer`.
- **cl-2: Should pending matches expose a sentinel like `'__pending__'` instead of `undefined`?**
  Resolved: **`undefined`**. Consumers should treat pending devices
  as unknown. A sentinel string would invite stringly-typed branches.
- **cl-3: Should the deviceId persist across reconnections of the same socket?**
  Resolved: **N/A — sockets are not reused**. Each TCP connection
  gets a fresh `BridgeConnection` wrapper.
- **cl-4: Does the dispatcher emit a log when attaching the deviceId?**
  Resolved: **No**. The auth log already records the method call;
  duplicating it would be noise.

## Risks

- **R1:** A future refactor that calls `_setAuthenticatedDeviceId` from outside the dispatcher would break the invariant. **Mitigation:** JSDoc + test asserts the field stays `undefined` when the dispatcher never gets a successful auth.
- **R2:** Without a real iPad pairing flow we can't visually verify the wiring. **Mitigation:** dispatcher mocha covers both code paths.
