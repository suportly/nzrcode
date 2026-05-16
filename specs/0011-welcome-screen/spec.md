# Spec 0011 — Welcome Screen

**Branch:** `feature/0011-welcome-screen`
**Base:** `main` (post-merge of 0007/0009; sibling of 0008 PR #9 and 0010 PR #10)
**Generated:** 2026-05-15
**Language:** pt-BR

---

## Goal

Greet a first-time NZRCode user with a one-shot notification that wires
the user into Mission Control. The notification:

- shows on the first workbench restore where no "welcome shown" flag
  has been stored,
- carries 3 primary actions: **Start Mission Control**, **Add Station**,
  **Don't show again**,
- self-dismisses on any action (and persists `welcome.shown = true`).

A companion `nzr.welcome.show` command replays the notification at any
time from the F1 palette so the user can revisit the entry points later.

## Why this is a "Welcome Screen"

The brief (`§6.11`) and earlier specs (`0002 §57`, `0006 §31`) reference
a "Welcome screen" — a button to launch Mission Control. VS Code's
built-in walkthrough infrastructure (`gettingStartedContent.ts`) is
heavy: it requires SVG/markdown media files resolved via
`FileAccess.asBrowserUri`, plus React-style step rendering. For our
intent (one entry-point button on first run + on demand) a
`INotificationService.notify` with 3 prompt choices is the smallest
surface that delivers the value. Walkthrough integration is tracked as
a deferred follow-up.

## In scope

1. **Workbench contribution** `WelcomeNotificationContribution` registered
   at `LifecyclePhase.Restored` that:
   1. Reads `IStorageService.getBoolean('nzr.welcome.shown', StorageScope.PROFILE, false)`.
   2. If false, calls `INotificationService.notify(...)` with severity
      `Info`, the welcome message, and 3 `IPromptChoice`s.
   3. After the user clicks any choice, sets the storage flag to true.
2. **Command** `nzr.welcome.show` (Action2, `category: NZR`, `f1: true`)
   that forces the welcome notification to display regardless of the
   stored flag — useful for users who dismissed it and want to revisit
   the actions, and as a manual hook for QA.
3. **Pure helpers** in `welcomeFlow.ts`:
   - `WELCOME_SHOWN_STORAGE_KEY = 'nzr.welcome.shown'` (constant).
   - `interface IWelcomeActionDescriptor { id; label; commandId? }`.
   - `function buildWelcomeActionDescriptors(): readonly IWelcomeActionDescriptor[]`
     returning 3 typed descriptors (mission-control, add-station,
     dont-show-again) — the contribution then materializes them into
     `IPromptChoice` objects.
   - `function buildWelcomeMessage(): string` returning the localized
     welcome message (single source of truth).
4. **i18n:** all visible strings via `localize` / `localize2`.

## Out of scope (deferred)

- Replacing VS Code's native getting-started walkthrough with an NZR
  walkthrough (would require new media files + a markdown story).
  Track as `decision-0011-1.md`.
- Wordmark on the splash screen (still pure-theme; spec 0002 §27
  resolved that splash inherits the theme).
- Settings page for re-enabling the notification (feature 0012).
- Cross-profile or cross-machine "shown" sync — we use
  `StorageScope.PROFILE` + `StorageTarget.MACHINE` (matches existing
  welcome banner pattern).
- A first-run welcome editor input (custom editor, like
  `gettingStartedInput.ts`) — too big a surface for this PR.

## Non-goals

- **No React.** Notification API only.
- **No new NPM dependencies.**
- **No new telemetry events.**
- **No filesystem writes.** Persistence is via `IStorageService` only.

## Inputs / dependencies

- `INotificationService` (platform) — `notify` with `actions.primary`
  carrying the choices.
- `IStorageService` (platform) — `getBoolean` / `store` for the
  "shown" flag.
- `ICommandService` (platform) — to dispatch `nzr.toggleMissionControl`
  and `nzr.station.add` on click.

## Acceptance criteria

- [ ] Smoke suite `test/nzrcode-welcome/run_all.sh` exits 0.
- [ ] `welcomeFlow.ts` exposes pure helpers unit-tested independently
      of VS Code DI.
- [ ] Contribution registered via
      `Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WelcomeNotificationContribution, LifecyclePhase.Restored)`.
- [ ] Command `nzr.welcome.show` registered via `Action2` under the
      `NZR` category with `f1: true`.
- [ ] All visible strings via `localize()` / `localize2()`.
- [ ] No new NPM deps in `package.json`.

## Clarifications (resolved via brief-default judgment)

- **cl-1: Toast / notification vs. modal dialog?**
  Resolved: **non-modal toast notification** (severity `Info`). A
  modal dialog on every first run is annoying and against VS Code's UX
  norms (built-in walkthrough is a non-modal editor input).
- **cl-2: Should "Don't show again" be a secondary choice or a primary
  choice?**
  Resolved: **primary choice**, alongside the two action buttons. A
  secondary (gear-icon) placement would hide the escape hatch and
  encourage the user to dismiss-via-X, which conceptually leaves the
  flag false and re-fires on the next launch.
- **cl-3: Storage scope — `PROFILE` or `APPLICATION`?**
  Resolved: **`PROFILE` + `StorageTarget.MACHINE`**. Mirrors the
  existing `welcomeBanner` dismissed-flag convention. New profiles get
  a fresh welcome, which matches "first-run" semantics.
- **cl-4: Should `nzr.welcome.show` bypass the stored flag?**
  Resolved: **Yes**. The command is a manual replay; it must work even
  after the user clicked "Don't show again". The flag is *only*
  consulted by the auto-on-restore path.
- **cl-5: What happens if the user closes the toast via the X (no
  choice clicked)?**
  Resolved: **`onCancel` sets the flag to true** so the user is not
  re-prompted on every launch. They can always recall the notification
  via the palette.

## Risks

- **R1:** `nzr.toggleMissionControl` and `nzr.station.add` ship in
  earlier features (0006, 0010). If a downstream build strips them,
  the welcome buttons no-op silently. **Mitigation:** the smoke suite
  asserts that the contribution references the correct command ids
  via grep; runtime would surface "command not found" in the
  developer console.
- **R2:** Without a dev build in this session we can validate
  structure but not the visual appearance of the toast.
  **Mitigation:** keep the notification minimal (no custom DOM); rely
  on VS Code's built-in toast renderer.
- **R3:** Showing the welcome on every "first run after profile
  switch" might surprise power users with many profiles.
  **Mitigation:** acceptable per cl-3 — track as
  `decision-0011-2.md` if user feedback says otherwise.
