#!/usr/bin/env bash
# Smoke runner for feature 0009 nzrcode-bridge.
# Runs:
#   1. structural smokes (3 shell tests)
#   2. mocha unit + integration suite (in extensions/nzrcode-bridge)
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$REPO_ROOT"

TESTS=(
  "test_files_exist.sh"
  "test_no_new_deps_root.sh"
  "test_built_in_registration.sh"
)

overall=0
for t in "${TESTS[@]}"; do
  echo "----- $t -----"
  if ! bash "$DIR/$t"; then
    overall=1
  fi
done

echo "----- mocha (unit + integration) -----"
if ( cd "$REPO_ROOT/extensions/nzrcode-bridge" && npm test ) > /tmp/nzrcode-bridge-mocha.out 2>&1; then
  tail -5 /tmp/nzrcode-bridge-mocha.out
  echo "mocha: OK"
else
  cat /tmp/nzrcode-bridge-mocha.out
  echo "mocha: FAIL"
  overall=1
fi

if [[ $overall -ne 0 ]]; then
  echo "===== run_all: FAIL ====="
  exit 1
fi
echo "===== run_all: OK ====="
