#!/usr/bin/env bash
# Spec: specs/0019-authenticated-device-id/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'extensions/nzrcode-bridge/src/server/wsServer.ts'
require_file 'extensions/nzrcode-bridge/src/server/dispatcher.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: feature files present"
fi
exit "$fail"
