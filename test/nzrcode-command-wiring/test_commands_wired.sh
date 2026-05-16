#!/usr/bin/env bash
# Spec: specs/0016-bridge-command-wiring/spec.md — Acceptance "register* command sites"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXT="$ROOT/extensions/nzrcode-bridge/src/extension.ts"

fail=0
if [ ! -f "$EXT" ]; then
  echo "FAIL: $EXT missing"
  exit 1
fi

if ! grep -Eq "registerCommand\(\s*['\"]nzrcode-bridge\.listPairedDevices['\"]" "$EXT"; then
  echo "FAIL: extension.ts must register 'nzrcode-bridge.listPairedDevices'"
  fail=1
fi

if ! grep -Eq "registerCommand\(\s*['\"]nzrcode-bridge\.revokeIpad['\"]" "$EXT"; then
  echo "FAIL: extension.ts must register 'nzrcode-bridge.revokeIpad'"
  fail=1
fi

if ! grep -Fq "runListPairedDevicesCommand" "$EXT"; then
  echo "FAIL: extension.ts must invoke runListPairedDevicesCommand"
  fail=1
fi

if ! grep -Fq "runRevokeIpadCommand" "$EXT"; then
  echo "FAIL: extension.ts must invoke runRevokeIpadCommand"
  fail=1
fi

if ! grep -Fq "new PairedDeviceStore" "$EXT"; then
  echo "FAIL: extension.ts must construct a PairedDeviceStore"
  fail=1
fi

if ! grep -Fq "context.subscriptions.push" "$EXT"; then
  echo "FAIL: extension.ts must push registered commands onto context.subscriptions"
  fail=1
fi

if ! grep -Fq "removeToken" "$EXT"; then
  echo "FAIL: revoke wiring must call removeToken from state.ts (per-device tokens — feature 0018)"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: list + revoke palette commands wired"
fi
exit "$fail"
