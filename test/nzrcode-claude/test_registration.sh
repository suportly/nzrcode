#!/usr/bin/env bash
# Spec: specs/0005-claude-code-bridge/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts"

if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  exit 1
fi

if ! grep -Eq "registerSingleton\(\s*IClaudeCodeBridge\b" "$CONTRIB"; then
  echo "FAIL: nzr.electron.contribution.ts does not register IClaudeCodeBridge"
  exit 1
fi

echo "PASS: ClaudeCodeBridge singleton registered"
