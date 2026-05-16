# Smoke tests — Pair iPad Wiring (feature 0017)

Structural greps for `feature/0017-pair-ipad-wiring`.

## Run

```
bash test/nzrcode-pair-wiring/run_all.sh
```

Exits 0 when:
- protocol declares `SystemRegister = 'system.register'`,
- `PairingController` exists with a `pairingSignal` and a `createHandler` factory,
- `bridge.ts` exports `startPairableBridge`,
- `extension.ts` registers `nzrcode-bridge.pairIpad` via `vscode.commands.registerCommand` and invokes `runPairCommand`,
- no new NPM root deps.
