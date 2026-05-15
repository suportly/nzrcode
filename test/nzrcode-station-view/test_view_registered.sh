#!/usr/bin/env bash
# Smoke: contribution registers a ViewContainer + a View bound to StationViewPane.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CONTRIB="src/vs/workbench/contrib/nzr/browser/stationView.contribution.ts"
PANE="src/vs/workbench/contrib/nzr/browser/stationView.ts"

if [[ ! -f "$CONTRIB" ]]; then
  echo "MISSING contribution file: $CONTRIB"
  exit 1
fi

fail=0

grep -q "registerViewContainer" "$CONTRIB" || { echo "missing registerViewContainer"; fail=1; }
grep -q "registerViews" "$CONTRIB" || { echo "missing registerViews"; fail=1; }
grep -q "workbench.view.nzr.missionControl" "$CONTRIB" || { echo "missing container id workbench.view.nzr.missionControl"; fail=1; }
grep -q "workbench.view.nzr.stations" "$CONTRIB" || { echo "missing view id workbench.view.nzr.stations"; fail=1; }
grep -q "StationViewPane" "$CONTRIB" || { echo "missing StationViewPane reference in contribution"; fail=1; }
grep -q "ViewContainerLocation.Sidebar" "$CONTRIB" || { echo "expected ViewContainerLocation.Sidebar"; fail=1; }
grep -q "import './media/stationView.css';" "$CONTRIB" || { echo "missing CSS import"; fail=1; }

if [[ ! -f "$PANE" ]]; then
  echo "MISSING pane file: $PANE"
  fail=1
else
  grep -q "class StationViewPane extends ViewPane" "$PANE" || { echo "StationViewPane must extend ViewPane"; fail=1; }
fi

# Workbench import wired
MAIN="src/vs/workbench/workbench.common.main.ts"
grep -q "stationView.contribution.js" "$MAIN" || { echo "missing import in workbench.common.main.ts"; fail=1; }

if [[ $fail -ne 0 ]]; then
  echo "test_view_registered: FAIL"
  exit 1
fi
echo "test_view_registered: OK"
