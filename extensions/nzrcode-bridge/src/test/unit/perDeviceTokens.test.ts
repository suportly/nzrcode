/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	addToken,
	getTokens,
	loadOrCreateState,
	removeToken,
	stateFilePath,
} from '../../server/state';
import { findTokenMatch } from '../../server/auth';

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

let tmpHome: string;

suite('Per-device tokens — state', () => {
	setup(() => {
		tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nzrcode-pdt-test-'));
		process.env['NZRCODE_HOME'] = tmpHome;
	});

	teardown(() => {
		delete process.env['NZRCODE_HOME'];
		fs.rmSync(tmpHome, { recursive: true, force: true });
	});

	test('loadOrCreateState creates a v2 state with empty tokens', () => {
		const state = loadOrCreateState();
		assert.equal(state.version, 2);
		assert.deepEqual(state.tokens, {});
	});

	test('addToken upserts an entry into the tokens map', () => {
		loadOrCreateState();
		const tok = 'a'.repeat(43);
		addToken('device-1', tok);

		assert.deepEqual(getTokens(), { 'device-1': tok });

		const onDisk = JSON.parse(fs.readFileSync(stateFilePath(), 'utf-8')) as { tokens: Record<string, string>; version: number };
		assert.deepEqual(onDisk.tokens, { 'device-1': tok });
		assert.equal(onDisk.version, 2);
	});

	test('addToken overwrites an existing entry for the same deviceId', () => {
		loadOrCreateState();
		const first = 'a'.repeat(43);
		const second = 'b'.repeat(43);
		addToken('device-1', first);
		addToken('device-1', second);

		assert.deepEqual(getTokens(), { 'device-1': second });
	});

	test('removeToken returns true when an entry existed', () => {
		loadOrCreateState();
		addToken('device-1', 'a'.repeat(43));

		assert.equal(removeToken('device-1'), true);
		assert.deepEqual(getTokens(), {});
	});

	test('removeToken returns false for an unknown deviceId (no-op)', () => {
		loadOrCreateState();
		assert.equal(removeToken('ghost'), false);
	});

	test('getTokens returns a defensive copy', () => {
		loadOrCreateState();
		addToken('device-1', 'a'.repeat(43));

		const copy = getTokens();
		// Mutating the snapshot must not affect the store.
		try {
			(copy as Record<string, string>)['device-2'] = 'b'.repeat(43);
		} catch {
			// Frozen object — acceptable. Either way, getTokens stays stable.
		}

		const fresh = getTokens();
		assert.deepEqual(fresh, { 'device-1': 'a'.repeat(43) });
	});

	test('v1 → v2 migration wipes the legacy shared token but preserves lastPort', () => {
		// Hand-roll a v1 state on disk.
		const v1Path = stateFilePath();
		fs.mkdirSync(path.dirname(v1Path), { recursive: true, mode: 0o700 });
		const legacyToken = 'L'.repeat(43);
		fs.writeFileSync(v1Path, JSON.stringify({
			token: legacyToken,
			version: 1,
			lastPort: 51234,
		}, null, 2) + '\n', { mode: 0o600 });

		const state = loadOrCreateState();

		assert.equal(state.version, 2);
		assert.deepEqual(state.tokens, {}, 'legacy token must be dropped on migration');
		assert.equal(state.lastPort, 51234, 'lastPort must survive migration');

		const onDisk = JSON.parse(fs.readFileSync(v1Path, 'utf-8'));
		assert.equal(onDisk.version, 2);
		assert.deepEqual(onDisk.tokens, {});
		assert.equal(onDisk.token, undefined, 'v1 token field must be absent from v2 payload');
	});
});

suite('Per-device tokens — findTokenMatch', () => {
	const tokenA = 'A'.repeat(43);
	const tokenB = 'B'.repeat(43);
	const tokenP = 'P'.repeat(43);

	test('returns undefined for an empty map and no pending', () => {
		assert.equal(findTokenMatch({}, undefined, tokenA), undefined);
	});

	test('matches a single-entry map', () => {
		const result = findTokenMatch({ 'd-1': tokenA }, undefined, tokenA);
		assert.deepEqual(result, { deviceId: 'd-1' });
	});

	test('finds the correct deviceId in a multi-entry map', () => {
		const result = findTokenMatch({ 'd-1': tokenA, 'd-2': tokenB }, undefined, tokenB);
		assert.deepEqual(result, { deviceId: 'd-2' });
	});

	test('returns undefined when no entry matches', () => {
		const result = findTokenMatch({ 'd-1': tokenA }, undefined, tokenB);
		assert.equal(result, undefined);
	});

	test('matches the pending-pair slot', () => {
		const result = findTokenMatch({}, tokenP, tokenP);
		assert.deepEqual(result, { pending: true });
	});

	test('persistent map wins over pending when both have the same token', () => {
		const result = findTokenMatch({ 'd-1': tokenA }, tokenA, tokenA);
		assert.deepEqual(result, { deviceId: 'd-1' });
	});

	test('rejects malformed candidate without leaking', () => {
		assert.equal(findTokenMatch({ 'd-1': tokenA }, undefined, 'short'), undefined);
		assert.equal(findTokenMatch({ 'd-1': tokenA }, undefined, ''), undefined);
	});
});
