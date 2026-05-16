# Tasks 0010 — Add Station Palette

**Branch:** `feature/0010-add-station-palette`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-15
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stub (RED)
- **Status:** done
- **Files:**
  - create: `test/nzrcode-station-palette/{test_files_exist,test_commands_registered,test_keybinding,test_no_new_deps,test_i18n_strings,run_all}.sh`
  - create: `test/nzrcode-station-palette/README.md`
  - create: `src/vs/workbench/contrib/nzr/test/browser/stationPaletteFlow.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh` references the future 2 source files.
  - [ ] `test_commands_registered.sh` greps for `nzr.station.add`, `nzr.station.switch`, `nzr.station.close`, `category: NZR_CATEGORY` (or literal `'NZR'`), `Action2`, `f1: true`.
  - [ ] `test_keybinding.sh` greps for `KeybindingsRegistry.registerKeybindingRule`, `KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS`, `nzr.missionControl.active`.
  - [ ] `test_no_new_deps.sh` passes (no root package.json drift).
  - [ ] `test_i18n_strings.sh` confirms `localize` usage in contribution.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-palette): T001 add station-palette smoke suite + mocha stub (RED)`.

### T002 — `stationPaletteFlow.ts` (pure helpers) + tests
- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/stationPaletteFlow.ts`
  - modify: `src/vs/workbench/contrib/nzr/test/browser/stationPaletteFlow.test.ts`
- **Acceptance:**
  - [ ] Exports `PRESETS: readonly ['django-react', 'expo-mobile', 'python-cli', 'lean']`.
  - [ ] Exports `DEFAULT_BRANCH = 'main'`.
  - [ ] Exports `interface IStationPickItem extends IQuickPickItem { stationId: string }`.
  - [ ] Exports `function buildStationQuickPickItems(stations): readonly IStationPickItem[]` — items show `repoName • branch` as label and `humanizeStage(pipeline.stage)` as description.
  - [ ] Exports `function humanizeStage(stage: PipelineStage): string` covering all 9 PipelineStage values.
  - [ ] Exports `function validateRepoPath(input: string | undefined): string | undefined` — returns a localized error string when input is empty/whitespace, undefined otherwise.
  - [ ] Mocha covers: empty stations, 1 station, 3 stations, every stage value, validateRepoPath for `''`, `'   '`, `'/some/path'`, `undefined`.
  - [ ] Commit: `feat(nzr-palette): T002 add stationPaletteFlow pure helpers`.

### T003 — `stationPalette.contribution.ts` (3 Action2 + keybinding)
- **Status:** done
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts`
- **Acceptance:**
  - [ ] Registers `AddStationAction` (`id: 'nzr.station.add'`), `SwitchStationAction` (`id: 'nzr.station.switch'`), `CloseStationAction` (`id: 'nzr.station.close'`).
  - [ ] All 3 use `category: NZR_CATEGORY = localize2('nzrCategory', 'NZR')` (or import from missionControl.contribution if exported there — pragmatic: define locally to avoid cross-feature coupling).
  - [ ] All 3 set `f1: true`.
  - [ ] `AddStationAction.run` runs the 3-step flow (preset → branch → repoPath, with `validateRepoPath`) and calls `IStationRegistryService.addStation` then `INotificationService.info`.
  - [ ] `SwitchStationAction.run` builds quick-pick items via `buildStationQuickPickItems`, on accept calls `ICommandService.executeCommand('workbench.view.nzr.missionControl.focus')`.
  - [ ] `CloseStationAction.run` builds quick-pick items, on accept calls `INotificationService.prompt(Severity.Warning, …, [{ label: 'Close Station', run() { removeStation(id) } }])`.
  - [ ] `KeybindingsRegistry.registerKeybindingRule({ id: 'nzr.station.add', primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS, when: MissionControlActiveContext })`.
  - [ ] All visible strings via `localize` / `localize2`.
  - [ ] Commit: `feat(nzr-palette): T003 add 3 station palette commands + ⌘⇧S keybinding`.

### T004 — Wire workbench main
- **Status:** done
- **Depends on:** T003
- **Files:**
  - modify: `src/vs/workbench/workbench.common.main.ts`
- **Acceptance:**
  - [ ] Adds `import './contrib/nzr/browser/stationPalette.contribution.js';` after the missionControl/stationView contributions.
  - [ ] `run_all.sh` exits 0.
  - [ ] Commit: `feat(nzr-palette): T004 register stationPalette contribution in workbench main`.

### T005 — Verify + push + PR
- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `specs/0010-add-station-palette/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-station-palette/run_all.sh` exit 0.
  - [ ] No regression in prior smoke suites (`test/nzrcode-mission-control/run_all.sh`).
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. T002 is the only file with logic; T003 imports it; T004 just adds an import line.
