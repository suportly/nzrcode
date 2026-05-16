# Feature specification: AIADev CLI adapter + spec watcher

**Branch:** `feature/0004-aiadev-adapter`
**Created:** 2026-05-14
**Status:** Draft
**Spec ID:** 0004
**Language:** pt-BR

---

<!-- section: Problem -->
## Problema

`IStationRegistryService` (0003) sabe quais stations existem mas não tem nenhuma forma de progredir o pipeline AIADev (`specify → clarify → plan → tasks → implement`). Hoje, mudar `pipeline.stage` exige call manual via DI — não há nada que (a) execute o CLI `aiadev` no diretório da station, (b) detecte que um novo `specs/<slug>/spec.md` foi gerado, (c) extraia `[NEEDS CLARIFICATION:cl-N ...]` markers, ou (d) emita eventos para um futuro `GateQueueService` (0008) consumir. Esta feature entrega **o adapter de baixo nível** — sem orquestração de fluxo completo, sem UI: apenas spawn-CLI + watch-FS + parse + eventos. Pré-requisito mecânico de 0005 (claude-code-bridge) e 0008 (gate-queue-panel).

<!-- section: Reconnaissance -->
## Reconnaissance

- **child_process via Node** — entry: `src/vs/base/node/processes.ts` linhas 6, 161 (`import * as cp from 'child_process'; cp.spawn(...)`) · auth: `none` · integration: padrão é `electron-browser` ou `node/` layer para serviços que precisam spawn; renderer pode usar Node via Electron context isolation.
- **IFileService.onDidFilesChange / watch()** — entry: `src/vs/platform/files/common/files.ts` linha 95, 251 · integration: `fileService.watch(URI, opts)` retorna `IDisposable`; eventos via `onDidFilesChange: Event<FileChangesEvent>`. Já injetado no `StationRegistryService` (0003), padrão estabelecido.
- **aiadev CLI binário** — entry: `/home/alairjt/.local/bin/aiadev` (verificado nesta sessão; instalado globalmente via pip). Versão 0.18.0. Subcomandos relevantes: `aiadev preflight <skill> --feature <slug>`, `aiadev validate`, `aiadev sync`. Os skills `specify`, `clarify`, `plan`, `tasks`, `implement` são invocados via slash commands `/aia:*` dentro do Claude Code — **não** diretamente pelo CLI. CLI cobre apenas operações estruturais (init, sync, validate, preflight).
- **Marker format** — entry: spec generated em features 0001/0002/0003 (`[NEEDS CLARIFICATION:cl-N <texto>]`). Regex canônica: `\[NEEDS CLARIFICATION:(cl-\d+)\s+([^\]]+)\]`. Texto pode conter aspas, espaços, mas não `]`.
- **Section anchors** — entry: `templates/spec-template.md` linhas 19, 22 etc. (`<!-- section: <name> -->`). Markers vivem dentro de `## Clarifications` section típicamente.

**Recon refute / corrige assumption do brief §6.4**: o CLI `aiadev` **não** executa `specify`/`clarify`/`plan`/`tasks`/`implement` como subcomandos diretos — esses são skills do Claude Code (slash commands). O adapter desta feature foca em (1) operações estruturais via CLI (`preflight`, `validate`, `sync`, `init`), (2) watch FS + parse markers, (3) eventos tipados. Spawning o Claude Code para rodar slash commands é trabalho da feature 0005 (claude-code-bridge).

<!-- section: Users and stakeholders -->
## Usuários e stakeholders

- **GateQueueService (0008)** — assinará `onClarifyMarkersDetected` para popular o painel global de gates.
- **Mission Control shell (0006)** — usa `runPreflight()` antes de cada transição de stage para validar artefatos.
- **claude-code-bridge (0005)** — vai disparar `runSync()` após o Claude alterar arquivos do `.claude/`.
- **Mantenedor** — quer adapter testado headless antes que UI dependa dele.

<!-- section: Success criteria -->
## Critérios de sucesso

- `src/vs/platform/nzr/common/aiadev.ts` exporta types: `AiadevCommand` (literal union dos subcomandos suportados), `AiadevResult` (`{ ok: boolean; stdout: string; stderr: string; exitCode: number; durationMs: number }`), `ClarifyMarkerDetectedEvent`, `SpecChangedEvent`.
- `src/vs/platform/nzr/common/aiadevAdapter.ts` exporta `IAiadevAdapter` decorator + interface com: `runPreflight(args)`, `runValidate(cwd)`, `runSync(cwd)`, `runInit(args)`, `parseClarifyMarkers(content: string): ClarifyMarker[]`, `attachSpecWatcher(stationId, repoPath): IDisposable`, eventos `onClarifyMarkersDetected`, `onSpecChanged`, `onAdapterError`.
- `src/vs/workbench/services/nzr/electron-browser/aiadevAdapter.ts` implementa o service usando `child_process.spawn` (limite de 30s por invocação, timeout configurável). Workspace path resolved via `IWorkspaceContextService`; falha clean se `aiadev` não está no PATH.
- `parseClarifyMarkers` é função pura (não toca DI / FS) com testes mocha cobrindo: marker simples, múltiplos markers (ids monotônicos), markers em linhas separadas, conteúdo com aspas/colchetes aninhados (parsing greedy until `]`), markers ausentes (retorna `[]`).
- `attachSpecWatcher(stationId, repoPath)` registra um watcher em `<repoPath>/specs/**/spec.md` via `IFileService.watch`; quando um arquivo muda, lê o conteúdo, extrai markers, emite `onClarifyMarkersDetected({stationId, specPath, markers})` se há ≥ 1; emite `onSpecChanged({stationId, specPath})` sempre. Retorna `IDisposable`.
- `src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts` registra singleton (`registerSingleton(IAiadevAdapter, AiadevAdapter, InstantiationType.Delayed)`).
- `src/vs/workbench/workbench.desktop.main.ts` (desktop-only main) importa a contribution.
- Suite mocha `src/vs/workbench/services/nzr/test/common/clarifyMarkerParser.test.ts` cobre os 5 casos.
- Suite shell `test/nzrcode-adapter/run_all.sh` GREEN: existência de arquivos, shape do interface, registro do singleton.
- Diff toca apenas: 4 arquivos novos sob `src/vs/{platform,workbench/services}/nzr/`, 1 arquivo modificado (`workbench.desktop.main.ts`). Sem regressão em 0001/0002/0003.

<!-- section: Non-goals -->
## Não-goals

- **Orquestração de fluxo completo** — `runSpecify → wait → onSpecReady → runPlan...`. Esse loop é responsabilidade da Mission Control shell (0006); o adapter é primitivo.
- **Spawn do Claude Code** — feature 0005 (`claude-code-bridge`). Esta feature foca no `aiadev` CLI estrutural.
- **Gate queue panel** — feature 0008. Esta feature **emite** eventos; o queue (e a UI) consome.
- **Persistência de output do CLI** — logs do CLI são in-memory + retornados sincronamente. Persistir output completo de runs é feature de telemetria/log futura.
- **Editor inline de `[NEEDS CLARIFICATION]` markers** — só detecção/parsing. Edição via Claude Code (feature 0005).
- **Rate-limiting / queue de invocações concorrentes** — `runPreflight` é idempotente e seguro a paralelizar; queue management fica out-of-scope.

<!-- section: User stories -->
## User stories

### Story 1 — Spawn `aiadev` CLI estrutural com timeout (P1)

Como **Mission Control shell**, eu quero invocar `aiadev preflight plan --feature 0007-stripe` antes de progredir uma station de `plan` para `tasks`, para que artefatos faltantes apareçam como erro de gate em vez de explodir o pipeline.

**Acceptance:**

1. **Given** o service injetado, **When** chamo `runPreflight({ skill: 'plan', feature: '0007-stripe', cwd: '/repos/x' })`, **Then** retorna `Promise<AiadevResult>` com `ok: true|false`, `exitCode`, `stdout`, `stderr`, `durationMs`.
2. **Given** o CLI excede o timeout (default 30s), **When** o adapter detecta, **Then** mata o processo (SIGTERM, depois SIGKILL após 5s), retorna `{ ok: false, exitCode: -1, stderr: contendo "timeout" }`.
3. **Given** `aiadev` não está no PATH, **When** chamo qualquer `run*`, **Then** retorna `{ ok: false, exitCode: -1, stderr: contendo "aiadev binary not found" }` em vez de jogar exception.

### Story 2 — Parse de `[NEEDS CLARIFICATION]` markers (P1)

Como **Mission Control shell** (e futuro GateQueueService), eu quero extrair markers estruturados de `spec.md` sem regex local ad-hoc, para garantir parsing consistente em todo lugar que lê specs.

**Acceptance:**

1. **Given** uma string contendo `[NEEDS CLARIFICATION:cl-1 Qual TZ usar?]`, **When** chamo `parseClarifyMarkers(content)`, **Then** retorna `[{ id: 'cl-1', question: 'Qual TZ usar?', section: '...' }]` onde `section` é o último heading `## ...` antes do marker.
2. **Given** string com 3 markers (`cl-1`, `cl-2`, `cl-3`) em seções diferentes, **When** chamo `parseClarifyMarkers`, **Then** retorna 3 entries em ordem de aparição com `section` correto cada.
3. **Given** string sem nenhum marker, **When** chamo `parseClarifyMarkers`, **Then** retorna `[]` (não `null`, não throw).
4. **Given** marker malformado (`[NEEDS CLARIFICATION: sem cl-N]` ou `[NEEDS CLARIFICATION:cl- ...]`), **When** chamo `parseClarifyMarkers`, **Then** ignora silenciosamente; retorna apenas markers bem-formados.
5. **Given** marker cuja question contém colchete escapado `\]` ou aspas, **When** chamo `parseClarifyMarkers`, **Then** parsing termina no primeiro `]` não-escapado e captura tudo até lá.

### Story 3 — Watcher de `specs/` por station (P1)

Como **Mission Control shell**, eu quero que mudanças em `specs/<slug>/spec.md` disparem um evento tipado, para que a UI redesenhe sem polling.

**Acceptance:**

1. **Given** `attachSpecWatcher('station-a', '/repos/x')`, **When** o arquivo `/repos/x/specs/0007-foo/spec.md` é modificado (write/create/delete), **Then** o adapter emite `onSpecChanged({ stationId: 'station-a', specPath: 'specs/0007-foo/spec.md', kind: 'modified'|'created'|'deleted' })`.
2. **Given** mesmo cenário com markers presentes, **When** o conteúdo pós-mudança tem ≥ 1 marker, **Then** emite **adicionalmente** `onClarifyMarkersDetected({ stationId, specPath, markers })` com array dos markers.
3. **Given** mudanças em arquivos fora de `specs/**/spec.md` (ex: `README.md`), **When** o watcher recebe o evento, **Then** **não** emite nada (filter no path).
4. **Given** `attachSpecWatcher` retornou um `IDisposable`, **When** chamo `dispose()`, **Then** o watcher para de emitir eventos e libera o handle do `IFileService.watch`.

<!-- section: Clarifications -->
## Clarifications

> Resolvidas em auto-mode.

- **cl-1 — Brief lista `specify`/`clarify`/`plan`/`tasks`/`implement` como subcomandos.** **Decidido:** ajustar escopo. Esses são skills do Claude Code (slash commands), não subcomandos do `aiadev` CLI (verificado via `aiadev --help`). Feature 0004 entrega adapter para os subcomandos REAIS (`preflight`, `validate`, `sync`, `init`) + parser de markers + watcher. Disparo dos slash commands fica para feature 0005 (claude-code-bridge).
- **cl-2 — Layer (`platform/nzr/node/` vs `workbench/services/nzr/electron-browser/`).** **Decidido:** interface em `platform/nzr/common/`; impl em `workbench/services/nzr/electron-browser/` (consistente com 0003). **Rationale:** depende de `IWorkspaceContextService` (workbench-only); spawn de child_process funciona em renderer-with-Node.
- **cl-3 — Timeout default.** **Decidido:** 30000ms; configurável via segundo arg. **Rationale:** preflight típico < 1s; `aiadev validate` pode levar até 10s em projetos grandes. 30s deixa margem com kill graceful (SIGTERM) + force (SIGKILL após 5s).
- **cl-4 — `aiadev` binary path resolution.** **Decidido:** usa `which aiadev` via Node ou tenta `process.env.PATH` direto via spawn. Se falhar, retorna result com `exitCode: -1` e mensagem clara. **Rationale:** falha silenciosa é pior; usuário precisa saber para instalar.
- **cl-5 — Section anchor extraction no parser.** **Decidido:** `section` é o último `## <heading>` (level 2, sem sub-níveis) antes do marker. **Rationale:** templates AIADev usam `## Clarifications` consistentemente; ignorar sub-headings simplifica regex.
- **cl-6 — File watcher pattern.** **Decidido:** glob `<repoPath>/specs/*/spec.md` exato (1 nível abaixo de `specs/`). **Rationale:** convenção AIADev — specs vivem em `specs/<NNNN-slug>/spec.md`. Watchers profundos (`**/spec.md`) podem pegar arquivos não-NZR.
- **cl-7 — Eventos de erro.** **Decidido:** `onAdapterError` emite `{stationId?, kind: 'spawn-failed'|'parse-failed'|'watch-failed', error: string}`. Stations não-relacionadas a um spawn (ex: parser puro) usam `stationId: undefined`. **Rationale:** UI quer mostrar erros sem ter que catch em cada ponto.

<!-- section: Data touched -->
## Dados tocados

- **Novos:**
  - `src/vs/platform/nzr/common/aiadev.ts` — types + result/event shapes.
  - `src/vs/platform/nzr/common/aiadevAdapter.ts` — `IAiadevAdapter` decorator + interface.
  - `src/vs/workbench/services/nzr/electron-browser/aiadevAdapter.ts` — impl.
  - `src/vs/workbench/services/nzr/common/clarifyMarkerParser.ts` — função pura `parseClarifyMarkers`.
  - `src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts` — registerSingleton.
  - `src/vs/workbench/services/nzr/test/common/clarifyMarkerParser.test.ts` — mocha.
  - `test/nzrcode-adapter/` — suite shell (4 sub-tests + run_all + README).
- **Modificados:**
  - `src/vs/workbench/workbench.desktop.main.ts` — import da nova contribution.
- **Intocados:** `src/vs/workbench/contrib/`, todo restante. Esta feature não tem UI.

<!-- section: Out-of-band effects -->
## Efeitos out-of-band

- Spawn de processo `aiadev` em filesystem do usuário — limite por timeout, output capturado em memory. Não escreve arquivos.
- Watcher cria handles via `IFileService.watch` — disposed com `IDisposable`.

<!-- section: Open risks -->
## Riscos abertos

- **`aiadev` ausente do PATH** — degrada graceful via Story 1 cenário 3; não breaks o workbench.
- **Concurrent spawns de muitos stations** — sem queue, N stations rodando `runPreflight` paralelo geram N processos. Aceitável para N ≤ 10; queue/throttling fica para feature de polish.
- **Watcher de glob não-suportado nativamente em todos os FS** — Linux/macOS via inotify/FSEvents ok; Windows pode ter latência maior. `IFileService.watch` já abstrai; aceitamos.
- **Mocha test não executa nesta sessão** — mesmo blocker das features anteriores. Smoke shell + parser puro testável manualmente.

<!-- section: Traceability -->
## Traceability

- Originating issue: NZRCode Implementation Brief §6.4 (com ajuste de escopo registrado em cl-1).
- Related specs: 0003 (consumer via stationId), 0005 (claude-code-bridge, próximo), 0008 (gate queue, consumer dos eventos).
- Constitution articles invoked: I, II, III.
