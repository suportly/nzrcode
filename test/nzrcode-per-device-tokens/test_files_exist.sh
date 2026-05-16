#!/usr/bin/env bash
# Spec: specs/0018-per-device-tokens/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
require_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "FAIL: missing file $1"
    fail=1
  fi
}

require_file 'extensions/nzrcode-bridge/src/server/state.ts'
require_file 'extensions/nzrcode-bridge/src/server/auth.ts'
require_file 'extensions/nzrcode-bridge/src/server/dispatcher.ts'
require_file 'extensions/nzrcode-bridge/src/pairing/pairingController.ts'
require_file 'extensions/nzrcode-bridge/src/test/unit/perDeviceTokens.test.ts'

if [ "$fail" -eq 0 ]; then
  echo "PASS: Per-Device Tokens feature files present"
fi
exit "$fail"
