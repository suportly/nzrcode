# NZR theme smoke tests

Shell smoke tests that assert the NZR Dark theme is wired up correctly across
every file the spec requires. RED at the start of feature 0002 (T001), turns
GREEN as T002-T006 land, stays GREEN from T007 forward.

## Run

```sh
bash test/nzrcode-theme/run_all.sh
```

## What each script checks

- `test_tokens_shape.sh` — `src/vs/workbench/browser/parts/nzr/theme.ts`
  exports `NZR_TOKENS` with every key listed in the implementation brief §3
  and the brand-critical values (`bg`, `amber`, `text`) match exactly.
- `test_nzr_dark_json.sh` — `extensions/theme-defaults/themes/nzr-dark.json`
  is valid JSON with `name: "NZR Dark"`, `type: "dark"`, inherits from
  `dark_modern.json` via `include`, maps at least 30 color registry keys,
  and the brand-critical surfaces (editor / sideBar / activityBar /
  statusBar background, focusBorder, button.background, progressBar.background)
  point at NZR_TOKENS literals.
- `test_default_theme.sh` —
  `src/vs/workbench/services/themes/common/workbenchThemeService.ts`
  declares `COLOR_THEME_DARK = 'NZR Dark'`.
- `test_theme_registration.sh` — the theme-defaults extension manifest
  (`package.json`) lists NZR Dark with the right `uiTheme` and `path`, and
  `package.nls.json` provides the `nzrDarkThemeLabel` translation key.

## What this suite does NOT cover

- Runtime behaviour of `IThemeService` (a dev build is required to exercise
  the actual theme load; that's a manual PR check).
- WCAG contrast — separate accessibility feature.
- @font-face registration for JetBrains Mono — feature 0006.
