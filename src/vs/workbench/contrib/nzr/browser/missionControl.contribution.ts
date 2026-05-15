/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IMissionControlService } from '../../../services/nzr/common/missionControl.js';

const NZR_CATEGORY = localize2('nzrCategory', 'NZR');

export const MissionControlActiveContext = new RawContextKey<boolean>(
	'nzr.missionControl.active',
	false,
	{
		type: 'boolean',
		description: localize('nzrMissionControlActiveDescription', 'True when Mission Control is the active workbench surface.'),
	},
);

class ToggleMissionControlAction extends Action2 {
	static readonly ID = 'nzr.toggleMissionControl';

	constructor() {
		super({
			id: ToggleMissionControlAction.ID,
			title: localize2('toggleMissionControl', 'Toggle Mission Control'),
			category: NZR_CATEGORY,
			f1: true,
		});
	}

	override run(accessor: ServicesAccessor): void {
		accessor.get(IMissionControlService).toggle();
	}
}

registerAction2(ToggleMissionControlAction);

/**
 * Binds the context key `nzr.missionControl.active` to the live state of
 * `IMissionControlService`. Without this contribution, `when:` clauses
 * elsewhere in the workbench (gate queue, station view in 0007+) would
 * see a permanently `false` flag.
 */
class MissionControlContextKeyContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.nzr.missionControlContextKey';

	private readonly _disposables = new DisposableStore();
	private readonly _activeKey: IContextKey<boolean>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IMissionControlService missionControlService: IMissionControlService,
	) {
		this._activeKey = MissionControlActiveContext.bindTo(contextKeyService);
		this._activeKey.set(missionControlService.isActive);
		this._disposables.add(missionControlService.onDidChangeActive(active => {
			this._activeKey.set(active);
		}));
	}

	dispose(): void {
		this._disposables.dispose();
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(MissionControlContextKeyContribution, LifecyclePhase.Restored);
