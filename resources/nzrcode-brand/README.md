# NZRCode brand source assets

This directory holds the single source of truth for the NZRCode visual mark.
Everything in `resources/darwin/nzrcode.icns`, `resources/linux/nzrcode.png`,
and `resources/win32/nzrcode_*.png` is **generated** from these files by
[`build/lib/nzrcode/generate-icons.mjs`](../../build/lib/nzrcode/generate-icons.mjs).

## Files

- `wordmark.svg` — 1024×1024 SVG showing "NZR/CODE" with the amber slash on a
  warm-dark background. The slash itself is a polygon, so the icon stays
  recognisable even when the wordmark's monospace text falls back to a system
  font (small raster sizes mostly show the slash anyway).
- `colors.json` — the four brand tokens used by the wordmark and any UI that
  needs to match it. Keep this in sync with `src/vs/workbench/contrib/nzr/browser/theme.ts`
  when feature 0002 lands.

## Refreshing the brand

1. Edit `wordmark.svg` (or replace it wholesale with a designer's file using
   the same `viewBox` and palette).
2. Run `node build/lib/nzrcode/generate-icons.mjs --write` to regenerate all
   platform rasters.
3. Run `bash test/nzrcode-brand/run_all.sh` to verify nothing else regressed.
4. Commit `wordmark.svg`, `colors.json`, and the regenerated binaries together
   in one commit.

## Why a placeholder?

Feature 0001 (`specs/0001-rebrand-product-json/`) clarification `cl-3` chose
"generate placeholder via build script" over "wait for design hand-off" so the
rebrand pipeline could be exercised end-to-end without blocking on assets.
Swap this SVG for the final mark whenever it lands — no other files need to
change.
