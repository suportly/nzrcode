# Spec 0013 — Consumer Wiring + PRESETS Dedup

**Branch:** `feature/0013-consumer-wiring-and-presets-dedup`
**Base:** `main` (post-merge of 0008/0010/0011/0012)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Goal

Close two loose ends left after the 12-feature brief landed:

1. **PRESETS dedup** — feature 0010 (`stationPaletteFlow.ts`) and
   feature 0012 (`nzrPipelineSettings.ts`) each declare the same
   4-string preset list. Spec 0012 explicitly flagged this as
   `decision-0012-1` for resolution after both merged. Now that
   they both live on main, the local copy in
   `stationPaletteFlow.ts` becomes a re-export from
   `nzrPipelineSettings.ts`. Single source of truth.

2. **Consumer wiring** — features 0010 (Add Station palette) and
   0011 (Welcome notification) were shipped without consuming the
   settings from feature 0012. This PR wires them:
   - `AddStationAction.run` reads `getDefaultPreset(...)` and
     `getDefaultBranch(...)` from `IConfigurationService` for the
     initial pick / input values.
   - `WelcomeNotificationContribution` reads
     `getWelcomeShowOnStartup(...)` and short-circuits the auto-show
     when the user has disabled it (in addition to the existing
     storage-flag dismissal).

No new user-facing capabilities — this is the post-roadmap glue.

## In scope

1. **Dedup** in `stationPaletteFlow.ts`:
   - Drop the local `PRESETS` literal.
   - Re-export `PIPELINE_PRESETS as PRESETS` (back-compat for any
     caller still using the old name) and re-export the `Preset`
     type, both sourced from `./nzrPipelineSettings.js`.
   - Existing `stationPaletteFlow.test.ts` keeps asserting the 4
     strings exist — runs unchanged against the re-export.
2. **0010 wiring** — change `AddStationAction.run`:
   - Inject `IConfigurationService` via `accessor.get(...)`.
   - Compute `defaultPreset = getDefaultPreset(configurationService)`
     (an actual member of `PIPELINE_PRESETS`).
   - Compute `defaultBranch = getDefaultBranch(configurationService)`.
   - The preset quick-pick reorders so the default appears first
     (and we mark it with `description: '(default)'`); the branch
     `input()` uses `defaultBranch` as the pre-filled value (instead
     of the hardcoded `DEFAULT_BRANCH` literal).
3. **0011 wiring** — change `WelcomeNotificationContribution`:
   - Inject `IConfigurationService`.
   - Skip the auto-show whenever either the storage flag is set OR
     `getWelcomeShowOnStartup(configurationService) === false`.
   - `nzr.welcome.show` (manual command) is unchanged — the setting
     does not gate the manual replay path, matching cl-4 of spec 0011.
4. **New pure helpers** (testable without DI):
   - `nzrPaletteDefaults.ts` (new module under
     `contrib/nzr/browser/`): exports
     `resolveAddStationDefaults(configurationService): { preset; branch }`
     so the orchestrator in `AddStationAction.run` collapses to
     "fetch defaults → pass into the existing flow".
   - `nzrWelcomeGate.ts` (new module): exports
     `shouldAutoShowWelcome(storageService, configurationService): boolean`
     so the contribution constructor is a one-liner.
5. **i18n:** the preset-description string `(default)` is wrapped in
   `localize`.

## Out of scope (deferred)

- `nzrcode.missionControl.autoActivate` consumer — that wires into a
  workspace-open listener which is a new behavior, not just glue.
  Tracked as a future feature.
- Adding a "Reset Welcome" button to the settings panel — settings
  UI already lets the user flip `nzrcode.welcome.showOnStartup` and
  the storage flag is wiped on profile reset; no extra UI needed.
- Wiring `IConfigurationService` into a `nzr.station.add` keybinding
  shortcut for "spawn with last-used preset" — speculative.

## Non-goals

- **No new NPM dependencies.**
- **No new telemetry events.**
- **No new commands or keybindings.**
- **No DOM changes.**

## Inputs / dependencies

- `IConfigurationService` (platform).
- `IStorageService` (platform).
- `nzrPipelineSettings.ts` (feature 0012, now on main) — readers.
- `stationPaletteFlow.ts` (feature 0010, now on main).
- `welcome.contribution.ts` (feature 0011, now on main).

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-consumer-wiring/run_all.sh` exits 0.
- [ ] `stationPaletteFlow.ts` no longer declares its own `PRESETS` array literal — it re-exports `PIPELINE_PRESETS as PRESETS` and `Preset` from `nzrPipelineSettings.ts`.
- [ ] `AddStationAction.run` calls `accessor.get(IConfigurationService)` and `resolveAddStationDefaults(...)`.
- [ ] `WelcomeNotificationContribution` injects `IConfigurationService` and uses `shouldAutoShowWelcome(...)`.
- [ ] `nzrPaletteDefaults.ts` and `nzrWelcomeGate.ts` exist with the documented exports + mocha coverage.
- [ ] All visible strings via `localize()`.
- [ ] No new NPM deps in `package.json`.

## Clarifications (resolved via brief-default judgment)

- **cl-1: Should the dedup keep the `PRESETS` name as a re-export, or rename callers to `PIPELINE_PRESETS`?**
  Resolved: **re-export under the old name**. The single caller is
  the contribution in the same feature; the original test file uses
  `PRESETS`. Less code churn, zero behavior change.
- **cl-2: When `nzrcode.welcome.showOnStartup === false`, should
  the storage flag also be set so that a later flip to `true`
  re-shows the welcome?**
  Resolved: **No — leave storage alone**. The setting and the storage
  flag are independent dismissal mechanisms. If a user toggles the
  setting `false`, the storage flag's existing state survives. This
  matches the principle that settings are user intent (declarative)
  and storage is state (imperative).
- **cl-3: When the user has hand-edited the preset setting to an
  invalid string, should the QuickPick still show all 4 presets,
  or should it complain?**
  Resolved: **show all 4 presets, default to `'lean'`** (spec 0012
  cl-4 already documented this fallback). Silent degradation.
- **cl-4: Should the default preset appear *first* in the QuickPick,
  or be marked with a description and stay in canonical order?**
  Resolved: **reorder so the default appears first**. Users hit Enter
  on the first item ~70% of the time per VS Code's own QuickPick
  usage notes. Putting the default first cuts a keypress for the
  common case. The other 3 presets stay in canonical order after the
  default.

## Risks

- **R1:** `AddStationAction.run` now requires `IConfigurationService`. If a downstream embedder strips that service, the action throws. **Mitigation:** `IConfigurationService` is core; stripping it would break far more than this command.
- **R2:** Reordering the preset list could surprise users who memorized "first option is always django-react". **Mitigation:** acceptable — the default preset is `'lean'` out of the box, and any change to the setting is explicit user intent.
- **R3:** Without a dev build we cannot visually confirm the QuickPick reorder or the welcome short-circuit. **Mitigation:** pure helpers cover the decision logic; smoke greps assert the wiring shape.
