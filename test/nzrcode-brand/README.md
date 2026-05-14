# NZRCode brand smoke tests

Smoke tests written during feature `0001-rebrand-product-json` to assert that
the rebrand from "Code - OSS" to "NZRCode" stays consistent across every
surface the spec calls out.

## Run

```sh
bash test/nzrcode-brand/run_all.sh
```

Exit code is 0 only when every sub-test passes.

## What each script checks

- `test_product_json.sh` — `product.json` declares the NZRCode identity
  (names, paths, URL protocol, bundle/AppUserModel IDs) and the win32/darwin
  UUIDs differ from the upstream `microsoft/vscode` values.
- `test_icons_exist.sh` — Brand SVG, generated raster icons (`.icns`, `.png`),
  and the bundled JetBrains Mono fonts plus their SIL OFL 1.1 license are all
  present. When `build/lib/nzrcode/generate-icons.mjs` exists, also asserts
  `--check` mode reports no drift between the SVG source and committed
  binaries.
- `test_no_residual_code_oss.sh` — `grep -rn 'code-oss' product.json resources/
  scripts/code.sh build/linux/` reports zero hits, except lines marked with
  `nzrcode-allow:code-oss-ref` (used sparingly for legitimate cross-references
  to upstream identifiers, e.g. webview CDN URLs while cl-9 deferred work is
  pending).
- `test_resource_renames.sh` — The upstream-named resource files
  (`code.desktop`, `code.png`, etc.) are gone, replaced by their
  `nzrcode.*` counterparts.

## When tests should be RED vs GREEN

During implementation of feature 0001, the suite is RED after task T001
(this file's commit), turns gradually GREEN as T002-T011 land, and stays
GREEN from T008 onward. Any later feature that regresses the brand
identity must turn one of these tests RED again — that's the contract.
