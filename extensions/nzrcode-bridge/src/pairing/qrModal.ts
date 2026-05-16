/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// QR modal helpers for the Pair iPad command (T028).
// The split: this module assembles the payload + the HTML, and orchestrates
// the webview lifecycle. The actual QR drawing happens inside the webview
// via `qrcode-generator` (MIT, bundled locally — never CDN).
//
// XSS hardening: the payload JSON is escaped before inlining and the webview
// script renders the QR via a data-URI assigned to <img>.src — never via
// element.innerHTML — so a malformed endpoint string can't break out into HTML.

import type { QrEndpoint, QrPayloadV1 } from '../protocol/qr';
import type { DiscoveredEndpoint } from './endpoints';

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export class QrPayloadBuildError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QrPayloadBuildError';
    }
}

export interface PairingResult {
    readonly deviceId: string;
    readonly apnsToken?: string;
}

export interface QrWebviewHandle {
    dispose(): void;
}

export interface QrModalDeps {
    readonly openWebview: (html: string) => QrWebviewHandle;
}

const NET_ORDER: Record<DiscoveredEndpoint['net'], number> = {
    lan: 0,
    mdns: 1,
    tailscale: 2,
};

function toQrEndpoint(d: DiscoveredEndpoint): QrEndpoint {
    return { host: d.host, port: d.port, net: d.net };
}

export function buildQrPayloadFromEndpoints(
    token: string,
    endpoints: readonly DiscoveredEndpoint[],
): QrPayloadV1 {
    if (!TOKEN_RE.test(token)) {
        throw new QrPayloadBuildError(`token must match ${TOKEN_RE} (got length ${token.length})`);
    }
    if (endpoints.length === 0) {
        throw new QrPayloadBuildError('at least one endpoint is required');
    }
    const ordered = [...endpoints]
        .sort((a, b) => NET_ORDER[a.net] - NET_ORDER[b.net])
        .map(toQrEndpoint);

    return { v: 1, token, endpoints: ordered };
}

function escapeForScript(json: string): string {
    return json.replace(/</g, '\\u003c');
}

export function renderQrWebviewHtml(payload: QrPayloadV1): string {
    const json = JSON.stringify(payload);
    const safe = escapeForScript(json);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>Pair iPad</title>
<style>
    body { font-family: -apple-system, sans-serif; padding: 24px; text-align: center; }
    img#qr-image { image-rendering: pixelated; max-width: 320px; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h2>Scan with the NZRCode mobile app</h2>
<img id="qr-image" alt="Pairing QR code">
<p>Or paste this token: <code id="token"></code></p>
<script src="qrcode-generator.js"></script>
<script>
    var payload = ${safe};
    var text = JSON.stringify(payload);
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    document.getElementById('qr-image').src = qr.createDataURL(6, 8);
    document.getElementById('token').textContent = payload.token;
</script>
</body>
</html>
`;
}

export async function showQrModal(
    deps: QrModalDeps,
    payload: QrPayloadV1,
    pairedSignal: Promise<PairingResult>,
): Promise<PairingResult> {
    const webview = deps.openWebview(renderQrWebviewHtml(payload));
    try {
        return await pairedSignal;
    } finally {
        webview.dispose();
    }
}
