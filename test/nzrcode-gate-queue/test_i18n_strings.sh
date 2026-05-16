#!/usr/bin/env bash
# Smoke: visible labels in feature files go through localize() / localize2().
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONTRIB="src/vs/workbench/contrib/nzr/browser/gateQueue.contribution.ts"
PANE="src/vs/workbench/contrib/nzr/browser/gateQueueView.ts"
ITEM="src/vs/workbench/contrib/nzr/browser/gateQueueItem.ts"
CARD="src/vs/workbench/contrib/nzr/browser/gateCard.ts"

fail=0
for f in "$CONTRIB" "$PANE" "$ITEM" "$CARD"; do
  [[ ! -f "$f" ]] && continue
  if ! grep -qE "localize2?\(" "$f"; then
    echo "$f: no localize() calls found"
    fail=1
  fi
done

if [[ $fail -ne 0 ]]; then
  echo "test_i18n_strings: FAIL"
  exit 1
fi
echo "test_i18n_strings: OK"
