#!/usr/bin/env bash
# Spec: specs/0018-per-device-tokens/spec.md — Story 2 (helpers)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/extensions/nzrcode-bridge/src/server/state.ts"
AUTH="$ROOT/extensions/nzrcode-bridge/src/server/auth.ts"

fail=0
for f in "$STATE" "$AUTH"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

if ! grep -Eq "export function addToken" "$STATE"; then
  echo "FAIL: state.ts must export addToken"
  fail=1
fi
if ! grep -Eq "export function removeToken" "$STATE"; then
  echo "FAIL: state.ts must export removeToken"
  fail=1
fi
if ! grep -Eq "export function getTokens" "$STATE"; then
  echo "FAIL: state.ts must export getTokens"
  fail=1
fi
if grep -Eq "export function rotateToken" "$STATE"; then
  echo "FAIL: rotateToken must be removed in v2"
  fail=1
fi

if ! grep -Eq "export function findTokenMatch" "$AUTH"; then
  echo "FAIL: auth.ts must export findTokenMatch"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: per-device token helpers exported"
fi
exit "$fail"
