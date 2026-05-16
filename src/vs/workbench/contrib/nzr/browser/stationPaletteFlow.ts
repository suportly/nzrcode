/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { PipelineStage, Station } from '../../../../platform/nzr/common/pipelineState.js';
import { IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';

/**
 * Pure helpers shared by the three Action2s in `stationPalette.contribution.ts`.
 * Keeping them here lets us unit-test the user-facing logic (item shape,
 * stage labels, input validation) without spinning up a full VS Code
 * InstantiationService.
 *
 * The `Action2.run` orchestrator stays thin: it pulls services, calls
 * these helpers, and routes the result.
 */

export const PRESETS = ['django-react', 'expo-mobile', 'python-cli', 'lean'] as const;
export type Preset = typeof PRESETS[number];

export const DEFAULT_BRANCH = 'main';

export interface IStationPickItem extends IQuickPickItem {
	readonly stationId: string;
}

export function buildStationQuickPickItems(stations: readonly Station[]): readonly IStationPickItem[] {
	return stations.map(station => ({
		stationId: station.id,
		label: `${station.repoName} • ${station.branch}`,
		description: humanizeStage(station.pipeline.stage),
	}));
}

export function humanizeStage(stage: PipelineStage): string {
	switch (stage) {
		case 'specify': return localize('nzrStageSpecify', 'Specify');
		case 'clarify': return localize('nzrStageClarify', 'Clarify');
		case 'plan': return localize('nzrStagePlan', 'Plan');
		case 'tasks': return localize('nzrStageTasks', 'Tasks');
		case 'implement': return localize('nzrStageImplement', 'Implement');
		case 'review': return localize('nzrStageReview', 'Review');
		case 'done': return localize('nzrStageDone', 'Done');
		case 'failed': return localize('nzrStageFailed', 'Failed');
		case 'idle': return localize('nzrStageIdle', 'Idle');
	}
}

export function validateRepoPath(input: string | undefined): string | undefined {
	if (!input || input.trim().length === 0) {
		return localize('nzrAddStationRepoPathRequired', 'Repository path is required.');
	}
	return undefined;
}
