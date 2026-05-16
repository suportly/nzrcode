#!/usr/bin/env bash
# Spec: specs/0010-add-station-palette/spec.md — Acceptance "all visible strings via localize"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  exit 1
fi

if ! grep -Eq "(localize|localize2)\(" "$CONTRIB"; then
  echo "FAIL: contribution must use localize/localize2 for visible strings"
  fail=1
fi

# Catch obvious english string literals in title fields that bypass localize.
if grep -Eq "title:\s*['\"][^'\"]+['\"]" "$CONTRIB"; then
  echo "FAIL: a 'title:' field uses a bare string literal instead of localize2(...)"
  grep -nE "title:\s*['\"][^'\"]+['\"]" "$CONTRIB"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Station Palette strings localized"
fi
exit "$fail"
