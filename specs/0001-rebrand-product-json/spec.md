# Feature specification: Rebrand para NZRCode (product.json, ícones, splash, About)

> Este arquivo é produzido pela skill `specify`. Foco em **o quê** e **por quê** — planejamento e código moram em `plan.md` e `tasks.md`.

**Branch:** `feature/0001-rebrand-product-json`
**Created:** 2026-05-14
**Status:** Draft
**Spec ID:** 0001
**Language:** pt-BR

---

<!-- section: Problem -->
## Problema

O fork ainda se apresenta como **Code - OSS / microsoft/vscode** em todos os pontos de identidade do produto: nome no launcher, ícones, About, identificadores de SO (bundle id, AppUserModelId), pasta de dados, protocolo de URL e wordmark do splash. Reutilizar essa identidade após o fork (a) confunde o usuário final que pode ter um VS Code "oficial" instalado em paralelo, (b) acopla nossa instalação ao registro de SO da Microsoft (colisão de AppId no Windows, sobrescrita de `~/.vscode-oss/` no Linux/macOS) e (c) sinaliza errado para futuros contribuidores que este repositório não é vanilla VS Code. A feature 0001 é pré-requisito de tudo que vem depois: sem identidade própria, builds paralelas, instaladores, telemetria e a UI Mission Control não têm "nome" para se ancorar.

<!-- section: Reconnaissance -->
## Reconnaissance

- **product.json (raiz)** — entry: `product.json` · auth: `none` · integration: 30+ chaves consumidas por `src/vs/platform/product/common/productService.ts` (lido em runtime via `IProductService`).
- **Ícones de aplicativo** — entry: `resources/darwin/code.icns`, `resources/linux/code.png`, `resources/win32/code_70x70.png`, `resources/win32/code_150x150.png` · auth: `none` · integration: build pipeline em `build/gulpfile.vscode.*.js` e empacotadores em `resources/linux/{debian,rpm,snap}/`, `resources/win32/inno-*.iss`, `resources/darwin/`.
- **Splash** — entry: `src/vs/workbench/contrib/splash/browser/splash.ts`, `src/vs/workbench/contrib/splash/browser/partsSplash.ts` · auth: `none` · integration: registrado em `src/vs/workbench/contrib/splash/browser/splash.contribution.ts` e variante electron em `src/vs/workbench/contrib/splash/electron-browser/splash.contribution.ts`. **Hoje o splash NÃO renderiza wordmark de produto — pinta apenas as partes do workbench em cores neutras.** Wordmark `NZR/CODE` aqui foi **adiado para a feature 0002** (decisão cl-7); a 0001 não modifica nenhum arquivo deste diretório.
- **About dialog** — entry: `src/vs/workbench/browser/parts/dialogs/dialog.ts:50` (web) e `src/vs/platform/dialogs/electron-browser/dialog.ts:22` (desktop) · auth: `none` · integration: invocado por `workbench.action.showAboutDialog` em `src/vs/workbench/browser/actions/windowActions.ts:391` e pelo menubar em `src/vs/platform/menubar/electron-main/menubar.ts:409`. O texto exibido vem de `productService.nameLong`; trocar `product.json` já reescreve o título.
- **Desktop entry / app metadata (Linux)** — entry: `resources/linux/code.desktop`, `resources/linux/code.appdata.xml` · auth: `none` · integration: placeholders `@@NAME_LONG@@`, `@@NAME_SHORT@@`, `@@NAME@@`, `@@ICON@@`, `@@EXEC@@` substituídos no build a partir de `product.json`.
- **MIME / URL handler (Linux)** — entry: `resources/linux/code-url-handler.desktop`, `resources/linux/code-workspace.xml` · auth: `none` · integration: define `application/x-@@NAME@@-workspace` — qualquer renome de `applicationName` precisa propagar pra cá ou o open-with quebra.

<!-- section: Users and stakeholders -->
## Usuários e stakeholders

- **Usuário final do NZRCode** — vê o nome do produto no launcher, dock, taskbar, título de janela, About. Quer instalar lado-a-lado com VS Code "oficial" sem colisão.
- **Engenheiro de build/empacotamento** — opera `gulp vscode-linux-x64`, `gulp vscode-darwin-x64`, instaladores Inno (Windows). Precisa que `product.json` e templates de empacotamento estejam consistentes para o build não cuspir binários com identidades mistas.
- **Futuro contribuidor** — abre o repositório e precisa ver imediatamente que **NÃO é vanilla VS Code**; sem isso, PRs erram convenção, tickets vão pro tracker errado.
- **Mantenedor do projeto (alair@suportly.com.br)** — sign-off final do brand: decide o namespace DNS, fontes, conteúdo do About, política de telemetria.

<!-- section: Success criteria -->
## Critérios de sucesso

- `product.json` contém `applicationName: "nzrcode"`, `nameShort: "NZRCode"`, `nameLong: "NZRCode"`, `dataFolderName: ".nzrcode"`, `sharedDataFolderName: ".nzrcode-shared"`, `linuxIconName: "nzrcode"`, `urlProtocol: "nzrcode"`, `darwinBundleIdentifier: "com.suportly.nzrcode"`, `win32AppUserModelId: "Suportly.NZRCode"`, e UUIDs win32 (`win32x64AppId`, `win32arm64AppId`, `win32x64UserAppId`, `win32arm64UserAppId`) regenerados — testável via `jq` sobre o arquivo.
- Após `npm run compile && ./scripts/code.sh`, o título da janela exibe "NZRCode" e o About dialog (Help → About) exibe "NZRCode <versão>" — testável por screenshot/Playwright.
- O ícone do aplicativo no Dock (macOS) / Activities (Linux) / Taskbar (Windows) é o novo asset NZRCode — testável manualmente por screenshot ou via leitura do `Info.plist` / `nzrcode.desktop` no diretório de output do build.
- Instalar NZRCode em uma máquina que já tem VS Code "oficial" não sobrescreve `~/.vscode/` nem `~/.vscode-oss/`; cria `~/.nzrcode/` separadamente — testável por integração manual.
- `grep -r "code-oss" product.json resources/ scripts/code.sh` retorna zero hits após o rebrand — testável via shell.
- Diff final NÃO toca em nenhum arquivo sob `src/vs/workbench/` nem `src/vs/platform/` — esta feature é zero-workbench-changes (splash wordmark adiado para 0002 via cl-7) — testável via `git diff --stat main..HEAD -- src/`.
- Script `build/lib/nzrcode/generate-icons.mjs` produz ícones a partir do SVG fonte de forma idempotente e reprodutível — testável via `node build/lib/nzrcode/generate-icons.mjs --check` (compara hashes dos outputs com os arquivos em `resources/`).
- Fontes JetBrains Mono (`Regular`, `Medium`, `Bold` em `.woff2`) presentes em `resources/fonts/` com licença SIL OFL 1.1 documentada em `resources/fonts/LICENSE-JetBrainsMono.txt` — testável via `ls` + verificação manual da licença.

<!-- section: Non-goals -->
## Não-goals

- Mudar paleta global de cores do workbench — escopo da feature `0002-theme-tokens-and-color-customization`.
- Substituir o Mission Control / Station UI — escopo de `0006-mission-control-shell` em diante.
- Trocar endpoints de telemetria, marketplace, ou `webviewContentExternalBaseUrlTemplate` — fora do escopo (decisão cl-9: webview CDN segue Microsoft com TODO para feature futura). `reportIssueUrl`/`licenseUrl`/`serverLicenseUrl` **são** atualizados nesta feature (decisão cl-6) — apontam para `github.com/suportly/nzrcode`.
- Remover ou reconfigurar built-in extensions (ms-vscode.js-debug etc.).
- Traduzir strings de marca além de pt-BR/en (i18n full vem depois).
- Reescrever o About dialog (layout/conteúdo extra além do nome) — se mudança de texto for além do título, vira feature separada.
- Trocar a fonte default do editor (continua sendo Monaco/Menlo); JetBrains Mono é apenas para o wordmark.
- Configurar pipeline CI/CD para publicar releases sob o novo nome — escopo de build/release, não desta feature.

<!-- section: User stories -->
## User stories

### Story 1 — Identidade no `product.json` e identificadores de SO (P1)

Como **engenheiro de build**, eu quero que `product.json` declare a identidade do NZRCode (nomes, paths de dados, identificadores de SO, protocolo de URL), para que builds gerados em qualquer plataforma se registrem no SO como NZRCode e não colidam com instalações de VS Code/Code-OSS pré-existentes.

**Cenários de aceitação** (Given/When/Then):

1. **Given** o repositório no commit de merge da feature 0001, **When** rodo `jq '.applicationName, .nameShort, .nameLong, .dataFolderName, .urlProtocol' product.json`, **Then** os valores retornam `"nzrcode"`, `"NZRCode"`, `"NZRCode"`, `".nzrcode"`, `"nzrcode"` — sem aspas extras, sem "oss".
2. **Given** o `product.json` pós-rebrand, **When** comparo `win32x64AppId`/`win32arm64AppId`/`win32x64UserAppId`/`win32arm64UserAppId` com os valores upstream do microsoft/vscode, **Then** todos quatro são UUIDs distintos (regenerados) — `diff <(jq -r '.win32x64AppId' product.json) <(curl -s https://raw.githubusercontent.com/microsoft/vscode/main/product.json | jq -r '.win32x64AppId')` retorna diferença.
3. **Given** o `product.json` pós-rebrand, **When** leio `darwinBundleIdentifier`, **Then** retorna `"com.suportly.nzrcode"` (e NÃO `com.visualstudio.code.oss`); `win32AppUserModelId` retorna `"Suportly.NZRCode"`.
4. **Given** o `product.json` pós-rebrand, **When** leio `win32MutexName`, `win32TunnelServiceMutex`, `win32TunnelMutex`, `serverApplicationName`, `serverDataFolderName`, `tunnelApplicationName`, `agentsTelemetryAppName`, **Then** todos contêm o slug `nzrcode` (não `vscodeoss`, não `code-server-oss`, não `agents`-genérico) — propaga consistência através de todas as chaves derivadas.

### Story 2 — Marca visível ao usuário final (P1)

Como **usuário final**, eu quero ver "NZRCode" e o wordmark `NZR/CODE` em toda superfície visual do aplicativo (ícone, título de janela, splash, About), para entender qual produto estou rodando sem ambiguidade.

**Cenários de aceitação** (Given/When/Then):

1. **Given** uma build local rodando via `./scripts/code.sh`, **When** observo o título da janela e o menu Help → About, **Then** ambos exibem "NZRCode" (não "Code - OSS" e não "Visual Studio Code").
2. **Given** os assets de ícone gerados pelo script `build/lib/nzrcode/generate-icons.mjs` (`resources/darwin/nzrcode.icns`, `resources/linux/nzrcode.png`, `resources/win32/nzrcode_70x70.png`, `resources/win32/nzrcode_150x150.png`), **When** abro cada um, **Then** mostram o wordmark `NZR/CODE` em JetBrains Mono com slash em âmbar `#ffa45c` sobre fundo warm dark `#0d0c0a`, no glifo principal de tamanho ≥ 256px.
3. **Given** o desktop entry Linux instalado (`resources/linux/nzrcode.desktop`), **When** rodo `grep Name= resources/linux/nzrcode.desktop` no diretório de output do build, **Then** retorna `Name=NZRCode`.
4. **Given** que esta feature explicitamente adia o wordmark no splash para a feature 0002 (decisão cl-7), **When** observo o splash na 0001 pós-merge, **Then** ele renderiza normalmente sem regressão visual (mesmo comportamento que upstream) — o wordmark NZR/CODE aparece apenas após a 0002.

### Story 3 — Coexistência com VS Code oficial (P2)

Como **desenvolvedor que já tem VS Code "oficial" instalado**, eu quero instalar NZRCode em paralelo sem que NZRCode toque na config/dados/registro do VS Code, para preservar meu ambiente atual durante a transição.

**Cenários de aceitação** (Given/When/Then):

1. **Given** uma máquina com VS Code estável já instalado, **When** instalo NZRCode (build local ou pacote), **Then** o launcher mostra duas entradas distintas com ícones diferentes ("Visual Studio Code" + "NZRCode") e abrir uma não afeta a outra.
2. **Given** NZRCode rodando pela primeira vez, **When** observo onde dados de usuário são gravados, **Then** vão para `~/.nzrcode/` (macOS/Linux) ou `%APPDATA%\NZRCode\` (Windows) — `~/.vscode/`, `~/.vscode-oss/`, `~/.config/Code/` ficam intactos.
3. **Given** clico em um link `nzrcode://...`, **When** o handler do SO resolve, **Then** abre NZRCode; um link `vscode://...` continua abrindo o VS Code oficial sem interferência.
4. **Given** uma instalação Windows do "Microsoft Code OSS" (mesma família de fork), **When** instalo NZRCode pelo Inno Setup gerado, **Then** o instalador não detecta colisão (porque os `win32*AppId` foram regenerados) e cria entry de uninstall própria.

<!-- section: Clarifications -->
## Clarifications

> Resolvidas em 2026-05-14 via skill `clarify` em auto mode. Cada decisão registra a opção escolhida + rationale; o usuário pode reverter via PR review.

- **cl-1 — Namespace DNS para identificadores nativos.** **Decidido:** `com.suportly.nzrcode`. **Rationale:** o fork vive sob a org `suportly` no GitHub (`github.com/suportly/nzrcode`); reverse-DNS deriva direto da identidade já estabelecida do mantenedor (`alair@suportly.com.br`). Propaga para `darwinBundleIdentifier` e `win32AppUserModelId = "Suportly.NZRCode"`.
- **cl-2 — Regenerar UUIDs win32.** **Decidido:** sim, regenerar os 4 (`win32x64AppId`, `win32arm64AppId`, `win32x64UserAppId`, `win32arm64UserAppId`) via `uuidgen` no momento do commit do `product.json`. **Rationale:** evita colisão de Inno Setup com instalação existente de Code-OSS na mesma máquina (story 3 cenário 4). UUIDs são fixados no commit, não regenerados a cada build.
- **cl-3 — Assets de ícone.** **Decidido:** gerar placeholders via script `build/lib/nzrcode/generate-icons.mjs` que renderiza SVG (wordmark `NZR/CODE` em JetBrains Mono, slash âmbar `#ffa45c` sobre `#0d0c0a`) e converte para `.icns`/`.png` via `sharp` (já dependência do projeto) ou `librsvg` (binário do sistema, fallback). **Rationale:** desbloqueia a feature sem aguardar entrega de design profissional; placeholders são substituíveis quando o asset final chegar trocando os arquivos em `resources/` sem mexer no script. SVG fonte fica versionada em `resources/nzrcode-brand/wordmark.svg` para referência futura.
- **cl-4 — `urlProtocol`.** **Decidido:** `"nzrcode"`. **Rationale:** consistência com `applicationName` e `dataFolderName`; `nzr` é curto mas ambíguo, `nzrcode-oss` carrega bagagem do nome upstream sem ganho.
- **cl-5 — `dataFolderName`.** **Decidido:** `".nzrcode"` (e `sharedDataFolderName: ".nzrcode-shared"`). **Rationale:** mantém o padrão dotfile do upstream sem o sufixo `-oss` que sinalizava "build não oficial da Microsoft" — aqui o produto é oficialmente NZRCode.
- **cl-6 — URLs apontando para `microsoft/vscode`.** **Decidido:** trocar agora para `github.com/suportly/nzrcode`. Afeta `reportIssueUrl`, `licenseUrl`, `serverLicenseUrl`. **Rationale:** o fork já existe em `suportly/nzrcode`; um botão "Report Issue" abrindo issues no repo Microsoft seria ativamente quebrado. `LICENSE.txt` mantém copyright Microsoft original (MIT permite), só a URL muda.
- **cl-7 — Splash wordmark.** **Decidido:** **opção (b) — ADIAR splash wordmark para feature `0002-theme-tokens-and-color-customization`**. **Rationale:** o brief explicita "No workbench changes yet — branding only" como regra arquitetural (§2.1). Editar `src/vs/workbench/contrib/splash/` agora viola essa regra e abre precedente. A feature 0002 já vai tocar workbench (registrar tema), então o wordmark de splash entra naturalmente lá. **Impacto na spec:** Story 2 cenário 3 e Critério de Sucesso #6 migram para `0002`. Splash continua funcional durante a 0001, apenas sem wordmark NZR/CODE.
- **cl-8 — Fonte JetBrains Mono.** **Decidido:** bundle local em `resources/fonts/JetBrainsMono-{Regular,Bold,Medium}.woff2`. **Rationale:** o brief lista JetBrains Mono como tipografia da UI técnica (§1) — vai ser usada em vários lugares (splash, station head, pipeline rail), não só uma vez. Bundle (~250kb total) elimina dependência de rede para renderização da marca; o tamanho é trivial perto do instalador (~80MB). Licença SIL OFL 1.1 permite redistribuição. Asset entra junto com os ícones nesta feature, **mesmo que o splash que a consome só renderize na 0002** — disponibilizar a fonte aqui evita refazer infra de assets depois.
- **cl-9 — `webviewContentExternalBaseUrlTemplate` em `vscode-cdn.net`.** **Decidido:** **manter inalterado nesta feature** + adicionar TODO comment apontando para feature futura `0XXX-cdn-migration`. **Rationale:** o template versiona webviews (`/insider/<commit>/...`); trocar exige CDN próprio com mesmo contrato e versionamento de commits — isso é uma feature de infra completa, não branding. Webviews continuam carregando do CDN da Microsoft no curto prazo (público, sem auth) e o switch é planejado mas fora de escopo aqui.
- **cl-10 — `builtInExtensions` intocados.** **Confirmado.** ms-vscode.js-debug, ms-vscode.js-debug-companion, ms-vscode.vscode-js-profile-table e GitHub.copilot* permanecem como estão. **Rationale:** remover ou trocar built-ins quebra fluxos de debug/AI e exige análise de licença/distribuição própria. Fora do escopo de uma feature de rebrand.

<!-- section: Data touched -->
## Dados tocados

- **Arquivos modificados:** `product.json` (~30 chaves), `resources/linux/code.desktop` (rename + reescrita do `Name=`), `resources/linux/code.appdata.xml`, `resources/linux/code-url-handler.desktop`, `resources/linux/code-workspace.xml`, `resources/linux/{debian,rpm,snap}/*` (paths e strings que mencionam `code-oss`), `resources/win32/inno-*.iss` (se houver referência ao AppId).
- **Arquivos novos:** `resources/darwin/nzrcode.icns`, `resources/linux/nzrcode.png` (+ tamanhos referenciados em `resources/linux/rpm/`/`debian/`), `resources/win32/nzrcode_70x70.png`, `resources/win32/nzrcode_150x150.png`, `resources/nzrcode-brand/wordmark.svg` (fonte do icon set), `resources/fonts/JetBrainsMono-Regular.woff2`, `resources/fonts/JetBrainsMono-Medium.woff2`, `resources/fonts/JetBrainsMono-Bold.woff2`, `resources/fonts/LICENSE-JetBrainsMono.txt`, `build/lib/nzrcode/generate-icons.mjs` (script de geração) e `build/lib/nzrcode/README.md` (como rodar).
- **Arquivos renomeados (não conteúdo):** `resources/linux/code.desktop` → `nzrcode.desktop`, `resources/linux/code-url-handler.desktop` → `nzrcode-url-handler.desktop`, `resources/linux/code-workspace.xml` → `nzrcode-workspace.xml`, `resources/darwin/code.icns` → `nzrcode.icns` (placeholder gerado pelo script).
- **Arquivos NÃO tocados (asserção de escopo):** **nada** em `src/vs/workbench/` e **nada** em `src/vs/platform/`. About dialog, splash, menubar, title bar — todos leem `productService.nameLong`/`nameShort` em runtime e atualizam automaticamente quando `product.json` muda. Esta é uma feature **zero-source-changes** (apenas config, recursos e build scripts).

<!-- section: Out-of-band effects -->
## Efeitos out-of-band

- **Registro de SO** (efeito direto do build, não desta feature em si): após `gulp vscode-linux-x64` rodar com o novo `product.json`, o instalador gerado registra `nzrcode` como MIME handler para `application/x-nzrcode-workspace` e `nzrcode://` URL scheme. Antes do instalador rodar, nenhum efeito out-of-band — a feature em si só altera arquivos.
- **GitHub remote** já está reapontado para `suportly/nzrcode` (não-efeito-da-feature, mas pré-requisito).
- Nenhuma chamada a third-party API, nenhuma notificação, nenhum write fora da working tree.

<!-- section: Open risks -->
## Riscos abertos

- **Risco de divergência durante rebase:** trocar `applicationName`/`win32MutexName` afeta builds em todas as plataformas. Se upstream microsoft/vscode reorganizar `product.json` antes do próximo merge, o rebase vai conflitar em ~30 linhas — toleramos isso, mas vale documentar no `plan.md`.
- **Risco de quebra silenciosa do build do empacotador Linux/Windows.** Scripts em `build/gulpfile.vscode.*.js` podem ler `product.json` em pontos que esta feature não inspecionou. Mitigação: rodar `gulp vscode-linux-x64-build` e `gulp vscode-darwin` em CI ANTES de mergear (parte do plan.md).
- **Risco em wikitext da telemetria.** `agentsTelemetryAppName: "agents"` é genérico — alterar pode quebrar telemetria que upstream usa pra ferramentas internas Copilot. Default desta feature: trocar para `nzrcode-agents`; se quebrar Copilot in-IDE, rollback isolado.
- **Risco de licença/branding.** O brief não pede para renomear strings `Microsoft` em `LICENSE.txt`/`ThirdPartyNotices.txt`. Mantemos intocados — VS Code OSS é MIT, podemos forkar a marca, mas o copyright original precisa permanecer atribuído. (Confirmar com `cl-6` se afeta `licenseUrl`.)
- **Risco de ícone com baixa qualidade.** Se `cl-3 = script`, glifos gerados via ImageMagick podem ser pixelados em tamanhos pequenos (16px favicon). Mitigação: revisão visual no PR antes do merge.

<!-- section: Traceability -->
## Traceability

- Originating issue: NZRCode Implementation Brief (`§6.1`)
- Related specs: `0002-theme-tokens-and-color-customization` (depende desta para wordmark/cor base), `0003-station-registry-service` (depende para nomes de arquivos `.nzrcode/state.json`).
- Constitution articles invoked: I (Spec-first), V (Branding/Visible scope-no-creep).
