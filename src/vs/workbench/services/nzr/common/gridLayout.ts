/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Result of a layout computation for an NZRCode Mission Control grid.
 * `cols` x `rows` is the visible slot capacity; `capacity` echoes
 * `cols * rows` for callers that don't want to recompute. When
 * `overflowScroll` is true, the layout still shows the first `capacity`
 * stations in the visible grid and the rest are scrollable inside the
 * grid container — feature 0007 owns the actual scroll handling.
 */
export interface GridLayout {
	readonly cols: number;
	readonly rows: number;
	readonly capacity: number;
	readonly overflowScroll: boolean;
}

/**
 * Brief §6.6 grid rules:
 *   0      -> 0x0
 *   1      -> 1x1
 *   2      -> 1x2
 *   3-4    -> 2x2
 *   5-6    -> 3x2
 *   7+     -> 3x2 with overflow scroll
 *
 * Negative / NaN inputs clamp to 0 (defensive). Pure function, safe to
 * call from any layer.
 */
export function computeGridLayout(stationCount: number): GridLayout {
	const safe = Number.isFinite(stationCount) && stationCount > 0 ? Math.floor(stationCount) : 0;

	if (safe === 0) {
		return { cols: 0, rows: 0, capacity: 0, overflowScroll: false };
	}
	if (safe === 1) {
		return { cols: 1, rows: 1, capacity: 1, overflowScroll: false };
	}
	if (safe === 2) {
		return { cols: 2, rows: 1, capacity: 2, overflowScroll: false };
	}
	if (safe <= 4) {
		return { cols: 2, rows: 2, capacity: 4, overflowScroll: false };
	}
	if (safe <= 6) {
		return { cols: 3, rows: 2, capacity: 6, overflowScroll: false };
	}
	return { cols: 3, rows: 2, capacity: 6, overflowScroll: true };
}
