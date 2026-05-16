# Spec 0012 — Settings Pipeline Section

**Branch:** `feature/0012-settings-pipeline-section`
**Base:** `main` (post-merge of 0007/0009; sibling of 0008/0010/0011 PRs)
**Generated:** 2026-05-15
**Language:** pt-BR

---

## Goal

Surface a dedicated **NZRCode › Pipeline** settings section in the
VS Code Settings UI so users can pick their default preset, default
branch, and welcome behavior without editing JSON by hand. This is the
final brief item (§6.12) and the first feature where end-users edit
NZRCode state through the standard settings panel.

The PR ships:

1. JSON-schema registration of 4 user-facing settings under the
   `nzrcode.*` namespace, with localized titles + descriptions.
2. Typed pure readers (`getDefaultPreset`, `getDefaultBranch`,
   `getWelcomeShowOnStartup`, `getMissionControlAutoActivate`) over
   `IConfigurationService` so downstream features can consume the
   settings without parsing keys.

Wiring the *consumers* (feature 0010's `nzr.station.add` flow,
feature 0011's welcome contribution, feature 0006's mission-control
auto-activation) is **out of scope** for this PR — it stays additive
to keep stacks atomic. Each consumer can adopt the reader in a
follow-up.

## In scope

1. **Configuration registration** via `Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({ ... })` with:
   - `id: 'nzrcode'`
   - `order` after the existing built-in NZR configuration order (we
     pick `200`; this only affects search ordering).
   - `title: 'NZRCode'`
   - `type: 'object'`
   - `properties`:
     - **`nzrcode.pipeline.defaultPreset`** — `string` enum of
       `['django-react', 'expo-mobile', 'python-cli', 'lean']`, default
       `'lean'`, scope `APPLICATION`, with `enumDescriptions` for each
       preset.
     - **`nzrcode.pipeline.defaultBranch`** — `string`, default
       `'main'`, scope `APPLICATION`.
     - **`nzrcode.welcome.showOnStartup`** — `boolean`, default `true`,
       scope `APPLICATION`.
     - **`nzrcode.missionControl.autoActivate`** — `boolean`, default
       `false`, scope `APPLICATION`. Reserved for a future feature that
       triggers `nzr.toggleMissionControl` on workspace restore; we
       only register the setting now.
2. **Typed readers** in `nzrPipelineSettings.ts`:
   - `SETTING_DEFAULT_PRESET = 'nzrcode.pipeline.defaultPreset'` etc.
   - `getDefaultPreset(configurationService): Preset`
   - `getDefaultBranch(configurationService): string`
   - `getWelcomeShowOnStartup(configurationService): boolean`
   - `getMissionControlAutoActivate(configurationService): boolean`
   - `isValidPreset(value: unknown): value is Preset` — used by
     `getDefaultPreset` to fall back to the default when a user has
     somehow set an invalid value.
3. **i18n:** every visible string (title, description, enum
   descriptions) via `nls.localize`.

## Out of scope (deferred)

- Wiring readers into 0010's `AddStationAction.run` to default the
  preset / branch picks (additive follow-up).
- Wiring `nzrcode.welcome.showOnStartup` into 0011's contribution to
  short-circuit before checking the storage flag (additive follow-up).
- Wiring `nzrcode.missionControl.autoActivate` into a workspace-open
  listener — would require a new contribution; the **setting** lands
  here but the **behavior** is a future feature.
- A Settings *UI* sub-panel inside the Mission Control surface — VS
  Code's standard Settings editor is the entry point.
- Per-workspace overrides — every setting uses scope `APPLICATION`
  so values are profile-level and don't depend on the open folder.
- Per-station overrides (a future "Station Settings" view).

## Non-goals

- **No new NPM dependencies.**
- **No new telemetry events.** Read-only settings.
- **No filesystem side-effects beyond the standard settings store**
  (handled by `IConfigurationService`).
- **No React.** No DOM at all — schema registration only.

## Inputs / dependencies

- `IConfigurationRegistry` (platform) — `registerConfiguration`.
- `IConfigurationService` (platform) — `getValue<T>(key)` for the
  pure readers.
- 0010's `Preset` type (`PRESETS`) — re-exported from
  `stationPaletteFlow.ts` for enum + default validation. **Note:**
  0010 is in PR #10 (open, not merged to main). To keep this PR
  independent we **redefine** the same 4-string list locally in
  `nzrPipelineSettings.ts` rather than import across an unmerged
  branch. Track convergence as `decision-0012-1.md` once both PRs
  land.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-settings/run_all.sh` exits 0.
- [ ] `nzrPipelineSettings.ts` exports the 4 setting keys, default
      values, and 4 typed readers; unit-tested independent of VS Code
      DI.
- [ ] Contribution registers the configuration node with exactly 4
      properties under the `nzrcode.*` namespace.
- [ ] Every visible string via `localize()`.
- [ ] No new NPM deps in `package.json`.

## Clarifications (resolved via brief-default judgment)

- **cl-1: Configuration namespace — `nzrcode.*` or `nzr.*`?**
  Resolved: **`nzrcode.*`**. The brand is "NZRCode" (one word, one
  config namespace). The `nzr.*` prefix is reserved for the
  **command** namespace (commands stay short to be palette-friendly).
  Mirroring the dichotomy: commands `nzr.station.add`, settings
  `nzrcode.pipeline.defaultPreset`.
- **cl-2: Where do these readers live — `platform/nzr/common` or
  `workbench/contrib/nzr/browser`?**
  Resolved: **`workbench/contrib/nzr/browser/nzrPipelineSettings.ts`**.
  Settings registration is a workbench contribution (requires
  `IConfigurationRegistry`), and the readers are tightly coupled to
  the setting keys defined in the same module. Cross-feature reuse
  inside `platform/` is overkill for v1.
- **cl-3: Scope — `APPLICATION` vs `RESOURCE`?**
  Resolved: **`APPLICATION`**. Stations span folders; preset/branch
  are user-level preferences. A future feature could promote
  `nzrcode.pipeline.defaultPreset` to `RESOURCE`-scoped if per-repo
  presets become useful (track as `decision-0012-2.md`).
- **cl-4: What does the reader do when the user has hand-edited
  `settings.json` with an invalid preset string?**
  Resolved: **fall back to the default (`'lean'`)** via the
  `isValidPreset` type guard. We do not raise an error or notify; an
  invalid setting silently degrades.
- **cl-5: Should we deprecate the storage-flag pattern in 0011's
  welcome contribution in this PR?**
  Resolved: **No** — out of scope. The setting is *registered* now;
  0011's contribution still reads its own storage flag. A follow-up
  PR will switch the consumer.

## Risks

- **R1:** Without `npm run compile && ./scripts/code.sh` we cannot
  visually confirm the settings appear in the UI. **Mitigation:**
  structural smoke + unit tests assert the schema shape; the
  Settings UI auto-generates the panel from the schema.
- **R2:** The redefined preset list in `nzrPipelineSettings.ts`
  must stay in sync with 0010's `PRESETS`. **Mitigation:** track the
  dedup follow-up as `decision-0012-1.md`. A future PR (after 0010
  and 0012 both merge) replaces the local list with an import from
  `stationPaletteFlow.ts`. For this PR the list is duplicated
  verbatim — the strings are short and the divergence cost is low.
- **R3:** Setting scope `APPLICATION` means workspace settings.json
  entries are ignored. If a downstream user reports this surprise,
  reconsider `cl-3`.
