#!/usr/bin/env bash
# Spec: specs/0016-bridge-command-wiring/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'extensions/nzrcode-bridge/src/extension.ts'
require_file 'extensions/nzrcode-bridge/src/pairing/listCommand.ts'
require_file 'extensions/nzrcode-bridge/src/pairing/revokeCommand.ts'
require_file 'extensions/nzrcode-bridge/src/pairing/pairedDevices.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: Command Wiring feature files present"
fi
exit "$fail"
