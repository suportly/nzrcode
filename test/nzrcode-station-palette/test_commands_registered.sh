#!/usr/bin/env bash
# Spec: specs/0010-add-station-palette/spec.md — Story 1/2/3
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts"
MAIN="$ROOT/src/vs/workbench/workbench.common.main.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  exit 1
fi

for cmd in "nzr.station.add" "nzr.station.switch" "nzr.station.close"; do
  if ! grep -Fq "$cmd" "$CONTRIB"; then
    echo "FAIL: command id '$cmd' not registered"
    fail=1
  fi
done

if ! grep -Eq "class\s+\w+\s+extends\s+Action2" "$CONTRIB"; then
  echo "FAIL: contribution must register commands via Action2 subclasses"
  fail=1
fi

if ! grep -Eq "category:\s*(NZR_CATEGORY|nzrCategory|['\"]NZR['\"])" "$CONTRIB"; then
  echo "FAIL: at least one command must use NZR category"
  fail=1
fi

if ! grep -Fq "f1: true" "$CONTRIB"; then
  echo "FAIL: contribution must expose at least one command via the command palette (f1: true)"
  fail=1
fi

if ! grep -Fq "./contrib/nzr/browser/stationPalette.contribution.js" "$MAIN"; then
  echo "FAIL: workbench.common.main.ts does not import the Station Palette contribution"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Station Palette commands registered"
fi
exit "$fail"
