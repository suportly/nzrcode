/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import { redactToken, redactContent, redactForLogging, logRequest } from '../../logging';

suite('logging — redactToken', () => {
	test('empty string returns empty string', () => {
		assert.equal(redactToken(''), '');
	});

	test('short string (length <= 8) returns "…"', () => {
		assert.equal(redactToken('short'), '…');
	});

	test('9-char string returns first 8 chars followed by "…"', () => {
		assert.equal(redactToken('exactly8c'), 'exactly8…');
	});

	test('43-char token returns first 8 chars followed by "…"', () => {
		assert.equal(redactToken('a'.repeat(43)), 'aaaaaaaa…');
	});
});

suite('logging — redactContent', () => {
	test('Buffer input returns correct bytes and sha256Prefix', () => {
		const result = redactContent(Buffer.from('hello'));
		assert.equal(result.bytes, 5);
		assert.equal(result.sha256Prefix, '2cf24d');
	});

	test('string input metadata does not contain original content in JSON serialization', () => {
		const result = redactContent('SUPER_SECRET_VALUE');
		const serialized = JSON.stringify(result);
		assert.equal(serialized.includes('SUPER_SECRET_VALUE'), false);
	});
});

suite('logging — redactForLogging', () => {
	test('sensitive key "token" with long string value is redacted', () => {
		const result = redactForLogging({ token: 'a'.repeat(43) }) as Record<string, unknown>;
		assert.equal(result['token'], 'aaaaaaaa…');
	});

	test('sensitive key match is case-insensitive ("Token" matches)', () => {
		const result = redactForLogging({ Token: 'a'.repeat(43) }) as Record<string, unknown>;
		assert.equal(result['Token'], 'aaaaaaaa…');
	});

	test('sensitive key "apnsToken" is redacted', () => {
		// 'devicePushTokenHexX' is 18 chars: first 8 + '…'
		const result = redactForLogging({ apnsToken: 'devicePushTokenHexX' }) as Record<string, unknown>;
		assert.equal(result['apnsToken'], 'devicePu…');
	});

	test('nested sensitive key is redacted 3 levels deep', () => {
		const input = { outer: { mid: { token: 'a'.repeat(43) } } };
		const result = redactForLogging(input) as { outer: { mid: { token: string } } };
		assert.equal(result.outer.mid.token, 'aaaaaaaa…');
	});

	test('non-string sensitive value is replaced with "[redacted]"', () => {
		const result = redactForLogging({ token: 12345 }) as Record<string, unknown>;
		assert.equal(result['token'], '[redacted]');
	});

	test('non-sensitive keys pass through unchanged', () => {
		const input = { method: 'commands.execute', args: ['ls', '-la'] };
		const result = redactForLogging(input) as typeof input;
		assert.equal(result.method, 'commands.execute');
		assert.deepEqual(result.args, ['ls', '-la']);
	});

	test('Map instance returns "[non-serializable]"', () => {
		assert.equal(redactForLogging(new Map()), '[non-serializable]');
	});

	test('circular references collapse to "[circular]" without stack overflow', () => {
		type Node = { name: string; self?: Node };
		const a: Node = { name: 'a' };
		a.self = a;
		const result = redactForLogging(a) as Record<string, unknown>;
		assert.equal(result['name'], 'a');
		assert.equal(result['self'], '[circular]');
	});

	test('privacy: token value is not leaked beyond first 8 chars', () => {
		const secret = 'SUPER_LONG_SECRET_VALUE_DO_NOT_LEAK_aaaaaaaaaaaaaaaaaaa';
		const result = redactForLogging({ token: secret });
		const serialized = JSON.stringify(result);
		assert.equal(serialized.includes('SECRET_VALUE'), false);
		// verify the first 8 chars are present but nothing beyond
		assert.equal(serialized.includes('SUPER_LO'), true);
		assert.equal(serialized.includes('SUPER_LON'), false);
	});
});

suite('logging — logRequest', () => {
	test('sensitive fields in params are redacted, non-sensitive pass through, remoteAddress preserved', () => {
		const req = {
			method: 'notifications.register',
			params: { deviceId: 'D1', apnsToken: 'aaaa'.repeat(20) },
			remoteAddress: '127.0.0.1',
		};
		const result = logRequest(req);
		assert.equal(result.method, 'notifications.register');
		assert.equal(result.remoteAddress, '127.0.0.1');

		const redacted = result.paramsRedacted as Record<string, unknown>;
		assert.equal(redacted['deviceId'], 'D1');
		// apnsToken is 80 chars — first 8 + '…'
		assert.equal(redacted['apnsToken'], 'aaaaaaaa…');
	});
});
