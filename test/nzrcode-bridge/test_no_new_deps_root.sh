#!/usr/bin/env bash
# Smoke: root package.json has no new runtime/dev deps introduced by feature 0009.
# Per-extension deps (e.g. qrcode-generator inside extensions/nzrcode-bridge)
# are isolated and DO NOT count as root drift.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Only flag lines that look like dependency additions in the root package.json.
DIFF=$(git diff main -- package.json 2>/dev/null | grep -E '^[+-]\s+"' | grep -vE 'name|version|description' || true)
if [[ -n "$DIFF" ]]; then
  echo "Root package.json drifted vs main:"
  echo "$DIFF"
  echo "test_no_new_deps_root: FAIL"
  exit 1
fi
echo "test_no_new_deps_root: OK"
