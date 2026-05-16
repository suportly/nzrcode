/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldAutoActivateMissionControl } from '../../browser/missionControlAutoActivate.js';

suite('missionControlAutoActivate', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('activates when the setting is true and MC is inactive', () => {
		assert.strictEqual(shouldAutoActivateMissionControl({ setting: true, isActive: false }), true);
	});

	test('does NOT activate when MC is already active (even if setting is true)', () => {
		assert.strictEqual(shouldAutoActivateMissionControl({ setting: true, isActive: true }), false);
	});

	test('does NOT activate when the setting is false (even if MC is inactive)', () => {
		assert.strictEqual(shouldAutoActivateMissionControl({ setting: false, isActive: false }), false);
	});

	test('does NOT activate when both are false-ish', () => {
		assert.strictEqual(shouldAutoActivateMissionControl({ setting: false, isActive: true }), false);
	});
});
