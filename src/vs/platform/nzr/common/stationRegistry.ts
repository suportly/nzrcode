/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { PipelineStage, PipelineState, SpecRef, Station } from './pipelineState.js';

export const IStationRegistryService = createDecorator<IStationRegistryService>('nzrStationRegistryService');

/**
 * Payload of `onStationStageChanged`. Emitted only when an
 * `updateStationPipeline` call actually changes the stage; updates that
 * only touch counters (`tasksDone`, etc.) do not fire this event.
 */
export interface StageChangeEvent {
	readonly stationId: string;
	readonly previous: PipelineStage;
	readonly next: PipelineStage;
}

/**
 * Minimum data needed to register a new station. The service fills in
 * `id`, `repoName`, `pipeline` defaults, and `metrics`.
 */
export interface NewStationInput {
	readonly repoPath: string;
	readonly branch: string;
	readonly preset: string;
	readonly activeSpec?: SpecRef;
}

/**
 * Headless registry of NZRCode Mission Control stations. Persists the
 * collection to `<workspace>/.nzrcode/workspace.json`. UI features
 * (0006-0008) consume this service and never reach the filesystem
 * directly.
 */
export interface IStationRegistryService {
	readonly _serviceBrand: undefined;

	readonly stations: readonly Station[];

	readonly onStationAdded: Event<Station>;
	readonly onStationRemoved: Event<string>;
	readonly onStationStageChanged: Event<StageChangeEvent>;

	getStation(id: string): Station | undefined;
	addStation(input: NewStationInput): Promise<Station>;
	removeStation(id: string): Promise<boolean>;
	updateStationPipeline(id: string, patch: Partial<PipelineState>): Promise<void>;
}
