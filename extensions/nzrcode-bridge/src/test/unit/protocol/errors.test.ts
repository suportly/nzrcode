/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import {
	BridgeErrorCode,
	BRIDGE_ERROR_JSONRPC_CODE,
	BRIDGE_ERROR_DEFAULT_MESSAGE,
	bridgeError,
} from '../../../protocol/errors';

suite('Bridge error catalog', () => {
	const allCodes: readonly BridgeErrorCode[] = [
		BridgeErrorCode.AuthFailure,
		BridgeErrorCode.CommandNotFound,
		BridgeErrorCode.NoActiveEditor,
		BridgeErrorCode.PayloadTooLarge,
		BridgeErrorCode.ClientTooSlow,
		BridgeErrorCode.PathOutsideWorkspace,
		BridgeErrorCode.RelayUnavailable,
		BridgeErrorCode.InternalError,
	];

	test('every BridgeErrorCode has a JSON-RPC numeric code in the application range', () => {
		for (const c of allCodes) {
			const n = BRIDGE_ERROR_JSONRPC_CODE[c];
			assert.ok(n >= -32099 && n <= -32000, `${c} → ${n} not in JSON-RPC application range`);
		}
	});

	test('JSON-RPC numeric codes are unique across BridgeErrorCode entries', () => {
		const seen = new Set<number>();
		for (const c of allCodes) {
			const n = BRIDGE_ERROR_JSONRPC_CODE[c];
			assert.ok(!seen.has(n), `Duplicate JSON-RPC code ${n} for ${c}`);
			seen.add(n);
		}
	});

	test('every BridgeErrorCode has a default message', () => {
		for (const c of allCodes) {
			assert.ok(BRIDGE_ERROR_DEFAULT_MESSAGE[c].length > 0);
		}
	});

	test('bridgeError(code) returns a valid JsonRpcError with the canonical message', () => {
		const e = bridgeError(BridgeErrorCode.AuthFailure);
		assert.equal(e.code, BRIDGE_ERROR_JSONRPC_CODE[BridgeErrorCode.AuthFailure]);
		assert.equal(e.message, BRIDGE_ERROR_DEFAULT_MESSAGE[BridgeErrorCode.AuthFailure]);
		assert.deepEqual(e.data, { bridgeCode: BridgeErrorCode.AuthFailure });
	});

	test('bridgeError(code, data) merges data with bridgeCode', () => {
		const e = bridgeError(BridgeErrorCode.PayloadTooLarge, { limit: 10485760 });
		assert.deepEqual(e.data, { bridgeCode: BridgeErrorCode.PayloadTooLarge, limit: 10485760 });
	});

	test('bridgeError(code, { message }) overrides default message', () => {
		const e = bridgeError(BridgeErrorCode.NoActiveEditor, {
			message: 'editor.action.formatDocument needs an active editor',
		});
		assert.equal(e.message, 'editor.action.formatDocument needs an active editor');
	});

	test('bridgeError(code, { data }) treats data as opaque', () => {
		const e = bridgeError(BridgeErrorCode.PathOutsideWorkspace, { data: { path: '/etc/passwd' } });
		assert.deepEqual(e.data, { bridgeCode: BridgeErrorCode.PathOutsideWorkspace, path: '/etc/passwd' });
	});

	test('bridgeError ignores caller-supplied bridgeCode in extra data', () => {
		// Defense against accidental or malicious overwrite: the factory's canonical
		// bridgeCode must always win, even when the caller passes one in extraData.
		const e = bridgeError(BridgeErrorCode.PayloadTooLarge, { bridgeCode: 'spoofed_code', limit: 42 });
		const data = e.data as Record<string, unknown>;
		assert.equal(data.bridgeCode, BridgeErrorCode.PayloadTooLarge);
		assert.equal(data.limit, 42);
	});
});
