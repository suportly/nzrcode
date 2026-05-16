# Plan 0015 — Bridge Token Rotation on Revoke

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0015-bridge-token-rotation-on-revoke`
**Generated:** 2026-05-16
**Language:** pt-BR

## Architecture sketch

```
extensions/nzrcode-bridge/src/server/
  state.ts                                       # MODIFY
    └─ + rotateToken(): BridgeState
       (generateToken → BridgeState{token, v1, prev.lastPort} → saveState)

extensions/nzrcode-bridge/src/pairing/
  revokeCommand.ts                               # MODIFY
    ├─ RevokeIpadDeps: + rotateToken: () => Promise<void>
    └─ runRevokeIpadCommand: append `await deps.rotateToken()`
       between dropActiveConnections() and showInformationMessage().

extensions/nzrcode-bridge/src/test/unit/
  rotateToken.test.ts                            # CREATE
  revokeCommand.test.ts                          # CREATE or MODIFY

test/nzrcode-token-rotation/
  run_all.sh
  test_files_exist.sh
  test_rotate_token_wired.sh                     # grep checks
  test_no_new_deps.sh
  README.md
```

## Key design decisions

### DD-1: Rotation is a top-level function on `state.ts`, not a method

`state.ts` already exports `loadOrCreateState`, `saveState`,
`deleteState` as plain functions. Keeping `rotateToken` as a function
matches the existing surface and avoids introducing a class.

### DD-2: `rotateToken` reads `_cached`, not the disk

The cache is the authoritative in-process source after the initial
load. If the cache is empty (no `loadOrCreateState` call yet) we fall
back to creating fresh state — that branch is unlikely in practice
(extension always loads at activation) but it makes the function
total.

### DD-3: Append, don't reshuffle

The current revoke order (`revokeDevice` → `dropActiveConnections` →
notification) stays untouched; rotation is appended after the
connections drop, before the notification. The new dep is **optional**
in spirit only — it's typed as required to avoid silent regressions
where callers forget to wire it.

### DD-4: The success message change is a localized literal in the
contribution (when wired)

`revokeCommand.ts` currently takes its message text as a plain JS
string passed into `showInformationMessage`. The localized layer lives
in the eventual `commands.contribution.ts` that registers the
command — which is not in this PR's scope. Inside `revokeCommand.ts`
the new wording is a plain string that the contribution will later
swap for a localized version.

### DD-5: Tests for `rotateToken` set `NZRCODE_HOME`

Matches the existing test patterns for `state.ts`: every test uses
`NZRCODE_HOME = mkdtempSync(...)` and cleans up with `rmSync`. This
keeps the host file system untouched.

## Compile-and-test strategy

- **Unit:**
  - `rotateToken.test.ts`: fresh state → rotate → disk contains a new 43-char base64url token; `lastPort` survives; new token ≠ old token.
  - `revokeCommand.test.ts` augmentation: capture call order, assert `revokeDevice → dropActiveConnections → rotateToken → showInformationMessage`. Assert the notification text mentions re-pairing.
- **Smoke:** structural greps for file existence, dep shape, no-new-deps.
- **Visual:** deferred. Manual exercise requires pairing one device, opening the revoke command from the palette, and confirming the QR for a new pair shows a different token.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `extensions/nzrcode-bridge/src/server/state.ts` | modify | add `rotateToken` |
| `extensions/nzrcode-bridge/src/pairing/revokeCommand.ts` | modify | add `rotateToken` dep + call |
| `extensions/nzrcode-bridge/src/test/unit/rotateToken.test.ts` | create | mocha for `rotateToken` |
| `extensions/nzrcode-bridge/src/test/unit/revokeCommand.test.ts` | create or modify | mocha for the new orchestration step |
| `test/nzrcode-token-rotation/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0015-bridge-token-rotation-on-revoke/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 5 clarifications resolved, 3 risks declared.
- **II (Test-first):** T001 RED smoke + mocha stub → T002 rotateToken green → T003 wiring green.
- **III (Simplicity):** zero new deps; one new exported function; one dep added to an existing object.
- **IV (Evidence):** run-all output captured in T004.
- **V (Provider):** no provider switch.
- **VI (Privacy):** auth token never logged; redactToken usage unchanged.
- **VII (Attribution):** original to NZRCode.
