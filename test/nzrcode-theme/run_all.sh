#!/usr/bin/env bash
# Aggregates the NZR theme smoke tests.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

tests=(
  test_tokens_shape.sh
  test_nzr_dark_json.sh
  test_default_theme.sh
  test_theme_registration.sh
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

echo "Summary: all NZR theme smoke tests passed"
