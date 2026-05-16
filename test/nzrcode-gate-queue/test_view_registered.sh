#!/usr/bin/env bash
# Smoke: contribution registers a ViewContainer + a View in the AuxiliaryBar.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONTRIB="src/vs/workbench/contrib/nzr/browser/gateQueue.contribution.ts"
PANE="src/vs/workbench/contrib/nzr/browser/gateQueueView.ts"

if [[ ! -f "$CONTRIB" ]]; then
  echo "MISSING contribution file: $CONTRIB"
  exit 1
fi

fail=0

grep -q "registerViewContainer" "$CONTRIB" || { echo "missing registerViewContainer"; fail=1; }
grep -q "registerViews" "$CONTRIB" || { echo "missing registerViews"; fail=1; }
grep -q "workbench.view.nzr.gateQueue" "$CONTRIB" || { echo "missing container id"; fail=1; }
grep -q "GateQueueViewPane" "$CONTRIB" || { echo "missing GateQueueViewPane reference"; fail=1; }
grep -q "ViewContainerLocation.AuxiliaryBar" "$CONTRIB" || { echo "expected AuxiliaryBar"; fail=1; }
grep -q "import './media/gateQueue.css';" "$CONTRIB" || { echo "missing CSS import"; fail=1; }

if [[ ! -f "$PANE" ]]; then
  echo "MISSING pane file: $PANE"
  fail=1
else
  grep -q "class GateQueueViewPane extends ViewPane" "$PANE" || { echo "GateQueueViewPane must extend ViewPane"; fail=1; }
fi

MAIN="src/vs/workbench/workbench.common.main.ts"
grep -q "gateQueue.contribution.js" "$MAIN" || { echo "missing import in workbench.common.main.ts"; fail=1; }

if [[ $fail -ne 0 ]]; then
  echo "test_view_registered: FAIL"
  exit 1
fi
echo "test_view_registered: OK"
