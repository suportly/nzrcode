#!/usr/bin/env bash
# Smoke: required source + test files exist for feature 0007.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

FILES=(
  "src/vs/workbench/contrib/nzr/browser/stationCard.ts"
  "src/vs/workbench/contrib/nzr/browser/pipelineRail.ts"
  "src/vs/workbench/contrib/nzr/browser/stationView.ts"
  "src/vs/workbench/contrib/nzr/browser/stationView.contribution.ts"
  "src/vs/workbench/contrib/nzr/browser/media/stationView.css"
  "src/vs/workbench/contrib/nzr/test/browser/stationCard.test.ts"
  "src/vs/workbench/contrib/nzr/test/browser/pipelineRail.test.ts"
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
