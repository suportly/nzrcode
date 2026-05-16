#!/usr/bin/env bash
# Spec: specs/0017-pair-ipad-wiring/spec.md — Story 1 (protocol)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
METHODS="$ROOT/extensions/nzrcode-bridge/src/protocol/methods.ts"

fail=0
if [ ! -f "$METHODS" ]; then
  echo "FAIL: $METHODS missing"
  exit 1
fi

if ! grep -Eq "SystemRegister\s*=\s*['\"]system\.register['\"]" "$METHODS"; then
  echo "FAIL: methods.ts must declare SystemRegister = 'system.register'"
  fail=1
fi

if ! grep -Eq "\[MethodName\.SystemRegister\]:\s*\{[^}]*deviceId" "$METHODS"; then
  echo "FAIL: MethodParams[SystemRegister] must include deviceId"
  fail=1
fi

if ! grep -Eq "\[MethodName\.SystemRegister\]:\s*\{[^}]*deviceName" "$METHODS"; then
  echo "FAIL: MethodParams[SystemRegister] must include deviceName"
  fail=1
fi

if ! grep -Fq "registered: true" "$METHODS"; then
  echo "FAIL: MethodResult[SystemRegister] must include 'registered: true'"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: protocol extended with system.register"
fi
exit "$fail"
