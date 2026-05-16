# Especificação: nzrcode-bridge — controle remoto do desktop via iPad companion

> Produzida pela skill `specify`. Foco em **o que** e **por quê**; planejamento e código vão em `plan.md` e `tasks.md`.

**Branch:** `feature/0009-nzrcode-bridge`
**Created:** 2026-05-14
**Status:** Draft
**Spec ID:** 0009
**Language:** pt-BR

---

<!-- section: Problem -->
## Problema

Hoje o nzrcode roda no desktop e a única forma de operar a sessão é estar fisicamente na frente da máquina. Quando o dono do desktop está com o iPad — em reunião, no sofá, viajando — não há canal externo pra abrir um arquivo, ver um diff que o Claude acabou de produzir, mandar input pro terminal ou ser notificado de que uma task longa terminou. O app oficial do Claude Code cobre **chat com o agente**, mas não cobre **operar a instância de IDE** que está rodando localmente.

<!-- section: Reconnaissance -->
## Reconhecimento

- **extensions/** (onde a bridge vai morar como built-in) — entry: `vscode/extensions/debug-auto-launch/package.json` · padrão de extensão Node mínima: `vscode/extensions/debug-auto-launch/src/extension.ts` · auth: nenhuma (não aplicável a built-ins) · integração: `vscode/extensions/tunnel-forwarding/src/extension.ts` é o exemplo mais próximo de extensão built-in que abre porta de rede e gerencia ciclo de vida.
- **API de extensão consumida** — entry: `vscode/src/vscode-dts/vscode.d.ts` · superfícies relevantes a serem expostas via RPC: `vscode.window.activeTextEditor`, `vscode.window.createTerminal`, `vscode.commands.executeCommand`, `vscode.workspace.fs`, `vscode.tasks.*`, `vscode.debug.*` e a SCM API consumida pela extensão `vscode/extensions/git/package.json`.
- **Registro de built-ins** — entry: `vscode/product.json` (seção `builtInExtensions`) · pipeline de build: `vscode/build/gulpfile.extensions.ts` (array `compilations`) · diretório npm: `vscode/build/npm/dirs.ts`. Qualquer extensão nova precisa ser adicionada nesses três pontos pra ser empacotada.
- **Arquitetura de acesso externo** — entry: `vscode/remote/web/package.json` (modo web do servidor, contexto pra entender o que NÃO estamos fazendo) · `vscode/cli/Cargo.toml` (CLI Rust com `tunnel-forwarding` próprio que decidimos não usar nesta feature em favor de Tailscale documentado).
- **Novos diretórios (a serem criados, sem código existente)** — `companion-app/` (Expo RN) e `packages/bridge-protocol/` (tipos JSON-RPC compartilhados). Estes são surfaces criadas por esta feature; não há código pré-existente pra inspecionar.

<!-- section: Users and stakeholders -->
## Usuários e stakeholders

- **Dono do desktop nzrcode** (perfil primário) — usa nzrcode + extensão Claude Code + plugin aiadev no desktop, quer operar a sessão a partir do iPad sem migrar ferramentas.
- **Mantenedor do fork nzrcode** — extensão entra como built-in, assume custo de manutenção e overhead de startup permanente.
- **Desenvolvedor do companion-app** (você ou contratado futuro) — consome o contrato RPC desta bridge ao construir o app Expo/RN; estável-API desta spec é restrição direta no trabalho deles.

<!-- section: Success criteria -->
## Critérios de sucesso

- Pareamento iPad ↔ desktop conclui em ≤ 30s, contados do "rodar `nzrcode: Pair iPad`" até o iPad reportar estado conectado (inclui geração de QR + tempo humano de escanear). O subset "WebSocket conecta + autentica + ack" cumpre ≤ 5s.
- Operações RPC interativas (`editor.openFile`, `terminal.sendText` com ≤ 1 KB de payload) completam em ≤ 1s p95 em LAN sob carga típica interativa (até 10 RPC/s em fila, sem mensagens > 64 KB concorrentes); ≤ 2s p95 via Tailscale na mesma carga.
- Push notification de evento chave chega no iPad em ≤ 5s p95 contados do disparo no desktop, medido contra cinco eventos canônicos definidos em cl-3.
- Token de auth nunca aparece em log, em mensagem de UI, ou em arquivo com permissão diferente de `0600` no `~/.nzrcode/bridge.json`. Conteúdo de arquivos lidos por `workspace.readFile` da bridge não aparece em log do desktop em nenhum nível (`error`, `warn`, `info`, `debug`).
- Bridge extension acrescenta ≤ 50ms ao **tempo cold-start** do nzrcode em desktop classe "laptop dev" (8 vCPU, 16 GB RAM, SSD NVMe), medido como mediana de 10 execuções `time nzrcode --wait` com a extensão habilitada vs. desabilitada, em workspace vazio.

<!-- section: Non-goals -->
## Não-objetivos

**Produto (escopo de funcionalidade):**

- Editor de código rodando no iPad — esse app é controle remoto, não IDE.
- Chat com Claude no iPad (já existe app oficial; duplicar é desperdício).
- Suporte a cliente que não seja iPad (Android, web, Apple Watch) — não nesta entrega.

**Implementação (escopo técnico):**

- Solução de tunelamento embutida — Tailscale é documentado como pré-requisito; nenhum código de tunneling é shippado.
- Multi-desktop (1 iPad emparelhado com N desktops simultâneos) — fora do MVP.

<!-- section: User stories -->
## Histórias de usuário

### Story 1 — Pareamento inicial via QR (P1)

Como dono do desktop, quero parear meu iPad escaneando um QR code no nzrcode, pra evitar digitar token longo em teclado virtual.

**Cenários de aceite:**

1. Dado que a bridge extension está ativa, Quando rodo `nzrcode: Pair iPad` no command palette, Então um modal exibe um QR code que codifica `{host, port, token}` e uma instrução textual de fallback.
2. Dado que o QR está visível, Quando o iPad companion-app escaneia o QR, Então o app conecta no WebSocket, autentica com o token, e exibe `Paired with <hostname>` em ≤ 5s.
3. Dado que o token foi pareado, Quando o desktop reinicia (e o usuário não revogou explicitamente), Então o iPad reconecta automaticamente usando o token persistido, sem nova interação humana.
4. Dado que o pareamento falha (token inválido, porta fechada, host inalcançável), Quando a conexão é rejeitada, Então o iPad mostra mensagem específica do erro (não genérica) e o desktop registra o evento sem logar o token.

### Story 2 — Disparo de comandos do palette do iPad (P1)

Como dono do desktop, quero disparar qualquer comando do command palette a partir do iPad, pra rodar tasks, abrir arquivos, executar ações de extensão (incl. Claude Code) sem voltar ao desktop.

**Cenários de aceite:**

1. Dado que o iPad está pareado e a workspace tem `package.json` com script `dev`, Quando o iPad envia `commands.execute` com `workbench.action.tasks.runTask` e payload `{"task":"dev"}`, Então a task inicia no desktop e o iPad recebe ack em ≤ 1s.
2. Dado que o iPad pediu `editor.openFile` com um caminho dentro do workspace, Quando o arquivo abre, Então o iPad recebe `{editorId}` na resposta e um evento `editor.changed` posterior reflete a mudança.
3. Dado que o iPad pede `commands.execute` com um id que não existe, Quando o servidor avalia, Então responde com `error.code = "command_not_found"` e mensagem específica.
4. Dado que o iPad envia `commands.execute` com `editor.action.formatDocument` (comando que requer `activeTextEditor` não-nulo) sem editor ativo no desktop, Quando o servidor avalia, Então responde em ≤ 1s com `error.code = "no_active_editor"` (não com timeout silencioso) e a mesma resposta vale para qualquer comando da lista publicada em `packages/bridge-protocol/REQUIRES_ACTIVE_EDITOR.md`.

### Story 3 — Streaming de terminal bidirecional (P1)

Como dono do desktop, quero ler o output de um terminal do desktop e mandar input dele a partir do iPad, pra acompanhar logs e reagir (`Ctrl+C`, retry) sem voltar à máquina.

**Cenários de aceite:**

1. Dado que existe um terminal aberto no desktop, Quando o iPad chama `terminal.list`, Então recebe a lista de terminais com `{id, name, cwd}`.
2. Dado que o iPad faz `events.subscribe(["terminal.data:<id>"])`, Quando o terminal escreve no buffer, Então o iPad recebe eventos `terminal.data` com chunks de bytes em ordem.
3. Dado que o iPad envia `terminal.sendText` com `"echo hello\n"`, Quando recebido, Então o desktop injeta no PTY do terminal e o eco aparece em eventos `terminal.data` subsequentes.
4. Dado que o iPad envia `terminal.signal({terminalId, signal: "SIGINT"})`, Quando recebido, Então o servidor mapeia o sinal para o byte de controle correspondente (`\x03` para SIGINT) e injeta no PTY via `Terminal.sendText`; subsequentes eventos `terminal.data` refletem a interrupção do processo. `terminal.sendText` permanece exclusivamente para input textual; bytes de controle dentro de `sendText` **não** disparam sinais (são tratados como texto literal).

### Story 4 — Push notification em evento chave (P2)

Como dono do desktop ausente, quero receber push notification no iPad quando algo precisar da minha atenção, pra reagir sem ter o iPad ativo o tempo todo.

**Cenários de aceite:**

1. Dado que o iPad registrou seu APNs device token via `notifications.register`, Quando uma task longa termina no desktop, Então o iPad recebe push em ≤ 5s com título da task e status.
2. Dado que o usuário muta a categoria "task complete" via `notifications.preferences`, Quando uma task termina, Então nenhum push é enviado e nenhum estado é mudado no iPad.
3. **Condicionado a cl-7 resolvido** — Dado que o app no iPad foi morto (não só em background) e que existe APNs key/certificate configurado conforme a resolução de cl-7, Quando push chega, Então tocar abre o app na tela correspondente ao evento (deep link). Sem a resolução de cl-7 esta acceptance permanece bloqueada e Story 4 não é considerada implementável.
4. Dado que o iPad nunca pareou, Quando um evento chave dispara, Então nenhuma chamada APNs é feita (sem device token registrado, sem requisição).

### Story 5 — Segurança e isolamento do bind (P1)

Como dono do desktop, quero garantir que ninguém na minha rede consiga falar com a bridge sem o token, pra um intruso na rede não controlar meu editor.

**Cenários de aceite:**

1. Dado que a bridge sobe em `127.0.0.1:<porta dinâmica>`, Quando um host externo tenta conectar diretamente no IP da máquina (sem Tailscale), Então o sistema operacional recusa porque o bind é loopback-only.
2. Dado que um cliente conecta sem token ou com token inválido, Quando manda a primeira mensagem, Então a conexão é encerrada em ≤ 1s e o desktop registra `auth_failure` com `remoteAddress` mas **sem** o token tentado.
3. Dado que existe pareamento ativo com um único device (modelo MVP; comportamento sob múltiplos devices depende de cl-6), Quando o usuário roda `nzrcode: Revoke iPad`, Então todas as conexões abertas com aquele token são derrubadas em ≤ 2s e o token é invalidado (qualquer reconexão posterior com aquele token responde `auth_failure`).
4. Dado que o arquivo `~/.nzrcode/bridge.json` é criado/atualizado, Quando o estado do filesystem é verificado, Então a permissão é `0600` e o owner é o usuário do desktop.
5. Dado que o iPad pede `workspace.readFile` de um arquivo arbitrário do workspace, Quando o servidor lê e responde, Então os bytes do conteúdo **não** aparecem em nenhum log do desktop (verificado por grep do hash do payload sobre os logs em `error`/`warn`/`info`/`debug` produzidos durante o teste) — apenas metadados (path, byte count, hash truncado) são logados.

<!-- section: Clarifications -->
## Clarifications

Todas resolvidas (resolução em 2026-05-15). As decisões abaixo são vinculantes pra `plan.md` / `tasks.md` / implementação.

- **cl-1 — Sinais ao terminal:** Método RPC dedicado `terminal.signal({terminalId, signal: "SIGINT"|"SIGTERM"})`. Servidor mapeia internamente para byte de controle via `Terminal.sendText`. `terminal.sendText` permanece exclusivamente para input textual. Rationale: API explícita, testável, e mais natural numa UI touch sem tecla Ctrl.
- **cl-2 — Rotação de token:** Token persiste indefinidamente até `nzrcode: Revoke iPad` ser invocado ou o arquivo `~/.nzrcode/bridge.json` ser removido manualmente. Sem rotação automática no MVP. Rationale: Article III (YAGNI) — auto-rotação adiciona fluxo de re-pareamento sem ganho real de segurança vs revoke explícito.
- **cl-3 — Eventos canônicos do MVP (5):** (1) Task concluída com `duration ≥ 30s` (`tasks.completed`); (2) comando no terminal com `exit code != 0`, detectado via shell integration (`terminal.commandFailed`); (3) Claude Code pediu permissão de tool (`claudeCode.permissionRequest`); (4) sessão de debug parou (breakpoint, exception, step finalizado) com janela sem foco (`debug.stopped`); (5) bridge perdeu/restaurou conexão com o device pareado (`connection.changed`). PR check change, file watch alerts e git push completion ficam pra fase 2.
- **cl-4 — Endpoints no QR:** Múltiplos. QR codifica JSON `{"v":1,"token":"...","endpoints":[{"host":"<ip>","port":<n>,"net":"lan|tailscale|mdns"}, ...]}`. Bridge popula com IPv4 LAN, IP Tailscale (quando `tailscale ip -4` retorna sucesso) e hostname mDNS (quando resolvível). Cliente tenta endpoints em ordem; primeiro que conectar e autenticar vence.
- **cl-5 — Limites de payload:** (a) Request RPC único: 10 MB → excedeu retorna `error.code = "payload_too_large"`, `data.limit = 10485760`. (b) Chunk de evento `terminal.data`: 64 KB máximo; servidor fragmenta output maior em eventos sequenciais com campo `chunkSeq` monotônico. (c) Backlog outbound (cliente atrasado em ack): 5 MB agregado → conexão encerrada com `client_too_slow`; iPad reconecta automaticamente.
- **cl-6 — Multi-device:** 1 token por device. Parear segundo dispositivo (iPhone) gera token distinto via novo `nzrcode: Pair iPad`. `Revoke` é por device. Novo comando `nzrcode: List Paired Devices` enumera devices ativos com `{deviceName, pairedAt, lastSeenAt}`. Rationale: auditabilidade + revoke granular.
- **cl-7 — APNs Auth Key:** Centralizada pela suportly via componente novo `nzrcode-push-relay` (serviço HTTP/2 mínimo operado pela suportly). Bridge POSTa eventos para o relay com `{apnsToken, payload}`; relay assina JWT com a APNs key e encaminha para `api.push.apple.com`. APNs key **nunca** entra no binário do nzrcode. Quando o relay está indisponível, eventos chave caem em fallback in-band via WebSocket (entrega só se iPad estiver conectado). Rationale: APNs key compartilhada embutida no binário é liability de segurança; per-user Apple Developer é fricção inviável; relay isola a key. Custo: nova dependência de serviço operado pela suportly — registrar em "Out-of-band effects" e Article V.
- **cl-8 — Formato `terminal.data`:** Raw bytes codificados em base64 no JSON. Payload do evento: `{terminalId, chunkSeq, data: "<base64>"}`. Sem sanitização no servidor — ANSI escapes intactos, UTF-8 não validado. Cliente iPad é responsável por parsing/render (xterm.js ou react-native-terminal). Rationale: Article III, bridge é proxy fino.
- **cl-9 — Read/Write fora do workspace:** Opção D. `workspace.readFile` aceita qualquer caminho permitido pelo SO ao usuário do desktop (sujeito à Story 5 cenário 5 sobre não-logar conteúdo). `workspace.writeFile` em caminho fora de `workspace.workspaceFolders` retorna `error.code = "path_outside_workspace"`. Pra escrever fora do workspace, usuário primeiro abre o folder no nzrcode. Rationale: leitura ampla é conveniente e baixo-risco; escrita é o vetor de dano real.
- **cl-10 — bundleId companion-app:** Fixo `com.suportly.nzrcode-companion`, app publicado pela suportly como único distribuidor na App Store. Amarra cl-7 (mesmo Team ID APNs). Rationale: bundleId per-user é incompatível com App Store + APNs.
- **cl-11 — Sensibilidade do `apnsToken`:** Tratado como sensível conforme Article VI. Armazenado via `vscode.SecretStorage` (chaveiro do OS) — **não** em `globalState`. Logs redactam o valor (mostram apenas prefixo de 8 chars + `…`). Estrutura `PairedDevice` em `globalState` mantém apenas `{deviceId, deviceName, pairedAt, lastSeenAt}`; `apnsToken` referenciado por `deviceId` no SecretStorage. Rationale: token APNs identifica unicamente um device + permite envio de push; redirecionável por atacante se vazar.

<!-- section: Data touched -->
## Dados tocados

- **Novo:** `BridgeToken` — string aleatória de 256 bits gerada por `crypto.randomBytes(32)`. Persistida em `~/.nzrcode/bridge.json` com permissão `0600`.
- **Novo:** `PairedDevice` — registro `{deviceId, deviceName, pairedAt, lastSeenAt}` armazenado em `globalState` da extensão. Usado pra listar/revogar dispositivos. **Sem `apnsToken`** — esse vai pra `vscode.SecretStorage` chaveado por `deviceId` (decisão cl-11).
- **Novo:** `PairedDeviceSecret` em `vscode.SecretStorage` — chave `paired-device:<deviceId>` → valor `apnsToken`. Único componente que toca chaveiro do OS.
- **Novo:** `BridgeProtocolMessage` — JSON-RPC 2.0 envelope conforme `packages/bridge-protocol/` (a ser criado).
- **Acesso de leitura:** estado da workspace (folders, abertos), terminais ativos, source control state, tasks definidas, debug sessions.
- **Acesso de escrita:** comandos do palette (qualquer um), edições no editor, input em terminais, arquivos via `vscode.workspace.fs`.

<!-- section: Out-of-band effects -->
## Efeitos out-of-band

- Bind TCP em `127.0.0.1:<porta dinâmica>` enquanto o desktop estiver ativo.
- Chamadas HTTPS pra `nzrcode-push-relay` (serviço operado pela suportly, endpoint `https://push-relay.nzrcode.dev`) quando eventos chave disparam pra um device registrado. Relay encaminha pra `api.push.apple.com` (decisão cl-7). Bridge **não** fala direto com APNs.
- Tailscale é mencionado como caminho documentado pra acesso fora da LAN, mas **nenhuma chamada de rede a Tailscale** é feita pelo bridge (é roteamento transparente do SO). Detecção: `tailscale ip -4` via child process apenas no pairing flow pra popular endpoints do QR.
- Leitura de arquivos via `vscode.workspace.fs` (qualquer path permitido ao usuário do SO) e escrita restrita a `workspace.workspaceFolders` (decisão cl-9).

<!-- section: Open risks -->
## Riscos abertos

- API interna do VS Code pode mudar entre merges do upstream — comandos do workbench (`workbench.action.*`) não fazem parte da API estável e podem quebrar.
- `nzrcode-push-relay` é nova superfície operada pela suportly (decisão cl-7): introduz custo de hosting, SLA implícito (se o relay cai, push para), e responsabilidade de manuseio de APNs Auth Key. Mitigação: fallback in-band via WebSocket quando relay indisponível, mas isso só funciona com iPad foreground/background-active.
- Tailscale é dependência externa não controlada — usuários sem ele precisam de outra solução de túnel (não há fallback embutido).
- Built-in extension significa overhead permanente de startup, mesmo pra usuários que nunca vão usar a bridge. O critério de ≤ 50ms é meta dura.
- Token leaked via screenshot do QR ou histórico de shell — sem rotação automática (decisão cl-2), única mitigação é `Revoke` manual rápido. Aceito como risco residual no MVP.
- bundleId centralizado `com.suportly.nzrcode-companion` (decisão cl-10) significa que se a Apple suspender a conta da suportly, todos os usuários perdem o app de uma vez. Aceito por enquanto.

**Out-of-scope-but-tracked** (riscos que pertencem à spec futura do companion-app, registrados aqui pra não esquecer):

- Webviews de extensões (Claude Code chat, GitLens views) não são proxiáveis 1:1 pra um app RN nativo; o app companion pode precisar de WebView component pra alguns casos. **Não é risco desta bridge** — ela só transporta dados; é risco do consumidor.

<!-- section: Traceability -->
## Rastreabilidade

- Issue de origem: pendente — criar issue stub em https://github.com/suportly/nzrcode/issues (título sugerido: `feat(0009): nzrcode-bridge — desktop control via iPad companion`) antes de abrir o PR de implementação; vincular o número aqui quando criado. Conversação de origem: discussão direta com o dono do produto em 2026-05-14.
- Specs relacionadas: 0001 (rebrand NZRCode), 0004 (aiadev adapter), 0005 (Claude Code bridge — conceito adjacente, modelo de extensão como ponte), 0006 (mission control shell).
- Artigos da constituição invocados: I (spec-first — esta spec), II (test-first — exigirá testes pra protocolo, auth, e RPC dispatch), III (simplicity — bridge é proxy fino, sem caching ou translation layers especulativos), IV (evidence — critérios de sucesso são mensuráveis), V (provider pattern — integração APNs deve ir por interface de provider com fake pra testes), VI (privacy — manuseio de token).
