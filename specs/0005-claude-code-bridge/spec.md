# Feature specification: Claude Code bridge service

**Branch:** `feature/0005-claude-code-bridge`
**Created:** 2026-05-14
**Status:** Draft
**Spec ID:** 0005
**Language:** pt-BR

---

<!-- section: Problem -->
## Problema

A Mission Control de NZRCode é, conceitualmente, um orquestrador de claude-code real (brief §2 ponto 2): cada station hospeda uma instância do Claude Code que executa o pipeline AIADev dentro do `repoPath`. Após 0001-0004 temos identidade, tema, registry e adapter `aiadev` — mas **nada conecta uma station a um processo `claude` rodando no diretório dela**. Sem esse bridge: (a) 0007/0008 não têm conversa para mostrar; (b) o pipeline só roda manualmente em terminal externo; (c) brief §2 ponto 2 fica violado. Esta feature entrega o serviço de bridge (sem UI) que executa `claude -p <prompt>` por station, streama stdout/stderr via eventos, e emite resultado final.

<!-- section: Reconnaissance -->
## Reconnaissance

- **Claude Code CLI** — entry: `/home/alairjt/.local/bin/claude` v2.1.140 verificado. Modo `-p`/`--print` aceita prompt via argv, escreve stdout em real-time, exit 0 em sucesso. Modo interativo (default) exige PTY — out-of-scope. `--resume <session_id>` permite multi-turn via session id (sem PTY).
- **Padrão de spawn já estabelecido** — entry: `src/vs/workbench/services/nzr/electron-browser/aiadevAdapter.ts` (feature 0004). Reusar `cp.spawn(BIN, args, { cwd, shell: false })` + listeners `stdout.on('data', ...)`. **Não** abstrair prematuramente entre bridges.
- **node-pty** — NÃO está em `package.json` (verificado). Brief §7 proíbe novas deps NPM sem aprovação. Decisão: modo `-p` puro; PTY interativo fica para feature futura.
- **Per-station isolation** — entry: `IStationRegistryService.getStation(id)?.repoPath` (0003). Bridge aceita `stationId` no input mas não injeta o registry — caller resolve `repoPath` e passa nos opts (mantém bridge desacoplado).
- **Emitter pattern** — padrão VS Code, já usado em 0003/0004. Eventos: `onSessionStarted`, `onSessionOutput`, `onSessionExit`, `onSessionError`.

<!-- section: Users and stakeholders -->
## Usuários e stakeholders

- **Station view (0007)** — mostra conversa com Claude streaming; oferece input.
- **Mission Control shell (0006)** — dispara prompts background sem UI de chat.
- **Gate queue panel (0008)** — pode parsear output quando Claude pede clarify.
- **Mantenedor** — bridge testado headless antes de UI depender.

<!-- section: Success criteria -->
## Critérios de sucesso

- `src/vs/platform/nzr/common/claudeCode.ts` exporta `ClaudeSessionOptions`, `ClaudeSessionHandle`, `ClaudeOutputChunk`, `ClaudeSessionResult`, `ClaudeSessionError`, `ClaudeSessionStatus`.
- `src/vs/platform/nzr/common/claudeCodeBridge.ts` exporta `IClaudeCodeBridge` decorator + interface com 4 eventos (`onSessionStarted`, `onSessionOutput`, `onSessionExit`, `onSessionError`) e 4 métodos (`startSession`, `cancelSession`, `getSession`, `listActiveSessions`).
- `src/vs/workbench/services/nzr/electron-browser/claudeCodeBridge.ts` implementa via `child_process.spawn('claude', ['-p', prompt, ...resumeArgs, ...extraArgs], { cwd: repoPath, shell: false })`. Streams stdout/stderr para `onSessionOutput`; close → `onSessionExit`; ENOENT → `onSessionError` graceful.
- Cada sessão tem `id` UUID v4 (separado de `stationId`). `cancelSession(id)` envia SIGTERM, +5s SIGKILL.
- Timeout default 300s (5min); configurável via `timeoutMs`.
- Mocha test cobre: lifecycle (start → output → exit), cancelamento (status 'cancelled' + SIGTERM), ENOENT graceful, múltiplas sessões em paralelo, getSession imutável.
- Suite shell `test/nzrcode-claude/` GREEN: files, interface shape, registration.
- `IClaudeCodeBridge` registrado em `nzr.electron.contribution.ts` (mesmo arquivo da 0004).
- Diff: 4 arquivos novos + 1 modificado (contribution). Sem regressão nas 4 suites anteriores.

<!-- section: Non-goals -->
## Não-goals

- **Modo interativo / PTY** — exige `node-pty` (proibido por brief §7).
- **Persistência histórica de output** — chunks vão para Emitter; UI 0007 decide buffer.
- **Embedar extensão Claude Code via API** — spawnar processo CLI é suficiente; "extensão" no marketplace é wrapper sobre o mesmo CLI.
- **Auth / login** — CLI gerencia; bridge assume logado.
- **Parser de output JSON** — bridge entrega bytes brutos; parsing de tool-use boundaries fica para feature futura.
- **Cost / token tracking** — populamos `StationMetrics.tokens/cost` em outra feature.
- **Concurrency limits** — N sessões = N processos; SO gerencia.

<!-- section: User stories -->
## User stories

### Story 1 — Iniciar sessão one-shot com streaming (P1)

Como **station view**, eu quero disparar um prompt e receber output em chunks streaming em tempo real, para o usuário ver a resposta sendo gerada.

**Acceptance:**

1. **Given** `IClaudeCodeBridge` injetado, **When** chamo `await bridge.startSession({ stationId: 's1', repoPath: '/repos/x', prompt: 'olá' })`, **Then** retorna `ClaudeSessionHandle` com `status: 'starting' | 'running'` e `id` UUID v4.
2. **Given** sessão em execução, **When** processo `claude` produz stdout, **Then** `onSessionOutput` dispara com `{ sessionId, stream: 'stdout', data, timestamp }`. Cada chunk reflete um `'data'` event.
3. **Given** processo termina exit 0, **When** close, **Then** `onSessionExit` dispara com `ClaudeSessionResult { ok: true, exitCode: 0, durationMs, stdout, stderr }`; `getSession(id)?.status === 'completed'`.
4. **Given** binary ausente (ENOENT), **When** chamo `startSession`, **Then** handle volta com `status: 'failed'`; `onSessionError` fire com `{ sessionId, kind: 'spawn-failed', error: 'claude binary not found on PATH' }`; sem throw.

### Story 2 — Cancelar sessão em vôo (P1)

Como **station view**, eu quero cancelar (botão stop) sem deixar processo zombie.

**Acceptance:**

1. **Given** sessão `id` running, **When** chamo `cancelSession(id)`, **Then** retorna `true`; processo recebe SIGTERM; +5s sem exit → SIGKILL.
2. **Given** cancelada com sucesso, **When** close, **Then** `onSessionExit` com `status: 'cancelled'` e `exitCode` reflete sinal (-15 ou -9); `getSession(id)?.status === 'cancelled'`.
3. **Given** id desconhecido, **When** chamo `cancelSession`, **Then** retorna `false` sem side effect.
4. **Given** sessão já terminada, **When** chamo `cancelSession`, **Then** retorna `false` (idempotente).

### Story 3 — Múltiplas sessões isoladas (P1)

Como **Mission Control shell**, eu quero rodar sessões paralelas em stations diferentes, sem que uma afete a outra.

**Acceptance:**

1. **Given** stations `s1` e `s2`, **When** `startSession` para cada simultaneamente, **Then** ambas rodam (processos separados, cwds distintos); `listActiveSessions()` retorna 2 handles.
2. **Given** sessão `s1` em vôo, **When** ela emite output, **Then** `onSessionOutput` fire apenas com `sessionId` da `s1` (consumer filtra por sessionId).
3. **Given** sessão `s1` falha, **When** o erro ocorre, **Then** `s2` continua intocada.

### Story 4 — Resume de sessão existente (P2)

Como **station view**, eu quero continuar uma conversation anterior do Claude sem reabrir contexto.

**Acceptance:**

1. **Given** session id do CLI (`session_xxx`), **When** chamo `startSession({ ..., sessionId: 'session_xxx', resume: true })`, **Then** spawn usa argv `['--resume', 'session_xxx', '-p', prompt]`.
2. **Given** `sessionId` provido mas `resume: false`, **When** chamo `startSession`, **Then** ignora `sessionId`; cria nova conversation.

<!-- section: Clarifications -->
## Clarifications

> Resolvidas em auto-mode.

- **cl-1 — node-pty vs child_process.** **Decidido:** `child_process` em modo `-p`. **Rationale:** node-pty exige nova dep NPM + binding nativo (brief §7 proíbe sem aprovar). Modo `-p` streama via stdout — cobre 90% dos casos. PTY/interativo em feature futura quando justificar.
- **cl-2 — Embedar extensão vs spawn.** **Decidido:** spawn CLI direto. **Rationale:** "extensão Claude Code" é wrapper visual sobre o mesmo CLI. Spawnar evita acoplar a uma extensão de terceiro com lifecycle próprio.
- **cl-3 — Modo interativo multi-turn.** **Decidido:** via `--resume`, não via PTY. **Rationale:** ver cl-1.
- **cl-4 — Timeout default.** **Decidido:** 300s. **Rationale:** prompts com tool use podem levar minutos; consumer pode subir via `timeoutMs`.
- **cl-5 — Output buffering.** **Decidido:** bridge emite chunks E concatena para `result.stdout/stderr`. **Rationale:** consumer escolhe streaming ou resultado final.
- **cl-6 — `extraArgs`.** **Decidido:** aceita array passado pelo consumer; bridge não filtra args, confia no caller. Doc-comment avisa sobre flags perigosas (`--dangerously-skip-permissions`).
- **cl-7 — `stationId` vs `sessionId`.** **Decidido:** N sessões por station possíveis. `stationId` agrupa; `sessionId` é UUID único do bridge.

<!-- section: Data touched -->
## Dados tocados

- **Novos:** `src/vs/platform/nzr/common/claudeCode.ts`, `claudeCodeBridge.ts`, `src/vs/workbench/services/nzr/electron-browser/claudeCodeBridge.ts`, `src/vs/workbench/services/nzr/test/common/claudeCodeBridge.test.ts`, `test/nzrcode-claude/*`.
- **Modificados:** `src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts` (adiciona segundo `registerSingleton`).
- **Intocados:** todo restante.

<!-- section: Out-of-band effects -->
## Efeitos out-of-band

Spawn de processos `claude`. Sem rede direta (CLI chama API Anthropic). Não escreve arquivos.

<!-- section: Open risks -->
## Riscos abertos

- **`claude` ausente do PATH** — graceful via Story 1 cenário 4.
- **Sessões zombie** — SIGKILL fallback mitiga; crash recovery aceita orphans.
- **Output rate** — UI consumer faz batching (resp. da 0007).
- **Cost tracking** — feature dedicada futura.
- **Mocha não roda nesta sessão** — mesmo blocker.

<!-- section: Traceability -->
## Traceability

- Originating: brief §6.5.
- Related: 0003 (stationId), 0004 (adapter pattern), 0007 (UI consumer).
- Constitution articles: I, II, III, V.
