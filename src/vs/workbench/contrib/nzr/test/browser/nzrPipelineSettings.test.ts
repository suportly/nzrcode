/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import {
	DEFAULT_BRANCH,
	DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE,
	DEFAULT_PRESET,
	DEFAULT_WELCOME_SHOW_ON_STARTUP,
	getDefaultBranch,
	getDefaultPreset,
	getMissionControlAutoActivate,
	getWelcomeShowOnStartup,
	isValidPreset,
	PIPELINE_PRESETS,
	SETTING_DEFAULT_BRANCH,
	SETTING_DEFAULT_PRESET,
	SETTING_MISSION_CONTROL_AUTO_ACTIVATE,
	SETTING_WELCOME_SHOW_ON_STARTUP,
} from '../../browser/nzrPipelineSettings.js';

function fakeConfig(values: Record<string, unknown>): IConfigurationService {
	return {
		getValue<T>(key: string): T {
			return values[key] as T;
		},
	} as Partial<IConfigurationService> as IConfigurationService;
}

suite('nzrPipelineSettings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('constants', () => {
		test('exposes the 4 presets verbatim', () => {
			assert.deepStrictEqual([...PIPELINE_PRESETS], ['django-react', 'expo-mobile', 'python-cli', 'lean']);
		});

		test('exposes stable setting keys', () => {
			assert.strictEqual(SETTING_DEFAULT_PRESET, 'nzrcode.pipeline.defaultPreset');
			assert.strictEqual(SETTING_DEFAULT_BRANCH, 'nzrcode.pipeline.defaultBranch');
			assert.strictEqual(SETTING_WELCOME_SHOW_ON_STARTUP, 'nzrcode.welcome.showOnStartup');
			assert.strictEqual(SETTING_MISSION_CONTROL_AUTO_ACTIVATE, 'nzrcode.missionControl.autoActivate');
		});

		test('exposes the documented defaults', () => {
			assert.strictEqual(DEFAULT_PRESET, 'lean');
			assert.strictEqual(DEFAULT_BRANCH, 'main');
			assert.strictEqual(DEFAULT_WELCOME_SHOW_ON_STARTUP, true);
			assert.strictEqual(DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE, false);
		});
	});

	suite('isValidPreset', () => {
		test('accepts each of the 4 documented presets', () => {
			for (const p of PIPELINE_PRESETS) {
				assert.strictEqual(isValidPreset(p), true, `expected ${p} to be valid`);
			}
		});

		test('rejects an unrelated string', () => {
			assert.strictEqual(isValidPreset('rails-spa'), false);
		});

		test('rejects non-string values', () => {
			assert.strictEqual(isValidPreset(undefined), false);
			assert.strictEqual(isValidPreset(null), false);
			assert.strictEqual(isValidPreset(42), false);
			assert.strictEqual(isValidPreset({}), false);
		});
	});

	suite('getDefaultPreset', () => {
		test('returns the configured preset when it is valid', () => {
			const cs = fakeConfig({ [SETTING_DEFAULT_PRESET]: 'django-react' });
			assert.strictEqual(getDefaultPreset(cs), 'django-react');
		});

		test('falls back to DEFAULT_PRESET when undefined', () => {
			const cs = fakeConfig({});
			assert.strictEqual(getDefaultPreset(cs), DEFAULT_PRESET);
		});

		test('falls back to DEFAULT_PRESET when invalid', () => {
			const cs = fakeConfig({ [SETTING_DEFAULT_PRESET]: 'rails-spa' });
			assert.strictEqual(getDefaultPreset(cs), DEFAULT_PRESET);
		});
	});

	suite('getDefaultBranch', () => {
		test('returns the configured branch when non-empty', () => {
			const cs = fakeConfig({ [SETTING_DEFAULT_BRANCH]: 'develop' });
			assert.strictEqual(getDefaultBranch(cs), 'develop');
		});

		test('falls back to DEFAULT_BRANCH when undefined', () => {
			assert.strictEqual(getDefaultBranch(fakeConfig({})), DEFAULT_BRANCH);
		});

		test('falls back to DEFAULT_BRANCH when empty string', () => {
			const cs = fakeConfig({ [SETTING_DEFAULT_BRANCH]: '   ' });
			assert.strictEqual(getDefaultBranch(cs), DEFAULT_BRANCH);
		});
	});

	suite('getWelcomeShowOnStartup', () => {
		test('returns false when explicitly disabled', () => {
			const cs = fakeConfig({ [SETTING_WELCOME_SHOW_ON_STARTUP]: false });
			assert.strictEqual(getWelcomeShowOnStartup(cs), false);
		});

		test('returns the default when undefined', () => {
			assert.strictEqual(getWelcomeShowOnStartup(fakeConfig({})), DEFAULT_WELCOME_SHOW_ON_STARTUP);
		});
	});

	suite('getMissionControlAutoActivate', () => {
		test('returns true when explicitly enabled', () => {
			const cs = fakeConfig({ [SETTING_MISSION_CONTROL_AUTO_ACTIVATE]: true });
			assert.strictEqual(getMissionControlAutoActivate(cs), true);
		});

		test('returns the default when undefined', () => {
			assert.strictEqual(getMissionControlAutoActivate(fakeConfig({})), DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE);
		});
	});
});
