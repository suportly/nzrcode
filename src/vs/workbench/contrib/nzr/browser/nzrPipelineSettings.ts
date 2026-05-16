/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

/**
 * Pure helpers for the `nzrcode.*` settings registered by
 * `settings.contribution.ts`. The contribution and the readers share
 * these constants so the JSON schema and the typed accessors can never
 * drift.
 *
 * NOTE on preset duplication: the canonical preset list also lives in
 * `stationPaletteFlow.ts` (feature 0010). We redefine the four strings
 * here so this feature stays independent of unmerged work — see
 * `decision-0012-1.md` for the dedup follow-up.
 */

export const PIPELINE_PRESETS = ['django-react', 'expo-mobile', 'python-cli', 'lean'] as const;
export type Preset = typeof PIPELINE_PRESETS[number];

export const SETTING_DEFAULT_PRESET = 'nzrcode.pipeline.defaultPreset';
export const SETTING_DEFAULT_BRANCH = 'nzrcode.pipeline.defaultBranch';
export const SETTING_WELCOME_SHOW_ON_STARTUP = 'nzrcode.welcome.showOnStartup';
export const SETTING_MISSION_CONTROL_AUTO_ACTIVATE = 'nzrcode.missionControl.autoActivate';

export const DEFAULT_PRESET: Preset = 'lean';
export const DEFAULT_BRANCH = 'main';
export const DEFAULT_WELCOME_SHOW_ON_STARTUP = true;
export const DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE = false;

export function isValidPreset(value: unknown): value is Preset {
	return typeof value === 'string' && (PIPELINE_PRESETS as readonly string[]).includes(value);
}

export function getDefaultPreset(configurationService: IConfigurationService): Preset {
	const value = configurationService.getValue<unknown>(SETTING_DEFAULT_PRESET);
	return isValidPreset(value) ? value : DEFAULT_PRESET;
}

export function getDefaultBranch(configurationService: IConfigurationService): string {
	const value = configurationService.getValue<unknown>(SETTING_DEFAULT_BRANCH);
	if (typeof value !== 'string' || value.trim().length === 0) {
		return DEFAULT_BRANCH;
	}
	return value;
}

export function getWelcomeShowOnStartup(configurationService: IConfigurationService): boolean {
	const value = configurationService.getValue<unknown>(SETTING_WELCOME_SHOW_ON_STARTUP);
	return typeof value === 'boolean' ? value : DEFAULT_WELCOME_SHOW_ON_STARTUP;
}

export function getMissionControlAutoActivate(configurationService: IConfigurationService): boolean {
	const value = configurationService.getValue<unknown>(SETTING_MISSION_CONTROL_AUTO_ACTIVATE);
	return typeof value === 'boolean' ? value : DEFAULT_MISSION_CONTROL_AUTO_ACTIVATE;
}
