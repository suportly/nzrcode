/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import {
	ClaudeOutputChunk,
	ClaudeSessionError,
	ClaudeSessionHandle,
	ClaudeSessionOptions,
	ClaudeSessionResult,
	ClaudeSessionStatus,
} from '../../../../platform/nzr/common/claudeCode.js';
import { IClaudeCodeBridge } from '../../../../platform/nzr/common/claudeCodeBridge.js';

const BIN = 'claude';
const DEFAULT_TIMEOUT_MS = 300_000;
const SIGKILL_GRACE_MS = 5_000;

interface SessionEntry {
	handle: ClaudeSessionHandle;
	child: cp.ChildProcessWithoutNullStreams | undefined;
	stdout: string;
	stderr: string;
	startedAtMs: number;
	cancelTimer?: NodeJS.Timeout;
	timeoutTimer?: NodeJS.Timeout;
	cancelled: boolean;
	timedOut: boolean;
}

function freezeHandle(handle: ClaudeSessionHandle): ClaudeSessionHandle {
	return Object.freeze({ ...handle });
}

export class ClaudeCodeBridge extends Disposable implements IClaudeCodeBridge {

	declare readonly _serviceBrand: undefined;

	private readonly _onSessionStarted = this._register(new Emitter<ClaudeSessionHandle>());
	readonly onSessionStarted = this._onSessionStarted.event;

	private readonly _onSessionOutput = this._register(new Emitter<ClaudeOutputChunk>());
	readonly onSessionOutput = this._onSessionOutput.event;

	private readonly _onSessionExit = this._register(new Emitter<ClaudeSessionResult>());
	readonly onSessionExit = this._onSessionExit.event;

	private readonly _onSessionError = this._register(new Emitter<ClaudeSessionError>());
	readonly onSessionError = this._onSessionError.event;

	private readonly _sessions = new Map<string, SessionEntry>();

	async startSession(options: ClaudeSessionOptions): Promise<ClaudeSessionHandle> {
		const sessionId = generateUuid();
		const startedAt = Date.now();
		const argv = this._buildArgv(options);

		const handle: ClaudeSessionHandle = {
			id: sessionId,
			stationId: options.stationId,
			status: 'starting',
			startedAt,
		};

		const entry: SessionEntry = {
			handle: freezeHandle(handle),
			child: undefined,
			stdout: '',
			stderr: '',
			startedAtMs: startedAt,
			cancelled: false,
			timedOut: false,
		};
		this._sessions.set(sessionId, entry);

		let child: cp.ChildProcessWithoutNullStreams;
		try {
			child = cp.spawn(BIN, argv, {
				cwd: options.repoPath,
				shell: false,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return this._failSpawn(entry, message);
		}

		entry.child = child;
		entry.handle = freezeHandle({ ...entry.handle, status: 'running' });
		this._onSessionStarted.fire(entry.handle);

		const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
		entry.timeoutTimer = setTimeout(() => {
			entry.timedOut = true;
			child.kill('SIGTERM');
			entry.cancelTimer = setTimeout(() => {
				if (!child.killed) {
					child.kill('SIGKILL');
				}
			}, SIGKILL_GRACE_MS);
		}, timeoutMs);

		child.stdout.on('data', chunk => {
			const data = chunk.toString();
			entry.stdout += data;
			this._onSessionOutput.fire({
				sessionId,
				stream: 'stdout',
				data,
				timestamp: Date.now(),
			});
		});

		child.stderr.on('data', chunk => {
			const data = chunk.toString();
			entry.stderr += data;
			this._onSessionOutput.fire({
				sessionId,
				stream: 'stderr',
				data,
				timestamp: Date.now(),
			});
		});

		child.on('error', err => {
			const isMissing = (err as NodeJS.ErrnoException).code === 'ENOENT';
			const message = isMissing
				? `${BIN} binary not found on PATH`
				: err instanceof Error ? err.message : String(err);
			this._fail(entry, message);
		});

		child.on('close', exitCode => {
			this._finalise(entry, exitCode ?? -1);
		});

		return entry.handle;
	}

	async cancelSession(sessionId: string): Promise<boolean> {
		const entry = this._sessions.get(sessionId);
		if (!entry || !entry.child) {
			return false;
		}
		if (this._isTerminalStatus(entry.handle.status)) {
			return false;
		}
		entry.cancelled = true;
		entry.handle = freezeHandle({ ...entry.handle, status: 'cancelled' });
		entry.child.kill('SIGTERM');
		entry.cancelTimer = setTimeout(() => {
			if (entry.child && !entry.child.killed) {
				entry.child.kill('SIGKILL');
			}
		}, SIGKILL_GRACE_MS);
		return true;
	}

	getSession(sessionId: string): ClaudeSessionHandle | undefined {
		return this._sessions.get(sessionId)?.handle;
	}

	listActiveSessions(): readonly ClaudeSessionHandle[] {
		const out: ClaudeSessionHandle[] = [];
		for (const entry of this._sessions.values()) {
			if (entry.handle.status === 'starting' || entry.handle.status === 'running') {
				out.push(entry.handle);
			}
		}
		return out;
	}

	override dispose(): void {
		for (const entry of this._sessions.values()) {
			if (entry.child && !this._isTerminalStatus(entry.handle.status)) {
				try {
					entry.child.kill('SIGTERM');
				} catch {
					// best effort
				}
			}
			if (entry.cancelTimer) {
				clearTimeout(entry.cancelTimer);
			}
			if (entry.timeoutTimer) {
				clearTimeout(entry.timeoutTimer);
			}
		}
		this._sessions.clear();
		super.dispose();
	}

	private _buildArgv(options: ClaudeSessionOptions): string[] {
		const argv: string[] = [];
		if (options.resume && options.sessionId) {
			argv.push('--resume', options.sessionId);
		}
		argv.push('-p', options.prompt);
		if (options.extraArgs && options.extraArgs.length > 0) {
			argv.push(...options.extraArgs);
		}
		return argv;
	}

	private _failSpawn(entry: SessionEntry, message: string): ClaudeSessionHandle {
		entry.handle = freezeHandle({ ...entry.handle, status: 'failed' });
		this._onSessionError.fire({
			sessionId: entry.handle.id,
			stationId: entry.handle.stationId,
			kind: 'spawn-failed',
			error: message,
		});
		this._sessions.delete(entry.handle.id);
		return entry.handle;
	}

	private _fail(entry: SessionEntry, message: string): void {
		if (this._isTerminalStatus(entry.handle.status)) {
			return;
		}
		entry.handle = freezeHandle({ ...entry.handle, status: 'failed' });
		this._onSessionError.fire({
			sessionId: entry.handle.id,
			stationId: entry.handle.stationId,
			kind: 'spawn-failed',
			error: message,
		});
		this._sessions.delete(entry.handle.id);
	}

	private _finalise(entry: SessionEntry, exitCode: number): void {
		if (entry.timeoutTimer) {
			clearTimeout(entry.timeoutTimer);
			entry.timeoutTimer = undefined;
		}
		if (entry.cancelTimer) {
			clearTimeout(entry.cancelTimer);
			entry.cancelTimer = undefined;
		}

		const finalStatus: ClaudeSessionStatus = entry.cancelled
			? 'cancelled'
			: entry.timedOut
				? 'failed'
				: exitCode === 0
					? 'completed'
					: 'failed';

		entry.handle = freezeHandle({ ...entry.handle, status: finalStatus });

		if (entry.timedOut) {
			this._onSessionError.fire({
				sessionId: entry.handle.id,
				stationId: entry.handle.stationId,
				kind: 'timeout',
				error: `${BIN} session exceeded timeout`,
			});
		}

		const result: ClaudeSessionResult = {
			sessionId: entry.handle.id,
			stationId: entry.handle.stationId,
			status: finalStatus,
			exitCode,
			ok: finalStatus === 'completed',
			stdout: entry.stdout,
			stderr: entry.stderr,
			durationMs: Date.now() - entry.startedAtMs,
		};
		this._onSessionExit.fire(result);

		this._sessions.delete(entry.handle.id);
	}

	private _isTerminalStatus(status: ClaudeSessionStatus): boolean {
		return status === 'completed' || status === 'failed' || status === 'cancelled';
	}
}
