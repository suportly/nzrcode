# Spec 0007 — Station View

**Branch:** `feature/0007-station-view`
**Base:** `feature/0006-mission-control-shell`
**Generated:** 2026-05-14
**Language:** pt-BR

---

## Goal

Render the first **DOM-bearing** Mission Control surface: a `ViewContainer` + `ViewPane` that paints the live station grid using `IMissionControlService.slots`, where each cell is a station card showing pipeline stage, claude output stream, and basic metrics.

This is the visual debut of NZRCode. Features 0001–0006 produced data layers; this feature is the first time a user sees something.

## In scope

1. Register a `ViewContainer` in the **Sidebar** with the NZR icon and label "Mission Control".
2. Register a single `ViewPane` (`StationViewPane`) inside that container.
3. The pane renders a **CSS Grid** of station cards using `computeGridLayout(slots.length)` cols/rows.
4. Each station card has:
   - **Head:** station name + stage badge (colored per `stage*` tokens from feature 0002).
   - **Body:** scrollable `<pre>` with claude streaming output (latest 200 chars or empty placeholder).
   - **Footer:** pipeline rail (7 dots = specify, clarify, plan, tasks, implement, review, done) + last metric.
5. Subscribe to `IMissionControlService.onDidChangeSlots` → re-layout grid (full re-render acceptable for ≤6 stations).
6. Subscribe to `IStationRegistryService.onStationChanged` (stage/metrics updates) → patch card head/footer in place.
7. Subscribe to `IClaudeCodeBridge.onSessionOutput` → append chunk to the matching card body (last-N tail).
8. Empty state: when `slots.length === 0`, render a centered "No stations yet" message with localize.
9. The toggle action from 0006 (`nzr.toggleMissionControl`) is **not re-wired here** — it stays a context-key toggle. Showing/hiding the view via the side bar uses the standard VS Code `viewContainer` toggle command auto-registered by the view registry.
10. **i18n:** all visible strings via `nls.localize`.
11. **a11y:** each card has `role="region"` + `aria-label` = station name + stage; pipeline rail has `aria-label` with stage progress; output `<pre>` has `aria-live="polite"`.

## Out of scope (deferred)

- Add-station palette / button (feature 0010).
- Pipeline detail view (feature 0009).
- Gate queue / approval panel (feature 0008).
- Welcome screen / first-run (feature 0011).
- Actual claude session lifecycle (start/stop from UI) — handled implicitly via 0005 bridge; UI only **renders** existing sessions.
- Drag-to-reorder, resize, full-screen toggle.
- Performance scaling above 6 simultaneous stations (overflowScroll from 0006 is honored but no virtualization).

## Non-goals

- **No React.** All DOM via `vs/base/browser/dom` `$` and `append` helpers.
- **No new NPM dependencies.**
- **No new telemetry events.**
- **No editor area changes** — Mission Control as editor surface is a future feature; this is a Sidebar view.

## Inputs / dependencies

- `IMissionControlService` (0006) — `slots: readonly MissionControlSlot[]`, `onDidChangeSlots`, `layout: GridLayout`.
- `IStationRegistryService` (0003) — `stations: readonly Station[]`, `onStationChanged`, `getStation(id)`.
- `IClaudeCodeBridge` (0005) — `onSessionOutput: Event<ClaudeOutputChunk>`, `getSession(id)`.
- NZR tokens (0002) — color CSS vars `--nzr-*` plus stage colors `--nzr-stage-*`.

## DOM contract

```
.nzr-station-grid                                  [grid-template-columns: repeat(cols, 1fr); rows similar]
  .nzr-station-card[data-station-id]               [role=region; aria-label=<name>]
    .nzr-station-card__head
      .nzr-station-card__title                     [station.name]
      .nzr-station-card__stage-badge.stage-<stage>
    .nzr-station-card__body
      <pre>.nzr-station-card__output              [aria-live=polite]
    .nzr-station-card__footer
      .nzr-station-card__rail                      [aria-label=Pipeline stage X of 7]
        .nzr-station-card__dot.stage-<stage>[.done|.active|.todo] × 7
      .nzr-station-card__metric

.nzr-station-empty                                 [shown when slots.length===0]
```

## Clarifications (resolved via brief-default judgment)

- **cl-1: Sidebar vs Auxiliary bar vs Editor surface for the ViewContainer?**
  Resolved: **Sidebar**. Auxiliary bar reserved for gate queue (0008). Editor surface is a bigger architecture move postponed.
- **cl-2: Output tail size cap?**
  Resolved: **last 200 chars** in card body. Full transcript stays in the bridge session entry, fetched lazily by future pipeline detail view (0009).
- **cl-3: Re-render strategy on slot change?**
  Resolved: **Full re-render** (acceptable up to 6 cards). Patch-in-place is reserved for `onStationChanged` (head/footer only).
- **cl-4: Where does CSS live?**
  Resolved: `src/vs/workbench/contrib/nzr/browser/media/stationView.css`, imported via `import './media/stationView.css';` in the contribution file.
- **cl-5: Default to expanded or collapsed on first run?**
  Resolved: **Visible/expanded** so the user sees something. View registry `canToggleVisibility: true`, no `hideByDefault`.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-station-view/run_all.sh` exit 0.
- [ ] `stationCard` pure builder unit-tested with 0/1/multi-station inputs + stage variants.
- [ ] `pipelineRail` pure builder unit-tested with all 9 `PipelineStage` values.
- [ ] `StationViewPane` registered against a `ViewContainer` in the Sidebar; structural tests confirm the contribution file shape.
- [ ] No new NPM deps in `package.json`.
- [ ] All visible strings under `localize()`.
- [ ] Compile structural check (`grep` of `import` paths) passes.

## Risks

- **R1:** Without `npm run compile && ./scripts/code.sh` in this session, we can deliver structurally-validated code but cannot confirm visual output. **Mitigation:** keep DOM minimal, pure builders maximally testable, follow exact VS Code import conventions verified via reference contribs.
- **R2:** First DOM feature is most likely to expose import-path drift. **Mitigation:** Explore agent verified ViewPane/ViewContainer signatures in this session; rely on those.
- **R3:** `aria-live="polite"` on a high-frequency stream could spam screen readers. **Mitigation:** debounce screen reader announcement to once per 2s via a separate `aria-live` region (skipped for v1; output region only, single update per chunk — log finding for 0009).
