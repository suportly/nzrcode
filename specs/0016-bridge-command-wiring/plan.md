# Plan 0016 — Bridge Command Wiring

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0016-bridge-command-wiring`
**Generated:** 2026-05-16
**Language:** pt-BR

## Architecture sketch

```
extensions/nzrcode-bridge/src/
  extension.ts                                   # MODIFY
    ├─ activate(context)
    │     ├─ existing: maybeStartBridge → _runtime
    │     ├─ NEW: _store = new PairedDeviceStore({ globalState, secrets })
    │     ├─ NEW: context.subscriptions.push(
    │     │       vscode.commands.registerCommand('nzrcode-bridge.listPairedDevices', listHandler)
    │     │     )
    │     └─ NEW: context.subscriptions.push(
    │             vscode.commands.registerCommand('nzrcode-bridge.revokeIpad', revokeHandler)
    │           )
    │
    ├─ listHandler():
    │     return runListPairedDevicesCommand({
    │         listDevices: () => _store.list(),
    │         showQuickPick: vscode.window.showQuickPick adapter,
    │         showInformationMessage: vscode.window.showInformationMessage adapter,
    │         now: () => Date.now(),
    │     });
    │
    └─ revokeHandler():
        return runRevokeIpadCommand({
            listDevices: () => _store.list(),
            showQuickPick: vscode.window.showQuickPick adapter,
            confirmRevoke: async name => vscode.window.showWarningMessage(..., { modal: true }, 'Revoke') === 'Revoke',
            revokeDevice: id => _store.revoke(id),
            dropActiveConnections: async () => { await _runtime?.stop(); _runtime = undefined; },
            rotateToken: async () => { rotateToken(); },
            showInformationMessage: vscode.window.showInformationMessage adapter,
            now: () => Date.now(),
        });

test/nzrcode-command-wiring/
  run_all.sh
  test_files_exist.sh
  test_commands_wired.sh                          # greps extension.ts for the 2 registerCommand sites
  test_no_new_deps.sh
  README.md
```

## Key design decisions

### DD-1: Keep adapters inline in `extension.ts`

The wiring is < 80 lines total. Extracting two factory functions
(`createListDeps`, `createRevokeDeps`) would add ceremony without
unlocking new tests — the orchestrator tests already cover behavior
without vscode. The smoke suite asserts the wiring shape.

### DD-2: `confirmRevoke` uses the modal warning dialog

`vscode.window.showWarningMessage(msg, { modal: true }, 'Revoke')`
returns the user's chosen string. Comparing to `'Revoke'` gives the
boolean the orchestrator expects.

### DD-3: `dropActiveConnections` stops the runtime and clears the
local ref

After revoke + rotation, the bridge no longer holds a valid token
for any previously-paired device, so the listener is best stopped
until the user runs `Pair iPad` again. The next `activate()` (or
`Pair iPad` once wired) will rebind from disk.

### DD-4: Module-level `_runtime` is already `let`

The existing code mutates `_runtime`. We piggyback on the same
pattern with `let _store: PairedDeviceStore | undefined`. Both refs
are cleared in `deactivate`.

## Compile-and-test strategy

- **Unit:** the orchestrator unit tests (already on main) cover the
  call-order and edge cases. No new mocha file in this PR.
- **Structural (smoke):** shell greps for files, `registerCommand`
  call sites, the two command ids, and `context.subscriptions.push`.
- **Visual (dev build):** **DEFERRED** — pair an iPad, then run
  `NZRCode: List Paired Devices` → confirm QuickPick. Run
  `NZRCode: Revoke iPad` → confirm prompt → confirm Mac side ends with
  the success toast and the connection closes.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `extensions/nzrcode-bridge/src/extension.ts` | modify | wire 2 commands |
| `test/nzrcode-command-wiring/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0016-bridge-command-wiring/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 5 clarifications resolved, 3 risks declared.
- **II (Test-first):** T001 RED smoke → T002 wiring green.
- **III (Simplicity):** zero new deps; only inline adapters added.
- **IV (Evidence):** run-all output captured in T003.
- **V (Provider):** no provider switch.
- **VI (Privacy):** auth token never logged; redactToken usage unchanged.
- **VII (Attribution):** original to NZRCode.
