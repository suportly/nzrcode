/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { getWelcomeShowOnStartup } from './nzrPipelineSettings.js';
import { WELCOME_SHOWN_STORAGE_KEY } from './welcomeFlow.js';

/**
 * Pure predicate that combines the two dismissal mechanisms for the
 * welcome notification:
 *
 *   - the per-profile storage flag (set by any user interaction with
 *     the toast, or by the "Don't show again" action),
 *   - the `nzrcode.welcome.showOnStartup` setting (declarative opt-out).
 *
 * The auto-show path consults this helper; the manual `nzr.welcome.show`
 * command bypasses it.
 */
export function shouldAutoShowWelcome(
	storageService: IStorageService,
	configurationService: IConfigurationService,
): boolean {
	const alreadyShown = storageService.getBoolean(WELCOME_SHOWN_STORAGE_KEY, StorageScope.PROFILE, false);
	if (alreadyShown) {
		return false;
	}
	return getWelcomeShowOnStartup(configurationService);
}
