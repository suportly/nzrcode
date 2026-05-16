#!/usr/bin/env bash
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

tests=(
  test_files_exist.sh
  test_interface_shape.sh
  test_command_registered.sh
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

echo "Summary: all Mission Control smoke tests passed"
