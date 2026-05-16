/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { PipelineStage } from '../../../../../platform/nzr/common/pipelineState.js';
import { createPipelineRail, RAIL_STAGES, stageLabel } from '../../browser/pipelineRail.js';

suite('pipelineRail', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('stageLabel returns a non-empty string for every PipelineStage', () => {
		const stages: PipelineStage[] = ['specify', 'clarify', 'plan', 'tasks', 'implement', 'review', 'done', 'failed', 'idle'];
		for (const stage of stages) {
			const label = stageLabel(stage);
			assert.ok(label && label.length > 0, `empty label for ${stage}`);
		}
	});

	test('RAIL_STAGES has exactly 7 ordered stages', () => {
		assert.strictEqual(RAIL_STAGES.length, 7);
		assert.deepStrictEqual(
			[...RAIL_STAGES],
			['specify', 'clarify', 'plan', 'tasks', 'implement', 'review', 'done'],
		);
	});

	test('rail renders 7 dots with .dot-<idx> + data-rail-stage', () => {
		const rail = createPipelineRail('specify');
		const dots = rail.element.querySelectorAll('.nzr-station-card__dot');
		assert.strictEqual(dots.length, 7);
		dots.forEach((dot, i) => {
			assert.ok(dot.classList.contains(`dot-${i}`), `dot ${i} missing class dot-${i}`);
			assert.strictEqual(dot.getAttribute('data-rail-stage'), RAIL_STAGES[i]);
		});
		rail.dispose();
	});

	test('first stage (specify) → active=0, todo for 1..6', () => {
		const rail = createPipelineRail('specify');
		const dots = rail.element.querySelectorAll('.nzr-station-card__dot');
		assert.ok(dots[0].classList.contains('active'));
		for (let i = 1; i < 7; i++) {
			assert.ok(dots[i].classList.contains('todo'), `dot ${i} should be todo`);
		}
		rail.dispose();
	});

	test('mid stage (tasks) → done 0..2, active 3, todo 4..6', () => {
		const rail = createPipelineRail('tasks');
		const dots = rail.element.querySelectorAll('.nzr-station-card__dot');
		for (let i = 0; i < 3; i++) {
			assert.ok(dots[i].classList.contains('done'), `dot ${i} should be done`);
		}
		assert.ok(dots[3].classList.contains('active'), 'dot 3 should be active');
		for (let i = 4; i < 7; i++) {
			assert.ok(dots[i].classList.contains('todo'), `dot ${i} should be todo`);
		}
		rail.dispose();
	});

	test('done → all done except last, last active', () => {
		const rail = createPipelineRail('done');
		const dots = rail.element.querySelectorAll('.nzr-station-card__dot');
		for (let i = 0; i < 6; i++) {
			assert.ok(dots[i].classList.contains('done'), `dot ${i} should be done`);
		}
		assert.ok(dots[6].classList.contains('active'), 'dot 6 should be active (done is the 7th step)');
		rail.dispose();
	});

	test('failed → all dots todo + rail-failed class', () => {
		const rail = createPipelineRail('failed');
		assert.ok(rail.element.classList.contains('rail-failed'));
		const dots = rail.element.querySelectorAll('.nzr-station-card__dot');
		for (const dot of dots) {
			assert.ok(dot.classList.contains('todo'), 'failed rail keeps every dot as todo');
			assert.ok(!dot.classList.contains('done'));
			assert.ok(!dot.classList.contains('active'));
		}
		rail.dispose();
	});

	test('idle → all dots todo + rail-idle class', () => {
		const rail = createPipelineRail('idle');
		assert.ok(rail.element.classList.contains('rail-idle'));
		const dots = rail.element.querySelectorAll('.nzr-station-card__dot');
		for (const dot of dots) {
			assert.ok(dot.classList.contains('todo'));
		}
		rail.dispose();
	});

	test('update() swaps state without recreating dots', () => {
		const rail = createPipelineRail('specify');
		const originalDots = Array.from(rail.element.querySelectorAll('.nzr-station-card__dot'));
		rail.update('implement');
		const afterDots = Array.from(rail.element.querySelectorAll('.nzr-station-card__dot'));
		assert.strictEqual(originalDots.length, afterDots.length);
		for (let i = 0; i < originalDots.length; i++) {
			assert.strictEqual(originalDots[i], afterDots[i], `dot ${i} identity preserved`);
		}
		// after switching to implement: 0..3 done, 4 active, 5..6 todo
		for (let i = 0; i < 4; i++) {
			assert.ok(afterDots[i].classList.contains('done'));
		}
		assert.ok(afterDots[4].classList.contains('active'));
		for (let i = 5; i < 7; i++) {
			assert.ok(afterDots[i].classList.contains('todo'));
		}
		rail.dispose();
	});

	test('aria-label updates with the active stage', () => {
		const rail = createPipelineRail('specify');
		const before = rail.element.getAttribute('aria-label') ?? '';
		assert.ok(before.length > 0);
		rail.update('review');
		const after = rail.element.getAttribute('aria-label') ?? '';
		assert.notStrictEqual(before, after);
		rail.dispose();
	});

	test('dispose() removes element from parent', () => {
		const parent = document.createElement('div');
		const rail = createPipelineRail('plan');
		parent.appendChild(rail.element);
		assert.strictEqual(parent.children.length, 1);
		rail.dispose();
		assert.strictEqual(parent.children.length, 0);
	});
});
