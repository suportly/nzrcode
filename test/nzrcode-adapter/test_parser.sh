#!/usr/bin/env bash
# Spec: specs/0004-aiadev-adapter/spec.md — Story 2
# Smoke checks for clarifyMarkerParser. The behavioural cases live in the
# mocha suite (clarifyMarkerParser.test.ts); this shell test only confirms
# the function is exported with the right signature and the canonical
# regex anchor for [NEEDS CLARIFICATION:cl-N ...] is present.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$ROOT/src/vs/workbench/services/nzr/common/clarifyMarkerParser.ts"
TEST="$ROOT/src/vs/workbench/services/nzr/test/common/clarifyMarkerParser.test.ts"

fail=0
for f in "$FILE" "$TEST"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    fail=1
  fi
done
[ "$fail" -eq 0 ] || exit 1

# Parser exports the function with the right shape.
if ! grep -Eq 'export function parseClarifyMarkers\s*\(\s*content\s*:\s*string\s*\)\s*:\s*ClarifyMarker\[\]' "$FILE"; then
  echo "FAIL: clarifyMarkerParser.ts must export 'function parseClarifyMarkers(content: string): ClarifyMarker[]'"
  fail=1
fi

# Mention the marker syntax in a regex literal (string or template).
if ! grep -Eq 'NEEDS CLARIFICATION' "$FILE"; then
  echo "FAIL: parser must reference the 'NEEDS CLARIFICATION' marker syntax"
  fail=1
fi
if ! grep -Eq 'cl-' "$FILE"; then
  echo "FAIL: parser must constrain ids to 'cl-N' shape"
  fail=1
fi

# Mocha test should cover at least 5 scenarios per spec Story 2.
test_count=$(grep -Ec "^\s*test\(" "$TEST" || true)
if [ "$test_count" -lt 5 ]; then
  echo "FAIL: clarifyMarkerParser.test.ts has $test_count test cases; spec requires at least 5"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: clarifyMarkerParser shape and mocha coverage ($test_count test cases)"
fi
exit "$fail"
