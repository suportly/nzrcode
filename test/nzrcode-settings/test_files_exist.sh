#!/usr/bin/env bash
# Spec: specs/0012-settings-pipeline-section/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'src/vs/workbench/contrib/nzr/browser/nzrPipelineSettings.ts'
require_file 'src/vs/workbench/contrib/nzr/browser/settings.contribution.ts'
require_file 'src/vs/workbench/contrib/nzr/test/browser/nzrPipelineSettings.test.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: Settings feature files present"
fi
exit "$fail"
