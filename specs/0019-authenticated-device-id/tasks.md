# Tasks 0019 — `authenticatedDeviceId` on `BridgeConnection`

**Branch:** `feature/0019-authenticated-device-id`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Task list

### T001 — Smoke (RED)
- **Status:** done
- **Files:**
  - create: `test/nzrcode-authenticated-device-id/{test_files_exist,test_wired,test_no_new_deps,run_all}.sh`
  - create: `test/nzrcode-authenticated-device-id/README.md`
- **Acceptance:**
  - [ ] `test_files_exist.sh` references `wsServer.ts` and `dispatcher.ts`.
  - [ ] `test_wired.sh` greps `wsServer.ts` for `authenticatedDeviceId` and `_setAuthenticatedDeviceId`, and `dispatcher.ts` for `_setAuthenticatedDeviceId`.
  - [ ] `test_no_new_deps.sh` passes.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-bridge): T001 add authenticated-deviceId smoke (RED)`.

### T002 — wsServer wrapper: `authenticatedDeviceId` getter + setter
- **Status:** done
- **Depends on:** T001
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/server/wsServer.ts`
- **Acceptance:**
  - [ ] `BridgeConnection` interface gains `readonly authenticatedDeviceId: string | undefined` (declared as a getter via `get authenticatedDeviceId(): ...` on the returned object).
  - [ ] `BridgeConnection` interface gains `_setAuthenticatedDeviceId(deviceId: string): void` with a `@internal` JSDoc tag.
  - [ ] `wrapConnection` holds a closure-local `authenticatedDeviceId` that defaults to `undefined`.
  - [ ] Commit: `feat(nzr-bridge): T002 add BridgeConnection.authenticatedDeviceId`.

### T003 — Dispatcher attaches deviceId post-auth + tests
- **Status:** done
- **Depends on:** T002
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/server/dispatcher.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/dispatcher.test.ts`
- **Acceptance:**
  - [ ] On `lookup = { deviceId }`, the dispatcher calls `conn._setAuthenticatedDeviceId(lookup.deviceId)` BEFORE responding with `{ ok: true }`.
  - [ ] On `lookup = { pending: true }`, the dispatcher does NOT call the setter; `conn.authenticatedDeviceId` stays `undefined`.
  - [ ] Mocha adds two cases: persistent match attaches the expected deviceId; pending match leaves the field undefined.
  - [ ] Bridge mocha + smoke green.
  - [ ] Commit: `feat(nzr-bridge): T003 attach deviceId on successful authenticate`.

### T004 — Verify + push + PR
- **Status:** done
- **Depends on:** T003
- **Files:**
  - create: `specs/0019-authenticated-device-id/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-authenticated-device-id/run_all.sh` exit 0.
  - [ ] `bash test/nzrcode-bridge/run_all.sh` still green.
  - [ ] All 13 prior NZR smoke suites still pass.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. T003 depends on the new field declared in T002.
