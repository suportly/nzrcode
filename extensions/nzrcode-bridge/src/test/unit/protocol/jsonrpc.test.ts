/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert/strict';
import {
	ParseError,
	isErrorResponse,
	isNotification,
	isRequest,
	isResponse,
	isSuccessResponse,
	parseMessage,
	serializeErrorResponse,
	serializeNotification,
	serializeRequest,
	serializeResponse,
} from '../../../protocol/jsonrpc';

suite('JsonRpc parseMessage', () => {
	// ── 1. Valid Request – numeric id ──────────────────────────────────────
	test('parses a valid request with numeric id and returns request shape', () => {
		const raw = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'workspace.open', params: { path: '/tmp' } });

		const msg = parseMessage(raw);

		assert.equal((msg as { id: unknown }).id, 1);
		assert.equal((msg as { method: unknown }).method, 'workspace.open');
		assert.deepEqual((msg as { params: unknown }).params, { path: '/tmp' });
		assert.ok(isRequest(msg));
	});

	// ── 2. Valid Request – string id ───────────────────────────────────────
	test('parses a valid request with string id and returns request shape', () => {
		const raw = JSON.stringify({ jsonrpc: '2.0', id: 'req-abc', method: 'ping' });

		const msg = parseMessage(raw);

		assert.equal((msg as { id: unknown }).id, 'req-abc');
		assert.ok(isRequest(msg));
	});

	// ── 3. Notification (no id) ────────────────────────────────────────────
	test('parses a notification with no id field and returns notification shape', () => {
		const raw = JSON.stringify({ jsonrpc: '2.0', method: 'events/fileChanged', params: { uri: 'file:///a.ts' } });

		const msg = parseMessage(raw);

		assert.ok(!('id' in msg), 'notification must not have an id property');
		assert.equal((msg as { method: unknown }).method, 'events/fileChanged');
		assert.ok(isNotification(msg));
		assert.ok(!isRequest(msg));
		assert.ok(!isResponse(msg));
	});

	// ── 4. SuccessResponse ─────────────────────────────────────────────────
	test('parses a success response and isSuccessResponse returns true', () => {
		const raw = JSON.stringify({ jsonrpc: '2.0', id: 7, result: { ok: true } });

		const msg = parseMessage(raw);

		assert.ok(isResponse(msg));
		assert.ok(isSuccessResponse(msg as Parameters<typeof isSuccessResponse>[0]));
		assert.ok(!isErrorResponse(msg as Parameters<typeof isSuccessResponse>[0]));
	});

	// ── 5. ErrorResponse ───────────────────────────────────────────────────
	test('parses an error response and isErrorResponse returns true', () => {
		const raw = JSON.stringify({ jsonrpc: '2.0', id: 3, error: { code: -32600, message: 'Invalid Request' } });

		const msg = parseMessage(raw);

		assert.ok(isResponse(msg));
		assert.ok(isErrorResponse(msg as Parameters<typeof isSuccessResponse>[0]));
		assert.ok(!isSuccessResponse(msg as Parameters<typeof isSuccessResponse>[0]));
	});

	// ── 6. ParseError cases ────────────────────────────────────────────────
	test('throws ParseError for empty string', () => {
		assert.throws(() => parseMessage(''), ParseError);
	});

	test('throws ParseError for invalid JSON', () => {
		assert.throws(() => parseMessage('{not valid json}'), ParseError);
	});

	test('throws ParseError when jsonrpc field is missing', () => {
		const raw = JSON.stringify({ id: 1, method: 'ping' });
		assert.throws(() => parseMessage(raw), ParseError);
	});

	test('throws ParseError when jsonrpc field is not "2.0"', () => {
		const raw = JSON.stringify({ jsonrpc: '1.0', id: 1, method: 'ping' });
		assert.throws(() => parseMessage(raw), ParseError);
	});

	test('throws ParseError when request is missing method field', () => {
		const raw = JSON.stringify({ jsonrpc: '2.0', id: 5 });
		assert.throws(() => parseMessage(raw), ParseError);
	});

	test('throws ParseError when response has both result and error fields', () => {
		const raw = JSON.stringify({
			jsonrpc: '2.0',
			id: 2,
			result: { ok: true },
			error: { code: -32600, message: 'Invalid Request' },
		});
		assert.throws(() => parseMessage(raw), ParseError);
	});
});

suite('JsonRpc serializers round-trip', () => {
	// ── 7. serializeRequest round-trip ────────────────────────────────────
	test('serializeRequest produces a string that parseMessage returns as a request shape', () => {
		const serialized = serializeRequest(42, 'system.hello');

		const msg = parseMessage(serialized);

		assert.ok(isRequest(msg));
		assert.equal((msg as { id: unknown }).id, 42);
		assert.equal((msg as { method: unknown }).method, 'system.hello');
	});

	// ── 8. serializeNotification round-trip ──────────────────────────────
	test('serializeNotification produces a string that parseMessage returns as a notification shape', () => {
		const serialized = serializeNotification('events/ping', { ts: 0 });

		const msg = parseMessage(serialized);

		assert.ok(isNotification(msg));
		assert.equal((msg as { method: unknown }).method, 'events/ping');
	});

	// ── 9. serializeResponse round-trip ──────────────────────────────────
	test('serializeResponse produces a string that parseMessage returns as a success response', () => {
		const serialized = serializeResponse(10, { files: 3 });

		const msg = parseMessage(serialized);

		assert.ok(isResponse(msg));
		assert.ok(isSuccessResponse(msg as Parameters<typeof isSuccessResponse>[0]));
	});

	// ── 10. serializeErrorResponse round-trip ────────────────────────────
	test('serializeErrorResponse produces a string that parseMessage returns as an error response', () => {
		const serialized = serializeErrorResponse(null, { code: -32601, message: 'Method not found' });

		const msg = parseMessage(serialized);

		assert.ok(isResponse(msg));
		assert.ok(isErrorResponse(msg as Parameters<typeof isSuccessResponse>[0]));
	});
});

suite('JsonRpc type guards', () => {
	test('isRequest returns true for a request and false for response and notification', () => {
		const req = parseMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'x' }));
		const notif = parseMessage(JSON.stringify({ jsonrpc: '2.0', method: 'x' }));
		const resp = parseMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }));

		assert.ok(isRequest(req));
		assert.ok(!isRequest(notif));
		assert.ok(!isRequest(resp));
	});

	test('isNotification returns true for a notification and false for request and response', () => {
		const req = parseMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'x' }));
		const notif = parseMessage(JSON.stringify({ jsonrpc: '2.0', method: 'x' }));
		const resp = parseMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }));

		assert.ok(!isNotification(req));
		assert.ok(isNotification(notif));
		assert.ok(!isNotification(resp));
	});

	test('isResponse returns true for a response and false for request and notification', () => {
		const req = parseMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'x' }));
		const notif = parseMessage(JSON.stringify({ jsonrpc: '2.0', method: 'x' }));
		const resp = parseMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }));

		assert.ok(!isResponse(req));
		assert.ok(!isResponse(notif));
		assert.ok(isResponse(resp));
	});
});

suite('JsonRpc ID correlation', () => {
	test('request serialized with numeric id 42 parses back with id === 42', () => {
		const serialized = serializeRequest(42, 'ping');

		const msg = parseMessage(serialized);

		assert.equal((msg as { id: unknown }).id, 42);
	});

	test('request serialized with string id parses back with same string id', () => {
		const serialized = serializeRequest('trace-001', 'ping');

		const msg = parseMessage(serialized);

		assert.equal((msg as { id: unknown }).id, 'trace-001');
	});
});
