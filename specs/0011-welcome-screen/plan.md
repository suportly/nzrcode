# Plan 0011 — Welcome Screen

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0011-welcome-screen`
**Generated:** 2026-05-15
**Language:** pt-BR

## Architecture sketch

```
contrib/nzr/browser/
  welcomeFlow.ts                                 # pure helpers, no DI
    ├─ WELCOME_SHOWN_STORAGE_KEY = 'nzr.welcome.shown'
    ├─ WelcomeActionId = 'startMissionControl' | 'addStation' | 'dontShowAgain'
    ├─ buildWelcomeMessage(): string              # localized greeting
    └─ buildWelcomeActionDescriptors(): readonly IWelcomeActionDescriptor[]
                                                  # 3 descriptors, each
                                                  # { id, label, commandId? }
  welcome.contribution.ts                        # contribution + Action2
    ├─ class WelcomeNotificationContribution implements IWorkbenchContribution
    │     ├─ constructor(@INotificationService, @IStorageService, @ICommandService)
    │     └─ if !storage.getBoolean(key): _showWelcomeNotification()
    ├─ class ShowWelcomeAction extends Action2 (id='nzr.welcome.show', f1)
    └─ Registry.registerWorkbenchContribution(..., LifecyclePhase.Restored)

test/browser/
  welcomeFlow.test.ts                            # mocha covering pure helpers

workbench.common.main.ts                         # +1 import: welcome.contribution.js

test/nzrcode-welcome/
  run_all.sh
  test_files_exist.sh
  test_contribution_registered.sh                # greps for class + LifecyclePhase + storage key
  test_command_registered.sh                     # greps for 'nzr.welcome.show' + Action2
  test_no_new_deps.sh
  test_i18n_strings.sh
  README.md
```

## Key design decisions

### DD-1: Descriptor-based action set, not direct `IPromptChoice` factory

The pure helper returns plain `IWelcomeActionDescriptor` objects with
typed `id` + `label` + optional `commandId`. The contribution converts
descriptors → `IPromptChoice` objects, attaching the `run()` callbacks
that close over `ICommandService` and `IStorageService`. This keeps
the helper testable without faking VS Code services.

### DD-2: Mark flag inside every choice's `run()` AND inside `onCancel`

Each prompt choice's `run()` calls `storageService.store(key, true,
PROFILE, MACHINE)` before dispatching the command. `onCancel` does the
same. This guarantees that *any* user interaction (click action or
close the toast) opts out of the auto-show — the only way to get the
welcome back is the explicit `nzr.welcome.show` palette command.

### DD-3: The manual `nzr.welcome.show` command does NOT touch storage

It shares the notification-building code via a private helper on the
contribution, but bypasses the `storage.getBoolean` gate. After the
manual show, clicking an action still writes `true`, which is a no-op
if the flag is already set.

### DD-4: Use the existing `MissionControlActiveContext` key for nothing here

Unlike feature 0010 we do *not* gate the welcome by Mission Control's
active state. The whole point of the welcome is to *introduce* the
user to Mission Control before it has ever been active.

### DD-5: One contribution class for both auto-show and manual replay

The Action2 calls a private method on the contribution instance via
the workbench contribution lookup. Simpler alternative: register the
Action2 standalone and let it pull `IWelcomeNotifier` from DI — but
that's an extra service for a one-shot toast. Pragmatic: put the
notify code in a static helper that both code paths invoke.

## ADR-1: Notification vs. custom editor input

**Decision:** `INotificationService.notify` (toast).

**Alternatives considered:**

- **Custom editor input** (like `GettingStartedInput`) — heavy: requires
  a new `IEditorSerializer`, opening logic, a DOM tree with the NZR
  wordmark + buttons. Out of scope for an initial PR.
- **`IBannerService.show`** — requires `welcomeBanner` to be passed
  through `environmentService.options` by the embedder; not under our
  control in a standalone build.
- **Walkthrough via `IWalkthroughsService.registerWalkthrough`** —
  the descriptor needs `media: { type: 'svg', path: URI, altText }`
  pointing at a real SVG file shipped in `media/`. Doable but adds
  asset+resolution work disproportionate to the feature's intent.

**Status:** revisit when the brand has settled enough to invest in a
walkthrough story. Track as `decision-0011-1.md`.

## Compile-and-test strategy

- **Unit-level (mocha):** `welcomeFlow.test.ts` covers
  `buildWelcomeActionDescriptors` (3 entries, exact ids and command
  bindings) and `buildWelcomeMessage` (non-empty + contains a known
  brand token).
- **Structural (smoke):** shell greps for files, contribution
  registration, command id, storage key literal, workbench main import,
  no-new-deps, localize usage.
- **Visual (dev build):** **DEFERRED** — requires
  `npm install && npm run compile && ./scripts/code.sh`. User to
  validate the toast on first run + `nzr.welcome.show` replay.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `src/vs/workbench/contrib/nzr/browser/welcomeFlow.ts` | create | pure helpers |
| `src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts` | create | contribution + Action2 |
| `src/vs/workbench/contrib/nzr/test/browser/welcomeFlow.test.ts` | create | mocha tests |
| `src/vs/workbench/workbench.common.main.ts` | modify | add 1 import line |
| `test/nzrcode-welcome/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0011-welcome-screen/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md present, 5 clarifications resolved, 3 risks declared.
- **II (Test-first):** T001 RED smoke + stub mocha → T002 helpers green → T003 contribution green → T004 import green.
- **III (Simplicity):** zero new deps; one contribution + one command; pure helpers.
- **IV (Evidence):** run-all output captured in T005.
- **V (Provider):** no provider switch.
- **VI (Privacy):** no telemetry; storage flag is local-only.
- **VII (Attribution):** original to NZRCode.
