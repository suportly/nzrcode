#!/usr/bin/env bash
# Spec: specs/0011-welcome-screen/spec.md — Acceptance "nzr.welcome.show command"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  exit 1
fi

if ! grep -Fq "nzr.welcome.show" "$CONTRIB"; then
  echo "FAIL: command id 'nzr.welcome.show' not registered"
  fail=1
fi

if ! grep -Eq "class\s+\w+\s+extends\s+Action2" "$CONTRIB"; then
  echo "FAIL: contribution must register the command via Action2"
  fail=1
fi

if ! grep -Fq "f1: true" "$CONTRIB"; then
  echo "FAIL: command must expose itself via the command palette (f1: true)"
  fail=1
fi

if ! grep -Eq "category:\s*(NZR_CATEGORY|nzrCategory|['\"]NZR['\"])" "$CONTRIB"; then
  echo "FAIL: command must use NZR category"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: nzr.welcome.show command registered"
fi
exit "$fail"
