# Smoke suite — feature 0008 (gate-queue-panel)

`bash run_all.sh` runs the structural smokes that gate this feature in CI.
Exits non-zero on the first failure.

## Layout

- `test_files_exist.sh` — every source + test file the spec declares must exist.
- `test_view_registered.sh` — the ViewContainer is registered in the
  AuxiliaryBar with the right id, the pane extends ViewPane, CSS is imported,
  and `workbench.common.main.ts` pulls in the contribution.
- `test_no_new_deps.sh` — root `package.json` is byte-identical to `main`.
- `test_i18n_strings.sh` — every feature file uses `localize()` for visible
  strings.

Evidence: `specs/0008-gate-queue-panel/evidence/run_all_output.txt`.
