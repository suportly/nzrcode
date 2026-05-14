#!/usr/bin/env bash
# Spec: specs/0003-station-registry-service/spec.md — Story 1.1, 2.1-2.3
# Greps for the exported types, decorator, methods, and events that the
# spec contract requires. This is a *shape* check; runtime behaviour is
# the mocha test's job.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TYPES="$ROOT/src/vs/platform/nzr/common/pipelineState.ts"
IFACE="$ROOT/src/vs/platform/nzr/common/stationRegistry.ts"

fail=0
require_in() {
  local pattern="$1" file="$2"
  if ! grep -Eq "$pattern" "$file"; then
    echo "FAIL: $(basename "$file") missing /$pattern/"
    fail=1
  fi
}

if [ ! -f "$TYPES" ]; then
  echo "FAIL: $TYPES missing"
  exit 1
fi

# Types
require_in 'export type PipelineStage\s*=' "$TYPES"
# All 9 PipelineStage variants must appear in the file (any order/layout).
for stage in specify clarify plan tasks implement review done failed idle; do
  if ! grep -Eq "'${stage}'" "$TYPES"; then
    echo "FAIL: PipelineStage missing literal '${stage}'"
    fail=1
  fi
done
require_in 'export interface (Station|SpecRef|PipelineState|ClarifyMarker|ReviewFinding)\b' "$TYPES"
for iface in Station SpecRef PipelineState ClarifyMarker ReviewFinding ClaudeProcess; do
  if ! grep -Eq "export interface ${iface}\b" "$TYPES"; then
    echo "FAIL: pipelineState.ts missing 'export interface ${iface}'"
    fail=1
  fi
done
require_in 'export type GateReason\s*=' "$TYPES"

# Interface
if [ ! -f "$IFACE" ]; then
  echo "FAIL: $IFACE missing"
  exit 1
fi
require_in "createDecorator<IStationRegistryService>" "$IFACE"
require_in "export interface IStationRegistryService" "$IFACE"

# Events
for event in onStationAdded onStationRemoved onStationStageChanged; do
  if ! grep -Eq "readonly ${event}\s*:\s*Event<" "$IFACE"; then
    echo "FAIL: stationRegistry.ts missing 'readonly ${event}: Event<...>'"
    fail=1
  fi
done

# Methods
for method in getStation addStation removeStation updateStationPipeline; do
  if ! grep -Eq "(^|\s)${method}\s*\(" "$IFACE"; then
    echo "FAIL: stationRegistry.ts missing method '${method}'"
    fail=1
  fi
done

# Stations accessor
require_in "readonly stations\s*:" "$IFACE"

# NewStationInput type
require_in "export (type|interface) NewStationInput\b" "$IFACE"

if [ "$fail" -eq 0 ]; then
  echo "PASS: station registry interface shape"
fi
exit "$fail"
