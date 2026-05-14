#!/usr/bin/env bash
# Best-effort TypeScript syntax check over the station registry files.
#
# Full type-checking of VS Code source files requires the project's
# tsconfig (path aliases, lib references) and a complete `npm install` —
# both too heavy to enforce in a shell smoke test. This script runs a
# syntax-only pass with `tsc --noEmit --allowImportingTsExtensions
# --noResolve --skipLibCheck --isolatedModules`, which catches:
#
#   - parse errors
#   - duplicate identifiers within a file
#   - obviously malformed signatures
#
# Cross-module type errors (a callsite passing the wrong type) only
# surface in the real `npm run compile`. CI / the dev build is the gate
# for those.
#
# When `tsc` is unavailable (no PATH entry, npx network failure) the
# script reports SKIP and exits 0 — that path runs in CI environments
# without Node networking. To enforce strict typecheck locally, set
# AIADEV_REQUIRE_TSC=1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
files=(
  "$ROOT/src/vs/platform/nzr/common/pipelineState.ts"
  "$ROOT/src/vs/platform/nzr/common/stationRegistry.ts"
  "$ROOT/src/vs/workbench/services/nzr/common/stationRegistryService.ts"
  "$ROOT/src/vs/workbench/services/nzr/common/nzr.contribution.ts"
  "$ROOT/src/vs/platform/nzr/test/common/stationRegistry.test.ts"
)

for f in "${files[@]}"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f missing"
    exit 1
  fi
done

# Locate a tsc.
TSC=""
if command -v tsc >/dev/null 2>&1; then
  TSC="tsc"
elif [ -x "$ROOT/node_modules/.bin/tsc" ]; then
  TSC="$ROOT/node_modules/.bin/tsc"
fi

if [ -z "$TSC" ]; then
  if [ "${AIADEV_REQUIRE_TSC:-0}" = "1" ]; then
    echo "FAIL: tsc not found and AIADEV_REQUIRE_TSC=1"
    exit 1
  fi
  echo "SKIP: tsc not on PATH and no node_modules; syntax check deferred to CI / dev build"
  exit 0
fi

# Syntax-only pass.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/tsconfig.json" <<JSON
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "noResolve": true
  },
  "files": [
$(printf '    "%s"' "${files[0]}"; for f in "${files[@]:1}"; do printf ',\n    "%s"' "$f"; done)
  ]
}
JSON

if "$TSC" -p "$tmp/tsconfig.json" 2>&1 | tee "$tmp/out"; then
  echo "PASS: station registry files parse cleanly"
  exit 0
fi

# tsc returned non-zero but with --noResolve many cross-module imports
# show up as 'Cannot find module'. Those are expected in this mode and
# are not failures we want to gate on.
errors=$(grep -E "error TS" "$tmp/out" | grep -v "Cannot find module" | wc -l)
if [ "$errors" -eq 0 ]; then
  echo "PASS: only expected 'Cannot find module' diagnostics under --noResolve"
  exit 0
fi
echo "FAIL: $errors non-resolution errors reported by tsc"
exit 1
