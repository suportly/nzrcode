/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

/**
 * Pure helpers consumed by `welcome.contribution.ts`. Kept DI-free so the
 * unit test can exercise the descriptor list + greeting without spinning
 * up a full VS Code InstantiationService.
 */

export const WELCOME_SHOWN_STORAGE_KEY = 'nzr.welcome.shown';

export type WelcomeActionId = 'startMissionControl' | 'addStation' | 'dontShowAgain';

export interface IWelcomeActionDescriptor {
	readonly id: WelcomeActionId;
	readonly label: string;
	readonly commandId?: string;
}

export function buildWelcomeMessage(): string {
	return localize(
		'nzrWelcomeMessage',
		"Welcome to NZRCode. Start Mission Control to spin up parallel AIADev pipelines.",
	);
}

export function buildWelcomeActionDescriptors(): readonly IWelcomeActionDescriptor[] {
	return [
		{
			id: 'startMissionControl',
			label: localize('nzrWelcomeStartMissionControl', 'Start Mission Control'),
			commandId: 'nzr.toggleMissionControl',
		},
		{
			id: 'addStation',
			label: localize('nzrWelcomeAddStation', 'Add Station'),
			commandId: 'nzr.station.add',
		},
		{
			id: 'dontShowAgain',
			label: localize('nzrWelcomeDontShowAgain', "Don't show again"),
		},
	];
}
