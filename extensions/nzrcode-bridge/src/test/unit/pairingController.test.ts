/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { PairingController } from '../../pairing/pairingController';
import { MethodName } from '../../protocol/methods';
import type { MethodParams, MethodResult } from '../../protocol/methods';

suite('PairingController', () => {

	test('pairingSignal resolves with the params of the first system.register call', async () => {
		const ctrl = new PairingController();
		const handler = ctrl.createHandler();

		const params: MethodParams[MethodName.SystemRegister] = {
			deviceId: 'd-alpha',
			deviceName: 'Alair iPad',
			apnsToken: 'apns-abc',
		};

		const result = await handler(params);
		assert.deepEqual(result, { registered: true });

		const signal = await ctrl.pairingSignal;
		assert.equal(signal.deviceId, 'd-alpha');
		assert.equal(signal.deviceName, 'Alair iPad');
		assert.equal(signal.apnsToken, 'apns-abc');
	});

	test('second system.register call returns registered:true but does NOT re-resolve the signal', async () => {
		const ctrl = new PairingController();
		const handler = ctrl.createHandler();

		const firstResult = await handler({
			deviceId: 'd-1',
			deviceName: 'first iPad',
			apnsToken: 'apns-1',
		});
		assert.deepEqual(firstResult, { registered: true });

		const firstSignal = await ctrl.pairingSignal;
		assert.equal(firstSignal.deviceId, 'd-1');

		const secondResult = await handler({
			deviceId: 'd-2',
			deviceName: 'second iPad',
			apnsToken: 'apns-2',
		});
		assert.deepEqual(secondResult, { registered: true });

		// The pairing signal must still carry the first device's identity.
		const stillFirst = await ctrl.pairingSignal;
		assert.equal(stillFirst.deviceId, 'd-1');
		assert.equal(stillFirst.deviceName, 'first iPad');
	});

	test('apnsToken is optional in the resolved signal', async () => {
		const ctrl = new PairingController();
		const handler = ctrl.createHandler();

		await handler({ deviceId: 'd-1', deviceName: 'no-apns iPad' });

		const signal = await ctrl.pairingSignal;
		assert.equal(signal.deviceId, 'd-1');
		assert.equal(signal.deviceName, 'no-apns iPad');
		assert.equal(signal.apnsToken, undefined);
	});

	test('result conforms to MethodResult[SystemRegister]', async () => {
		const ctrl = new PairingController();
		const handler = ctrl.createHandler();

		const result = await handler({ deviceId: 'd-1', deviceName: 'iPad' });
		const typed: MethodResult[MethodName.SystemRegister] = result;
		assert.equal(typed.registered, true);
	});

	test('onPair is invoked with the deviceId BEFORE the pairing signal resolves', async () => {
		const order: string[] = [];
		const onPair = async (deviceId: string) => {
			order.push(`onPair:${deviceId}`);
		};
		const ctrl = new PairingController({ onPair });
		void ctrl.pairingSignal.then(() => order.push('signal-resolved'));

		const handler = ctrl.createHandler();
		await handler({ deviceId: 'd-alpha', deviceName: 'iPad' });
		// Allow the resolved-then callback to run.
		await new Promise<void>(r => setImmediate(r));

		assert.deepEqual(order, ['onPair:d-alpha', 'signal-resolved']);
	});

	test('onPair is invoked only on the first register call', async () => {
		const calls: string[] = [];
		const ctrl = new PairingController({ onPair: (id) => { calls.push(id); } });
		const handler = ctrl.createHandler();

		await handler({ deviceId: 'd-1', deviceName: 'first' });
		await handler({ deviceId: 'd-2', deviceName: 'second' });

		assert.deepEqual(calls, ['d-1']);
	});

	test('a throwing onPair prevents the signal from resolving', async () => {
		const failure = new Error('disk full');
		const ctrl = new PairingController({ onPair: () => { throw failure; } });
		const handler = ctrl.createHandler();

		await assert.rejects(Promise.resolve(handler({ deviceId: 'd-1', deviceName: 'iPad' })), /disk full/);

		// The signal must still be pending.
		const settled = await Promise.race([
			ctrl.pairingSignal.then(() => 'resolved'),
			new Promise<string>(r => setTimeout(() => r('pending'), 20)),
		]);
		assert.equal(settled, 'pending');
	});

	test('no onPair dep is a backwards-compatible default', async () => {
		const ctrl = new PairingController();
		const handler = ctrl.createHandler();
		const result = await handler({ deviceId: 'd-1', deviceName: 'iPad' });
		assert.deepEqual(result, { registered: true });
		const signal = await ctrl.pairingSignal;
		assert.equal(signal.deviceId, 'd-1');
	});
});
