# Implementation plan: NZR_TOKENS e tema "NZR Dark" padrão

> Produzido pela skill `plan` a partir de `spec.md` aprovado.

**Branch:** `feature/0002-theme-tokens-and-color-customization`
**Date:** 2026-05-14
**Spec:** [spec.md](./spec.md)
**Plan version:** 1
**Language:** pt-BR

---

## Summary

Adicionar dois artefatos novos (um módulo TS de tokens, um JSON de tema), modificar três arquivos para registrar/promover o tema (`extensions/theme-defaults/{package,package.nls}.json`, `workbenchThemeService.ts`), reordenar uma chave em `product.json`, e cobrir tudo com 4 smoke tests shell. Mudança 100% mecânica + JSON; zero risco de runtime regressão fora do tema selecionado. ~7 tasks (T001-T007), ~3h.

## Technical context

| Field | Value |
|---|---|
| Active preset | lean |
| Language / runtime | TypeScript 5.x / Node 18 |
| Primary dependencies | nenhuma nova; consome `IThemeService`, `colorRegistry` existentes |
| Storage | N/A — arquivos estáticos |
| Testing framework | Smoke tests shell (`jq`/`grep`/`node -e`) em `test/nzrcode-theme/` |
| Target platform(s) | Todas (tema é cross-platform) |
| Performance budget | N/A |
| Security considerations | Nenhuma — apenas valores de cor e strings de label |

## Constitution check

| Article | Applies? | Status | Evidence |
|---|---|---|---|
| I. Spec-first | Yes | PASS | `spec.md` clarificado, zero markers |
| II. Test-first | Yes | PASS | T001 escreve smoke tests RED antes do tema landar |
| III. Simplicity | Yes | PASS | Zero novas abstrações — `theme.ts` é um único `export const`. `nzr-dark.json` herda de `dark_modern.json`. |
| IV. Evidence over claims | Yes | PASS | PR test plan inclui `jq` queries, `grep` asserts, `node -e` import probe |
| V. Provider pattern | No | N/A | Sem sistema externo |
| VI. Privacy by design | Yes | PASS | Zero novos logs/PII |
| VII. Attribution | No | N/A | Sem material adaptado novo (cores foram desenhadas para a marca) |

## Architecture decisions

### ADR-1 — Token module separado do JSON do tema

**Decisão:** `theme.ts` exporta `NZR_TOKENS` como um único `const` literal. O JSON `nzr-dark.json` declara as cores como literais hexa (sem reference a TS — JSON é estático).

**Rationale:** VS Code carrega temas como JSON via extensão de tema; não há mecanismo nativo para o JSON consumir constantes TS em build time. Mantemos os dois em sync manualmente — o smoke test compara que valores críticos batem entre arquivos.

**Trade-offs:** Risco de drift entre TS e JSON. Mitigado por `test_nzr_dark_json.sh` que faz cross-check de pelo menos as chaves âmbar/bg/border.

### ADR-2 — `include` em vez de tema from-scratch

**Decisão:** `nzr-dark.json` começa com `"include": "./dark_modern.json"` e sobrescreve apenas as cores de chrome (workbench surfaces, accents, borders).

**Rationale:** Reuso de tokenColors (syntax highlight) e ~500 chaves auxiliares já validadas pela Microsoft em `dark_modern`. NZR Dark é uma identidade de chrome, não uma rewrite de syntax.

**Trade-offs:** Mudanças upstream em `dark_modern.json` afetam NZR Dark indiretamente. Aceitável — versão upstream do dark_modern é estável.

### ADR-3 — Tokens com Stage colors já incluídos

**Decisão:** NZR_TOKENS já contém os 8 stage colors (`stageSpecify` ... `stageFailed`) mesmo que feature 0002 não os use.

**Rationale:** Brief §3 lista como tokens canônicos; features 0007+ vão importar. Declarar agora é trivial; abrir PR mecânico depois não.

### ADR-4 — Smoke tests shell, não unit tests TS

**Decisão:** Suite de smoke fica em `test/nzrcode-theme/*.sh` (mesmo padrão da feature 0001).

**Rationale:** Não exigir `npm install` (que é caro no VS Code) para asserts de estrutura. Smoke roda em qualquer ambiente com `bash`+`jq`+`node`.

**Trade-offs:** Não testa runtime behavior do `IThemeService`. Aceitável — a integração com `IThemeService` é exercida pelo build VS Code (T012 manual) e pelo mocha test suite existente do upstream.

## Project structure changes

```text
src/vs/workbench/browser/parts/nzr/theme.ts                       (new)
extensions/theme-defaults/themes/nzr-dark.json                    (new)
extensions/theme-defaults/package.json                            (modified — themes[] entry)
extensions/theme-defaults/package.nls.json                        (modified — nzrDarkThemeLabel)
src/vs/workbench/services/themes/common/workbenchThemeService.ts  (modified — 1 line)
product.json                                                       (modified — onboardingThemes[0])
test/nzrcode-theme/test_tokens_shape.sh                            (new)
test/nzrcode-theme/test_nzr_dark_json.sh                           (new)
test/nzrcode-theme/test_default_theme.sh                           (new)
test/nzrcode-theme/test_theme_registration.sh                     (new)
test/nzrcode-theme/run_all.sh                                      (new)
test/nzrcode-theme/README.md                                       (new)
```

## Phase breakdown

### Phase 1 — Smoke tests RED

- T001: criar `test/nzrcode-theme/` com 4 sub-tests + run_all + README. Roda RED (nada existe ainda).

### Phase 2 — Token module + tema JSON

- T002: `src/vs/workbench/browser/parts/nzr/theme.ts` com NZR_TOKENS.
- T003: `extensions/theme-defaults/themes/nzr-dark.json` (include + ~40 chaves de chrome).

### Phase 3 — Registro

- T004: `extensions/theme-defaults/package.json` + `package.nls.json` adicionam NZR Dark.
- T005: `workbenchThemeService.ts` muda default para `'NZR Dark'`.
- T006: `product.json` reordena `onboardingThemes` (NZR Dark primeiro).

### Phase 4 — Validação

- T007: rodar `run_all.sh`, GREEN, commit verification.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Drift TS ↔ JSON (token muda em theme.ts mas não em nzr-dark.json) | Med | Low | `test_nzr_dark_json.sh` cross-checa pelo menos `bg`, `amber`, `border` |
| Workbench compile error por path errado de import de theme.ts | Med | High | Build smoke (T012-equivalente manual no PR) — mas como theme.ts não é importado por ninguém ainda, risco baixo nesta feature |
| Rebase conflict em workbenchThemeService.ts (upstream pode mexer no namespace) | Low | Low | Diff é 1 linha; resolução trivial |
| WCAG fail em accent âmbar | Med | Med | Documentar no PR como follow-up; feature de a11y dedicada |

## Complexity tracking

| Article waived | Reason | Alternatives considered | Reviewer |
|---|---|---|---|
| — | — | — | — |

## Hand-off to `tasks`

A próxima skill é `tasks`. ~7 tasks. Pré-condições:
- [x] Constitution Check completo, sem blank rows
- [x] Complexity tracking vazia (justificada)
- [x] Project structure delta acurada
