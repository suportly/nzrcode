#!/usr/bin/env bash
# Spec: specs/0013-consumer-wiring-and-presets-dedup/spec.md — In scope item 1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FLOW="$ROOT/src/vs/workbench/contrib/nzr/browser/stationPaletteFlow.ts"

fail=0
if [ ! -f "$FLOW" ]; then
  echo "FAIL: $FLOW missing"
  exit 1
fi

# Must no longer declare its own const PRESETS array literal with the 4 strings.
if grep -Eq "PRESETS\s*=\s*\[\s*'django-react'" "$FLOW"; then
  echo "FAIL: stationPaletteFlow.ts still defines its own PRESETS literal"
  fail=1
fi

# Must re-export from nzrPipelineSettings.ts.
if ! grep -Fq "from './nzrPipelineSettings.js'" "$FLOW"; then
  echo "FAIL: stationPaletteFlow.ts must re-export PRESETS / Preset from ./nzrPipelineSettings.js"
  fail=1
fi

if ! grep -Eq "PIPELINE_PRESETS\s+as\s+PRESETS" "$FLOW"; then
  echo "FAIL: stationPaletteFlow.ts must export PIPELINE_PRESETS aliased as PRESETS"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: PRESETS deduplicated into nzrPipelineSettings.ts"
fi
exit "$fail"
