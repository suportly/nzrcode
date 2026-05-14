# Implementation plan: Rebrand para NZRCode (product.json, ícones, splash, About)

> Produzido pela skill `plan` a partir de `spec.md` aprovado. Descreve **como** o spec será realizado. Não reescreve o spec.

**Branch:** `feature/0001-rebrand-product-json`
**Date:** 2026-05-14
**Spec:** [spec.md](./spec.md)
**Plan version:** 1
**Language:** pt-BR

---

## Summary

Realizar o rebrand do fork `microsoft/vscode → suportly/nzrcode` apenas via **configuração + recursos + scripts de build** — sem tocar uma linha de TypeScript/JavaScript em `src/`. A entrega é (1) uma única reescrita coordenada de `product.json` (~30 chaves), (2) um script idempotente `build/lib/nzrcode/generate-icons.mjs` que converte um SVG fonte `resources/nzrcode-brand/wordmark.svg` em assets PNG/ICNS por plataforma, (3) bundle local da fonte JetBrains Mono em `resources/fonts/`, (4) rename + reescrita de templates Linux (`code.desktop` → `nzrcode.desktop` etc.), e (5) suite de smoke tests que asserta a integridade da nova marca via `jq`/`grep`/hash. Splash wordmark adiado para feature 0002 (decisão cl-7). Estimativa: ~12 tasks distribuídas em 4 fases, ~6h de trabalho.

## Technical context

| Field | Value |
|---|---|
| Active preset | `lean` (instalado em 2026-05-14) |
| Language / runtime | TypeScript 5.x / Node.js 18 (`.nvmrc` upstream); script de geração de ícones é ESM puro |
| Primary dependencies | Já no projeto: `sharp` (raster), Electron, gulp, esbuild. **Nenhuma nova dependência NPM** (compliance com `code-style.md` e brief §7) |
| Storage | N/A — arquivos versionados (config, recursos, fontes) |
| Testing framework | Mocha (suite VS Code existente, `npm test`) para asserts de `product.json`; smoke tests adicionais em `test/nzrcode-brand/` rodam via shell (`jq`/`grep`/`sha256sum`) |
| Target platform(s) | macOS (darwin, `.icns`), Linux (`.png` + `.desktop`), Windows (`.png` + Inno Setup) |
| Performance budget | N/A — feature é apenas branding/config; sem hot path |
| Security considerations | Bundle de fonte JetBrains Mono com licença SIL OFL 1.1 documentada (`resources/fonts/LICENSE-JetBrainsMono.txt`); LICENSE.txt original preserva copyright Microsoft (compatível com MIT); UUIDs win32 regenerados localmente, sem leak de segredos. |

## Constitution check

| Article | Applies? | Status | Evidence |
|---|---|---|---|
| I. Spec-first | Yes | PASS | `spec.md` clarificado em 2026-05-14, zero markers `[NEEDS CLARIFICATION]` (verificado via `grep -c`) |
| II. Test-first | Yes | PASS | Cada task em `tasks.md` começa com um teste failing — ver Phase 1 task T01 (`test_product_json_brand_identity.sh`) e Phase 2 tasks |
| III. Simplicity (YAGNI) | Yes | PASS | Nenhuma nova abstração no código fonte (`src/`). Script `generate-icons.mjs` é single-purpose, ~80 LOC estimadas |
| IV. Evidence over claims | Yes | PASS | PR test plan inclui comandos verbatim: `jq '.applicationName' product.json`, `grep -r 'code-oss' product.json resources/`, screenshot do About dialog |
| V. Provider pattern | No | N/A | Nenhum sistema externo introduzido. CDN da Microsoft mantido conforme decisão cl-9 |
| VI. Privacy by design | Yes | PASS | Zero novos logs; zero coleta de dados de usuário; `agentsTelemetryAppName` renomeado para `nzrcode-agents` mas sem alterar payload ou destino |
| VII. Attribution | Yes | PASS | (a) `LICENSE.txt` retém copyright Microsoft original; (b) novo `CREDITS.md` na raiz documenta o fork upstream + atribui JetBrains Mono (SIL OFL 1.1); (c) `resources/fonts/LICENSE-JetBrainsMono.txt` carrega a licença completa |

## Architecture decisions

### ADR-1 — Zero source changes nesta feature

**Decisão:** Toda mudança visível ao usuário (About dialog, título de janela, menu, etc.) é alcançada apenas editando `product.json`. Nenhum arquivo em `src/` é tocado.

**Rationale:** O VS Code já abstrai branding via `IProductService` (`src/vs/platform/product/common/productService.ts`); todos os call sites de "Code - OSS" leem `productService.nameLong`/`nameShort` em runtime. Editar `src/` para rebrand é trabalho duplicado e introduz risco de regressão em código não-relacionado.

**Trade-offs:** Splash wordmark (que NÃO consome `productService` hoje, apenas pinta partes neutras do workbench) não pode ser implementado nesta feature sem violar a regra — adiado para `0002-theme-tokens-and-color-customization` por decisão `cl-7`.

### ADR-2 — Geração de ícones via script reproducível a partir de SVG fonte

**Decisão:** Versionar apenas `resources/nzrcode-brand/wordmark.svg`. Os arquivos binários (`.icns`, `.png` em todos os tamanhos) são produzidos por `build/lib/nzrcode/generate-icons.mjs` e *também* commitados (porque o build do VS Code os consome diretamente).

**Rationale:** (a) Permite trocar o asset final por design profissional reescrevendo o SVG e re-rodando o script — sem ter que regenerar cada raster manualmente. (b) Hashes dos outputs são determinísticos: `--check` falha CI se alguém editar o binário sem editar o SVG. (c) Aproveita `sharp`, que já é dependência do projeto.

**Trade-offs:** Mantém o binário commitado (~200KB total) mesmo sendo derivado — necessário porque o gulp build não tem step de pré-geração. Aceitável pelo tamanho. Alternativa rejeitada: gerar no build — exigiria reordenar tasks do gulpfile, risco maior.

### ADR-3 — Bundle local de JetBrains Mono (não CDN)

**Decisão:** Embarcar `JetBrainsMono-{Regular,Medium,Bold}.woff2` (~250KB total) em `resources/fonts/`. Não usar CDN, não usar Google Fonts.

**Rationale:** JetBrains Mono será usada em múltiplos pontos da UI nas próximas features (Mission Control, station head, pipeline rail) — bundle local elimina dependência de rede para renderização da marca core. SIL OFL 1.1 permite redistribuição. Tamanho é trivial perto do instalador (~80MB).

**Trade-offs:** +250KB no instalador final. Manutenção da fonte (updates) exige refresh manual — aceitável (release cycle de fontes é raro).

### ADR-4 — Linux desktop entries renomeados, não re-templated

**Decisão:** `resources/linux/code.desktop` → `resources/linux/nzrcode.desktop`. Substituímos os placeholders (`@@NAME_LONG@@` etc.) no novo arquivo já com os valores NZRCode pré-resolvidos? **Não** — mantemos o templating do upstream (`@@NAME_LONG@@`, `@@NAME_SHORT@@`, `@@NAME@@`, `@@EXEC@@`, `@@ICON@@`) intacto; apenas o **nome do arquivo** muda. O build do gulp já substitui esses placeholders lendo `product.json`.

**Rationale:** Re-implementar o templating localmente duplicaria lógica de build. O sistema atual funciona — só precisa apontar para os novos campos via `product.json`.

**Trade-offs:** O nome de arquivo "code.desktop" some, o que pode quebrar pipelines de empacotamento (`build/linux/`) que referenciam o arquivo pelo nome. Mitigação: grep + atualização em Phase 3.

### ADR-5 — UUIDs win32 regenerados uma vez, no commit

**Decisão:** Os 4 UUIDs (`win32x64AppId`, `win32arm64AppId`, `win32x64UserAppId`, `win32arm64UserAppId`) são gerados via `uuidgen` localmente e fixados no `product.json`. Não há geração no build.

**Rationale:** UUIDs precisam ser **estáveis** entre versões para o Inno Setup reconhecer upgrades. Regerar a cada build quebraria upgrades. Geração única no commit é o padrão do upstream.

**Trade-offs:** Se alguém commitar o `product.json` ANTES de rodar `uuidgen`, fica com os UUIDs upstream Microsoft — risco mitigado por T02 (teste failing que compara os UUIDs com os do upstream).

## Project structure changes

```text
product.json                                                   (modified — ~30 chaves)
CREDITS.md                                                     (new — atribuição fork + JetBrains Mono)
.gitattributes                                                 (modified — binários: marcar .icns/.woff2 como binary)
build/lib/nzrcode/generate-icons.mjs                           (new — script de geração)
build/lib/nzrcode/README.md                                    (new — como rodar)
build/lib/nzrcode/wordmark-template.svg.txt                    (new — referência do template, comentado)
resources/nzrcode-brand/wordmark.svg                           (new — SVG fonte, fonte da verdade visual)
resources/nzrcode-brand/colors.json                            (new — tokens de cor para o script ler)
resources/fonts/JetBrainsMono-Regular.woff2                    (new — bundle de fonte)
resources/fonts/JetBrainsMono-Medium.woff2                     (new)
resources/fonts/JetBrainsMono-Bold.woff2                       (new)
resources/fonts/LICENSE-JetBrainsMono.txt                      (new — SIL OFL 1.1 completa)
resources/darwin/code.icns                                     (removed)
resources/darwin/nzrcode.icns                                  (new — gerado pelo script)
resources/linux/code.png                                       (removed)
resources/linux/nzrcode.png                                    (new — gerado)
resources/linux/code.desktop                                   (removed via rename)
resources/linux/nzrcode.desktop                                (new — conteúdo idêntico ao código antigo, com @@PLACEHOLDERS@@)
resources/linux/code-url-handler.desktop                       (removed via rename)
resources/linux/nzrcode-url-handler.desktop                    (new)
resources/linux/code-workspace.xml                             (removed via rename)
resources/linux/nzrcode-workspace.xml                          (new)
resources/linux/code.appdata.xml                               (modified — Name + ID)
resources/linux/{debian,rpm,snap}/*                            (modified — paths/strings com `code-oss` viram `nzrcode`)
resources/win32/code_70x70.png                                 (removed)
resources/win32/code_150x150.png                               (removed)
resources/win32/nzrcode_70x70.png                              (new — gerado)
resources/win32/nzrcode_150x150.png                            (new — gerado)
resources/win32/inno-*.iss                                     (modified — se referenciam AppId direto, atualizar; se leem de product.json, ok)
test/nzrcode-brand/test_product_json.sh                        (new — testes shell `jq`/`grep`)
test/nzrcode-brand/test_icons_exist.sh                         (new — verifica arquivos + hash)
test/nzrcode-brand/test_no_residual_code_oss.sh                (new — `grep -r 'code-oss'` deve retornar 0)
test/nzrcode-brand/test_resource_renames.sh                    (new — verifica que arquivos antigos sumiram)
src/                                                            (NOT MODIFIED — asserção de escopo)
```

## Phase breakdown

### Phase 1 — Brand asset pipeline (foundation)

Constrói a infraestrutura reusável: SVG fonte, script de geração, fontes, suite de smoke tests. Pode rodar independente — não toca `product.json` ainda.

- T01: Criar suite de smoke tests `test/nzrcode-brand/` (escrita primeiro, RED — testa coisas que ainda não existem).
- T02: Criar `resources/nzrcode-brand/wordmark.svg` + `colors.json` (SVG do wordmark `NZR/CODE` em JetBrains Mono, slash âmbar).
- T03: Implementar `build/lib/nzrcode/generate-icons.mjs` com flags `--write` e `--check`.
- T04: Baixar e versionar JetBrains Mono `.woff2` + licença em `resources/fonts/`.
- T05: Adicionar `CREDITS.md` na raiz.
- T06: Rodar o script `--write` e commitar os assets gerados (`.icns`, `.png`s).

### Phase 2 — product.json mutation

Edit coordenada de ~30 chaves. Já com Phase 1 verde, sabemos que os assets existem.

- T07: Reescrever `product.json` com identificadores NZRCode + UUIDs regenerados via `uuidgen` (script auxiliar `build/lib/nzrcode/regen-uuids.mjs` opcional).
- T08: Rodar T01 (smoke tests) — todos devem virar GREEN.

### Phase 3 — Linux resource renames e ajustes de empacotamento

- T09: Renomear `code.desktop`/`code-url-handler.desktop`/`code-workspace.xml` para prefixo `nzrcode`. Manter placeholders `@@...@@`.
- T10: Atualizar referências em `build/linux/`, `resources/linux/{debian,rpm,snap}/*` e qualquer outro arquivo que mencione o nome antigo.
- T11: Atualizar `resources/linux/code.appdata.xml` (Name, ID) e renomear.

### Phase 4 — Build smoke + validação visual

- T12: Rodar `npm install` (se ainda não instalado), `npm run compile` e `./scripts/code.sh` localmente — verificar título de janela e About dialog mostram "NZRCode".
- T13: Rodar `gulp vscode-linux-x64-min` (build truncado para validar pipeline sem instalar) — confirmar zero erros relacionados a paths renomeados.
- T14: Capturar screenshots do About dialog + launcher entry para anexar ao PR.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `gulp` build break por path antigo (`code.desktop`) ainda referenciado | Med | High | T10 grep exaustivo em `build/`, `resources/`, `scripts/`; T13 valida no CI antes do merge |
| Rebase conflict com upstream reorganizando `product.json` | High | Low | Commit isolado para `product.json`; conflict é mecânico, ~30 linhas |
| UUIDs win32 colidindo com instalação existente de Code-OSS na máquina de teste | Low | High | T02 teste falha se UUIDs == upstream; T07 regenera com `uuidgen` |
| `agentsTelemetryAppName: "nzrcode-agents"` quebrando integração interna do Copilot que assumiu `"agents"` | Low | Med | Documentar no PR; se quebrar Copilot in-IDE, rollback isolado dessa chave |
| Script `generate-icons.mjs` gerar PNGs pixelados em 16px (favicon-grade) | Med | Low | Revisão visual no PR (screenshots em T14); SVG fonte deve incluir hint manual para pequenos tamanhos |
| JetBrains Mono `.woff2` não disponível para download direto via curl/wget no ambiente de build | Low | Med | Pinar release específica (v2.304) e baixar uma vez localmente; versionar o binário no repo |
| Linux desktop file rename quebrando handler MIME já registrado em testes manuais | Low | Low | Renomear é forward-compatible — instalador re-registra MIME; sem regressão em produção |

## Complexity tracking

> Vazio — nenhum article do constitution foi marcado FAIL.

| Article waived | Reason | Alternatives considered | Reviewer |
|---|---|---|---|
| — | — | — | — |

## Hand-off to `tasks`

A próxima skill é `tasks`. Ela consome este plano e produz `tasks.md` com ~14 tasks (T01–T14) numeradas, cada uma com seu teste RED inicial.

Pre-conditions para hand-off:

- [x] Constitution Check totalmente preenchida, sem linhas em branco.
- [x] Complexity tracking vazia e justificada.
- [x] Project structure delta detalhado e acurado.
- [x] Phases bem ordenadas (Phase 1 não toca `product.json`, então pode rodar antes mesmo de decidir T07).
