#!/usr/bin/env bash
# Spec: specs/0004-aiadev-adapter/spec.md — wiring
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/services/nzr/electron-browser/nzr.electron.contribution.ts"
MAIN="$ROOT/src/vs/workbench/workbench.desktop.main.ts"

fail=0
for f in "$CONTRIB" "$MAIN"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    fail=1
  fi
done
[ "$fail" -eq 0 ] || exit 1

if ! grep -Eq "registerSingleton\(\s*IAiadevAdapter\b" "$CONTRIB"; then
  echo "FAIL: nzr.electron.contribution.ts does not register IAiadevAdapter"
  fail=1
fi

if ! grep -Fq "./services/nzr/electron-browser/nzr.electron.contribution.js" "$MAIN"; then
  echo "FAIL: workbench.desktop.main.ts does not import the electron contribution"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: AiadevAdapter singleton registered and wired into desktop main"
fi
exit "$fail"
