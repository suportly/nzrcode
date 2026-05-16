#!/usr/bin/env bash
# Smoke: visible labels in feature files go through localize() / localize2().
# Heuristic: search for obvious user-facing string patterns in contribution + view.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONTRIB="src/vs/workbench/contrib/nzr/browser/stationView.contribution.ts"
PANE="src/vs/workbench/contrib/nzr/browser/stationView.ts"
RAIL="src/vs/workbench/contrib/nzr/browser/pipelineRail.ts"

fail=0
for f in "$CONTRIB" "$PANE" "$RAIL"; do
  [[ ! -f "$f" ]] && continue
  # any localize call present?
  if ! grep -qE "localize2?\(" "$f"; then
    echo "$f: no localize() calls found"
    fail=1
  fi
done

# Also check: pane should not hard-code English titles in renderBody.
if [[ -f "$PANE" ]]; then
  # very narrow check: no `textContent = 'something with a space'` literal
  if grep -nE "textContent\s*=\s*['\"][A-Za-z ]{4,}" "$PANE"; then
    echo "$PANE: hard-coded textContent literals detected"
    fail=1
  fi
fi

if [[ $fail -ne 0 ]]; then
  echo "test_i18n_strings: FAIL"
  exit 1
fi
echo "test_i18n_strings: OK"
