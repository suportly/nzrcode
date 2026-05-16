/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    QrPayloadBuildError,
    buildQrPayloadFromEndpoints,
    renderQrWebviewHtml,
    showQrModal,
} from '../../pairing/qrModal';
import type { PairingResult, QrModalDeps } from '../../pairing/qrModal';
import { decodeQrPayload } from '../../protocol/qr';
import type { DiscoveredEndpoint } from '../../pairing/endpoints';
import { generateToken } from '../../server/auth';

const VALID_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function lan(host: string): DiscoveredEndpoint { return { host, port: 3120, net: 'lan' }; }
function tailscale(host: string): DiscoveredEndpoint { return { host, port: 3120, net: 'tailscale' }; }

suite('pairing/qrModal', () => {

    suite('buildQrPayloadFromEndpoints', () => {

        test('produces a v1 payload that round-trips through decodeQrPayload', () => {
            const token = generateToken();
            const payload = buildQrPayloadFromEndpoints(token, [lan('192.168.1.1'), tailscale('100.64.0.1')]);

            // structural assertion — never snapshot the JSON
            assert.equal(payload.v, 1);
            assert.match(payload.token, VALID_TOKEN_RE);
            assert.ok(payload.endpoints.length >= 1);

            const encoded = JSON.stringify(payload);
            const decoded = decodeQrPayload(encoded);
            assert.deepEqual(decoded, payload);
        });

        test('LAN endpoints come first (cl-4 — LAN-preferred)', () => {
            const token = generateToken();
            const payload = buildQrPayloadFromEndpoints(token, [
                tailscale('100.64.0.1'),
                lan('192.168.1.1'),
            ]);

            assert.equal(payload.endpoints[0].net, 'lan');
            assert.equal(payload.endpoints[payload.endpoints.length - 1].net, 'tailscale');
        });

        test('rejects when no endpoints are supplied (must have ≥ 1)', () => {
            assert.throws(
                () => buildQrPayloadFromEndpoints(generateToken(), []),
                QrPayloadBuildError,
            );
        });

        test('rejects a malformed token', () => {
            const tooShort = 'short';
            assert.throws(
                () => buildQrPayloadFromEndpoints(tooShort, [lan('192.168.1.1')]),
                QrPayloadBuildError,
            );
        });
    });

    suite('renderQrWebviewHtml', () => {

        test('embeds the encoded payload string inside the HTML', () => {
            const token = generateToken();
            const payload = buildQrPayloadFromEndpoints(token, [lan('192.168.1.1')]);

            const html = renderQrWebviewHtml(payload);

            const encoded = JSON.stringify(payload);
            assert.ok(html.includes(encoded), 'payload must be inlined for the webview script');
        });

        test('escapes "<" inside the inlined JSON so a malformed host cannot break out (XSS sanity)', () => {
            // Even though the endpoint host is constrained, defence-in-depth: any
            // literal "<" in the payload JSON must be escaped to "<" before
            // it lands inside the inline <script>.
            const token = generateToken();
            const payload = buildQrPayloadFromEndpoints(token, [lan('1.2.3.4')]);

            const html = renderQrWebviewHtml(payload);

            // Locate the inline script body.
            const inlineStart = html.indexOf('var payload = ');
            const inlineEnd = html.indexOf('</script>', inlineStart);
            assert.ok(inlineStart > 0 && inlineEnd > inlineStart, 'inline script body found');
            const inlineBody = html.slice(inlineStart, inlineEnd);

            // The inline body must not contain an unescaped "<" — the only ones
            // allowed live in the surrounding HTML, not in the JSON payload itself.
            const payloadLiteralStart = inlineBody.indexOf('{');
            const payloadLiteralEnd = inlineBody.lastIndexOf('}');
            const payloadLiteral = inlineBody.slice(payloadLiteralStart, payloadLiteralEnd + 1);
            assert.ok(!payloadLiteral.includes('<'), `payload literal must escape "<", saw: ${payloadLiteral}`);
        });

        test('references the qrcode-generator script tag locally (no CDN)', () => {
            const token = generateToken();
            const payload = buildQrPayloadFromEndpoints(token, [lan('1.2.3.4')]);

            const html = renderQrWebviewHtml(payload);

            assert.ok(html.includes('qrcode-generator'), 'expected reference to local qrcode-generator');
            assert.ok(!html.match(/https?:\/\/[^"'\s]*cdn/i), 'no CDN URL allowed in webview HTML');
        });
    });

    suite('showQrModal', () => {

        function makeDeps(): { deps: QrModalDeps; opened: string[]; disposed: number[] } {
            const opened: string[] = [];
            const disposed: number[] = [];
            const deps: QrModalDeps = {
                openWebview: (html) => {
                    const index = opened.length;
                    opened.push(html);
                    return {
                        dispose: () => disposed.push(index),
                    };
                },
            };
            return { deps, opened, disposed };
        }

        test('resolves with the pairing result the external signal produces', async () => {
            const { deps } = makeDeps();
            const payload = buildQrPayloadFromEndpoints(generateToken(), [lan('1.2.3.4')]);
            const expected: PairingResult = { deviceId: 'd-1', apnsToken: 'apns-1' };

            const result = await showQrModal(deps, payload, Promise.resolve(expected));

            assert.deepEqual(result, expected);
        });

        test('disposes the webview once the pairing signal resolves', async () => {
            const { deps, opened, disposed } = makeDeps();
            const payload = buildQrPayloadFromEndpoints(generateToken(), [lan('1.2.3.4')]);

            await showQrModal(deps, payload, Promise.resolve({ deviceId: 'd-1' }));

            assert.equal(opened.length, 1);
            assert.equal(disposed.length, 1);
        });

        test('disposes the webview even when the pairing signal rejects', async () => {
            const { deps, disposed } = makeDeps();
            const payload = buildQrPayloadFromEndpoints(generateToken(), [lan('1.2.3.4')]);

            await assert.rejects(
                showQrModal(deps, payload, Promise.reject(new Error('cancelled'))),
                /cancelled/,
            );
            assert.equal(disposed.length, 1);
        });
    });
});
