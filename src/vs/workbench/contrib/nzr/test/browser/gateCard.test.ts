/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { GateItem, GateKind } from '../../browser/gateQueueItem.js';
import { createGateCard } from '../../browser/gateCard.js';

function makeItem(overrides: Partial<GateItem> = {}): GateItem {
	const base: GateItem = {
		stationId: 'station-1',
		stationName: 'my-repo',
		kind: 'clarify',
		summary: '2 clarifications pending',
		startedAt: 0,
	};
	return { ...base, ...overrides };
}

function noopCallbacks() {
	return {
		approved: [] as string[],
		rejected: [] as string[],
	};
}

function callbacks(state: ReturnType<typeof noopCallbacks>) {
	return {
		onApprove: (id: string) => { state.approved.push(id); },
		onReject: (id: string) => { state.rejected.push(id); },
	};
}

suite('gateCard', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('builds the expected DOM skeleton', () => {
		const state = noopCallbacks();
		const handle = createGateCard(makeItem(), callbacks(state));

		assert.strictEqual(handle.element.tagName, 'DIV');
		assert.ok(handle.element.classList.contains('nzr-gate-card'));
		assert.strictEqual(handle.element.getAttribute('data-station-id'), 'station-1');
		assert.strictEqual(handle.element.getAttribute('role'), 'region');
		assert.ok(handle.element.getAttribute('aria-label')?.includes('my-repo'));

		const head = handle.element.querySelector('.nzr-gate-card__head');
		assert.ok(head);
		assert.strictEqual(head!.querySelector('.nzr-gate-card__title')?.textContent, 'my-repo');
		assert.ok(head!.querySelector('.nzr-gate-card__kind-badge.kind-clarify'));

		const body = handle.element.querySelector('.nzr-gate-card__body');
		assert.ok(body);
		assert.strictEqual(body!.querySelector('.nzr-gate-card__summary')?.textContent, '2 clarifications pending');

		const footer = handle.element.querySelector('.nzr-gate-card__footer');
		assert.ok(footer);
		assert.ok(footer!.querySelector('button.nzr-gate-card__btn.btn-approve'));
		assert.ok(footer!.querySelector('button.nzr-gate-card__btn.btn-reject'));

		handle.dispose();
	});

	test('applies the right kind-* class for every GateKind', () => {
		const kinds: GateKind[] = ['clarify', 'spec-approval', 'plan-approval', 'tasks-approval', 'code-review'];
		for (const kind of kinds) {
			const state = noopCallbacks();
			const handle = createGateCard(makeItem({ kind }), callbacks(state));
			const badge = handle.element.querySelector('.nzr-gate-card__kind-badge');
			assert.ok(badge?.classList.contains(`kind-${kind}`), `expected kind-${kind} class`);
			handle.dispose();
		}
	});

	test('Approve button fires onApprove with the station id', () => {
		const state = noopCallbacks();
		const handle = createGateCard(makeItem({ stationId: 's-7' }), callbacks(state));

		(handle.element.querySelector('button.btn-approve') as HTMLButtonElement).click();

		assert.deepStrictEqual(state.approved, ['s-7']);
		assert.deepStrictEqual(state.rejected, []);
		handle.dispose();
	});

	test('Reject button fires onReject with the station id', () => {
		const state = noopCallbacks();
		const handle = createGateCard(makeItem({ stationId: 's-9' }), callbacks(state));

		(handle.element.querySelector('button.btn-reject') as HTMLButtonElement).click();

		assert.deepStrictEqual(state.rejected, ['s-9']);
		assert.deepStrictEqual(state.approved, []);
		handle.dispose();
	});

	test('update() mutates head + body without recreating the root node', () => {
		const state = noopCallbacks();
		const handle = createGateCard(makeItem(), callbacks(state));
		const originalElement = handle.element;
		const originalSummary = handle.element.querySelector('.nzr-gate-card__summary');

		handle.update(makeItem({
			stationName: 'other-repo',
			kind: 'code-review',
			summary: '3 review findings',
			stationId: 's-1',
		}));

		assert.strictEqual(handle.element, originalElement, 'same root element');
		assert.strictEqual(
			handle.element.querySelector('.nzr-gate-card__summary'),
			originalSummary,
			'same summary node',
		);
		assert.strictEqual(handle.element.querySelector('.nzr-gate-card__title')?.textContent, 'other-repo');
		assert.ok(handle.element.querySelector('.nzr-gate-card__kind-badge.kind-code-review'));
		assert.ok(!handle.element.querySelector('.nzr-gate-card__kind-badge.kind-clarify'));
		assert.strictEqual(originalSummary?.textContent, '3 review findings');

		handle.dispose();
	});

	test('update() retargets the click callbacks to the new station id', () => {
		const state = noopCallbacks();
		const handle = createGateCard(makeItem({ stationId: 'old' }), callbacks(state));

		handle.update(makeItem({ stationId: 'new' }));
		(handle.element.querySelector('button.btn-approve') as HTMLButtonElement).click();

		assert.deepStrictEqual(state.approved, ['new']);
		handle.dispose();
	});

	test('dispose() removes the element from its parent', () => {
		const state = noopCallbacks();
		const parent = document.createElement('div');
		const handle = createGateCard(makeItem(), callbacks(state));
		parent.appendChild(handle.element);
		assert.strictEqual(parent.children.length, 1);

		handle.dispose();

		assert.strictEqual(parent.children.length, 0);
	});
});
