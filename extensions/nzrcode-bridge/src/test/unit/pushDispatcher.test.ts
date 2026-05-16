/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { PushDispatcher } from '../../push/pushDispatcher';
import { FakePushProvider } from '../../push/fakePushProvider';
import type { PushEvent } from '../../push/IPushProvider';
import { RelayUnavailableError } from '../../push/relayPushProvider';
import type { PairedDevice } from '../../pairing/pairedDevices';

function device(deviceId: string): PairedDevice {
    const t = Date.now();
    return { deviceId, deviceName: deviceId, pairedAt: t, lastSeenAt: t };
}

function event(): PushEvent {
    return { event: 'tasks.completed', payload: { executionId: 'e-1' } };
}

class FailingPushProvider extends FakePushProvider {
    constructor(private readonly _err: Error) { super(); }
    override async send(devices: readonly PairedDevice[], evt: PushEvent): Promise<void> {
        await super.send(devices, evt);
        throw this._err;
    }
}

suite('push/PushDispatcher', () => {

    test('uses the relay first on the happy path; in-band is NOT touched', async () => {
        const relay = new FakePushProvider();
        const inBand = new FakePushProvider();
        const dispatcher = new PushDispatcher({ relay, inBand });

        await dispatcher.dispatch([device('d-1')], event());

        assert.equal(relay.calls.length, 1);
        assert.equal(inBand.calls.length, 0, 'in-band must NOT run when relay succeeded');
    });

    test('falls back to in-band when the relay rejects with RelayUnavailableError', async () => {
        const relay = new FailingPushProvider(new RelayUnavailableError('HTTP 503'));
        const inBand = new FakePushProvider();
        const dispatcher = new PushDispatcher({ relay, inBand });

        await dispatcher.dispatch([device('d-1')], event());

        assert.equal(relay.calls.length, 1);
        assert.equal(inBand.calls.length, 1);
    });

    test('falls back to in-band on ANY relay error (not just RelayUnavailableError)', async () => {
        const relay = new FailingPushProvider(new Error('boom'));
        const inBand = new FakePushProvider();
        const dispatcher = new PushDispatcher({ relay, inBand });

        await dispatcher.dispatch([device('d-1')], event());

        assert.equal(inBand.calls.length, 1);
    });

    test('preserves dispatch order — relay is invoked BEFORE in-band on fallback', async () => {
        const orderLog: string[] = [];
        const relay: FailingPushProvider = new (class extends FailingPushProvider {
            override async send(d: readonly PairedDevice[], e: PushEvent): Promise<void> {
                orderLog.push('relay');
                return super.send(d, e);
            }
        })(new RelayUnavailableError('down'));

        const inBand: FakePushProvider = new (class extends FakePushProvider {
            override async send(d: readonly PairedDevice[], e: PushEvent): Promise<void> {
                orderLog.push('inBand');
                return super.send(d, e);
            }
        })();

        const dispatcher = new PushDispatcher({ relay, inBand });

        await dispatcher.dispatch([device('d-1')], event());

        assert.deepEqual(orderLog, ['relay', 'inBand']);
    });

    test('no circuit breaker — every dispatch retries the relay first (YAGNI cl-7)', async () => {
        const relay = new FailingPushProvider(new RelayUnavailableError('down'));
        const inBand = new FakePushProvider();
        const dispatcher = new PushDispatcher({ relay, inBand });

        await dispatcher.dispatch([device('d-1')], event());
        await dispatcher.dispatch([device('d-1')], event());
        await dispatcher.dispatch([device('d-1')], event());

        assert.equal(relay.calls.length, 3, 'relay hit every time, no skipping');
        assert.equal(inBand.calls.length, 3, 'in-band called every time too');
    });

    test('an in-band failure is swallowed — dispatch never throws to its caller', async () => {
        const relay = new FailingPushProvider(new RelayUnavailableError('down'));
        const inBand = new FailingPushProvider(new Error('socket gone'));
        const dispatcher = new PushDispatcher({ relay, inBand });

        // Must not throw — the caller is a one-shot canonical event handler
        // (T034) that can't realistically recover from a notification miss.
        await dispatcher.dispatch([device('d-1')], event());

        assert.equal(relay.calls.length, 1);
        assert.equal(inBand.calls.length, 1);
    });
});
