/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from '../../../../base/common/async.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/path.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { PipelineState, Station } from '../../../../platform/nzr/common/pipelineState.js';
import {
	IStationRegistryService,
	NewStationInput,
	StageChangeEvent,
} from '../../../../platform/nzr/common/stationRegistry.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';

interface PersistedState {
	version: number;
	stations: Station[];
}

const STATE_VERSION = 1;
const WORKSPACE_FILE = '.nzrcode/workspace.json';
const FLUSH_DEBOUNCE_MS = 250;

export class StationRegistryService extends Disposable implements IStationRegistryService {

	declare readonly _serviceBrand: undefined;

	private readonly _onStationAdded = this._register(new Emitter<Station>());
	readonly onStationAdded = this._onStationAdded.event;

	private readonly _onStationRemoved = this._register(new Emitter<string>());
	readonly onStationRemoved = this._onStationRemoved.event;

	private readonly _onStationStageChanged = this._register(new Emitter<StageChangeEvent>());
	readonly onStationStageChanged = this._onStationStageChanged.event;

	private _stations: Station[] = [];
	private _loaded = false;
	private _dirty = false;

	private readonly _flushScheduler: RunOnceScheduler;

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _workspaceService: IWorkspaceContextService,
	) {
		super();
		this._flushScheduler = this._register(new RunOnceScheduler(() => this._flush(), FLUSH_DEBOUNCE_MS));
	}

	get stations(): readonly Station[] {
		void this._ensureLoaded();
		return this._stations;
	}

	getStation(id: string): Station | undefined {
		void this._ensureLoaded();
		return this._stations.find(s => s.id === id);
	}

	async addStation(input: NewStationInput): Promise<Station> {
		await this._ensureLoaded();

		const workspaceUri = this._getWorkspaceUri();
		if (!workspaceUri) {
			throw new Error('Cannot add station: no workspace folder open');
		}

		const station: Station = {
			id: generateUuid(),
			repoPath: input.repoPath,
			repoName: basename(input.repoPath) || input.repoPath,
			branch: input.branch,
			preset: input.preset,
			activeSpec: input.activeSpec,
			pipeline: { stage: 'idle', blocked: false },
			metrics: { tokens: 0, cost: 0, startedAt: Date.now() },
		};

		this._stations = [...this._stations, station];
		this._markDirty();
		this._onStationAdded.fire(station);
		return station;
	}

	async removeStation(id: string): Promise<boolean> {
		await this._ensureLoaded();

		const before = this._stations.length;
		this._stations = this._stations.filter(s => s.id !== id);
		if (this._stations.length === before) {
			return false;
		}
		this._markDirty();
		this._onStationRemoved.fire(id);
		return true;
	}

	async updateStationPipeline(id: string, patch: Partial<PipelineState>): Promise<void> {
		await this._ensureLoaded();

		const station = this._stations.find(s => s.id === id);
		if (!station) {
			return;
		}

		const previousStage = station.pipeline.stage;
		station.pipeline = { ...station.pipeline, ...patch };
		this._markDirty();

		if (patch.stage !== undefined && patch.stage !== previousStage) {
			this._onStationStageChanged.fire({
				stationId: id,
				previous: previousStage,
				next: patch.stage,
			});
		}
	}

	override dispose(): void {
		if (this._dirty) {
			// Best-effort synchronous-style flush; the file write itself stays
			// asynchronous but is no longer cancelled by disposal.
			void this._flush();
		}
		super.dispose();
	}

	private _markDirty(): void {
		this._dirty = true;
		this._flushScheduler.schedule();
	}

	private async _flush(): Promise<void> {
		if (!this._dirty) {
			return;
		}
		const uri = this._stateFileUri();
		if (!uri) {
			return;
		}
		const payload: PersistedState = {
			version: STATE_VERSION,
			stations: this._stations,
		};
		const buf = VSBuffer.fromString(JSON.stringify(payload, null, 2) + '\n');
		await this._fileService.writeFile(uri, buf);
		this._dirty = false;
	}

	private async _ensureLoaded(): Promise<void> {
		if (this._loaded) {
			return;
		}
		this._loaded = true;
		const uri = this._stateFileUri();
		if (!uri) {
			return;
		}
		const exists = await this._fileService.exists(uri);
		if (!exists) {
			return;
		}
		try {
			const content = await this._fileService.readFile(uri);
			const parsed: PersistedState = JSON.parse(content.value.toString());
			if (Array.isArray(parsed?.stations)) {
				this._stations = parsed.stations;
			}
		} catch {
			// Corrupted state file: start fresh rather than throw on boot.
			this._stations = [];
		}
	}

	private _getWorkspaceUri(): URI | undefined {
		const folders = this._workspaceService.getWorkspace().folders;
		return folders.length > 0 ? folders[0].uri : undefined;
	}

	private _stateFileUri(): URI | undefined {
		const folder = this._getWorkspaceUri();
		if (!folder) {
			return undefined;
		}
		return URI.joinPath(folder, WORKSPACE_FILE);
	}
}
