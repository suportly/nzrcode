# Cold-start benchmark results — nzrcode-bridge

This file is overwritten by `test/nzrcode-bridge/bench_cold_start.sh`.
Until that script is executed on an 8 vCPU / 16 GB / SSD NVMe machine
with a compiled VS Code build, the table below is a placeholder.

| Field        | Value                                |
|--------------|--------------------------------------|
| Hostname     | _pending_                            |
| OS           | _pending_                            |
| CPU          | _pending_                            |
| Cores        | _pending (need ≥ 8)_                 |
| RAM (GB)     | _pending (need ≥ 16)_                |
| Runs each    | 10                                   |

Median (with extension):    _pending_ ms
Median (without extension): _pending_ ms
Overhead:                   _pending_ ms (budget ≤ 50 ms)

## How to populate this file

```bash
# Requires: npm install && npm run compile && ./scripts/code.sh built
bash test/nzrcode-bridge/bench_cold_start.sh
```

If the script aborts with "machine reports … vCPUs / GB" it means the
host does not meet the methodology class — run on a dev laptop matching
the spec or document a justified deviation.
