# build/lib/nzrcode

NZRCode-specific build helpers. Right now there's one:

## `generate-icons.mjs`

Rasterises `resources/nzrcode-brand/wordmark.svg` into the per-platform icon
files that ship with the app. ImageMagick (`convert`) is the only system
dependency; no NPM packages are added.

### Modes

```sh
node build/lib/nzrcode/generate-icons.mjs --write
node build/lib/nzrcode/generate-icons.mjs --check
```

- **`--write`** regenerates the four platform icon files:
  - `resources/linux/nzrcode.png` (512×512)
  - `resources/win32/nzrcode_70x70.png` (70×70)
  - `resources/win32/nzrcode_150x150.png` (150×150)
  - `resources/darwin/nzrcode.icns` — hand-built ICNS container with `ic09`
    (512×512) and `ic10` (1024×1024) chunks.

- **`--check`** verifies the four files exist and are non-empty. Byte-stable
  output across ImageMagick versions is **not** asserted — the SVG source's
  sha256 is pinned in `test/nzrcode-brand/test_icons_exist.sh`, which is the
  real drift detector.

### Why ImageMagick instead of `sharp`

The brief forbids new NPM dependencies (`§7` of `Implementation Brief`). The
VS Code repo doesn't depend on `sharp`. ImageMagick's `convert` is already
installed on every Linux CI runner and on most dev macOS/Linux machines via
the system package manager (`apt-get install imagemagick`,
`brew install imagemagick`). The trade-off — rendering drifts a few pixels
between IM versions — is acceptable for a placeholder mark and removed
entirely once a designer's binary takes its place.

### Refresh procedure

1. Edit `resources/nzrcode-brand/wordmark.svg`.
2. Update the pinned sha256 in `test/nzrcode-brand/test_icons_exist.sh`
   (`sha256sum resources/nzrcode-brand/wordmark.svg`).
3. `node build/lib/nzrcode/generate-icons.mjs --write`.
4. `bash test/nzrcode-brand/run_all.sh` to verify nothing else regressed.
5. Commit SVG + icon binaries + the test-hash update in one commit.
