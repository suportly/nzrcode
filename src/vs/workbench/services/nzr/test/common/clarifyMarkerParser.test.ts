/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Suportly. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { parseClarifyMarkers } from '../../common/clarifyMarkerParser.js';

suite('parseClarifyMarkers', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('extracts a single marker with id, question, and surrounding section', () => {
		const content = [
			'# Spec',
			'',
			'## Clarifications',
			'',
			'- [NEEDS CLARIFICATION:cl-1 Qual timezone usar?]',
		].join('\n');

		const result = parseClarifyMarkers(content);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].id, 'cl-1');
		assert.strictEqual(result[0].question, 'Qual timezone usar?');
		assert.strictEqual(result[0].section, 'Clarifications');
	});

	test('returns multiple markers in order with each correct section', () => {
		const content = [
			'## Problem',
			'- [NEEDS CLARIFICATION:cl-1 Pergunta A]',
			'',
			'## Reconnaissance',
			'- [NEEDS CLARIFICATION:cl-2 Pergunta B]',
			'- [NEEDS CLARIFICATION:cl-3 Pergunta C]',
		].join('\n');

		const result = parseClarifyMarkers(content);

		assert.strictEqual(result.length, 3);
		assert.deepStrictEqual(result.map(m => m.id), ['cl-1', 'cl-2', 'cl-3']);
		assert.deepStrictEqual(result.map(m => m.question), ['Pergunta A', 'Pergunta B', 'Pergunta C']);
		assert.deepStrictEqual(result.map(m => m.section), ['Problem', 'Reconnaissance', 'Reconnaissance']);
	});

	test('returns empty array when no markers are present', () => {
		const content = '# Spec\n\n## Clarifications\n\nNo open questions.\n';
		const result = parseClarifyMarkers(content);
		assert.deepStrictEqual(result, []);
	});

	test('silently ignores malformed markers (missing or empty cl-N)', () => {
		const content = [
			'## Clarifications',
			'- [NEEDS CLARIFICATION: missing id]',
			'- [NEEDS CLARIFICATION:cl- empty id]',
			'- [NEEDS CLARIFICATION:cl-7 well-formed]',
		].join('\n');

		const result = parseClarifyMarkers(content);

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].id, 'cl-7');
		assert.strictEqual(result[0].question, 'well-formed');
	});

	test('question stops at first unescaped ]; supports escaped \\] inside body', () => {
		const content = [
			'## Q',
			'- [NEEDS CLARIFICATION:cl-1 includes \\] and "quotes"]',
			'- [NEEDS CLARIFICATION:cl-2 ends at first bracket] tail',
		].join('\n');

		const result = parseClarifyMarkers(content);

		assert.strictEqual(result.length, 2);
		assert.strictEqual(result[0].question, 'includes ] and "quotes"');
		assert.strictEqual(result[1].question, 'ends at first bracket');
	});

	test('marker before any heading is captured with empty section', () => {
		const content = '[NEEDS CLARIFICATION:cl-1 sem heading antes]';
		const result = parseClarifyMarkers(content);
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].section, '');
	});
});
