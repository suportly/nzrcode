/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// InBandPushProvider — pushes events through the live WebSocket connection
// (cl-7 fallback). When the relay is down or returns RelayUnavailableError,
// the dispatcher falls back to this provider so currently-connected clients
// still get notifications without involving the centralised relay.
//
// Disconnected devices are silently ignored: the provider has no way to
// reach them without an out-of-band channel (that's what the relay is for).

import type { IPushProvider, PushEvent } from './IPushProvider';
import type { PairedDevice } from '../pairing/pairedDevices';

export interface DeviceConnection {
    send(frame: string): void;
}

export interface InBandPushProviderDeps {
    readonly getConnectionForDevice: (deviceId: string) => DeviceConnection | undefined;
}

const EVENT_NOTIFICATION_METHOD = 'events.notification';

export class InBandPushProvider implements IPushProvider {

    constructor(private readonly _deps: InBandPushProviderDeps) {}

    async send(devices: readonly PairedDevice[], event: PushEvent): Promise<void> {
        const frame = JSON.stringify({
            jsonrpc: '2.0',
            method: EVENT_NOTIFICATION_METHOD,
            params: event,
        });

        const delivered = new Set<string>();
        for (const device of devices) {
            if (delivered.has(device.deviceId)) { continue; }
            const conn = this._deps.getConnectionForDevice(device.deviceId);
            if (!conn) { continue; }
            try {
                conn.send(frame);
            } catch {
                // A dead socket is a no-op: the relay (T031) is the durable
                // channel; in-band is opportunistic.
            }
            delivered.add(device.deviceId);
        }
    }
}
