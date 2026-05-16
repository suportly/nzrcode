/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Pipeline + Station domain model for NZRCode Mission Control.
 *
 * Types in this module are the source of truth for every feature that
 * touches stations or the AIADev pipeline:
 *   - feature 0004 (AIADev adapter) updates `PipelineState` on stage
 *     transitions.
 *   - feature 0005 (Claude Code bridge) fills in `ClaudeProcess`.
 *   - features 0006-0008 (Mission Control, station view, gate queue)
 *     consume `Station` and `GateReason` for rendering.
 *
 * Field names mirror the implementation brief §4 verbatim.
 */

export type PipelineStage =
	| 'specify'
	| 'clarify'
	| 'plan'
	| 'tasks'
	| 'implement'
	| 'review'
	| 'done'
	| 'failed'
	| 'idle';

export interface SpecRef {
	/** Slug of the spec directory (e.g. "0007-stripe-webhooks-v2"). */
	readonly slug: string;
	/** Path to spec.md relative to repoPath (e.g. "specs/0007-stripe-webhooks-v2/spec.md"). */
	readonly path: string;
	/** Human-readable title pulled from the spec heading. */
	readonly title: string;
}

export interface ClarifyMarker {
	/** Stable id used by `clarify` (e.g. "cl-1"). */
	readonly id: string;
	/** Section heading the marker lives under. */
	readonly section: string;
	/** The clarification question text. */
	readonly question: string;
	/** Optional multiple-choice options if `clarify` proposed any. */
	readonly suggestedOptions?: readonly string[];
}

export interface ReviewFinding {
	readonly severity: 'blocking' | 'should-fix' | 'nit';
	readonly file: string;
	readonly line?: number;
	readonly message: string;
}

export type GateReason =
	| { readonly kind: 'clarify'; readonly markers: readonly ClarifyMarker[] }
	| { readonly kind: 'spec-approval'; readonly specPath: string }
	| {
		readonly kind: 'plan-approval';
		readonly planPath: string;
		readonly constitutionFails: readonly string[];
	}
	| { readonly kind: 'tasks-approval'; readonly tasksPath: string }
	| {
		readonly kind: 'code-review';
		readonly prUrl?: string;
		readonly findings: readonly ReviewFinding[];
	};

export interface PipelineState {
	stage: PipelineStage;
	/** True when the pipeline is paused waiting on a human (clarify / approval / review). */
	blocked: boolean;
	blockedReason?: GateReason;
	tasksTotal?: number;
	tasksDone?: number;
	/** Currently running task id, e.g. "T04". */
	currentTaskId?: string;
	subagentStatus?: 'RED' | 'GREEN' | 'REFACTOR' | 'REVIEW';
}

/**
 * Placeholder type for the Claude Code process attached to a station.
 * The real implementation lands in feature 0005 (claude-code-bridge);
 * this shape is what the registry persists today.
 */
export interface ClaudeProcess {
	readonly pid?: number;
	readonly status: 'starting' | 'running' | 'crashed' | 'idle';
}

export interface StationMetrics {
	tokens: number;
	cost: number;
	/** Epoch millis when the station was registered. */
	startedAt: number;
}

export interface Station {
	readonly id: string;
	readonly repoPath: string;
	readonly repoName: string;
	branch: string;
	preset: string;
	activeSpec?: SpecRef;
	pipeline: PipelineState;
	claudeProcess?: ClaudeProcess;
	metrics: StationMetrics;
}
