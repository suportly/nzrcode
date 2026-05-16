/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { getDefaultBranch, getDefaultPreset, Preset } from './nzrPipelineSettings.js';

/**
 * Bundles the two settings the Add Station palette flow needs into a
 * single readonly object. Lets `AddStationAction.run` collapse the
 * settings-fetch step to one line.
 */
export interface IAddStationDefaults {
	readonly preset: Preset;
	readonly branch: string;
}

export function resolveAddStationDefaults(configurationService: IConfigurationService): IAddStationDefaults {
	return {
		preset: getDefaultPreset(configurationService),
		branch: getDefaultBranch(configurationService),
	};
}
