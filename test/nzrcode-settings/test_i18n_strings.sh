#!/usr/bin/env bash
# Spec: specs/0012-settings-pipeline-section/spec.md — Acceptance "all visible strings via localize"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/settings.contribution.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  exit 1
fi

if ! grep -Eq "localize\(" "$CONTRIB"; then
  echo "FAIL: contribution must use localize() for visible strings"
  fail=1
fi

if grep -Eq "title:\s*['\"][^'\"]+['\"]" "$CONTRIB"; then
  echo "FAIL: a 'title:' field uses a bare string literal instead of localize(...)"
  grep -nE "title:\s*['\"][^'\"]+['\"]" "$CONTRIB"
  fail=1
fi

if grep -Eq "description:\s*['\"][^'\"]+['\"]" "$CONTRIB"; then
  echo "FAIL: a 'description:' field uses a bare string literal instead of localize(...)"
  grep -nE "description:\s*['\"][^'\"]+['\"]" "$CONTRIB"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: Settings strings localized"
fi
exit "$fail"
