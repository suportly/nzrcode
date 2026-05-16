# Spec 0014 — Mission Control Auto-Activate Consumer

**Branch:** `feature/0014-mission-control-auto-activate`
**Base:** `main` (post-merge of features 0001-0013)
**Generated:** 2026-05-16
**Language:** pt-BR

---

## Goal

Wire the `nzrcode.missionControl.autoActivate` setting (registered by
feature 0012) into actual workbench behavior: when a user has set the
flag to `true`, Mission Control becomes the active surface
automatically on workbench restore. Without this PR the setting is a
JSON schema entry only — flipping it does nothing.

The behavior is intentionally minimal:
- one-shot activation at `LifecyclePhase.Restored`,
- only activates when Mission Control is not already active,
- never deactivates (a `false` value means "do nothing", not "force off").

## In scope

1. **Workbench contribution** `MissionControlAutoActivateContribution`
   that fires at `LifecyclePhase.Restored`:
   - reads `getMissionControlAutoActivate(configurationService)`
   - reads `IMissionControlService.isActive`
   - if setting is `true` AND service is *not* already active, calls
     `IMissionControlService.setActive(true)`.
2. **Pure helper** `shouldAutoActivateMissionControl({ setting, isActive }): boolean`
   so the decision logic can be unit-tested independently of DI.
3. **Workbench main import** of the new contribution.
4. **No new commands, no new keybindings, no new UI**, no telemetry.

## Out of scope (deferred)

- Deactivating Mission Control when the setting flips to `false`
  mid-session — the spec promised "auto-activate on restore", not
  bidirectional sync.
- Listening to setting changes (`onDidChangeConfiguration`) for a
  hot-reload effect — same reason; restore is the only trigger.
- A counterpart "auto-hide-after-N-minutes" setting.
- Listening to `IWorkspaceContextService.onDidChangeWorkspaceFolders`
  so opening a second folder re-activates — out of scope for v1.
- A UI affordance (banner/badge) explaining that auto-activate is on.

## Non-goals

- **No React.** No DOM.
- **No new NPM dependencies.**
- **No new telemetry events.**
- **No changes to feature 0012's schema** — this PR consumes it.

## Inputs / dependencies

- `IConfigurationService` (platform).
- `IMissionControlService` (feature 0006) — `isActive`, `setActive(boolean)`.
- `getMissionControlAutoActivate` reader from feature 0012's
  `nzrPipelineSettings.ts`.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-auto-activate/run_all.sh` exits 0.
- [ ] `missionControlAutoActivate.ts` exports the documented pure
      predicate and is unit-tested for all 4 boolean-cartesian cases.
- [ ] `missionControlAutoActivate.contribution.ts` registers a
      contribution at `LifecyclePhase.Restored` that calls
      `IMissionControlService.setActive(true)` exactly when the
      predicate returns `true`.
- [ ] `workbench.common.main.ts` imports the new contribution.
- [ ] No new NPM deps.
- [ ] No regression in prior NZR smoke suites.

## Clarifications (resolved via brief-default judgment)

- **cl-1: When `autoActivate` is `false` but Mission Control is
  already active (e.g., from a prior window's restored context-key
  state), should we deactivate?**
  Resolved: **No, leave it alone**. `false` semantically means "the
  user did not opt in to auto-activation"; it does not mean "force
  inactive". A user who explicitly toggled Mission Control on
  through the palette should not have their state stolen on the
  next launch.
- **cl-2: Should the trigger be `Restored` or `Eventually`?**
  Resolved: **`Restored`**. Matching the existing feature 0011
  welcome contribution. The 200-300ms delay until `Eventually` makes
  the auto-activate feel sluggish.
- **cl-3: If `setActive(true)` throws, do we swallow or surface?**
  Resolved: **swallow silently**. This is a startup convenience
  feature, not a critical path. A failure mode here would manifest
  as "Mission Control didn't auto-open" which the user can recover
  from with `⌘⇧M` (or the toggle command).
  In practice `setActive` does not throw — it's a synchronous state
  mutator — but we wrap defensively because contribution constructor
  failures can break workbench startup.
- **cl-4: Should the contribution depend on the workspace having at
  least one folder open?**
  Resolved: **No**. Auto-activate is independent of workspace state.
  Mission Control works with empty workspaces (renders the "No
  stations yet" empty state).
- **cl-5: Should we expose a one-shot command like `nzr.missionControl.activate`
  too?**
  Resolved: **No** — feature 0006 already ships `nzr.toggleMissionControl`
  which can target the active state. Adding a second non-toggle
  command would muddy the surface.

## Risks

- **R1:** Constructor-time DI failures break workbench startup. **Mitigation:**
  defensive try/catch around `setActive(true)`.
- **R2:** Without a dev build we cannot visually confirm the
  auto-activation. **Mitigation:** pure predicate fully unit-tested;
  smoke greps assert the wiring shape.
- **R3:** Users who enable the setting on a misconfigured profile may
  see Mission Control open on every launch even after they grow tired
  of it. **Mitigation:** the setting is one toggle in the standard
  Settings UI — easy to flip off.
