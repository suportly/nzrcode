#!/usr/bin/env bash
# Spec: specs/0018-per-device-tokens/spec.md
#
# Originally written for feature 0015 (rotate shared token on revoke).
# Feature 0018 supersedes that approach with per-device tokens: revoke now
# deletes only the revoked device's entry, leaving other paired devices
# operational. This smoke validates the superseded contract:
#
#   - state.ts exports removeToken (the per-device replacement for the
#     old rotateToken),
#   - RevokeIpadDeps carries removeDeviceToken (was: rotateToken),
#   - runRevokeIpadCommand calls deps.removeDeviceToken (was: rotateToken),
#   - the success message no longer asks the user to "re-pair" — other
#     paired devices stay connected.

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

if ! grep -Eq "export function removeToken\b" "$STATE"; then
  echo "FAIL: state.ts must export function removeToken() (replaces rotateToken)"
  fail=1
fi

if ! grep -Eq "removeDeviceToken\s*:\s*\(\s*deviceId" "$REVOKE"; then
  echo "FAIL: RevokeIpadDeps must declare removeDeviceToken: (deviceId: string) => Promise<void>"
  fail=1
fi

if ! grep -Fq "deps.removeDeviceToken" "$REVOKE"; then
  echo "FAIL: runRevokeIpadCommand must call deps.removeDeviceToken"
  fail=1
fi

if ! grep -Eq "stays connected|stay connected" "$REVOKE"; then
  echo "FAIL: success message must mention that other devices stay connected"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: revoke targets a single device's token (per-device tokens — feature 0018)"
fi
exit "$fail"
