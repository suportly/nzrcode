/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { InBandPushProvider } from '../../push/inBandPushProvider';
import type { InBandPushProviderDeps } from '../../push/inBandPushProvider';
import type { PushEvent } from '../../push/IPushProvider';
import type { PairedDevice } from '../../pairing/pairedDevices';

function device(deviceId: string): PairedDevice {
    const t = Date.now();
    return { deviceId, deviceName: deviceId, pairedAt: t, lastSeenAt: t };
}

interface RecordingSocket {
    readonly sent: string[];
}

function makeDeps(connected: ReadonlyMap<string, RecordingSocket>): InBandPushProviderDeps {
    return {
        getConnectionForDevice: (deviceId) => {
            const sock = connected.get(deviceId);
            if (!sock) { return undefined; }
            return {
                send: (frame: string) => { sock.sent.push(frame); },
            };
        },
    };
}

function event(): PushEvent {
    return { event: 'tasks.completed', payload: { executionId: 'e-1' } };
}

suite('push/InBandPushProvider', () => {

    test('sends an events.notification to every connected device, skipping disconnected ones', async () => {
        const d1Sock: RecordingSocket = { sent: [] };
        const connected = new Map<string, RecordingSocket>([['d-1', d1Sock]]);
        const provider = new InBandPushProvider(makeDeps(connected));

        await provider.send([device('d-1'), device('d-2')], event());

        assert.equal(d1Sock.sent.length, 1, 'd-1 (connected) received exactly one notification');
        // d-2 has no socket, so nothing to assert — the call must not throw.
    });

    test('encodes the frame as a JSON-RPC 2.0 notification with method events.notification', async () => {
        const d1Sock: RecordingSocket = { sent: [] };
        const connected = new Map<string, RecordingSocket>([['d-1', d1Sock]]);
        const provider = new InBandPushProvider(makeDeps(connected));

        await provider.send([device('d-1')], event());

        const parsed = JSON.parse(d1Sock.sent[0]) as { jsonrpc: string; method: string; params: PushEvent };
        assert.equal(parsed.jsonrpc, '2.0');
        assert.equal(parsed.method, 'events.notification');
        assert.deepEqual(parsed.params, event());
    });

    test('treats an empty devices list as a no-op', async () => {
        const provider = new InBandPushProvider(makeDeps(new Map()));

        await provider.send([], event());

        // No throws, no side effects to assert beyond completion.
    });

    test('treats fully-disconnected devices as a no-op (no errors)', async () => {
        const provider = new InBandPushProvider(makeDeps(new Map()));

        await provider.send([device('d-1'), device('d-2')], event());

        // No exceptions = pass.
    });

    test('a single connected device gets exactly one frame even if listed twice', async () => {
        const d1Sock: RecordingSocket = { sent: [] };
        const connected = new Map<string, RecordingSocket>([['d-1', d1Sock]]);
        const provider = new InBandPushProvider(makeDeps(connected));

        await provider.send([device('d-1'), device('d-1')], event());

        assert.equal(d1Sock.sent.length, 1, 'deduplicated by deviceId');
    });
});
