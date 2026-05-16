# Plan 0013 — Consumer Wiring + PRESETS Dedup

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0013-consumer-wiring-and-presets-dedup`
**Generated:** 2026-05-16
**Language:** pt-BR

## Architecture sketch

```
contrib/nzr/browser/
  nzrPaletteDefaults.ts                          # NEW pure helper
    └─ resolveAddStationDefaults(cs): { preset: Preset; branch: string }
       (combines getDefaultPreset + getDefaultBranch from settings)
  nzrWelcomeGate.ts                              # NEW pure helper
    └─ shouldAutoShowWelcome(storage, cs): boolean
       (true ↔ storage flag absent AND setting true)
  stationPaletteFlow.ts                          # MODIFY (drop local PRESETS,
                                                 #         re-export from settings)
  stationPalette.contribution.ts                 # MODIFY (inject IConfigService,
                                                 #         reorder preset list,
                                                 #         pre-fill branch)
  welcome.contribution.ts                        # MODIFY (inject IConfigService,
                                                 #         gate auto-show with helper)

test/browser/
  nzrPaletteDefaults.test.ts                     # NEW
  nzrWelcomeGate.test.ts                         # NEW
  stationPaletteFlow.test.ts                     # UNCHANGED (still asserts 4 strings)

test/nzrcode-consumer-wiring/
  run_all.sh
  test_files_exist.sh
  test_presets_deduped.sh                        # asserts stationPaletteFlow no longer
                                                 #   has a const array literal of 4 strings
  test_addstation_uses_settings.sh               # greps for IConfigurationService +
                                                 #   resolveAddStationDefaults in
                                                 #   stationPalette.contribution.ts
  test_welcome_uses_settings.sh                  # greps for IConfigurationService +
                                                 #   shouldAutoShowWelcome in
                                                 #   welcome.contribution.ts
  test_no_new_deps.sh
  test_i18n_strings.sh
  README.md
```

## Key design decisions

### DD-1: Two narrow helper modules instead of one shared "ConsumerHelpers"

Each consumer has different inputs (`Add Station` reads 2 settings;
`Welcome` reads 1 setting + storage state). Keeping the modules narrow
makes both reader signatures testable without surface bleed.

### DD-2: Reorder logic lives next to the contribution, not in the helper

`resolveAddStationDefaults` returns `{ preset, branch }`. The
*reordering* of the QuickPick (default first) is a presentation choice
done inside `AddStationAction.run`. Keeping reorder in the
contribution means the helper stays purely data — easier to test, no
ordering assertion needed.

### DD-3: `shouldAutoShowWelcome` is a pure predicate

```
shouldAutoShowWelcome(storage, cs) =
  !storage.getBoolean(WELCOME_SHOWN_KEY, PROFILE, false)
  AND getWelcomeShowOnStartup(cs)
```

Both inputs are read directly inside the function via the standard
service decorators. The function returns a boolean; the contribution
constructor branches on it.

### DD-4: Dedup pattern — `export { PIPELINE_PRESETS as PRESETS } from '...'`

TypeScript re-export-with-rename keeps the call sites untouched. We
also re-export the `Preset` type. The old `DEFAULT_BRANCH` constant in
`stationPaletteFlow.ts` is **kept** because it predates the settings
infrastructure and 0010's mocha test asserts the literal. Spec 0012
already has its own `DEFAULT_BRANCH`; both export the same string
`'main'`, so duplication is acceptable until a third caller appears.

### DD-5: No test for the i18n string "(default)"

The reorder marks the default-preset pick with
`description: localize('nzrAddStationPresetDefaultDescription',
'(default)')`. We don't write a separate assertion for this string —
it's covered by `test_i18n_strings.sh` which already greps for any
`localize(...)` call.

## ADR-1: Re-export vs. import-and-realias

**Decision:** `export { PIPELINE_PRESETS as PRESETS, type Preset } from '...'`.

**Alternatives considered:**

- **Drop `PRESETS` entirely, update all callers**: cleaner but
  touches more files. Out of scope vs. the minimal-change principle
  for a dedup task.
- **Make `stationPaletteFlow.ts` import + redeclare**: two declarations
  of the same const, brittle if 0012's preset list grows.

**Status:** Revisit if a third caller appears for either name; collapse
to one canonical name then.

## Compile-and-test strategy

- **Unit-level (mocha):**
  - `nzrPaletteDefaults.test.ts` covers `resolveAddStationDefaults` for: default fallback, valid preset, invalid preset (falls back), empty branch (falls back).
  - `nzrWelcomeGate.test.ts` covers `shouldAutoShowWelcome` for all 4 boolean-cartesian states (flag×setting).
- **Structural (smoke):** dedup grep + wiring greps + no-new-deps + i18n.
- **Visual (dev build):** **DEFERRED** — visual confirmation that the
  default preset appears first in the QuickPick + welcome stays hidden
  when the setting is `false`.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `src/vs/workbench/contrib/nzr/browser/nzrPaletteDefaults.ts` | create | pure helper combining 2 setting readers |
| `src/vs/workbench/contrib/nzr/browser/nzrWelcomeGate.ts` | create | pure predicate (flag AND setting) |
| `src/vs/workbench/contrib/nzr/browser/stationPaletteFlow.ts` | modify | drop local PRESETS, re-export |
| `src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts` | modify | inject IConfigurationService, use helper |
| `src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts` | modify | inject IConfigurationService, use helper |
| `src/vs/workbench/contrib/nzr/test/browser/nzrPaletteDefaults.test.ts` | create | mocha |
| `src/vs/workbench/contrib/nzr/test/browser/nzrWelcomeGate.test.ts` | create | mocha |
| `test/nzrcode-consumer-wiring/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0013-consumer-wiring-and-presets-dedup/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 4 clarifications resolved, 3 risks declared.
- **II (Test-first):** T001 RED smoke + mocha stubs → T002 dedup green → T003 + T004 wiring green.
- **III (Simplicity):** zero new deps; two narrow helpers; no DOM.
- **IV (Evidence):** run-all output captured in T005.
- **V (Provider):** no provider switch.
- **VI (Privacy):** no telemetry; settings + storage only.
- **VII (Attribution):** original to NZRCode.
