#!/usr/bin/env bash
# Spec: specs/0002-theme-tokens-and-color-customization/spec.md — Story 1.3
# Verifies NZR_TOKENS in src/vs/workbench/browser/parts/nzr/theme.ts exposes
# the canonical brand palette declared in the implementation brief §3.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/src/vs/workbench/browser/parts/nzr/theme.ts"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE missing"
  exit 1
fi

required_keys=(
  bg surface elev elev2 border borderStrong
  text text2 muted dim
  amber amberDim amberSoft amberLine
  stageSpecify stageClarify stagePlan stageTasks
  stageImplement stageReview stageDone stageFailed
  fontMono fontSans
)

fail=0
for key in "${required_keys[@]}"; do
  if ! grep -Eq "^\s+${key}\s*:" "$FILE"; then
    echo "FAIL: NZR_TOKENS.${key} missing in $FILE"
    fail=1
  fi
done

# Spot-check brand-critical values
expect_value() {
  local key="$1" expected="$2"
  if ! grep -Eq "^\s+${key}\s*:\s*['\"]?${expected}" "$FILE"; then
    echo "FAIL: NZR_TOKENS.${key} expected to start with '${expected}'"
    fail=1
  fi
}

expect_value 'bg'    '#0d0c0a'
expect_value 'amber' '#ffa45c'
expect_value 'text'  '#ece6dd'

# Surface should be the literal type guard
if ! grep -q 'as const' "$FILE"; then
  echo "FAIL: NZR_TOKENS must be declared 'as const' to preserve literal types"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: NZR_TOKENS shape and brand-critical values"
fi
exit "$fail"
