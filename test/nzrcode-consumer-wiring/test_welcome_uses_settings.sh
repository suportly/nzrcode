#!/usr/bin/env bash
# Spec: specs/0013-consumer-wiring-and-presets-dedup/spec.md — In scope item 3
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts"
HELPER="$ROOT/src/vs/workbench/contrib/nzr/browser/nzrWelcomeGate.ts"

fail=0
for f in "$CONTRIB" "$HELPER"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

if ! grep -Fq "IConfigurationService" "$CONTRIB"; then
  echo "FAIL: welcome.contribution.ts must import IConfigurationService"
  fail=1
fi

if ! grep -Fq "shouldAutoShowWelcome" "$CONTRIB"; then
  echo "FAIL: welcome.contribution.ts must use shouldAutoShowWelcome"
  fail=1
fi

if ! grep -Fq "shouldAutoShowWelcome" "$HELPER"; then
  echo "FAIL: nzrWelcomeGate.ts must export shouldAutoShowWelcome"
  fail=1
fi

if ! grep -Fq "getWelcomeShowOnStartup" "$HELPER"; then
  echo "FAIL: nzrWelcomeGate.ts must call getWelcomeShowOnStartup"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Welcome gates auto-show with the showOnStartup setting"
fi
exit "$fail"
