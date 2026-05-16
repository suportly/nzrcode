#!/usr/bin/env bash
# Smoke: the extension is registered as a built-in in product.json + gulpfile + dirs.ts.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

fail=0

# Note: bundled built-in extensions like debug-auto-launch and nzrcode-bridge
# are NOT listed in product.json's "builtInExtensions" — that field is for
# marketplace-fetched extras. Bundled discovery happens via dirs.ts +
# the gulpfile compilations array; we assert those instead.

if ! grep -q "extensions/nzrcode-bridge/tsconfig.json" build/gulpfile.extensions.ts; then
  echo "build/gulpfile.extensions.ts: nzrcode-bridge tsconfig not in compilations array"
  fail=1
fi

if ! grep -q "extensions/nzrcode-bridge" build/npm/dirs.ts; then
  echo "build/npm/dirs.ts: extensions/nzrcode-bridge not in dirs list"
  fail=1
fi

if [[ $fail -ne 0 ]]; then
  echo "test_built_in_registration: FAIL"
  exit 1
fi
echo "test_built_in_registration: OK"
