# Smoke suite — 0007 station-view

Structural-only checks. They do **not** start the workbench or render the view; they assert that the files exist, the contribution registers a `ViewContainer` + `ViewPane`, no new NPM deps were added, and visible strings are localized.

Run:

```sh
bash test/nzrcode-station-view/run_all.sh
```

Mocha tests (`stationCard.test.ts`, `pipelineRail.test.ts`) under `src/vs/workbench/services/nzr/test/common/` execute via the standard VS Code test runner once a dev build is available; in this PR they are committed to enable that future check.

Visual validation requires `npm install && npm run compile && ./scripts/code.sh` — deferred to local dev / CI per spec R1.
