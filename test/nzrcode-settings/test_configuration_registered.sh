#!/usr/bin/env bash
# Spec: specs/0012-settings-pipeline-section/spec.md — Story "schema registration"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRIB="$ROOT/src/vs/workbench/contrib/nzr/browser/settings.contribution.ts"
HELPERS="$ROOT/src/vs/workbench/contrib/nzr/browser/nzrPipelineSettings.ts"
MAIN="$ROOT/src/vs/workbench/workbench.common.main.ts"

fail=0
if [ ! -f "$CONTRIB" ]; then
  echo "FAIL: $CONTRIB missing"
  exit 1
fi
if [ ! -f "$HELPERS" ]; then
  echo "FAIL: $HELPERS missing"
  exit 1
fi

if ! grep -Fq "registerConfiguration" "$CONTRIB"; then
  echo "FAIL: contribution must call registerConfiguration"
  fail=1
fi

if ! grep -Eq "id:\s*['\"]nzrcode['\"]" "$CONTRIB"; then
  echo "FAIL: configuration node must use id: 'nzrcode'"
  fail=1
fi

# Setting keys may live in nzrPipelineSettings.ts as constants and be
# referenced from settings.contribution.ts via SETTING_* names. Accept
# either location.
for key in \
  "nzrcode.pipeline.defaultPreset" \
  "nzrcode.pipeline.defaultBranch" \
  "nzrcode.welcome.showOnStartup" \
  "nzrcode.missionControl.autoActivate"; do
  if ! grep -Fq "$key" "$CONTRIB" && ! grep -Fq "$key" "$HELPERS"; then
    echo "FAIL: setting key '$key' not present in contribution or helpers"
    fail=1
  fi
done

if ! grep -Eq "'lean'|\"lean\"" "$CONTRIB" && ! grep -Eq "'lean'|\"lean\"" "$HELPERS"; then
  echo "FAIL: 'lean' must appear as the preset default in contribution or helpers"
  fail=1
fi

if ! grep -Fq "./contrib/nzr/browser/settings.contribution.js" "$MAIN"; then
  echo "FAIL: workbench.common.main.ts does not import the Settings contribution"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: NZRCode configuration registered with 4 settings"
fi
exit "$fail"
