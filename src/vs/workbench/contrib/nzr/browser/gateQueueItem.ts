/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { GateReason, Station } from '../../../../platform/nzr/common/pipelineState.js';

export type GateKind = GateReason['kind'];

/**
 * A user-facing gate row: one Station that needs a human decision, ready
 * to render. Construction is a pure function of the registry snapshot —
 * no DOM, no DI, no side effects.
 */
export interface GateItem {
	readonly stationId: string;
	readonly stationName: string;
	readonly kind: GateKind;
	readonly summary: string;
	readonly startedAt: number;
}

/**
 * Derive the ordered list of gates from the registry's station snapshot.
 * Filters to stations whose pipeline is blocked AND carries a
 * `blockedReason`, then sorts oldest-first by `metrics.startedAt` (cl-2).
 */
export function deriveGateItems(stations: readonly Station[]): readonly GateItem[] {
	const items: GateItem[] = [];
	for (const station of stations) {
		if (!station.pipeline.blocked) { continue; }
		const reason = station.pipeline.blockedReason;
		if (!reason) { continue; }
		items.push({
			stationId: station.id,
			stationName: station.repoName,
			kind: reason.kind,
			summary: summarizeGateReason(reason),
			startedAt: station.metrics.startedAt,
		});
	}
	items.sort((a, b) => a.startedAt - b.startedAt);
	return items;
}

/**
 * Human-readable one-liner for each gate kind. Visible inside the card
 * body; every branch routes through `localize()`.
 */
export function summarizeGateReason(reason: GateReason): string {
	switch (reason.kind) {
		case 'clarify':
			return localize(
				'nzrGateClarifySummary',
				"{0} clarification(s) pending in spec.md",
				reason.markers.length,
			);
		case 'spec-approval':
			return localize(
				'nzrGateSpecApprovalSummary',
				"Spec waiting for approval: {0}",
				reason.specPath,
			);
		case 'plan-approval': {
			const fails = reason.constitutionFails.length;
			if (fails === 0) {
				return localize(
					'nzrGatePlanApprovalSummary',
					"Plan waiting for approval: {0}",
					reason.planPath,
				);
			}
			return localize(
				'nzrGatePlanApprovalSummaryWithFails',
				"Plan waiting for approval: {0} ({1} constitution check(s) failing)",
				reason.planPath,
				fails,
			);
		}
		case 'tasks-approval':
			return localize(
				'nzrGateTasksApprovalSummary',
				"Tasks waiting for approval: {0}",
				reason.tasksPath,
			);
		case 'code-review': {
			const count = reason.findings.length;
			if (reason.prUrl) {
				return localize(
					'nzrGateCodeReviewSummaryWithPr',
					"{0} code review finding(s) — {1}",
					count,
					reason.prUrl,
				);
			}
			return localize(
				'nzrGateCodeReviewSummary',
				"{0} code review finding(s)",
				count,
			);
		}
	}
}
