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
});
