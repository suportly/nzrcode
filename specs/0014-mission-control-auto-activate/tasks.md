# Tasks 0014 — Mission Control Auto-Activate Consumer

**Branch:** `feature/0014-mission-control-auto-activate`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stub (RED)
- **Status:** pending
- **Files:**
  - create: `test/nzrcode-auto-activate/{test_files_exist,test_contribution_registered,test_no_new_deps,run_all}.sh`
  - create: `test/nzrcode-auto-activate/README.md`
  - create: `src/vs/workbench/contrib/nzr/test/browser/missionControlAutoActivate.test.ts` (stub)
- **Acceptance:**
  - [ ] `test_files_exist.sh` references the 2 future source files.
  - [ ] `test_contribution_registered.sh` greps for `MissionControlAutoActivateContribution`, `LifecyclePhase.Restored`, `shouldAutoActivateMissionControl`, and the workbench main import line.
  - [ ] `test_no_new_deps.sh` passes.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-mc-auto): T001 add auto-activate smoke suite + mocha stub (RED)`.

### T002 — `missionControlAutoActivate.ts` (pure predicate) + tests
- **Status:** pending
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/missionControlAutoActivate.ts`
  - modify: `src/vs/workbench/contrib/nzr/test/browser/missionControlAutoActivate.test.ts`
- **Acceptance:**
  - [ ] Exports `interface IAutoActivateInputs { readonly setting: boolean; readonly isActive: boolean }`.
  - [ ] Exports `function shouldAutoActivateMissionControl(inputs): boolean` returning `inputs.setting && !inputs.isActive`.
  - [ ] Mocha covers the 4 cartesian boolean states.
  - [ ] Commit: `feat(nzr-mc-auto): T002 add shouldAutoActivateMissionControl predicate`.

### T003 — Contribution + workbench wire-up
- **Status:** pending
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/missionControlAutoActivate.contribution.ts`
  - modify: `src/vs/workbench/workbench.common.main.ts`
- **Acceptance:**
  - [ ] Defines `class MissionControlAutoActivateContribution implements IWorkbenchContribution`.
  - [ ] Constructor injects `IConfigurationService` and `IMissionControlService`; computes the predicate; calls `missionControlService.setActive(true)` inside a try/catch when the predicate returns true.
  - [ ] `Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(MissionControlAutoActivateContribution, LifecyclePhase.Restored)`.
  - [ ] `workbench.common.main.ts` imports `./contrib/nzr/browser/missionControlAutoActivate.contribution.js` next to the other NZR contributions.
  - [ ] `run_all.sh` exits 0.
  - [ ] Commit: `feat(nzr-mc-auto): T003 wire auto-activate contribution into workbench main`.

### T004 — Verify + push + PR
- **Status:** pending
- **Depends on:** T003
- **Files:**
  - create: `specs/0014-mission-control-auto-activate/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-auto-activate/run_all.sh` exit 0.
  - [ ] No regression in prior NZR smoke suites.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. The contribution depends on the predicate file.
