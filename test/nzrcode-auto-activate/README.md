# Smoke tests — Mission Control Auto-Activate (feature 0014)

Structural greps for `feature/0014-mission-control-auto-activate`.

## Run

```
bash test/nzrcode-auto-activate/run_all.sh
```

Exits 0 when:
- both source files exist (`missionControlAutoActivate.ts`, `missionControlAutoActivate.contribution.ts`),
- the contribution class is registered at `LifecyclePhase.Restored` and consumes `shouldAutoActivateMissionControl`,
- `workbench.common.main.ts` imports the new contribution,
- no new NPM root deps.
