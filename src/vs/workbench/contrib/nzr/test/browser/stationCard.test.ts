/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Station } from '../../../../../platform/nzr/common/pipelineState.js';
import { createStationCard, STATION_CARD_OUTPUT_TAIL } from '../../browser/stationCard.js';

function makeStation(overrides: Partial<Station> = {}): Station {
	const base: Station = {
		id: 'station-1',
		repoPath: '/tmp/repo',
		repoName: 'my-repo',
		branch: 'main',
		preset: 'lean',
		pipeline: { stage: 'specify', blocked: false },
		metrics: { tokens: 0, cost: 0, startedAt: Date.now() },
	};
	return { ...base, ...overrides };
}

suite('stationCard', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('builds the expected DOM skeleton', () => {
		const station = makeStation();
		const handle = createStationCard(station, '');

		assert.strictEqual(handle.element.tagName, 'DIV');
		assert.ok(handle.element.classList.contains('nzr-station-card'));
		assert.strictEqual(handle.element.getAttribute('data-station-id'), 'station-1');
		assert.strictEqual(handle.element.getAttribute('role'), 'region');
		assert.ok(handle.element.getAttribute('aria-label')?.includes('my-repo'));

		const head = handle.element.querySelector('.nzr-station-card__head');
		assert.ok(head, 'head present');
		const title = head!.querySelector('.nzr-station-card__title');
		assert.strictEqual(title?.textContent, 'my-repo');
		const badge = head!.querySelector('.nzr-station-card__stage-badge');
		assert.ok(badge?.classList.contains('stage-specify'));

		const body = handle.element.querySelector('.nzr-station-card__body');
		assert.ok(body, 'body present');
		const pre = body!.querySelector('pre.nzr-station-card__output');
		assert.ok(pre, 'output pre present');
		assert.strictEqual(pre?.getAttribute('aria-live'), 'polite');

		const footer = handle.element.querySelector('.nzr-station-card__footer');
		assert.ok(footer, 'footer present');
		assert.ok(footer!.querySelector('.nzr-station-card__rail-slot'), 'rail slot present');
		assert.ok(footer!.querySelector('.nzr-station-card__metric'), 'metric present');

		handle.dispose();
	});

	test('truncates output to STATION_CARD_OUTPUT_TAIL chars', () => {
		const long = 'a'.repeat(STATION_CARD_OUTPUT_TAIL + 50);
		const handle = createStationCard(makeStation(), long);
		const pre = handle.element.querySelector('pre.nzr-station-card__output');
		assert.strictEqual(pre?.textContent?.length, STATION_CARD_OUTPUT_TAIL);
		handle.dispose();
	});

	test('keeps shorter output intact', () => {
		const short = 'hello world';
		const handle = createStationCard(makeStation(), short);
		const pre = handle.element.querySelector('pre.nzr-station-card__output');
		assert.strictEqual(pre?.textContent, short);
		handle.dispose();
	});

	test('update() mutates head + badge + output without recreating element', () => {
		const handle = createStationCard(makeStation(), '');
		const originalElement = handle.element;
		const originalPre = handle.element.querySelector('pre.nzr-station-card__output');

		const next = makeStation({
			repoName: 'other-repo',
			pipeline: { stage: 'implement', blocked: false },
		});
		handle.update(next, 'streamed output');

		assert.strictEqual(handle.element, originalElement, 'same root element');
		assert.strictEqual(handle.element.querySelector('pre.nzr-station-card__output'), originalPre, 'same pre node');
		assert.strictEqual(
			handle.element.querySelector('.nzr-station-card__title')?.textContent,
			'other-repo',
		);
		const badge = handle.element.querySelector('.nzr-station-card__stage-badge');
		assert.ok(badge?.classList.contains('stage-implement'));
		assert.ok(!badge?.classList.contains('stage-specify'));
		assert.strictEqual(originalPre?.textContent, 'streamed output');

		handle.dispose();
	});

	test('update() swaps every stage class cleanly', () => {
		const stages = ['specify', 'clarify', 'plan', 'tasks', 'implement', 'review', 'done', 'failed', 'idle'] as const;
		const handle = createStationCard(makeStation(), '');
		for (const stage of stages) {
			handle.update(makeStation({ pipeline: { stage, blocked: false } }), '');
			const badge = handle.element.querySelector('.nzr-station-card__stage-badge')!;
			assert.ok(badge.classList.contains(`stage-${stage}`), `expected stage-${stage}`);
			const stageClasses = Array.from(badge.classList).filter(c => c.startsWith('stage-'));
			assert.strictEqual(stageClasses.length, 1, `expected exactly one stage class, got ${stageClasses}`);
		}
		handle.dispose();
	});

	test('dispose() removes the element from its parent', () => {
		const parent = document.createElement('div');
		const handle = createStationCard(makeStation(), '');
		parent.appendChild(handle.element);
		assert.strictEqual(parent.children.length, 1);
		handle.dispose();
		assert.strictEqual(parent.children.length, 0);
	});
});
