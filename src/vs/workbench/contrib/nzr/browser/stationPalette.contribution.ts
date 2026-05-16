/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IStationRegistryService } from '../../../../platform/nzr/common/stationRegistry.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { MissionControlActiveContext } from './missionControl.contribution.js';
import { buildStationQuickPickItems, DEFAULT_BRANCH, IStationPickItem, PRESETS, validateRepoPath } from './stationPaletteFlow.js';

const NZR_CATEGORY = localize2('nzrCategory', 'NZR');

const MISSION_CONTROL_FOCUS_COMMAND = 'workbench.view.nzr.missionControl.focus';

class AddStationAction extends Action2 {
	static readonly ID = 'nzr.station.add';

	constructor() {
		super({
			id: AddStationAction.ID,
			title: localize2('nzrAddStation', 'Add Station'),
			category: NZR_CATEGORY,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const stationRegistry = accessor.get(IStationRegistryService);
		const notificationService = accessor.get(INotificationService);
		const workspaceContextService = accessor.get(IWorkspaceContextService);

		const preset = await quickInputService.pick(
			PRESETS.map(p => ({ label: p })),
			{ placeHolder: localize('nzrAddStationPresetPlaceholder', 'Pick a preset') },
		);
		if (!preset) {
			return;
		}

		const branch = await quickInputService.input({
			prompt: localize('nzrAddStationBranchPrompt', 'Branch to track'),
			value: DEFAULT_BRANCH,
		});
		if (branch === undefined) {
			return;
		}

		const firstFolder = workspaceContextService.getWorkspace().folders[0];
		const defaultRepoPath = firstFolder ? firstFolder.uri.fsPath : '';
		const repoPath = await quickInputService.input({
			prompt: localize('nzrAddStationRepoPathPrompt', 'Repository path'),
			value: defaultRepoPath,
			validateInput: async value => validateRepoPath(value),
		});
		if (repoPath === undefined) {
			return;
		}

		const station = await stationRegistry.addStation({
			repoPath: repoPath.trim(),
			branch: branch.trim() || DEFAULT_BRANCH,
			preset: preset.label,
		});

		notificationService.info(localize('nzrAddStationSuccess', "Station '{0}' added.", station.repoName));
	}
}

class SwitchStationAction extends Action2 {
	static readonly ID = 'nzr.station.switch';

	constructor() {
		super({
			id: SwitchStationAction.ID,
			title: localize2('nzrSwitchStation', 'Switch Station'),
			category: NZR_CATEGORY,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const stationRegistry = accessor.get(IStationRegistryService);
		const commandService = accessor.get(ICommandService);

		const items = buildStationQuickPickItems(stationRegistry.stations);
		const placeHolder = items.length === 0
			? localize('nzrSwitchStationEmpty', 'No stations yet. Use NZR: Add Station first.')
			: localize('nzrSwitchStationPlaceholder', 'Select a station to focus');

		const picked = await quickInputService.pick<IStationPickItem>(items as IStationPickItem[], { placeHolder });
		if (!picked) {
			return;
		}

		await commandService.executeCommand(MISSION_CONTROL_FOCUS_COMMAND);
	}
}

class CloseStationAction extends Action2 {
	static readonly ID = 'nzr.station.close';

	constructor() {
		super({
			id: CloseStationAction.ID,
			title: localize2('nzrCloseStation', 'Close Station'),
			category: NZR_CATEGORY,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const stationRegistry = accessor.get(IStationRegistryService);
		const notificationService = accessor.get(INotificationService);

		const items = buildStationQuickPickItems(stationRegistry.stations);
		if (items.length === 0) {
			notificationService.info(localize('nzrCloseStationEmpty', 'No stations to close.'));
			return;
		}

		const picked = await quickInputService.pick<IStationPickItem>(items as IStationPickItem[], {
			placeHolder: localize('nzrCloseStationPlaceholder', 'Select a station to close'),
		});
		if (!picked) {
			return;
		}

		const station = stationRegistry.getStation(picked.stationId);
		const repoName = station?.repoName ?? picked.stationId;

		notificationService.prompt(
			Severity.Warning,
			localize('nzrCloseStationConfirm', "Close station '{0}'?", repoName),
			[{
				label: localize('nzrCloseStationConfirmButton', 'Close Station'),
				run: () => { void stationRegistry.removeStation(picked.stationId); },
			}],
		);
	}
}

registerAction2(AddStationAction);
registerAction2(SwitchStationAction);
registerAction2(CloseStationAction);

KeybindingsRegistry.registerKeybindingRule({
	id: AddStationAction.ID,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS,
	when: MissionControlActiveContext,
	weight: KeybindingWeight.WorkbenchContrib,
});
