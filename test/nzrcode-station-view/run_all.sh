#!/usr/bin/env bash
# Runs all 0007 smoke tests in order; exits non-zero on first failure.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TESTS=(
  "test_files_exist.sh"
  "test_view_registered.sh"
  "test_no_new_deps.sh"
  "test_i18n_strings.sh"
)

overall=0
for t in "${TESTS[@]}"; do
  echo "----- $t -----"
  if ! bash "$DIR/$t"; then
    overall=1
  fi
done

if [[ $overall -ne 0 ]]; then
  echo "===== run_all: FAIL ====="
  exit 1
fi
echo "===== run_all: OK ====="
