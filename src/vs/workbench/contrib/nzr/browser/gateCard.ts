/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { GateItem, GateKind } from './gateQueueItem.js';

export interface GateCardHandle {
	readonly element: HTMLElement;
	update(item: GateItem): void;
	dispose(): void;
}

export interface GateCardCallbacks {
	onApprove(stationId: string): void;
	onReject(stationId: string): void;
}

function kindLabel(kind: GateKind): string {
	switch (kind) {
		case 'clarify': return localize('nzrGateKindClarify', "Clarify");
		case 'spec-approval': return localize('nzrGateKindSpecApproval', "Spec");
		case 'plan-approval': return localize('nzrGateKindPlanApproval', "Plan");
		case 'tasks-approval': return localize('nzrGateKindTasksApproval', "Tasks");
		case 'code-review': return localize('nzrGateKindCodeReview', "Code review");
	}
}

function ariaLabelFor(item: GateItem): string {
	return localize(
		'nzrGateCardAria',
		"Gate for station {0}: {1}",
		item.stationName,
		kindLabel(item.kind),
	);
}

export function createGateCard(item: GateItem, callbacks: GateCardCallbacks): GateCardHandle {
	const element = $('div.nzr-gate-card', {
		'data-station-id': item.stationId,
		'role': 'region',
		'aria-label': ariaLabelFor(item),
	});

	const head = append(element, $('div.nzr-gate-card__head'));
	const titleEl = append(head, $('span.nzr-gate-card__title'));
	titleEl.textContent = item.stationName;
	const kindBadge = append(head, $(`span.nzr-gate-card__kind-badge.kind-${item.kind}`));
	kindBadge.textContent = kindLabel(item.kind);

	const body = append(element, $('div.nzr-gate-card__body'));
	const summaryEl = append(body, $('div.nzr-gate-card__summary'));
	summaryEl.textContent = item.summary;

	const footer = append(element, $('div.nzr-gate-card__footer'));
	const approveBtn = append(footer, $<HTMLButtonElement>('button.nzr-gate-card__btn.btn-approve'));
	approveBtn.type = 'button';
	approveBtn.textContent = localize('nzrGateBtnApprove', "Approve");
	approveBtn.setAttribute('aria-label', localize('nzrGateBtnApproveAria', "Approve gate for {0}", item.stationName));

	const rejectBtn = append(footer, $<HTMLButtonElement>('button.nzr-gate-card__btn.btn-reject'));
	rejectBtn.type = 'button';
	rejectBtn.textContent = localize('nzrGateBtnReject', "Reject");
	rejectBtn.setAttribute('aria-label', localize('nzrGateBtnRejectAria', "Reject gate for {0}", item.stationName));

	let currentStationId = item.stationId;

	const onApproveClick = (ev: Event) => {
		ev.stopPropagation();
		callbacks.onApprove(currentStationId);
	};
	const onRejectClick = (ev: Event) => {
		ev.stopPropagation();
		callbacks.onReject(currentStationId);
	};
	approveBtn.addEventListener('click', onApproveClick);
	rejectBtn.addEventListener('click', onRejectClick);

	const handle: GateCardHandle = {
		element,
		update(nextItem: GateItem) {
			currentStationId = nextItem.stationId;
			element.setAttribute('data-station-id', nextItem.stationId);
			element.setAttribute('aria-label', ariaLabelFor(nextItem));
			titleEl.textContent = nextItem.stationName;
			kindBadge.className = `nzr-gate-card__kind-badge kind-${nextItem.kind}`;
			kindBadge.textContent = kindLabel(nextItem.kind);
			summaryEl.textContent = nextItem.summary;
			approveBtn.setAttribute('aria-label', localize('nzrGateBtnApproveAria', "Approve gate for {0}", nextItem.stationName));
			rejectBtn.setAttribute('aria-label', localize('nzrGateBtnRejectAria', "Reject gate for {0}", nextItem.stationName));
		},
		dispose() {
			approveBtn.removeEventListener('click', onApproveClick);
			rejectBtn.removeEventListener('click', onRejectClick);
			element.remove();
		},
	};

	return handle;
}
