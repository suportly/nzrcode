#!/usr/bin/env bash
# Spec: specs/0006-mission-control-shell/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GRID="$ROOT/src/vs/workbench/services/nzr/common/gridLayout.ts"
IFACE="$ROOT/src/vs/workbench/services/nzr/common/missionControl.ts"

fail=0
for f in "$GRID" "$IFACE"; do
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

# gridLayout
require_in 'export function computeGridLayout\s*\(' "$GRID"
require_in 'export interface GridLayout\b' "$GRID"

# missionControl interface
require_in 'export interface MissionControlSlot\b' "$IFACE"
require_in 'createDecorator<IMissionControlService>' "$IFACE"
require_in 'export interface IMissionControlService' "$IFACE"

for event in onDidChangeActive onDidChangeSlots; do
  if ! grep -Eq "readonly ${event}\s*:\s*Event<" "$IFACE"; then
    echo "FAIL: missionControl.ts missing 'readonly ${event}: Event<...>'"
    fail=1
  fi
done

for member in 'readonly isActive' 'readonly slots' 'readonly layout'; do
  if ! grep -Eq "${member}\s*:" "$IFACE"; then
    echo "FAIL: missionControl.ts missing '${member}: ...'"
    fail=1
  fi
done

for method in toggle setActive; do
  if ! grep -Eq "(^|\s)${method}\s*\(" "$IFACE"; then
    echo "FAIL: missionControl.ts missing method '${method}'"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "PASS: Mission Control interface shape"
fi
exit "$fail"
