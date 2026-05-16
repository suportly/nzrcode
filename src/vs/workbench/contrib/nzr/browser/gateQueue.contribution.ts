/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/gateQueue.css';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewContainerExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { GateQueueViewPane } from './gateQueueView.js';

const GATE_QUEUE_VIEW_ICON = registerIcon(
	'nzr-gate-queue-view-icon',
	Codicon.checklist,
	localize('nzrGateQueueViewIconDescription', 'Icon for the NZRCode gate queue auxiliary view.'),
);

const GATE_QUEUE_CONTAINER_ID = 'workbench.view.nzr.gateQueue';

const GATE_QUEUE_CONTAINER = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry)
	.registerViewContainer({
		id: GATE_QUEUE_CONTAINER_ID,
		title: localize2('nzrGateQueueContainerTitle', "Gate Queue"),
		icon: GATE_QUEUE_VIEW_ICON,
		order: 7,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [GATE_QUEUE_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
		storageId: GATE_QUEUE_CONTAINER_ID,
		hideIfEmpty: false,
	}, ViewContainerLocation.AuxiliaryBar);

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
	id: GateQueueViewPane.ID,
	name: localize2('nzrGateQueueViewName', "Gate Queue"),
	containerIcon: GATE_QUEUE_VIEW_ICON,
	canToggleVisibility: true,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(GateQueueViewPane),
}], GATE_QUEUE_CONTAINER);
