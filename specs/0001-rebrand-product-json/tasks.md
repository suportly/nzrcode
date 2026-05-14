# Tasks: Rebrand para NZRCode (product.json, ícones, splash, About)

> Produzido pela skill `tasks` a partir do `plan.md` aprovado. Consumido por `implement`.

**Branch:** `feature/0001-rebrand-product-json`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-14
**Language:** pt-BR

---

## How to read this file

- Tasks são ordenadas. `implement` roda top-to-bottom.
- Uma task = um commit. Commit message começa com o id da task.
- Cada task aponta para os cenários de aceitação do spec que exercita.
- `Status`: `pending` | `in_progress` | `blocked` | `done`. Editada pela skill `implement` dentro do commit.

## Task list

### T001 — Smoke tests da identidade da marca (RED)

- **Status:** pending
- **Depends on:** —
- **Files:**
  - create: `test/nzrcode-brand/test_product_json.sh`
  - create: `test/nzrcode-brand/test_icons_exist.sh`
  - create: `test/nzrcode-brand/test_no_residual_code_oss.sh`
  - create: `test/nzrcode-brand/test_resource_renames.sh`
  - create: `test/nzrcode-brand/run_all.sh`
  - create: `test/nzrcode-brand/README.md`
- **Spec scenarios:** Story 1 cenários 1, 2, 3, 4 · Story 2 cenários 2, 3 · Critério de Sucesso #1, #5, #6, #7, #8
- **Acceptance:**
  - [ ] Cada teste shell é executável (`+x`), usa `set -euo pipefail` e exit code 1 quando o asserto falha.
  - [ ] `test_product_json.sh` valida via `jq`: `applicationName == "nzrcode"`, `nameShort == "NZRCode"`, `nameLong == "NZRCode"`, `dataFolderName == ".nzrcode"`, `sharedDataFolderName == ".nzrcode-shared"`, `urlProtocol == "nzrcode"`, `linuxIconName == "nzrcode"`, `darwinBundleIdentifier == "com.suportly.nzrcode"`, `win32AppUserModelId == "Suportly.NZRCode"`, e que `win32MutexName`/`win32TunnelMutex`/`win32TunnelServiceMutex`/`serverApplicationName`/`serverDataFolderName`/`tunnelApplicationName`/`agentsTelemetryAppName` contêm `nzrcode`.
  - [ ] `test_product_json.sh` valida que cada UUID win32 (`win32x64AppId`, `win32arm64AppId`, `win32x64UserAppId`, `win32arm64UserAppId`) **não** é igual ao valor upstream (lista os 4 hardcoded como `EXPECTED_TO_DIFFER`).
  - [ ] `test_icons_exist.sh` confirma existência de `resources/darwin/nzrcode.icns`, `resources/linux/nzrcode.png`, `resources/win32/nzrcode_70x70.png`, `resources/win32/nzrcode_150x150.png`, `resources/nzrcode-brand/wordmark.svg`, `resources/fonts/JetBrainsMono-{Regular,Medium,Bold}.woff2`, `resources/fonts/LICENSE-JetBrainsMono.txt`.
  - [ ] `test_no_residual_code_oss.sh` roda `grep -rn 'code-oss' product.json resources/ scripts/code.sh build/linux/` e exit 1 se hit (exceto comentários com `# nzrcode-allow:code-oss-ref`).
  - [ ] `test_resource_renames.sh` confirma que `resources/linux/code.desktop`, `resources/linux/code-url-handler.desktop`, `resources/linux/code-workspace.xml`, `resources/darwin/code.icns`, `resources/linux/code.png`, `resources/win32/code_70x70.png`, `resources/win32/code_150x150.png` **não existem**.
  - [ ] `run_all.sh` invoca os 4 + exit code agregado.
  - [ ] Executar `bash test/nzrcode-brand/run_all.sh` falha (RED) com mensagens claras citando qual asserto falhou — confirmado e logado no commit.
  - [ ] Commit: `test(nzrcode-brand): T001 add brand identity smoke tests (RED)`.
- **Notes:** Estes scripts são o gate da feature; tasks subsequentes os fazem virar GREEN incrementalmente. Use `jq` (já no PATH do VS Code) e POSIX shell — sem deps Node novas.

### T002 — SVG fonte do wordmark e tokens de cor

- **Status:** pending
- **Depends on:** T001
- **Files:**
  - create: `resources/nzrcode-brand/wordmark.svg`
  - create: `resources/nzrcode-brand/colors.json`
  - create: `resources/nzrcode-brand/README.md`
  - modify: `test/nzrcode-brand/test_icons_exist.sh` (adiciona check de hash determinístico do SVG)
- **Spec scenarios:** Story 2 cenário 2
- **Acceptance:**
  - [ ] `wordmark.svg` desenha "NZR/CODE" com slash `/` em `#ffa45c`, letras em `#ece6dd`, fundo `#0d0c0a`. `viewBox` quadrado 1024×1024. Texto convertido para path (`<path>` em vez de `<text>`) para renderização determinística sem dependência da fonte estar no path do renderer.
  - [ ] `colors.json` declara os 4 tokens: `{ "bg": "#0d0c0a", "fg": "#ece6dd", "accent": "#ffa45c", "accentLine": "rgba(255,164,92,0.28)" }`.
  - [ ] Test `test_icons_exist.sh` (atualizado) verifica SHA-256 do SVG contra valor fixado.
  - [ ] Commit: `feat(brand): T002 add NZR/CODE wordmark SVG source + color tokens`.
- **Notes:** Use `fonttools` ou Inkscape CLI localmente para converter glyphs em path antes do commit. Não precisa ser pixel-perfect — a marca placeholder pode ser refinada em PR futuro.

### T003 — Script `generate-icons.mjs` (write + check modes)

- **Status:** pending
- **Depends on:** T002
- **Files:**
  - create: `build/lib/nzrcode/generate-icons.mjs`
  - create: `build/lib/nzrcode/README.md`
  - modify: `test/nzrcode-brand/test_icons_exist.sh` (adiciona invocação `node generate-icons.mjs --check`)
- **Spec scenarios:** Story 2 cenário 2 · Critério de Sucesso #7
- **Acceptance:**
  - [ ] Script ESM puro (`.mjs`). Usa apenas `sharp` (já em `package.json`) + Node built-ins. **Sem nova dependência NPM.**
  - [ ] Flag `--write`: lê `resources/nzrcode-brand/wordmark.svg`, gera `.icns` (composição PNG 16/32/64/128/256/512), `.png` Linux 512×512, `.png` Windows 70/150 nos paths declarados no plan.
  - [ ] Flag `--check`: regenera em memória, compara SHA-256 com arquivos no disco. Exit 1 com mensagem `"<path>: expected <sha>, got <sha>"` se diverge.
  - [ ] Output determinístico (sharp com `compressionLevel: 9`, sem metadata variável).
  - [ ] `build/lib/nzrcode/README.md` documenta uso.
  - [ ] Commit: `feat(brand): T003 add deterministic icon generation script`.
- **Notes:** `.icns` macOS: sharp não gera direto — escreva o container ICNS manualmente (header + chunks `ic07/ic08/ic09/ic10/ic11/ic12/ic13/ic14`). ~50 LOC. **NÃO** use `iconutil` (binário macOS-only, quebra Linux/Windows build).

### T004 — Fontes JetBrains Mono + licença

- **Status:** pending
- **Depends on:** —
- **Files:**
  - create: `resources/fonts/JetBrainsMono-Regular.woff2`
  - create: `resources/fonts/JetBrainsMono-Medium.woff2`
  - create: `resources/fonts/JetBrainsMono-Bold.woff2`
  - create: `resources/fonts/LICENSE-JetBrainsMono.txt`
  - create: `resources/fonts/README.md`
  - modify: `.gitattributes` (marcar `*.woff2` como `binary`)
- **Spec scenarios:** Story 2 cenário 2 · Critério de Sucesso #8
- **Acceptance:**
  - [ ] Três `.woff2` da release oficial JetBrains Mono v2.304 (`https://github.com/JetBrains/JetBrainsMono/releases/tag/v2.304`).
  - [ ] `LICENSE-JetBrainsMono.txt` contém texto integral da SIL OFL 1.1.
  - [ ] `resources/fonts/README.md` registra versão (2.304), data, URL fonte, licença.
  - [ ] `.gitattributes` linha `*.woff2 binary`.
  - [ ] Commit: `feat(brand): T004 bundle JetBrains Mono v2.304 (SIL OFL 1.1)`.
- **Notes:** Paralelizável com T002/T003 — arquivos disjuntos.

### T005 — CREDITS.md com atribuição do fork e da fonte

- **Status:** pending
- **Depends on:** T004
- **Files:**
  - create: `CREDITS.md`
- **Spec scenarios:** Constitution Article VII
- **Acceptance:**
  - [ ] Seções: "Upstream — Visual Studio Code OSS" (link microsoft/vscode, MIT, copyright em `LICENSE.txt`), "Font — JetBrains Mono v2.304" (link, SIL OFL 1.1, link para `resources/fonts/LICENSE-JetBrainsMono.txt`).
  - [ ] Datas, versões, URLs concretos.
  - [ ] Commit: `docs(brand): T005 add CREDITS.md attributing upstream fork and JetBrains Mono`.

### T006 — Gerar ícones binários (icns/png) via script

- **Status:** pending
- **Depends on:** T002, T003
- **Files:**
  - create: `resources/darwin/nzrcode.icns`
  - create: `resources/linux/nzrcode.png`
  - create: `resources/win32/nzrcode_70x70.png`
  - create: `resources/win32/nzrcode_150x150.png`
- **Spec scenarios:** Story 2 cenário 2
- **Acceptance:**
  - [ ] `node build/lib/nzrcode/generate-icons.mjs --write` exit 0, produz os 4 arquivos.
  - [ ] `node build/lib/nzrcode/generate-icons.mjs --check` exit 0 (idempotência).
  - [ ] Verificação visual manual: cada arquivo abre em viewer e mostra wordmark.
  - [ ] Commit: `feat(brand): T006 generate platform icons from wordmark SVG`.

### T007 — Reescrever product.json com identificadores NZRCode

- **Status:** pending
- **Depends on:** T006
- **Files:**
  - modify: `product.json`
- **Spec scenarios:** Story 1 cenários 1, 2, 3, 4 · Story 3 cenário 2 · Critério de Sucesso #1
- **Acceptance:**
  - [ ] Mudanças (old → new):
    - `nameShort: "Code - OSS"` → `"NZRCode"`
    - `nameLong: "Code - OSS"` → `"NZRCode"`
    - `applicationName: "code-oss"` → `"nzrcode"`
    - `dataFolderName: ".vscode-oss"` → `".nzrcode"`
    - `sharedDataFolderName: ".vscode-oss-shared"` → `".nzrcode-shared"`
    - `win32MutexName: "vscodeoss"` → `"nzrcode"`
    - `win32DirName: "Microsoft Code OSS"` → `"NZRCode"`
    - `win32NameVersion: "Microsoft Code OSS"` → `"NZRCode"`
    - `win32RegValueName: "CodeOSS"` → `"NZRCode"`
    - `win32x64AppId`, `win32arm64AppId`, `win32x64UserAppId`, `win32arm64UserAppId` → 4 novos UUIDs via `uuidgen`
    - `win32AppUserModelId: "Microsoft.CodeOSS"` → `"Suportly.NZRCode"`
    - `win32ShellNameShort: "C&ode - OSS"` → `"NZRC&ode"`
    - `win32TunnelServiceMutex: "vscodeoss-tunnelservice"` → `"nzrcode-tunnelservice"`
    - `win32TunnelMutex: "vscodeoss-tunnel"` → `"nzrcode-tunnel"`
    - `darwinBundleIdentifier: "com.visualstudio.code.oss"` → `"com.suportly.nzrcode"`
    - `darwinProfileUUID`, `darwinProfilePayloadUUID` → 2 novos UUIDs
    - `linuxIconName: "code-oss"` → `"nzrcode"`
    - `serverApplicationName: "code-server-oss"` → `"nzrcode-server"`
    - `serverDataFolderName: ".vscode-server-oss"` → `".nzrcode-server"`
    - `tunnelApplicationName: "code-tunnel-oss"` → `"nzrcode-tunnel"`
    - `urlProtocol: "code-oss"` → `"nzrcode"`
    - `agentsTelemetryAppName: "agents"` → `"nzrcode-agents"`
    - `reportIssueUrl` → `"https://github.com/suportly/nzrcode/issues/new"`
    - `licenseUrl` → `"https://github.com/suportly/nzrcode/blob/main/LICENSE.txt"`
    - `serverLicenseUrl` → `"https://github.com/suportly/nzrcode/blob/main/LICENSE.txt"`
  - [ ] **Intocados:** `webviewContentExternalBaseUrlTemplate` (cl-9), `builtInExtensions` (cl-10), `defaultChatAgent`, `trustedExtensionAuthAccess`, `onboardingKeymaps`, `onboardingThemes`, `builtInExtensionsEnabledWithAutoUpdates`, `sessionsWindowAllowedExtensions`.
  - [ ] Comment TODO acima de `webviewContentExternalBaseUrlTemplate`: `// nzrcode-allow:code-oss-ref TODO(0XXX-cdn-migration): switch to nzrcode CDN`.
  - [ ] `node -e "JSON.parse(require('fs').readFileSync('product.json'))"` exit 0.
  - [ ] `bash test/nzrcode-brand/test_product_json.sh` passa (GREEN).
  - [ ] Commit: `feat(brand): T007 rewrite product.json identifiers for NZRCode`. Body lista os 4 UUIDs win32 + os 2 darwin para audit trail.

### T008 — Validar smoke tests GREEN

- **Status:** pending
- **Depends on:** T006, T007
- **Files:** none (execução)
- **Spec scenarios:** Story 1 cenários 1–4 · Story 2 cenário 2
- **Acceptance:**
  - [ ] `bash test/nzrcode-brand/run_all.sh` exit 0 — 4 sub-testes GREEN.
  - [ ] Saída colada no commit body.
  - [ ] Commit: `test(brand): T008 confirm brand identity smoke tests pass (GREEN)`.

### T009 — Renomear Linux desktop entries

- **Status:** pending
- **Depends on:** T008
- **Files:**
  - rename: `resources/linux/code.desktop` → `resources/linux/nzrcode.desktop`
  - rename: `resources/linux/code-url-handler.desktop` → `resources/linux/nzrcode-url-handler.desktop`
  - rename: `resources/linux/code-workspace.xml` → `resources/linux/nzrcode-workspace.xml`
- **Spec scenarios:** Story 2 cenário 3 · Story 3 cenário 1
- **Acceptance:**
  - [ ] `git mv` (preserva history).
  - [ ] Conteúdo inalterado — placeholders `@@...@@` mantidos.
  - [ ] `bash test/nzrcode-brand/test_resource_renames.sh` passa para essa fatia.
  - [ ] Commit: `refactor(brand): T009 rename Linux desktop entries to nzrcode prefix`.

### T010 — Atualizar referências em build/ e resources/

- **Status:** pending
- **Depends on:** T009
- **Files:**
  - modify: `build/linux/**/*`
  - modify: `resources/linux/debian/**/*`
  - modify: `resources/linux/rpm/**/*`
  - modify: `resources/linux/snap/**/*`
  - modify: `resources/win32/inno-*.iss` (se referenciar PNGs por nome)
  - modify: `gulpfile.mjs` ou `build/gulpfile.vscode.linux.js` (se contém path antigo)
- **Spec scenarios:** Critério de Sucesso #5
- **Acceptance:**
  - [ ] `grep -rn 'code\.desktop\|code-url-handler\.desktop\|code-workspace\.xml\|code\.png\|code_70x70\.png\|code_150x150\.png\|code\.icns' build/ resources/ scripts/ gulpfile.mjs` retorna **zero hits**.
  - [ ] `bash test/nzrcode-brand/test_no_residual_code_oss.sh` continua GREEN.
  - [ ] Commit: `chore(build): T010 update build scripts to reference renamed nzrcode resources`.
- **Notes:** Se diff > 200 linhas, split em T010a (debian/rpm/snap) + T010b (gulp/inno).

### T011 — Atualizar appdata.xml

- **Status:** pending
- **Depends on:** T010
- **Files:**
  - rename + modify: `resources/linux/code.appdata.xml` → `resources/linux/nzrcode.appdata.xml`
- **Spec scenarios:** Story 2 cenário 3
- **Acceptance:**
  - [ ] `git mv` + edit.
  - [ ] `<id>`, `<name>`, `<summary>`, `<launchable>` atualizados para `nzrcode`/`NZRCode`.
  - [ ] `<provides><binary>` aponta para `nzrcode`.
  - [ ] `bash test/nzrcode-brand/run_all.sh` continua GREEN.
  - [ ] Commit: `refactor(brand): T011 update appdata.xml for NZRCode`.

### T012 — Build dev: `npm run compile` + `./scripts/code.sh`

- **Status:** pending
- **Depends on:** T011
- **Files:** none (execução)
- **Spec scenarios:** Story 2 cenário 1 · Critério de Sucesso #2
- **Acceptance:**
  - [ ] `npm install` completo (registra tempo no commit).
  - [ ] `npm run compile` completo.
  - [ ] `./scripts/code.sh --user-data-dir=/tmp/nzrcode-test --extensions-dir=/tmp/nzrcode-ext` abre; título exibe "NZRCode".
  - [ ] Help → About exibe "NZRCode <versão>".
  - [ ] Screenshot anexado: `specs/0001-rebrand-product-json/evidence/about-dialog.png`.
  - [ ] Commit: `test(brand): T012 verify dev build shows NZRCode in title and About`.
- **Notes:** Se `npm install` falhar (gyp/electron-rebuild), registrar e seguir; não bloqueia T013/T014 individualmente.

### T013 — Gulp build truncado: `gulp vscode-linux-x64-min-ci`

- **Status:** pending
- **Depends on:** T011
- **Files:** none (execução)
- **Spec scenarios:** Story 1 cenário 1 · Critério de Sucesso #3
- **Acceptance:**
  - [ ] `npx gulp vscode-linux-x64-min-ci 2>&1 | tee /tmp/nzrcode-gulp.log` exit 0.
  - [ ] Log não contém `ENOENT` para `code.desktop`/`code.png`/`code_*.png`.
  - [ ] `.build/linux/x64/min/` (ou equivalente) tem `nzrcode.desktop` e ícones nzrcode.
  - [ ] Commit: `test(brand): T013 verify gulp linux pipeline accepts renamed resources`.

### T014 — Capturar evidence visual

- **Status:** pending
- **Depends on:** T012, T013
- **Files:**
  - create: `specs/0001-rebrand-product-json/evidence/about-dialog.png`
  - create: `specs/0001-rebrand-product-json/evidence/launcher-icon.png`
  - create: `specs/0001-rebrand-product-json/evidence/window-title.png`
  - create: `specs/0001-rebrand-product-json/evidence/run_all_output.txt`
- **Spec scenarios:** Story 2 cenários 1, 2 · Story 3 cenário 1
- **Acceptance:**
  - [ ] 3 PNGs ≤ 1MB cada.
  - [ ] `run_all_output.txt` é stdout/stderr de `bash test/nzrcode-brand/run_all.sh`.
  - [ ] Commit: `docs(brand): T014 add visual evidence for rebrand PR`.

## Parallelization hints

- Parallel group A (Phase 1, deps disjuntas): **T002**, **T004**.
- Parallel group B (Phase 4): **T012**, **T013** — saídas isoladas.
- Serial: T001 antes de tudo; T003 depende de T002; T006 depende de T002+T003; T007 depende de T006; T008–T011 estritamente serial; T014 último.

## Post-task checklist

After every task:

- [ ] Commit references task id (`Txxx`).
- [ ] Status flipped `pending` → `done` neste arquivo.
- [ ] `bash test/nzrcode-brand/run_all.sh` não regride (após T001 existir).

After all tasks:

- [ ] `bash test/nzrcode-brand/run_all.sh` GREEN.
- [ ] `analyze` skill reporta zero drift vs spec/plan.
- [ ] Hand off para `requesting-code-review` para abrir PR contra `main`.
