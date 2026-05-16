#!/usr/bin/env bash
# Smoke: every source/test file the feature 0009 ships exists.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

FILES=(
  # Phase 1 — protocol + extension skeleton
  "extensions/nzrcode-bridge/package.json"
  "extensions/nzrcode-bridge/package.nls.json"
  "extensions/nzrcode-bridge/tsconfig.json"
  "extensions/nzrcode-bridge/esbuild.mts"
  "extensions/nzrcode-bridge/src/extension.ts"
  "extensions/nzrcode-bridge/src/protocol/jsonrpc.ts"
  "extensions/nzrcode-bridge/src/protocol/methods.ts"
  "extensions/nzrcode-bridge/src/protocol/events.ts"
  "extensions/nzrcode-bridge/src/protocol/errors.ts"
  "extensions/nzrcode-bridge/src/protocol/qr.ts"
  # Phase 2 — auth + persistence
  "extensions/nzrcode-bridge/src/server/auth.ts"
  "extensions/nzrcode-bridge/src/logging.ts"
  "extensions/nzrcode-bridge/src/server/state.ts"
  "extensions/nzrcode-bridge/src/pairing/pairedDevices.ts"
  # Phase 3 — WS server + dispatcher
  "extensions/nzrcode-bridge/src/server/wsServer.ts"
  "extensions/nzrcode-bridge/src/server/dispatcher.ts"
  "extensions/nzrcode-bridge/src/server/messageQueue.ts"
  "extensions/nzrcode-bridge/src/rpc/system.ts"
  "extensions/nzrcode-bridge/src/bridge.ts"
  # Phase 4 — RPC namespaces
  "extensions/nzrcode-bridge/src/rpc/commands.ts"
  "extensions/nzrcode-bridge/REQUIRES_ACTIVE_EDITOR.md"
  "extensions/nzrcode-bridge/src/rpc/workspace.ts"
  "extensions/nzrcode-bridge/src/rpc/editor.ts"
  "extensions/nzrcode-bridge/src/rpc/terminal.ts"
  "extensions/nzrcode-bridge/src/events/publisher.ts"
  "extensions/nzrcode-bridge/src/rpc/scm.ts"
  "extensions/nzrcode-bridge/src/rpc/tasks.ts"
  "extensions/nzrcode-bridge/src/rpc/debug.ts"
  "extensions/nzrcode-bridge/src/rpc/notifications.ts"
  # Phase 5 — pairing UX
  "extensions/nzrcode-bridge/src/pairing/endpoints.ts"
  "extensions/nzrcode-bridge/src/pairing/qrModal.ts"
  "extensions/nzrcode-bridge/src/pairing/pairCommand.ts"
  "extensions/nzrcode-bridge/src/pairing/listCommand.ts"
  "extensions/nzrcode-bridge/src/pairing/revokeCommand.ts"
  # Phase 6 — push
  "extensions/nzrcode-bridge/src/push/IPushProvider.ts"
  "extensions/nzrcode-bridge/src/push/fakePushProvider.ts"
  "extensions/nzrcode-bridge/src/push/relayPushProvider.ts"
  "extensions/nzrcode-bridge/src/push/inBandPushProvider.ts"
  "extensions/nzrcode-bridge/src/push/pushDispatcher.ts"
  "extensions/nzrcode-bridge/src/events/canonical.ts"
  # Phase 7 — integration
  "extensions/nzrcode-bridge/src/test/integration/handshake.test.ts"
  "extensions/nzrcode-bridge/src/test/integration/e2e.test.ts"
)

fail=0
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "MISSING: $f"
    fail=1
  fi
done

if [[ $fail -ne 0 ]]; then
  echo "test_files_exist: FAIL"
  exit 1
fi
echo "test_files_exist: OK"
