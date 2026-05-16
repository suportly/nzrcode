# Spec 0010 — Add Station Palette

**Branch:** `feature/0010-add-station-palette`
**Base:** `main` (post-merge of 0007/0009; stacked alongside 0008 PR #9)
**Generated:** 2026-05-15
**Language:** pt-BR

---

## Goal

Ship the command-palette surface that lets a user manage stations without
touching the Mission Control side bar by hand: a triplet of commands
("Add Station", "Switch Station", "Close Station") wired through
`IStationRegistryService` and surfaced under the **NZR** category in the
F1 palette, with one default keybinding (`⌘⇧S`) to open "Add Station".

Features 0003-0008 produced the data layer + the visual surfaces; this
feature is the first time the user can spawn / select / dismiss stations
through keyboard alone.

## In scope

1. **`nzr.station.add`** — opens a 3-step `IQuickInputService` flow:
   1. Pick `preset` from a hard-coded list of 4 presets (`django-react`,
      `expo-mobile`, `python-cli`, `lean`).
   2. `input()` for `branch` (default: `main`).
   3. `input()` for `repoPath` (default: the first workspace folder's
      fs path, or empty if no workspace is open; validated as
      non-empty).
   After all 3 inputs resolve, call
   `IStationRegistryService.addStation({ repoPath, branch, preset })`.
   On success, surface a notification "Station <repoName> added.".
2. **`nzr.station.switch`** — opens a QuickPick over
   `IStationRegistryService.stations`, each item showing
   `repoName • branch • stage`. On accept, executes the standard
   `workbench.view.nzr.missionControl.focus` command (revealing the
   Mission Control side bar where the cards live).
3. **`nzr.station.close`** — opens a QuickPick (same item shape as
   `switch`). On accept, prompts confirmation via
   `INotificationService.prompt` ("Close station <repoName>?"). On
   confirm, calls `IStationRegistryService.removeStation(id)`.
4. **One keybinding:** `⌘⇧S` / `Ctrl+Shift+S` bound to `nzr.station.add`
   when `nzr.missionControl.active` is true. No other keybindings — we
   stay deliberate so we do not collide with VS Code's "Save All" on
   non-MC sessions.
5. **i18n:** all titles, prompts, placeholders, notification messages
   under `nls.localize` / `localize2`.
6. All three commands surface as `f1: true` under
   `category: 'NZR'`. (Same category string used by 0006's toggle.)

## Out of scope (deferred)

- Welcome screen / first-run (feature 0011).
- Settings panel for default preset / default branch (feature 0012).
- Reveal/focus a *specific* station card by id in the view (waits on
  feature 0007's view exposing a `revealStation(id)` method — out of
  scope here; switch only focuses the container).
- Cross-folder workspace edge cases — we read `folders[0]` and call it
  a day (matches existing spec 0003 cl-5 simplification).
- Drag-to-reorder / rename station — not on the brief roadmap.
- Toolbar buttons inside the Stations view (would belong in feature
  0007's contribution, not the palette).

## Non-goals

- **No React.** All inputs go through `IQuickInputService`.
- **No new NPM dependencies.**
- **No new telemetry events.**
- **No filesystem side-effects beyond what `addStation` already does**
  (which persists to `<workspace>/.nzrcode/workspace.json` via
  feature 0003's service).

## Inputs / dependencies

- `IStationRegistryService` (0003) — `stations`, `addStation`,
  `removeStation`, `getStation`.
- `IQuickInputService` (platform) — `pick`, `input`.
- `INotificationService` (platform) — `info`, `prompt`.
- `IWorkspaceContextService` (platform) — to default `repoPath` to
  `getWorkspace().folders[0].uri.fsPath`.
- `ICommandService` (platform) — to dispatch
  `workbench.view.nzr.missionControl.focus` from `switch`.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-station-palette/run_all.sh` exits 0.
- [ ] `stationPaletteFlow.ts` exposes pure helpers
      (`buildAddStationInput`, `buildStationQuickPickItems`,
      `humanizeStage`) that are unit-tested independent of VS Code DI.
- [ ] All 3 commands are registered via `Action2` with category `NZR`,
      `f1: true`, and stable command ids
      `nzr.station.add`, `nzr.station.switch`, `nzr.station.close`.
- [ ] `nzr.station.add` keybinding `⌘⇧S` (mac) / `Ctrl+Shift+S` (win/linux)
      gated by `nzr.missionControl.active`.
- [ ] All visible strings via `localize()` / `localize2()`.
- [ ] No new NPM deps in `package.json`.

## Clarifications (resolved via brief-default judgment)

- **cl-1: Should "Add Station" auto-open a folder picker for repoPath
  instead of a free-text input?**
  Resolved: **free-text input with workspace-folder default**. A
  folder picker would require platform-side `IFileDialogService`
  branching for browser-deployed VS Code, which we don't want to
  complicate this PR with. Free-text input + workspace default covers
  the 99% case (current workspace) and falls back gracefully when no
  folder is open.
- **cl-2: Preset list — hard-coded or pulled from a future config?**
  Resolved: **hard-coded array of 4 names**. The brief never specifies
  preset discovery; matching feature 0003's accepted shape (string).
  Settings-driven discovery is feature 0012 territory.
- **cl-3: Confirmation prompt on "Close Station"?**
  Resolved: **Yes**, via `INotificationService.prompt` with
  `Sev.Warning` and a single `Close` choice (cancel by dismissing).
  Mirrors VS Code's "Delete File?" UX.
- **cl-4: Should the keybinding be active everywhere or gated?**
  Resolved: **gated by `nzr.missionControl.active`**. Without the
  gate we steal `⌘⇧S` = "Save All" globally, which would be a
  regression on non-MC sessions.
- **cl-5: What does "Switch Station" do when there are zero stations?**
  Resolved: show an empty QuickPick with `placeHolder` =
  "No stations yet. Use NZR: Add Station first." — accepting nothing
  is a no-op.

## Risks

- **R1:** Without `npm run compile && ./scripts/code.sh` in this
  session, we can deliver structurally-validated commands but cannot
  confirm the palette flow visually. **Mitigation:** unit-test pure
  helpers exhaustively; smoke-test the contribution + keybinding shape
  via grep.
- **R2:** `addStation` happens **synchronously** in the registry but
  returns a Promise (writes to disk via 0003). If two rapid "Add
  Station" invocations race, the second may write atop a stale snapshot.
  **Mitigation:** acceptable for v1 — single human user clicking palette
  twice is improbable. Track as decision-0010-1 if it bites.
- **R3:** Workspace folder may be `undefined` (empty workspace). The
  free-text default will then be `''`; we validate non-empty inside
  `input()` via `validateInput` callback.
