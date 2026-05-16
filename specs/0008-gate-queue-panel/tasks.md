# Tasks 0008 — Gate Queue Panel

**Branch:** `feature/0008-gate-queue-panel`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Task list

### T001 — Smoke + mocha stubs (RED)
- **Status:** pending
- **Files:**
  - create: `test/nzrcode-gate-queue/{test_files_exist,test_view_registered,test_no_new_deps,test_i18n_strings,run_all}.sh`
  - create: `test/nzrcode-gate-queue/README.md`
  - create: `src/vs/workbench/contrib/nzr/test/browser/gateQueueItem.test.ts` (stub)
  - create: `src/vs/workbench/contrib/nzr/test/browser/gateCard.test.ts` (stub)
- **Acceptance:**
  - [ ] All required source files referenced + 2 test stubs.
  - [ ] `test_view_registered.sh` greps `registerViewContainer`, `registerViews`, `workbench.view.nzr.gateQueue`, `ViewContainerLocation.AuxiliaryBar`.
  - [ ] `test_no_new_deps.sh` passes (no root package.json drift).
  - [ ] `test_i18n_strings.sh` confirms localize() usage in contribution + view.
  - [ ] `run_all.sh` exits 1 initially.
  - [ ] Commit: `test(nzr-gq): T001 add Gate Queue smoke suite + mocha stubs (RED)`.

### T002 — `gateQueueItem.ts` (pure derive + summary) + tests
- **Status:** pending
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/gateQueueItem.ts`
  - modify: `src/vs/workbench/contrib/nzr/test/browser/gateQueueItem.test.ts`
- **Acceptance:**
  - [ ] Exports `interface GateItem { stationId, stationName, kind, summary, startedAt }`.
  - [ ] Exports `function deriveGateItems(stations): readonly GateItem[]`.
  - [ ] Filters in only stations with `pipeline.blocked === true` AND `pipeline.blockedReason` defined.
  - [ ] Sorts ascending by `metrics.startedAt`.
  - [ ] Exports `function summarizeGateReason(reason): string` covering all 5 GateReason kinds.
  - [ ] Mocha covers: empty stations, no-blocked stations, single gate of each kind, multi-gate sort order.
  - [ ] Commit: `feat(nzr-gq): T002 add gateQueueItem derivation and summary`.

### T003 — `gateCard.ts` (pure DOM builder) + tests
- **Status:** pending
- **Depends on:** T002
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/gateCard.ts`
  - modify: `src/vs/workbench/contrib/nzr/test/browser/gateCard.test.ts`
- **Acceptance:**
  - [ ] Exports `interface GateCardHandle { element, update, dispose }`.
  - [ ] Exports `interface GateCardCallbacks { onApprove, onReject }`.
  - [ ] Exports `function createGateCard(item, callbacks): GateCardHandle`.
  - [ ] DOM structure: `.nzr-gate-card` > head (title + kind-badge) + body (summary) + footer (2 buttons).
  - [ ] Buttons fire callbacks with `item.stationId`; click events also stop propagation so the host can't double-handle.
  - [ ] `update(item)` mutates head + body without recreating the root node.
  - [ ] Mocha covers: structure, each kind-badge class, both callbacks fire, update mutates without recreation.
  - [ ] Commit: `feat(nzr-gq): T003 add gateCard pure DOM builder`.

### T004 — `GateQueueViewPane` class
- **Status:** pending
- **Depends on:** T003
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/gateQueueView.ts`
- **Acceptance:**
  - [ ] `class GateQueueViewPane extends ViewPane`.
  - [ ] Injects `IStationRegistryService` plus the base services ViewPane needs.
  - [ ] `renderBody(container)`: builds the empty-state + the list container, then renders.
  - [ ] `_render()`: clears the list, derives items, mounts one `createGateCard` per item, attaches `onApprove`/`onReject` callbacks that call `updateStationPipeline`.
  - [ ] Subscribes to `onStationAdded`/`onStationRemoved`/`onStationStageChanged` → `_render()`.
  - [ ] `dispose()` propagates to every live card.
  - [ ] Commit: `feat(nzr-gq): T004 implement GateQueueViewPane with approve/reject wiring`.

### T005 — ViewContainer + View registration + CSS
- **Status:** pending
- **Depends on:** T004
- **Files:**
  - create: `src/vs/workbench/contrib/nzr/browser/gateQueue.contribution.ts`
  - create: `src/vs/workbench/contrib/nzr/browser/media/gateQueue.css`
- **Acceptance:**
  - [ ] CSS defines `.nzr-gate-queue-body`, `.nzr-gate-queue-empty`, `.nzr-gate-card` + head/body/footer + kind-* badge variants + `.btn-approve`/`.btn-reject`.
  - [ ] Contribution imports CSS via `import './media/gateQueue.css';`.
  - [ ] `registerIcon('nzr-gate-queue-view-icon', Codicon.checklist, ...)`.
  - [ ] `registerViewContainer({ id: 'workbench.view.nzr.gateQueue', ... }, ViewContainerLocation.AuxiliaryBar)`.
  - [ ] `registerViews([{ id: 'workbench.view.nzr.gateQueue.list', ctorDescriptor: SyncDescriptor(GateQueueViewPane) }], CONTAINER)`.
  - [ ] `test_view_registered.sh` GREEN.
  - [ ] Commit: `feat(nzr-gq): T005 register Gate Queue ViewContainer in Auxiliary Bar`.

### T006 — Wire workbench main
- **Status:** pending
- **Depends on:** T005
- **Files:**
  - modify: `src/vs/workbench/workbench.common.main.ts`
- **Acceptance:**
  - [ ] Adds `import './contrib/nzr/browser/gateQueue.contribution.js';` near the other NZR contributions.
  - [ ] `run_all.sh` exits 0.
  - [ ] Commit: `feat(nzr-gq): T006 register gateQueue contribution in workbench main`.

### T007 — Verify + push + PR
- **Status:** pending
- **Depends on:** T006
- **Files:**
  - create: `specs/0008-gate-queue-panel/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-gate-queue/run_all.sh` exit 0.
  - [ ] No regression in prior smoke suites.
  - [ ] tasks.md pending → done.
  - [ ] push + open PR targeting `main`.

## Parallelization hints

Serial. T002/T003 conceptually parallel but share types; serial is safer.
