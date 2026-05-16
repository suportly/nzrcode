#!/usr/bin/env bash
# Spec: specs/0011-welcome-screen/spec.md — Story "first-run notification"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts"
MAIN="$ROOT/src/vs/workbench/workbench.common.main.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  exit 1
fi

if ! grep -Fq "WelcomeNotificationContribution" "$CONTRIB"; then
  echo "FAIL: contribution must define class WelcomeNotificationContribution"
  fail=1
fi

if ! grep -Eq "registerWorkbenchContribution\(WelcomeNotificationContribution" "$CONTRIB"; then
  echo "FAIL: contribution must call registerWorkbenchContribution(WelcomeNotificationContribution, ...)"
  fail=1
fi

if ! grep -Eq "LifecyclePhase\.Restored" "$CONTRIB"; then
  echo "FAIL: contribution must register at LifecyclePhase.Restored"
  fail=1
fi

if ! grep -Eq "(nzr\.welcome\.shown|WELCOME_SHOWN_STORAGE_KEY)" "$CONTRIB"; then
  echo "FAIL: contribution must reference the 'nzr.welcome.shown' storage key"
  fail=1
fi

if ! grep -Fq "./contrib/nzr/browser/welcome.contribution.js" "$MAIN"; then
  echo "FAIL: workbench.common.main.ts does not import the Welcome contribution"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Welcome contribution registered"
fi
exit "$fail"
