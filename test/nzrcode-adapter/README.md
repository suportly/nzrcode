# aiadev adapter smoke tests

Structural checks for feature `0004-aiadev-adapter`. Behavioural parser
coverage lives in the mocha suite at
`src/vs/workbench/services/nzr/test/common/clarifyMarkerParser.test.ts`.

## Run

```sh
bash test/nzrcode-adapter/run_all.sh
```

## What each script checks

- `test_files_exist.sh` — the six adapter source files exist.
- `test_interface_shape.sh` — types in `aiadev.ts` and the
  `IAiadevAdapter` decorator/interface in `aiadevAdapter.ts` declare every
  event and method the spec requires.
- `test_parser.sh` — `clarifyMarkerParser.ts` exports the function with the
  expected signature and references the canonical marker syntax; the mocha
  test file covers at least the five scenarios in spec Story 2.
- `test_registration.sh` — the electron contribution registers
  `IAiadevAdapter` and `workbench.desktop.main.ts` imports it.

## What this suite does NOT cover

- Runtime spawn behaviour, timeout escalation, watcher lifecycle — those
  are dev-build smoke (deferred) and the mocha test.
- `aiadev` binary actually being on the user's PATH.
