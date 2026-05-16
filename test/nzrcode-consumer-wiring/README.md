# Smoke tests — Consumer Wiring + PRESETS Dedup (feature 0013)

Structural greps for `feature/0013-consumer-wiring-and-presets-dedup`.

## Run

```
bash test/nzrcode-consumer-wiring/run_all.sh
```

Exits 0 when:
- both helper files exist (`nzrPaletteDefaults.ts`, `nzrWelcomeGate.ts`),
- `stationPaletteFlow.ts` no longer declares its own preset list — re-exports from `nzrPipelineSettings.ts`,
- `stationPalette.contribution.ts` consumes `IConfigurationService` and `resolveAddStationDefaults`,
- `welcome.contribution.ts` consumes `IConfigurationService` and `shouldAutoShowWelcome`,
- no new NPM root deps,
- all visible strings use `localize`.
