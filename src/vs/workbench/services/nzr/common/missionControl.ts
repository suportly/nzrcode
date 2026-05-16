/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { GridLayout } from './gridLayout.js';

export const IMissionControlService = createDecorator<IMissionControlService>('nzrMissionControlService');

/**
 * A station rendered in the Mission Control grid at a specific cell.
 * Positions are row-major: (0,0), (0,1), (1,0), …. Slot only carries
 * the station id — callers resolve the full `Station` via
 * `IStationRegistryService.getStation(id)`.
 */
export interface MissionControlSlot {
	readonly stationId: string;
	readonly row: number;
	readonly col: number;
}

/**
 * Workbench-level state holder for NZRCode Mission Control. The feature
 * 0006 ships state + toggle + layout primitives only; feature 0007
 * consumes this service to paint the actual grid.
 */
export interface IMissionControlService {
	readonly _serviceBrand: undefined;

	readonly isActive: boolean;
	readonly onDidChangeActive: Event<boolean>;

	readonly slots: readonly MissionControlSlot[];
	readonly onDidChangeSlots: Event<void>;
	readonly layout: GridLayout;

	toggle(): void;
	setActive(active: boolean): void;
}
