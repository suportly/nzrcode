#!/usr/bin/env bash
# Spec: specs/0013-consumer-wiring-and-presets-dedup/spec.md — Acceptance "all visible strings via localize"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PAL="$ROOT/src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts"

fail=0
if [ ! -f "$PAL" ]; then
  echo "FAIL: $PAL missing"
  exit 1
fi

# The QuickPick reorder marks the default with a localized "(default)"
# description. Confirm there is no bare description literal for it.
if grep -Eq "description:\s*['\"]\\(default\\)['\"]" "$PAL"; then
  echo "FAIL: '(default)' description must use localize(...)"
  fail=1
fi

if ! grep -Fq "localize" "$PAL"; then
  echo "FAIL: stationPalette.contribution.ts must still use localize"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Consumer Wiring strings localized"
fi
exit "$fail"
