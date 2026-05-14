# Station registry smoke tests

Structural checks for feature `0003-station-registry-service`. They run
without `npm install` and validate that the contract surface (types,
interface decorator, methods, events, singleton registration) is in
place. The behavioural contract is the mocha unit test at
`src/vs/platform/nzr/test/common/stationRegistry.test.ts` — that one
needs the full VS Code dev environment to execute.

## Run

```sh
bash test/nzrcode-stations/run_all.sh
```

## What each script checks

- `test_files_exist.sh` — five files (4 `.ts` source + 1 `.test.ts`) exist.
- `test_interface_shape.sh` — `pipelineState.ts` exports the brief §4 types
  (`PipelineStage`, `Station`, `SpecRef`, `PipelineState`, `GateReason`,
  `ClarifyMarker`, `ReviewFinding`, `ClaudeProcess`) and `stationRegistry.ts`
  declares the `IStationRegistryService` decorator with the three required
  events (`onStationAdded`, `onStationRemoved`, `onStationStageChanged`)
  plus the five CRUD methods.
- `test_typecheck.sh` — best-effort `tsc --noEmit` over the new files with
  `--noResolve` (since the project's full tsconfig + node_modules aren't
  required for this smoke). Reports SKIP if no `tsc` is reachable; set
  `AIADEV_REQUIRE_TSC=1` to fail in that case.
- `test_registration.sh` — `nzr.contribution.ts` calls
  `registerSingleton(IStationRegistryService, …)` and
  `workbench.common.main.ts` imports the contribution.

## What this suite does NOT cover

- Mutation semantics, event payloads, persistence round-trip — see the
  mocha test.
- Behaviour when `IFileService` rejects writes — the mocha test mocks the
  file service for failure scenarios.
- DI wiring at runtime (the singleton has to actually instantiate when
  the workbench boots) — verified by the dev build smoke (deferred,
  see feature 0001 T012 for the same blocker).
