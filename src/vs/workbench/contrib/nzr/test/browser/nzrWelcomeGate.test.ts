/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { SETTING_WELCOME_SHOW_ON_STARTUP } from '../../browser/nzrPipelineSettings.js';
import { shouldAutoShowWelcome } from '../../browser/nzrWelcomeGate.js';
import { WELCOME_SHOWN_STORAGE_KEY } from '../../browser/welcomeFlow.js';

function fakeConfig(setting: boolean | undefined): IConfigurationService {
	return {
		getValue<T>(key: string): T {
			return (key === SETTING_WELCOME_SHOW_ON_STARTUP ? setting : undefined) as T;
		},
	} as Partial<IConfigurationService> as IConfigurationService;
}

function fakeStorage(flag: boolean): IStorageService {
	return {
		getBoolean(key: string, _scope: unknown, fallback: boolean): boolean {
			if (key === WELCOME_SHOWN_STORAGE_KEY) {
				return flag;
			}
			return fallback;
		},
	} as Partial<IStorageService> as IStorageService;
}

suite('nzrWelcomeGate', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('shows when flag is unset and setting is true', () => {
		assert.strictEqual(shouldAutoShowWelcome(fakeStorage(false), fakeConfig(true)), true);
	});

	test('hides when storage flag is set, even if setting is true', () => {
		assert.strictEqual(shouldAutoShowWelcome(fakeStorage(true), fakeConfig(true)), false);
	});

	test('hides when setting is false, even if storage flag is unset', () => {
		assert.strictEqual(shouldAutoShowWelcome(fakeStorage(false), fakeConfig(false)), false);
	});

	test('hides when both are dismissive', () => {
		assert.strictEqual(shouldAutoShowWelcome(fakeStorage(true), fakeConfig(false)), false);
	});

	test('treats undefined setting as the documented true default', () => {
		assert.strictEqual(shouldAutoShowWelcome(fakeStorage(false), fakeConfig(undefined)), true);
	});
});
