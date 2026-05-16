# Smoke suite — feature 0009 (nzrcode-bridge)

`bash run_all.sh` from anywhere in the repo runs the structural smokes plus the
extension's mocha suite (unit + integration). Exits non-zero on the first
failure.

## Layout

- `test_files_exist.sh` — every source + test file the spec declares must exist.
- `test_no_new_deps_root.sh` — root `package.json` is byte-identical to `main`
  (per-extension deps inside `extensions/nzrcode-bridge/package.json` are
  intentional and isolated, e.g. `qrcode-generator`).
- `test_built_in_registration.sh` — the extension is registered as a built-in
  via `product.json`, `build/gulpfile.extensions.ts`, and `build/npm/dirs.ts`.
- `run_all.sh` — runs the above three structural smokes, then `npm test`
  inside `extensions/nzrcode-bridge/` (which executes the full mocha
  unit + integration suite).

## Evidence

The output of a successful run is committed to
`specs/0009-nzrcode-bridge/evidence/run_all_output.txt` per Article IV.
