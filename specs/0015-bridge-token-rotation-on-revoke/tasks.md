# Tasks 0015 — Bridge Token Rotation on Revoke

**Branch:** `feature/0015-bridge-token-rotation-on-revoke`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stubs (RED)
- **Status:** done
- **Files:**
  - create: `test/nzrcode-token-rotation/{test_files_exist,test_rotate_token_wired,test_no_new_deps,run_all}.sh`
  - create: `test/nzrcode-token-rotation/README.md`
  - create: `extensions/nzrcode-bridge/src/test/unit/rotateToken.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh` references the future test files.
  - [ ] `test_rotate_token_wired.sh` greps `state.ts` for `export function rotateToken`, `revokeCommand.ts` for `rotateToken` in `RevokeIpadDeps`, and verifies `runRevokeIpadCommand` calls `deps.rotateToken()`.
  - [ ] `test_no_new_deps.sh` passes.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-bridge): T001 add token-rotation smoke + mocha stubs (RED)`.

### T002 — `rotateToken()` in state.ts + tests
- **Status:** done
- **Depends on:** T001
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/server/state.ts`
  - modify: `extensions/nzrcode-bridge/src/test/unit/rotateToken.test.ts`
- **Acceptance:**
  - [ ] `state.ts` exports `function rotateToken(): BridgeState` that builds a new state with `generateToken()`, preserves `lastPort`, persists via `saveState`, and updates `_cached`.
  - [ ] `rotateToken` works when no state has been loaded yet (falls back to `loadOrCreateState` + rotation).
  - [ ] Mocha covers: rotation from fresh state, rotation preserves lastPort, the new token differs from the old token, the on-disk file matches the new in-memory state.
  - [ ] Commit: `feat(nzr-bridge): T002 add rotateToken() to bridge state`.

### T003 — Wire rotation into runRevokeIpadCommand + tests
- **Status:** done
- **Depends on:** T002
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/pairing/revokeCommand.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/revokeCommand.test.ts`
- **Acceptance:**
  - [ ] `RevokeIpadDeps` gains `readonly rotateToken: () => Promise<void>`.
  - [ ] `runRevokeIpadCommand` calls `deps.rotateToken()` after `deps.dropActiveConnections()` and before the success notification.
  - [ ] The success message is `"Revoked {name}. Token rotated — other paired devices must re-pair."`.
  - [ ] Mocha records the call order and asserts: `revokeDevice` → `dropActiveConnections` → `rotateToken` → `showInformationMessage`.
  - [ ] Mocha asserts that when the user cancels at the QuickPick stage no rotation happens.
  - [ ] Mocha asserts that when the user cancels at the confirm stage no rotation happens.
  - [ ] Commit: `feat(nzr-bridge): T003 rotate token on iPad revoke`.

### T004 — Verify + push + PR
- **Status:** done
- **Depends on:** T003
- **Files:**
  - create: `specs/0015-bridge-token-rotation-on-revoke/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-token-rotation/run_all.sh` exit 0.
  - [ ] Existing `test/nzrcode-bridge/run_all.sh` still passes.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. T003 depends on T002's new export.
