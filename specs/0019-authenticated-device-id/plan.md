# Plan 0019 — `authenticatedDeviceId` on `BridgeConnection`

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0019-authenticated-device-id`
**Generated:** 2026-05-16
**Language:** pt-BR

## Architecture sketch

```
extensions/nzrcode-bridge/src/server/wsServer.ts        # MODIFY
  ├─ BridgeConnection interface
  │   + readonly authenticatedDeviceId: string | undefined  (getter)
  │   + _setAuthenticatedDeviceId(deviceId: string): void   (@internal)
  └─ wrapConnection: holds `let authenticatedDeviceId: string | undefined;`
     in the closure and exposes both members on the returned object.

extensions/nzrcode-bridge/src/server/dispatcher.ts      # MODIFY
  └─ _handleUnauthenticated:
     - on lookup = {deviceId}: call conn._setAuthenticatedDeviceId(deviceId)
     - on lookup = {pending: true}: do nothing
     (Both paths still send {ok: true} and flip authenticated = true.)

extensions/nzrcode-bridge/src/test/unit/dispatcher.test.ts  # MODIFY
  └─ Add 2 cases:
     - persistent match → conn.authenticatedDeviceId === 'test-device'
     - (pending path requires a second-level controller; covered via a
        dedicated test that uses findTokenMatch with a pending slot)

extensions/nzrcode-bridge/src/test/unit/wsServer.test.ts    # MODIFY (if it exists)
  └─ Fresh connection has authenticatedDeviceId === undefined.

test/nzrcode-authenticated-device-id/                    # CREATE
  run_all.sh
  test_files_exist.sh
  test_wired.sh                # greps wsServer + dispatcher
  test_no_new_deps.sh
  README.md
```

## Key design decisions

### DD-1: Mutable field hidden in `wrapConnection`'s closure

The wrapper already uses a closure-state pattern for things like the
`onMessage` handler. Adding one more local variable keeps the
encapsulation pattern consistent. The internal setter is the only way
to mutate it.

### DD-2: Pending sockets keep `authenticatedDeviceId === undefined`

The pair flow is the only producer of pending matches. Until
`system.register` arrives and promotes the token into the persistent
map, the connection has no identity. Future consumers that care about
pending state can read `connection.isOpen()` + the dispatcher's
internal state if needed; this PR doesn't expose pair-status.

### DD-3: No event-emitter on the field

Consumers that need to react to the field setting can subscribe to
`onMessage` (the first message after auth carries the system.hello
call) or listen for `onClose`. Adding an `onAuthenticated` event for a
single state transition would be overkill.

## Compile-and-test strategy

- **Unit (mocha):**
  - Dispatcher: persistent match attaches the deviceId; pending match
    does not. (Use `findTokenMatch` with a tokens map + no pending
    slot, and another with only a pending slot.)
  - wsServer wrapper (if a unit test exists): fresh connection has
    `authenticatedDeviceId === undefined`.
- **Structural (smoke):** grep wsServer for the field declaration and
  the setter; grep dispatcher for the call site.
- **Visual (dev build):** **DEFERRED**.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `extensions/nzrcode-bridge/src/server/wsServer.ts` | modify | add field + setter |
| `extensions/nzrcode-bridge/src/server/dispatcher.ts` | modify | attach deviceId post-auth |
| `extensions/nzrcode-bridge/src/test/unit/dispatcher.test.ts` | modify | + 2 mocha cases |
| `test/nzrcode-authenticated-device-id/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0019-authenticated-device-id/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 4 clarifications resolved, 2 risks declared.
- **II (Test-first):** T001 RED → T002 wsServer green → T003 dispatcher green.
- **III (Simplicity):** zero new deps; one new field; one new dispatcher call.
- **IV (Evidence):** run-all output captured in T004.
- **V (Provider):** no provider switch.
- **VI (Privacy):** deviceId is local-only; not in any wire frame this PR touches.
- **VII (Attribution):** original to NZRCode.
