/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { resolveAddStationDefaults } from '../../browser/nzrPaletteDefaults.js';
import {
	DEFAULT_BRANCH,
	DEFAULT_PRESET,
	SETTING_DEFAULT_BRANCH,
	SETTING_DEFAULT_PRESET,
} from '../../browser/nzrPipelineSettings.js';

function fakeConfig(values: Record<string, unknown>): IConfigurationService {
	return {
		getValue<T>(key: string): T {
			return values[key] as T;
		},
	} as Partial<IConfigurationService> as IConfigurationService;
}

suite('nzrPaletteDefaults', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('returns documented defaults when nothing is set', () => {
		const defaults = resolveAddStationDefaults(fakeConfig({}));
		assert.strictEqual(defaults.preset, DEFAULT_PRESET);
		assert.strictEqual(defaults.branch, DEFAULT_BRANCH);
	});

	test('returns the configured preset when valid', () => {
		const defaults = resolveAddStationDefaults(fakeConfig({
			[SETTING_DEFAULT_PRESET]: 'django-react',
		}));
		assert.strictEqual(defaults.preset, 'django-react');
	});

	test('falls back to DEFAULT_PRESET when the configured value is invalid', () => {
		const defaults = resolveAddStationDefaults(fakeConfig({
			[SETTING_DEFAULT_PRESET]: 'rails-spa',
		}));
		assert.strictEqual(defaults.preset, DEFAULT_PRESET);
	});

	test('returns the configured branch when set to a non-empty string', () => {
		const defaults = resolveAddStationDefaults(fakeConfig({
			[SETTING_DEFAULT_BRANCH]: 'develop',
		}));
		assert.strictEqual(defaults.branch, 'develop');
	});

	test('falls back to DEFAULT_BRANCH when the configured branch is empty', () => {
		const defaults = resolveAddStationDefaults(fakeConfig({
			[SETTING_DEFAULT_BRANCH]: '   ',
		}));
		assert.strictEqual(defaults.branch, DEFAULT_BRANCH);
	});
});
