/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * NZR_TOKENS — the canonical NZRCode brand palette.
 *
 * Every later NZRCode feature (Mission Control, station UI, pipeline rail)
 * imports from this module instead of declaring colors inline. The values
 * mirror what is shipped in `extensions/theme-defaults/themes/nzr-dark.json`;
 * the smoke suite at `test/nzrcode-theme/` cross-checks the two stay in sync.
 *
 * `as const` preserves literal types so consumers get exact string typing
 * (`NZR_TOKENS.amber` is `'#ffa45c'`, not `string`).
 */
export const NZR_TOKENS = {
	// surface
	bg: '#0d0c0a',
	surface: '#15130f',
	elev: '#1c1914',
	elev2: '#232017',
	border: '#2a261c',
	borderStrong: '#3a3525',

	// text
	text: '#ece6dd',
	text2: '#b8b0a1',
	muted: '#7a7363',
	dim: '#5a5446',

	// accent
	amber: '#ffa45c',
	amberDim: '#c47a3e',
	amberSoft: 'rgba(255,164,92,0.12)',
	amberLine: 'rgba(255,164,92,0.28)',

	// pipeline stages (AIADev)
	stageSpecify: '#8db8ff',   // blue
	stageClarify: '#ffa45c',   // amber
	stagePlan: '#c9a8ff',      // violet
	stageTasks: '#7fd9d2',     // cyan
	stageImplement: '#8de29a', // green
	stageReview: '#ffd16c',    // yellow
	stageDone: '#5a8a64',      // muted green
	stageFailed: '#ff8a7a',    // red

	// type
	fontMono: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
	fontSans: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
} as const;

export type NzrTokens = typeof NZR_TOKENS;
export type NzrTokenKey = keyof NzrTokens;
