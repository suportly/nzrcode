/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import {
	ClaudeOutputChunk,
	ClaudeSessionError,
	ClaudeSessionHandle,
	ClaudeSessionOptions,
	ClaudeSessionResult,
} from './claudeCode.js';

export const IClaudeCodeBridge = createDecorator<IClaudeCodeBridge>('nzrClaudeCodeBridge');

/**
 * Spawns and tracks `claude` CLI processes — one per NZRCode session.
 * Streams stdout/stderr in real time via events; the final result lands
 * on `onSessionExit`. UI consumers (feature 0007) subscribe and render.
 *
 * Sessions are isolated per `repoPath` (cwd); a single station may host
 * multiple concurrent sessions (each gets its own UUID `sessionId`).
 */
export interface IClaudeCodeBridge {
	readonly _serviceBrand: undefined;

	readonly onSessionStarted: Event<ClaudeSessionHandle>;
	readonly onSessionOutput: Event<ClaudeOutputChunk>;
	readonly onSessionExit: Event<ClaudeSessionResult>;
	readonly onSessionError: Event<ClaudeSessionError>;

	/** Spawn a new session. Always resolves (never throws) — spawn failures
	 * surface via `onSessionError` and the returned handle's status. */
	startSession(options: ClaudeSessionOptions): Promise<ClaudeSessionHandle>;

	/** Send SIGTERM (then SIGKILL after a grace period) to the named session.
	 * Returns `false` for unknown ids or already-finished sessions. */
	cancelSession(sessionId: string): Promise<boolean>;

	/** Snapshot of the session, or `undefined` if unknown / already removed. */
	getSession(sessionId: string): ClaudeSessionHandle | undefined;

	/** Snapshot of every session currently in `starting` or `running`. */
	listActiveSessions(): readonly ClaudeSessionHandle[];
}
