#!/usr/bin/env bash
# Spec: specs/0002-theme-tokens-and-color-customization/spec.md — Story 2.4
# Validates extensions/theme-defaults/themes/nzr-dark.json structure and
# that brand-critical color registry keys land on NZR_TOKENS values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/extensions/theme-defaults/themes/nzr-dark.json"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE missing"
  exit 1
fi

if ! jq empty "$FILE" 2>/dev/null; then
  echo "FAIL: $FILE is not valid JSON"
  exit 1
fi

fail=0
check_eq() {
  local jq_expr="$1" expected="$2"
  local actual
  actual=$(jq -r "$jq_expr" "$FILE")
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $jq_expr expected '$expected', got '$actual'"
    fail=1
  fi
}

check_eq '.name'    'NZR Dark'
check_eq '.type'    'dark'
check_eq '.include' './dark_modern.json'

# Brand-critical color keys must point at NZR_TOKENS values.
check_eq '.colors["editor.background"]'        '#0d0c0a'
check_eq '.colors["sideBar.background"]'       '#0d0c0a'
check_eq '.colors["activityBar.background"]'   '#0d0c0a'
check_eq '.colors["statusBar.background"]'     '#15130f'
check_eq '.colors["focusBorder"]'              '#ffa45c'
check_eq '.colors["button.background"]'        '#ffa45c'
check_eq '.colors["progressBar.background"]'   '#ffa45c'

# At least 30 chrome colors mapped
count=$(jq -r '.colors | keys | length' "$FILE")
if [ "$count" -lt 30 ]; then
  echo "FAIL: nzr-dark.json maps only $count colors (need >= 30)"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: nzr-dark.json structure ($count colors mapped)"
fi
exit "$fail"
