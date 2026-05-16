#!/usr/bin/env bash
# Spec: specs/0011-welcome-screen/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'src/vs/workbench/contrib/nzr/browser/welcomeFlow.ts'
require_file 'src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts'
require_file 'src/vs/workbench/contrib/nzr/test/browser/welcomeFlow.test.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: Welcome feature files present"
fi
exit "$fail"
