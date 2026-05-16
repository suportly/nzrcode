# Smoke tests — Authenticated Device ID (feature 0019)

Structural greps for `feature/0019-authenticated-device-id`.

## Run

```
bash test/nzrcode-authenticated-device-id/run_all.sh
```

Exits 0 when:
- `wsServer.ts` declares `authenticatedDeviceId` on `BridgeConnection` and exposes `_setAuthenticatedDeviceId`,
- `dispatcher.ts` calls `_setAuthenticatedDeviceId` post-auth,
- no new NPM root deps.
