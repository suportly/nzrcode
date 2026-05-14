/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Lifecycle states of a Claude Code session managed by the bridge. */
export type ClaudeSessionStatus =
	| 'starting'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled';

export interface ClaudeSessionOptions {
	/** Station this session belongs to (NZRCode Mission Control id). */
	readonly stationId: string;
	/** Absolute path used as the spawned process cwd. */
	readonly repoPath: string;
	/** The prompt passed to `claude -p`. */
	readonly prompt: string;
	/** Claude CLI session id to resume; ignored unless `resume === true`. */
	readonly sessionId?: string;
	/** When true and `sessionId` is provided, the spawn prepends `--resume <id>`. */
	readonly resume?: boolean;
	/** Default 300000ms (5 minutes). */
	readonly timeoutMs?: number;
	/**
	 * Extra argv passed verbatim to `claude` after the resume / -p block.
	 * Caller is responsible for validating dangerous flags (e.g.
	 * `--dangerously-skip-permissions`); the bridge does not filter.
	 */
	readonly extraArgs?: readonly string[];
}

export interface ClaudeSessionHandle {
	readonly id: string;
	readonly stationId: string;
	readonly status: ClaudeSessionStatus;
	/** Epoch millis when the session was registered. */
	readonly startedAt: number;
}

export interface ClaudeOutputChunk {
	readonly sessionId: string;
	readonly stream: 'stdout' | 'stderr';
	readonly data: string;
	readonly timestamp: number;
}

export interface ClaudeSessionResult {
	readonly sessionId: string;
	readonly stationId: string;
	readonly status: ClaudeSessionStatus;
	readonly exitCode: number;
	readonly ok: boolean;
	/** Full concatenated stdout for callers that want the result, not the stream. */
	readonly stdout: string;
	readonly stderr: string;
	readonly durationMs: number;
}

export interface ClaudeSessionError {
	readonly sessionId: string;
	readonly stationId: string;
	readonly kind: 'spawn-failed' | 'timeout' | 'cancelled';
	readonly error: string;
}
