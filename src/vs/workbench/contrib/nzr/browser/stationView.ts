/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IClaudeCodeBridge } from '../../../../platform/nzr/common/claudeCodeBridge.js';
import { IMissionControlService } from '../../../services/nzr/common/missionControl.js';
import { IStationRegistryService, StageChangeEvent } from '../../../../platform/nzr/common/stationRegistry.js';
import { createPipelineRail, PipelineRailHandle } from './pipelineRail.js';
import { createStationCard, StationCardHandle, STATION_CARD_OUTPUT_TAIL } from './stationCard.js';

interface CardSlot {
	readonly stationId: string;
	readonly card: StationCardHandle;
	readonly rail: PipelineRailHandle;
	buffer: string;
}

export class StationViewPane extends ViewPane {

	static readonly ID = 'workbench.view.nzr.stations';

	private _grid?: HTMLElement;
	private _emptyState?: HTMLElement;
	private readonly _slots = new Map<string, CardSlot>();

	constructor(
		options: IViewPaneOptions,
		@IMissionControlService private readonly _missionControl: IMissionControlService,
		@IStationRegistryService private readonly _stationRegistry: IStationRegistryService,
		@IClaudeCodeBridge private readonly _claudeBridge: IClaudeCodeBridge,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this._missionControl.onDidChangeSlots(() => this._renderAll()));
		this._register(this._stationRegistry.onStationStageChanged(evt => this._patchByStageChange(evt)));
		this._register(this._claudeBridge.onSessionOutput(chunk => this._appendOutput(chunk.sessionId, chunk.data)));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('nzr-station-view-body');

		this._grid = append(container, $('div.nzr-station-grid'));
		this._emptyState = append(container, $('div.nzr-station-empty'));
		this._emptyState.textContent = localize('nzrStationEmpty', "No stations yet. Open a workspace and add a station from the command palette.");

		this._renderAll();
	}

	protected override layoutBody(_height: number, _width: number): void {
		// CSS Grid sizes children intrinsically; no manual layout required.
	}

	private _renderAll(): void {
		if (!this._grid || !this._emptyState) {
			return;
		}

		const slots = this._missionControl.slots;
		const layout = this._missionControl.layout;

		if (slots.length === 0) {
			this._disposeAllSlots();
			this._emptyState.classList.remove('hidden');
			this._grid.classList.add('hidden');
			this._grid.replaceChildren();
			return;
		}

		this._emptyState.classList.add('hidden');
		this._grid.classList.remove('hidden');
		this._grid.style.gridTemplateColumns = `repeat(${Math.max(layout.cols, 1)}, minmax(0, 1fr))`;
		this._grid.classList.toggle('overflow-scroll', layout.overflowScroll);

		const nextIds = new Set(slots.map(s => s.stationId));

		// Remove cards whose stations are gone.
		for (const [id, slot] of this._slots) {
			if (!nextIds.has(id)) {
				slot.card.dispose();
				slot.rail.dispose();
				this._slots.delete(id);
			}
		}

		this._grid.replaceChildren();
		for (const slotInfo of slots) {
			const station = this._stationRegistry.getStation(slotInfo.stationId);
			if (!station) {
				continue;
			}
			let entry = this._slots.get(station.id);
			if (!entry) {
				const card = createStationCard(station, '');
				const rail = createPipelineRail(station.pipeline.stage);
				const railSlot = card.element.querySelector('.nzr-station-card__rail-slot');
				railSlot?.replaceChildren(rail.element);
				entry = { stationId: station.id, card, rail, buffer: '' };
				this._slots.set(station.id, entry);
			} else {
				entry.card.update(station, entry.buffer);
				entry.rail.update(station.pipeline.stage);
			}
			this._grid.appendChild(entry.card.element);
		}
	}

	private _patchByStageChange(evt: StageChangeEvent): void {
		const entry = this._slots.get(evt.stationId);
		if (!entry) {
			return;
		}
		const station = this._stationRegistry.getStation(evt.stationId);
		if (!station) {
			return;
		}
		entry.card.update(station, entry.buffer);
		entry.rail.update(station.pipeline.stage);
	}

	private _appendOutput(sessionId: string, text: string): void {
		// Sessions are keyed on the bridge by sessionId; in the current
		// data model we treat sessionId === stationId. Feature 0008+
		// will formalise the binding via Station.claudeProcess.
		const entry = this._slots.get(sessionId);
		if (!entry) {
			return;
		}
		const station = this._stationRegistry.getStation(sessionId);
		if (!station) {
			return;
		}
		const combined = entry.buffer + text;
		entry.buffer = combined.length > STATION_CARD_OUTPUT_TAIL
			? combined.slice(combined.length - STATION_CARD_OUTPUT_TAIL)
			: combined;
		entry.card.update(station, entry.buffer);
	}

	private _disposeAllSlots(): void {
		for (const slot of this._slots.values()) {
			slot.card.dispose();
			slot.rail.dispose();
		}
		this._slots.clear();
	}

	override dispose(): void {
		this._disposeAllSlots();
		super.dispose();
	}
}
