/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ClarifyMarker } from './pipelineState.js';

/**
 * Subcommands of the `aiadev` CLI that NZRCode invokes. Slash commands
 * dispatched through Claude Code (specify, clarify, plan, tasks,
 * implement) are NOT part of this set — feature 0005 owns that surface.
 */
export type AiadevCommand = 'preflight' | 'validate' | 'sync' | 'init';

export interface AiadevResult {
	readonly ok: boolean;
	readonly stdout: string;
	readonly stderr: string;
	readonly exitCode: number;
	readonly durationMs: number;
}

export interface RunArgs {
	readonly cwd: string;
	/** Defaults to 30000ms. */
	readonly timeoutMs?: number;
}

export interface PreflightArgs extends RunArgs {
	readonly skill: string;
	readonly feature: string;
}

export interface InitArgs extends RunArgs {
	readonly feature: string;
	readonly branch?: string;
	readonly language?: string;
}

export interface SpecChangedEvent {
	readonly stationId: string;
	/** Path relative to the station's repoPath, e.g. "specs/0007-foo/spec.md". */
	readonly specPath: string;
	readonly kind: 'created' | 'modified' | 'deleted';
}

export interface ClarifyMarkersDetectedEvent {
	readonly stationId: string;
	readonly specPath: string;
	readonly markers: readonly ClarifyMarker[];
}

export interface AdapterError {
	readonly stationId?: string;
	readonly kind: 'spawn-failed' | 'parse-failed' | 'watch-failed' | 'timeout';
	readonly error: string;
}
