#!/usr/bin/env bash
# Spec: specs/0017-pair-ipad-wiring/spec.md — Stories 2-4 (controller, bridge, extension)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CTL="$ROOT/extensions/nzrcode-bridge/src/pairing/pairingController.ts"
BRIDGE="$ROOT/extensions/nzrcode-bridge/src/bridge.ts"
EXT="$ROOT/extensions/nzrcode-bridge/src/extension.ts"

fail=0
for f in "$CTL" "$BRIDGE" "$EXT"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

# Controller
if ! grep -Eq "class\s+PairingController" "$CTL"; then
  echo "FAIL: pairingController.ts must define class PairingController"
  fail=1
fi
if ! grep -Fq "pairingSignal" "$CTL"; then
  echo "FAIL: PairingController must expose pairingSignal"
  fail=1
fi
if ! grep -Fq "createHandler" "$CTL"; then
  echo "FAIL: PairingController must expose createHandler"
  fail=1
fi
if ! grep -Fq "SystemRegister" "$CTL"; then
  echo "FAIL: PairingController must reference SystemRegister"
  fail=1
fi

# Bridge entry point
if ! grep -Eq "export\s+(async\s+)?function\s+startPairableBridge" "$BRIDGE"; then
  echo "FAIL: bridge.ts must export startPairableBridge"
  fail=1
fi
if ! grep -Fq "PairingController" "$BRIDGE"; then
  echo "FAIL: bridge.ts must construct a PairingController"
  fail=1
fi
if ! grep -Fq "SystemRegister" "$BRIDGE"; then
  echo "FAIL: bridge.ts must register the SystemRegister handler"
  fail=1
fi

# Extension wiring
if ! grep -Eq "registerCommand\(\s*['\"]nzrcode-bridge\.pairIpad['\"]" "$EXT"; then
  echo "FAIL: extension.ts must register 'nzrcode-bridge.pairIpad'"
  fail=1
fi
if ! grep -Fq "runPairCommand" "$EXT"; then
  echo "FAIL: extension.ts must invoke runPairCommand"
  fail=1
fi
if ! grep -Fq "startPairableBridge" "$EXT"; then
  echo "FAIL: extension.ts must invoke startPairableBridge"
  fail=1
fi
if ! grep -Fq "createWebviewPanel" "$EXT"; then
  echo "FAIL: extension.ts must construct a webview panel for the QR"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: pair palette command wired end-to-end"
fi
exit "$fail"
