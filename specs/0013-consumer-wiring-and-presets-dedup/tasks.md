# Tasks 0013 — Consumer Wiring + PRESETS Dedup

**Branch:** `feature/0013-consumer-wiring-and-presets-dedup`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stubs (RED)
- **Status:** pending
- **Files:**
  - create: `test/nzrcode-consumer-wiring/{test_files_exist,test_presets_deduped,test_addstation_uses_settings,test_welcome_uses_settings,test_no_new_deps,test_i18n_strings,run_all}.sh`
  - create: `test/nzrcode-consumer-wiring/README.md`
  - create: `src/vs/workbench/contrib/nzr/test/browser/nzrPaletteDefaults.test.ts` (stub)
  - create: `src/vs/workbench/contrib/nzr/test/browser/nzrWelcomeGate.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh` references the 2 new helper files + 2 modified existing files.
  - [ ] `test_presets_deduped.sh` asserts `stationPaletteFlow.ts` does NOT contain `['django-react', 'expo-mobile', 'python-cli', 'lean']` literal anymore and DOES contain `from './nzrPipelineSettings.js'`.
  - [ ] `test_addstation_uses_settings.sh` greps `stationPalette.contribution.ts` for `IConfigurationService` import and `resolveAddStationDefaults`.
  - [ ] `test_welcome_uses_settings.sh` greps `welcome.contribution.ts` for `IConfigurationService` and `shouldAutoShowWelcome`.
  - [ ] `test_no_new_deps.sh` passes.
  - [ ] `test_i18n_strings.sh` confirms localize usage in any new visible string.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-wiring): T001 add consumer-wiring smoke suite + mocha stubs (RED)`.

### T002 — PRESETS dedup
- **Status:** pending
- **Depends on:** T001
- **Files:**
  - modify: `src/vs/workbench/contrib/nzr/browser/stationPaletteFlow.ts`
- **Acceptance:**
  - [ ] Removes the local `PRESETS = [...] as const` declaration.
  - [ ] Adds `export { PIPELINE_PRESETS as PRESETS, type Preset } from './nzrPipelineSettings.js';`.
  - [ ] `test_presets_deduped.sh` GREEN.
  - [ ] Existing `stationPaletteFlow.test.ts` still passes (asserts the same 4 strings).
  - [ ] Commit: `refactor(nzr): T002 dedup PRESETS into nzrPipelineSettings (decision-0012-1)`.

### T003 — Wire AddStationAction to settings
- **Status:** pending
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/nzrPaletteDefaults.ts`
  - modify: `src/vs/workbench/contrib/nzr/test/browser/nzrPaletteDefaults.test.ts`
  - modify: `src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts`
- **Acceptance:**
  - [ ] Exports `interface IAddStationDefaults { preset: Preset; branch: string }`.
  - [ ] Exports `function resolveAddStationDefaults(configurationService): IAddStationDefaults` — delegates to `getDefaultPreset` + `getDefaultBranch` from `nzrPipelineSettings.ts`.
  - [ ] Mocha covers: defaults when nothing is set, valid preset, invalid preset (falls back to `'lean'`), empty branch (falls back to `'main'`).
  - [ ] `AddStationAction.run` now calls `accessor.get(IConfigurationService)` + `resolveAddStationDefaults(...)`; the preset QuickPick reorders so the default is first and labelled `(default)`; the branch `input()` uses `defaults.branch` as the pre-filled value.
  - [ ] `test_addstation_uses_settings.sh` GREEN.
  - [ ] Commit: `feat(nzr-palette): T003 read defaultPreset/defaultBranch from settings`.

### T004 — Wire WelcomeNotification to settings
- **Status:** pending
- **Depends on:** T003
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/nzrWelcomeGate.ts`
  - modify: `src/vs/workbench/contrib/nzr/test/browser/nzrWelcomeGate.test.ts`
  - modify: `src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts`
- **Acceptance:**
  - [ ] Exports `function shouldAutoShowWelcome(storageService, configurationService): boolean`.
  - [ ] Returns `true` only when the storage flag is unset AND `getWelcomeShowOnStartup(...)` is `true`.
  - [ ] Mocha covers 4 boolean-cartesian states.
  - [ ] `WelcomeNotificationContribution` constructor injects `IConfigurationService` and replaces the inline `storageService.getBoolean(...)` check with `shouldAutoShowWelcome(...)`.
  - [ ] `nzr.welcome.show` (manual replay) is unchanged.
  - [ ] `test_welcome_uses_settings.sh` GREEN.
  - [ ] Commit: `feat(nzr-welcome): T004 short-circuit auto-show when setting is disabled`.

### T005 — Verify + push + PR
- **Status:** pending
- **Depends on:** T004
- **Files:**
  - create: `specs/0013-consumer-wiring-and-presets-dedup/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-consumer-wiring/run_all.sh` exit 0.
  - [ ] Prior NZR smoke suites (mission-control, station-view, gate-queue, station-palette, welcome, settings) still pass.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

T003 and T004 are technically independent (different consumer files), but they share the helper-pattern story. Serial keeps reviewer cognitive load low.
