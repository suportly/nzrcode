/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, IPromptChoice, Severity } from '../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContribution, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { buildWelcomeActionDescriptors, buildWelcomeMessage, IWelcomeActionDescriptor, WELCOME_SHOWN_STORAGE_KEY } from './welcomeFlow.js';

const NZR_CATEGORY = localize2('nzrCategory', 'NZR');

function buildPromptChoices(
	commandService: ICommandService,
	markShown: () => void,
): IPromptChoice[] {
	return buildWelcomeActionDescriptors().map((descriptor: IWelcomeActionDescriptor) => ({
		label: descriptor.label,
		run: () => {
			markShown();
			if (descriptor.commandId) {
				void commandService.executeCommand(descriptor.commandId);
			}
		},
	}));
}

function showWelcomeNotification(
	notificationService: INotificationService,
	commandService: ICommandService,
	storageService: IStorageService,
): void {
	const markShown = () => storageService.store(
		WELCOME_SHOWN_STORAGE_KEY,
		true,
		StorageScope.PROFILE,
		StorageTarget.MACHINE,
	);

	notificationService.prompt(
		Severity.Info,
		buildWelcomeMessage(),
		buildPromptChoices(commandService, markShown),
		{ onCancel: markShown },
	);
}

class WelcomeNotificationContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.nzr.welcomeNotification';

	constructor(
		@INotificationService notificationService: INotificationService,
		@IStorageService storageService: IStorageService,
		@ICommandService commandService: ICommandService,
	) {
		if (storageService.getBoolean(WELCOME_SHOWN_STORAGE_KEY, StorageScope.PROFILE, false)) {
			return;
		}
		showWelcomeNotification(notificationService, commandService, storageService);
	}
}

class ShowWelcomeAction extends Action2 {
	static readonly ID = 'nzr.welcome.show';

	constructor() {
		super({
			id: ShowWelcomeAction.ID,
			title: localize2('nzrShowWelcome', 'Show Welcome'),
			category: NZR_CATEGORY,
			f1: true,
		});
	}

	override run(accessor: ServicesAccessor): void {
		showWelcomeNotification(
			accessor.get(INotificationService),
			accessor.get(ICommandService),
			accessor.get(IStorageService),
		);
	}
}

registerAction2(ShowWelcomeAction);

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(WelcomeNotificationContribution, LifecyclePhase.Restored);
