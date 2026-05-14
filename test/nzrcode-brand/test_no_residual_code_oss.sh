#!/usr/bin/env bash
# Spec: specs/0001-rebrand-product-json/spec.md — Critério de Sucesso #5
# Greps for stray 'code-oss' references in branding-relevant paths.
# Whitelisted hits must carry the marker '# nzrcode-allow:code-oss-ref'
# (or '// nzrcode-allow:code-oss-ref' for JSON-with-comments-style files).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

paths=(
  product.json
  resources
  scripts/code.sh
  build/linux
)

# Filter out whitelisted lines, then count remaining hits.
hits=$(grep -rn 'code-oss' "${paths[@]}" 2>/dev/null \
  | grep -v 'nzrcode-allow:code-oss-ref' \
  || true)

if [ -n "$hits" ]; then
  echo "FAIL: residual 'code-oss' references found:"
  echo "$hits"
  exit 1
fi

echo "PASS: no residual 'code-oss' in branding paths"
