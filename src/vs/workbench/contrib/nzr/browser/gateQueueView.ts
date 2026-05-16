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
import { IStationRegistryService } from '../../../../platform/nzr/common/stationRegistry.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { createGateCard, GateCardHandle } from './gateCard.js';
import { deriveGateItems, GateItem } from './gateQueueItem.js';

interface CardEntry {
	readonly card: GateCardHandle;
	stationId: string;
}

export class GateQueueViewPane extends ViewPane {

	static readonly ID = 'workbench.view.nzr.gateQueue.list';

	private _list?: HTMLElement;
	private _emptyState?: HTMLElement;
	private readonly _cards = new Map<string, CardEntry>();

	constructor(
		options: IViewPaneOptions,
		@IStationRegistryService private readonly _stationRegistry: IStationRegistryService,
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

		this._register(this._stationRegistry.onStationAdded(() => this._render()));
		this._register(this._stationRegistry.onStationRemoved(() => this._render()));
		this._register(this._stationRegistry.onStationStageChanged(() => this._render()));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('nzr-gate-queue-body');

		this._list = append(container, $('div.nzr-gate-queue-list'));
		this._emptyState = append(container, $('div.nzr-gate-queue-empty'));
		this._emptyState.textContent = localize('nzrGateQueueEmpty', "No gates waiting on you.");

		this._render();
	}

	protected override layoutBody(_height: number, _width: number): void {
		// CSS handles intrinsic sizing.
	}

	private _render(): void {
		if (!this._list || !this._emptyState) { return; }

		const items: readonly GateItem[] = deriveGateItems(this._stationRegistry.stations);

		if (items.length === 0) {
			this._disposeAllCards();
			this._list.replaceChildren();
			this._list.classList.add('hidden');
			this._emptyState.classList.remove('hidden');
			return;
		}

		this._list.classList.remove('hidden');
		this._emptyState.classList.add('hidden');

		const nextIds = new Set(items.map(i => i.stationId));
		for (const [id, entry] of this._cards) {
			if (!nextIds.has(id)) {
				entry.card.dispose();
				this._cards.delete(id);
			}
		}

		this._list.replaceChildren();
		for (const item of items) {
			let entry = this._cards.get(item.stationId);
			if (!entry) {
				const card = createGateCard(item, {
					onApprove: (stationId) => this._approve(stationId),
					onReject: (stationId) => this._reject(stationId),
				});
				entry = { card, stationId: item.stationId };
				this._cards.set(item.stationId, entry);
			} else {
				entry.card.update(item);
			}
			this._list.appendChild(entry.card.element);
		}
	}

	private _approve(stationId: string): void {
		void this._stationRegistry.updateStationPipeline(stationId, {
			blocked: false,
			blockedReason: undefined,
		});
	}

	private _reject(stationId: string): void {
		void this._stationRegistry.updateStationPipeline(stationId, {
			blocked: false,
			blockedReason: undefined,
			stage: 'failed',
		});
	}

	private _disposeAllCards(): void {
		for (const entry of this._cards.values()) {
			entry.card.dispose();
		}
		this._cards.clear();
	}

	override dispose(): void {
		this._disposeAllCards();
		super.dispose();
	}

}
