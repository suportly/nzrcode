#!/usr/bin/env bash
# Smoke: required source + test files exist for feature 0008.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

FILES=(
  "src/vs/workbench/contrib/nzr/browser/gateQueueItem.ts"
  "src/vs/workbench/contrib/nzr/browser/gateCard.ts"
  "src/vs/workbench/contrib/nzr/browser/gateQueueView.ts"
  "src/vs/workbench/contrib/nzr/browser/gateQueue.contribution.ts"
  "src/vs/workbench/contrib/nzr/browser/media/gateQueue.css"
  "src/vs/workbench/contrib/nzr/test/browser/gateQueueItem.test.ts"
  "src/vs/workbench/contrib/nzr/test/browser/gateCard.test.ts"
)

fail=0
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "MISSING: $f"
    fail=1
  fi
done

if [[ $fail -ne 0 ]]; then
  echo "test_files_exist: FAIL"
  exit 1
fi
echo "test_files_exist: OK"
