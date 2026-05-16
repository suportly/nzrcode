#!/usr/bin/env bash
# Spec: specs/0004-aiadev-adapter/spec.md
# Verifies the adapter feature's source files exist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'src/vs/platform/nzr/common/aiadev.ts'
require_file 'src/vs/platform/nzr/common/aiadevAdapter.ts'
require_file 'src/vs/workbench/services/nzr/common/clarifyMarkerParser.ts'
require_file 'src/vs/workbench/services/nzr/electron-browser/aiadevAdapter.ts'
require_file 'src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts'
require_file 'src/vs/workbench/services/nzr/test/common/clarifyMarkerParser.test.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: aiadev adapter feature files present"
fi
exit "$fail"
