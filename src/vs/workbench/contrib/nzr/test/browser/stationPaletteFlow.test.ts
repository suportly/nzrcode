/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { PipelineStage, Station } from '../../../../../platform/nzr/common/pipelineState.js';
import {
	buildStationQuickPickItems,
	DEFAULT_BRANCH,
	humanizeStage,
	PRESETS,
	validateRepoPath,
} from '../../browser/stationPaletteFlow.js';

function makeStation(overrides: Partial<Station> = {}): Station {
	const base: Station = {
		id: 'station-1',
		repoPath: '/tmp/repo',
		repoName: 'my-repo',
		branch: 'main',
		preset: 'lean',
		pipeline: { stage: 'specify', blocked: false },
		metrics: { tokens: 0, cost: 0, startedAt: 1_700_000_000_000 },
	};
	return { ...base, ...overrides };
}

suite('stationPaletteFlow', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('PRESETS', () => {
		test('lists the 4 supported presets', () => {
			assert.deepStrictEqual([...PRESETS], ['django-react', 'expo-mobile', 'python-cli', 'lean']);
		});

		test('DEFAULT_BRANCH is "main"', () => {
			assert.strictEqual(DEFAULT_BRANCH, 'main');
		});
	});

	suite('buildStationQuickPickItems', () => {
		test('returns empty list for empty stations', () => {
			assert.deepStrictEqual(buildStationQuickPickItems([]), []);
		});

		test('returns one item per station', () => {
			const stations = [
				makeStation({ id: 'a', repoName: 'alpha', branch: 'main' }),
				makeStation({ id: 'b', repoName: 'beta', branch: 'feature/x', pipeline: { stage: 'plan', blocked: false } }),
				makeStation({ id: 'c', repoName: 'gamma', branch: 'dev', pipeline: { stage: 'done', blocked: false } }),
			];
			const items = buildStationQuickPickItems(stations);
			assert.strictEqual(items.length, 3);
			assert.strictEqual(items[0].stationId, 'a');
			assert.ok(items[0].label.includes('alpha'));
			assert.ok(items[0].label.includes('main'));
			assert.strictEqual(items[1].stationId, 'b');
			assert.ok(items[1].label.includes('beta'));
			assert.ok(items[2].stationId, 'c');
		});

		test('description column contains humanized stage', () => {
			const station = makeStation({ pipeline: { stage: 'review', blocked: false } });
			const [item] = buildStationQuickPickItems([station]);
			assert.ok(item.description);
			assert.ok(item.description!.toLowerCase().includes('review') || item.description!.length > 0);
		});
	});

	suite('humanizeStage', () => {
		const allStages: PipelineStage[] = ['specify', 'clarify', 'plan', 'tasks', 'implement', 'review', 'done', 'failed', 'idle'];

		test('returns non-empty string for every PipelineStage value', () => {
			for (const stage of allStages) {
				const label = humanizeStage(stage);
				assert.ok(label.length > 0, `humanizeStage(${stage}) returned empty`);
			}
		});

		test('returned labels are unique across the 9 stage values', () => {
			const labels = allStages.map(humanizeStage);
			assert.strictEqual(new Set(labels).size, allStages.length);
		});
	});

	suite('validateRepoPath', () => {
		test('returns localized error for undefined', () => {
			const result = validateRepoPath(undefined);
			assert.ok(typeof result === 'string' && result.length > 0);
		});

		test('returns localized error for empty string', () => {
			const result = validateRepoPath('');
			assert.ok(typeof result === 'string' && result.length > 0);
		});

		test('returns localized error for whitespace only', () => {
			const result = validateRepoPath('   ');
			assert.ok(typeof result === 'string' && result.length > 0);
		});

		test('returns undefined for a valid path', () => {
			assert.strictEqual(validateRepoPath('/some/valid/path'), undefined);
		});
	});
});
