/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStationRegistryService } from '../../../../platform/nzr/common/stationRegistry.js';
import { computeGridLayout, GridLayout } from './gridLayout.js';
import { IMissionControlService, MissionControlSlot } from './missionControl.js';

export class MissionControlService extends Disposable implements IMissionControlService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeActive = this._register(new Emitter<boolean>());
	readonly onDidChangeActive = this._onDidChangeActive.event;

	private readonly _onDidChangeSlots = this._register(new Emitter<void>());
	readonly onDidChangeSlots = this._onDidChangeSlots.event;

	private _isActive = false;
	private _slots: readonly MissionControlSlot[] = [];
	private _layout: GridLayout = computeGridLayout(0);

	constructor(
		@IStationRegistryService private readonly _stationRegistry: IStationRegistryService,
	) {
		super();

		this._recomputeSlots();

		this._register(this._stationRegistry.onStationAdded(() => this._recomputeSlots()));
		this._register(this._stationRegistry.onStationRemoved(() => this._recomputeSlots()));
	}

	get isActive(): boolean {
		return this._isActive;
	}

	get slots(): readonly MissionControlSlot[] {
		return this._slots;
	}

	get layout(): GridLayout {
		return this._layout;
	}

	toggle(): void {
		this.setActive(!this._isActive);
	}

	setActive(active: boolean): void {
		if (active === this._isActive) {
			return;
		}
		this._isActive = active;
		this._onDidChangeActive.fire(active);
	}

	private _recomputeSlots(): void {
		const stations = this._stationRegistry.stations;
		this._layout = computeGridLayout(stations.length);

		const cols = this._layout.cols || 1;
		const nextSlots: MissionControlSlot[] = stations.map((station, index) => ({
			stationId: station.id,
			row: Math.floor(index / cols),
			col: index % cols,
		}));

		this._slots = nextSlots;
		this._onDidChangeSlots.fire();
	}
}
