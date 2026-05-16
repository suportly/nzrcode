# Smoke tests — Welcome Screen (feature 0011)

Structural greps for `feature/0011-welcome-screen`.

## Run

```
bash test/nzrcode-welcome/run_all.sh
```

Exits 0 when:
- both source files exist (`welcomeFlow.ts`, `welcome.contribution.ts`),
- the contribution class is registered with `LifecyclePhase.Restored` and references the `nzr.welcome.shown` storage key,
- the `nzr.welcome.show` Action2 command is registered (`f1: true`),
- no new NPM root deps,
- all visible strings use `localize` / `localize2`.
