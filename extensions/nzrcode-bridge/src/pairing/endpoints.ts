/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Endpoint discovery for the pairing QR payload.
// LAN endpoints are always cheap (read from os.networkInterfaces()).
// Tailscale endpoints require shelling out — we always call execFile (never
// exec), accept ENOENT silently, and cap the wait at 500 ms so a stuck
// `tailscale` binary cannot stall the Pair iPad command.
//
// Both providers are injected so tests never touch the real OS / network.

import * as os from 'os';
import { execFile } from 'child_process';

/** Maximum wait for the Tailscale provider before falling back to LAN-only. */
export const TAILSCALE_TIMEOUT_MS = 500;

export interface DiscoveredEndpoint {
    readonly host: string;
    readonly port: number;
    readonly net: 'lan' | 'tailscale' | 'mdns';
}

export type NetworkInterfacesProvider = () => NodeJS.Dict<readonly {
    readonly address: string;
    readonly family: 'IPv4' | 'IPv6';
    readonly internal: boolean;
}[]>;

/** Returns the Tailscale IPv4, or `undefined` when unavailable/ENOENT. */
export type TailscaleProvider = () => Promise<string | undefined>;

export interface DiscoverEndpointsOptions {
    readonly port: number;
    readonly networkInterfaces?: NetworkInterfacesProvider;
    readonly tailscaleIp?: TailscaleProvider;
    readonly timeoutMs?: number;
}

function defaultNetworkInterfaces(): NetworkInterfacesProvider {
    return () => os.networkInterfaces() as ReturnType<NetworkInterfacesProvider>;
}

function defaultTailscaleProvider(): TailscaleProvider {
    return () => new Promise(resolve => {
        execFile('tailscale', ['ip', '-4'], { timeout: TAILSCALE_TIMEOUT_MS }, (err, stdout) => {
            if (err) {
                resolve(undefined);
                return;
            }
            const ip = stdout.trim().split('\n')[0]?.trim();
            resolve(ip && ip.length > 0 ? ip : undefined);
        });
    });
}

function lanEndpoints(provider: NetworkInterfacesProvider, port: number): DiscoveredEndpoint[] {
    const ifaces = provider();
    const out: DiscoveredEndpoint[] = [];
    for (const addrs of Object.values(ifaces)) {
        if (!addrs) { continue; }
        for (const a of addrs) {
            if (a.family !== 'IPv4') { continue; }
            if (a.internal) { continue; }
            out.push({ host: a.address, port, net: 'lan' });
        }
    }
    return out;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    return new Promise(resolve => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) { return; }
            settled = true;
            resolve(fallback);
        }, timeoutMs);
        promise.then(value => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            resolve(value);
        }, () => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            resolve(fallback);
        });
    });
}

export async function discoverEndpoints(opts: DiscoverEndpointsOptions): Promise<DiscoveredEndpoint[]> {
    const ifaces = opts.networkInterfaces ?? defaultNetworkInterfaces();
    const tailscaleIp = opts.tailscaleIp ?? defaultTailscaleProvider();
    const timeout = opts.timeoutMs ?? TAILSCALE_TIMEOUT_MS;

    const lan = lanEndpoints(ifaces, opts.port);
    const tsIp = await withTimeout(tailscaleIp(), timeout, undefined);

    if (tsIp) {
        return [...lan, { host: tsIp, port: opts.port, net: 'tailscale' }];
    }
    return lan;
}
