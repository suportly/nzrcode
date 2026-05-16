# Smoke tests — Bridge Command Wiring (feature 0016)

Structural greps for `feature/0016-bridge-command-wiring`.

## Run

```
bash test/nzrcode-command-wiring/run_all.sh
```

Exits 0 when:
- `extension.ts` constructs `PairedDeviceStore` and calls `runListPairedDevicesCommand` + `runRevokeIpadCommand`,
- both palette commands (`nzrcode-bridge.listPairedDevices`, `nzrcode-bridge.revokeIpad`) are registered via `vscode.commands.registerCommand`,
- disposables are pushed to `context.subscriptions`,
- no new NPM root deps.
