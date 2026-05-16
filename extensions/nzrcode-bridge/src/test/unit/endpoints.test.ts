/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
    TAILSCALE_TIMEOUT_MS,
    discoverEndpoints,
} from '../../pairing/endpoints';
import type { NetworkInterfacesProvider, TailscaleProvider } from '../../pairing/endpoints';

function lanProvider(addrs: ReadonlyArray<{ name: string; address: string; family: 'IPv4' | 'IPv6'; internal: boolean }>): NetworkInterfacesProvider {
    return () => {
        const grouped: Record<string, typeof addrs[number][]> = {};
        for (const a of addrs) {
            (grouped[a.name] = grouped[a.name] ?? []).push(a);
        }
        return grouped;
    };
}

function tailscale(ipOrError: string | 'ENOENT' | 'TIMEOUT'): TailscaleProvider {
    if (ipOrError === 'ENOENT') {
        return async () => undefined;
    }
    if (ipOrError === 'TIMEOUT') {
        return () => new Promise(() => { /* never resolves */ });
    }
    return async () => ipOrError;
}

suite('pairing/endpoints', () => {

    test('TAILSCALE_TIMEOUT_MS is exactly 500 ms (per spec)', () => {
        assert.equal(TAILSCALE_TIMEOUT_MS, 500);
    });

    suite('LAN discovery', () => {

        test('returns IPv4 non-loopback addresses tagged "lan"', async () => {
            const networkInterfaces = lanProvider([
                { name: 'lo', address: '127.0.0.1', family: 'IPv4', internal: true },
                { name: 'en0', address: '192.168.1.42', family: 'IPv4', internal: false },
            ]);

            const result = await discoverEndpoints({
                port: 3120,
                networkInterfaces,
                tailscaleIp: tailscale('ENOENT'),
            });

            const lan = result.filter(e => e.net === 'lan');
            assert.deepEqual(lan, [{ host: '192.168.1.42', port: 3120, net: 'lan' }]);
        });

        test('skips IPv6 and loopback (no need to QR-encode 127.0.0.1)', async () => {
            const networkInterfaces = lanProvider([
                { name: 'lo', address: '127.0.0.1', family: 'IPv4', internal: true },
                { name: 'lo', address: '::1', family: 'IPv6', internal: true },
                { name: 'en0', address: 'fe80::1', family: 'IPv6', internal: false },
            ]);

            const result = await discoverEndpoints({
                port: 3120,
                networkInterfaces,
                tailscaleIp: tailscale('ENOENT'),
            });

            assert.equal(result.length, 0, 'no addresses survive after filtering');
        });

        test('preserves multiple LAN interfaces (Wi-Fi + ethernet)', async () => {
            const networkInterfaces = lanProvider([
                { name: 'en0', address: '192.168.1.10', family: 'IPv4', internal: false },
                { name: 'en1', address: '10.0.0.5', family: 'IPv4', internal: false },
            ]);

            const result = await discoverEndpoints({
                port: 3120,
                networkInterfaces,
                tailscaleIp: tailscale('ENOENT'),
            });

            const lan = result.filter(e => e.net === 'lan');
            assert.equal(lan.length, 2);
        });
    });

    suite('Tailscale discovery', () => {

        test('adds a Tailscale endpoint when the IP provider returns a value', async () => {
            const networkInterfaces = lanProvider([
                { name: 'en0', address: '192.168.1.42', family: 'IPv4', internal: false },
            ]);

            const result = await discoverEndpoints({
                port: 3120,
                networkInterfaces,
                tailscaleIp: tailscale('100.64.0.7'),
            });

            const ts = result.find(e => e.net === 'tailscale');
            assert.deepEqual(ts, { host: '100.64.0.7', port: 3120, net: 'tailscale' });
        });

        test('orders LAN endpoints before Tailscale (LAN-first preference per cl-4)', async () => {
            const networkInterfaces = lanProvider([
                { name: 'en0', address: '192.168.1.42', family: 'IPv4', internal: false },
            ]);

            const result = await discoverEndpoints({
                port: 3120,
                networkInterfaces,
                tailscaleIp: tailscale('100.64.0.7'),
            });

            assert.equal(result[0].net, 'lan');
            assert.equal(result[result.length - 1].net, 'tailscale');
        });

        test('falls back silently to LAN-only when tailscale binary is missing (ENOENT)', async () => {
            const networkInterfaces = lanProvider([
                { name: 'en0', address: '192.168.1.42', family: 'IPv4', internal: false },
            ]);

            const result = await discoverEndpoints({
                port: 3120,
                networkInterfaces,
                tailscaleIp: tailscale('ENOENT'),
            });

            assert.equal(result.length, 1);
            assert.equal(result[0].net, 'lan');
        });

        test('times out and falls back to LAN-only when the provider hangs', async () => {
            const networkInterfaces = lanProvider([
                { name: 'en0', address: '192.168.1.42', family: 'IPv4', internal: false },
            ]);

            const before = Date.now();
            const result = await discoverEndpoints({
                port: 3120,
                networkInterfaces,
                tailscaleIp: tailscale('TIMEOUT'),
                timeoutMs: 60,
            });
            const elapsed = Date.now() - before;

            assert.ok(elapsed < 500, `expected timeout to kick in fast, took ${elapsed}ms`);
            assert.equal(result.length, 1);
            assert.equal(result[0].net, 'lan');
        });
    });
});
