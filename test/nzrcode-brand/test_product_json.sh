#!/usr/bin/env bash
# Spec: specs/0001-rebrand-product-json/spec.md — Story 1, Critério de Sucesso #1
# Asserts that product.json declares the NZRCode brand identity.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRODUCT="$ROOT/product.json"

if [ ! -f "$PRODUCT" ]; then
  echo "FAIL: $PRODUCT missing"
  exit 1
fi

fail=0
check_eq() {
  local key="$1" expected="$2"
  local actual
  actual=$(jq -r "$key" "$PRODUCT")
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $key — expected '$expected', got '$actual'"
    fail=1
  fi
}

check_contains() {
  local key="$1" needle="$2"
  local actual
  actual=$(jq -r "$key" "$PRODUCT")
  case "$actual" in
    *"$needle"*) : ;;
    *) echo "FAIL: $key — expected to contain '$needle', got '$actual'"; fail=1 ;;
  esac
}

check_differs() {
  local key="$1" forbidden="$2"
  local actual
  actual=$(jq -r "$key" "$PRODUCT")
  if [ "$actual" = "$forbidden" ]; then
    echo "FAIL: $key — must differ from upstream '$forbidden', but matches it"
    fail=1
  fi
}

# Core identity
check_eq '.applicationName'         'nzrcode'
check_eq '.nameShort'               'NZRCode'
check_eq '.nameLong'                'NZRCode'
check_eq '.dataFolderName'          '.nzrcode'
check_eq '.sharedDataFolderName'    '.nzrcode-shared'
check_eq '.urlProtocol'             'nzrcode'
check_eq '.linuxIconName'           'nzrcode'
check_eq '.darwinBundleIdentifier'  'com.suportly.nzrcode'
check_eq '.win32AppUserModelId'     'Suportly.NZRCode'

# Derived names — must mention nzrcode (not vscodeoss/code-server-oss)
check_contains '.win32MutexName'           'nzrcode'
check_contains '.win32TunnelMutex'         'nzrcode'
check_contains '.win32TunnelServiceMutex'  'nzrcode'
check_contains '.serverApplicationName'    'nzrcode'
check_contains '.serverDataFolderName'     'nzrcode'
check_contains '.tunnelApplicationName'    'nzrcode'
check_contains '.agentsTelemetryAppName'   'nzrcode'

# Issue/license URLs point to the suportly fork
check_eq '.reportIssueUrl'   'https://github.com/suportly/nzrcode/issues/new'
check_eq '.licenseUrl'       'https://github.com/suportly/nzrcode/blob/main/LICENSE.txt'
check_eq '.serverLicenseUrl' 'https://github.com/suportly/nzrcode/blob/main/LICENSE.txt'

# UUIDs must differ from upstream microsoft/vscode values
check_differs '.win32x64AppId'        '{{D77B7E06-80BA-4137-BCF4-654B95CCEBC5}'
check_differs '.win32arm64AppId'      '{{D1ACE434-89C5-48D1-88D3-E2991DF85475}'
check_differs '.win32x64UserAppId'    '{{CC6B787D-37A0-49E8-AE24-8559A032BE0C}'
check_differs '.win32arm64UserAppId'  '{{3AEBF0C8-F733-4AD4-BADE-FDB816D53D7B}'
check_differs '.darwinProfileUUID'        '47827DD9-4734-49A0-AF80-7E19B11495CC'
check_differs '.darwinProfilePayloadUUID' 'CF808BE7-53F3-46C6-A7E2-7EDB98A5E959'

if [ "$fail" -eq 0 ]; then
  echo "PASS: product.json brand identity"
fi
exit "$fail"
