# nzrcode-bridge

Built-in extension that exposes the NZRCode editor to a paired companion
device (iPad / mobile) over a loopback-only WebSocket transport. The bridge
ships JSON-RPC handlers for `commands`, `workspace`, `editor`, `terminal`,
`scm`, `tasks`, `debug`, and `notifications`, plus event streaming for
terminal output and debug stop events.

## How it activates

Activation is automatic on `onStartupFinished`. The WebSocket server is
**not** started unless `~/.nzrcode/bridge.json` exists — i.e. unless the
user has at least once run **NZRCode: Pair iPad**. This keeps cold-start
overhead below 50 ms in the unpaired case.

## Commands (palette)

- **NZRCode: Pair iPad** — opens a QR-code modal embedding a v1 payload
  with the bridge token plus every advertisable LAN / Tailscale endpoint.
- **NZRCode: List Paired Devices** — QuickPick showing every paired
  device with its humanised last-seen timestamp.
- **NZRCode: Revoke iPad** — QuickPick + confirmation; revokes the
  selected device and drops the in-flight WebSocket connections.

## External access — Tailscale

When the iPad lives outside the LAN, the bridge advertises the host's
Tailscale IPv4 alongside the LAN endpoints (cl-4). Setup checklist:

1. `tailscale` binary is on `PATH` and `tailscale ip -4` returns at
   least one address.
2. Both the laptop and the iPad are on the same tailnet.
3. **No CDN** — the QR webview bundles `qrcode-generator` locally
   (MIT, see CREDITS.md).

If the `tailscale` binary is missing or hangs (≥ 500 ms), the bridge
falls back silently to LAN-only endpoints — the Pair command continues
to work.

## Troubleshooting

- **"No paired devices"** after pairing — the iPad must complete the
  WebSocket auth handshake before the modal closes. Check the
  **NZRCode Bridge** output channel for an `rpc.auth_failure` line.
- **Port occupied** — the bridge binds an OS-assigned port. The chosen
  port is persisted to `~/.nzrcode/bridge.json` as `lastPort` so a
  restart reuses it; delete the file to force a fresh port.
- **Tailscale not detected** — confirm `which tailscale` and
  `tailscale ip -4` both succeed under the same shell that VS Code is
  launched from. Network namespaces and snap confinement can break
  PATH resolution.

## Security baseline

- Loopback-only bind (`127.0.0.1`). Bind security is checked at server
  start; binding any other interface is a constitutional violation.
- Tokens are 43-char base64url, generated via `crypto.randomBytes(32)`,
  validated in constant time via `crypto.timingSafeEqual`.
- `bridge.json` is chmod 0600 on every load.
- APNs tokens live exclusively in `vscode.SecretStorage` — never in
  `globalState`, never in logs.
- File contents are never logged: `redactContent` produces a
  `{bytes, sha256Prefix}` summary instead.
- Outbound backlog cap of 5 MiB per connection (cl-5); a slow client
  is closed with code 4002 / `client_too_slow` rather than buffered
  indefinitely.

## Development

```bash
# Inside this repo (vscode/):
npm install                 # once, repo-wide
cd extensions/nzrcode-bridge
npm test                    # mocha unit + integration suite (300+ tests)
```

The structural smoke suite lives at
[`test/nzrcode-bridge/run_all.sh`](../../test/nzrcode-bridge/run_all.sh)
and is the gate that CI consults; the cold-start benchmark
[`bench_cold_start.sh`](../../test/nzrcode-bridge/bench_cold_start.sh)
enforces the 50 ms budget on a developer-class machine.
