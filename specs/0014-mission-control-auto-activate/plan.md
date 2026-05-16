# Plan 0014 — Mission Control Auto-Activate Consumer

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0014-mission-control-auto-activate`
**Generated:** 2026-05-16
**Language:** pt-BR

## Architecture sketch

```
contrib/nzr/browser/
  missionControlAutoActivate.ts                  # pure predicate, no DI
    ├─ interface IAutoActivateInputs { setting: boolean; isActive: boolean }
    └─ shouldAutoActivateMissionControl(inputs): boolean
  missionControlAutoActivate.contribution.ts     # workbench contribution
    ├─ class MissionControlAutoActivateContribution implements IWorkbenchContribution
    │     ├─ constructor(@IConfigurationService, @IMissionControlService)
    │     └─ if predicate true → missionControlService.setActive(true)
    └─ Registry.registerWorkbenchContribution(..., LifecyclePhase.Restored)

test/browser/
  missionControlAutoActivate.test.ts             # mocha covering predicate
                                                 # (4 cartesian boolean states)

workbench.common.main.ts                         # +1 import line

test/nzrcode-auto-activate/
  run_all.sh
  test_files_exist.sh
  test_contribution_registered.sh                # greps for class, LifecyclePhase,
                                                 #         shouldAutoActivateMissionControl
  test_no_new_deps.sh
  README.md
```

## Key design decisions

### DD-1: Pure predicate over input record, not service references

`shouldAutoActivateMissionControl` takes `{ setting, isActive }` — two
booleans, zero DI. The contribution does the service fetches and feeds
the helper. This keeps the test free of fakes for `IConfigurationService`
+ `IMissionControlService`.

### DD-2: Defensive try/catch in the contribution constructor

Workbench contributions that throw during construction can break the
workbench restore sequence. `setActive(true)` is unlikely to throw (it's
a state mutation + event emit) but we wrap it anyway because
constructor-time exceptions cascade poorly. The catch path silently
drops the activation — the user can still toggle MC manually.

### DD-3: No `onDidChangeConfiguration` listener

Per spec out-of-scope: setting changes during a session do not
re-trigger auto-activation. The contribution does its one-shot work at
construction time and exits.

### DD-4: No i18n strings

The contribution has zero visible strings. `localize` is not imported.
This is the first NZR contribution without `nls` — a clean signal that
this is pure plumbing.

## ADR-1: Predicate-as-pure-function vs. method on the contribution

**Decision:** Pure top-level function in its own module.

**Alternatives considered:**
- Put the logic inside the contribution as a private method: cheaper,
  but couples the test to instantiating the contribution (and thus
  faking 2 services).
- Inline at the call site: trivial logic (one `&&`) doesn't *need*
  extraction — but extraction makes the spec rule
  ("only activates when not already active") readable as a single
  pure function and asserts on it directly.

**Status:** Final unless the predicate grows past 5 lines.

## Compile-and-test strategy

- **Unit-level (mocha):** 4 cartesian cases of (setting, isActive) →
  expected boolean.
- **Structural (smoke):** file existence + contribution registration
  shape + workbench import + no-new-deps.
- **Visual (dev build):** **DEFERRED** — set
  `"nzrcode.missionControl.autoActivate": true` in user settings,
  reload the window, expect Mission Control's context key to flip true
  before user input (downstream features 0007 etc. should render their
  surfaces).

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `src/vs/workbench/contrib/nzr/browser/missionControlAutoActivate.ts` | create | pure predicate |
| `src/vs/workbench/contrib/nzr/browser/missionControlAutoActivate.contribution.ts` | create | contribution wiring |
| `src/vs/workbench/contrib/nzr/test/browser/missionControlAutoActivate.test.ts` | create | mocha tests |
| `src/vs/workbench/workbench.common.main.ts` | modify | +1 import line |
| `test/nzrcode-auto-activate/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0014-mission-control-auto-activate/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 5 clarifications resolved, 3 risks declared.
- **II (Test-first):** T001 RED smoke + mocha stub → T002 predicate green → T003 contribution+workbench green.
- **III (Simplicity):** zero new deps; one pure function + one contribution.
- **IV (Evidence):** run-all output captured in T004.
- **V (Provider):** no provider switch.
- **VI (Privacy):** no telemetry; reads from settings only.
- **VII (Attribution):** original to NZRCode.
