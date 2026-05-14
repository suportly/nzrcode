#!/usr/bin/env bash
# Aggregates the NZRCode brand smoke tests. Exit 0 only if every sub-test passes.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

tests=(
  test_product_json.sh
  test_icons_exist.sh
  test_no_residual_code_oss.sh
  test_resource_renames.sh
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

echo "Summary: all brand smoke tests passed"
