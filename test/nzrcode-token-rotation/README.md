# Smoke tests — Bridge Token Rotation on Revoke (feature 0015)

Structural greps for `feature/0015-bridge-token-rotation-on-revoke`.

## Run

```
bash test/nzrcode-token-rotation/run_all.sh
```

Exits 0 when:
- `state.ts` exports `rotateToken`,
- `revokeCommand.ts` carries a `rotateToken` field on `RevokeIpadDeps` and `runRevokeIpadCommand` calls it,
- mocha test files exist,
- no new NPM root deps.
