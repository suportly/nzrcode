#!/usr/bin/env bash
# Spec: specs/0019-authenticated-device-id/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WS="$ROOT/extensions/nzrcode-bridge/src/server/wsServer.ts"
DISP="$ROOT/extensions/nzrcode-bridge/src/server/dispatcher.ts"

fail=0
for f in "$WS" "$DISP"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

if ! grep -Fq "authenticatedDeviceId" "$WS"; then
  echo "FAIL: wsServer.ts must declare authenticatedDeviceId on BridgeConnection"
  fail=1
fi

if ! grep -Fq "_setAuthenticatedDeviceId" "$WS"; then
  echo "FAIL: wsServer.ts must declare _setAuthenticatedDeviceId on BridgeConnection"
  fail=1
fi

if ! grep -Fq "_setAuthenticatedDeviceId" "$DISP"; then
  echo "FAIL: dispatcher.ts must call _setAuthenticatedDeviceId on successful auth"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: authenticatedDeviceId wired through wsServer + dispatcher"
fi
exit "$fail"
