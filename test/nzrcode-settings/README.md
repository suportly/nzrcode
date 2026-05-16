# Smoke tests — Settings Pipeline Section (feature 0012)

Structural greps for `feature/0012-settings-pipeline-section`.

## Run

```
bash test/nzrcode-settings/run_all.sh
```

Exits 0 when:
- both source files exist (`nzrPipelineSettings.ts`, `settings.contribution.ts`),
- `registerConfiguration` is called with `id: 'nzrcode'` and all 4 setting keys appear,
- the preset enum default (`'lean'`) and other defaults are wired into the schema,
- no new NPM root deps,
- all visible strings are wrapped in `localize`.
