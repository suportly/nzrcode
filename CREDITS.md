# Credits

NZRCode stands on a small number of clearly-licensed shoulders. This file
records them; the binding legal text for each lives at the linked location.

## Upstream — Visual Studio Code OSS

NZRCode is a fork of **Visual Studio Code OSS** (`microsoft/vscode`),
distributed under the MIT License. The upstream copyright statement is
preserved verbatim in [`LICENSE.txt`](./LICENSE.txt); the running fork point
is recorded in `git log`.

- Upstream repository: https://github.com/microsoft/vscode
- License: MIT, see [`LICENSE.txt`](./LICENSE.txt)
- Fork at this repository: https://github.com/suportly/nzrcode

What we change vs. upstream is the product identity (`product.json`, brand
assets in `resources/`, the Mission Control / station workbench surface
landed in later features); the editor core stays compatible.

## Font — JetBrains Mono v2.304

The `NZR/CODE` wordmark and any future workbench surface that asks for
"the technical-feel font" render in **JetBrains Mono**, bundled in
`resources/fonts/` as three weight cuts (Regular, Medium, Bold).

- Project: https://github.com/JetBrains/JetBrainsMono
- Release used: v2.304 (downloaded 2026-05-14)
- License: SIL Open Font License 1.1 — full text at
  [`resources/fonts/LICENSE-JetBrainsMono.txt`](./resources/fonts/LICENSE-JetBrainsMono.txt)
- Refresh procedure: [`resources/fonts/README.md`](./resources/fonts/README.md)

## Build tooling

- **ImageMagick** (`convert`) — system dependency used by
  `build/lib/nzrcode/generate-icons.mjs` to rasterise the wordmark SVG into
  platform icon files. Installed via your system package manager
  (`apt-get install imagemagick`, `brew install imagemagick`); not a runtime
  dependency of NZRCode.

No further third-party material was adapted into NZRCode at the time this
file was written. Future additions land here as new sections.
