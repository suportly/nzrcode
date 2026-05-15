# Implementation plan: nzrcode-bridge

> Produzido pela skill `plan` a partir de `spec.md` aprovada. Este arquivo descreve **como** a spec será realizada. Detalhamento por task vai em `tasks.md`.

**Branch:** `feature/0009-nzrcode-bridge`
**Date:** 2026-05-15
**Spec:** [spec.md](./spec.md)
**Plan version:** 1
**Language:** pt-BR

---

## Summary

Implementaremos a **bridge extension** built-in (`vscode/extensions/nzrcode-bridge/`) que abre um WebSocket JSON-RPC em `127.0.0.1`, autentica clientes por token, expõe namespaces RPC (`workspace`, `editor`, `terminal`, `commands`, `scm`, `tasks`, `debug`, `notifications`) e dispara push pelo `nzrcode-push-relay` quando configurado, com fallback in-band. Os tipos do protocolo vivem como **módulo interno** em `vscode/extensions/nzrcode-bridge/src/protocol/` (não em pacote separado — decisão de topologia em 2026-05-15, ver ADR-1). Trabalho dividido em 7 fases / 38 tasks (T001–T038) ao longo de ~5–6 semanas full-time.

**Fora do escopo deste plan** (terão specs próprias): o companion-app iPad (spec 0010 futura), o serviço `nzrcode-push-relay` operado pela suportly (repo separado), e a eventual extração do `protocol/` em pacote npm publicado quando o companion-app precisar consumir os tipos cross-repo.

## Technical context

| Field | Value |
|---|---|
| Active preset | `lean` (framework-only, sem stack opinion) |
| Language / runtime | TypeScript 5.x + Node 22.x (extension host do VS Code) |
| Primary dependencies | `ws ^8.19.0` (já presente em `vscode/package.json`), `qrcode-generator` (a adicionar, MIT, ~12 KB, render no webview) |
| Storage | `vscode.SecretStorage` (apnsToken por device), `vscode.Memento.globalState` (PairedDevice metadata), `~/.nzrcode/bridge.json` perm 0600 (token + última porta) |
| Testing framework | Mocha + assert/strict (padrão de extensões built-in do fork) — unit em `src/test/unit/`, integration via `@vscode/test-electron` em `src/test/integration/` |
| Target platform(s) | Desktop (Electron host), todos os SOs onde o nzrcode roda |
| Performance budget | Cold-start overhead ≤ 50ms (mediana de 10 runs em workspace vazio); RPC interativo p95 ≤ 1s LAN / ≤ 2s Tailscale sob 10 RPC/s |
| Security considerations | Bind loopback-only; token 256-bit random; constant-time compare; arquivo 0600; SecretStorage pra apnsToken; logs redactam token e conteúdo de arquivos (Article VI) |

## Constitution check

| Article | Applies? | Status | Evidence |
|---|---|---|---|
| I. Spec-first | Yes | PASS | `spec.md` aprovada por `spec-document-reviewer` em 2026-05-14, 11 clarifications resolvidas em 2026-05-15 |
| II. Test-first | Yes | PASS | Cada task em `tasks.md` começa por test escrito antes do código (T-RED → T-IMPL → T-GREEN → commit) |
| III. Simplicity | Yes | PASS | Bridge é proxy fino sem caching/translation; namespaces RPC são wrappers diretos sobre Extension API; sem abstrações sem segundo caller |
| IV. Evidence over claims | Yes | PASS | Transcripts de `mocha` e `vscode-test` salvos em `specs/0009-nzrcode-bridge/evidence/` |
| V. Provider pattern | Yes | PASS | Push delivery atrás de `IPushProvider` com `RelayPushProvider`, `InBandPushProvider` e `FakePushProvider` (testes) |
| VI. Privacy by design | Yes | PASS | Token via constant-time compare, nunca logado; apnsToken em `SecretStorage`; conteúdo de `workspace.readFile` jamais em log (verificado por test) |
| VII. Attribution | Yes | PASS | `qrcode-generator` (MIT) entra em `CREDITS.md` com link e licença |

## Architecture decisions

### ADR-1 — Escopo: bridge extension contendo protocol module interno

**Decision:** Este plan cobre **só** `vscode/extensions/nzrcode-bridge/`. O protocolo vive em `src/protocol/` como módulo interno da extensão (não em pacote npm separado). Companion-app iPad, push-relay e extração futura do protocol para npm são fora-de-escopo.

**Rationale:** Descobrimos em 2026-05-15 que o diretório `nzrcode/` (pai de `vscode/`) **não** é git-versionado — só `vscode/` é. A ideia original "monorepo no parent" exigiria git-init no parent + tratar `vscode/` como submodule, o que complica os merges de upstream do VS Code (que vem da Microsoft). Manter um único repo (o do fork `vscode/`) e colocar o protocol como módulo interno respeita YAGNI: hoje só a extensão consome o tipo; quando a companion-app surgir (spec 0010), extraímos.

**Trade-offs:** Quando a companion-app for construída, precisaremos duplicar os tipos ou extrair o módulo pra um pacote publicado. Aceito — custo pequeno e atrasado, vs custo grande agora de fazer git submodule.

### ADR-2 — JSON-RPC 2.0 sobre WebSocket com framing custom

**Decision:** Usar `ws ^8.19.0` (já dep) + framing JSON-RPC 2.0 implementado no pacote `packages/bridge-protocol/`. Não usar `vscode-jsonrpc` (não é dep do fork, ~80 KB, traz ceremonial de LSP desnecessário).

**Rationale:** O contrato é simples: envelope `{jsonrpc, id?, method, params}` + resposta `{jsonrpc, id, result|error}` + notificações sem `id`. Implementar em ~150 linhas no pacote compartilhado mantém tudo testável e versionável. JSON-RPC nos dá ids correlacionáveis, error codes padronizados, e suporte nativo a notifications (eventos server→client).

**Trade-offs:** Não há "negociação de capabilities" como LSP — clientes mais antigos podem chamar métodos desconhecidos. Mitigação: campo `serverVersion` no `hello` da pairing response; cliente pode degradar comportamento.

### ADR-3 — Descoberta de endpoints no QR via `os.networkInterfaces()` + `tailscale ip -4`

**Decision:** No momento do `nzrcode: Pair iPad`, o bridge enumera endpoints disponíveis: (a) `os.networkInterfaces()` filtrando IPv4 não-loopback (cobre LAN e mDNS implicitamente), (b) child-process `tailscale ip -4` com timeout 500ms — se sucesso, adiciona como endpoint `net: "tailscale"`. Cliente tenta em ordem.

**Rationale:** Atende cl-4 (múltiplos endpoints) sem dependência nova. Tailscale CLI é o caminho oficial documentado (Tailscale própria docs); falha silenciosa quando não instalado.

**Trade-offs:** Se o usuário tiver IPv6-only Tailscale, perdemos a detecção (filtramos `-4`). Aceito; IPv6 fica pra fase 2.

### ADR-4 — Lazy WebSocket bind: só sobe servidor quando há pairing ativo

**Decision:** Na activation da extensão, se `~/.nzrcode/bridge.json` existir e for válido, sobe o WS. Senão, fica idle até o usuário rodar `nzrcode: Pair iPad`. Quando `Revoke` zera todos os pareamentos, derruba o server.

**Rationale:** Cumpre o budget de cold-start ≤ 50ms (a parte cara do WS — `ws.Server` + bind — só roda quando necessário). Usuários que nunca usam a bridge não pagam custo de runtime depois do startup.

**Trade-offs:** Activation continua tocando o filesystem (`fs.stat ~/.nzrcode/bridge.json`). Custo medido em testes prévios de extensão similar (`debug-auto-launch`): < 5ms. Aceito.

### ADR-5 — Push delivery via `IPushProvider` (Article V)

**Decision:** Interface `IPushProvider { send(devices: PairedDevice[], event: PushEvent): Promise<void> }`. Implementações: `RelayPushProvider` (HTTPS POST pro nzrcode-push-relay com timeout 3s), `InBandPushProvider` (envia notification JSON-RPC pra clientes WS conectados), `FakePushProvider` (testes; grava chamadas em buffer in-memory). `pushDispatcher.ts` tenta `RelayPushProvider` primeiro; se falhar ou timeout, cai pra `InBandPushProvider`.

**Rationale:** Article V exige provider pattern pra qualquer serviço externo (APNs aqui). Fake habilita testes determinísticos sem mockar `fetch`.

**Trade-offs:** Adicional ~80 linhas de boilerplate vs chamar fetch direto. Aceito por mandate constitucional.

### ADR-6 — Tokens de auth via `crypto.randomBytes(32)` + constant-time compare

**Decision:** Token = 32 bytes random, base64url-encoded (43 chars). Persistido em `~/.nzrcode/bridge.json` com `fs.chmod(0o600)`. Validation usa `crypto.timingSafeEqual` sobre o decode binário.

**Rationale:** Padrão mínimo de Article VI; `==` em strings de token é timing-attack viável.

**Trade-offs:** Nenhum relevante.

**Ciclo de vida do token:** Gerado uma vez na primeira activation que precisa do servidor (lazy bind ADR-4). Persistido em `~/.nzrcode/bridge.json`. **Regenerado somente** no `nzrcode: Revoke iPad` (cl-2) ou se o arquivo for removido manualmente. Sem rotação automática, sem TTL.

## Project structure changes

```text
vscode/                                                             (único git repo — fork)
├── extensions/
│   └── nzrcode-bridge/                                             (new built-in extension)
│       ├── src/
│       │   ├── extension.ts                                        (new — activation + lifecycle)
│       │   ├── protocol/                                           (new — módulo interno, sem package separado)
│       │   │   ├── index.ts                                        (new — re-export público)
│       │   │   ├── jsonrpc.ts                                      (new — envelope types + frame/unframe)
│       │   │   ├── methods.ts                                      (new — method names + payload types)
│       │   │   ├── events.ts                                       (new — event names + payload types)
│       │   │   ├── errors.ts                                       (new — error codes)
│       │   │   └── qr.ts                                           (new — QR payload v1 schema)
│       │   ├── server/
│       │   │   ├── wsServer.ts                                     (new)
│       │   │   ├── auth.ts                                         (new — token gen/validate)
│       │   │   ├── dispatcher.ts                                   (new — RPC routing)
│       │   │   ├── messageQueue.ts                                 (new — backlog + client_too_slow)
│       │   │   └── state.ts                                        (new — bridge.json loader)
│       │   ├── pairing/
│       │   │   ├── qrModal.ts                                      (new — webview)
│       │   │   ├── endpoints.ts                                    (new — LAN + Tailscale discovery)
│       │   │   ├── pairedDevices.ts                                (new — PairedDevice + SecretStorage)
│       │   │   ├── pairCommand.ts                                  (new)
│       │   │   ├── listCommand.ts                                  (new)
│       │   │   └── revokeCommand.ts                                (new)
│       │   ├── rpc/
│       │   │   ├── workspace.ts                                    (new)
│       │   │   ├── editor.ts                                       (new)
│       │   │   ├── terminal.ts                                     (new — incl. terminal.signal)
│       │   │   ├── commands.ts                                     (new)
│       │   │   ├── scm.ts                                          (new)
│       │   │   ├── tasks.ts                                        (new)
│       │   │   ├── debug.ts                                        (new)
│       │   │   ├── system.ts                                       (new — system.hello)
│       │   │   └── notifications.ts                                (new — apnsToken register, prefs)
│       │   ├── events/
│       │   │   ├── publisher.ts                                    (new — subscribe + filter)
│       │   │   └── canonical.ts                                    (new — 5 canonical event wirings)
│       │   ├── push/
│       │   │   ├── IPushProvider.ts                                (new — Article V interface)
│       │   │   ├── fakePushProvider.ts                             (new)
│       │   │   ├── relayPushProvider.ts                            (new)
│       │   │   ├── inBandPushProvider.ts                           (new)
│       │   │   └── pushDispatcher.ts                               (new — fallback chain)
│       │   ├── logging.ts                                          (new — token redact, content hash)
│       │   └── test/                                               (new — mocha unit + vscode-test integration)
│       │       ├── unit/
│       │       │   ├── protocol/                                   (jsonrpc, methods, errors, qr)
│       │       │   ├── auth.test.ts
│       │       │   ├── dispatcher.test.ts
│       │       │   ├── messageQueue.test.ts
│       │       │   ├── endpoints.test.ts
│       │       │   ├── pairedDevices.test.ts
│       │       │   ├── logging.test.ts
│       │       │   ├── pushDispatcher.test.ts
│       │       │   └── fakePushProvider.test.ts
│       │       └── integration/
│       │           ├── handshake.test.ts
│       │           ├── pairing.test.ts
│       │           ├── rpc-editor.test.ts
│       │           ├── rpc-terminal.test.ts
│       │           ├── rpc-commands.test.ts
│       │           ├── push-events.test.ts
│       │           └── e2e.test.ts
│       ├── REQUIRES_ACTIVE_EDITOR.md                               (new — list per cl-1 / Story 2 cenário 4)
│       ├── README.md                                               (new)
│       ├── media/
│       │   ├── icon.png                                            (new)
│       │   └── qr-webview.html                                     (new — minimal QR render)
│       ├── package.json                                            (new)
│       ├── package.nls.json                                        (new — strings)
│       ├── tsconfig.json                                           (new)
│       └── esbuild.mts                                             (new)
├── product.json                                                    (modify — add to bundledExtensions list)
├── build/
│   ├── gulpfile.extensions.ts                                      (modify — append to compilations)
│   └── npm/dirs.ts                                                 (modify — append 'extensions/nzrcode-bridge')
├── test/nzrcode-bridge/                                            (new — smoke + bench scripts)
│   ├── run_all.sh
│   ├── test_files_exist.sh
│   ├── test_no_new_deps_root.sh
│   ├── test_built_in_registration.sh
│   ├── bench_cold_start.sh
│   └── README.md
└── CREDITS.md                                                      (modify — add qrcode-generator MIT entry)
```

## Phase breakdown

> Cada fase é um checkpoint com smoke test verde antes de avançar.

### Phase 1 — Extension skeleton + protocol module

Scaffold da extensão + tipos do protocolo como módulo interno (`src/protocol/`). Sem WS ainda.

- T001 — Scaffold `vscode/extensions/nzrcode-bridge/` (package.json, tsconfig, esbuild.mts, src/extension.ts mínimo, media/icon.png) seguindo padrão de `debug-auto-launch`
- T002 — `package.nls.json` + `contributes.commands` no package.json (Pair iPad, List Paired Devices, Revoke iPad)
- T003 — Registrar nos build targets: `product.json` (bundledExtensions), `build/gulpfile.extensions.ts` (compilations), `build/npm/dirs.ts`
- T004 — Protocol: JSON-RPC envelope types + framing em `src/protocol/jsonrpc.ts` (TDD)
- T005 — Protocol: Method/Event registries em `src/protocol/methods.ts` + `src/protocol/events.ts` (TDD)
- T006 — Protocol: Error codes em `src/protocol/errors.ts` (TDD de tabela)
- T007 — Protocol: QR payload v1 schema em `src/protocol/qr.ts` (TDD)

### Phase 2 — Auth + persistence

- T008 — `src/server/auth.ts` com `generateToken()` + `validateToken()` constant-time (TDD)
- T009 — `src/logging.ts` redactando token e hashes de conteúdo (TDD)
- T010 — `src/server/state.ts` lê/cria `~/.nzrcode/bridge.json` com perm 0600, TDD via tmp dir; activation chama mas não binda WS ainda
- T011 — `src/pairing/pairedDevices.ts` integrando `vscode.SecretStorage` + `globalState` (TDD)

### Phase 3 — WebSocket server + dispatcher

WS server liga, valida token, roteia para handler stub.

- T012 — `src/server/wsServer.ts` bind 127.0.0.1:porta dinâmica com `ws ^8.19.0` (TDD)
- T013 — `src/server/dispatcher.ts` recebe JSON-RPC, valida, roteia para namespace registry (TDD)
- T014 — `src/server/messageQueue.ts` backlog + `client_too_slow` (TDD: simular cliente lento)
- T015 — Handler `src/rpc/system.ts` (`system.hello` retorna `{serverVersion, capabilities}`)
- T016 — Lazy WS bind + integration smoke (handshake round-trip via `@vscode/test-electron`)

### Phase 4 — RPC namespaces (vertical slice)

Implementar cada namespace conforme contrato. Cada um TDD na ordem: unit handler → integration test.

- T017 — `src/rpc/commands.ts` (`execute`, `list`) + `REQUIRES_ACTIVE_EDITOR.md`
- T018 — `src/rpc/workspace.ts` (`listFolders`, `findFiles`, `readFile`, `writeFile` — incluindo restrição cl-9)
- T019 — `src/rpc/editor.ts` (`openFile`, `getActive`, `applyEdit`, `setSelection`, `revealLine`)
- T020 — `src/rpc/terminal.ts` (`list`, `sendText`, `signal`)
- T021 — `src/events/publisher.ts` + `terminal.data` chunked streaming
- T022 — `src/rpc/scm.ts` (`status`, `diff`, `stage`, `commit`)
- T023 — `src/rpc/tasks.ts` (`list`, `run`, `cancel`)
- T024 — `src/rpc/debug.ts` (`start`, `stop`, `breakpointAdd`, `variables`)
- T025 — `src/rpc/notifications.ts` (`register`, `unregister`, `preferences`) com mute test

### Phase 5 — Pairing UX

- T026 — `src/pairing/endpoints.ts` enumerando LAN + Tailscale via `execFile('tailscale','ip','-4')` (TDD)
- T027 — `src/pairing/qrModal.ts` webview com assertion estrutural no payload (não snapshot)
- T028 — `src/pairing/pairCommand.ts` orquestra `state → endpoints → QR → wait → register`
- T029 — `src/pairing/listCommand.ts` + `src/pairing/revokeCommand.ts`

### Phase 6 — Push notifications + provider

- T030 — `src/push/IPushProvider.ts` interface + `src/push/fakePushProvider.ts` (TDD)
- T031 — `src/push/relayPushProvider.ts` POST pra `https://push-relay.nzrcode.dev` com timeout (TDD)
- T032 — `src/push/inBandPushProvider.ts` envia JSON-RPC notification pros WS conectados (TDD)
- T033 — `src/push/pushDispatcher.ts` fallback chain (Relay → InBand) sem circuit breaker (YAGNI)
- T034 — `src/events/canonical.ts` wire 5 eventos canônicos (cl-3) → `pushDispatcher`

### Phase 7 — Integration + evidence

- T035 — Integration test end-to-end: pairing → comando → terminal stream → revoke
- T036 — Smoke shell script `test/nzrcode-bridge/run_all.sh`
- T037 — Cold-start benchmark `bench_cold_start.sh`, 8 vCPU / 16 GB / SSD methodology, mediana 10 runs
- T038 — `extensions/nzrcode-bridge/README.md` + `CREDITS.md` (qrcode-generator MIT)

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `workbench.action.*` quebrar entre merges do upstream | Med | Med | Integration test fixa um conjunto canônico de comandos; quebrar test antes do PR de upstream-merge |
| Cold-start orçamento estourar | Med | High | Lazy bind (ADR-4); benchmark é gate de PR (T037) |
| `nzrcode-push-relay` indisponível bloqueia push | High (relay ainda não existe) | Med | Fallback in-band (ADR-5) garante entrega quando iPad está conectado; relay vira fase 2 separada |
| Tailscale CLI ausente no PATH causar erro no pairing | Med | Low | `endpoints.ts` trata `ENOENT` como "Tailscale não detectado", não falha o pairing |
| Tokens vazarem via screenshot do QR | Low | High | Mitigado pelo `Revoke` rápido (cl-2); risco residual aceito na spec |
| `vscode.SecretStorage` falhar em CI/headless | Low | Med | Adapter com fallback in-memory quando SecretStorage falha (com warning), só pra ambiente de teste |
| QR webview ter problema de tamanho/contraste em telas escuras | Low | Low | Test estrutural no T027 (sem snapshot); revisão visual na 1ª execução manual |
| Companion-app spec atrasar e bloquear validação real | High | Low | Integration tests com cliente WS direto (T035) validam contrato sem iPad |

## Complexity tracking

> Required quando alguma Constitution Check row é `FAIL`. Tabela vazia se nada.

| Article waived | Reason | Alternatives considered | Reviewer |
|---|---|---|---|

(Nenhuma waiver necessária.)

## Hand-off to `tasks`

A próxima skill é `tasks`. Pré-condições antes do hand-off:

- [x] Constitution Check totalmente preenchida, sem rows em branco.
- [x] Complexity tracking vazio com justificativa.
- [x] Project structure delta acurado.

`tasks.md` deve quebrar cada T-NNN acima em ≥ 3 steps (test-RED → impl → test-GREEN → commit) com paths, comandos exatos e critério de aceite por step.
