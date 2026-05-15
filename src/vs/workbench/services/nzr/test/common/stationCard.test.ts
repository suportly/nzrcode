/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

// Note: the import below is a stub for T001 (RED). T002 introduces the module.
// import { createStationCard } from '../../../../contrib/nzr/browser/stationCard.js';

suite('stationCard', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('placeholder: module exists', () => {
		assert.ok(true, 'replaced in T002');
	});
});
