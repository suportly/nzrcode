#!/usr/bin/env bash
# Spec: specs/0013-consumer-wiring-and-presets-dedup/spec.md — In scope item 2
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts"
HELPER="$ROOT/src/vs/workbench/contrib/nzr/browser/nzrPaletteDefaults.ts"

fail=0
for f in "$CONTRIB" "$HELPER"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

if ! grep -Fq "IConfigurationService" "$CONTRIB"; then
  echo "FAIL: stationPalette.contribution.ts must import IConfigurationService"
  fail=1
fi

if ! grep -Fq "resolveAddStationDefaults" "$CONTRIB"; then
  echo "FAIL: stationPalette.contribution.ts must use resolveAddStationDefaults"
  fail=1
fi

if ! grep -Fq "resolveAddStationDefaults" "$HELPER"; then
  echo "FAIL: nzrPaletteDefaults.ts must export resolveAddStationDefaults"
  fail=1
fi

if ! grep -Fq "getDefaultPreset" "$HELPER" || ! grep -Fq "getDefaultBranch" "$HELPER"; then
  echo "FAIL: nzrPaletteDefaults.ts must delegate to getDefaultPreset + getDefaultBranch"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: AddStation consumes settings via resolveAddStationDefaults"
fi
exit "$fail"
