# Plan 0010 — Add Station Palette

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0010-add-station-palette`
**Generated:** 2026-05-15
**Language:** pt-BR

## Architecture sketch

```
contrib/nzr/browser/
  stationPaletteFlow.ts                          # pure helpers, no DI
    ├─ PRESETS: readonly ['django-react', 'expo-mobile', 'python-cli', 'lean']
    ├─ buildStationQuickPickItems(stations): readonly IStationPickItem[]
    ├─ humanizeStage(stage): string
    ├─ validateRepoPath(input): string | undefined        # for input() validateInput
    └─ DEFAULT_BRANCH = 'main'
  stationPalette.contribution.ts                 # 3 Action2s + 1 keybinding
    ├─ class AddStationAction extends Action2
    ├─ class SwitchStationAction extends Action2
    ├─ class CloseStationAction extends Action2
    └─ KeybindingsRegistry.registerKeybindingRule({ command: 'nzr.station.add', primary: Cmd+Shift+S, when: nzr.missionControl.active })

test/browser/
  stationPaletteFlow.test.ts                     # mocha covering pure helpers
                                                 # cases: empty stations, 1+ stations,
                                                 #        each stage value, validateRepoPath
                                                 #        edge cases (empty / whitespace)

workbench.common.main.ts                         # +1 import: stationPalette.contribution.js

test/nzrcode-station-palette/
  run_all.sh
  test_files_exist.sh
  test_commands_registered.sh                    # greps for 3 command ids + Action2 + category
  test_keybinding.sh                             # greps for ⌘⇧S + when-clause
  test_no_new_deps.sh
  test_i18n_strings.sh
  README.md
```

## Key design decisions

### DD-1: Pure flow helpers extracted from `Action2.run`

`Action2.run(accessor)` is hard to unit-test (would need a full
`InstantiationService` mock). Instead, we extract the *decision logic*
(what items to show, what to validate, what to format) into pure
functions in `stationPaletteFlow.ts`, leaving `Action2.run` as a thin
orchestrator that pulls services and calls helpers. The helpers carry
the unit-test surface; the orchestrator carries the integration surface
(covered by the smoke grep tests).

### DD-2: Linear 3-step flow over single multi-pick

For "Add Station" we use 3 sequential `pick()` / `input()` calls rather
than a single composite widget. Reasons:

- Matches existing VS Code UX (e.g. "Tasks: Configure Task" runs
  sequentially).
- Each step can have its own placeholder + validation.
- Cancelling at any step (return value `undefined`) cleanly aborts.

Trade-off: 3 modal hops instead of 1 form. Acceptable v1.

### DD-3: Switch focuses container, not card

Spec cl-5 of feature 0007 deferred `revealStation(id)`. Without that
API, "Switch Station" can only focus the Mission Control container.
This is documented in spec out-of-scope and we keep the command useful
(better than nothing) — when feature 0013+ exposes
`revealStation(id)`, we add a second `commandService.executeCommand`
call to scroll the matching card into view.

### DD-4: Close uses `INotificationService.prompt`, not `IDialogService.confirm`

`prompt` is lighter and matches existing NZR contribs (no other NZR
feature has pulled in `IDialogService` yet). Carries a single `Close`
button labelled "Close Station". Dismissing the toast = cancel.

### DD-5: One keybinding, not three

Only `Add Station` gets a keybinding. `Switch` and `Close` stay
palette-only. Reasons:

- Keybinding real-estate is precious. `⌘⇧S` is the obvious "spawn"
  shortcut; the other two are less hot.
- A user inside the Stations view can switch via the view's own focus
  navigation; a palette shortcut for switch would be redundant.

## ADR-1: Hard-coded preset list vs. registry

**Decision:** hard-coded `readonly` array of 4 strings in
`stationPaletteFlow.ts`.

**Alternatives considered:**

- Pull from a future `IPresetRegistryService` — feature 0012 territory,
  premature now.
- Pull from `<workspace>/.nzrcode/presets/` directory listing — adds
  filesystem coupling to a feature that should stay UI-only.

**Status:** revisit when feature 0012 (settings pipeline section)
introduces preset configuration. Track as `decision-0010-1.md` if the
list grows beyond 4 entries.

## Compile-and-test strategy

- **Unit-level (mocha):** `stationPaletteFlow.test.ts` covers
  `buildStationQuickPickItems` (0 / 1 / N stations, each stage),
  `humanizeStage` (all 9 PipelineStage values),
  `validateRepoPath` (`''`, `'   '`, `'/valid/path'`).
- **Structural (smoke):** shell greps verify the 3 command ids, the
  Action2 class shape, the category string, the keybinding rule + when
  clause, and the workbench main import.
- **Visual (dev build):** **DEFERRED** — requires `npm run compile && ./scripts/code.sh`. User to validate manually after pulling PR.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `src/vs/workbench/contrib/nzr/browser/stationPaletteFlow.ts` | create | pure helpers |
| `src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts` | create | 3 Action2s + keybinding |
| `src/vs/workbench/contrib/nzr/test/browser/stationPaletteFlow.test.ts` | create | mocha tests |
| `src/vs/workbench/workbench.common.main.ts` | modify | add 1 import line |
| `test/nzrcode-station-palette/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0010-add-station-palette/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present with 5 clarifications resolved + 3 risks.
- **II (Test-first):** T001 RED smoke + stub mocha → T002 pure helpers green → T003 contribution green → T004 import green.
- **III (Simplicity):** zero new deps; pure helpers > framework.
- **IV (Evidence):** run-all output captured in T005.
- **V (Provider):** no provider switch.
- **VI (Privacy):** no telemetry.
- **VII (Attribution):** original to NZRCode.
