/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContribution, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IMissionControlService } from '../../../services/nzr/common/missionControl.js';
import { shouldAutoActivateMissionControl } from './missionControlAutoActivate.js';
import { getMissionControlAutoActivate } from './nzrPipelineSettings.js';

class MissionControlAutoActivateContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.nzr.missionControlAutoActivate';

	constructor(
		@IConfigurationService configurationService: IConfigurationService,
		@IMissionControlService missionControlService: IMissionControlService,
	) {
		const shouldActivate = shouldAutoActivateMissionControl({
			setting: getMissionControlAutoActivate(configurationService),
			isActive: missionControlService.isActive,
		});
		if (!shouldActivate) {
			return;
		}
		try {
			missionControlService.setActive(true);
		} catch {
			// Auto-activate is a startup convenience; swallow failures so a
			// broken `setActive` cannot block workbench restore. The user can
			// still toggle Mission Control manually via the palette.
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(MissionControlAutoActivateContribution, LifecyclePhase.Restored);
