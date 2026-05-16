/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { runPairCommand } from '../../pairing/pairCommand';
import type { PairCommandDeps, PairedDeviceLike } from '../../pairing/pairCommand';
import type { DiscoveredEndpoint } from '../../pairing/endpoints';
import { generateToken } from '../../server/auth';

interface RecordedCalls {
    loadCount: number;
    discoverCount: number;
    discoverPort: number | undefined;
    openedHtml: string | undefined;
    disposedWebview: number;
    registered: PairedDeviceLike[];
    attached: Array<{ deviceId: string; apnsToken: string }>;
    notifications: string[];
}

function makeDeps(opts: {
    token?: string;
    endpoints?: readonly DiscoveredEndpoint[];
    pairingResult: Promise<{ deviceId: string; deviceName?: string; apnsToken?: string }>;
    bridgePort?: number;
}): { deps: PairCommandDeps; calls: RecordedCalls } {
    const token = opts.token ?? generateToken();
    const calls: RecordedCalls = {
        loadCount: 0,
        discoverCount: 0,
        discoverPort: undefined,
        openedHtml: undefined,
        disposedWebview: 0,
        registered: [],
        attached: [],
        notifications: [],
    };
    const port = opts.bridgePort ?? 53120;

    const deps: PairCommandDeps = {
        loadOrCreateState: () => { calls.loadCount += 1; return { tokens: {}, version: 2 }; },
        startBridge: async () => ({
            port,
            token,
            pairingSignal: opts.pairingResult,
            dispose: async () => { /* no-op for test */ },
        }),
        discoverEndpoints: async (forPort) => {
            calls.discoverCount += 1;
            calls.discoverPort = forPort;
            return opts.endpoints ?? [{ host: '192.168.1.1', port: forPort, net: 'lan' }];
        },
        openWebview: (html) => {
            calls.openedHtml = html;
            return { dispose: () => { calls.disposedWebview += 1; } };
        },
        registerDevice: async ({ deviceId, deviceName }) => {
            const device: PairedDeviceLike = { deviceId, deviceName, pairedAt: Date.now(), lastSeenAt: Date.now() };
            calls.registered.push(device);
            return device;
        },
        attachApnsToken: async (deviceId, apnsToken) => {
            calls.attached.push({ deviceId, apnsToken });
        },
        showInformationMessage: (msg) => { calls.notifications.push(msg); },
    };

    return { deps, calls };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite('pairing/pairCommand', () => {

    test('happy path: state → bridge → endpoints → QR → register → notify', async () => {
        const result = { deviceId: 'd-1', deviceName: 'Alair iPad' };
        const { deps, calls } = makeDeps({ pairingResult: Promise.resolve(result) });

        const device = await runPairCommand(deps);

        assert.equal(calls.loadCount, 1, 'state loaded once');
        assert.equal(calls.discoverCount, 1, 'endpoints discovered once');
        assert.equal(calls.discoverPort, 53120, 'discover called with bridge port');
        assert.ok(calls.openedHtml && calls.openedHtml.includes('Pair iPad'), 'webview opened with payload');
        assert.equal(calls.disposedWebview, 1, 'webview disposed after pairing');
        assert.deepEqual(calls.registered[0].deviceId, 'd-1');
        assert.deepEqual(calls.registered[0].deviceName, 'Alair iPad');
        assert.equal(calls.notifications.length, 1);
        assert.ok(calls.notifications[0].includes('Alair iPad'));
        assert.equal(device.deviceId, 'd-1');
    });

    test('defaults deviceName to "iPad" when the client did not supply one', async () => {
        const { deps, calls } = makeDeps({
            pairingResult: Promise.resolve({ deviceId: 'd-1' }),
        });

        await runPairCommand(deps);

        assert.equal(calls.registered[0].deviceName, 'iPad');
    });

    test('attaches the apnsToken only when the client provides one', async () => {
        const withToken = makeDeps({ pairingResult: Promise.resolve({ deviceId: 'd-1', apnsToken: 'apns-abc' }) });
        await runPairCommand(withToken.deps);
        assert.deepEqual(withToken.calls.attached, [{ deviceId: 'd-1', apnsToken: 'apns-abc' }]);

        const withoutToken = makeDeps({ pairingResult: Promise.resolve({ deviceId: 'd-2' }) });
        await runPairCommand(withoutToken.deps);
        assert.deepEqual(withoutToken.calls.attached, []);
    });

    test('disposes the webview even when pairing rejects (e.g. user closed modal)', async () => {
        const { deps, calls } = makeDeps({
            pairingResult: Promise.reject(new Error('user cancelled')),
        });

        await assert.rejects(runPairCommand(deps), /user cancelled/);

        assert.equal(calls.disposedWebview, 1, 'webview disposed on error');
        assert.equal(calls.registered.length, 0, 'no device registered on error');
        assert.equal(calls.notifications.length, 0, 'no notification on error');
    });

    test('builds the QR payload from the discovered endpoints', async () => {
        const { deps, calls } = makeDeps({
            pairingResult: Promise.resolve({ deviceId: 'd-1' }),
            endpoints: [
                { host: '192.168.1.42', port: 53120, net: 'lan' },
                { host: '100.64.0.7', port: 53120, net: 'tailscale' },
            ],
        });

        await runPairCommand(deps);

        // The HTML embeds the encoded JSON; assert both endpoints made it in.
        assert.ok(calls.openedHtml!.includes('192.168.1.42'), 'LAN endpoint in payload');
        assert.ok(calls.openedHtml!.includes('100.64.0.7'), 'Tailscale endpoint in payload');
    });
});
