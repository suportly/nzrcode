#!/usr/bin/env bash
# Spec: specs/0002-theme-tokens-and-color-customization/spec.md — Story 2.2
# Asserts NZR Dark is registered in the theme-defaults extension manifest
# and its NLS label resolves.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="$ROOT/extensions/theme-defaults/package.json"
NLS="$ROOT/extensions/theme-defaults/package.nls.json"

fail=0
for f in "$PKG" "$NLS"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    fail=1
  fi
done
[ "$fail" -eq 0 ] || exit 1

# NZR Dark entry exists in themes array.
hit=$(jq -r '.contributes.themes[] | select(.id == "NZR Dark") | "\(.id)|\(.uiTheme)|\(.path)"' "$PKG")
if [ -z "$hit" ]; then
  echo "FAIL: package.json contributes.themes has no entry with id 'NZR Dark'"
  exit 1
fi

expected='NZR Dark|vs-dark|./themes/nzr-dark.json'
if [ "$hit" != "$expected" ]; then
  echo "FAIL: NZR Dark entry shape — expected '$expected', got '$hit'"
  exit 1
fi

# NLS label key present.
label=$(jq -r '.nzrDarkThemeLabel // empty' "$NLS")
if [ "$label" != "NZR Dark" ]; then
  echo "FAIL: package.nls.json nzrDarkThemeLabel — expected 'NZR Dark', got '${label:-<missing>}'"
  exit 1
fi

echo "PASS: NZR Dark registered in theme-defaults extension"
