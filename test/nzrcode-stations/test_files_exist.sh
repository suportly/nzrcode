#!/usr/bin/env bash
# Spec: specs/0003-station-registry-service/spec.md — Story 1
# Confirms the five files (4 .ts + 1 .test.ts) of the station registry feature exist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'src/vs/platform/nzr/common/pipelineState.ts'
require_file 'src/vs/platform/nzr/common/stationRegistry.ts'
require_file 'src/vs/workbench/services/nzr/common/stationRegistryService.ts'
require_file 'src/vs/workbench/services/nzr/common/nzr.contribution.ts'
require_file 'src/vs/platform/nzr/test/common/stationRegistry.test.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: station registry feature files present"
fi
exit "$fail"
