/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { FakePushProvider } from '../../push/fakePushProvider';
import type { PushEvent } from '../../push/IPushProvider';
import type { PairedDevice } from '../../pairing/pairedDevices';

function device(deviceId: string): PairedDevice {
    const t = Date.now();
    return { deviceId, deviceName: deviceId, pairedAt: t, lastSeenAt: t };
}

function makeEvent(): PushEvent {
    return { event: 'tasks.completed', payload: { executionId: 'e-1' } };
}

suite('push/FakePushProvider', () => {

    test('records every send() call in temporal order with timestamps', async () => {
        const provider = new FakePushProvider();
        const d1 = device('d-1');
        const d2 = device('d-2');
        const ev = makeEvent();

        await provider.send([d1], ev);
        await provider.send([d1, d2], ev);
        await provider.send([d2], ev);

        assert.equal(provider.calls.length, 3);
        assert.deepEqual(provider.calls[0].devices.map(d => d.deviceId), ['d-1']);
        assert.deepEqual(provider.calls[1].devices.map(d => d.deviceId), ['d-1', 'd-2']);
        assert.deepEqual(provider.calls[2].devices.map(d => d.deviceId), ['d-2']);
        // Timestamps are non-decreasing.
        assert.ok(provider.calls[0].ts <= provider.calls[1].ts);
        assert.ok(provider.calls[1].ts <= provider.calls[2].ts);
    });

    test('reset() drops every recorded call', async () => {
        const provider = new FakePushProvider();
        await provider.send([device('d-1')], makeEvent());
        await provider.send([device('d-2')], makeEvent());
        assert.equal(provider.calls.length, 2);

        provider.reset();

        assert.equal(provider.calls.length, 0);
    });

    test('captures the event payload as-passed (no mutation)', async () => {
        const provider = new FakePushProvider();
        const ev: PushEvent = { event: 'debug.stopped', payload: { reason: 'breakpoint' } };

        await provider.send([device('d-1')], ev);

        assert.deepEqual(provider.calls[0].event, ev);
    });

    test('records an empty devices list without throwing', async () => {
        const provider = new FakePushProvider();

        await provider.send([], makeEvent());

        assert.equal(provider.calls.length, 1);
        assert.deepEqual(provider.calls[0].devices, []);
    });
});
