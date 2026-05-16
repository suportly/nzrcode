# Plan 0012 — Settings Pipeline Section

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0012-settings-pipeline-section`
**Generated:** 2026-05-15
**Language:** pt-BR

## Architecture sketch

```
contrib/nzr/browser/
  nzrPipelineSettings.ts                         # pure helpers, no DI
    ├─ Setting key constants (4)
    ├─ Setting defaults (4 constants)
    ├─ PIPELINE_PRESETS = ['django-react', 'expo-mobile', 'python-cli', 'lean'] as const
    ├─ type Preset = typeof PIPELINE_PRESETS[number]
    ├─ isValidPreset(value: unknown): value is Preset
    ├─ getDefaultPreset(configurationService): Preset
    ├─ getDefaultBranch(configurationService): string
    ├─ getWelcomeShowOnStartup(configurationService): boolean
    └─ getMissionControlAutoActivate(configurationService): boolean
  settings.contribution.ts                       # ConfigurationRegistry call
    └─ Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
        .registerConfiguration({
          id: 'nzrcode', order: 200, title: 'NZRCode', type: 'object',
          properties: { … 4 properties … }
        })

test/browser/
  nzrPipelineSettings.test.ts                    # mocha covering pure helpers

workbench.common.main.ts                         # +1 import

test/nzrcode-settings/
  run_all.sh
  test_files_exist.sh
  test_configuration_registered.sh               # greps id 'nzrcode', 4 setting keys,
                                                 #        enum, defaults
  test_no_new_deps.sh
  test_i18n_strings.sh
  README.md
```

## Key design decisions

### DD-1: Stub `IConfigurationService` in tests via a hand-rolled fake

VS Code's `IConfigurationService` interface is wide (10+ methods). Our
readers only call `getValue<T>(key: string): T`. The unit test rolls a
2-line fake (`{ getValue(key) { return store[key]; } } as Partial<...>
as IConfigurationService`) so the tests stay focused. This is the same
strategy used in `gridLayout.test.ts` and `gateQueueItem.test.ts`.

### DD-2: Defaults defined once, used twice

The defaults appear in two places: as `default:` values in the JSON
schema, and as fallback values in the typed readers. We export them
as `DEFAULT_PRESET`, `DEFAULT_BRANCH`, `DEFAULT_WELCOME_SHOW_ON_STARTUP`,
`DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE` from `nzrPipelineSettings.ts`
and reference the same constants in the contribution's schema. One
edit point.

### DD-3: `isValidPreset` short-circuits invalid user input

A user hand-editing `settings.json` could put any string under
`nzrcode.pipeline.defaultPreset`. The reader runs the type guard and
falls back to `DEFAULT_PRESET` ('lean') if invalid. We *do not*
surface a warning toast — that's noisy. Invalid → degraded silently,
per spec cl-4.

### DD-4: Single configuration node, not 4 separate ones

`registerConfiguration` accepts one node with N properties. We
register one node so the Settings UI groups them under a single
"NZRCode" parent (with the sub-headers VS Code computes from the
dot-separated property names).

### DD-5: `category` field omitted

The schema doesn't take a `category` per property — grouping in the
Settings UI is derived from the dot path. `nzrcode.pipeline.*` ends up
under `NZRCode > Pipeline`; `nzrcode.welcome.*` under `NZRCode >
Welcome`; `nzrcode.missionControl.*` under `NZRCode > Mission Control`.
This is enough hierarchy for 4 settings without any extra schema
fields.

## ADR-1: Independent PR vs stacking on 0010

**Decision:** Independent PR targeting `main`.

**Alternatives considered:**

- **Stack on `feature/0010-add-station-palette`** so we can import
  `PRESETS` directly: cleaner, but couples merge order. If 0010
  changes during review, 0012 has to rebase.
- **Merge 0010 first**: blocks 0012 unnecessarily.

**Status:** track convergence after both PRs land as
`decision-0012-1.md`. The duplicated 4-string list is the only cost.

## Compile-and-test strategy

- **Unit-level (mocha):** `nzrPipelineSettings.test.ts` exercises each
  reader with: (a) value present and valid, (b) value absent (default),
  (c) for `defaultPreset` an invalid string (falls back to default).
- **Structural (smoke):** shell greps for files, contribution shape,
  4 setting keys + enum + defaults, no-new-deps, localize usage.
- **Visual (dev build):** **DEFERRED** — requires `npm install && npm
  run compile && ./scripts/code.sh`. User to validate the panel under
  Settings → NZRCode.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `src/vs/workbench/contrib/nzr/browser/nzrPipelineSettings.ts` | create | pure helpers + key constants |
| `src/vs/workbench/contrib/nzr/browser/settings.contribution.ts` | create | ConfigurationRegistry call |
| `src/vs/workbench/contrib/nzr/test/browser/nzrPipelineSettings.test.ts` | create | mocha tests |
| `src/vs/workbench/workbench.common.main.ts` | modify | +1 import line |
| `test/nzrcode-settings/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0012-settings-pipeline-section/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 5 clarifications resolved, 3 risks declared.
- **II (Test-first):** T001 RED smoke + stub mocha → T002 helpers green → T003 contribution green → T004 import green.
- **III (Simplicity):** zero new deps; pure helpers + one schema.
- **IV (Evidence):** run-all output captured in T005.
- **V (Provider):** no provider switch.
- **VI (Privacy):** no telemetry; settings only.
- **VII (Attribution):** original to NZRCode.
