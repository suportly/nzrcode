#!/usr/bin/env bash
# Aggregates the station registry smoke suite.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

tests=(
  test_files_exist.sh
  test_interface_shape.sh
  test_typecheck.sh
  test_registration.sh
)

failed=0
for t in "${tests[@]}"; do
  echo "=== $t ==="
  if bash "$DIR/$t"; then
    :
  else
    failed=$((failed + 1))
  fi
  echo
done

if [ "$failed" -gt 0 ]; then
  echo "Summary: $failed sub-test(s) failed"
  exit 1
fi

echo "Summary: all station registry smoke tests passed"
