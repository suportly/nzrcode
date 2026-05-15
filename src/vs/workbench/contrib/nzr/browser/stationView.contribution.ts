/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/stationView.css';

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewContainerExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { StationViewPane } from './stationView.js';

const missionControlViewIcon = registerIcon(
	'nzr-mission-control-view-icon',
	Codicon.dashboard,
	localize('nzrMissionControlIcon', "Icon for the NZRCode Mission Control view container."),
);

const MISSION_CONTROL_CONTAINER_ID = 'workbench.view.nzr.missionControl';

const missionControlContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
	.registerViewContainer(
		{
			id: MISSION_CONTROL_CONTAINER_ID,
			title: localize2('nzrMissionControlTitle', "Mission Control"),
			icon: missionControlViewIcon,
			ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [MISSION_CONTROL_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
			storageId: MISSION_CONTROL_CONTAINER_ID,
			hideIfEmpty: false,
			order: 6,
		},
		ViewContainerLocation.Sidebar,
	);

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(
	[
		{
			id: StationViewPane.ID,
			name: localize2('nzrStationsViewTitle', "Stations"),
			containerIcon: missionControlViewIcon,
			canToggleVisibility: true,
			canMoveView: true,
			ctorDescriptor: new SyncDescriptor(StationViewPane),
			order: 1,
		},
	],
	missionControlContainer,
);
