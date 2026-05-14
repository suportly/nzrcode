#!/usr/bin/env bash
# Spec: specs/0005-claude-code-bridge/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TYPES="$ROOT/src/vs/platform/nzr/common/claudeCode.ts"
IFACE="$ROOT/src/vs/platform/nzr/common/claudeCodeBridge.ts"

fail=0
for f in "$TYPES" "$IFACE"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    fail=1
  fi
done
[ "$fail" -eq 0 ] || exit 1

require_in() {
  local pattern="$1" file="$2"
  if ! grep -Eq "$pattern" "$file"; then
    echo "FAIL: $(basename "$file") missing /$pattern/"
    fail=1
  fi
}

# Types
require_in 'export type ClaudeSessionStatus\s*=' "$TYPES"
for status in starting running completed failed cancelled; do
  if ! grep -Eq "'${status}'" "$TYPES"; then
    echo "FAIL: ClaudeSessionStatus missing '${status}'"
    fail=1
  fi
done
for type in ClaudeSessionOptions ClaudeSessionHandle ClaudeOutputChunk ClaudeSessionResult ClaudeSessionError; do
  if ! grep -Eq "export interface ${type}\b" "$TYPES"; then
    echo "FAIL: claudeCode.ts missing 'export interface ${type}'"
    fail=1
  fi
done

# Interface
require_in 'createDecorator<IClaudeCodeBridge>' "$IFACE"
require_in 'export interface IClaudeCodeBridge' "$IFACE"

for event in onSessionStarted onSessionOutput onSessionExit onSessionError; do
  if ! grep -Eq "readonly ${event}\s*:\s*Event<" "$IFACE"; then
    echo "FAIL: claudeCodeBridge.ts missing 'readonly ${event}: Event<...>'"
    fail=1
  fi
done

for method in startSession cancelSession getSession listActiveSessions; do
  if ! grep -Eq "(^|\s)${method}\s*\(" "$IFACE"; then
    echo "FAIL: claudeCodeBridge.ts missing method '${method}'"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "PASS: claude bridge interface shape"
fi
exit "$fail"
