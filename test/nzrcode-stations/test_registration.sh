#!/usr/bin/env bash
# Spec: specs/0003-station-registry-service/spec.md — Story 1
# Verifies the nzr.contribution registers the singleton AND
# workbench.common.main.ts imports it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/services/nzr/common/nzr.contribution.ts"
MAIN="$ROOT/src/vs/workbench/workbench.common.main.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  fail=1
fi
if [ ! -f "$MAIN" ]; then
  echo "FAIL: $MAIN missing"
  fail=1
fi
[ "$fail" -eq 0 ] || exit 1

if ! grep -Eq "registerSingleton\(\s*IStationRegistryService\b" "$CONTRIB"; then
  echo "FAIL: nzr.contribution.ts does not call registerSingleton(IStationRegistryService, ...)"
  fail=1
fi

if ! grep -Fq "./services/nzr/common/nzr.contribution.js" "$MAIN"; then
  echo "FAIL: workbench.common.main.ts does not import ./services/nzr/common/nzr.contribution.js"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: StationRegistryService singleton registered and wired into main"
fi
exit "$fail"
