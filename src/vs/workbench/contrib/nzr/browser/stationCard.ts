/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { PipelineStage, Station } from '../../../../platform/nzr/common/pipelineState.js';

/**
 * Local stage label used by the card head badge until T003 introduces
 * `pipelineRail.ts` (which will export a canonical `stageLabel`). After
 * T003 lands, this local function is removed and replaced by the import.
 */
function stageLabel(stage: PipelineStage): string {
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

/** Maximum chars of streamed output rendered inside a card's body. */
export const STATION_CARD_OUTPUT_TAIL = 200;

export interface StationCardHandle {
	readonly element: HTMLElement;
	update(station: Station, output: string): void;
	dispose(): void;
}

function tail(output: string): string {
	if (output.length <= STATION_CARD_OUTPUT_TAIL) {
		return output;
	}
	return output.slice(output.length - STATION_CARD_OUTPUT_TAIL);
}

function ariaLabelFor(station: Station): string {
	return localize(
		'nzrStationCardAria',
		"Station {0}, stage {1}",
		station.repoName,
		stageLabel(station.pipeline.stage),
	);
}

export function createStationCard(station: Station, output: string): StationCardHandle {
	const element = $('div.nzr-station-card', {
		'data-station-id': station.id,
		'role': 'region',
		'aria-label': ariaLabelFor(station),
	});

	const head = append(element, $('div.nzr-station-card__head'));
	const titleEl = append(head, $('span.nzr-station-card__title'));
	titleEl.textContent = station.repoName;
	const stageBadge = append(head, $(`span.nzr-station-card__stage-badge.stage-${station.pipeline.stage}`));
	stageBadge.textContent = stageLabel(station.pipeline.stage);

	const body = append(element, $('div.nzr-station-card__body'));
	const outputEl = append(body, $<HTMLPreElement>('pre.nzr-station-card__output', { 'aria-live': 'polite' }));
	outputEl.textContent = tail(output);

	const footer = append(element, $('div.nzr-station-card__footer'));
	// Rail container; the pane mounts a PipelineRailHandle into this slot.
	append(footer, $('div.nzr-station-card__rail-slot'));
	const metricEl = append(footer, $('span.nzr-station-card__metric'));
	metricEl.textContent = formatMetric(station);

	const handle: StationCardHandle = {
		element,
		update(nextStation, nextOutput) {
			element.setAttribute('data-station-id', nextStation.id);
			element.setAttribute('aria-label', ariaLabelFor(nextStation));
			titleEl.textContent = nextStation.repoName;
			stageBadge.className = `nzr-station-card__stage-badge stage-${nextStation.pipeline.stage}`;
			stageBadge.textContent = stageLabel(nextStation.pipeline.stage);
			outputEl.textContent = tail(nextOutput);
			metricEl.textContent = formatMetric(nextStation);
		},
		dispose() {
			element.remove();
		},
	};

	return handle;
}

function formatMetric(station: Station): string {
	const elapsedMs = Date.now() - station.metrics.startedAt;
	if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
		return localize('nzrStationCardMetricIdle', "—");
	}
	const seconds = Math.floor(elapsedMs / 1000);
	if (seconds < 60) {
		return localize('nzrStationCardMetricSeconds', "{0}s", seconds);
	}
	const minutes = Math.floor(seconds / 60);
	const remSeconds = seconds % 60;
	return localize('nzrStationCardMetricMinutes', "{0}m {1}s", minutes, remSeconds);
}
