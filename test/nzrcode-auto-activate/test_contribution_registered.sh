#!/usr/bin/env bash
# Spec: specs/0014-mission-control-auto-activate/spec.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/missionControlAutoActivate.contribution.ts"
HELPER="$ROOT/src/vs/workbench/contrib/nzr/browser/missionControlAutoActivate.ts"
MAIN="$ROOT/src/vs/workbench/workbench.common.main.ts"

fail=0
for f in "$CONTRIB" "$HELPER"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

if ! grep -Fq "MissionControlAutoActivateContribution" "$CONTRIB"; then
  echo "FAIL: contribution must define class MissionControlAutoActivateContribution"
  fail=1
fi

if ! grep -Eq "registerWorkbenchContribution\(MissionControlAutoActivateContribution" "$CONTRIB"; then
  echo "FAIL: contribution must call registerWorkbenchContribution(MissionControlAutoActivateContribution, ...)"
  fail=1
fi

if ! grep -Eq "LifecyclePhase\.Restored" "$CONTRIB"; then
  echo "FAIL: contribution must register at LifecyclePhase.Restored"
  fail=1
fi

if ! grep -Fq "shouldAutoActivateMissionControl" "$CONTRIB"; then
  echo "FAIL: contribution must call shouldAutoActivateMissionControl"
  fail=1
fi

if ! grep -Fq "shouldAutoActivateMissionControl" "$HELPER"; then
  echo "FAIL: helper must export shouldAutoActivateMissionControl"
  fail=1
fi

if ! grep -Fq "./contrib/nzr/browser/missionControlAutoActivate.contribution.js" "$MAIN"; then
  echo "FAIL: workbench.common.main.ts does not import the Auto-Activate contribution"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Auto-Activate contribution registered"
fi
exit "$fail"
