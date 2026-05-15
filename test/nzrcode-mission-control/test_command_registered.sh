#!/usr/bin/env bash
# Spec: specs/0006-mission-control-shell/spec.md — Story 1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/missionControl.contribution.ts"
MAIN="$ROOT/src/vs/workbench/workbench.common.main.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  fail=1
fi
[ "$fail" -eq 0 ] || exit 1

if ! grep -Fq "nzr.toggleMissionControl" "$CONTRIB"; then
  echo "FAIL: contribution must register command id 'nzr.toggleMissionControl'"
  fail=1
fi

if ! grep -Eq "registerAction2\(|class\s+\w+\s+extends\s+Action2" "$CONTRIB"; then
  echo "FAIL: contribution must register the toggle command via Action2"
  fail=1
fi

if ! grep -Fq "nzr.missionControl.active" "$CONTRIB"; then
  echo "FAIL: contribution must declare the 'nzr.missionControl.active' context key"
  fail=1
fi

if ! grep -Eq "RawContextKey<boolean>" "$CONTRIB"; then
  echo "FAIL: context key must be a RawContextKey<boolean>"
  fail=1
fi

if ! grep -Fq "./contrib/nzr/browser/missionControl.contribution.js" "$MAIN"; then
  echo "FAIL: workbench.common.main.ts does not import the Mission Control contribution"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Mission Control toggle command and context key registered"
fi
exit "$fail"
