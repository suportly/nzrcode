# Plan 0007 — Station View

**Spec:** [spec.md](./spec.md)
**Branch:** `feature/0007-station-view`
**Generated:** 2026-05-14
**Language:** pt-BR

## Architecture sketch

```
contrib/nzr/browser/
  media/
    stationView.css                            # styles, uses --nzr-* vars from theme 0002
  stationCard.ts                               # pure DOM builder (no DI, no events)
    └─ renderStationCard(container, station, output): { update(station, output) }
  pipelineRail.ts                              # pure DOM builder (no DI)
    └─ renderPipelineRail(container, stage): { update(stage) }
  stationView.ts                               # class StationViewPane extends ViewPane
    ├─ renderBody(container): mount empty grid div
    ├─ layoutBody(h, w): no-op (CSS Grid handles)
    ├─ subscribe to MC service / Registry / Bridge
    └─ on each event: rebuild or patch cards (delegating to builders)
  stationView.contribution.ts                  # ViewContainer + View registration
    ├─ import './media/stationView.css'
    ├─ registerIcon(...)
    ├─ Registry.as(ViewContainersRegistry).registerViewContainer(...)
    └─ Registry.as(ViewsRegistry).registerViews([{ ctorDescriptor: StationViewPane, ... }])

services/nzr/test/common/
  stationCard.test.ts                          # exhaustive DOM-structure assertions via jsdom-free DOM (HTMLElement is global in mocha)
  pipelineRail.test.ts                         # 9 stage variants

workbench.common.main.ts                       # add `import './contrib/nzr/browser/stationView.contribution.js';`
```

## Key design decisions

### DD-1: Pure builders return an `update` API instead of a re-render function

```ts
interface StationCardHandle {
  readonly element: HTMLElement;
  update(station: Station, output: string): void;
  dispose(): void;
}
function createStationCard(station: Station, output: string): StationCardHandle;
```

**Why:** Lets the pane patch head/footer without re-creating DOM on every `onStationChanged`, but still allows full destruction when slot count changes. Mirrors VS Code's `IDisposable` pattern.

### DD-2: One CSS file imported via static import

Following VS Code convention: `import './media/stationView.css';` in the contribution file. The TS→JS build wires this through the css loader. No new dependency.

### DD-3: Output tail truncation in pure builder, not in service

`renderStationCard` slices to last 200 chars internally so the service stays a thin streamer. Avoids cross-feature coupling — feature 0005 doesn't know about UI concerns.

### DD-4: a11y string composition

```ts
localize('nzrCardAriaLabel', 'Station {0}, stage {1}', station.name, stageLabel(station.stage))
```

Pre-compute `stageLabel(stage)` from a typed mapper kept in `pipelineRail.ts` so the table of localized stage names lives next to the dot renderer.

### DD-5: No ViewPane custom keybinding

The view registry auto-generates a "Show Station Grid" toggle command (`workbench.view.nzr.stations.focus`). We don't add a custom keybinding in this feature; feature 0010 (add-station palette) may add `⌘⇧S` later.

## ADR-1: Sidebar vs Editor

**Decision:** Sidebar `ViewContainer`.
**Alternatives considered:**
- **Editor area** (matches brief's "Mission Control empilha sobre EditorPart"): too big a move for first DOM PR; editor surface composition needs its own feature.
- **Auxiliary bar** (right side): reserved for gate queue (0008) per brief §6.8.

**Status:** Will revisit when feature 0009/0010 land. Track as `decision-0007-1.md` if challenged.

## Compile-and-test strategy

- **Unit-level (mocha):** `stationCard.test.ts` + `pipelineRail.test.ts` run pure DOM in JSDOM-free environment (VS Code tests have a DOM via electron / common test runner).
- **Structural (smoke):** shell tests grep for required exports, file existence, registration calls, no-new-deps, i18n usage.
- **Visual (dev build):** **DEFERRED** — flagged in spec R1. Requires `npm install && npm run compile && ./scripts/code.sh`. User to validate after pulling PR.

## File inventory

| Path | Action | Purpose |
|---|---|---|
| `src/vs/workbench/contrib/nzr/browser/stationCard.ts` | create | pure card DOM builder |
| `src/vs/workbench/contrib/nzr/browser/pipelineRail.ts` | create | pure rail builder + stage label table |
| `src/vs/workbench/contrib/nzr/browser/stationView.ts` | create | `StationViewPane extends ViewPane` |
| `src/vs/workbench/contrib/nzr/browser/stationView.contribution.ts` | create | ViewContainer + View registration |
| `src/vs/workbench/contrib/nzr/browser/media/stationView.css` | create | grid + card styles |
| `src/vs/workbench/services/nzr/test/common/stationCard.test.ts` | create | mocha tests |
| `src/vs/workbench/services/nzr/test/common/pipelineRail.test.ts` | create | mocha tests |
| `src/vs/workbench/workbench.common.main.ts` | modify | add 1 import line |
| `test/nzrcode-station-view/{test_*,run_all}.sh` | create | smoke suite |
| `specs/0007-station-view/{spec,plan,tasks}.md` | create | this doc + companions |

## Constitution check

- **I (Spec-first):** spec.md exists with explicit clarifications resolved + risks.
- **II (Test-first):** T001 smoke RED → T002/T003 mocha + smoke GREEN before T004 view code.
- **III (Simplicity):** No new deps; pure builders > MVC framework.
- **IV (Evidence):** Run-all output committed in T007.
- **V (Provider):** No provider switch.
- **VI (Privacy):** No new telemetry.
- **VII (Attribution):** N/A — code is original to NZRCode.
