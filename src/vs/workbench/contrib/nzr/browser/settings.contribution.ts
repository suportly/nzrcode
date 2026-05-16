/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	DEFAULT_BRANCH,
	DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE,
	DEFAULT_PRESET,
	DEFAULT_WELCOME_SHOW_ON_STARTUP,
	PIPELINE_PRESETS,
	SETTING_DEFAULT_BRANCH,
	SETTING_DEFAULT_PRESET,
	SETTING_MISSION_CONTROL_AUTO_ACTIVATE,
	SETTING_WELCOME_SHOW_ON_STARTUP,
} from './nzrPipelineSettings.js';

const NZR_CONFIGURATION_ORDER = 200;

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'nzrcode',
	order: NZR_CONFIGURATION_ORDER,
	title: localize('nzrcodeConfigurationTitle', 'NZRCode'),
	type: 'object',
	properties: {
		[SETTING_DEFAULT_PRESET]: {
			type: 'string',
			enum: [...PIPELINE_PRESETS],
			enumDescriptions: [
				localize('nzrcodePresetDjangoReactDescription', 'Django backend with a React frontend.'),
				localize('nzrcodePresetExpoMobileDescription', 'Expo React-Native mobile app.'),
				localize('nzrcodePresetPythonCliDescription', 'Python command-line tool.'),
				localize('nzrcodePresetLeanDescription', 'Stack-agnostic preset (default).'),
			],
			default: DEFAULT_PRESET,
			scope: ConfigurationScope.APPLICATION,
			description: localize('nzrcodeDefaultPresetDescription', 'Default preset used by the NZR: Add Station command.'),
		},
		[SETTING_DEFAULT_BRANCH]: {
			type: 'string',
			default: DEFAULT_BRANCH,
			scope: ConfigurationScope.APPLICATION,
			description: localize('nzrcodeDefaultBranchDescription', 'Default branch suggested by the NZR: Add Station command.'),
		},
		[SETTING_WELCOME_SHOW_ON_STARTUP]: {
			type: 'boolean',
			default: DEFAULT_WELCOME_SHOW_ON_STARTUP,
			scope: ConfigurationScope.APPLICATION,
			description: localize('nzrcodeWelcomeShowOnStartupDescription', 'Show the NZRCode welcome notification on first run after this setting is enabled.'),
		},
		[SETTING_MISSION_CONTROL_AUTO_ACTIVATE]: {
			type: 'boolean',
			default: DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE,
			scope: ConfigurationScope.APPLICATION,
			description: localize('nzrcodeMissionControlAutoActivateDescription', 'Automatically activate Mission Control when a workspace opens. Reserved for a future feature.'),
		},
	},
});
