# Tasks: nzrcode-bridge

> Produzido a partir de `plan.md` aprovado. Consumido por `implement`. Cada task = 1 commit; `implement` flipa `pending`→`done` dentro do commit (não editar `Status` à mão).

**Branch:** `feature/0009-nzrcode-bridge`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-15
**Language:** pt-BR

Total: 38 tasks (7 fases). Layout: tudo dentro do repo `vscode/` (ver ADR-1). Paths são relativos ao git root `vscode/`.

---

## How to read this file

- Tasks ordenadas; `implement` executa top-to-bottom.
- Cada task é 1 commit; mensagem começa com o id (`T0NN`).
- `Status`: `pending` | `in_progress` | `blocked` | `done`.
- TDD: bloco de Acceptance lista o teste RED antes do código GREEN.

---

## Task list

### Phase 1 — Extension skeleton + protocol module

### T001 — Scaffold `extensions/nzrcode-bridge/`
- **Status:** done
- **Depends on:** —
- **Files:**
  - create: `extensions/nzrcode-bridge/package.json`
  - create: `extensions/nzrcode-bridge/tsconfig.json`
  - create: `extensions/nzrcode-bridge/esbuild.mts`
  - create: `extensions/nzrcode-bridge/src/extension.ts` (activate/deactivate stubs)
  - create: `extensions/nzrcode-bridge/media/icon.png` (placeholder 64x64 PNG vazio)
- **Spec scenarios:** N/A (scaffold)
- **Acceptance:**
  - [ ] `package.json` segue padrão de `debug-auto-launch` (`publisher: vscode`, `engines.vscode: ^1.5.0`, `activationEvents: ["onStartupFinished"]`, `main: ./out/extension`).
  - [ ] `tsconfig.json` herda `../tsconfig.base.json` com `rootDir: ./src`, `outDir: ./out`, `include: ["src/**/*", "../../src/vscode-dts/vscode.d.ts"]`.
  - [ ] `esbuild.mts` espelha `extensions/debug-auto-launch/esbuild.mts`.
  - [ ] `extension.ts` exporta `activate(context)` e `deactivate()` sem efeitos colaterais.
  - [ ] `node esbuild.mts` produz `dist/extension.js`.
  - [ ] Commit: `feat(nzrcode-bridge): T001 scaffold built-in extension skeleton`.

### T002 — `package.nls.json` + command contributions
- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `extensions/nzrcode-bridge/package.nls.json`
  - modify: `extensions/nzrcode-bridge/package.json`
- **Spec scenarios:** Story 1 (Pair iPad), Story 5 (Revoke iPad)
- **Acceptance:**
  - [ ] `package.nls.json` carrega `displayName`, `description`, e strings dos 3 comandos.
  - [ ] `package.json` `contributes.commands` declara: `nzrcode-bridge.pairIpad` (title `%command.pairIpad%`, category `%category%`), `nzrcode-bridge.listPairedDevices`, `nzrcode-bridge.revokeIpad`.
  - [ ] Smoke shell `test/nzrcode-bridge/test_nls_keys_match.sh`: grep nas strings `%...%` em `package.json` e verifica existência em `package.nls.json`.
  - [ ] Commit: `feat(nzrcode-bridge): T002 declare pair/revoke commands with i18n strings`.

### T003 — Registrar nos build targets do fork
- **Status:** done
- **Depends on:** T002
- **Files:**
  - modify: `product.json` (lista de bundled extensions — confirmar campo correto lendo o arquivo)
  - modify: `build/gulpfile.extensions.ts` (array `compilations`)
  - modify: `build/npm/dirs.ts` (append `'extensions/nzrcode-bridge'`)
- **Spec scenarios:** N/A (build wiring)
- **Acceptance:**
  - [ ] `compilations` contém `'extensions/nzrcode-bridge/tsconfig.json'` em ordem alfabética.
  - [ ] `dirs.ts` contém `'extensions/nzrcode-bridge'` em ordem alfabética.
  - [ ] `product.json` registra a extensão no campo correto (ler antes de editar).
  - [ ] `npm run compile` compila a extensão sem erro.
  - [ ] Commit: `build: T003 wire nzrcode-bridge into extension build pipeline`.
- **Notes:** Não inventar o nome do campo em product.json — ler primeiro.

### T004 — Protocol: JSON-RPC envelope types + framing
- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `extensions/nzrcode-bridge/src/protocol/jsonrpc.ts`
  - create: `extensions/nzrcode-bridge/src/protocol/index.ts` (re-export barrel)
  - create: `extensions/nzrcode-bridge/src/test/unit/protocol/jsonrpc.test.ts`
- **Spec scenarios:** transversal — base do contrato consumido por todas as stories
- **Acceptance:**
  - [ ] Teste RED cobre: parse/serialize de Request, Response, Notification; rejeição de envelope sem `"jsonrpc":"2.0"`; correlação id↔result.
  - [ ] Implementar `parseMessage(raw: string): JsonRpcMessage`, `serializeRequest()`, `serializeResponse()`, `serializeNotification()` + tipos `JsonRpcRequest`, `JsonRpcResponse`, `JsonRpcNotification`, `JsonRpcError`.
  - [ ] `index.ts` re-exporta os tipos públicos.
  - [ ] Mocha test passa.
  - [ ] Commit: `feat(nzrcode-bridge): T004 add JSON-RPC 2.0 envelope types and framing`.

### T005 — Protocol: Method/Event registries
- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `extensions/nzrcode-bridge/src/protocol/methods.ts`
  - create: `extensions/nzrcode-bridge/src/protocol/events.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/protocol/methods.test.ts`
- **Spec scenarios:** Stories 1-5 (contratos referenciados)
- **Acceptance:**
  - [ ] `methods.ts` declara `enum MethodName` cobrindo: `system.hello`, `system.authenticate`, `commands.execute`, `commands.list`, `workspace.listFolders`, `workspace.findFiles`, `workspace.readFile`, `workspace.writeFile`, `editor.openFile`, `editor.getActive`, `editor.applyEdit`, `editor.setSelection`, `editor.revealLine`, `terminal.list`, `terminal.sendText`, `terminal.signal`, `scm.status`, `scm.diff`, `scm.stage`, `scm.commit`, `tasks.list`, `tasks.run`, `tasks.cancel`, `debug.start`, `debug.stop`, `debug.breakpointAdd`, `debug.variables`, `notifications.register`, `notifications.unregister`, `notifications.preferences`, `events.subscribe`, `events.unsubscribe`.
  - [ ] `methods.ts` declara `interface MethodParams` e `interface MethodResult` mapeados por chave (typed dict).
  - [ ] `events.ts` declara `enum EventName` (`editor.changed`, `editor.selectionChanged`, `terminal.data`, `terminal.created`, `terminal.closed`, `scm.statusChanged`, `tasks.statusChanged`, `tasks.completed`, `debug.stopped`, `claudeCode.permissionRequest`, `connection.changed`) + payload types.
  - [ ] Teste RED: typecheck falha quando declarar params com shape incompatível.
  - [ ] Commit: `feat(nzrcode-bridge): T005 add method and event registries with typed payloads`.

### T006 — Protocol: Error codes
- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `extensions/nzrcode-bridge/src/protocol/errors.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/protocol/errors.test.ts`
- **Spec scenarios:** Stories 2 e 5 (error.code observáveis)
- **Acceptance:**
  - [ ] Constants: `command_not_found`, `no_active_editor`, `payload_too_large`, `client_too_slow`, `auth_failure`, `path_outside_workspace`, `relay_unavailable`, `internal_error`.
  - [ ] Cada erro tem `code` (string), `jsonrpcCode` (int padrão JSON-RPC `-326xx`), `defaultMessage`.
  - [ ] Teste de tabela: cada constant produz erro válido conforme `JsonRpcError`.
  - [ ] Commit: `feat(nzrcode-bridge): T006 add bridge error codes`.

### T007 — Protocol: QR payload v1 schema
- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `extensions/nzrcode-bridge/src/protocol/qr.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/protocol/qr.test.ts`
- **Spec scenarios:** Story 1 (pareamento QR)
- **Acceptance:**
  - [ ] Tipo `QrPayloadV1 = { v: 1, token: string, endpoints: Array<{host: string, port: number, net: "lan"|"tailscale"|"mdns"}> }`.
  - [ ] `encodeQrPayload(p: QrPayloadV1): string` — JSON.stringify minificado.
  - [ ] `decodeQrPayload(s: string): QrPayloadV1` — valida `v===1`, `token` matches `^[A-Za-z0-9_-]{43}$`, `endpoints.length >= 1`, `port` 1..65535, `net` enum.
  - [ ] Teste RED: decodes inválidos (versão errada, token curto, endpoint sem porta) lançam `Error` com mensagem específica.
  - [ ] Commit: `feat(nzrcode-bridge): T007 add QR payload v1 schema with decode validation`.

---

### Phase 2 — Auth + persistence

### T008 — `auth.ts` (token gen/validate, constant-time)
- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `extensions/nzrcode-bridge/src/server/auth.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/auth.test.ts`
- **Spec scenarios:** Story 5 cenários 1, 2; Story 1 cenário 4
- **Acceptance:**
  - [ ] Teste RED: `generateToken()` retorna 43 chars base64url; `validateToken(stored, candidate)` rejeita strings de tamanho diferente, igual mas distinto, e aceita igual.
  - [ ] Implementar com `crypto.randomBytes(32)` e `crypto.timingSafeEqual` sobre o decode binário.
  - [ ] `validateToken` retorna `false` em qualquer erro de decode (não throw).
  - [ ] Commit: `feat(nzrcode-bridge): T008 add token gen and constant-time validation`.

### T009 — `logging.ts` redacting tokens e content
- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `extensions/nzrcode-bridge/src/logging.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/logging.test.ts`
- **Spec scenarios:** Story 5 cenário 5 (privacy); Article VI
- **Acceptance:**
  - [ ] Teste RED: `redactToken("aBcD…XYZ")` retorna `"aBcDef12…"` (8 chars + ellipsis); `redactContent(buffer)` retorna `{bytes: N, sha256Prefix: "0a1b2c"}` sem o conteúdo.
  - [ ] `logRequest({method, params})` produz string sem `params.token` / `params.apnsToken` mesmo recursivamente.
  - [ ] Test cobre: nested object com `token` em 3 níveis profundos é redacted; `apnsToken` no payload de `notifications.register` é redacted.
  - [ ] Commit: `feat(nzrcode-bridge): T009 add log redaction for tokens and file content`.

### T010 — `state.ts` lê/cria `~/.nzrcode/bridge.json` com 0600
- **Status:** done
- **Depends on:** T008
- **Files:**
  - create: `extensions/nzrcode-bridge/src/server/state.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/state.test.ts`
  - modify: `extensions/nzrcode-bridge/src/extension.ts` (chama `loadOrCreate` em activate)
- **Spec scenarios:** Story 5 cenário 4
- **Acceptance:**
  - [ ] Teste RED (com `tmp` dir via env override `NZRCODE_HOME`): `loadOrCreateState()` cria arquivo com `chmod 0o600`; segunda chamada retorna mesmo token; após `fs.chmod(0o644)` externo, `loadOrCreateState()` detecta e re-aplica `0o600`.
  - [ ] Conteúdo: `{ token: string, lastPort?: number, version: 1 }`.
  - [ ] Activation **não** binda WS ainda — apenas carrega estado (lazy bind em T016).
  - [ ] Commit: `feat(nzrcode-bridge): T010 load or create bridge state with 0600 perms`.

### T011 — `pairedDevices.ts` (SecretStorage + globalState)
- **Status:** done
- **Depends on:** T010
- **Files:**
  - create: `extensions/nzrcode-bridge/src/pairing/pairedDevices.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/pairedDevices.test.ts`
- **Spec scenarios:** Story 5 cenário 3 (Revoke); cl-6 (multi-device); cl-11 (apnsToken)
- **Acceptance:**
  - [ ] Teste RED com `vscode.SecretStorage` mock + `Memento` mock: `register({deviceId, deviceName})` grava em `globalState`; `attachApnsToken(deviceId, apnsToken)` grava em `SecretStorage` chave `paired-device:<deviceId>`; `list()` retorna metadata sem apnsToken; `getApnsToken(deviceId)` retorna do SecretStorage; `revoke(deviceId)` remove ambos.
  - [ ] `globalState` **não** contém apnsToken em nenhum momento (test assertion).
  - [ ] Commit: `feat(nzrcode-bridge): T011 add paired device store with SecretStorage for apnsTokens`.

---

### Phase 3 — WebSocket server + dispatcher

### T012 — `wsServer.ts` bind 127.0.0.1 dynamic port
- **Status:** done
- **Depends on:** T010
- **Files:**
  - create: `extensions/nzrcode-bridge/src/server/wsServer.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/wsServer.test.ts`
- **Spec scenarios:** Story 5 cenário 1 (loopback-only); Story 1 cenário 2
- **Acceptance:**
  - [ ] Teste RED: `start()` retorna porta atribuída pelo OS; conexão de `127.0.0.1` aceita; tentativa de bindar `0.0.0.0` rejeitada no construtor.
  - [ ] `stop()` fecha conexões abertas em ≤ 100ms.
  - [ ] Usa `ws ^8.19.0` (já dep do fork).
  - [ ] Commit: `feat(nzrcode-bridge): T012 add loopback-only WebSocket server`.

### T013 — `dispatcher.ts` JSON-RPC routing + auth gate
- **Status:** done
- **Depends on:** T012, T008
- **Files:**
  - create: `extensions/nzrcode-bridge/src/server/dispatcher.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/dispatcher.test.ts`
- **Spec scenarios:** Story 5 cenário 2 (auth failure); Story 2 cenário 3 (command_not_found)
- **Acceptance:**
  - [ ] Teste RED: 1ª mensagem não-`system.authenticate` derruba conexão com `auth_failure`; `system.authenticate` com token inválido derruba; com token válido aceita; `commands.execute` desconhecido retorna `command_not_found`.
  - [ ] Dispatcher mantém registry `Map<MethodName, Handler>` com `register(method, fn)`.
  - [ ] Logs registram `remoteAddress` + `method` mas não token (via `logging.ts` T009).
  - [ ] Commit: `feat(nzrcode-bridge): T013 add JSON-RPC dispatcher with auth gate`.

### T014 — `messageQueue.ts` backlog + `client_too_slow`
- **Status:** done
- **Depends on:** T013
- **Files:**
  - create: `extensions/nzrcode-bridge/src/server/messageQueue.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/messageQueue.test.ts`
- **Spec scenarios:** cl-5 (backlog limit)
- **Acceptance:**
  - [ ] Teste RED: cliente lento (não draina) → após backlog ≥ 5 MB pendentes, conexão é fechada com close reason `client_too_slow`.
  - [ ] Eventos `terminal.data` contam contra o backlog.
  - [ ] Após fechar, cliente reconnecta com token válido e funciona normalmente.
  - [ ] Commit: `feat(nzrcode-bridge): T014 enforce 5 MB outbound backlog with client_too_slow`.

### T015 — Handler `system.hello`
- **Status:** done
- **Depends on:** T013
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/system.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/system.test.ts`
  - modify: `extensions/nzrcode-bridge/src/extension.ts` (registra handler)
- **Spec scenarios:** Story 1 cenário 2 (post-pair)
- **Acceptance:**
  - [ ] Teste RED: `system.hello()` retorna `{serverVersion, capabilities: string[], hostname, platform}`.
  - [ ] `capabilities` lista namespaces registrados (`["commands", "workspace", "editor", "terminal", "scm", "tasks", "debug", "notifications"]`).
  - [ ] Commit: `feat(nzrcode-bridge): T015 add system.hello handler`.

### T016 — Lazy WS bind + integration smoke (handshake round-trip)
- **Status:** done
- **Depends on:** T014, T015
- **Files:**
  - modify: `extensions/nzrcode-bridge/src/extension.ts` (activate bindar se state existe)
  - create: `extensions/nzrcode-bridge/src/test/integration/handshake.test.ts`
- **Spec scenarios:** Story 1 cenário 2; ADR-4 (lazy bind)
- **Acceptance:**
  - [ ] Activation com `bridge.json` ausente: WS **não** abre porta.
  - [ ] Activation com `bridge.json` presente: WS abre porta, escreve `lastPort` em `bridge.json`.
  - [ ] Integration test (`@vscode/test-electron`): fixture com `bridge.json`, ativa extensão, conecta `ws://127.0.0.1:<port>`, autentica, faz `system.hello`, recebe response. Timeout 5s.
  - [ ] Commit: `feat(nzrcode-bridge): T016 lazy WS bind with handshake integration smoke`.

---

### Phase 4 — RPC namespaces

### T017 — `commands.ts` (execute, list) + REQUIRES_ACTIVE_EDITOR list
- **Status:** done
- **Depends on:** T016
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/commands.ts`
  - create: `extensions/nzrcode-bridge/REQUIRES_ACTIVE_EDITOR.md`
  - create: `extensions/nzrcode-bridge/src/test/unit/commands.test.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/rpc-commands.test.ts`
- **Spec scenarios:** Story 2 cenários 1, 3, 4
- **Acceptance:**
  - [ ] Teste RED unit: `execute(cmdId, args)` chama `vscode.commands.executeCommand`; comando desconhecido retorna `command_not_found`; comando em `REQUIRES_ACTIVE_EDITOR.md` chamado sem `activeTextEditor` retorna `no_active_editor`.
  - [ ] `REQUIRES_ACTIVE_EDITOR.md` enumera: `editor.action.formatDocument`, `editor.action.commentLine`, `editor.action.rename`, `editor.action.goToDeclaration`, `editor.action.formatSelection`, `editor.action.organizeImports`, `editor.action.quickFix`, `editor.action.showHover`, `editor.action.revealDefinition`. Cada linha é id + 1 frase descritiva.
  - [ ] `list()` retorna `vscode.commands.getCommands(true)` filtrado por prefixos publicáveis (sem `_*` internos).
  - [ ] Integration test: dispara `workbench.action.tasks.runTask` num workspace fixture com task `dev`, ack < 1s.
  - [ ] Commit: `feat(nzrcode-bridge): T017 add commands.execute and commands.list handlers`.
- **Notes:** Manter `REQUIRES_ACTIVE_EDITOR.md` sincronizado em PRs que adicionem novos comandos restritos.

### T018 — `workspace.ts` (listFolders, findFiles, readFile, writeFile)
- **Status:** done
- **Depends on:** T016
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/workspace.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/workspace.test.ts`
- **Spec scenarios:** Story 5 cenário 5 (no content leak); cl-9 (read/write rules); cl-5 (10 MB)
- **Acceptance:**
  - [ ] Teste RED unit: `readFile(path)` retorna bytes; `writeFile(path, bytes)` fora de `workspaceFolders` retorna `path_outside_workspace`; payload > 10 MB retorna `payload_too_large` com `data.limit=10485760`.
  - [ ] Log de `readFile`: registra `{path, byteCount, sha256Prefix}` via `redactContent` — **nunca** o conteúdo.
  - [ ] Test específico: spy no logger durante `readFile(testFile)` cujo conteúdo é `"SUPER_SECRET_VALUE"`; assert que nenhuma chamada de log contém `"SUPER_SECRET_VALUE"`.
  - [ ] Commit: `feat(nzrcode-bridge): T018 add workspace fs handlers with read/write asymmetry`.

### T019 — `editor.ts` (openFile, getActive, applyEdit, setSelection, revealLine)
- **Status:** done
- **Depends on:** T016
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/editor.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/rpc-editor.test.ts`
- **Spec scenarios:** Story 2 cenário 2; cl-5 (applyEdit 10 MB)
- **Acceptance:**
  - [ ] Integration test: `editor.openFile({path})` abre o file; response carrega `editorId`; evento `editor.changed` é disparado.
  - [ ] `applyEdit` com texto > 10 MB retorna `payload_too_large`.
  - [ ] `revealLine(editorId, lineNumber)` move viewport (assert via `visibleRanges`).
  - [ ] Commit: `feat(nzrcode-bridge): T019 add editor RPC handlers`.

### T020 — `terminal.ts` (list, sendText, signal)
- **Status:** pending
- **Depends on:** T016
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/terminal.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/terminal.test.ts`
- **Spec scenarios:** Story 3 cenários 1, 3, 4; cl-1 (signal method)
- **Acceptance:**
  - [ ] `list()` retorna `vscode.window.terminals.map(t => ({id, name, cwd}))`.
  - [ ] `sendText(id, text)` chama `terminal.sendText(text, false)`; **não** interpreta `\x03` como sinal.
  - [ ] `signal({terminalId, signal})` mapeia SIGINT→`\x03`, SIGTERM→`\x1c`; `signal` desconhecido retorna `internal_error`.
  - [ ] Test: spy em `sendText` confirma byte injetado corresponde ao sinal.
  - [ ] Commit: `feat(nzrcode-bridge): T020 add terminal handlers with dedicated signal method`.

### T021 — `events/publisher.ts` + `terminal.data` event streaming
- **Status:** pending
- **Depends on:** T020
- **Files:**
  - create: `extensions/nzrcode-bridge/src/events/publisher.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/publisher.test.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/rpc-terminal-stream.test.ts`
- **Spec scenarios:** Story 3 cenário 2; cl-5 (64 KB chunk); cl-8 (base64 raw)
- **Acceptance:**
  - [ ] `events.subscribe(patterns)` registra cliente; `events.unsubscribe` remove.
  - [ ] `terminal.data` evento carrega `{terminalId, chunkSeq, data: <base64>}`; servidor fragmenta output > 64 KB em múltiplos eventos sequenciais.
  - [ ] Integration test: cria terminal, manda output de ~100 KB, recebe ≥ 2 eventos com `chunkSeq` sequencial; concatenar e base64-decode dá output bit-igual.
  - [ ] Test raw: ANSI escape `\x1b[31mRED\x1b[0m` chega intacto.
  - [ ] Commit: `feat(nzrcode-bridge): T021 add event publisher with terminal.data chunked streaming`.

### T022 — `scm.ts` (status, diff, stage, commit)
- **Status:** pending
- **Depends on:** T016
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/scm.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/rpc-scm.test.ts`
- **Spec scenarios:** Spec menciona scm como namespace exposto; sem story dedicada — cobertura básica
- **Acceptance:**
  - [ ] Integration test (workspace fixture com git init + 1 commit): `scm.status()` lista files staged/modified/untracked; `scm.stage([path])` move pro staged; `scm.commit(message)` cria commit.
  - [ ] `scm.diff(path)` retorna texto do diff unified.
  - [ ] Commit: `feat(nzrcode-bridge): T022 add SCM read/stage/commit handlers`.

### T023 — `tasks.ts` (list, run, cancel)
- **Status:** pending
- **Depends on:** T016
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/tasks.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/rpc-tasks.test.ts`
- **Spec scenarios:** Story 2 cenário 1
- **Acceptance:**
  - [ ] Integration test (fixture com `tasks.json`): `tasks.list()` retorna labels; `tasks.run(label)` dispara e retorna `executionId`; evento `tasks.statusChanged` segue até `tasks.completed`.
  - [ ] `tasks.cancel(executionId)` para a task.
  - [ ] Commit: `feat(nzrcode-bridge): T023 add tasks list/run/cancel handlers`.

### T024 — `debug.ts` (start, stop, breakpointAdd, variables)
- **Status:** pending
- **Depends on:** T016
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/debug.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/rpc-debug.test.ts`
- **Spec scenarios:** Sem story dedicada; necessário pro evento `debug.stopped` em cl-3
- **Acceptance:**
  - [ ] Integration test com debug config `node` fixture: `debug.start(config)` inicia, `breakpointAdd({path, line})` adiciona, `debug.stopped` é emitido quando bate breakpoint, `debug.variables(frameId)` retorna locals.
  - [ ] `debug.stop()` encerra.
  - [ ] Commit: `feat(nzrcode-bridge): T024 add debug session control handlers`.

### T025 — `notifications.ts` (register, unregister, preferences) com mute test
- **Status:** pending
- **Depends on:** T016, T011
- **Files:**
  - create: `extensions/nzrcode-bridge/src/rpc/notifications.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/notifications.test.ts`
- **Spec scenarios:** Story 4 cenários 1, 2, 4; cl-11
- **Acceptance:**
  - [ ] `notifications.register({deviceId, apnsToken})` armazena via `pairedDevices.attachApnsToken`.
  - [ ] `notifications.unregister(deviceId)` remove apnsToken do SecretStorage.
  - [ ] `notifications.preferences({deviceId, muted: ["tasks.completed"]})` persiste em `globalState.preferences:<deviceId>`.
  - [ ] **Test de mute:** spy em `pushDispatcher` (fake); após `preferences(muted: ["tasks.completed"])`, disparar evento `tasks.completed` produz **zero** chamadas a `dispatch` pra esse deviceId. Disparar `claudeCode.permissionRequest` no mesmo device — dispatch acontece (categorias independentes).
  - [ ] Commit: `feat(nzrcode-bridge): T025 add notifications register/prefs with mute test`.

---

### Phase 5 — Pairing UX

### T026 — `endpoints.ts` (LAN + Tailscale discovery)
- **Status:** pending
- **Depends on:** T016
- **Files:**
  - create: `extensions/nzrcode-bridge/src/pairing/endpoints.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/endpoints.test.ts`
- **Spec scenarios:** Story 1 cenário 1; Story 4 cenário 1 (Tailscale fallback)
- **Acceptance:**
  - [ ] `discoverEndpoints(port)` mock-friendly: aceita injeção de `networkInterfaces()` e `tailscaleIp()` providers.
  - [ ] Retorna array com IPv4 não-loopback (`net: "lan"`) + se Tailscale disponível em ≤ 500ms (`net: "tailscale"`).
  - [ ] Sub-processo usa `child_process.execFile('tailscale', ['ip', '-4'])` (NÃO `exec` — args fixos hard-coded, zero shell injection).
  - [ ] `execFile` ENOENT → silencia, retorna só LAN sem error.
  - [ ] Test: mock `child_process.execFile` retornando `ENOENT` → resultado contém só LAN.
  - [ ] Commit: `feat(nzrcode-bridge): T026 add endpoint discovery with Tailscale fallback`.
- **Notes:** Regra `security.md` proíbe `exec()` por padrão. Aqui args são literais mas usar `execFile` é o caminho correto.

### T027 — `qrModal.ts` webview (com assertion estrutural)
- **Status:** pending
- **Depends on:** T026, T007
- **Files:**
  - create: `extensions/nzrcode-bridge/src/pairing/qrModal.ts`
  - create: `extensions/nzrcode-bridge/media/qr-webview.html`
  - create: `extensions/nzrcode-bridge/src/test/unit/qrModal.test.ts`
  - modify: `extensions/nzrcode-bridge/package.json` (adiciona `qrcode-generator` dep)
- **Spec scenarios:** Story 1 cenário 1; cl-4 (múltiplos endpoints)
- **Acceptance:**
  - [ ] Teste **não** faz snapshot do DOM/webview (regra `testing.md`). Em vez disso, assert estrutural sobre o `QrPayloadV1`: `payload.v===1`, `payload.token` matches regex `^[A-Za-z0-9_-]{43}$`, `payload.endpoints.length >= 1`, ordem é `lan` primeiro.
  - [ ] `qrModal.show(payload)` retorna `Promise<{deviceId, apnsToken?}>` que resolve quando o iPad completa pareamento.
  - [ ] HTML usa `qrcode-generator` MIT bundleado localmente (não CDN).
  - [ ] Commit: `feat(nzrcode-bridge): T027 add QR webview with structural payload assertion`.

### T028 — Comando `nzrcode: Pair iPad` orchestration
- **Status:** pending
- **Depends on:** T027, T011, T026
- **Files:**
  - create: `extensions/nzrcode-bridge/src/pairing/pairCommand.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/pairing.test.ts`
  - modify: `extensions/nzrcode-bridge/src/extension.ts` (registra comando)
- **Spec scenarios:** Story 1 cenários 1, 2, 3
- **Acceptance:**
  - [ ] Comando executa: `loadOrCreateState` → `discoverEndpoints` → `qrModal.show(payload)` → aguarda 1ª conexão WS autenticada → `pairedDevices.register` → notification "Paired with <name>".
  - [ ] Integration test: simula cliente conectando após `qrModal` aberto; 5s após `show`, `pairedDevices.list` contém o device.
  - [ ] Após restart simulado, mesmo cliente reconecta sem novo pairing.
  - [ ] Commit: `feat(nzrcode-bridge): T028 add Pair iPad command orchestration`.

### T029 — `List Paired Devices` e `Revoke iPad`
- **Status:** pending
- **Depends on:** T028
- **Files:**
  - create: `extensions/nzrcode-bridge/src/pairing/listCommand.ts`
  - create: `extensions/nzrcode-bridge/src/pairing/revokeCommand.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/revoke.test.ts`
- **Spec scenarios:** Story 5 cenário 3
- **Acceptance:**
  - [ ] `List Paired Devices` mostra QuickPick com devices ativos (deviceName + lastSeenAt humanizado).
  - [ ] `Revoke iPad` mostra QuickPick; ao selecionar device, chama `pairedDevices.revoke(id)` + derruba conexões WS daquele token em ≤ 2s; tentativa de auth subsequente retorna `auth_failure`.
  - [ ] Commit: `feat(nzrcode-bridge): T029 add list and revoke paired device commands`.

---

### Phase 6 — Push notifications + provider

### T030 — `IPushProvider` interface + `FakePushProvider`
- **Status:** pending
- **Depends on:** T025
- **Files:**
  - create: `extensions/nzrcode-bridge/src/push/IPushProvider.ts`
  - create: `extensions/nzrcode-bridge/src/push/fakePushProvider.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/fakePushProvider.test.ts`
- **Spec scenarios:** Article V (provider pattern)
- **Acceptance:**
  - [ ] Interface: `send(devices: PairedDevice[], event: PushEvent): Promise<void>`.
  - [ ] `FakePushProvider` armazena chamadas em `calls: Array<{devices, event, ts}>` + método `reset()`.
  - [ ] Test: 3 calls em sequência produzem `calls.length === 3` em ordem temporal.
  - [ ] Commit: `feat(nzrcode-bridge): T030 add IPushProvider interface and fake implementation`.

### T031 — `relayPushProvider.ts` (HTTPS POST com timeout)
- **Status:** pending
- **Depends on:** T030
- **Files:**
  - create: `extensions/nzrcode-bridge/src/push/relayPushProvider.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/relayPushProvider.test.ts`
- **Spec scenarios:** cl-7 (relay centralizado)
- **Acceptance:**
  - [ ] Teste RED: `send` faz POST `https://push-relay.nzrcode.dev/v1/push` com body `{apnsTokens, payload}`; timeout 3s → reject com `relay_unavailable`; HTTP 5xx → reject; 2xx → resolve.
  - [ ] Test usa `nock` ou MSW pra interceptar HTTP.
  - [ ] Logs redactam apnsToken nos POST bodies.
  - [ ] Commit: `feat(nzrcode-bridge): T031 add relay push provider with timeout`.

### T032 — `inBandPushProvider.ts` (JSON-RPC notification fallback)
- **Status:** pending
- **Depends on:** T030, T013
- **Files:**
  - create: `extensions/nzrcode-bridge/src/push/inBandPushProvider.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/inBandPushProvider.test.ts`
- **Spec scenarios:** cl-7 fallback
- **Acceptance:**
  - [ ] `send` envia notification `events.notification` pros clientes WS conectados pareados com os devices fornecidos.
  - [ ] Devices não conectados são silenciosamente ignorados (não há erro).
  - [ ] Test: 2 devices, 1 com WS aberto e 1 sem; só 1 notification é enviada.
  - [ ] Commit: `feat(nzrcode-bridge): T032 add in-band push provider for connected clients`.

### T033 — `pushDispatcher.ts` fallback chain
- **Status:** pending
- **Depends on:** T031, T032
- **Files:**
  - create: `extensions/nzrcode-bridge/src/push/pushDispatcher.ts`
  - create: `extensions/nzrcode-bridge/src/test/unit/pushDispatcher.test.ts`
- **Spec scenarios:** cl-7
- **Acceptance:**
  - [ ] `dispatch(event)`: tenta `RelayPushProvider.send`; em erro ou timeout, chama `InBandPushProvider.send`.
  - [ ] **Sem circuit breaker** (YAGNI): cada call tenta o relay primeiro.
  - [ ] Test: relay rejeita → in-band é chamado; relay resolve → in-band **não** é chamado.
  - [ ] Test: spy mostra ordem.
  - [ ] Commit: `feat(nzrcode-bridge): T033 wire push dispatcher relay→in-band fallback`.

### T034 — Wire 5 eventos canônicos → pushDispatcher
- **Status:** pending
- **Depends on:** T033, T021, T023, T024
- **Files:**
  - create: `extensions/nzrcode-bridge/src/events/canonical.ts`
  - create: `extensions/nzrcode-bridge/src/test/integration/push-events.test.ts`
- **Spec scenarios:** cl-3 (5 eventos canônicos); Story 4 cenários 1, 2, 4
- **Acceptance:**
  - [ ] `canonical.ts` registra 5 watchers: (1) `vscode.tasks.onDidEndTaskProcess` filtrando `duration >= 30000ms`; (2) `terminal.onDidEndTerminalShellExecution` filtrando `exitCode != 0`; (3) hook pra `claudeCode.permissionRequest` (via Claude Code extension API se exposta, senão TODO documentado); (4) `vscode.debug.onDidChangeActiveDebugSession` + `onDidReceiveDebugSessionCustomEvent("stopped")`; (5) `wsServer.onConnectionChanged`.
  - [ ] Cada watcher chama `pushDispatcher.dispatch(event)` com payload tipado.
  - [ ] Integration test com `FakePushProvider`: task de 100ms **não** dispara; task de 35s dispara 1 push.
  - [ ] Commit: `feat(nzrcode-bridge): T034 wire canonical events to push dispatcher`.
- **Notes:** Para (3) `claudeCode.permissionRequest`, confirmar API da Claude Code extension; se não houver hook público, deixar TODO + polling com debounce.

---

### Phase 7 — Integration + evidence

### T035 — End-to-end integration test
- **Status:** pending
- **Depends on:** T034
- **Files:**
  - create: `extensions/nzrcode-bridge/src/test/integration/e2e.test.ts`
- **Spec scenarios:** Stories 1, 2, 3, 5 (orquestrado num único fluxo)
- **Acceptance:**
  - [ ] Fluxo: ativa extensão → roda `Pair iPad` → cliente WS pareia → `system.hello` ack → `editor.openFile` ack → `terminal.sendText("echo ok\n")` → recebe `terminal.data` com "ok" → `Revoke iPad` → cliente recebe disconnect e novo connect retorna `auth_failure`.
  - [ ] Timeout 30s; falha se algum passo demora > 5s.
  - [ ] Commit: `test(nzrcode-bridge): T035 add end-to-end pairing→command→revoke integration test`.

### T036 — Smoke shell `run_all.sh`
- **Status:** pending
- **Depends on:** T035
- **Files:**
  - create: `test/nzrcode-bridge/run_all.sh`
  - create: `test/nzrcode-bridge/test_files_exist.sh`
  - create: `test/nzrcode-bridge/test_no_new_deps_root.sh`
  - create: `test/nzrcode-bridge/test_built_in_registration.sh`
  - create: `test/nzrcode-bridge/README.md`
- **Spec scenarios:** Evidência (Article IV)
- **Acceptance:**
  - [ ] `run_all.sh` roda os 3 smokes + `mocha` unit + `vscode-test` integration; exit 0 só se tudo passar.
  - [ ] `test_built_in_registration.sh` grep confirma entradas em `product.json`, `gulpfile.extensions.ts`, `dirs.ts`.
  - [ ] `test_no_new_deps_root.sh` confirma que `package.json` root **não** ganhou deps novas (qrcode-generator fica isolado na extensão).
  - [ ] Output salvo em `specs/0009-nzrcode-bridge/evidence/run_all_output.txt`.
  - [ ] Commit: `test(nzrcode-bridge): T036 add smoke suite and evidence transcript`.

### T037 — Cold-start benchmark (8 vCPU / 16 GB methodology)
- **Status:** pending
- **Depends on:** T036
- **Files:**
  - create: `test/nzrcode-bridge/bench_cold_start.sh`
  - create: `specs/0009-nzrcode-bridge/evidence/cold_start_results.md`
- **Spec scenarios:** Success criteria #5 (≤ 50ms overhead, mediana 10 runs)
- **Acceptance:**
  - [ ] `bench_cold_start.sh` documenta hardware exigido: "Laptop dev classe 8 vCPU / 16 GB RAM / SSD NVMe; workspace vazio".
  - [ ] Roda 10x `time ./scripts/code.sh --wait` com extensão habilitada, 10x sem (`--disable-extension nzrcode-bridge`); grava em `cold_start_results.md` com hostname, OS, RAM, CPU model.
  - [ ] Calcula mediana de cada conjunto; assert `median_with - median_without ≤ 50ms`.
  - [ ] Falha o script (exit 1) se overhead > 50ms.
  - [ ] Script aborta com mensagem clara se a máquina não atender a classe especificada.
  - [ ] Commit: `test(nzrcode-bridge): T037 add cold-start benchmark with methodology`.

### T038 — README + CREDITS update
- **Status:** pending
- **Depends on:** T037
- **Files:**
  - create: `extensions/nzrcode-bridge/README.md`
  - modify: `CREDITS.md` (entrada pra `qrcode-generator` MIT)
- **Spec scenarios:** Article VII (Attribution)
- **Acceptance:**
  - [ ] README descreve: o que é, como ativar (auto), comandos do palette, setup Tailscale pra acesso externo, troubleshooting (Tailscale não detectado, porta ocupada).
  - [ ] CREDITS.md ganha entrada: `qrcode-generator` (versão, URL, MIT license).
  - [ ] Issue stub criado no GitHub (vínculo registrado na seção Traceability da spec).
  - [ ] Commit: `docs(nzrcode-bridge): T038 add README and qrcode-generator attribution`.

---

## Parallelization hints

> Tarefas que não compartilham files podem ser tentadas em paralelo. Listas conservadoras.

- **Phase 1 parallel after T001:** T004 ↔ T005 ↔ T006 ↔ T007 (protocol files distintos). T002 e T003 paralelo entre si.
- **Phase 2 parallel:** T008 ↔ T009 (arquivos distintos, sem depender entre si).
- **Phase 4 parallel:** T018 ↔ T019 ↔ T022 ↔ T023 ↔ T024 — namespaces independentes após T016. T017, T020, T021, T025 serializar (interdependências).
- **Phase 6 parallel:** T031 ↔ T032 — providers independentes.
- **Serial:** Phase 3 (estado compartilhado), Phase 5 (pairing tem ordem natural), Phase 7.

## Post-task checklist

Depois de **cada** task:
- [ ] Commit message referencia a task id (`T0NN`).
- [ ] Status atualizado pra `done` (no commit).
- [ ] Test passou; evidência salva se for caso de Article IV.

Depois de **todas** as tasks:
- [ ] `bash test/nzrcode-bridge/run_all.sh` passa.
- [ ] `bash test/nzrcode-bridge/bench_cold_start.sh` passa.
- [ ] `analyze` skill reporta zero drift vs `spec.md` / `plan.md`.
- [ ] Hand-off pra `requesting-code-review` pra abrir o PR.
