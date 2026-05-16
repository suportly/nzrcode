# Tasks 0011 — Welcome Screen

**Branch:** `feature/0011-welcome-screen`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-15
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stub (RED)
- **Status:** done
- **Files:**
  - create: `test/nzrcode-welcome/{test_files_exist,test_contribution_registered,test_command_registered,test_no_new_deps,test_i18n_strings,run_all}.sh`
  - create: `test/nzrcode-welcome/README.md`
  - create: `src/vs/workbench/contrib/nzr/test/browser/welcomeFlow.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh` references the future 2 source files.
  - [ ] `test_contribution_registered.sh` greps for `WelcomeNotificationContribution`, `LifecyclePhase.Restored`, `nzr.welcome.shown`.
  - [ ] `test_command_registered.sh` greps for `nzr.welcome.show`, `Action2`, `f1: true`.
  - [ ] `test_no_new_deps.sh` passes (no root package.json drift).
  - [ ] `test_i18n_strings.sh` confirms `localize`/`localize2` usage in contribution.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-welcome): T001 add welcome smoke suite + mocha stub (RED)`.

### T002 — `welcomeFlow.ts` (pure helpers) + tests
- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/welcomeFlow.ts`
  - modify: `src/vs/workbench/contrib/nzr/test/browser/welcomeFlow.test.ts`
- **Acceptance:**
  - [ ] Exports `WELCOME_SHOWN_STORAGE_KEY = 'nzr.welcome.shown'`.
  - [ ] Exports `type WelcomeActionId = 'startMissionControl' | 'addStation' | 'dontShowAgain'`.
  - [ ] Exports `interface IWelcomeActionDescriptor { id: WelcomeActionId; label: string; commandId?: string }`.
  - [ ] Exports `function buildWelcomeActionDescriptors(): readonly IWelcomeActionDescriptor[]` returning exactly 3 descriptors (ids: 'startMissionControl' → cmd 'nzr.toggleMissionControl', 'addStation' → cmd 'nzr.station.add', 'dontShowAgain' → no commandId).
  - [ ] Exports `function buildWelcomeMessage(): string` returning a localized non-empty greeting mentioning "NZRCode".
  - [ ] Mocha covers descriptor count, each descriptor's id/commandId, message non-empty + brand token.
  - [ ] Commit: `feat(nzr-welcome): T002 add welcomeFlow pure helpers`.

### T003 — `welcome.contribution.ts` (contribution + command)
- **Status:** done
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts`
- **Acceptance:**
  - [ ] Defines `class WelcomeNotificationContribution implements IWorkbenchContribution`.
  - [ ] Contribution constructor reads `IStorageService.getBoolean(WELCOME_SHOWN_STORAGE_KEY, StorageScope.PROFILE, false)`; if false, calls a private `_showWelcomeNotification()` helper.
  - [ ] `_showWelcomeNotification()` builds `IPromptChoice[]` from `buildWelcomeActionDescriptors()`; each choice's `run()` stores `true` in `IStorageService` and (when a `commandId` is present) calls `ICommandService.executeCommand`.
  - [ ] `INotificationService.notify({ severity: Severity.Info, message: buildWelcomeMessage(), actions: { primary: choices }, sticky: true })`.
  - [ ] Defines `class ShowWelcomeAction extends Action2` with `id: 'nzr.welcome.show'`, `category: NZR_CATEGORY`, `f1: true`; its `run` reuses the same helper but forces the notification regardless of storage flag.
  - [ ] `Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WelcomeNotificationContribution, LifecyclePhase.Restored)`.
  - [ ] All visible strings via `localize`/`localize2`.
  - [ ] Commit: `feat(nzr-welcome): T003 add welcome contribution + nzr.welcome.show command`.

### T004 — Wire workbench main
- **Status:** done
- **Depends on:** T003
- **Files:**
  - modify: `src/vs/workbench/workbench.common.main.ts`
- **Acceptance:**
  - [ ] Adds `import './contrib/nzr/browser/welcome.contribution.js';` after the other NZR contributions.
  - [ ] `run_all.sh` exits 0.
  - [ ] Commit: `feat(nzr-welcome): T004 register welcome contribution in workbench main`.

### T005 — Verify + push + PR
- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `specs/0011-welcome-screen/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-welcome/run_all.sh` exit 0.
  - [ ] No regression in prior smoke suites.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. T002/T003 share types; serial is safer.
