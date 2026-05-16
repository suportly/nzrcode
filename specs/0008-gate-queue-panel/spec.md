# Spec 0008 — Gate Queue Panel

**Branch:** `feature/0008-gate-queue-panel`
**Base:** `main`
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Goal

Surface every station that is **blocked waiting on a human decision** in a
single Auxiliary Bar panel, with Approve / Reject buttons that resolve the
gate via `IStationRegistryService.updateStationPipeline`.

The data layer already exists (feature 0003 / `pipelineState.ts`):
`Station.pipeline.blocked` + `Station.pipeline.blockedReason: GateReason`
(5 kinds: `clarify`, `spec-approval`, `plan-approval`, `tasks-approval`,
`code-review`). This feature is the **UI surface** that lets the user act
on those gates without ever touching `workspace.json` by hand.

## In scope

1. Register a `ViewContainer` in the **AuxiliaryBar** (right side) titled
   "Gate Queue", with the NZR icon.
2. Register a single `ViewPane` (`GateQueueViewPane`) inside it.
3. The pane lists one card per station whose `pipeline.blocked === true`,
   sorted by `metrics.startedAt` ascending (oldest first).
4. Each card carries:
   - **Head:** station name + a kind badge (`clarify`/`spec-approval`/…).
   - **Body:** a short summary derived from `blockedReason` (e.g. the
     number of pending clarify markers, the spec path, the count of
     code-review findings).
   - **Footer:** `Approve` and `Reject` buttons.
5. Subscribe to `IStationRegistryService.onStationAdded`,
   `onStationRemoved`, and `onStationStageChanged` → re-render.
6. Approve / Reject persist via `updateStationPipeline`:
   - **Approve:** clear `blocked` + `blockedReason` only. The next
     pipeline action (driven elsewhere) reads `stage` and decides what
     happens next.
   - **Reject:** clear `blocked` + `blockedReason`, set `stage='failed'`.
7. Empty state ("No gates waiting on you") when no station is blocked.
8. All visible strings via `nls.localize`.
9. a11y: each card has `role="region"` + `aria-label`; buttons have
   accessible labels including the station name and gate kind.

## Out of scope (deferred)

- Inline clarify-question UI (answer the [NEEDS CLARIFICATION] markers
  inside the panel). Today the user opens `spec.md` and edits markers
  there; the gate only tracks the *fact* that markers exist.
- Code-review finding diff inline. Today the panel surfaces the count;
  user opens the linked PR URL externally.
- Bulk approve / reject. One card at a time.
- Sticky / collapsible gate categories.

## Non-goals

- **No React.** Pure DOM via `vs/base/browser/dom`.
- **No new NPM dependencies.**
- **No new telemetry.**

## Inputs / dependencies

- `IStationRegistryService` (0003) — `stations`, `getStation`,
  `onStationAdded`/`onStationRemoved`/`onStationStageChanged`,
  `updateStationPipeline(id, patch)`.
- `pipelineState.ts` types — `Station`, `GateReason`, `PipelineStage`.
- NZR tokens (0002) — colors mirrored from `NZR_TOKENS` (already used in
  0007's CSS).

## DOM contract

```
.nzr-gate-queue-body
  .nzr-gate-queue-empty                            [shown when no blocked stations]
  .nzr-gate-card[data-station-id]                  [role=region; aria-label=…]
    .nzr-gate-card__head
      .nzr-gate-card__title                        [station.repoName]
      .nzr-gate-card__kind-badge.kind-<kind>       [clarify / spec-approval / …]
    .nzr-gate-card__body
      .nzr-gate-card__summary                      [derived from blockedReason]
    .nzr-gate-card__footer
      <button>.nzr-gate-card__btn.btn-approve      [aria-label]
      <button>.nzr-gate-card__btn.btn-reject       [aria-label]
```

## Clarifications (resolved via brief-default judgment)

- **cl-1: AuxiliaryBar vs Sidebar?**
  Resolved: **AuxiliaryBar**. The Sidebar is reserved for Mission Control
  (0006/0007). Auxiliary bar is the brief's spot for "approve / review"
  surfaces — same side many users keep Outline / Comments on.
- **cl-2: Sort order?**
  Resolved: **oldest blocked first** (`metrics.startedAt` ascending).
  Users want to clear the longest-waiting gate first.
- **cl-3: Reject behaviour — what stage?**
  Resolved: **`stage='failed'`**. The user must consciously re-trigger
  the next step from a known-bad state, not silently fall back to spec.
- **cl-4: Approve behaviour — auto-advance?**
  Resolved: **no auto-advance**. Approve clears `blocked` + reason; the
  stage stays where it is. The next pipeline action (Spec command,
  Plan command, etc.) is the responsibility of features 0009+.
- **cl-5: Summary content for code-review with no findings list?**
  Resolved: when `findings.length === 0`, show "{N} code review issues"
  with `N = 0`; user is still expected to approve / reject the PR
  manually.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-gate-queue/run_all.sh` exit 0.
- [ ] `deriveGateItems` pure function unit-tested with all 5 kinds + the
      "no blocked station" empty case.
- [ ] `gateCard` pure builder unit-tested with all 5 kinds, structure
      and Approve / Reject button wiring.
- [ ] `GateQueueViewPane` registered against a `ViewContainer` in the
      AuxiliaryBar; structural smoke confirms the contribution shape.
- [ ] No new NPM deps in `package.json`.
- [ ] All visible strings under `localize()`.

## Risks

- **R1:** Without a dev build, the visual rendering is not validated.
  **Mitigation:** mirror the 0007 patterns (already shipped to main),
  keep CSS hex literals consistent with `NZR_TOKENS`.
- **R2:** AuxiliaryBar is less familiar than the Sidebar; some users may
  not notice the new view. **Mitigation:** a future feature can add a
  status-bar badge with the blocked count; out of scope for v1.
