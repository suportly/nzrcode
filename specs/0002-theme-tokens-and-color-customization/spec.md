# Feature specification: NZR_TOKENS e tema "NZR Dark" padrão

> Skill `specify` — foco em **o quê** e **por quê**. Plano e código em `plan.md`/`tasks.md`.

**Branch:** `feature/0002-theme-tokens-and-color-customization`
**Created:** 2026-05-14
**Status:** Draft
**Spec ID:** 0002
**Language:** pt-BR

---

<!-- section: Problem -->
## Problema

Pós-rebrand (feature 0001) o aplicativo continua abrindo com o tema upstream "Dark 2026" — cinza neutro, paleta azul-Microsoft, zero conexão visual com a identidade NZRCode (warm dark `#0d0c0a` + accent âmbar `#ffa45c`). Para a Mission Control e cada feature 0003+ se ancorarem visualmente na marca, precisamos: (a) um conjunto canônico de tokens de cor exportado de `src/vs/workbench/browser/parts/nzr/theme.ts` que features futuras consomem por import, (b) um color theme "NZR Dark" registrado nos defaults e (c) ele como tema dark padrão (sobrescrevendo `Dark 2026`). Sem isso a primeira impressão visual ainda diz "VS Code" e cada feature ficaria forçada a redefinir cores locais inline.

<!-- section: Reconnaissance -->
## Reconnaissance

- **Registro de temas built-in** — entry: `extensions/theme-defaults/package.json` (`contributes.themes` array, linha 15+) · auth: `none` · integration: cada tema lista `id`, `label` (via `%key%` em `package.nls.json`), `uiTheme` (vs/vs-dark/hc-black/hc-light), `path` JSON em `themes/`.
- **JSON de tema padrão** — entry: `extensions/theme-defaults/themes/2026-dark.json` (referência) · auth: `none` · integration: usa `include` para herdar de `dark_modern.json` e sobrescreve ~200 chaves do `colorRegistry`.
- **Default theme setting** — entry: `src/vs/workbench/services/themes/common/workbenchThemeService.ts` linha 42 (`ThemeSettingDefaults.COLOR_THEME_DARK = 'Dark 2026'`) · integration: `IThemeService` lê esse default quando `workbench.colorTheme` não está em settings.
- **NLS labels** — entry: `extensions/theme-defaults/package.nls.json` · integration: cada tema usa `%key%` que resolve aqui.
- **product.json onboardingThemes** — entry: `product.json` chaves `onboardingThemes[]` linhas 197-234 · integration: oferta de temas no Welcome screen.
- **colorRegistry global** — entry: `src/vs/platform/theme/common/colorRegistry.ts` + `src/vs/platform/theme/common/colors/*.ts` · integration: define ~600 IDs. Tema sobrescreve via JSON; não mexemos no registry.
- **Splash (`partsSplash.ts`)** — verificado: não renderiza wordmark, apenas persiste cores via `IThemeService.getColor(...)`. Indireção via tema significa que NZR Dark automaticamente pinta o splash com a paleta. **A cl-7 da 0001 estava em premissa errada — não há wordmark a adicionar no splash.** Wordmark visível ao usuário fica para Welcome (feature 0011).

<!-- section: Users and stakeholders -->
## Usuários e stakeholders

- **Usuário final** — abre NZRCode e vê paleta warm dark com accent âmbar, não cinza neutro Microsoft.
- **Autores de feature futura** (Mission Control, station UI, pipeline rail) — importam `NZR_TOKENS` em vez de redeclarar cores inline.
- **Mantenedor (alair@suportly.com.br)** — sign-off final da paleta.

<!-- section: Success criteria -->
## Critérios de sucesso

- `src/vs/workbench/browser/parts/nzr/theme.ts` existe e exporta `NZR_TOKENS` com pelo menos as 22 chaves do brief (14 cores de superfície/texto/accent + 8 stage colors + 2 fonts).
- `extensions/theme-defaults/themes/nzr-dark.json` é JSON válido e mapeia ≥ 30 chaves do `colorRegistry` para valores derivados de NZR_TOKENS.
- `extensions/theme-defaults/package.json` lista NZR Dark no array `contributes.themes` (`uiTheme: "vs-dark"`).
- `extensions/theme-defaults/package.nls.json` tem `nzrDarkThemeLabel = "NZR Dark"`.
- `ThemeSettingDefaults.COLOR_THEME_DARK` muda de `'Dark 2026'` para `'NZR Dark'`.
- `product.json.onboardingThemes[0]` é a entrada NZR Dark.
- `bash test/nzrcode-theme/run_all.sh` exit 0 — 4 sub-tests GREEN.
- Diff final toca ≤ 5 arquivos modificados + 2 criados; **nenhuma mudança em `colorRegistry.ts` ou outros temas**.

<!-- section: Non-goals -->
## Não-goals

- **Reescrever todos os temas built-in** — só NZR Dark. Dark Modern, Dark+, Light 2026 etc. ficam intocados.
- **Tema NZR Light** — out of scope. Default light segue `Light 2026`.
- **Editar `colorRegistry.ts`** — não adicionamos novos IDs. Só sobrescrevemos via JSON.
- **Splash wordmark** — refutado pela recon.
- **Trocar product icon theme** — `PRODUCT_ICON_THEME = 'Default'` segue.
- **Token colors / syntax highlight** — NZR Dark `include`s `dark_modern.json`; só reescreve chrome do workbench.
- **Welcome page rebrand** — feature 0011.
- **WCAG audit** — feature de acessibilidade dedicada futura.

<!-- section: User stories -->
## User stories

### Story 1 — Token canônico de marca importável (P1)

Como **autor de feature futura**, eu quero importar `NZR_TOKENS` de um único módulo TypeScript para que toda cor de marca em features 0003+ aponte para a mesma source-of-truth.

**Acceptance:**

1. **Given** repositório pós-merge, **When** abro `src/vs/workbench/browser/parts/nzr/theme.ts`, **Then** vejo `export const NZR_TOKENS = { ... }` com `bg`, `surface`, `elev`, `elev2`, `border`, `borderStrong`, `text`, `text2`, `muted`, `dim`, `amber`, `amberDim`, `amberSoft`, `amberLine`, `stageSpecify`, `stageClarify`, `stagePlan`, `stageTasks`, `stageImplement`, `stageReview`, `stageDone`, `stageFailed`, `fontMono`, `fontSans`.
2. **Given** outro módulo TS escreve `import { NZR_TOKENS } from '.../parts/nzr/theme.js'; NZR_TOKENS.amber;`, **Then** compila sem erro e o valor é `'#ffa45c'`.
3. **Given** `theme.ts`, **When** rodo `bash test/nzrcode-theme/test_tokens_shape.sh`, **Then** verifica via `grep` que todas as chaves obrigatórias estão presentes com valor de cor válido.

### Story 2 — Tema "NZR Dark" registrado como default dark (P1)

Como **usuário final**, eu quero que NZRCode abra com paleta de marca por padrão, não com "Dark 2026" upstream.

**Acceptance:**

1. **Given** instalação limpa pós-merge, **When** o app abre sem `workbench.colorTheme` em settings, **Then** o tema ativo é "NZR Dark" (sidebar/activity bar/status bar mostram cores da paleta NZR_TOKENS).
2. **Given** Settings → "Color Theme", **When** lista temas, **Then** "NZR Dark" aparece (junto com Dark 2026, Dark Modern, etc.).
3. **Given** onboarding screen, **When** mostra temas dark, **Then** "NZR Dark" aparece como primeira opção dark.
4. **Given** `extensions/theme-defaults/themes/nzr-dark.json`, **When** rodo `jq '.colors | keys | length'`, **Then** retorna ≥ 30.

### Story 3 — Suite de smoke tests do tema (P1)

Como **mantenedor**, eu quero que o tema seja verificável sem rodar a UI, para que qualquer regressão de mapeamento caia num teste shell.

**Acceptance:**

1. **Given** `test/nzrcode-theme/run_all.sh`, **When** executado, **Then** roda 4 sub-tests: `test_tokens_shape.sh` (chaves de NZR_TOKENS), `test_nzr_dark_json.sh` (JSON válido + ≥30 colorRegistry keys), `test_default_theme.sh` (workbenchThemeService aponta 'NZR Dark'), `test_theme_registration.sh` (package.json + package.nls.json listam o tema).
2. **Given** suite GREEN, **When** modifico `COLOR_THEME_DARK` de volta para `'Dark 2026'`, **Then** `test_default_theme.sh` vira RED.
3. **Given** suite GREEN, **When** removo `nzrDarkThemeLabel` de `package.nls.json`, **Then** `test_theme_registration.sh` vira RED.

<!-- section: Clarifications -->
## Clarifications

> Resolvidas em 2026-05-14 via skill `clarify` em auto mode.

- **cl-1 — Tema NZR Dark "puro" ou herda?** **Decidido:** herda via `"include": "./dark_modern.json"` e sobrescreve ~30-50 chaves. **Rationale:** dark_modern já estabelece syntax highlight bem-testado; reescrever 600 chaves é desproporcional para identidade visual de chrome.
- **cl-2 — Local de `theme.ts`.** **Decidido:** `src/vs/workbench/browser/parts/nzr/theme.ts` (brief §5). **Rationale:** `parts/nzr/` será o hub Mission Control; centralizar tokens lá evita imports cruzados.
- **cl-3 — Stage colors em theme.ts sem uso imediato.** **Decidido:** incluir os 8 já no NZR_TOKENS. **Rationale:** brief §3 lista; features 0007+ vão consumir; declarar agora barato.
- **cl-4 — `onboardingThemes` ordenamento.** **Decidido:** NZR Dark substitui dark-2026 no slot inicial; demais entradas inalteradas.
- **cl-5 — Manter "Dark 2026" disponível?** **Decidido:** sim, segue registrado em package.json para usuário escolher. **Rationale:** baixo custo, alto valor para usuários migrando.
- **cl-6 — Quando o default vale?** **Decidido:** comportamento existente — se `workbench.colorTheme` não está em settings.json, usa ThemeSettingDefaults. Sem migração; upgrades que já tinham "Dark 2026" salvo continuam nele.

<!-- section: Data touched -->
## Dados tocados

- **Novos:**
  - `src/vs/workbench/browser/parts/nzr/theme.ts`
  - `extensions/theme-defaults/themes/nzr-dark.json`
  - `test/nzrcode-theme/{test_tokens_shape,test_nzr_dark_json,test_default_theme,test_theme_registration,run_all}.sh + README.md`
- **Modificados:**
  - `extensions/theme-defaults/package.json` (adicionar entry)
  - `extensions/theme-defaults/package.nls.json` (adicionar label)
  - `src/vs/workbench/services/themes/common/workbenchThemeService.ts` (1 linha)
  - `product.json` (reordenar onboardingThemes)
- **Intocados:** `colorRegistry.ts`, outros `themes/*.json`, todo `src/vs/editor/`, todo restante de `src/vs/workbench/contrib/`, `partsSplash.ts`.

<!-- section: Out-of-band effects -->
## Efeitos out-of-band

Nenhum. Mudança 100% client-side via assets estáticos e constantes TS.

<!-- section: Open risks -->
## Riscos abertos

- **`@font-face` global pendente**. `NZR_TOKENS.fontMono` exporta a string CSS mas a fonte JetBrains Mono bundle ainda não tem `@font-face` global. Fica para feature 0006 onde Mission Control começa a usar visualmente.
- **WCAG**. Paleta âmbar `#ffa45c` sobre `#0d0c0a` precisa auditoria; deferido para feature de acessibilidade.
- **Persistência de tema upstream**. Usuários upgrade que já salvaram `"Dark 2026"` não veem a mudança. Documentar no PR.
- **Conflict com upstream**. Se microsoft/vscode mudar `COLOR_THEME_DARK`, rebase pede merge. Baixa probabilidade.

<!-- section: Traceability -->
## Traceability

- Originating issue: NZRCode Implementation Brief (§6.2)
- Related specs: 0001 (precondição), 0003+ (consumirão NZR_TOKENS), 0006 (`@font-face` global).
- Constitution articles invoked: I, II, III.
