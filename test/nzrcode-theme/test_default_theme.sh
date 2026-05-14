#!/usr/bin/env bash
# Spec: specs/0002-theme-tokens-and-color-customization/spec.md — Story 2.1
# Asserts the default dark theme constant points at 'NZR Dark'.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/src/vs/workbench/services/themes/common/workbenchThemeService.ts"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE missing"
  exit 1
fi

if ! grep -Eq "COLOR_THEME_DARK\s*=\s*'NZR Dark'" "$FILE"; then
  echo "FAIL: workbenchThemeService.ts must declare COLOR_THEME_DARK = 'NZR Dark'"
  grep -n "COLOR_THEME_DARK" "$FILE" || true
  exit 1
fi

echo "PASS: default dark theme is 'NZR Dark'"
