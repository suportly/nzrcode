/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import {
	AdapterError,
	AiadevResult,
	ClarifyMarkersDetectedEvent,
	InitArgs,
	PreflightArgs,
	RunArgs,
	SpecChangedEvent,
} from '../../../../platform/nzr/common/aiadev.js';
import { IAiadevAdapter } from '../../../../platform/nzr/common/aiadevAdapter.js';
import { parseClarifyMarkers } from '../common/clarifyMarkerParser.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const SIGKILL_GRACE_MS = 5_000;
const BIN = 'aiadev';

/** Strip the leading repoPath prefix so we report relative spec paths. */
function relativeSpecPath(absPath: string, repoPath: string): string | undefined {
	if (!absPath.startsWith(repoPath)) {
		return undefined;
	}
	const tail = absPath.slice(repoPath.length).replace(/^[\/\\]/, '');
	if (!/^specs[\/\\][^\/\\]+[\/\\]spec\.md$/.test(tail)) {
		return undefined;
	}
	return tail.replace(/\\/g, '/');
}

export class AiadevAdapter extends Disposable implements IAiadevAdapter {

	declare readonly _serviceBrand: undefined;

	private readonly _onSpecChanged = this._register(new Emitter<SpecChangedEvent>());
	readonly onSpecChanged = this._onSpecChanged.event;

	private readonly _onClarifyMarkersDetected = this._register(new Emitter<ClarifyMarkersDetectedEvent>());
	readonly onClarifyMarkersDetected = this._onClarifyMarkersDetected.event;

	private readonly _onAdapterError = this._register(new Emitter<AdapterError>());
	readonly onAdapterError = this._onAdapterError.event;

	constructor(
		@IFileService private readonly _fileService: IFileService,
	) {
		super();
	}

	runPreflight(args: PreflightArgs): Promise<AiadevResult> {
		return this._spawn(['preflight', args.skill, '--feature', args.feature], args);
	}

	runValidate(args: RunArgs): Promise<AiadevResult> {
		return this._spawn(['validate'], args);
	}

	runSync(args: RunArgs): Promise<AiadevResult> {
		return this._spawn(['sync'], args);
	}

	runInit(args: InitArgs): Promise<AiadevResult> {
		const argv = ['init', '--feature', args.feature];
		if (args.branch) {
			argv.push('--branch', args.branch);
		}
		if (args.language) {
			argv.push('--language', args.language);
		}
		return this._spawn(argv, args);
	}

	attachSpecWatcher(stationId: string, repoPath: string): IDisposable {
		const store = new DisposableStore();
		const specsRoot = URI.file(`${repoPath}/specs`);

		let watchHandle: IDisposable;
		try {
			watchHandle = this._fileService.watch(specsRoot, { recursive: true, excludes: [] });
		} catch (err) {
			this._onAdapterError.fire({
				stationId,
				kind: 'watch-failed',
				error: err instanceof Error ? err.message : String(err),
			});
			return toDisposable(() => { /* nothing to dispose */ });
		}
		store.add(watchHandle);

		const emitChange = (resource: URI, kind: SpecChangedEvent['kind']): void => {
			const specPath = relativeSpecPath(resource.fsPath, repoPath);
			if (!specPath) {
				return;
			}
			this._onSpecChanged.fire({ stationId, specPath, kind });
			if (kind !== 'deleted') {
				void this._readAndEmitMarkers(stationId, specPath, resource);
			}
		};

		store.add(this._fileService.onDidFilesChange(event => {
			for (const resource of event.rawAdded) {
				emitChange(resource, 'created');
			}
			for (const resource of event.rawUpdated) {
				emitChange(resource, 'modified');
			}
			for (const resource of event.rawDeleted) {
				emitChange(resource, 'deleted');
			}
		}));

		return store;
	}

	private async _readAndEmitMarkers(stationId: string, specPath: string, resource: URI): Promise<void> {
		try {
			const content = await this._fileService.readFile(resource);
			const markers = parseClarifyMarkers(content.value.toString());
			if (markers.length > 0) {
				this._onClarifyMarkersDetected.fire({ stationId, specPath, markers });
			}
		} catch (err) {
			this._onAdapterError.fire({
				stationId,
				kind: 'parse-failed',
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	private _spawn(args: string[], runArgs: RunArgs): Promise<AiadevResult> {
		return new Promise<AiadevResult>(resolve => {
			const start = Date.now();
			const timeoutMs = runArgs.timeoutMs ?? DEFAULT_TIMEOUT_MS;

			let child: cp.ChildProcess;
			try {
				child = cp.spawn(BIN, args, {
					cwd: runArgs.cwd,
					shell: false,
					stdio: ['ignore', 'pipe', 'pipe'],
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				this._onAdapterError.fire({ kind: 'spawn-failed', error: message });
				resolve({
					ok: false,
					stdout: '',
					stderr: message,
					exitCode: -1,
					durationMs: Date.now() - start,
				});
				return;
			}

			let stdout = '';
			let stderr = '';
			let timedOut = false;

			const sigterm = setTimeout(() => {
				timedOut = true;
				child.kill('SIGTERM');
				setTimeout(() => {
					if (!child.killed) {
						child.kill('SIGKILL');
					}
				}, SIGKILL_GRACE_MS);
			}, timeoutMs);

			child.stdout!.on('data', chunk => { stdout += chunk.toString(); });
			child.stderr!.on('data', chunk => { stderr += chunk.toString(); });

			child.on('error', err => {
				clearTimeout(sigterm);
				const message = err instanceof Error ? err.message : String(err);
				const isMissing = (err as NodeJS.ErrnoException).code === 'ENOENT';
				this._onAdapterError.fire({
					kind: isMissing ? 'spawn-failed' : 'spawn-failed',
					error: isMissing ? `${BIN} binary not found on PATH` : message,
				});
				resolve({
					ok: false,
					stdout,
					stderr: isMissing ? `${BIN} binary not found on PATH` : message,
					exitCode: -1,
					durationMs: Date.now() - start,
				});
			});

			child.on('close', code => {
				clearTimeout(sigterm);
				const exitCode = code ?? -1;
				if (timedOut) {
					this._onAdapterError.fire({ kind: 'timeout', error: `${BIN} ${args.join(' ')} exceeded ${timeoutMs}ms` });
					resolve({
						ok: false,
						stdout,
						stderr: stderr + `\ntimeout after ${timeoutMs}ms`,
						exitCode: -1,
						durationMs: Date.now() - start,
					});
					return;
				}
				resolve({
					ok: exitCode === 0,
					stdout,
					stderr,
					exitCode,
					durationMs: Date.now() - start,
				});
			});
		});
	}
}
