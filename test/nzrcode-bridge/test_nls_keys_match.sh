#!/usr/bin/env bash
set -euo pipefail

# Smoke test: Verify all %...% references in package.json have corresponding keys in package.nls.json
# This ensures i18n keys are properly declared and not orphaned.

EXTENSION_DIR="extensions/nzrcode-bridge"
PACKAGE_JSON="${EXTENSION_DIR}/package.json"
PACKAGE_NLS="${EXTENSION_DIR}/package.nls.json"

# Extract all %...% references from package.json (limited to that file)
NLS_REFS=$(grep -o '%[^%]*%' "$PACKAGE_JSON" | sort -u | sed 's/%//g')

# For each reference, check if the key exists in package.nls.json
MISSING_KEYS=()
for key in $NLS_REFS; do
	if ! grep -q "\"$key\"" "$PACKAGE_NLS"; then
		MISSING_KEYS+=("$key")
	fi
done

# Report results
if [ ${#MISSING_KEYS[@]} -eq 0 ]; then
	exit 0
else
	{
		echo "Error: Missing keys in package.nls.json:"
		for key in "${MISSING_KEYS[@]}"; do
			echo "  - $key"
		done
	} >&2
	exit 1
fi
