#!/usr/bin/env bash
# Spec: specs/0015-bridge-token-rotation-on-revoke/spec.md — In scope items 1 & 2
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/extensions/nzrcode-bridge/src/server/state.ts"
REVOKE="$ROOT/extensions/nzrcode-bridge/src/pairing/revokeCommand.ts"

fail=0
for f in "$STATE" "$REVOKE"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

if ! grep -Eq "export function rotateToken\b" "$STATE"; then
  echo "FAIL: state.ts must export function rotateToken()"
  fail=1
fi

if ! grep -Eq "rotateToken\s*:\s*\(\s*\)\s*=>\s*Promise<void>" "$REVOKE"; then
  echo "FAIL: RevokeIpadDeps must declare rotateToken: () => Promise<void>"
  fail=1
fi

if ! grep -Fq "deps.rotateToken()" "$REVOKE"; then
  echo "FAIL: runRevokeIpadCommand must call deps.rotateToken()"
  fail=1
fi

# Re-pair guidance must surface in the success message.
if ! grep -Eq "re-pair|repair" "$REVOKE"; then
  echo "FAIL: success message must mention re-pairing"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: rotateToken wired into state.ts + revokeCommand.ts"
fi
exit "$fail"
