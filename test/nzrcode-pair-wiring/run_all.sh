#!/usr/bin/env bash
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

tests=(
  test_files_exist.sh
  test_protocol_extended.sh
  test_pair_wired.sh
  test_no_new_deps.sh
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

echo "Summary: all Pair Wiring smoke tests passed"
