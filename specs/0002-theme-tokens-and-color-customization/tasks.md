# Tasks: NZR_TOKENS e tema "NZR Dark" padrão

**Branch:** `feature/0002-theme-tokens-and-color-customization`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-14
**Language:** pt-BR

---

## Task list

### T001 — Smoke tests RED

- **Status:** pending
- **Depends on:** —
- **Files:**
  - create: `test/nzrcode-theme/test_tokens_shape.sh`
  - create: `test/nzrcode-theme/test_nzr_dark_json.sh`
  - create: `test/nzrcode-theme/test_default_theme.sh`
  - create: `test/nzrcode-theme/test_theme_registration.sh`
  - create: `test/nzrcode-theme/run_all.sh`
  - create: `test/nzrcode-theme/README.md`
- **Spec scenarios:** Story 1.3, Story 2.4, Story 3.1
- **Acceptance:**
  - [ ] `test_tokens_shape.sh` grepa por cada chave obrigatória de NZR_TOKENS em `src/vs/workbench/browser/parts/nzr/theme.ts` e verifica que o valor é um hex/rgba/string CSS válida.
  - [ ] `test_nzr_dark_json.sh` valida `extensions/theme-defaults/themes/nzr-dark.json` via `jq`: JSON ok, `name == "NZR Dark"`, `type == "dark"`, `include` referencia `dark_modern.json`, `keys(colors) | length >= 30`, e que `colors["editor.background"]`, `colors["sideBar.background"]`, `colors["focusBorder"]` apontam para valores derivados dos tokens NZR (bg + amber).
  - [ ] `test_default_theme.sh` grepa em `src/vs/workbench/services/themes/common/workbenchThemeService.ts` por `COLOR_THEME_DARK = 'NZR Dark'`.
  - [ ] `test_theme_registration.sh` valida via `jq` que `extensions/theme-defaults/package.json` contém entrada `{id: "NZR Dark", uiTheme: "vs-dark", path: "./themes/nzr-dark.json"}` em `contributes.themes` E que `package.nls.json` tem chave `nzrDarkThemeLabel`.
  - [ ] `run_all.sh` agrega os 4 + exit code agregado.
  - [ ] Executar `bash test/nzrcode-theme/run_all.sh` exit 1 (RED) — confirma estado inicial.
  - [ ] Commit: `test(theme): T001 add NZR theme smoke tests (RED)`.

### T002 — NZR_TOKENS module

- **Status:** pending
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/browser/parts/nzr/theme.ts`
- **Spec scenarios:** Story 1.1, 1.2, 1.3
- **Acceptance:**
  - [ ] `theme.ts` exporta `NZR_TOKENS` literal com TODAS as chaves listadas no brief §3: surface (`bg`, `surface`, `elev`, `elev2`, `border`, `borderStrong`); text (`text`, `text2`, `muted`, `dim`); accent (`amber`, `amberDim`, `amberSoft`, `amberLine`); pipeline stages (`stageSpecify`, `stageClarify`, `stagePlan`, `stageTasks`, `stageImplement`, `stageReview`, `stageDone`, `stageFailed`); fonts (`fontMono`, `fontSans`).
  - [ ] Valores idênticos aos do brief §3 (bg `#0d0c0a`, amber `#ffa45c`, etc.).
  - [ ] Header comment com copyright NZRCode + licença MIT (mesmo padrão dos outros arquivos do workbench).
  - [ ] Tipo TS: `export const NZR_TOKENS = { ... } as const;` (literal types, evita widening).
  - [ ] `bash test/nzrcode-theme/test_tokens_shape.sh` GREEN.
  - [ ] Commit: `feat(nzr): T002 add NZR_TOKENS canonical brand palette module`.

### T003 — NZR Dark theme JSON

- **Status:** pending
- **Depends on:** T002
- **Files:**
  - create: `extensions/theme-defaults/themes/nzr-dark.json`
- **Spec scenarios:** Story 2.4
- **Acceptance:**
  - [ ] JSON válido (parsa via `jq`).
  - [ ] `"name": "NZR Dark"`, `"type": "dark"`, `"include": "./dark_modern.json"`.
  - [ ] `colors` mapeia ≥ 30 chaves do colorRegistry para valores NZR. Cobertura mínima das chaves visualmente críticas:
    - chrome / surfaces: `editor.background`, `sideBar.background`, `sideBarSectionHeader.background`, `activityBar.background`, `statusBar.background`, `statusBar.noFolderBackground`, `titleBar.activeBackground`, `titleBar.inactiveBackground`, `tab.activeBackground`, `tab.inactiveBackground`, `panel.background`
    - bordas: `focusBorder`, `sideBar.border`, `activityBar.border`, `statusBar.border`, `titleBar.border`, `panel.border`, `tab.border`
    - foreground: `foreground`, `descriptionForeground`, `icon.foreground`, `disabledForeground`
    - accents (âmbar): `button.background`, `button.hoverBackground`, `textLink.foreground`, `progressBar.background`, `activityBarBadge.background`
    - selection: `editor.selectionBackground`, `list.activeSelectionBackground`, `list.hoverBackground`
  - [ ] Pelo menos as chaves seguintes apontam para tokens NZR canônicos:
    - `editor.background` = `#0d0c0a` (bg)
    - `sideBar.background` = `#0d0c0a`
    - `focusBorder` = `#ffa45c` ou variant com alpha
    - `button.background` = `#ffa45c` (amber)
    - `progressBar.background` = `#ffa45c`
  - [ ] `bash test/nzrcode-theme/test_nzr_dark_json.sh` GREEN.
  - [ ] Commit: `feat(theme): T003 add NZR Dark color theme JSON`.

### T004 — Registrar tema em extensions/theme-defaults

- **Status:** pending
- **Depends on:** T003
- **Files:**
  - modify: `extensions/theme-defaults/package.json`
  - modify: `extensions/theme-defaults/package.nls.json`
- **Spec scenarios:** Story 2.2
- **Acceptance:**
  - [ ] `package.json` `contributes.themes` ganha entrada `{id: "NZR Dark", label: "%nzrDarkThemeLabel%", uiTheme: "vs-dark", path: "./themes/nzr-dark.json"}` como **primeira** entrada do array (acima de `Light 2026`).
  - [ ] `package.nls.json` ganha `"nzrDarkThemeLabel": "NZR Dark"`.
  - [ ] `bash test/nzrcode-theme/test_theme_registration.sh` GREEN.
  - [ ] Commit: `feat(theme): T004 register NZR Dark in theme-defaults extension`.

### T005 — Default dark theme = NZR Dark

- **Status:** pending
- **Depends on:** T004
- **Files:**
  - modify: `src/vs/workbench/services/themes/common/workbenchThemeService.ts`
- **Spec scenarios:** Story 2.1
- **Acceptance:**
  - [ ] Linha `export const COLOR_THEME_DARK = 'Dark 2026';` muda para `export const COLOR_THEME_DARK = 'NZR Dark';`.
  - [ ] `COLOR_THEME_LIGHT`, `COLOR_THEME_HC_DARK`, `COLOR_THEME_HC_LIGHT` ficam inalterados.
  - [ ] `bash test/nzrcode-theme/test_default_theme.sh` GREEN.
  - [ ] Commit: `feat(theme): T005 set NZR Dark as default dark color theme`.

### T006 — product.json onboardingThemes promove NZR Dark

- **Status:** pending
- **Depends on:** T005
- **Files:**
  - modify: `product.json`
- **Spec scenarios:** Story 2.3
- **Acceptance:**
  - [ ] Array `onboardingThemes` recebe nova entrada `{id: "nzr-dark", label: "NZR Dark", themeId: "NZR Dark", type: "dark"}` na posição 0.
  - [ ] A entrada `dark-2026` permanece no array (apenas re-posicionada).
  - [ ] JSON válido (`node -e "JSON.parse(...)"`).
  - [ ] Commit: `feat(brand): T006 promote NZR Dark to first onboarding theme slot`.

### T007 — Verify all smoke tests GREEN

- **Status:** pending
- **Depends on:** T006
- **Files:**
  - create: `specs/0002-theme-tokens-and-color-customization/evidence/run_all_output.txt`
- **Spec scenarios:** Story 3.1, 3.2, 3.3
- **Acceptance:**
  - [ ] `bash test/nzrcode-theme/run_all.sh` exit 0 — 4 sub-tests PASS.
  - [ ] Saída capturada em `evidence/run_all_output.txt`.
  - [ ] Status de todas as tasks T001-T007 vira `done` em tasks.md.
  - [ ] Commit: `test(theme): T007 confirm NZR theme smoke suite GREEN`.

## Parallelization hints

- Parallel: T002 e T003 não compartilham arquivos (mas T003 depende conceitualmente de T002 para alinhar valores) — pode rodar paralelo se aceitar revisão extra.
- Serial: T001 antes de tudo; T004 ≤ T005 ≤ T006 ≤ T007 estritamente serial.

## Post-task checklist

After every task:
- [ ] Commit referencia task id.
- [ ] Status flipped pending → done.
- [ ] `bash test/nzrcode-theme/run_all.sh` não regride.

After all tasks:
- [ ] `bash test/nzrcode-theme/run_all.sh` GREEN.
- [ ] `bash test/nzrcode-brand/run_all.sh` continua GREEN (regressão check da feature 0001).
- [ ] Hand off para PR contra `feature/0001-rebrand-product-json` (stacked).
