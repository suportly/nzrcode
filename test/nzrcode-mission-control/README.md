# Mission Control smoke tests

Structural checks for feature `0006-mission-control-shell`. Behavioural
coverage lives in two mocha files under
`src/vs/workbench/services/nzr/test/common/` (gridLayout + service).

## Run

```sh
bash test/nzrcode-mission-control/run_all.sh
```

## What each script checks

- `test_files_exist.sh` — six source files of the feature exist.
- `test_interface_shape.sh` — `gridLayout.ts` exports `computeGridLayout`
  and the `GridLayout` type; `missionControl.ts` declares
  `IMissionControlService` with the contract from spec Story 3 (two
  events, three readonly members, two methods) plus `MissionControlSlot`.
- `test_command_registered.sh` — the browser contribution registers
  `nzr.toggleMissionControl` via `Action2`, declares
  `nzr.missionControl.active` as a `RawContextKey<boolean>`, and the
  workbench main file imports the contribution.

## Out of scope here

- Behavioural correctness of `computeGridLayout` for each `stationCount` —
  mocha `gridLayout.test.ts`.
- Slot reflow on station add/remove — mocha `missionControlService.test.ts`.
- Real toggle invocation through the command palette — dev build smoke
  (deferred).
