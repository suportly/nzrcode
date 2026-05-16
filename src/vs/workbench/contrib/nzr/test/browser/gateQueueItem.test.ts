/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { GateReason, Station } from '../../../../../platform/nzr/common/pipelineState.js';
import { deriveGateItems, summarizeGateReason } from '../../browser/gateQueueItem.js';

function station(overrides: Partial<Station> & { id: string }): Station {
	const base: Station = {
		id: overrides.id,
		repoPath: '/tmp/' + overrides.id,
		repoName: overrides.id,
		branch: 'main',
		preset: 'lean',
		pipeline: { stage: 'clarify', blocked: false },
		metrics: { tokens: 0, cost: 0, startedAt: 0 },
	};
	return { ...base, ...overrides };
}

function blocked(id: string, startedAt: number, reason: GateReason): Station {
	return station({
		id,
		pipeline: { stage: 'clarify', blocked: true, blockedReason: reason },
		metrics: { tokens: 0, cost: 0, startedAt },
	});
}

const clarifyReason: GateReason = {
	kind: 'clarify',
	markers: [
		{ id: 'cl-1', section: 'API', question: 'What format?' },
		{ id: 'cl-2', section: 'API', question: 'Pagination size?' },
	],
};
const specApprovalReason: GateReason = { kind: 'spec-approval', specPath: 'specs/0001-foo/spec.md' };
const planApprovalReason: GateReason = { kind: 'plan-approval', planPath: 'specs/0001-foo/plan.md', constitutionFails: [] };
const planApprovalReasonFailing: GateReason = { kind: 'plan-approval', planPath: 'specs/0001-foo/plan.md', constitutionFails: ['II', 'III'] };
const tasksApprovalReason: GateReason = { kind: 'tasks-approval', tasksPath: 'specs/0001-foo/tasks.md' };
const codeReviewReason: GateReason = { kind: 'code-review', findings: [{ severity: 'blocking', file: 'a.ts', message: 'oops' }] };
const codeReviewWithPr: GateReason = { kind: 'code-review', prUrl: 'https://github.com/x/y/pull/1', findings: [] };

suite('deriveGateItems', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty stations → empty items', () => {
		assert.deepStrictEqual(deriveGateItems([]), []);
	});

	test('skips stations that are not blocked', () => {
		const result = deriveGateItems([station({ id: 's-1' })]);
		assert.deepStrictEqual(result, []);
	});

	test('skips stations that are blocked but missing blockedReason', () => {
		const s = station({
			id: 's-1',
			pipeline: { stage: 'clarify', blocked: true },
		});
		assert.deepStrictEqual(deriveGateItems([s]), []);
	});

	test('emits a GateItem for each of the 5 GateReason kinds', () => {
		const items = deriveGateItems([
			blocked('s-1', 1, clarifyReason),
			blocked('s-2', 2, specApprovalReason),
			blocked('s-3', 3, planApprovalReason),
			blocked('s-4', 4, tasksApprovalReason),
			blocked('s-5', 5, codeReviewReason),
		]);

		assert.strictEqual(items.length, 5);
		const kinds = items.map(i => i.kind);
		assert.deepStrictEqual([...kinds].sort(), ['clarify', 'code-review', 'plan-approval', 'spec-approval', 'tasks-approval']);
	});

	test('sorts oldest-first by metrics.startedAt (cl-2)', () => {
		const items = deriveGateItems([
			blocked('newer', 1000, specApprovalReason),
			blocked('older', 500, specApprovalReason),
			blocked('newest', 2000, specApprovalReason),
		]);

		assert.deepStrictEqual(items.map(i => i.stationId), ['older', 'newer', 'newest']);
	});

	test('carries stationName from station.repoName', () => {
		const s = blocked('s-1', 1, specApprovalReason);
		const items = deriveGateItems([{ ...s, repoName: 'my-cool-repo' }]);
		assert.strictEqual(items[0].stationName, 'my-cool-repo');
	});
});

suite('summarizeGateReason', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('clarify: mentions the pending count', () => {
		const summary = summarizeGateReason(clarifyReason);
		assert.ok(summary.includes('2'), `got: ${summary}`);
	});

	test('spec-approval: mentions the spec path', () => {
		const summary = summarizeGateReason(specApprovalReason);
		assert.ok(summary.includes('specs/0001-foo/spec.md'));
	});

	test('plan-approval (no fails): mentions the plan path, no fail count', () => {
		const summary = summarizeGateReason(planApprovalReason);
		assert.ok(summary.includes('specs/0001-foo/plan.md'));
		assert.ok(!/constitution check/i.test(summary));
	});

	test('plan-approval (with fails): mentions the constitution fail count', () => {
		const summary = summarizeGateReason(planApprovalReasonFailing);
		assert.ok(/2/.test(summary));
		assert.ok(/constitution/i.test(summary));
	});

	test('tasks-approval: mentions the tasks path', () => {
		const summary = summarizeGateReason(tasksApprovalReason);
		assert.ok(summary.includes('specs/0001-foo/tasks.md'));
	});

	test('code-review (no PR): mentions the findings count only', () => {
		const summary = summarizeGateReason(codeReviewReason);
		assert.ok(summary.includes('1'));
		assert.ok(!summary.includes('http'));
	});

	test('code-review (with PR): mentions both the count and the PR URL', () => {
		const summary = summarizeGateReason(codeReviewWithPr);
		assert.ok(summary.includes('0'));
		assert.ok(summary.includes('https://github.com/x/y/pull/1'));
	});
});
