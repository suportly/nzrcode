#!/usr/bin/env bash
# Spec: specs/0006-mission-control-shell/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'src/vs/workbench/services/nzr/common/gridLayout.ts'
require_file 'src/vs/workbench/services/nzr/common/missionControl.ts'
require_file 'src/vs/workbench/services/nzr/common/missionControlService.ts'
require_file 'src/vs/workbench/contrib/nzr/browser/missionControl.contribution.ts'
require_file 'src/vs/workbench/services/nzr/test/common/gridLayout.test.ts'
require_file 'src/vs/workbench/services/nzr/test/common/missionControlService.test.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: Mission Control feature files present"
fi
exit "$fail"
