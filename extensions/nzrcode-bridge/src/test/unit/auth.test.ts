/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import * as crypto from 'crypto';
import { generateToken, validateToken } from '../../server/auth';

// Regex that every valid bridge token must fully match.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

suite('auth — generateToken', () => {
	test('returns a string of exactly 43 characters', () => {
		const token = generateToken();
		assert.equal(token.length, 43);
	});

	test('matches the base64url alphabet regex /^[A-Za-z0-9_-]{43}$/ (no padding, no + or /)', () => {
		const token = generateToken();
		assert.match(token, TOKEN_RE);
	});

	test('returns a different value on successive calls (10 calls all distinct)', () => {
		const tokens = Array.from({ length: 10 }, () => generateToken());
		const unique = new Set(tokens);
		assert.equal(unique.size, 10, 'expected all 10 tokens to be distinct');
	});

	test('underlying entropy is 32 bytes: decoding the 43-char result yields a 32-byte buffer', () => {
		const token = generateToken();
		const decoded = Buffer.from(token, 'base64url');
		assert.equal(decoded.length, 32);
	});
});

suite('auth — validateToken', () => {
	test('returns true when stored equals candidate (round-trip with a freshly generated token)', () => {
		const token = generateToken();
		assert.equal(validateToken(token, token), true);
	});

	test('returns false when stored differs by one byte from candidate', () => {
		const token = generateToken();
		const buf = Buffer.from(token, 'base64url');
		// Flip the first byte.
		buf[0] = buf[0] ^ 0xff;
		const altered = buf.toString('base64url');
		assert.equal(validateToken(token, altered), false);
	});

	test('returns false when candidate is shorter than 43 chars', () => {
		const token = generateToken();
		const shorter = token.slice(0, 42);
		assert.equal(validateToken(token, shorter), false);
	});

	test('returns false when candidate is longer than 43 chars', () => {
		const token = generateToken();
		const longer = token + 'A';
		assert.equal(validateToken(token, longer), false);
	});

	test('returns false when candidate contains invalid base64url chars (+ or /)', () => {
		const token = generateToken();
		// Replace last char with '+', which is standard base64 but not base64url.
		const invalid = token.slice(0, 42) + '+';
		assert.equal(validateToken(token, invalid), false);
	});

	test('returns false when stored is empty string', () => {
		const token = generateToken();
		assert.equal(validateToken('', token), false);
	});

	test('returns false when both stored and candidate are 43 As vs 43 Bs (byte-different, same length)', () => {
		const storedAs = 'A'.repeat(43);
		const candidateBs = 'B'.repeat(43);
		assert.equal(validateToken(storedAs, candidateBs), false);
	});

	test('returns true when both stored and candidate are the same 43-char all-A string', () => {
		const same = 'A'.repeat(43);
		assert.equal(validateToken(same, same), true);
	});

	test('returns false when stored has invalid base64url char (slash)', () => {
		const valid = generateToken();
		// Replace first char of stored with '/' (standard base64, not base64url).
		const invalid = '/' + valid.slice(1);
		assert.equal(validateToken(invalid, valid), false);
	});

	test('returns false when both stored and candidate are 43-char strings containing "/"', () => {
		const invalid = '/'.repeat(43);
		assert.equal(validateToken(invalid, invalid), false);
	});

	test('timing-safety smoke test: validateToken completes without throwing for both matching and non-matching tokens', () => {
		// This is NOT a statistical timing analysis — that would require benchmarking
		// under a controlled harness to defeat noise.  The real guarantee is that
		// crypto.timingSafeEqual operates on raw byte buffers, so the comparison
		// duration is independent of the content of the stored token.
		// This test simply documents the intent and ensures no exception is raised
		// across many calls.
		const stored = generateToken();
		const matching = stored;
		const nonMatching = generateToken(); // astronomically unlikely to collide

		for (let i = 0; i < 100; i++) {
			const r1 = validateToken(stored, matching);
			const r2 = validateToken(stored, nonMatching);
			assert.equal(r1, true);
			assert.equal(typeof r2, 'boolean'); // false or (theoretically) true
		}
	});

	test('does not expose stored token value through error throws (malformed candidate returns false, not throw)', () => {
		const token = generateToken();
		// A 43-char string with a null byte embedded — potentially problematic for some decoders.
		const malformed = 'A'.repeat(42) + '\x00';
		// Should return false without throwing.
		let result: boolean | undefined;
		assert.doesNotThrow(() => {
			result = validateToken(token, malformed);
		});
		assert.equal(result, false);
	});
});

// Verify we are NOT importing from Node's internal timingSafeEqual indirectly via a string compare.
// This is a build-time contract check: the function signature must exist on node:crypto.
suite('auth — security contract', () => {
	test('crypto.timingSafeEqual is available in this Node version (prerequisite for auth.ts)', () => {
		assert.equal(typeof crypto.timingSafeEqual, 'function');
	});
});
