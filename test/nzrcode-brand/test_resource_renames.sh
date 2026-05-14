#!/usr/bin/env bash
# Spec: specs/0001-rebrand-product-json/spec.md — Story 2 cenário 3, Story 3 cenário 1
# Asserts that upstream-named resource files were removed in favor of nzrcode-prefixed ones.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail=0
must_not_exist() {
  if [ -e "$ROOT/$1" ]; then
    echo "FAIL: $1 must be removed/renamed for the rebrand"
    fail=1
  fi
}

must_not_exist 'resources/linux/code.desktop'
must_not_exist 'resources/linux/code-url-handler.desktop'
must_not_exist 'resources/linux/code-workspace.xml'
must_not_exist 'resources/linux/code.appdata.xml'
must_not_exist 'resources/linux/code.png'
must_not_exist 'resources/darwin/code.icns'
must_not_exist 'resources/win32/code_70x70.png'
must_not_exist 'resources/win32/code_150x150.png'

if [ "$fail" -eq 0 ]; then
  echo "PASS: upstream-named resource files removed"
fi
exit "$fail"
