# Smoke tests — Station Palette (feature 0010)

Structural greps for `feature/0010-add-station-palette`.

## Run

```
bash test/nzrcode-station-palette/run_all.sh
```

Exits 0 when:
- both source files exist (`stationPaletteFlow.ts`, `stationPalette.contribution.ts`),
- the 3 command ids + Action2 shape + NZR category are present,
- the `⌘⇧S` keybinding is registered with `nzr.missionControl.active` gate,
- no new NPM root deps,
- all visible strings are wrapped in `localize`.
