#!/usr/bin/env bash
# Spec: specs/0004-aiadev-adapter/spec.md — Story 1, 3
# Greps for the exported types, decorator, events, and methods declared
# in the spec.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TYPES="$ROOT/src/vs/platform/nzr/common/aiadev.ts"
IFACE="$ROOT/src/vs/platform/nzr/common/aiadevAdapter.ts"

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
require_in 'export type AiadevCommand\s*=' "$TYPES"
for cmd in preflight validate sync init; do
  if ! grep -Eq "'${cmd}'" "$TYPES"; then
    echo "FAIL: AiadevCommand missing '${cmd}'"
    fail=1
  fi
done
require_in 'export interface AiadevResult\b' "$TYPES"
require_in 'export interface SpecChangedEvent\b' "$TYPES"
require_in 'export interface ClarifyMarkersDetectedEvent\b' "$TYPES"
require_in 'export interface AdapterError\b' "$TYPES"

# Interface
require_in 'createDecorator<IAiadevAdapter>' "$IFACE"
require_in 'export interface IAiadevAdapter' "$IFACE"

for event in onClarifyMarkersDetected onSpecChanged onAdapterError; do
  if ! grep -Eq "readonly ${event}\s*:\s*Event<" "$IFACE"; then
    echo "FAIL: aiadevAdapter.ts missing 'readonly ${event}: Event<...>'"
    fail=1
  fi
done

for method in runPreflight runValidate runSync runInit attachSpecWatcher; do
  if ! grep -Eq "(^|\s)${method}\s*\(" "$IFACE"; then
    echo "FAIL: aiadevAdapter.ts missing method '${method}'"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "PASS: aiadev adapter interface shape"
fi
exit "$fail"
