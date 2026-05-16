# Plan 0008 — Gate Queue Panel

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0008-gate-queue-panel`
**Generated:** 2026-05-16
**Language:** pt-BR

## Architecture sketch

```
contrib/nzr/browser/
  media/
    gateQueue.css                                # styles, mirrors NZR_TOKENS hex
  gateQueueItem.ts                               # pure: deriveGateItems(stations) → GateItem[]
                                                 #       summarizeGateReason(reason) → string
  gateCard.ts                                    # pure DOM builder
    └─ createGateCard(item, callbacks): { element, update, dispose }
  gateQueueView.ts                               # class GateQueueViewPane extends ViewPane
    ├─ renderBody(container): mount empty-state + list
    ├─ subscribe to registry events → re-render
    └─ Approve / Reject → IStationRegistryService.updateStationPipeline
  gateQueue.contribution.ts                      # ViewContainer (AuxiliaryBar) + View registration
    ├─ import './media/gateQueue.css'
    ├─ registerIcon(...)
    ├─ Registry.as(ViewContainersRegistry).registerViewContainer(...)
    └─ Registry.as(ViewsRegistry).registerViews([{ ctorDescriptor: GateQueueViewPane, ... }])

contrib/nzr/test/browser/
  gateQueueItem.test.ts                          # exhaustive derivation cases
  gateCard.test.ts                               # 5 kinds + Approve/Reject wiring

workbench.common.main.ts                         # add `import './contrib/nzr/browser/gateQueue.contribution.js';`
```

## Key design decisions

### DD-1: Pure `deriveGateItems` separate from rendering

```ts
interface GateItem {
  readonly stationId: string;
  readonly stationName: string;
  readonly kind: GateReason['kind'];
  readonly summary: string;
  readonly startedAt: number;
}
function deriveGateItems(stations: readonly Station[]): readonly GateItem[];
```

**Why:** Filtering + summary text generation is pure logic — fully
testable without DOM. The view layer just consumes the items.

### DD-2: Card builder accepts callbacks for Approve / Reject

```ts
interface GateCardCallbacks {
  onApprove: (stationId: string) => void;
  onReject:  (stationId: string) => void;
}
function createGateCard(item: GateItem, callbacks: GateCardCallbacks): GateCardHandle;
```

**Why:** Keeps the pure builder pure — no IStationRegistryService import.
The view pane is the only place that touches the service.

### DD-3: Re-render strategy on event

Same as 0007: full re-render of the list when any registry event fires.
Card count is small (typically < 10 active gates), so the DOM cost is
trivial.

### DD-4: Reject sets `stage='failed'` per cl-3

```ts
async function reject(stationId) {
  await stationRegistry.updateStationPipeline(stationId, {
    blocked: false,
    blockedReason: undefined,
    stage: 'failed',
  });
}
```

Approve just clears `blocked` + `blockedReason`. No stage auto-advance.

### DD-5: Localized summary table per gate kind

A typed mapper `summarizeGateReason(reason: GateReason): string` lives in
`gateQueueItem.ts` next to `deriveGateItems`. Each kind maps to a
`localize()` call.

## ADR-1: AuxiliaryBar vs Sidebar

**Decision:** Auxiliary Bar.
**Alternatives considered:**
- **Sidebar** (left): reserved by 0007 for Mission Control.
- **Panel** (bottom): used for terminal/output; bad fit for a sticky
  action queue.

The Auxiliary Bar gives the user the "decision queue" right next to the
editor, balanced against Mission Control on the left.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `src/vs/workbench/contrib/nzr/browser/gateQueueItem.ts` | create | pure derivation + summary |
| `src/vs/workbench/contrib/nzr/browser/gateCard.ts` | create | pure card DOM builder |
| `src/vs/workbench/contrib/nzr/browser/gateQueueView.ts` | create | `GateQueueViewPane extends ViewPane` |
| `src/vs/workbench/contrib/nzr/browser/gateQueue.contribution.ts` | create | ViewContainer + View registration |
| `src/vs/workbench/contrib/nzr/browser/media/gateQueue.css` | create | styles |
| `src/vs/workbench/contrib/nzr/test/browser/gateQueueItem.test.ts` | create | mocha tests |
| `src/vs/workbench/contrib/nzr/test/browser/gateCard.test.ts` | create | mocha tests |
| `src/vs/workbench/workbench.common.main.ts` | modify | add 1 import line |
| `test/nzrcode-gate-queue/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0008-gate-queue-panel/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md exists with explicit clarifications resolved.
- **II (Test-first):** T001 RED smoke → T002/T003 mocha GREEN before view code.
- **III (Simplicity):** no new deps; pure builders > MVC framework.
- **IV (Evidence):** Run-all output committed in T007.
- **V (Provider):** N/A — no provider switch.
- **VI (Privacy):** no new telemetry.
- **VII (Attribution):** N/A.
