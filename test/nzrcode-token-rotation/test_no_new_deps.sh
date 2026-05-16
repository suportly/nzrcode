#!/usr/bin/env bash
# Smoke: no new NPM dependencies were introduced for this feature.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

DIFF=$(git diff main -- package.json extensions/nzrcode-bridge/package.json 2>/dev/null | grep -E '^[+-]\s+"' | grep -vE 'name|version|description' || true)
if [[ -n "$DIFF" ]]; then
  echo "Detected package.json dependency drift vs main:"
  echo "$DIFF"
  echo "test_no_new_deps: FAIL"
  exit 1
fi
echo "test_no_new_deps: OK"
