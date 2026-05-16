/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ClarifyMarker } from '../../../../platform/nzr/common/pipelineState.js';

/**
 * Pure function that scans a spec.md (or plan.md) body for
 * `[NEEDS CLARIFICATION:cl-N <question>]` markers and returns them in the
 * order they appear, each tagged with the most recent level-2 section
 * heading seen above it.
 *
 * Tolerance contract:
 *   - markers without a `cl-N` id are silently skipped;
 *   - questions stop at the first un-escaped `]`;
 *   - the "section" is the last `## …` line seen, or empty string when
 *     the marker appears before any heading.
 *
 * The function performs no I/O and never throws.
 */
export function parseClarifyMarkers(content: string): ClarifyMarker[] {
	const out: ClarifyMarker[] = [];

	const lines = content.split('\n');
	let currentSection = '';

	const headingRe = /^##\s+(.+?)\s*$/;
	const markerRe = /\[NEEDS CLARIFICATION:(cl-\d+)\s+((?:\\\]|[^\]])+?)\]/g;

	for (const line of lines) {
		const headingMatch = line.match(headingRe);
		if (headingMatch) {
			currentSection = headingMatch[1].trim();
			continue;
		}

		const matches = line.matchAll(markerRe);
		for (const m of matches) {
			const id = m[1];
			const question = m[2].replace(/\\\]/g, ']').trim();
			out.push({
				id,
				section: currentSection,
				question,
			});
		}
	}

	return out;
}
