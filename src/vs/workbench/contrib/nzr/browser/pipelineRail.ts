/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { PipelineStage } from '../../../../platform/nzr/common/pipelineState.js';

/**
 * Ordered stages painted as dots, in pipeline flow order.
 * `failed` and `idle` are not rendered as positions; they tint the rail.
 */
export const RAIL_STAGES: readonly PipelineStage[] = [
	'specify',
	'clarify',
	'plan',
	'tasks',
	'implement',
	'review',
	'done',
];

export function stageLabel(stage: PipelineStage): string {
	switch (stage) {
		case 'specify': return localize('nzrStageSpecify', "Specify");
		case 'clarify': return localize('nzrStageClarify', "Clarify");
		case 'plan': return localize('nzrStagePlan', "Plan");
		case 'tasks': return localize('nzrStageTasks', "Tasks");
		case 'implement': return localize('nzrStageImplement', "Implement");
		case 'review': return localize('nzrStageReview', "Review");
		case 'done': return localize('nzrStageDone', "Done");
		case 'failed': return localize('nzrStageFailed', "Failed");
		case 'idle': return localize('nzrStageIdle', "Idle");
	}
}

function railIndexFor(stage: PipelineStage): number {
	const idx = RAIL_STAGES.indexOf(stage);
	return idx;
}

export interface PipelineRailHandle {
	readonly element: HTMLElement;
	update(stage: PipelineStage): void;
	dispose(): void;
}

function ariaForStage(stage: PipelineStage): string {
	const idx = railIndexFor(stage);
	if (idx < 0) {
		return localize('nzrRailAriaInactive', "Pipeline not started, stage {0}", stageLabel(stage));
	}
	return localize(
		'nzrRailAriaActive',
		"Pipeline stage {0} of {1}: {2}",
		idx + 1,
		RAIL_STAGES.length,
		stageLabel(stage),
	);
}

export function createPipelineRail(stage: PipelineStage): PipelineRailHandle {
	const element = $('div.nzr-station-card__rail', {
		'role': 'img',
		'aria-label': ariaForStage(stage),
	});

	const dots: HTMLElement[] = [];
	for (let i = 0; i < RAIL_STAGES.length; i++) {
		const dot = append(element, $(`span.nzr-station-card__dot.dot-${i}`));
		dot.setAttribute('data-rail-stage', RAIL_STAGES[i]);
		dots.push(dot);
	}

	applyDotState(dots, element, stage);

	return {
		element,
		update(nextStage) {
			element.setAttribute('aria-label', ariaForStage(nextStage));
			applyDotState(dots, element, nextStage);
		},
		dispose() {
			element.remove();
		},
	};
}

function applyDotState(dots: readonly HTMLElement[], rail: HTMLElement, stage: PipelineStage): void {
	const current = railIndexFor(stage);
	rail.classList.toggle('rail-failed', stage === 'failed');
	rail.classList.toggle('rail-idle', stage === 'idle' || current < 0);

	for (let i = 0; i < dots.length; i++) {
		const dot = dots[i];
		dot.classList.remove('done', 'active', 'todo');
		if (current < 0) {
			dot.classList.add('todo');
			continue;
		}
		if (i < current) {
			dot.classList.add('done');
		} else if (i === current) {
			dot.classList.add('active');
		} else {
			dot.classList.add('todo');
		}
	}
}
