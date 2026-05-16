#!/usr/bin/env bash
# Cold-start benchmark for nzrcode-bridge (Success criterion #5 / cl-10).
#
# Methodology
# -----------
# Required hardware class: laptop dev — 8 vCPU / 16 GB RAM / SSD NVMe.
#                          Workspace MUST be empty (no folder argument).
# 10 runs of `time ./scripts/code.sh --wait` with the extension enabled.
# 10 runs of `time ./scripts/code.sh --wait --disable-extension vscode.nzrcode-bridge`.
# We compute the median of each set; the overhead introduced by the bridge
# must be ≤ 50 ms.
#
# Output: `specs/0009-nzrcode-bridge/evidence/cold_start_results.md` is
# updated with hostname, OS, total RAM, CPU model, and the two medians.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$REPO_ROOT/specs/0009-nzrcode-bridge/evidence/cold_start_results.md"

# ─── Hardware sanity ──────────────────────────────────────────────────────────

CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 0)
TOTAL_MEM_KB=$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
TOTAL_MEM_GB=$(( TOTAL_MEM_KB / 1024 / 1024 ))

if [[ "$CORES" -lt 8 ]]; then
  echo "ABORT: machine reports $CORES vCPUs (need ≥ 8). Aborting per methodology." >&2
  exit 1
fi
if [[ "$TOTAL_MEM_GB" -lt 16 ]]; then
  echo "ABORT: machine reports ${TOTAL_MEM_GB} GB RAM (need ≥ 16). Aborting per methodology." >&2
  exit 1
fi

if [[ ! -x "$REPO_ROOT/scripts/code.sh" ]]; then
  echo "ABORT: scripts/code.sh not found or not executable. Did you compile VS Code first?" >&2
  exit 1
fi

# ─── Helpers ──────────────────────────────────────────────────────────────────

# Read seconds-with-ms from `time` output; return integer ms.
elapsed_ms() {
  local out="$1"
  # bash's `time -p` prints e.g.  real 1.23 → 1230 ms.
  echo "$out" | awk '/^real/ { printf "%d", $2 * 1000 }'
}

median_ms() {
  local sorted
  sorted=$(printf '%s\n' "$@" | sort -n)
  local count
  count=$(echo "$sorted" | wc -l | tr -d ' ')
  echo "$sorted" | sed -n "$(( (count + 1) / 2 ))p"
}

run_one() {
  local label="$1"
  shift
  local timing
  timing=$( { time -p "$@" --wait 1>/dev/null 2>&1 ; } 2>&1 )
  elapsed_ms "$timing"
}

# ─── Measure ──────────────────────────────────────────────────────────────────

cd "$REPO_ROOT"

WITH=()
WITHOUT=()

for i in $(seq 1 10); do
  echo "with #$i" >&2
  WITH+=("$(run_one "with" ./scripts/code.sh)")
done

for i in $(seq 1 10); do
  echo "without #$i" >&2
  WITHOUT+=("$(run_one "without" ./scripts/code.sh --disable-extension vscode.nzrcode-bridge)")
done

MED_WITH=$(median_ms "${WITH[@]}")
MED_WITHOUT=$(median_ms "${WITHOUT[@]}")
OVERHEAD=$(( MED_WITH - MED_WITHOUT ))

# ─── Record evidence ──────────────────────────────────────────────────────────

mkdir -p "$(dirname "$OUT")"
CPU_MODEL=$(grep -m 1 'model name' /proc/cpuinfo | sed 's/.*: //' || echo unknown)
OS_INFO=$(uname -srm)

cat > "$OUT" <<EOF
# Cold-start benchmark results — nzrcode-bridge

| Field        | Value                                |
|--------------|--------------------------------------|
| Hostname     | $(hostname)                          |
| OS           | $OS_INFO                             |
| CPU          | $CPU_MODEL                           |
| Cores        | $CORES                               |
| RAM (GB)     | $TOTAL_MEM_GB                        |
| Runs each    | 10                                   |

Median (with extension):    ${MED_WITH} ms
Median (without extension): ${MED_WITHOUT} ms
Overhead:                   ${OVERHEAD} ms (budget ≤ 50 ms)

Raw timings (ms):
- with:    ${WITH[*]}
- without: ${WITHOUT[*]}
EOF

echo "Wrote $OUT"
echo "Overhead: ${OVERHEAD} ms"

if [[ "$OVERHEAD" -gt 50 ]]; then
  echo "FAIL: overhead ${OVERHEAD} ms exceeds the 50 ms budget" >&2
  exit 1
fi

echo "PASS: overhead within budget"
