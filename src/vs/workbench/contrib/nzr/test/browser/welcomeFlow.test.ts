/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	buildWelcomeActionDescriptors,
	buildWelcomeMessage,
	IWelcomeActionDescriptor,
	WELCOME_SHOWN_STORAGE_KEY,
	WelcomeActionId,
} from '../../browser/welcomeFlow.js';

suite('welcomeFlow', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('WELCOME_SHOWN_STORAGE_KEY uses the spec literal', () => {
		assert.strictEqual(WELCOME_SHOWN_STORAGE_KEY, 'nzr.welcome.shown');
	});

	suite('buildWelcomeMessage', () => {
		test('returns a non-empty localized message', () => {
			const msg = buildWelcomeMessage();
			assert.ok(typeof msg === 'string');
			assert.ok(msg.length > 0);
		});

		test('mentions the NZRCode brand', () => {
			const msg = buildWelcomeMessage();
			assert.ok(msg.includes('NZRCode'), `expected NZRCode in welcome message, got "${msg}"`);
		});
	});

	suite('buildWelcomeActionDescriptors', () => {
		test('returns exactly 3 descriptors', () => {
			assert.strictEqual(buildWelcomeActionDescriptors().length, 3);
		});

		test('descriptor ids are stable and exhaustive', () => {
			const ids = buildWelcomeActionDescriptors().map(d => d.id);
			const expected: WelcomeActionId[] = ['startMissionControl', 'addStation', 'dontShowAgain'];
			assert.deepStrictEqual([...ids], expected);
		});

		test("startMissionControl wires to nzr.toggleMissionControl", () => {
			const d = find(buildWelcomeActionDescriptors(), 'startMissionControl');
			assert.strictEqual(d.commandId, 'nzr.toggleMissionControl');
			assert.ok(d.label.length > 0);
		});

		test("addStation wires to nzr.station.add", () => {
			const d = find(buildWelcomeActionDescriptors(), 'addStation');
			assert.strictEqual(d.commandId, 'nzr.station.add');
			assert.ok(d.label.length > 0);
		});

		test('dontShowAgain has no commandId', () => {
			const d = find(buildWelcomeActionDescriptors(), 'dontShowAgain');
			assert.strictEqual(d.commandId, undefined);
			assert.ok(d.label.length > 0);
		});
	});
});

function find(items: readonly IWelcomeActionDescriptor[], id: WelcomeActionId): IWelcomeActionDescriptor {
	const found = items.find(item => item.id === id);
	assert.ok(found, `descriptor ${id} not found`);
	return found!;
}
