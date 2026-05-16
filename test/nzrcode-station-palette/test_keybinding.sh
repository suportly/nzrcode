#!/usr/bin/env bash
# Spec: specs/0010-add-station-palette/spec.md — Acceptance "keybinding ⌘⇧S"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/stationPalette.contribution.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  exit 1
fi

if ! grep -Fq "KeybindingsRegistry.registerKeybindingRule" "$CONTRIB"; then
  echo "FAIL: contribution must call KeybindingsRegistry.registerKeybindingRule"
  fail=1
fi

if ! grep -Eq "KeyMod\.CtrlCmd[[:space:]]*\|[[:space:]]*KeyMod\.Shift[[:space:]]*\|[[:space:]]*KeyCode\.KeyS" "$CONTRIB"; then
  echo "FAIL: keybinding must be CtrlCmd+Shift+S"
  fail=1
fi

if ! grep -Eq "(nzr\.missionControl\.active|MissionControlActiveContext)" "$CONTRIB"; then
  echo "FAIL: keybinding must be gated by 'nzr.missionControl.active' (literal or MissionControlActiveContext)"
  fail=1
fi

if ! grep -Fq "nzr.station.add" "$CONTRIB"; then
  echo "FAIL: keybinding must bind to command 'nzr.station.add'"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Station Palette keybinding registered (⌘⇧S → nzr.station.add when nzr.missionControl.active)"
fi
exit "$fail"
