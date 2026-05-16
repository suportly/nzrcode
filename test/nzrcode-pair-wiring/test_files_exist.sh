#!/usr/bin/env bash
# Spec: specs/0017-pair-ipad-wiring/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'extensions/nzrcode-bridge/src/protocol/methods.ts'
require_file 'extensions/nzrcode-bridge/src/pairing/pairingController.ts'
require_file 'extensions/nzrcode-bridge/src/bridge.ts'
require_file 'extensions/nzrcode-bridge/src/extension.ts'
require_file 'extensions/nzrcode-bridge/src/test/unit/pairingController.test.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: Pair Wiring feature files present"
fi
exit "$fail"
