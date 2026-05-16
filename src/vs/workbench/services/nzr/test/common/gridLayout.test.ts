/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { computeGridLayout } from '../../common/gridLayout.js';

suite('computeGridLayout', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('zero stations -> 0x0, no overflow', () => {
		assert.deepStrictEqual(
			computeGridLayout(0),
			{ cols: 0, rows: 0, capacity: 0, overflowScroll: false },
		);
	});

	test('one station -> 1x1', () => {
		assert.deepStrictEqual(
			computeGridLayout(1),
			{ cols: 1, rows: 1, capacity: 1, overflowScroll: false },
		);
	});

	test('two stations -> 1x2 (one row, two columns)', () => {
		assert.deepStrictEqual(
			computeGridLayout(2),
			{ cols: 2, rows: 1, capacity: 2, overflowScroll: false },
		);
	});

	test('three and four stations -> 2x2', () => {
		const expected = { cols: 2, rows: 2, capacity: 4, overflowScroll: false };
		assert.deepStrictEqual(computeGridLayout(3), expected);
		assert.deepStrictEqual(computeGridLayout(4), expected);
	});

	test('five and six stations -> 3x2', () => {
		const expected = { cols: 3, rows: 2, capacity: 6, overflowScroll: false };
		assert.deepStrictEqual(computeGridLayout(5), expected);
		assert.deepStrictEqual(computeGridLayout(6), expected);
	});

	test('seven or more stations -> 3x2 with overflow scroll', () => {
		const expected = { cols: 3, rows: 2, capacity: 6, overflowScroll: true };
		assert.deepStrictEqual(computeGridLayout(7), expected);
		assert.deepStrictEqual(computeGridLayout(20), expected);
		assert.deepStrictEqual(computeGridLayout(100), expected);
	});

	test('negative, NaN, and fractional inputs clamp to zero', () => {
		const zero = { cols: 0, rows: 0, capacity: 0, overflowScroll: false };
		assert.deepStrictEqual(computeGridLayout(-1), zero);
		assert.deepStrictEqual(computeGridLayout(-100), zero);
		assert.deepStrictEqual(computeGridLayout(Number.NaN), zero);
		assert.deepStrictEqual(computeGridLayout(0.7), zero); // floors to 0
	});

	test('fractional positive inputs floor down', () => {
		assert.deepStrictEqual(
			computeGridLayout(2.9),
			{ cols: 2, rows: 1, capacity: 2, overflowScroll: false },
		);
		assert.deepStrictEqual(
			computeGridLayout(4.5),
			{ cols: 2, rows: 2, capacity: 4, overflowScroll: false },
		);
	});

	test('capacity always equals cols * rows', () => {
		for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 50]) {
			const layout = computeGridLayout(n);
			assert.strictEqual(
				layout.capacity,
				layout.cols * layout.rows,
				`capacity mismatch for stationCount=${n}`,
			);
		}
	});
});
