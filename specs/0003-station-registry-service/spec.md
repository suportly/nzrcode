# Feature specification: IStationRegistryService

> Skill `specify`. Foco em **o quê** e **por quê**.

**Branch:** `feature/0003-station-registry-service`
**Created:** 2026-05-14
**Status:** Draft
**Spec ID:** 0003
**Language:** pt-BR

---

<!-- section: Problem -->
## Problema

A Mission Control de NZRCode é composta por "stations" — uma estação por repositório aberto, cada uma rodando seu próprio pipeline AIADev `specify → clarify → plan → tasks → implement`. Hoje não existe nem o conceito de "station" no código: features 0006+ (Mission Control shell, station view, gate queue) precisam pendurar UI numa fonte de verdade que (a) sabe quais stations existem, (b) persiste a coleção entre boots e (c) emite eventos quando o estado de uma station muda. Sem esse serviço, cada UI futura inventaria seu próprio store local e perderíamos coerência. Esta feature entrega **apenas o serviço headless** — sem UI, sem comandos, sem registro de view; valida via testes unitários + smoke tests de estrutura. Pre-requisito mecânico de 0006, 0007, 0008.

<!-- section: Reconnaissance -->
## Reconnaissance

- **Padrão de service DI** — entry: `src/vs/platform/storage/common/storage.ts` linhas 12, 19 (`createDecorator<IStorageService>('storageService')`) · auth: `none` · integration: serviços do platform-level exportam `const IServiceName = createDecorator<...>(...)` + interface; implementação é registrada via `registerSingleton(IServiceName, ImplClass, InstantiationType)` num `*.contribution.ts`.
- **IFileService** — entry: `src/vs/platform/files/common/files.ts` · integration: API canônica para leitura/escrita de arquivo em workbench (não usar `fs` direto). Aceita `URI`, retorna `Promise<IFileContent>`.
- **IWorkspaceContextService** — entry: `src/vs/platform/workspace/common/workspace.ts` linhas 1-3 do `createDecorator` · integration: `getWorkspace().folders[0].uri` dá o root path do workspace ativo. Sem workspace (modo single-file), `folders` é vazio.
- **Eventos** — entry: `src/vs/base/common/event.ts` · integration: padrão `private readonly _onDidChange = new Emitter<T>(); readonly onDidChange = this._onDidChange.event;` é standard em todo o codebase.
- **Testes mocha** — entry: `src/vs/platform/configuration/test/common/configurationService.test.ts` (referência) · integration: `suite(...)`, `test(...)`, `assert.*` (não-DOM); arquivos `.test.ts` em `src/vs/platform/<service>/test/<layer>/` rodam via `npm test` no VS Code build.
- **Registro de singleton** — entry: `src/vs/platform/instantiation/common/extensions.ts` (`registerSingleton`) · integration: chamado em arquivos `*.contribution.ts` que são importados por `workbench.common.main.ts` ou `workbench.desktop.main.ts`.
- **Workspace já lê config próprio** — entry: `src/vs/workbench/services/configuration/browser/configurationService.ts` · integration: lê `.vscode/settings.json` automaticamente. Nosso `.nzrcode/workspace.json` é arquivo paralelo — mesma raiz de workspace, schema próprio.

<!-- section: Users and stakeholders -->
## Usuários e stakeholders

- **Mission Control shell (feature 0006+)** — consome a API listando stations e ouvindo eventos para repaintar o grid.
- **Station view (0007)** — recebe uma `Station` pelo id e renderiza head/body/footer com base em `pipeline.stage` e `pipeline.blocked`.
- **AIADev adapter (0004)** — vai atualizar pipeline state das stations via este service quando o CLI emite stage changes.
- **Mantenedor** — quer um serviço bem testado antes que features UI dependam dele.

<!-- section: Success criteria -->
## Critérios de sucesso

- `src/vs/platform/nzr/common/pipelineState.ts` exporta os types `PipelineStage`, `PipelineState`, `Station`, `SpecRef`, `GateReason`, `ClarifyMarker`, `ReviewFinding` exatamente como definidos no brief §4.
- `src/vs/platform/nzr/common/stationRegistry.ts` exporta `IStationRegistryService` decorator + interface com pelo menos: `getStations(): readonly Station[]`, `getStation(id: string): Station | undefined`, `addStation(input: NewStationInput): Promise<Station>`, `removeStation(id: string): Promise<boolean>`, `updateStationPipeline(id: string, patch: Partial<PipelineState>): Promise<void>`, e os 3 eventos do brief: `onStationAdded`, `onStationRemoved`, `onStationStageChanged`.
- `src/vs/workbench/services/nzr/common/stationRegistryService.ts` implementa o service usando `IFileService` (não `fs` direto) e `IWorkspaceContextService`, persistindo em `<workspace>/.nzrcode/workspace.json`.
- `src/vs/workbench/services/nzr/common/nzr.contribution.ts` registra singleton (`registerSingleton(IStationRegistryService, StationRegistryService, InstantiationType.Delayed)`).
- `src/vs/workbench/workbench.common.main.ts` (ou desktop main) importa a contribution para forçar evaluation no boot.
- `src/vs/platform/nzr/test/common/stationRegistry.test.ts` cobre ao menos: add → emite `onStationAdded`, remove → emite `onStationRemoved`, updateStationPipeline com mudança de stage → emite `onStationStageChanged`, persiste após write (round-trip).
- Suite shell `test/nzrcode-stations/run_all.sh` GREEN: confirma existência dos arquivos, presença das chaves no interface (grep), `tsc --noEmit` sobre os arquivos novos sem erros.
- Diff toca apenas: criar 5 arquivos sob `src/vs/{platform,workbench/services}/nzr/`, modificar 1 arquivo (`workbench.common.main.ts` ou similar) para importar a contribution. Suites de 0001 + 0002 continuam GREEN.

<!-- section: Non-goals -->
## Não-goals

- **UI de stations** — feature 0007 (`station-view`).
- **Comandos / command palette** — feature 0010 (`add-station-palette`).
- **Spawn de processo Claude / claudeProcess** — feature 0005 (`claude-code-bridge`). Esta feature deixa `claudeProcess?: ClaudeProcess` opcional, sem implementação concreta de `ClaudeProcess` além de placeholder type.
- **AIADev CLI integration / spec watcher** — feature 0004. Esta feature aceita `updateStationPipeline()` mas não detecta mudanças.
- **Gate queue** — feature 0008 (`gate-queue-panel`). Esta feature define `GateReason` type mas não implementa o queue service.
- **Sync entre stations cross-workspace** — não-goal explícito; cada workspace tem seu `.nzrcode/workspace.json` isolado.

<!-- section: User stories -->
## User stories

### Story 1 — CRUD via service (P1)

Como **Mission Control shell**, eu quero adicionar/remover/atualizar stations via um serviço DI-injected, para que toda UI consuma a mesma fonte de verdade.

**Acceptance:**

1. **Given** o service instanciado num test, **When** chamo `addStation({ repoPath: '/repo/a', branch: 'main', preset: 'lean' })`, **Then** retorna uma `Station` com `id` UUID v4, `repoName` = `'a'` (derivado), `pipeline.stage === 'idle'`, e `getStations()` agora a inclui.
2. **Given** uma station adicionada, **When** chamo `removeStation(station.id)`, **Then** retorna `true`, `getStation(id)` retorna `undefined`, e `getStations()` não a inclui mais. Remover id inexistente retorna `false`.
3. **Given** uma station com `pipeline.stage === 'idle'`, **When** chamo `updateStationPipeline(id, { stage: 'specify' })`, **Then** `getStation(id)?.pipeline.stage === 'specify'`.

### Story 2 — Eventos tipados (P1)

Como **station view**, eu quero ouvir `onStationStageChanged` para repaintar quando o pipeline avança, sem ter que pollar o service.

**Acceptance:**

1. **Given** test ouve `onStationAdded`, **When** `addStation(...)` é chamado, **Then** o handler é invocado uma vez com `(station: Station)` cujo `id` bate.
2. **Given** test ouve `onStationRemoved`, **When** `removeStation(id)` é chamado, **Then** handler invocado com `(stationId: string)` igual a `id`. Remover id inexistente NÃO emite o evento.
3. **Given** test ouve `onStationStageChanged`, **When** `updateStationPipeline(id, { stage: 'plan' })` muda o stage, **Then** handler invocado com `({ stationId, previous, next })` onde `previous === 'idle'`, `next === 'plan'`. Atualizar pipeline sem mudar stage (ex: só `tasksDone`) NÃO emite stage event.

### Story 3 — Persistência round-trip (P1)

Como **mantenedor**, eu quero que stations sobrevivam a reload da janela, para que o usuário não tenha que re-criar suas stations a cada boot.

**Acceptance:**

1. **Given** workspace recém-aberto sem `.nzrcode/workspace.json`, **When** instancio o service, **Then** `getStations()` retorna array vazio (sem erro de arquivo ausente).
2. **Given** duas stations adicionadas via `addStation`, **When** o arquivo `<workspace>/.nzrcode/workspace.json` é lido por outro processo, **Then** contém `{ version: 1, stations: [{...}, {...}] }` JSON válido com `version` numérico (não-zero).
3. **Given** `.nzrcode/workspace.json` pré-existente com uma station serializada, **When** instancio o service em workspace novo, **Then** `getStations()` retorna a station carregada (id, repoPath, branch, preset, pipeline preservados).
4. **Given** modo single-file (sem workspace folder), **When** instancio o service, **Then** `getStations()` retorna `[]` e `addStation()` rejeita com erro claro `"no workspace folder"` — não tenta escrever em `/` ou cwd.

<!-- section: Clarifications -->
## Clarifications

> Resolvidas em auto-mode.

- **cl-1 — Local do serviço.** **Decidido:** interface + types em `src/vs/platform/nzr/common/`; implementação em `src/vs/workbench/services/nzr/common/`. **Rationale:** brief §5 lista os dois locais; segue o padrão upstream (storage, configuration). Implementação está em `workbench/services` porque depende de `IWorkspaceContextService` (workbench-only).
- **cl-2 — Persistence vs IStorageService vs file.** **Decidido:** arquivo `<workspace>/.nzrcode/workspace.json` via `IFileService`. **Rationale:** brief §2 ponto 3 explicita "esse arquivo é a fonte da verdade"; storage service guardaria por workspace mas não num arquivo visível ao usuário, o que pode confundir debug. Arquivo permite o usuário inspecionar / versionar.
- **cl-3 — Encoding JSON: pretty ou minified.** **Decidido:** pretty-printed com indent 2. **Rationale:** arquivo é editável/inspecionável pelo usuário; ~2KB extra é trivial.
- **cl-4 — Schema versioning.** **Decidido:** `{ version: 1, stations: [...] }` envelope. **Rationale:** primeiro write já versiona; migrations futuras inspecionam `version` para evoluir schema sem quebrar leituras antigas.
- **cl-5 — Workspace multi-folder.** **Decidido:** usa apenas o **primeiro folder** do workspace (`getWorkspace().folders[0]`). **Rationale:** mantém escopo simples; multi-folder stations é feature futura. Para multi-folder no curto prazo, o `.nzrcode/workspace.json` mora na primeira pasta — documentado no spec.
- **cl-6 — Writes concorrentes.** **Decidido:** debounce de 250ms em writes; mutations CRUD são sequenciais via `Promise.resolve().then(...)` queue interna; conflito de processo externo escrevendo no mesmo arquivo NÃO é tratado (caso raro, fora de scope). **Rationale:** simplicidade. Mission Control não vai ter writers concorrentes além do próprio service.
- **cl-7 — `claudeProcess` e `metrics`.** **Decidido:** `ClaudeProcess` type é `interface ClaudeProcess { pid?: number; status: 'starting' | 'running' | 'crashed' | 'idle' }` (placeholder; impl real em 0005); `metrics` começa zerado `{ tokens: 0, cost: 0, startedAt: Date.now() }`. **Rationale:** types precisam existir para Station compilar; valores reais vêm depois.
- **cl-8 — Mocha test executável aqui?** **Decidido:** não tentar rodar `npm test` nesta sessão (custo alto, mesmo problema da 0001-T012). Mocha test é commitado; CI roda quando ambiente estiver pronto. Smoke shell faz cobertura estrutural agora.

<!-- section: Data touched -->
## Dados tocados

- **Novos:**
  - `src/vs/platform/nzr/common/pipelineState.ts` — types.
  - `src/vs/platform/nzr/common/stationRegistry.ts` — `IStationRegistryService` + decorator.
  - `src/vs/workbench/services/nzr/common/stationRegistryService.ts` — implementação.
  - `src/vs/workbench/services/nzr/common/nzr.contribution.ts` — `registerSingleton`.
  - `src/vs/platform/nzr/test/common/stationRegistry.test.ts` — mocha unit tests.
  - `test/nzrcode-stations/` — suite shell: `test_files_exist.sh`, `test_interface_shape.sh`, `test_typecheck.sh`, `run_all.sh`, `README.md`.
- **Modificados:**
  - `src/vs/workbench/workbench.common.main.ts` (ou `workbench.desktop.main.ts` — recon escolhe) — adicionar `import './services/nzr/common/nzr.contribution.js';`.
- **Intocados:** `src/vs/workbench/contrib/`, todo restante de `src/vs/editor/`, todo `extensions/`, `product.json`, `resources/`. Esta feature não tem UI.

<!-- section: Out-of-band effects -->
## Efeitos out-of-band

- Cria arquivo `.nzrcode/workspace.json` no primeiro `addStation()` em cada workspace. Diretório `.nzrcode/` criado se ausente. Nenhuma rede, nenhuma API externa.

<!-- section: Open risks -->
## Riscos abertos

- **`tsc --noEmit` aqui não inclui type checking completo do VS Code** — arquivos isolados podem compilar mesmo importando algo que não existe. Mitigação: dev build manual (T012-equivalente) quando ambiente estiver disponível.
- **registerSingleton no momento errado** — se a contribution não for importada por main, o service nunca é instanciado. Mitigação: smoke test grepa o import em `workbench.common.main.ts`.
- **Workspace multi-folder edge case** — feature 0011+ pode precisar de stations por folder; aceitamos a simplificação do cl-5 por agora.
- **`.nzrcode/workspace.json` pode entrar em conflito com merge git** — não-goal de mitigar nesta feature; documentar.

<!-- section: Traceability -->
## Traceability

- Originating issue: NZRCode Implementation Brief §6.3.
- Related specs: 0004 (`aiadev-adapter` usa `updateStationPipeline`), 0005 (`claude-code-bridge` preenche `claudeProcess`), 0006/0007/0008 (consumidores UI).
- Constitution articles invoked: I, II, III.
