# Bundled fonts

## JetBrains Mono v2.304

- **Files:** `JetBrainsMono-Regular.woff2`, `JetBrainsMono-Medium.woff2`,
  `JetBrainsMono-Bold.woff2`.
- **License:** SIL Open Font License 1.1 — full text in
  `LICENSE-JetBrainsMono.txt`. Attribution recorded in `/CREDITS.md`.
- **Source:** Extracted from the official release archive at
  https://github.com/JetBrains/JetBrainsMono/releases/tag/v2.304 (file
  `JetBrainsMono-2.304.zip` → `fonts/webfonts/`).
- **Downloaded:** 2026-05-14.

## Updating

1. Download the new release zip from the JetBrains/JetBrainsMono GitHub
   release page.
2. Replace the three woff2 files above (keep the same filenames — names are
   referenced by `wordmark.svg` and the future workbench theme).
3. Replace `LICENSE-JetBrainsMono.txt` with the `OFL.txt` from the same
   archive (the upstream OFL text is what's tracked).
4. Update the version + date in this file and in `/CREDITS.md`.
5. Run `bash test/nzrcode-brand/run_all.sh`.

Only `Regular`, `Medium`, and `Bold` are bundled to keep the installer
footprint small (~280 KB total). Add Italic variants only when a UI surface
needs them.
