# Smoke tests — Per-Device Tokens (feature 0018)

Structural greps for `feature/0018-per-device-tokens`.

## Run

```
bash test/nzrcode-per-device-tokens/run_all.sh
```

Exits 0 when:
- `state.ts` carries `tokens: Record<string, string>` and `version: 2`,
- `addToken` / `removeToken` / `getTokens` exported from `state.ts`,
- `rotateToken` is gone,
- `findTokenMatch` exported from `auth.ts`,
- no new NPM root deps.
