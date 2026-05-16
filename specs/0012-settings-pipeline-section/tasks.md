# Tasks 0012 — Settings Pipeline Section

**Branch:** `feature/0012-settings-pipeline-section`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-15
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stub (RED)
- **Status:** done
- **Files:**
  - create: `test/nzrcode-settings/{test_files_exist,test_configuration_registered,test_no_new_deps,test_i18n_strings,run_all}.sh`
  - create: `test/nzrcode-settings/README.md`
  - create: `src/vs/workbench/contrib/nzr/test/browser/nzrPipelineSettings.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh` references both future source files.
  - [ ] `test_configuration_registered.sh` greps for `registerConfiguration`, `id: 'nzrcode'`, all 4 setting keys (`nzrcode.pipeline.defaultPreset`, `nzrcode.pipeline.defaultBranch`, `nzrcode.welcome.showOnStartup`, `nzrcode.missionControl.autoActivate`), and `'lean'` as a default.
  - [ ] `test_no_new_deps.sh` passes (no root package.json drift).
  - [ ] `test_i18n_strings.sh` confirms `localize` usage in contribution.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-settings): T001 add settings smoke suite + mocha stub (RED)`.

### T002 — `nzrPipelineSettings.ts` (pure helpers) + tests
- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/nzrPipelineSettings.ts`
  - modify: `src/vs/workbench/contrib/nzr/test/browser/nzrPipelineSettings.test.ts`
- **Acceptance:**
  - [ ] Exports `PIPELINE_PRESETS = ['django-react', 'expo-mobile', 'python-cli', 'lean'] as const`.
  - [ ] Exports `type Preset = typeof PIPELINE_PRESETS[number]`.
  - [ ] Exports 4 setting-key constants: `SETTING_DEFAULT_PRESET`, `SETTING_DEFAULT_BRANCH`, `SETTING_WELCOME_SHOW_ON_STARTUP`, `SETTING_MISSION_CONTROL_AUTO_ACTIVATE`.
  - [ ] Exports 4 default constants matching the schema: `DEFAULT_PRESET = 'lean'`, `DEFAULT_BRANCH = 'main'`, `DEFAULT_WELCOME_SHOW_ON_STARTUP = true`, `DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE = false`.
  - [ ] Exports `function isValidPreset(value: unknown): value is Preset`.
  - [ ] Exports `function getDefaultPreset(configurationService): Preset` — uses `isValidPreset` to fall back to `DEFAULT_PRESET`.
  - [ ] Exports `function getDefaultBranch(configurationService): string` — falls back to `DEFAULT_BRANCH` when the value is empty / undefined.
  - [ ] Exports `function getWelcomeShowOnStartup(configurationService): boolean` — boolean-coerces with `DEFAULT_WELCOME_SHOW_ON_STARTUP` fallback.
  - [ ] Exports `function getMissionControlAutoActivate(configurationService): boolean` — boolean-coerces with `DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE` fallback.
  - [ ] Mocha covers each reader for: (a) value present/valid, (b) value absent, (c) `defaultPreset` invalid string (fallback path), (d) `defaultBranch` empty string (fallback path).
  - [ ] Commit: `feat(nzr-settings): T002 add nzrPipelineSettings pure helpers`.

### T003 — `settings.contribution.ts` (ConfigurationRegistry)
- **Status:** done
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/settings.contribution.ts`
- **Acceptance:**
  - [ ] Imports the 4 setting-key constants + defaults + `PIPELINE_PRESETS` from `./nzrPipelineSettings.js`.
  - [ ] Calls `Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({...})` with `id: 'nzrcode'`, `order: 200`, `title: localize('nzrcodeConfigurationTitle', 'NZRCode')`, `type: 'object'`, and exactly the 4 properties from the spec.
  - [ ] `nzrcode.pipeline.defaultPreset` uses `enum: PIPELINE_PRESETS`, `default: DEFAULT_PRESET`, scope `APPLICATION`, with localized description + `enumDescriptions`.
  - [ ] `nzrcode.pipeline.defaultBranch` is a string with `default: DEFAULT_BRANCH`, scope `APPLICATION`, localized description.
  - [ ] `nzrcode.welcome.showOnStartup` boolean, `default: DEFAULT_WELCOME_SHOW_ON_STARTUP`, scope `APPLICATION`, localized description.
  - [ ] `nzrcode.missionControl.autoActivate` boolean, `default: DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE`, scope `APPLICATION`, localized description.
  - [ ] All visible strings via `localize`.
  - [ ] Commit: `feat(nzr-settings): T003 register NZRCode pipeline settings schema`.

### T004 — Wire workbench main
- **Status:** done
- **Depends on:** T003
- **Files:**
  - modify: `src/vs/workbench/workbench.common.main.ts`
- **Acceptance:**
  - [ ] Adds `import './contrib/nzr/browser/settings.contribution.js';` after the other NZR contributions.
  - [ ] `run_all.sh` exits 0.
  - [ ] Commit: `feat(nzr-settings): T004 register settings contribution in workbench main`.

### T005 — Verify + push + PR
- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `specs/0012-settings-pipeline-section/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-settings/run_all.sh` exit 0.
  - [ ] No regression in prior smoke suites.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. T002/T003 share constants — serial is safer.
