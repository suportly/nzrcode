#!/usr/bin/env bash
# Spec: specs/0005-claude-code-bridge/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'src/vs/platform/nzr/common/claudeCode.ts'
require_file 'src/vs/platform/nzr/common/claudeCodeBridge.ts'
require_file 'src/vs/workbench/services/nzr/electron-browser/claudeCodeBridge.ts'
require_file 'src/vs/workbench/services/nzr/test/common/claudeCodeBridge.test.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: claude bridge feature files present"
fi
exit "$fail"
