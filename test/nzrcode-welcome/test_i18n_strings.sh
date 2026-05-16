#!/usr/bin/env bash
# Spec: specs/0011-welcome-screen/spec.md — Acceptance "all visible strings via localize"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/welcome.contribution.ts"
FLOW="$ROOT/src/vs/workbench/contrib/nzr/browser/welcomeFlow.ts"

fail=0
for f in "$CONTRIB" "$FLOW"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

if ! grep -Eq "(localize|localize2)\(" "$CONTRIB"; then
  echo "FAIL: contribution must use localize/localize2 for visible strings"
  fail=1
fi

if ! grep -Eq "(localize|localize2)\(" "$FLOW"; then
  echo "FAIL: welcomeFlow must use localize for action labels and message"
  fail=1
fi

if grep -Eq "title:\s*['\"][^'\"]+['\"]" "$CONTRIB"; then
  echo "FAIL: a 'title:' field uses a bare string literal instead of localize2(...)"
  grep -nE "title:\s*['\"][^'\"]+['\"]" "$CONTRIB"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Welcome strings localized"
fi
exit "$fail"
