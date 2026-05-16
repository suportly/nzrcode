#!/usr/bin/env bash
# Spec: specs/0018-per-device-tokens/spec.md — Story 1 (schema v2)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/extensions/nzrcode-bridge/src/server/state.ts"

fail=0
if [ ! -f "$STATE" ]; then
  echo "FAIL: $STATE missing"
  exit 1
fi

if ! grep -Eq "tokens:\s*(Readonly<)?Record<\s*string\s*,\s*string\s*>" "$STATE"; then
  echo "FAIL: BridgeState must carry tokens: Record<string, string>"
  fail=1
fi

if ! grep -Eq "version:\s*2" "$STATE"; then
  echo "FAIL: BridgeState.version must be 2"
  fail=1
fi

# No vestigial single-token field in the schema.
if grep -Eq "^\s*readonly token:\s*string;" "$STATE"; then
  echo "FAIL: BridgeState.token (single string) must be removed"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: schema migrated to v2 with per-device tokens"
fi
exit "$fail"
