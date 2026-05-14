# Tasks: AIADev CLI adapter + spec watcher

**Branch:** `feature/0004-aiadev-adapter`
**Plan:** [plan.md](./plan.md)
**Generated:** 2026-05-14
**Language:** pt-BR

---

## Task list

### T001 — Smoke tests + mocha stub (RED)

- **Status:** done
- **Depends on:** —
- **Files:**
  - create: `test/nzrcode-adapter/test_files_exist.sh`
  - create: `test/nzrcode-adapter/test_interface_shape.sh`
  - create: `test/nzrcode-adapter/test_parser.sh`
  - create: `test/nzrcode-adapter/test_registration.sh`
  - create: `test/nzrcode-adapter/run_all.sh`
  - create: `test/nzrcode-adapter/README.md`
  - create: `src/vs/workbench/services/nzr/test/common/clarifyMarkerParser.test.ts` (stub)
- **Spec scenarios:** Stories 1-3
- **Acceptance:**
  - [ ] `test_files_exist.sh`: 6 arquivos `.ts` (aiadev, aiadevAdapter, clarifyMarkerParser, aiadevAdapter electron, nzr.electron.contribution, mocha test) existem.
  - [ ] `test_interface_shape.sh`: `aiadev.ts` exporta `AiadevCommand`, `AiadevResult`; `aiadevAdapter.ts` declara `IAiadevAdapter` decorator + 3 eventos (`onClarifyMarkersDetected`, `onSpecChanged`, `onAdapterError`) + 5 métodos (`runPreflight`, `runValidate`, `runSync`, `runInit`, `attachSpecWatcher`).
  - [ ] `test_parser.sh`: roda **manualmente** uma fixture pequena via `node -e` que importa o parser e checa 3 casos básicos (1 marker, 0 markers, malformed). Quando parser ainda não existe, falha com mensagem clara.
  - [ ] `test_registration.sh`: `nzr.electron.contribution.ts` chama `registerSingleton(IAiadevAdapter, ...)`; `workbench.desktop.main.ts` importa o arquivo.
  - [ ] `run_all.sh` agrega; exit 1 (RED).
  - [ ] Commit: `test(nzr-adapter): T001 add adapter smoke suite + mocha stub (RED)`.

### T002 — Pure parser

- **Status:** done
- **Depends on:** T001
- **Files:**
  - create: `src/vs/workbench/services/nzr/common/clarifyMarkerParser.ts`
- **Spec scenarios:** Story 2.1-2.5
- **Acceptance:**
  - [ ] Exporta `parseClarifyMarkers(content: string): ClarifyMarker[]`.
  - [ ] Regex captura `[NEEDS CLARIFICATION:cl-N <question>]` onde `N` é dígito(s) e `<question>` vai até primeiro `]` não-escapado.
  - [ ] `section` é o último `## <heading>` (level 2) antes do marker; se não há, `section = ''`.
  - [ ] Malformed markers (sem `cl-N`, ou `cl-` sem número) são silenciosamente ignorados.
  - [ ] Header NZRCode + MIT.
  - [ ] `test_parser.sh` GREEN para 3 casos básicos.
  - [ ] Commit: `feat(nzr): T002 add clarifyMarkerParser pure function`.

### T003 — Mocha test do parser (5 casos)

- **Status:** done
- **Depends on:** T002
- **Files:**
  - modify: `src/vs/workbench/services/nzr/test/common/clarifyMarkerParser.test.ts`
- **Spec scenarios:** Story 2.1-2.5
- **Acceptance:**
  - [ ] Suite `clarifyMarkerParser` com 5 tests:
    1. marker simples retorna 1 entry com id+question+section.
    2. 3 markers (`cl-1`, `cl-2`, `cl-3`) em seções diferentes retornam 3 entries em ordem.
    3. conteúdo sem markers retorna `[]`.
    4. markers malformados (sem `cl-N`, `cl-` vazio) são ignorados; resto parseia.
    5. question contendo aspas/escape termina no primeiro `]` real.
  - [ ] Usa `assert` + `suite`/`test` patterns do upstream.
  - [ ] Commit: `test(nzr): T003 add parseClarifyMarkers behavioural tests`.

### T004 — Types + interface

- **Status:** done
- **Depends on:** T003
- **Files:**
  - create: `src/vs/platform/nzr/common/aiadev.ts`
  - create: `src/vs/platform/nzr/common/aiadevAdapter.ts`
- **Spec scenarios:** Stories 1, 3
- **Acceptance:**
  - [ ] `aiadev.ts` exporta:
    - `type AiadevCommand = 'preflight' | 'validate' | 'sync' | 'init'`
    - `interface AiadevResult { ok: boolean; stdout: string; stderr: string; exitCode: number; durationMs: number }`
    - `interface SpecChangedEvent { stationId: string; specPath: string; kind: 'created' | 'modified' | 'deleted' }`
    - `interface ClarifyMarkersDetectedEvent { stationId: string; specPath: string; markers: ClarifyMarker[] }`
    - `interface AdapterError { stationId?: string; kind: 'spawn-failed' | 'parse-failed' | 'watch-failed' | 'timeout'; error: string }`
    - `interface RunArgs { cwd: string; timeoutMs?: number }`
    - `interface PreflightArgs extends RunArgs { skill: string; feature: string }`
    - `interface InitArgs extends RunArgs { feature: string; branch?: string; language?: string }`
  - [ ] `aiadevAdapter.ts` exporta `IAiadevAdapter = createDecorator<IAiadevAdapter>('nzrAiadevAdapter')` + interface com 3 eventos + 5 métodos: `runPreflight(args: PreflightArgs)`, `runValidate(args: RunArgs)`, `runSync(args: RunArgs)`, `runInit(args: InitArgs)`, `attachSpecWatcher(stationId: string, repoPath: string): IDisposable`.
  - [ ] `test_interface_shape.sh` GREEN.
  - [ ] Commit: `feat(nzr): T004 add IAiadevAdapter interface and types`.

### T005 — Electron impl: spawn + watcher

- **Status:** done
- **Depends on:** T004
- **Files:**
  - create: `src/vs/workbench/services/nzr/electron-browser/aiadevAdapter.ts`
- **Spec scenarios:** Story 1.1-1.3, Story 3.1-3.4
- **Acceptance:**
  - [ ] Classe `AiadevAdapter extends Disposable implements IAiadevAdapter`.
  - [ ] Injeta `IFileService`. Não injeta workspace pq cwd vem nos args.
  - [ ] `runPreflight`, `runValidate`, `runSync`, `runInit` chamam helper `_spawn(args: string[], cwd: string, timeoutMs: number): Promise<AiadevResult>`.
  - [ ] `_spawn` usa `cp.spawn('aiadev', args, { cwd, shell: false })`; coleta stdout/stderr; mede `Date.now()` antes/depois; timeout via `setTimeout(() => child.kill('SIGTERM'), timeoutMs)` + segundo timer 5s para SIGKILL.
  - [ ] Erros (ENOENT, spawn falha): retorna `{ ok: false, exitCode: -1, stderr: '<msg>' }` em vez de throw.
  - [ ] `attachSpecWatcher(stationId, repoPath)`: usa `_fileService.watch(URI.file(repoPath + '/specs'), { recursive: true, excludes: [] })`; subscreve `onDidFilesChange`; filtra paths matching `specs/*/spec.md`; lê content, parse markers, emite events.
  - [ ] Retorno é `IDisposable` que dispõe a subscription e o watch handle.
  - [ ] Header + Disposable lifecycle + ensure no leaks.
  - [ ] Commit: `feat(nzr): T005 implement AiadevAdapter (spawn + spec watcher)`.

### T006 — Electron contribution + workbench wiring

- **Status:** done
- **Depends on:** T005
- **Files:**
  - create: `src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts`
  - modify: `src/vs/workbench/workbench.desktop.main.ts`
- **Spec scenarios:** wiring
- **Acceptance:**
  - [ ] `nzr.electron.contribution.ts` chama `registerSingleton(IAiadevAdapter, AiadevAdapter, InstantiationType.Delayed)`.
  - [ ] `workbench.desktop.main.ts` ganha `import './services/nzr/electron-browser/nzr.electron.contribution.js';` próximo aos outros service imports.
  - [ ] `test_registration.sh` GREEN.
  - [ ] Commit: `feat(nzr): T006 register AiadevAdapter singleton (desktop only)`.

### T007 — Verify GREEN + push + PR

- **Status:** done
- **Depends on:** T006
- **Files:**
  - create: `specs/0004-aiadev-adapter/evidence/run_all_output.txt`
- **Acceptance:**
  - [ ] `bash test/nzrcode-adapter/run_all.sh` exit 0.
  - [ ] Suites anteriores (`brand`, `theme`, `stations`) sem regressão.
  - [ ] tasks.md pending → done.
  - [ ] push + PR contra `feature/0003-...` (stacked).

## Parallelization hints

Serial.

## Post-task checklist

After all tasks:
- [ ] 4 suites smoke GREEN.
- [ ] Hand off para PR #4 stacked.
